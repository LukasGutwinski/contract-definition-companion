import type { DefinitionEntry, DocumentParagraph, ContractLanguage } from "./types";
import { cleanDefinition, cleanTerm, normalizeTerm, normalizeWhitespace } from "./normalize";

interface Candidate {
  term: string;
  definition: string;
  language: DefinitionEntry["language"];
  source: DefinitionEntry["source"];
  confidence: number;
  continueAcrossParagraphs: boolean;
  definitionParagraphIndexes?: number[];
}

interface QuotedToken {
  term: string;
  start: number;
  end: number;
}

interface QuotedDefinitionStart {
  sequence: {
    tokens: QuotedToken[];
    end: number;
  };
  clauseStart: number;
  operatorEnd: number;
  qualifier: string;
}

interface HeadingInfo {
  level: number;
  title: string;
}

const EN_VERBS = [
  "shall have the meaning as defined in",
  "shall have the meaning as set forth",
  "shall have the meaning assigned to it",
  "shall have the meaning ascribed to it",
  "shall have the meaning specified",
  "shall have the meaning set forth",
  "shall have the meaning set out",
  "shall have the meaning provided",
  "shall have the meaning given",
  "shall have the meaning",
  "has the meaning assigned to it",
  "has the meaning ascribed to it",
  "has the meaning as defined in",
  "has the meaning as set forth",
  "has the meaning specified",
  "has the meaning set forth",
  "has the meaning set out",
  "has the meaning provided",
  "has the meaning given",
  "has the meaning",
  "shall be deemed to mean",
  "means and includes",
  "shall mean",
  "is given the meaning",
  "is defined elsewhere in",
  "is defined under",
  "is defined in",
  "is defined as",
  "bears the meaning",
  "does not include",
  "refers to",
  "includes",
  "excludes",
  "means",
  "mean",
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

const LEGACY_QUOTED_TERM = `[“"„']([^“”"„'‘’]{2,120})[”"“']`;
const TERM_BODY = `([A-ZÄÖÜ][\\p{L}\\p{N}/&.,() \\-]{1,120})`;
const EN_VERB_PATTERN = createAlternation(EN_VERBS);
const DE_VERB_PATTERN = createAlternation(DE_VERBS);
const EN_OPERATOR_SEARCH_PATTERN = new RegExp(`\\b${EN_VERB_PATTERN}\\b`, "iu");

const START_PATTERNS: Array<{
  pattern: RegExp;
  language: DefinitionEntry["language"];
  source: DefinitionEntry["source"];
  confidence: number;
}> = [
  {
    pattern: new RegExp(`^${LEGACY_QUOTED_TERM}\\s+${DE_VERB_PATTERN}\\b[\\s,:-]*(.+)$`, "iu"),
    language: "de",
    source: "quoted",
    confidence: 0.98,
  },
  {
    pattern: new RegExp(`^${TERM_BODY}\\s+${EN_VERB_PATTERN}\\b[\\s,:-]*(.+)$`, "iu"),
    language: "en",
    source: "unquoted",
    confidence: 0.78,
  },
  {
    pattern: new RegExp(`^${TERM_BODY}\\s+${DE_VERB_PATTERN}\\b[\\s,:-]*(.+)$`, "iu"),
    language: "de",
    source: "unquoted",
    confidence: 0.78,
  },
];

const QUOTE_PAIRS: Record<string, string[]> = {
  '"': ['"'],
  "“": ["”"],
  "„": ["“", "”"],
  "‘": ["’"],
  "'": ["'"],
  "«": ["»"],
};

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

  const lineTexts = lines.map((line) => line.text);
  const definitionSectionPositions = detectDefinitionSectionPositions(lines);
  const implicitGlossaryPositions = detectImplicitGlossaryPositions(
    lineTexts,
    definitionSectionPositions,
  );
  const definitions: DefinitionEntry[] = [];

  let active:
    | {
        candidates: Candidate[];
        paragraphId?: string;
        paragraphIndex?: number;
        lineIndex: number;
        chunks: string[];
        definitionParagraphIndexes: number[];
        continueAcrossParagraphs: boolean;
      }
    | undefined;

  const flush = () => {
    if (!active) return;

    for (const candidate of active.candidates) {
      const term = cleanTerm(candidate.term);
      const definition = cleanDefinition(
        [candidate.definition, ...active.chunks].filter(Boolean).join(" "),
      );

      if (!isPlausibleTerm(term) || definition.length < 3) continue;

      definitions.push({
        id: createDefinitionId(term, active.lineIndex, definitions.length),
        term,
        normalizedTerm: normalizeTerm(term),
        definition,
        language: candidate.language,
        source: candidate.source,
        confidence: candidate.confidence,
        paragraphId: active.paragraphId,
        paragraphIndex: active.paragraphIndex,
        definitionParagraphIndexes: candidate.definitionParagraphIndexes
          ? [
              ...new Set([
                ...candidate.definitionParagraphIndexes,
                ...active.definitionParagraphIndexes,
              ]),
            ].sort((a, b) => a - b)
          : active.definitionParagraphIndexes,
        lineIndex: active.lineIndex,
      });
    }

    active = undefined;
  };

  for (let position = 0; position < lines.length; position += 1) {
    const line = lines[position];
    const inDefinitionSection = definitionSectionPositions.has(position);
    const candidates = matchDefinitionStarts(line.text, language, {
      inDefinitionSection,
      allowImplicitGlossary: implicitGlossaryPositions.has(position),
      previousParagraphs: lines
        .slice(Math.max(0, position - 2), position)
        .map((previousLine) => ({
          index: previousLine.index,
          text: previousLine.text,
        })),
    });

    if (candidates.length) {
      flush();
      active = {
        candidates,
        paragraphId: line.id,
        paragraphIndex: line.index,
        lineIndex: line.lineIndex,
        chunks: [],
        definitionParagraphIndexes: [line.index],
        continueAcrossParagraphs:
          inDefinitionSection && candidates.every((candidate) => candidate.continueAcrossParagraphs),
      };

      if (!active.continueAcrossParagraphs) flush();
      continue;
    }

    if (
      active &&
      active.continueAcrossParagraphs &&
      inDefinitionSection &&
      !startsWithQuotedTerm(line.text) &&
      shouldContinueDefinition(
        [active.candidates[0]?.definition ?? "", ...active.chunks],
        line.text,
        line.outlineLevel,
        line.style,
      )
    ) {
      active.chunks.push(line.text);
      active.definitionParagraphIndexes.push(line.index);
    } else {
      flush();
    }
  }

  flush();
  return dedupeDefinitions(definitions);
}

