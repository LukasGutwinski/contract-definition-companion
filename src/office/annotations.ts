import type { DefinitionEntry, DocumentParagraph, Occurrence } from "../parser/types";

type AnnotationSelectionHandler = (definitionId: string, occurrenceId?: string) => void;

let createdAnnotationIds: string[] = [];
let annotationToDefinitionId = new Map<string, string>();
let annotationToOccurrenceId = new Map<string, string>();
let eventContexts: OfficeExtension.EventHandlerResult<unknown>[] = [];

interface PendingAnnotationGroup {
  occurrences: Occurrence[];
  result: OfficeExtension.ClientResult<string[]>;
}

export async function applyInlineAnnotations(
  _paragraphs: DocumentParagraph[],
  definitions: DefinitionEntry[],
  occurrences: Occurrence[],
  onSelectDefinition: AnnotationSelectionHandler,
): Promise<number> {
  if (!window.Office?.context?.requirements?.isSetSupported?.("WordApi", "1.8")) {
    throw new Error("WordApi 1.8 wird für den Inline-Modus benötigt.");
  }

  await clearInlineAnnotations();
  await registerAnnotationEvents(onSelectDefinition);

  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const grouped = new Map<string, Occurrence[]>();

  for (const occurrence of occurrences) {
    if (!definitionsById.has(occurrence.definitionId)) continue;
    const key = occurrence.paragraphId || `index:${occurrence.paragraphIndex}`;
    grouped.set(key, [...(grouped.get(key) ?? []), occurrence]);
  }

  await Word.run(async (context) => {
    const bodyParagraphs = context.document.body.paragraphs;
    bodyParagraphs.load("items");
    await context.sync();

    const pendingGroups: PendingAnnotationGroup[] = [];

    for (const paragraphOccurrences of grouped.values()) {
      const paragraph = bodyParagraphs.items[paragraphOccurrences[0].paragraphIndex];
      if (!paragraph) continue;

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
      createdAnnotationIds.push(...annotationIds);
      annotationIds.forEach((annotationId, index) => {
        const occurrence = group.occurrences[index];
        if (occurrence) {
          annotationToDefinitionId.set(annotationId, occurrence.definitionId);
          annotationToOccurrenceId.set(annotationId, occurrence.id);
        }
      });
    }
  });

  return createdAnnotationIds.length;
}

export async function clearInlineAnnotations(): Promise<void> {
  if (!createdAnnotationIds.length || !window.Word) {
    createdAnnotationIds = [];
    annotationToDefinitionId = new Map();
    annotationToOccurrenceId = new Map();
    return;
  }

  const idsToDelete = [...createdAnnotationIds];
  createdAnnotationIds = [];
  annotationToDefinitionId = new Map();
  annotationToOccurrenceId = new Map();

  await deleteAnnotationIds(idsToDelete);
}

export async function disposeAnnotationEvents(): Promise<void> {
  if (!eventContexts.length) return;

  const contexts = [...eventContexts];
  eventContexts = [];

  for (const eventContext of contexts) {
    try {
      eventContext.remove();
      await eventContext.context.sync();
    } catch {
      // Event handlers can already be detached after Word reloads the task pane.
    }
  }
}

async function registerAnnotationEvents(onSelectDefinition: AnnotationSelectionHandler): Promise<void> {
  await disposeAnnotationEvents();

  await Word.run(async (context) => {
    eventContexts = [
      context.document.onAnnotationClicked.add(async (args) => {
        const definitionId = annotationToDefinitionId.get(args.id);
        if (definitionId) onSelectDefinition(definitionId, annotationToOccurrenceId.get(args.id));
      }),
    ];

    await context.sync();
  });
}

async function deleteAnnotationIds(ids: string[]): Promise<void> {
  const chunkSize = 25;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    try {
      await Word.run(async (context) => {
        chunk.forEach((id) => context.document.getAnnotationById(id).delete());
        await context.sync();
      });
    } catch {
      await deleteAnnotationIdsIndividually(chunk);
    }
  }
}

async function deleteAnnotationIdsIndividually(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await Word.run(async (context) => {
        context.document.getAnnotationById(id).delete();
        await context.sync();
      });
    } catch {
      // The annotation may already have been removed by Word or a previous refresh.
    }
  }
}
