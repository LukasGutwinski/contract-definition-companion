import type { DocumentParagraph } from "./types";

const SAMPLE_PARAGRAPHS = [
  "1. Definitions",
  "\"Accounts\" means the audited financial statements of the Company for the financial year ended 31 December 2025.",
  "\"Affiliate\" means, in relation to any person, any entity directly or indirectly controlling, controlled by or under common control with that person.",
  "\"Business Day\" means a day other than a Saturday, Sunday or public holiday in Vienna, Austria.",
  "2. Sale and Purchase",
  "Completion shall take place on the first Business Day following satisfaction of the Conditions. The Seller shall deliver the Accounts to the Buyer.",
  "3. Definitionen",
  "„Anteile“ bezeichnet sämtliche Geschäftsanteile an der Zielgesellschaft.",
  "„Kaufpreis“ bedeutet den gemäß Punkt 4 zu zahlenden Gesamtkaufpreis für die Anteile.",
  "4. Kaufpreis",
  "Der Kaufpreis ist am Vollzugstag auf das Konto des Verkäufers zu zahlen.",
];

export const sampleContract: DocumentParagraph[] = SAMPLE_PARAGRAPHS.map((text, index) => ({
  id: `sample-${index}`,
  index,
  text,
}));