function matchDefinitionStarts(
  text: string,
  language: ContractLanguage,
  context: {
    inDefinitionSection: boolean;
    allowImplicitGlossary: boolean;
    previousParagraphs: Array<{
      index: number;
      text: string;
    }>;
  },
): Candidate[] {
  if (!context.inDefinitionSection) return [];

  const tableCandidate = matchTableDefinition(
    text,
    language,
    context.inDefinitionSection,
  );
  if (tableCandidate) return [tableCandidate];

  const stripped = stripListPrefix(text);
  const quotedCandidates =
    language === "auto" || language === "en"
      ? mergeCandidates([
          ...matchEnglishQuotedDefinitions(stripped),
          ...matchEnglishLeadingSectionDefinition(stripped),
        ])
      : [];

  for (const config of START_PATTERNS) {
    if (language !== "auto" && config.language !== language) continue;
    const match = stripped.match(config.pattern);
    if (!match) continue;

    const term = cleanTerm(match[1]);
    if (!isPlausibleTerm(term)) continue;
    if (
      config.source === "unquoted" &&
      (!isPlausibleUnquotedTerm(term) || /\bmeans\s+to\b/i.test(stripped))
    ) {
      continue;
    }

    return mergeCandidates([
      ...quotedCandidates,
      {
        term,
        definition: match[2],
        language: config.language,
        source: config.source,
        confidence: config.confidence,
        continueAcrossParagraphs: true,
      },
    ]);
  }

  const implicitCandidates =
    context.allowImplicitGlossary &&
    (language === "auto" || language === "en")
      ? matchEnglishImplicitGlossaryDefinition(stripped)
      : [];

  const quotedAndImplicitCandidates = mergeCandidates([
    ...implicitCandidates,
    ...quotedCandidates,
  ]);
  if (quotedAndImplicitCandidates.length) return quotedAndImplicitCandidates;

  return matchEnglishParentheticalAliases(
    stripped,
    language,
    context.previousParagraphs,
  );
}

