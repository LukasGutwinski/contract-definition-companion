import type { DefinitionEntry, Occurrence } from "../parser/types";
import { supportsAnnotations } from "./wordClient";

type AnnotationSelectionHandler = (definitionId: string, occurrenceId?: string) => void;

const INSERTION_BATCH_SIZE = 24;
const MAX_PROBE_ATTEMPTS = 3;

let createdAnnotationIds: string[] = [];
let annotationToDefinitionId = new Map<string, string>();
let annotationToOccurrenceId = new Map<string, string>();
let annotationToTargetKey = new Map<string, string>();
let targetKeyToAnnotationId = new Map<string, string>();
let eventContexts: OfficeExtension.EventHandlerResult<unknown>[] = [];
let annotationSelectionHandler: AnnotationSelectionHandler | undefined;

interface AnnotationGroup {
  occurrences: Occurrence[];
}

interface PendingAnnotationGroup extends AnnotationGroup {
  result: OfficeExtension.ClientResult<string[]>;
}

interface AnnotationBatchResult {
  error?: unknown;
  unresolvedGroups: AnnotationGroup[];
}

export class AnnotationUnavailableError extends Error {
  readonly officeCode?: string;
  readonly originalError?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AnnotationUnavailableError";
    this.officeCode = getOfficeErrorCode(cause);
    this.originalError = cause;
  }
}

export async function applyInlineAnnotations(
  definitions: DefinitionEntry[],
  occurrences: Occurrence[],
  onSelectDefinition: AnnotationSelectionHandler,
): Promise<number> {
  if (!supportsAnnotations()) {
    throw new AnnotationUnavailableError(
      "Annotations aren't supported by this Word installation.",
    );
  }

  await ensureAnnotationEvents(onSelectDefinition);

  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const targetOccurrences = occurrences.filter((occurrence) =>
    definitionsById.has(occurrence.definitionId),
  );
  const targetKeys = new Set(targetOccurrences.map(getAnnotationTargetKey));
  const annotationIdsToDelete = createdAnnotationIds.filter((annotationId) => {
    const targetKey = annotationToTargetKey.get(annotationId);
    return !targetKey || !targetKeys.has(targetKey);
  });
  const occurrencesToInsert = targetOccurrences.filter(
    (occurrence) => !targetKeyToAnnotationId.has(getAnnotationTargetKey(occurrence)),
  );

  if (annotationIdsToDelete.length) {
    await deleteAnnotationIds(annotationIdsToDelete);
    forgetAnnotationIds(annotationIdsToDelete);
  }

  if (!occurrencesToInsert.length) {
    return createdAnnotationIds.length;
  }

  const groups = groupOccurrencesByParagraph(occurrencesToInsert);
  await insertAnnotationsReliably(groups);

  return createdAnnotationIds.length;
}

export async function clearInlineAnnotations(): Promise<void> {
  if (!createdAnnotationIds.length || !window.Word) {
    resetAnnotationTracking();
    return;
  }

  const idsToDelete = [...createdAnnotationIds];
  await deleteAnnotationIds(idsToDelete);
  forgetAnnotationIds(idsToDelete);
}

export async function disposeAnnotationEvents(): Promise<void> {
  annotationSelectionHandler = undefined;
  if (!eventContexts.length) return;

  const contexts = [...eventContexts];
  eventContexts = [];

  const requestContexts = new Set(contexts.map((eventContext) => eventContext.context));

  for (const eventContext of contexts) {
    try {
      eventContext.remove();
    } catch {
      // Event handlers can already be detached after Word reloads the task pane.
    }
  }

  for (const context of requestContexts) {
    try {
      await context.sync();
    } catch {
      // The shared event context can already be invalid after Word reloads the task pane.
    }
  }
}

