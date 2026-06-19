import { describe, expect, it } from "vitest";
import { findDefinitionForText, scanDocument } from "../parser/scan";
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

  it("extracts English parenthetical aliases", () => {
    const result = scanDocument(
      paragraphs([
        "Acme Ltd, a company incorporated in England (the \"Seller\").",
        "Buyer Ltd, a company incorporated in Austria (the \"Buyer\").",
        "The Buyer shall pay the Seller on Completion.",
      ]),
      { language: "en" },
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual(["Buyer", "Seller"]);
    expect(result.occurrences.map((occurrence) => occurrence.term)).toEqual(["Buyer", "Seller"]);
  });

  it("keeps occurrence context tied to the exact matched text", () => {
    const result = scanDocument(
      paragraphs([
        "Definitions",
        "\"Agreement\" means this agreement between the parties.",
        "This agreement is not counted, but this Agreement is counted.",
      ]),
    );

    expect(result.occurrences).toHaveLength(1);
    expect(result.occurrences[0]).toMatchObject({
      term: "Agreement",
      start: 40,
      contextHit: "Agreement",
    });
    expect(result.occurrences[0].context).toContain("this Agreement is counted");
  });

  it("finds English plural and possessive variants without matching lowercase prose", () => {
    const result = scanDocument(
      paragraphs([
        "Definitions",
        "\"Business Day\" means a day other than a Saturday or Sunday.",
        "\"Company\" means Example Ltd.",
        "Completion may occur over two Business Days.",
        "The Company's obligations bind any Companies in its group.",
        "A business day without capitals is descriptive.",
      ]),
      { language: "en" },
    );

    expect(result.occurrences.map((occurrence) => occurrence.contextHit)).toEqual([
      "Business Days",
      "Company's",
      "Companies",
    ]);
    expect(result.occurrences.map((occurrence) => occurrence.length)).toEqual([
      "Business Days".length,
      "Company's".length,
      "Companies".length,
    ]);
  });

  it("resolves selected English variants back to the base definition", () => {
    const result = scanDocument(
      paragraphs([
        "Definitions",
        "\"Business Day\" means a day other than a Saturday or Sunday.",
        "\"Company\" means Example Ltd.",
      ]),
      { language: "en" },
    );

    expect(findDefinitionForText("Business Days", result.definitions)?.term).toBe("Business Day");
    expect(findDefinitionForText("Companies", result.definitions)?.term).toBe("Company");
    expect(findDefinitionForText("the Company's board", result.definitions)?.term).toBe("Company");
  });
});
