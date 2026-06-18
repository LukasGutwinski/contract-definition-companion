import type { DefinitionEntry, DocumentParagraph, Occurrence } from "./types";
import { escapeRegExp, isWordCharacter, normalizeWhitespace } from "./normalize";

export function findOccurrences(
  paragraphs: DocumentParagraph[],
  definitions: DefinitionEntry[],
  maxOccurrences: number,
): { occurrences: Occurrence[]; truncated: boolean } {
  const occurrences: Occurrence[] = [];
  const termsByLength = [...definitions].sort((a, b) => b.term.length - a.term.length);

  for (const paragraph of paragraphs) {
    if (!paragraph.text.trim()) continue;

    const occupied: Array<{ start: number; end: number }> = [];

    for (const definition of termsByLength) {
      if (definition.paragraphIndex === paragraph.index) continue;

      const regex = new RegExp(escapeRegExp(definition.term), "g");
      let match: RegExpExecArray | null;

      while ((match = regex.exec(paragraph.text)) !== null) {
        const start = match.index;
        const end = start + definition.term.length;
        if (!hasWordBoundaries(paragraph.text, start, end)) continue;
        if (overlaps(occupied, start, end)) continue;

        occupied.push({ start, end });
        occurrences.push({
          id: `${definition.id}:${paragraph.index}:${start}`,
          definitionId: definition.id,
          term: definition.term,
          paragraphId: paragraph.id,
          paragraphIndex: paragraph.index,
          start,
          length: definition.term.length,
          context: buildContext(paragraph.text, start, end),
        });

        if (occurrences.length >= maxOccurrences) {
          return { occurrences: sortOccurrences(occurrences), truncated: true };
        }
      }
    }
  }

  return { occurrences: sortOccurrences(occurrences), truncated: false };
}

function hasWordBoundaries(text: string, start: number, end: number): boolean {
  return !isWordCharacter(text[start - 1]) && !isWordCharacter(text[end]);
}

function overlaps(occupied: Array<{ start: number; end: number }>, start: number, end: number): boolean {
  return occupied.some((range) => start < range.end && end > range.start);
}

function buildContext(text: string, start: number, end: number): string {
  const before = text.slice(Math.max(0, start - 65), start);
  const hit = text.slice(start, end);
  const after = text.slice(end, Math.min(text.length, end + 65));
  return normalizeWhitespace(`${before}${hit}${after}`);
}

function sortOccurrences(occurrences: Occurrence[]): Occurrence[] {
  return occurrences.sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.start - b.start);
}
