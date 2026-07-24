import type { DefinitionEntry, DocumentParagraph, ContractLanguage } from "./types";
import { cleanDefinition, cleanTerm, normalizeTerm, normalizeWhitespace } from "./normalize";

interface Candidate {
  term: string;
  definition: string;
  language: DefinitionEntry["language"];
  source: DefinitionEntry["source"];
  confidence: number;
}

const DEFINITION_SECTION_PATTERNS = [
  /\bdefinitions?\b/i,
  /\bdefined terms?\b/i,
  /\binterpretation\b/i,
  /\bdefinitionen\b/i,
  /\bbegriffsbestimmungen\b/i,
  /\bauslegung\b/i,
  /\bdefinierte begriffe\b/i,
];

const EN_VERBS = [
  "means",
  "mean",
  "shall mean",
  "means and includes",
  "has the meaning",
  "has the meaning given",
  "is defined as",
  "refers to",
];

const DE_VERBS = [
  "bedeutet",
  "bezeichnen",
  "bezeichnet",
  "meint",
  "meinen",
  "hat die bedeutung",
  "hat die in",
  "ist definiert als",
  "steht fuer",
  "steht für",
];

const QUOTED_TERM = `[“"„']([^“”"„'‘’]{2,120})[”"“']`;
const TERM_BODY = `([A-ZÄÖÜ][\\p{L}\\p{N}/&.,() \\-]{1,120})`;
const EN_ALIAS_INTRO = `(?:the|this|that|an?|each(?:\\s+an?)?|collectively,?\\s+the|together,?\\s+the)`;
const EN_VERB_PATTERN = createAlternation(EN_VERBS);
const DE_VERB_PATTERN = createAlternation(DE_VERBS);
const EN_PARENTHETICAL_ALIAS_PATTERN = new RegExp(
  `\\(\\s*(?:${EN_ALIAS_INTRO}\\s+)?${QUOTED_TERM}\\s*\\)`,
  "iu",
);

const START_PATTERNS: Array<{
  pattern: RegExp;
  language: DefinitionEntry["language"];
  source: DefinitionEntry["source"];
  confidence: number;
}> = [
  {
    pattern: new RegExp(`^${QUOTED_TERM}\\s+${EN_VERB_PATTERN}\\b[\\s,:-]*(.*)$`, "iu"),
    language: "en",
    source: "quoted",
    confidence: 0.98,
  },
  {
    pattern: new RegExp(`^${QUOTED_TERM}\\s+${DE_VERB_PATTERN}\\b[\\s,:-]*(.*)$`, "iu"),
    language: "de",
    source: "quoted",
    confidence: 0.98,
  },
  {
    pattern: new RegExp(`^${TERM_BODY}\\s+${EN_VERB_PATTERN}\\b[\\s,:-]*(.*)$`, "iu"),
    language: "en",
    source: "unquoted",
    confidence: 0.78,
  },
  {
    pattern: new RegExp(`^${TERM_BODY}\\s+${DE_VERB_PATTERN}\\b[\\s,:-]*(.*)$`, "iu"),
    language: "de",
    source: "unquoted",
    confidence: 0.78,
  },
];

