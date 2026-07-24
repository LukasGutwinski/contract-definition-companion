import type { DocumentParagraph } from "./types";

const SAMPLE_PARAGRAPHS = [
  "1. Definitions",
  "\"Accounts\" means the audited financial statements of the Company for the financial year ended 31 December 2025.",
  "\"Affiliate\" means, in relation to any person, any entity directly or indirectly controlling, controlled by or under common control with that person.",
  "\"Business Day\" means a day other than a Saturday, Sunday or public holiday in Vienna, Austria.",
  "2. Sale and Purchase",
  "Completion shall take place on the first Business Day following satisfaction of the Conditions. The Seller shall deliver the Accounts to the Buyer.",
  "3. Additional Definitions",
  "\"Shares\" means all shares in the Target Company.",
  "\"Purchase Price\" means the total purchase price payable for the Shares under clause 4.",
  "4. Purchase Price",
  "The Purchase Price shall be paid into the Seller's account on Completion.",
];

export const sampleContract: DocumentParagraph[] = SAMPLE_PARAGRAPHS.map((text, index) => ({
  id: `sample-${index}`,
  index,
  text,
}));