function matchEnglishLeadingSectionDefinition(text: string): Candidate[] {
  const firstToken = readQuotedToken(text, 0);
  if (!firstToken || firstToken.start !== 0) return [];

  const sequence = readQuotedSequence(text, 0, true);
  if (!sequence) return [];

  const remainder = text.slice(sequence.end);
  const operatorMatch = remainder.match(EN_OPERATOR_SEARCH_PATTERN);
  if (!operatorMatch || operatorMatch.index === undefined) return [];

  const qualifier = cleanQualifier(remainder.slice(0, operatorMatch.index));
  if (!isAllowedSectionQualifier(qualifier)) return [];

  const definitionBody = cleanDefinition(
    remainder.slice(operatorMatch.index + operatorMatch[0].length),
  );
  if (definitionBody.length > 0 && definitionBody.length < 3) return [];

  const definition =
    qualifier && definitionBody
      ? normalizeWhitespace(`${qualifier}, ${definitionBody}`).replace(
          /\s+([,.;:])/g,
          "$1",
        )
      : qualifier || definitionBody;

  return sequence.tokens
    .map((token) => cleanTerm(token.term))
    .filter(isPlausibleTerm)
    .map((term) => ({
      term,
      definition,
      language: "en",
      source: "quoted",
      confidence: 0.98,
      continueAcrossParagraphs: true,
    }));
}

function matchEnglishQuotedDefinitions(text: string): Candidate[] {
  const stripped = stripListPrefix(text);
  const tokens = findAllQuotedTokens(stripped);
  const starts: QuotedDefinitionStart[] = [];
  let consumedUntil = 0;

  for (const token of tokens) {
    if (token.start < consumedUntil) continue;

    const sequence = readQuotedSequence(stripped, token.start, true);
    if (!sequence) continue;
    consumedUntil = sequence.end;

    const clauseStart = findClauseStart(stripped, token.start);
    const prefix = stripped.slice(clauseStart, token.start);
    if (!isAllowedDefinitionPrefix(prefix)) continue;

    const nextToken = tokens.find((candidate) => candidate.start >= sequence.end);
    const operatorScope = stripped.slice(
      sequence.end,
      nextToken?.start ?? stripped.length,
    );
    const operatorMatch = operatorScope.match(EN_OPERATOR_SEARCH_PATTERN);
    if (!operatorMatch || operatorMatch.index === undefined) continue;

    const qualifier = cleanQualifier(
      operatorScope.slice(0, operatorMatch.index),
    );
    if (!isAllowedQualifier(qualifier)) continue;

    starts.push({
      sequence,
      clauseStart,
      operatorEnd:
        sequence.end + operatorMatch.index + operatorMatch[0].length,
      qualifier,
    });
  }

  return starts.flatMap((start, index) => {
    const definitionEnd = starts[index + 1]?.clauseStart ?? stripped.length;
    const definitionBody = cleanDefinition(
      stripped.slice(start.operatorEnd, definitionEnd),
    );
    if (definitionBody.length > 0 && definitionBody.length < 3) return [];

    const definition =
      start.qualifier && definitionBody
        ? normalizeWhitespace(`${start.qualifier}, ${definitionBody}`).replace(
            /\s+([,.;:])/g,
            "$1",
          )
        : start.qualifier || definitionBody;

    return start.sequence.tokens
      .map((sequenceToken) => cleanTerm(sequenceToken.term))
      .filter(isPlausibleTerm)
      .map((term) => ({
        term,
        definition,
        language: "en" as const,
        source: "quoted" as const,
        confidence: 0.98,
        continueAcrossParagraphs: true,
      }));
  });
}

function matchEnglishImplicitGlossaryDefinition(text: string): Candidate[] {
  const firstToken = readQuotedToken(text, 0);
  if (!firstToken || firstToken.start !== 0) return [];

  const sequence = readQuotedSequence(text, 0);
  if (!sequence) return [];

  const definition = cleanDefinition(text.slice(sequence.end));
  if (definition.length < 5) return [];

  return sequence.tokens
    .map((token) => cleanTerm(token.term))
    .filter(isPlausibleTerm)
    .map((term) => ({
      term,
      definition,
      language: "en",
      source: "quoted",
      confidence: 0.9,
      continueAcrossParagraphs: true,
    }));
}