export function detectDefinitions(
  paragraphs: DocumentParagraph[],
  language: ContractLanguage,
): DefinitionEntry[] {
  const lines = paragraphs
    .map((paragraph, lineIndex) => ({
      ...paragraph,
      lineIndex,
      text: paragraph.text.replace(/[ \r\n]+/g, " ").trim(),
    }))
    .filter((line) => line.text.length > 0);

  const bounds = detectDefinitionBounds(lines.map((line) => line.text));
  const parseLines = bounds.flatMap((bound) => lines.slice(bound.start, bound.end));
  const definitions: DefinitionEntry[] = [];

  let active:
    | {
        candidate: Candidate;
        paragraphId?: string;
        paragraphIndex?: number;
        paragraphIndexes: number[];
        lineIndex: number;
        chunks: string[];
      }
    | undefined;

  const flush = () => {
    if (!active) return;

    const term = cleanTerm(active.candidate.term);
    const definition = cleanDefinition(active.chunks.join(" "));
    if (isPlausibleTerm(term) && definition.length >= 3) {
      definitions.push({
        id: createDefinitionId(term, active.lineIndex, definitions.length),
        term,
        normalizedTerm: normalizeTerm(term),
        definition,
        language: active.candidate.language,
        source: active.candidate.source,
        confidence: active.candidate.confidence,
        paragraphId: active.paragraphId,
        paragraphIndex: active.paragraphIndex,
        definitionParagraphIndexes: active.paragraphIndexes,
        lineIndex: active.lineIndex,
      });
    }
    active = undefined;
  };

  for (const line of parseLines) {
    const tableCandidate = matchTableDefinition(line.text, language);
    if (tableCandidate) {
      flush();
      active = {
        candidate: tableCandidate,
        paragraphId: line.id,
        paragraphIndex: line.index,
        paragraphIndexes: [line.index],
        lineIndex: line.lineIndex,
        chunks: [tableCandidate.definition],
      };
      continue;
    }

    const candidate = matchDefinitionStart(line.text, language);

    if (candidate) {
      flush();
      active = {
        candidate,
        paragraphId: line.id,
        paragraphIndex: line.index,
        paragraphIndexes: [line.index],
        lineIndex: line.lineIndex,
        chunks: [candidate.definition],
      };
      continue;
    }

    if (active && shouldContinueDefinition(active.chunks, line.text)) {
      active.chunks.push(line.text);
      active.paragraphIndexes.push(line.index);
    } else {
      flush();
    }
  }

  flush();
  return dedupeDefinitions(definitions);
}

function detectDefinitionBounds(lines: string[]): Array<{ start: number; end: number }> {
  const starts = lines
    .map((line, index) => ({
      index,
      isDefinitionHeading: DEFINITION_SECTION_PATTERNS.some((pattern) => pattern.test(line)),
    }))
    .filter((entry) => entry.isDefinitionHeading)
    .map((entry) => entry.index);

  if (!starts.length) {
    return [{ start: 0, end: Math.min(lines.length, 350) }];
  }

  return starts.map((start, startIndex) => {
    const nextDefinitionStart = starts[startIndex + 1] ?? lines.length;
    const nextMajorHeading = lines.findIndex((line, index) => {
      if (index <= start + 3) return false;
      if (index >= nextDefinitionStart) return false;
      if (!isMajorHeading(line)) return false;
      return !DEFINITION_SECTION_PATTERNS.some((pattern) => pattern.test(line));
    });

    const end = nextMajorHeading > start ? nextMajorHeading : Math.min(lines.length, start + 450);
    return { start, end };
  });
}

function matchDefinitionStart(text: string, language: ContractLanguage): Candidate | undefined {
  const stripped = stripListPrefix(text);
  for (const config of START_PATTERNS) {
    if (language !== "auto" && config.language !== language) continue;
    const match = stripped.match(config.pattern);
    if (!match) continue;

    return {
      term: match[1],
      definition: match[2],
      language: config.language,
      source: config.source,
      confidence: config.confidence,
    };
  }

  return matchEnglishParentheticalAlias(stripped, language);
}

function matchEnglishParentheticalAlias(text: string, language: ContractLanguage): Candidate | undefined {
  if (language !== "auto" && language !== "en") return undefined;

  const match = text.match(EN_PARENTHETICAL_ALIAS_PATTERN);
  if (!match || match.index === undefined) return undefined;

  const term = cleanTerm(match[1]);
  if (!isPlausibleTerm(term)) return undefined;

  const definition = cleanDefinition(
    normalizeWhitespace(`${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`)
      .replace(/\s+([,.;:])/g, "$1"),
  );
  if (definition.length < 5) return undefined;

  return {
    term,
    definition,
    language: "en",
    source: "quoted",
    confidence: 0.72,
  };
}

