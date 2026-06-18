import type { DefinitionEntry, DocumentParagraph, Occurrence } from "../parser/types";

type AnnotationSelectionHandler = (definitionId: string) => void;

let createdAnnotationIds: string[] = [];
let annotationToDefinitionId = new Map<string, string>();
let eventContexts: OfficeExtension.EventHandlerResult<unknown>[] = [];

export async function applyInlineAnnotations(
  paragraphs: DocumentParagraph[],
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
    for (const [paragraphKey, paragraphOccurrences] of grouped) {
      const paragraph = getParagraph(context, paragraphs, paragraphKey, paragraphOccurrences[0].paragraphIndex);
      if (!paragraph) continue;

      const critiques: Word.Critique[] = paragraphOccurrences.slice(0, 40).map((occurrence) => ({
        colorScheme: Word.CritiqueColorScheme.blue,
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
      await context.sync();

      const annotationIds = ids.value ?? [];
      createdAnnotationIds.push(...annotationIds);
      annotationIds.forEach((annotationId, index) => {
        const occurrence = paragraphOccurrences[index];
        if (occurrence) annotationToDefinitionId.set(annotationId, occurrence.definitionId);
      });
    }
  });

  return createdAnnotationIds.length;
}

export async function clearInlineAnnotations(): Promise<void> {
  if (!createdAnnotationIds.length || !window.Word) {
    createdAnnotationIds = [];
    annotationToDefinitionId = new Map();
    return;
  }

  const idsToDelete = [...createdAnnotationIds];
  createdAnnotationIds = [];
  annotationToDefinitionId = new Map();

  await Word.run(async (context) => {
    for (const id of idsToDelete) {
      try {
        context.document.getAnnotationById(id).delete();
      } catch {
        // The annotation can already be gone after a document refresh.
      }
    }
    await context.sync();
  });
}

export async function disposeAnnotationEvents(): Promise<void> {
  if (!eventContexts.length) return;

  const contexts = [...eventContexts];
  eventContexts = [];

  for (const eventContext of contexts) {
    eventContext.remove();
    await eventContext.context.sync();
  }
}

async function registerAnnotationEvents(onSelectDefinition: AnnotationSelectionHandler): Promise<void> {
  await disposeAnnotationEvents();

  await Word.run(async (context) => {
    eventContexts = [
      context.document.onAnnotationClicked.add(async (args) => {
        const definitionId = annotationToDefinitionId.get(args.id);
        if (definitionId) onSelectDefinition(definitionId);
      }),
      context.document.onAnnotationHovered.add(async (args) => {
        const definitionId = annotationToDefinitionId.get(args.id);
        if (definitionId) onSelectDefinition(definitionId);
      }),
    ];

    await context.sync();
  });
}

function getParagraph(
  context: Word.RequestContext,
  paragraphs: DocumentParagraph[],
  paragraphKey: string,
  fallbackIndex: number,
): Word.Paragraph | undefined {
  if (!paragraphKey.startsWith("index:") && "getParagraphByUniqueLocalId" in context.document) {
    return context.document.getParagraphByUniqueLocalId(paragraphKey);
  }

  const paragraph = paragraphs.find((item) => item.index === fallbackIndex);
  if (paragraph?.id && "getParagraphByUniqueLocalId" in context.document) {
    return context.document.getParagraphByUniqueLocalId(paragraph.id);
  }

  return undefined;
}