async function ensureAnnotationEvents(
  onSelectDefinition: AnnotationSelectionHandler,
): Promise<void> {
  annotationSelectionHandler = onSelectDefinition;
  if (eventContexts.length) return;

  await Word.run(async (context) => {
    eventContexts = [
      context.document.onAnnotationClicked.add(async (args) => {
        const definitionId = annotationToDefinitionId.get(args.id);
        if (definitionId) {
          annotationSelectionHandler?.(
            definitionId,
            annotationToOccurrenceId.get(args.id),
          );
        }
      }),
      context.document.onAnnotationRemoved.add(async (args) => {
        forgetAnnotationIds(args.ids);
      }),
    ];

    await context.sync();
  });
}

async function insertAnnotationsReliably(groups: AnnotationGroup[]): Promise<void> {
  const probeCandidates = groups
    .filter((group) => group.occurrences.length)
    .slice(0, MAX_PROBE_ATTEMPTS);
  let probeSucceeded = false;
  let lastProbeError: unknown;

  for (const group of probeCandidates) {
    const probeResult = await tryInsertAnnotationBatch([
      { occurrences: [group.occurrences[0]] },
    ]);

    if (!probeResult.unresolvedGroups.length) {
      probeSucceeded = true;
      break;
    }
    lastProbeError = probeResult.error;
  }

  if (!probeSucceeded) {
    throw new AnnotationUnavailableError(
      "Word couldn't display annotations. Make sure Word is connected to a Microsoft 365 subscription, then try again.",
      lastProbeError,
    );
  }

  const remainingGroups = withoutTrackedOccurrences(groups);
  for (let index = 0; index < remainingGroups.length; index += INSERTION_BATCH_SIZE) {
    await insertAnnotationGroupsWithIsolation(
      remainingGroups.slice(index, index + INSERTION_BATCH_SIZE),
    );
  }
}

async function insertAnnotationGroupsWithIsolation(
  groups: AnnotationGroup[],
): Promise<void> {
  const remainingGroups = withoutTrackedOccurrences(groups);
  if (!remainingGroups.length) return;

  const result = await tryInsertAnnotationBatch(remainingGroups);
  const unresolvedGroups = withoutTrackedOccurrences(result.unresolvedGroups);
  if (!unresolvedGroups.length) return;

  if (unresolvedGroups.length > 1) {
    const midpoint = Math.ceil(unresolvedGroups.length / 2);
    await insertAnnotationGroupsWithIsolation(unresolvedGroups.slice(0, midpoint));
    await insertAnnotationGroupsWithIsolation(unresolvedGroups.slice(midpoint));
    return;
  }

  const [group] = unresolvedGroups;
  if (group.occurrences.length > 1) {
    const midpoint = Math.ceil(group.occurrences.length / 2);
    await insertAnnotationGroupsWithIsolation([
      { occurrences: group.occurrences.slice(0, midpoint) },
    ]);
    await insertAnnotationGroupsWithIsolation([
      { occurrences: group.occurrences.slice(midpoint) },
    ]);
    return;
  }

  // A single rejected annotation is non-fatal. Do not log the occurrence or the
  // Office error because either can contain text from the open document.
}

async function tryInsertAnnotationBatch(
  groups: AnnotationGroup[],
): Promise<AnnotationBatchResult> {
  const pendingGroups: PendingAnnotationGroup[] = [];
  let insertionError: unknown;

  try {
    await Word.run(async (context) => {
      try {
        for (const group of groups) {
          const paragraph = context.document.getParagraphByUniqueLocalId(
            group.occurrences[0].paragraphId,
          );
          const critiques: Word.Critique[] = group.occurrences.map(
            createCompatibleCritique,
          );
          const result = paragraph.insertAnnotations({ critiques });
          pendingGroups.push({ occurrences: group.occurrences, result });
        }

        await context.sync();
      } catch (error) {
        insertionError = error;
      }
    });
  } catch (error) {
    insertionError ??= error;
  }

  for (const group of pendingGroups) {
    const annotationIds = readAnnotationIds(group.result);
    annotationIds.forEach((annotationId, index) => {
      const occurrence = group.occurrences[index];
      if (occurrence && !targetKeyToAnnotationId.has(getAnnotationTargetKey(occurrence))) {
        trackAnnotation(annotationId, occurrence);
      }
    });
  }

  return {
    error: insertionError,
    unresolvedGroups: withoutTrackedOccurrences(groups),
  };
}

