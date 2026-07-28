const LEADING_QUOTE_CHARS = /^[“”„‟"‘’'`´]+/g;
const TRAILING_QUOTE_CHARS = /[“”„‟"‘’'`´]+$/g;
const TYPOGRAPHIC_APOSTROPHES = /[‘’`´]/g;
const TRAILING_PUNCTUATION = /[\s:;,.()[\]{}]+$/g;
const LEADING_PUNCTUATION = /^[\s:;,.()[\]{}]+/g;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTerm(value: string): string {
  return normalizeWhitespace(value)
    .replace(LEADING_QUOTE_CHARS, "")
    .replace(TRAILING_QUOTE_CHARS, "")
    .replace(LEADING_PUNCTUATION, "")
    .replace(TRAILING_PUNCTUATION, "")
    .replace(TYPOGRAPHIC_APOSTROPHES, "'")
    .toLocaleLowerCase();
}

export function cleanTerm(value: string): string {
  return normalizeWhitespace(value)
    .replace(LEADING_QUOTE_CHARS, "")
    .replace(TRAILING_QUOTE_CHARS, "")
    .replace(LEADING_PUNCTUATION, "")
    .replace(TRAILING_PUNCTUATION, "");
}

export function cleanDefinition(value: string): string {
  return normalizeWhitespace(value).replace(/^[\s,:;=–—-]+/, "").trim();
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isWordCharacter(value: string | undefined): boolean {
  return Boolean(value && /[\p{L}\p{N}_]/u.test(value));
}