function matchEnglishParentheticalAliases(
  text: string,
  language: ContractLanguage,
  previousParagraphs: Array<{
    index: number;
    text: string;
  }>,
): Candidate[] {
  if (language !== "auto" && language !== "en") return [];

  const candidates: Candidate[] = [];
  for (const token of findAllQuotedTokens(text)) {
    const openParenthesis = text.lastIndexOf("(", token.start);
    if (openParenthesis < 0) continue;

    const closeParenthesis = text.indexOf(")", token.end);
    if (closeParenthesis < 0) continue;
    if (text.slice(token.end, closeParenthesis).trim()) continue;

    const intro = normalizeWhitespace(text.slice(openParenthesis + 1, token.start));
    if (
      intro &&
      !/^(?:the|this|that|an?|each(?:\s+an?)?|collectively,?(?:\s+the)?|together,?(?:\s+the)?)$/i.test(
        intro,
      )
    ) {
      continue;
    }

    const term = cleanTerm(token.term);
    if (!isPlausibleTerm(term)) continue;

    let definition = cleanDefinition(
      normalizeWhitespace(
        `${text.slice(0, openParenthesis)} ${text.slice(closeParenthesis + 1)}`,
      ).replace(/\s+([,.;:])/g, "$1"),
    );
    let definitionParagraphIndexes: number[] | undefined;

    if (
      definition.length < 5 &&
      /^(?:collectively|together),?(?:\s+the)?$/i.test(intro) &&
      previousParagraphs.length > 0
    ) {
      definition = cleanDefinition(
        previousParagraphs.map((paragraph) => paragraph.text).join(" "),
      );
      definitionParagraphIndexes = previousParagraphs.map(
        (paragraph) => paragraph.index,
      );
    }
    if (definition.length < 5) continue;

    candidates.push({
      term,
      definition,
      language: "en",
      source: "quoted",
      confidence: 0.72,
      continueAcrossParagraphs: false,
      definitionParagraphIndexes,
    });
  }

  return candidates;
}

function matchTableDefinition(
  text: string,
  language: ContractLanguage,
  inDefinitionSection: boolean,
): Candidate | undefined {
  if (!inDefinitionSection || !text.includes("\t")) return undefined;

  const [rawTerm, ...definitionParts] = text.split("\t").map(normalizeWhitespace);
  const definition = definitionParts.join(" ");
  const term = cleanTerm(rawTerm);
  if (!isPlausibleTerm(term) || definition.length < 10) return undefined;
  if (/^(?:term|defined terms?|words? or expressions?)$/i.test(term)) return undefined;
  if (
    /^(?:cross[ -]?reference|location|section|clause|article|schedule|annex|appendix|exhibit|recitals?|preamble)\b/i.test(
      definition,
    )
  ) {
    return undefined;
  }

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
    continueAcrossParagraphs: false,
  };
}

function detectDefinitionSectionPositions(
  lines: Array<{
    text: string;
    outlineLevel?: number;
    style?: string;
  }>,
): Set<number> {
  const headings = lines
    .map((line, index) => {
      const heading = getHeadingInfo(
        line.text,
        line.outlineLevel,
        line.style,
      );
      return heading ? { ...heading, index, text: line.text } : undefined;
    })
    .filter((heading): heading is HeadingInfo & { index: number; text: string } => Boolean(heading));

  const definitionHeadings = headings.filter((heading) => isDefinitionHeading(heading.text));
  const positions = new Set<number>();

  for (const startHeading of definitionHeadings) {
    let end = lines.length;

    for (const heading of headings) {
      if (heading.index <= startHeading.index) continue;
      if (heading.level > startHeading.level) continue;
      if (isDefinitionHeading(heading.text)) continue;
      end = heading.index;
      break;
    }

    for (let index = startHeading.index; index < end; index += 1) {
      positions.add(index);
    }
  }

  return positions;
}

function detectImplicitGlossaryPositions(
  lines: string[],
  definitionSectionPositions: Set<number>,
): Set<number> {
  const glossaryShapes = lines.map((line) => isQuotedGlossaryShape(line));
  const positions = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (!definitionSectionPositions.has(index) || !glossaryShapes[index]) continue;

    const nearbyGlossaryEntry = [index - 2, index - 1, index + 1, index + 2].some(
      (nearbyIndex) =>
        nearbyIndex >= 0 &&
        nearbyIndex < lines.length &&
        definitionSectionPositions.has(nearbyIndex) &&
        glossaryShapes[nearbyIndex],
    );

    if (nearbyGlossaryEntry) positions.add(index);
  }

  return positions;
}

