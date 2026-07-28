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

  it("excludes each term from its own definition while counting cross-references", () => {
    const result = scanDocument(
      paragraphs([
        "1. Definitions",
        "\"Seller\" means Example Seller GmbH (fictional).",
        "\"Seller Group\" means",
        "the Seller and each Affiliate, excluding the Company Group after Closing.",
        "\"Seller Warranties\" means",
        "the warranties given by the Seller under Clause 8.",
        "\"Shares\" means the shares in the Company.",
        "2. Signing",
        "The Seller gives the Seller Warranties to the Seller Group.",
      ]),
      { language: "en" },
    );

    const sellerGroup = result.definitions.find(
      (definition) => definition.term === "Seller Group",
    );
    expect(sellerGroup?.definitionParagraphIndexes).toEqual([2, 3]);
    expect(result.occurrences.map((occurrence) => occurrence.term)).toEqual([
      "Seller",
      "Seller",
      "Seller",
      "Seller Warranties",
      "Seller Group",
    ]);
    expect(result.occurrences.map((occurrence) => occurrence.paragraphIndex)).toEqual([
      3,
      5,
      8,
      8,
      8,
    ]);
  });

  it("counts a term used in another definition before its own definition", () => {
    const result = scanDocument(
      paragraphs([
        "1. Definitions",
        "\"Accounts\" means",
        "the audited financial statements for the financial year ended on the Accounts Date.",
        "\"Accounts Date\" means",
        "31 December 2025.",
      ]),
      { language: "en" },
    );

    const accountsDate = result.definitions.find(
      (definition) => definition.term === "Accounts Date",
    );
    expect(accountsDate).toBeDefined();
    expect(
      result.occurrences.filter(
        (occurrence) => occurrence.definitionId === accountsDate?.id,
      ),
    ).toEqual([
      expect.objectContaining({
        term: "Accounts Date",
        paragraphIndex: 2,
        contextHit: "Accounts Date",
      }),
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

  it("does not treat tabs in a table of contents as definition rows", () => {
    const result = scanDocument(
      paragraphs([
        "Contents",
        "10\tVariation and waiver\t6",
        "DATED\t201[------]",
        "1 Interpretation\t2",
        "1. Definitions",
        "Seller\tmeans the person selling the shares under this Agreement.",
        "2. Completion",
      ]),
      { language: "en" },
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual([
      "Seller",
    ]);
  });

  it("ignores English parenthetical aliases outside a definitions section", () => {
    const result = scanDocument(
      paragraphs([
        "Acme Ltd, a company incorporated in England (the \"Seller\").",
        "Buyer Ltd, a company incorporated in Austria (the \"Buyer\").",
        "The Buyer shall pay the Seller on Completion.",
      ]),
      { language: "en" },
    );

    expect(result.definitions).toEqual([]);
    expect(result.occurrences).toEqual([]);
  });

  it("extracts implicit quoted glossary definitions inside an interpretation section", () => {
    const result = scanDocument(
      paragraphs([
        "Agreed terms",
        "1. INTERPRETATION",
        "1.1 The definitions and rules of interpretation in this clause apply in this agreement (“Agreement”).",
        "“AED”/“Dirhams” means the lawful currency of the UAE.",
        "“Affiliate” with respect to any person, any entity which controls that person.",
        "“Business Day” any Day, excluding Fridays and Saturdays.",
        "“Company” has the meaning given in Recital (A).",
        "“Completion” completion of the sale and purchase of the Sale Shares.",
        "“Completion Date” [the date agreed by the parties].",
        "2 Completion",
        "The Company shall complete on the Completion Date.",
      ]),
      { language: "en" },
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual([
      "AED",
      "Affiliate",
      "Agreement",
      "Business Day",
      "Company",
      "Completion",
      "Completion Date",
      "Dirhams",
    ]);
    expect(
      result.definitions.find((definition) => definition.term === "Agreement")?.definition,
    ).toBe(
      "The definitions and rules of interpretation in this clause apply in this agreement.",
    );
    expect(
      result.definitions.find((definition) => definition.term === "Affiliate")?.definition,
    ).toBe("with respect to any person, any entity which controls that person.");
    expect(
      result.definitions.find((definition) => definition.term === "Company")?.definition,
    ).toBe("in Recital (A).");
    expect(result.occurrences.map((occurrence) => occurrence.contextHit)).toEqual([
      "Completion",
      "Company",
      "Completion Date",
    ]);
  });

  it("ignores even strong quoted variants outside the definitions section", () => {
    const result = scanDocument(
      paragraphs([
        "Acme Ltd (the \"Company\").",
        "The term \"Affiliate\" means any entity controlling the Company.",
        "For purposes of this Agreement, \"Restricted Period\" means the following six months.",
        "\"Control\", as used herein, means the power to direct management.",
        "\"Relevant Jurisdiction\" of a Person means its jurisdiction of incorporation.",
        "\"Closing\" shall have the meaning set forth in Clause 4.",
        "\"Expenses\" includes all reasonable out-of-pocket costs.",
        "1. Definitions",
        "\"Business Day\" means a day on which banks are open.",
        "2. Completion",
      ]),
      { language: "en" },
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual([
      "Business Day",
    ]);
  });

  it("does not treat bare quoted prose as a glossary outside a definitions context", () => {
    const result = scanDocument(
      paragraphs([
        "\"Status\" completed.",
        "\"Result\" successful.",
        "The parties discussed both labels.",
      ]),
      { language: "en" },
    );

    expect(result.definitions).toEqual([]);
  });

  it("ends a definitions section at an unpunctuated numbered heading", () => {
    const result = scanDocument(
      paragraphs([
        "1 Definitions",
        "\"Affiliate\" means an entity controlling another entity.",
        "2 Completion",
        "The Buyer means to complete the transaction promptly.",
      ]),
      { language: "en" },
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual(["Affiliate"]);
    expect(result.definitions[0].definition).toBe(
      "an entity controlling another entity.",
    );
  });

  it("rejects ordinary unquoted prose that happens to contain definition verbs", () => {
    const result = scanDocument(
      paragraphs([
        "Definitions",
        "\"Known Term\" means a concept known to the parties.",
        "The Buyer means to complete the transaction promptly.",
        "This means that the Seller must cooperate.",
        "The purchase price includes VAT.",
      ]),
      { language: "en" },
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual(["Known Term"]);
  });

  it("does not append an unparsed quoted entry to the preceding definition", () => {
    const result = scanDocument(
      paragraphs([
        "Definitions",
        "\"Known Term\" means",
        "a concept already known to the parties.",
        "\"Standalone Label\"",
        "This paragraph must not become part of Known Term.",
      ]),
      { language: "en" },
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual(["Known Term"]);
    expect(result.definitions[0].definition).toBe(
      "a concept already known to the parties.",
    );
    expect(result.definitions[0].definitionParagraphIndexes).toEqual([1, 2]);
  });

  it("supports paired curly quotes and apostrophes inside double-quoted terms", () => {
    const result = scanDocument(
      paragraphs([
        "Definitions",
        "“Seller’s Account” means the account notified by the Seller.",
        "‘Business Day’ means a day on which banks are open.",
        "2 Completion",
      ]),
      { language: "en" },
    );

    expect(result.definitions.map((definition) => definition.term)).toEqual([
      "Business Day",
      "Seller’s Account",
    ]);
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

  it("handles the definition structures used in the Legal Research Committee document", () => {
    const documentParagraphs: DocumentParagraph[] = [
      "First Seller, holder of passport number 111.",
      "Second Seller, holder of passport number 222.",
      "(together the “Sellers”); and",
      "Agreed terms",
    ].map((text, index) => ({
      id: `p-${index}`,
      index,
      text,
    }));

    documentParagraphs.push(
      {
        id: "p-4",
        index: 4,
        text: "Interpretation",
        outlineLevel: 0,
        style: "ATC1",
      },
      {
        id: "p-5",
        index: 5,
        text: "“Affiliate” with respect to any person, any entity which controls that person. For the purposes of this definition, “control” shall mean the power to direct the management or policies of that entity.",
      },
      {
        id: "p-6",
        index: 6,
        text: "“Laws” any applicable statute, regulation or order; and “Law” means any of them.",
      },
      {
        id: "p-7",
        index: 7,
        text: "“Short Form Share Transfer Agreement and Amendment to the Memorandum of Association” means the transfer instrument to be signed at Completion.",
      },
      {
        id: "p-8",
        index: 8,
        text: "Sale and purchase",
        outlineLevel: 0,
        style: "ATC1",
      },
      {
        id: "p-9",
        index: 9,
        text: "A person includes any individual, company or partnership.",
      },
      {
        id: "p-10",
        index: 10,
        text: "Writing or written includes email.",
      },
    );

    const result = scanDocument(documentParagraphs, { language: "en" });
    const terms = new Set(result.definitions.map((definition) => definition.term));

    expect(terms).toEqual(
      new Set([
        "Affiliate",
        "control",
        "Law",
        "Laws",
        "Short Form Share Transfer Agreement and Amendment to the Memorandum of Association",
      ]),
    );
    expect(
      result.definitions.find((definition) => definition.term === "control")
        ?.definition,
    ).toBe("the power to direct the management or policies of that entity.");
    expect(
      result.definitions.find((definition) => definition.term === "Law")
        ?.definition,
    ).toBe("any of them.");
    expect(terms.has("Sellers")).toBe(false);
    expect(terms.has("A person")).toBe(false);
    expect(terms.has("Writing or written")).toBe(false);
  });

  it("recognizes an NVCA-style defined terms section and its qualified term", () => {
    const documentParagraphs: DocumentParagraph[] = [
      {
        id: "p-0",
        index: 0,
        text: "Acme, Inc. (the “Company”).",
      },
      {
        id: "p-1",
        index: 1,
        text: "Purchase and Sale of Preferred Stock",
        outlineLevel: 0,
        style: "Heading1",
      },
      {
        id: "p-2",
        index: 2,
        text: "The shares sold at Closing are the “Additional Shares”.",
      },
      {
        id: "p-3",
        index: 3,
        text: "Defined Terms Used in this Agreement",
        outlineLevel: 1,
        style: "Heading2",
      },
      {
        id: "p-4",
        index: 4,
        text: "In addition to the terms defined above, the following terms have the meanings below.",
      },
      {
        id: "p-5",
        index: 5,
        text: "“Affiliate” means any Person who controls, is controlled by, or is under common control with another Person.",
        outlineLevel: 2,
        style: "Heading3",
      },
      {
        id: "p-6",
        index: 6,
        text: "“Knowledge” including the phrase “to the Company’s knowledge” shall mean the actual knowledge of the named officers.",
        outlineLevel: 2,
        style: "Heading3",
      },
      {
        id: "p-7",
        index: 7,
        text: "“Shares” means the shares of Series A Preferred Stock issued at Closing.",
        outlineLevel: 2,
        style: "Heading3",
      },
      {
        id: "p-8",
        index: 8,
        text: "Representations and Warranties of the Company",
        outlineLevel: 0,
        style: "Heading1",
      },
      {
        id: "p-9",
        index: 9,
        text: "The Company handles personal data (the “Personal Information”).",
      },
    ];

    const result = scanDocument(documentParagraphs, { language: "en" });

    expect(result.definitions.map((definition) => definition.term)).toEqual([
      "Affiliate",
      "Knowledge",
      "Shares",
    ]);
    expect(
      result.definitions.find((definition) => definition.term === "Knowledge")
        ?.definition,
    ).toBe(
      "including the phrase “to the Company’s knowledge”, the actual knowledge of the named officers.",
    );
  });
});
