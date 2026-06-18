import { describe, expect, it } from "vitest";
import { scanDocument } from "../parser/scan";
import type { DocumentParagraph } from "../parser/types";

function paragraphs(lines: string[]): DocumentParagraph[] {
  return lines.map((text, index) => ({
    id: `p-${index}`,
    index,
    text,
  }));
}

describe("contract definition parser", () => {
  it("extracts English quoted definitions and finds later occurrences", () => {
    const result = scanDocument(
      paragraphs([
        "1. Definitions",
        "\"Accounts\" means the audited financial statements of the Company.",
        "\"Business Day\" means a day other than a Saturday or Sunday.",
        "2. Completion",
        "Completion shall occur on the next Business Day after the Accounts are delivered.",
      ]),
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual([
      "Accounts",
      "Business Day",
    ]);
    expect(result.occurrences.map((occurrence) => occurrence.term)).toEqual([
      "Business Day",
      "Accounts",
    ]);
  });

  it("extracts German guillemet-style definitions", () => {
    const result = scanDocument(
      paragraphs([
        "1. Definitionen",
        "„Anteile“ bezeichnet sämtliche Geschäftsanteile an der Zielgesellschaft.",
        "„Kaufpreis“ bedeutet den gemäß Punkt 4 zu zahlenden Gesamtkaufpreis.",
        "2. Vollzug",
        "Der Kaufpreis ist für die Anteile zu zahlen.",
      ]),
      { language: "de" },
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual([
      "Anteile",
      "Kaufpreis",
    ]);
    expect(result.occurrences.map((occurrence) => occurrence.term)).toEqual([
      "Kaufpreis",
      "Anteile",
    ]);
  });

  it("supports tab-separated definition tables", () => {
    const result = scanDocument(
      paragraphs([
        "Definitions",
        "Seller\tmeans the person selling the shares under this Agreement.",
        "Buyer\tmeans the person buying the shares under this Agreement.",
        "The Buyer shall pay the Seller.",
      ]),
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual(["Buyer", "Seller"]);
    expect(result.definitions.every((definition) => definition.source === "table")).toBe(true);
  });
});
