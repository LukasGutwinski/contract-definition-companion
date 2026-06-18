import type { DocumentParagraph } from "../parser/types";
import { sampleContract } from "../parser/sampleContract";

export interface OfficeEnvironment {
  available: boolean;
  reason?: string;
}

export async function waitForOffice(): Promise<OfficeEnvironment> {
  if (!("Office" in window) || !window.Office?.onReady) {
    return { available: false, reason: "Office.js ist nicht verfügbar. Demo-Modus aktiv." };
  }

  try {
    const info = await Office.onReady();
    if (info.host !== Office.HostType.Word) {
      return { available: false, reason: "Nicht in Word geöffnet. Demo-Modus aktiv." };
    }
    return { available: true };
  } catch {
    return { available: false, reason: "Office konnte nicht initialisiert werden. Demo-Modus aktiv." };
  }
}

export function supportsAnnotations(): boolean {
  return Boolean(
    window.Office?.context?.requirements?.isSetSupported?.("WordApi", "1.8") &&
      "Word" in window &&
      window.Word,
  );
}

export async function getDocumentKey(): Promise<string> {
  if (!isWordAvailable()) return "demo-document";

  const url = Office.context.document.url || "unsaved-document";
  return `word:${hashString(url)}`;
}

export async function readDocumentParagraphs(): Promise<DocumentParagraph[]> {
  if (!isWordAvailable()) return sampleContract;

  return Word.run(async (context) => {
    const paragraphs = context.document.body.paragraphs;
    paragraphs.load("items/text,items/uniqueLocalId");
    await context.sync();

    return paragraphs.items.map((paragraph, index) => ({
      id: getParagraphId(paragraph, index),
      index,
      text: paragraph.text ?? "",
    }));
  });
}

export async function getSelectionText(): Promise<string> {
  if (!isWordAvailable()) return "";

  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load("text");
    await context.sync();
    return selection.text ?? "";
  });
}

export function onSelectionChanged(handler: (selectedText: string) => void): () => void {
  if (!window.Office?.context?.document?.addHandlerAsync) return () => undefined;

  const callback = async () => {
    try {
      handler(await getSelectionText());
    } catch {
      handler("");
    }
  };

  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    callback,
  );

  return () => {
    Office.context.document.removeHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      { handler: callback },
    );
  };
}

export async function selectParagraph(paragraphId: string | undefined, paragraphIndex: number | undefined): Promise<void> {
  if (!isWordAvailable()) return;

  await Word.run(async (context) => {
    let range: Word.Range | undefined;

    if (paragraphId && "getParagraphByUniqueLocalId" in context.document) {
      const paragraph = context.document.getParagraphByUniqueLocalId(paragraphId);
      range = paragraph.getRange();
    } else if (typeof paragraphIndex === "number") {
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items");
      await context.sync();
      range = paragraphs.items[paragraphIndex]?.getRange();
    }

    if (range) {
      range.select(Word.SelectionMode.select);
      await context.sync();
    }
  });
}

export function isWordAvailable(): boolean {
  return Boolean(window.Office?.context?.document && "Word" in window && window.Word);
}

function getParagraphId(paragraph: Word.Paragraph, index: number): string {
  const localId = (paragraph as Word.Paragraph & { uniqueLocalId?: string }).uniqueLocalId;
  return localId || `paragraph-${index}`;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
