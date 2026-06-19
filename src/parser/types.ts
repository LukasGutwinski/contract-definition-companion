export type ContractLanguage = "auto" | "de" | "en";

export interface DocumentParagraph {
  id: string;
  index: number;
  text: string;
}

export interface DefinitionEntry {
  id: string;
  term: string;
  normalizedTerm: string;
  definition: string;
  language: "de" | "en" | "unknown";
  source: "quoted" | "unquoted" | "table" | "manual";
  confidence: number;
  paragraphId?: string;
  paragraphIndex?: number;
  lineIndex: number;
}

export interface Occurrence {
  id: string;
  definitionId: string;
  term: string;
  paragraphId: string;
  paragraphIndex: number;
  start: number;
  length: number;
  context: string;
  contextBefore?: string;
  contextHit?: string;
  contextAfter?: string;
}

export interface ScanStats {
  scannedParagraphs: number;
  definitionsFound: number;
  occurrencesFound: number;
  language: ContractLanguage;
}

export interface ScanResult {
  definitions: DefinitionEntry[];
  occurrences: Occurrence[];
  stats: ScanStats;
  warnings: string[];
}

export interface ScanOptions {
  language: ContractLanguage;
  maxOccurrences: number;
}
