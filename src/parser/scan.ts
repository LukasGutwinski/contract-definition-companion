import { detectDefinitions } from "./detectDefinitions";
import { findOccurrences } from "./findOccurrences";
import { normalizeTerm } from "./normalize";
import type { ContractLanguage, DefinitionEntry, DocumentParagraph, ScanOptions, ScanResult } from "./types";

export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  language: "auto",
  maxOccurrences: 1200,
};

export function scanDocument(
  paragraphs: DocumentParagraph[],
  options: Partial<ScanOptions> = {},
): ScanResult {
  const mergedOptions = { ...DEFAULT_SCAN_OPTIONS, ...options };
  const definitions = detectDefinitions(paragraphs, mergedOptions.language);
  const { occurrences, truncated } = findOccurrences(
    paragraphs,
    definitions,
    mergedOptions.maxOccurrences,
  );

  const warnings: string[] = [];
  if (definitions.length === 0) {
    warnings.push("Keine Definitionen erkannt. Prüfe, ob der Definitionsabschnitt eine ungewöhnliche Struktur hat.");
  }
  if (truncated) {
    warnings.push(`Vorkommen wurden bei ${mergedOptions.maxOccurrences} Treffern gekappt.`);
  }

  return {
    definitions,
    occurrences,
    stats: {
      scannedParagraphs: paragraphs.length,
      definitionsFound: definitions.length,
      occurrencesFound: occurrences.length,
      language: mergedOptions.language,
    },
    warnings,
  };
}

export function findDefinitionForText(
  text: string,
  definitions: DefinitionEntry[],
): DefinitionEntry | undefined {
  const normalized = normalizeTerm(text);
  if (!normalized) return undefined;

  const exact = definitions.find((definition) => definition.normalizedTerm === normalized);
  if (exact) return exact;

  return [...definitions]
    .sort((a, b) => b.term.length - a.term.length)
    .find((definition) => normalized.includes(definition.normalizedTerm));
}

export type { ContractLanguage, DefinitionEntry, DocumentParagraph, ScanResult };