function isQuotedGlossaryShape(text: string): boolean {
  const stripped = stripListPrefix(text);
  const firstToken = readQuotedToken(stripped, 0);
  if (!firstToken || firstToken.start !== 0) return false;

  const sequence = readQuotedSequence(stripped, 0);
  if (!sequence) return false;

  return cleanDefinition(stripped.slice(sequence.end)).length >= 3;
}

function isDefinitionHeading(text: string): boolean {
  const value = stripStructuralHeadingPrefix(text)
    .replace(/[\s.:;–—-]+$/g, "")
    .toLocaleLowerCase();

  return (
    /^(?:(?:general|additional|certain|specific)\s+)?definitions?$/.test(value) ||
    /^(?:(?:general|additional|certain|specific|other)\s+)?defined terms?$/.test(value) ||
    /^(?:definitions?|defined terms?)\s+(?:used|applicable)\s+in\s+(?:this|the)\s+(?:agreement|document|instrument)$/.test(
      value,
    ) ||
    /^interpretation$/.test(value) ||
    /^(?:(?:general|additional|certain|specific)\s+)?(?:definitions?|defined terms?)\s*(?:,|;|and|&)\s*(?:(?:other\s+)?terms?|(?:rules?\s+of\s+)?(?:interpretations?|construction))$/.test(
      value,
    ) ||
    /^(?:terms?|interpretations?|construction)\s*(?:,|;|and|&)\s*(?:definitions?|defined terms?)$/.test(
      value,
    ) ||
    /^definitions?\s*,\s*interpretations?\s*(?:,|and|&)\s*construction$/.test(value) ||
    /^(?:definitionen|begriffsbestimmungen|auslegung|definierte begriffe)$/.test(value)
  );
}

function getHeadingInfo(
  text: string,
  outlineLevel?: number,
  style?: string,
): HeadingInfo | undefined {
  const value = normalizeWhitespace(text);
  if (!value || value.length > 90 || findFirstQuotedToken(value)) return undefined;

  const structuralLevel = getStructuralHeadingLevel(outlineLevel, style);
  if (structuralLevel !== undefined && isHeadingTitle(value)) {
    return { level: structuralLevel, title: value };
  }

  const numbered = value.match(
    /^(?:\((\d+(?:\.\d+)*)\)\s*|(\d+(?:\.\d+)*)(?:(?:[.)])\s*|\s+))(.+)$/,
  );
  if (numbered) {
    const number = numbered[1] ?? numbered[2];
    const title = numbered[3];
    if (!isHeadingTitle(title)) return undefined;
    return { level: number.split(".").length, title };
  }

  const named = value.match(
    /^(?:ARTICLE|CLAUSE|SECTION)\s+(?:\d+(?:\.\d+)*|[IVXLCDM]+)(?:\s*[.):–—-])?\s*(.*)$/i,
  );
  if (named) {
    const title = named[1].replace(/[\s.]+$/g, "") || value;
    if (named[1] && !isHeadingTitle(title)) return undefined;
    return { level: 1, title };
  }

  if (isDefinitionHeading(value)) {
    return { level: 1, title: value };
  }

  if (/^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9\s/&(),'’-]{3,}$/.test(value) && value.length < 70) {
    return { level: 1, title: value };
  }

  return undefined;
}

function isHeadingTitle(value: string): boolean {
  const title = normalizeWhitespace(value);
  if (!title || title.length > 80) return false;
  if (title.split(/\s+/).length > 12) return false;
  if (/[.;?!:]$/.test(title)) return false;
  return /^[A-ZÄÖÜ0-9]/.test(title);
}

