import type { DefinitionEntry, Occurrence } from "../parser/types";

type AnnotationSelectionHandler = (definitionId: string, occurrenceId?: string) => void;

let createdAnnotationIds: string[] = [];
let annotationToDefinitionId = new Map<string, string>();
let annotationToOccurrenceId = new Map<string, string>();
let annotationToTargetKey = new Map<string, string>();
let targetKeyToAnnotationId = new Map<string, string>();
let eventContexts: OfficeExtension.EventHandlerResult<unknown>[] = [];
let annotationSelectionHandler: AnnotationSelectionHandler | undefined;

interface PendingAnnotationGroup {
  occurrences: Occurrence[];
  result: OfficeExtension.ClientResult<string[]>;
}

export async function applyInlineAnnotations(
  definitions: DefinitionEntry[],
  occurrences: Occurrence[],
  onSelectDefinition: AnnotationSelectionHandler,
): Promise<number> {
  if (!window.Office?.context?.requirements?.isSetSupported?.("WordApi", "1.8")) {
    throw new Error("WordApi 1.8 is required for inline mode.");
  }

  await ensureAnnotationEvents(onSelectDefinition);

  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const targetOccurrences = occurrences.filter((occurrence) =>
    definitionsById.has(occurrence.definitionId),
  );
  const targetKeys = new Set(
    targetOccurrences.map(getAnnotationTargetKey),
  );
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

  const grouped = new Map<string, Occurrence[]>();

  for (const occurrence of occurrencesToInsert) {
    const key = occurrence.paragraphId || `index:${occurrence.paragraphIndex}`;
    const paragraphOccurrences = grouped.get(key);
    if (paragraphOccurrences) {
      paragraphOccurrences.push(occurrence);
    } else {
      grouped.set(key, [occurrence]);
    }
  }

  await Word.run(async (context) => {
    const pendingGroups: PendingAnnotationGroup[] = [];

    for (const paragraphOccurrences of grouped.values()) {
      const paragraph = context.document.getParagraphByUniqueLocalId(
        paragraphOccurrences[0].paragraphId,
      );

      const critiques: Word.Critique[] = paragraphOccurrences.map((occurrence) => ({
        colorScheme: Word.CritiqueColorScheme.berry,
        start: occurrence.start,
        length: occurrence.length,
        popupOptions: {
          brandingTextResourceId: "Annotation.Branding",
          titleResourceId: "Annotation.Title",
          subtitleResourceId: "Annotation.Subtitle",
          suggestions: [],
        },
      }));

      const ids = paragraph.insertAnnotations({ critiques });
      pendingGroups.push({
        occurrences: paragraphOccurrences,
        result: ids,
      });
    }

    await context.sync();

    for (const group of pendingGroups) {
      const annotationIds = group.result.value ?? [];
      annotationIds.forEach((annotationId, index) => {
        const occurrence = group.occurrences[index];
        if (occurrence) {
          trackAnnotation(annotationId, occurrence);
        }
      });
    }
  });

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
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ItemNotFound"
  );
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