function matchTableDefinition(text: string, language: ContractLanguage): Candidate | undefined {
  if (!text.includes("\t")) return undefined;

  const [rawTerm, ...definitionParts] = text.split("\t").map(normalizeWhitespace);
  const definition = definitionParts.join(" ");
  const term = cleanTerm(rawTerm);
  if (!isPlausibleTerm(term) || definition.length < 10) return undefined;

  const lowerDefinition = definition.toLocaleLowerCase();
  const detectedLanguage =
    DE_VERBS.some((verb) => lowerDefinition.startsWith(verb)) ||
    /\b(bedeutet|bezeichnet|meint)\b/i.test(definition)
      ? "de"
      : "en";

  if (language !== "auto" && language !== detectedLanguage) return undefined;

  return {
    term,
    definition,
    language: detectedLanguage,
    source: "table",
    confidence: 0.86,
  };
}

function shouldContinueDefinition(currentChunks: string[], nextText: string): boolean {
  if (!nextText || nextText.length <= 2) return false;
  if (isMajorHeading(nextText)) return false;
  if (/^(whereas|recitals|schedule|annex|anlage|präambel)\b/i.test(nextText)) return false;

  const currentText = normalizeWhitespace(currentChunks.join(" "));
  if (!currentText) return true;
  if (/[,:(\[{/–—-]\s*$/.test(currentText)) return true;

  return /\b(?:and|or|including|excluding|include|includes|of|in|to|for|from|under|with|without|by|as)\s*$/i.test(
    currentText,
  );
}

function stripListPrefix(text: string): string {
  return text
    .replace(/^\s*(?:\(?[a-z]\)|\(?\d+(?:\.\d+)*\)?|[ivxlcdm]+\.)\s+/i, "")
    .trim();
}

function isMajorHeading(text: string): boolean {
  const value = normalizeWhitespace(text);
  if (value.length > 90) return false;
  if (/^(?:\d+\.|[A-Z]\.|ARTICLE\s+\d+|CLAUSE\s+\d+|§\s*\d+)/i.test(value)) return true;
  if (/^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9\s/&()-]{4,}$/.test(value) && value.length < 70) return true;
  return false;
}

function isPlausibleTerm(term: string): boolean {
  if (term.length < 2 || term.length > 120) return false;
  if (/^(and|or|the|a|an|und|oder|der|die|das)$/i.test(term)) return false;
  if (term.split(/\s+/).length > 10) return false;
  return /[\p{L}\p{N}]/u.test(term);
}

function dedupeDefinitions(definitions: DefinitionEntry[]): DefinitionEntry[] {
  const seen = new Map<string, DefinitionEntry>();

  for (const definition of definitions) {
    const existing = seen.get(definition.normalizedTerm);
    if (!existing) {
      seen.set(definition.normalizedTerm, definition);
      continue;
    }

    const preferred =
      existing.confidence < definition.confidence ? definition : existing;
    seen.set(definition.normalizedTerm, {
      ...preferred,
      definitionParagraphIndexes: [
        ...new Set([
          ...existing.definitionParagraphIndexes,
          ...definition.definitionParagraphIndexes,
        ]),
      ].sort((a, b) => a - b),
    });
  }

  return [...seen.values()].sort((a, b) => a.term.localeCompare(b.term));
}

function createDefinitionId(term: string, lineIndex: number, offset: number): string {
  const slug = normalizeTerm(term).replace(/[^a-z0-9äöüß]+/gi, "-").replace(/^-|-$/g, "");
  return `${slug || "term"}-${lineIndex}-${offset}`;
}

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

function createAlternation(values: string[]): string {
  return `(?:${[...values].sort((a, b) => b.length - a.length).map(escapeForPattern).join("|")})`;
}