function shouldContinueDefinition(
  currentChunks: string[],
  nextText: string,
  outlineLevel?: number,
  style?: string,
): boolean {
  if (!nextText || nextText.length <= 2) return false;
  const currentText = normalizeWhitespace(currentChunks.join(" "));
  if (isEnumeratedDefinitionContinuation(currentText, nextText)) return true;
  if (getHeadingInfo(nextText, outlineLevel, style)) return false;
  if (/^(whereas|recitals|schedule|annex|anlage|präambel)\b/i.test(nextText)) return false;

  if (!currentText) return true;
  if (/[,:(\[{/–—-]\s*$/.test(currentText)) return true;

  return /\b(?:and|or|including|excluding|include|includes|of|in|to|for|from|under|with|without|by|as)\s*$/i.test(
    currentText,
  );
}

function startsWithQuotedTerm(text: string): boolean {
  const stripped = stripListPrefix(text);
  const token = readQuotedToken(stripped, 0);
  return Boolean(token && token.start === 0 && isPlausibleTerm(cleanTerm(token.term)));
}

function isAllowedDefinitionPrefix(value: string): boolean {
  const prefix = normalizeWhitespace(value).replace(/[,;:]\s*$/g, "");
  if (!prefix) return true;
  if (prefix.length > 160) return false;

  return (
    /^(?:and|or)$/i.test(prefix) ||
    /^the\s+(?:term|expression)$/i.test(prefix) ||
    /^as\s+used\s+(?:herein|in\s+.+)$/i.test(prefix) ||
    /^for\s+(?:the\s+)?purposes?\s+of\s+.+$/i.test(prefix) ||
    /^in\s+(?:this|the)\s+(?:agreement|document|instrument|clause|section|schedule|exhibit|annex)(?:\s+.+)?$/i.test(
      prefix,
    ) ||
    /^(?:as\s+used\s+(?:herein|in\s+.+)|for\s+(?:the\s+)?purposes?\s+of\s+.+),?\s+the\s+(?:term|expression)$/i.test(
      prefix,
    )
  );
}

function findClauseStart(text: string, beforeIndex: number): number {
  const prefix = text.slice(0, beforeIndex);
  const boundary = Math.max(
    prefix.lastIndexOf("."),
    prefix.lastIndexOf(";"),
    prefix.lastIndexOf("?"),
    prefix.lastIndexOf("!"),
  );
  return boundary + 1;
}

function getStructuralHeadingLevel(
  outlineLevel?: number,
  style?: string,
): number | undefined {
  if (!Number.isFinite(outlineLevel)) return undefined;

  const level = outlineLevel as number;
  if (level >= 0 && level <= 8) return level;

  if (
    level === 9 &&
    /(?:^|\b)(?:heading|überschrift|atc)\s*[-_]?\s*9(?:\b|$)/i.test(style ?? "")
  ) {
    return level;
  }

  return undefined;
}

function cleanQualifier(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^[\s,;:–—-]+/, "")
    .replace(/[\s,;:–—-]+$/, "");
}

function isAllowedQualifier(value: string): boolean {
  if (!value) return true;
  if (value.length > 140) return false;

  return /^(?:as\s+used\s+(?:herein|in\s+.+)|when\s+used\s+.+|of\s+.+|with\s+respect\s+to\s+.+|in\s+relation\s+to\s+.+|for\s+(?:the\s+)?purposes?\s+of\s+.+)$/i.test(
    value,
  );
}

function isAllowedSectionQualifier(value: string): boolean {
  if (isAllowedQualifier(value)) return true;
  if (value.length > 200 || /[.;!?]/.test(value)) return false;

  return /^including\s+(?:the\s+)?(?:phrase|term|expression)\b/i.test(value);
}

function findFirstQuotedToken(text: string): QuotedToken | undefined {
  for (let index = 0; index < text.length; index += 1) {
    if (!(text[index] in QUOTE_PAIRS)) continue;
    const token = readQuotedToken(text, index);
    if (token) return token;
  }
  return undefined;
}

function findAllQuotedTokens(text: string): QuotedToken[] {
  const tokens: QuotedToken[] = [];

  for (let index = 0; index < text.length; index += 1) {
    if (!(text[index] in QUOTE_PAIRS)) continue;
    const token = readQuotedToken(text, index);
    if (!token) continue;
    tokens.push(token);
    index = token.end - 1;
  }

  return tokens;
}

function readQuotedToken(text: string, start: number): QuotedToken | undefined {
  let openIndex = start;
  while (openIndex < text.length && /\s/u.test(text[openIndex])) openIndex += 1;

  const open = text[openIndex];
  const closers = QUOTE_PAIRS[open];
  if (!closers) return undefined;
  if (open === "'" && /[\p{L}\p{N}]/u.test(text[openIndex - 1] ?? "")) return undefined;

  let closeIndex = -1;
  for (const close of closers) {
    const candidateIndex = text.indexOf(close, openIndex + 1);
    if (candidateIndex < 0) continue;
    if (closeIndex < 0 || candidateIndex < closeIndex) closeIndex = candidateIndex;
  }
  if (closeIndex < 0) return undefined;

  const term = text.slice(openIndex + 1, closeIndex);
  if (term.length < 2 || term.length > 120) return undefined;

  return {
    term,
    start: openIndex,
    end: closeIndex + 1,
  };
}

function readQuotedSequence(
  text: string,
  start: number,
  allowCommaSeparators = false,
): { tokens: QuotedToken[]; end: number } | undefined {
  const first = readQuotedToken(text, start);
  if (!first) return undefined;

  const tokens = [first];
  let end = first.end;

  while (tokens.length < 8) {
    const separator = text
      .slice(end)
      .match(
        allowCommaSeparators
          ? /^\s*(?:\/|,(?:\s*(?:and|or))?|or|and)\s*/i
          : /^\s*(?:\/|or|and)\s*/i,
      );
    if (!separator) break;

    const next = readQuotedToken(text, end + separator[0].length);
    if (!next) break;
    tokens.push(next);
    end = next.end;
  }

  return { tokens, end };
}

function stripListPrefix(text: string): string {
  return text
    .replace(
      /^\s*(?:section|clause)\s+\d+(?:\.\d+)*(?:[.)])?\s*(?=[“"„'«])/i,
      "",
    )
    .replace(
      /^\s*(?:\(?[a-z]\)|[a-z][.)]|\(?\d+(?:\.\d+)*(?:[.)])?|[ivxlcdm]+[.)])(?:\s+|(?=[“"„'«]))/i,
      "",
    )
    .trim();
}

function stripStructuralHeadingPrefix(text: string): string {
  return normalizeWhitespace(text)
    .replace(
      /^(?:(?:article|clause|section)\s+(?:\d+(?:\.\d+)*|[ivxlcdm]+)|(?:schedule|annex|appendix|exhibit)\s+[a-z0-9]+(?:[-.][a-z0-9]+)*)(?:\s*[.):–—-])?\s*/i,
      "",
    )
    .replace(
      /^(?:\((?:\d+(?:\.\d+)*|[a-z]|[ivxlcdm]+)\)|(?:\d+(?:\.\d+)*|[ivxlcdm]+)[.)])\s*/i,
      "",
    )
    .replace(/^\d+(?:\.\d+)*\s+(?=\S)/, "")
    .trim();
}

function isEnumeratedDefinitionContinuation(
  currentText: string,
  nextText: string,
): boolean {
  const listWasIntroduced =
    /:\s*$/.test(currentText) ||
    /:\s*(?:\([a-z0-9ivxlcdm]+\)|[a-zivxlcdm][.)])\s*/i.test(currentText);
  if (!listWasIntroduced) return false;

  return /^\s*(?:\([a-z0-9ivxlcdm]+\)|[a-zivxlcdm][.)])(?:\s+|(?=[\p{L}\p{N}“"„'«]))/iu.test(
    nextText,
  );
}

function isPlausibleTerm(term: string): boolean {
  if (term.length < 2 || term.length > 120) return false;
  if (/^(and|or|the|a|an|und|oder|der|die|das)$/i.test(term)) return false;
  if (/^(?:for\s+(?:the\s+)?purposes?\s+of|as\s+used\b|the\s+(?:term|expression)\b)/i.test(term)) {
    return false;
  }
  if (term.split(/\s+/).length > 20) return false;
  return /[\p{L}\p{N}]/u.test(term);
}

function isPlausibleUnquotedTerm(term: string): boolean {
  if (!isPlausibleTerm(term)) return false;
  if (/^(?:the|this|that|these|those)\b/i.test(term)) return false;
  const words = term.split(/\s+/);
  if (words.length > 6) return false;

  return words.every((word) => {
    const value = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    return (
      /^(?:and|or|of|the|in|to|for|from|with|without|by|as)$/i.test(value) ||
      /^[A-ZÄÖÜ0-9]/u.test(value)
    );
  });
}

function mergeCandidates(candidates: Candidate[]): Candidate[] {
  const merged = new Map<string, Candidate>();

  for (const candidate of candidates) {
    const key = normalizeTerm(candidate.term);
    const existing = merged.get(key);
    if (!existing || candidate.confidence > existing.confidence) {
      merged.set(key, candidate);
    }
  }

  return [...merged.values()];
}

function dedupeDefinitions(definitions: DefinitionEntry[]): DefinitionEntry[] {
  const seen = new Map<string, DefinitionEntry>();

  for (const definition of definitions) {
    const existing = seen.get(definition.normalizedTerm);
    if (!existing) {
      seen.set(definition.normalizedTerm, definition);
      continue;
    }

    const preferred = existing.confidence < definition.confidence ? definition : existing;
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