function createCompatibleCritique(occurrence: Occurrence): Word.Critique {
  return {
    colorScheme: Word.CritiqueColorScheme.berry,
    start: occurrence.start,
    length: occurrence.length,
  };
}

function readAnnotationIds(
  result: OfficeExtension.ClientResult<string[]>,
): string[] {
  try {
    return result.value ?? [];
  } catch {
    return [];
  }
}

function groupOccurrencesByParagraph(
  occurrences: Occurrence[],
): AnnotationGroup[] {
  const grouped = new Map<string, Occurrence[]>();

  for (const occurrence of occurrences) {
    const key = occurrence.paragraphId || `index:${occurrence.paragraphIndex}`;
    const paragraphOccurrences = grouped.get(key);
    if (paragraphOccurrences) {
      paragraphOccurrences.push(occurrence);
    } else {
      grouped.set(key, [occurrence]);
    }
  }

  return [...grouped.values()].map((paragraphOccurrences) => ({
    occurrences: paragraphOccurrences,
  }));
}

function withoutTrackedOccurrences(
  groups: AnnotationGroup[],
): AnnotationGroup[] {
  return groups.flatMap((group) => {
    const occurrences = group.occurrences.filter(
      (occurrence) =>
        !targetKeyToAnnotationId.has(getAnnotationTargetKey(occurrence)),
    );
    return occurrences.length ? [{ occurrences }] : [];
  });
}

async function deleteAnnotationIds(ids: string[]): Promise<void> {
  if (!ids.length) return;

  try {
    await Word.run(async (context) => {
      ids.forEach((id) => context.document.getAnnotationById(id).delete());
      await context.sync();
    });
  } catch (error) {
    if (!isMissingAnnotationError(error)) throw error;
    if (ids.length === 1) return;

    const midpoint = Math.ceil(ids.length / 2);
    await deleteAnnotationIds(ids.slice(0, midpoint));
    await deleteAnnotationIds(ids.slice(midpoint));
  }
}

function trackAnnotation(annotationId: string, occurrence: Occurrence): void {
  const targetKey = getAnnotationTargetKey(occurrence);
  createdAnnotationIds.push(annotationId);
  annotationToDefinitionId.set(annotationId, occurrence.definitionId);
  annotationToOccurrenceId.set(annotationId, occurrence.id);
  annotationToTargetKey.set(annotationId, targetKey);
  targetKeyToAnnotationId.set(targetKey, annotationId);
}

function forgetAnnotationIds(annotationIds: string[]): void {
  if (!annotationIds.length) return;

  const annotationIdSet = new Set(annotationIds);
  createdAnnotationIds = createdAnnotationIds.filter(
    (annotationId) => !annotationIdSet.has(annotationId),
  );

  for (const annotationId of annotationIds) {
    const targetKey = annotationToTargetKey.get(annotationId);
    annotationToDefinitionId.delete(annotationId);
    annotationToOccurrenceId.delete(annotationId);
    annotationToTargetKey.delete(annotationId);

    if (
      targetKey &&
      targetKeyToAnnotationId.get(targetKey) === annotationId
    ) {
      targetKeyToAnnotationId.delete(targetKey);
    }
  }
}

function resetAnnotationTracking(): void {
  createdAnnotationIds = [];
  annotationToDefinitionId = new Map();
  annotationToOccurrenceId = new Map();
  annotationToTargetKey = new Map();
  targetKeyToAnnotationId = new Map();
}

function isMissingAnnotationError(error: unknown): boolean {
  return getOfficeErrorCode(error) === "ItemNotFound";
}

function getOfficeErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
}

function getAnnotationTargetKey(occurrence: Occurrence): string {
  return JSON.stringify([
    occurrence.id,
    occurrence.definitionId,
    occurrence.paragraphId,
    occurrence.start,
    occurrence.length,
  ]);
}
