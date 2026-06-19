import type { DefinitionEntry } from "./types";

type DefinitionTerm = Pick<DefinitionEntry, "term" | "language">;

export function getTermSearchVariants(definition: DefinitionTerm): string[] {
  const term = definition.term.trim();
  if (!term) return [];

  const variants = new Set<string>([term]);

  if (definition.language === "en") {
    const plural = pluralizeFinalWord(term);
    if (plural) variants.add(plural);

    for (const variant of [...variants]) {
      for (const possessive of possessiveForms(variant)) {
        variants.add(possessive);
      }
    }
  }

  return [...variants].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

export function getLongestTermVariantLength(definition: DefinitionTerm): number {
  return getTermSearchVariants(definition).reduce(
    (longest, variant) => Math.max(longest, variant.length),
    0,
  );
}

function pluralizeFinalWord(term: string): string | undefined {
  const match = term.match(/^(.*?)([\p{L}\p{N}]+)$/u);
  if (!match) return undefined;

  const [, prefix, finalWord] = match;
  const plural = pluralizeEnglishWord(finalWord);
  if (!plural || plural === finalWord) return undefined;

  return `${prefix}${plural}`;
}

function pluralizeEnglishWord(word: string): string | undefined {
  if (word.length < 2) return undefined;
  if (/^[A-Z0-9]+$/.test(word)) return `${word}s`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

function possessiveForms(term: string): string[] {
  if (/[sS]$/.test(term)) return [`${term}'`, `${term}’`];
  return [`${term}'s`, `${term}’s`];
}
