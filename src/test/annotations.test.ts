import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DefinitionEntry, Occurrence } from "../parser/types";

interface AnnotationHarness {
  deletedAnnotationIds: string[];
  insertAnnotations: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  sync: ReturnType<typeof vi.fn>;
}

interface AnnotationHarnessOptions {
  failOccurrenceIds?: Set<string>;
  supportsWordApi17?: boolean;
}

const definitions: DefinitionEntry[] = [
  {
    id: "definition-a",
    term: "Agreement",
    normalizedTerm: "agreement",
    definition: "this agreement",
    language: "en",
    source: "quoted",
    confidence: 1,
    paragraphId: "definition-paragraph-a",
    paragraphIndex: 0,
    definitionParagraphIndexes: [0],
    lineIndex: 0,
  },
  {
    id: "definition-b",
    term: "Business Day",
    normalizedTerm: "business day",
    definition: "a working day",
    language: "en",
    source: "quoted",
    confidence: 1,
    paragraphId: "definition-paragraph-b",
    paragraphIndex: 1,
    definitionParagraphIndexes: [1],
    lineIndex: 1,
  },
];

const occurrences: Occurrence[] = [
  {
    id: "occurrence-a",
    definitionId: "definition-a",
    term: "Agreement",
    paragraphId: "paragraph-a",
    paragraphIndex: 2,
    start: 4,
    length: 9,
    context: "the Agreement applies",
  },
  {
    id: "occurrence-b",
    definitionId: "definition-b",
    term: "Business Day",
    paragraphId: "paragraph-b",
    paragraphIndex: 3,
    start: 8,
    length: 12,
    context: "the next Business Day",
  },
];

describe("inline annotations", () => {
  let annotations: typeof import("../office/annotations");
  let harness: AnnotationHarness;

  beforeEach(async () => {
    vi.resetModules();
    harness = installWordHarness();
    annotations = await import("../office/annotations");
  });

  it("uses non-persistent WordApi 1.7 critiques without formatting or popup options", async () => {
    const count = await annotations.applyInlineAnnotations(
      definitions,
      occurrences,
      vi.fn(),
    );

    expect(count).toBe(2);
    const insertedCritiques = harness.insertAnnotations.mock.calls.flatMap(
      ([annotationSet]) => annotationSet.critiques as Word.Critique[],
    );
    expect(insertedCritiques).toHaveLength(2);
    expect(insertedCritiques.every((critique) => critique.popupOptions === undefined)).toBe(true);
  });

  it("reuses the selected annotation and removes the others in one Word roundtrip", async () => {
    await annotations.applyInlineAnnotations(definitions, occurrences, vi.fn());

    harness.run.mockClear();
    harness.sync.mockClear();
    harness.deletedAnnotationIds.length = 0;
    harness.insertAnnotations.mockClear();

    const count = await annotations.applyInlineAnnotations(
      [definitions[0]],
      [occurrences[0]],
      vi.fn(),
    );

    expect(count).toBe(1);
    expect(harness.deletedAnnotationIds).toEqual(["annotation-2"]);
    expect(harness.insertAnnotations).not.toHaveBeenCalled();
    expect(harness.run).toHaveBeenCalledTimes(1);
    expect(harness.sync).toHaveBeenCalledTimes(1);
  });

  it("adds only missing annotations when expanding from one term to all terms", async () => {
    await annotations.applyInlineAnnotations(
      [definitions[0]],
      [occurrences[0]],
      vi.fn(),
    );

    harness.run.mockClear();
    harness.sync.mockClear();
    harness.deletedAnnotationIds.length = 0;
    harness.insertAnnotations.mockClear();

    const count = await annotations.applyInlineAnnotations(
      definitions,
      occurrences,
      vi.fn(),
    );

    expect(count).toBe(2);
    expect(harness.deletedAnnotationIds).toEqual([]);
    expect(harness.insertAnnotations).toHaveBeenCalledTimes(1);
    expect(harness.run).toHaveBeenCalledTimes(1);
    expect(harness.sync).toHaveBeenCalledTimes(1);
  });

  it("does not call Word again when the requested annotations are already active", async () => {
    await annotations.applyInlineAnnotations(
      [definitions[0]],
      [occurrences[0]],
      vi.fn(),
    );

    harness.run.mockClear();
    harness.sync.mockClear();
    harness.insertAnnotations.mockClear();

    const count = await annotations.applyInlineAnnotations(
      [definitions[0]],
      [occurrences[0]],
      vi.fn(),
    );

    expect(count).toBe(1);
    expect(harness.insertAnnotations).not.toHaveBeenCalled();
    expect(harness.run).not.toHaveBeenCalled();
    expect(harness.sync).not.toHaveBeenCalled();
  });

  it("keeps valid annotations when Word rejects an individual occurrence", async () => {
    vi.resetModules();
    harness = installWordHarness({
      failOccurrenceIds: new Set(["occurrence-a"]),
    });
    annotations = await import("../office/annotations");

    const count = await annotations.applyInlineAnnotations(
      definitions,
      occurrences,
      vi.fn(),
    );

    expect(count).toBe(1);
    expect(
      harness.insertAnnotations.mock.calls.some(
        ([annotationSet]) =>
          annotationSet.critiques.length === 1 &&
          annotationSet.critiques[0].start === occurrences[1].start,
      ),
    ).toBe(true);
  });

  it("reports annotation unavailability without falling back to document formatting", async () => {
    vi.resetModules();
    harness = installWordHarness({
      failOccurrenceIds: new Set(occurrences.map((occurrence) => occurrence.id)),
    });
    annotations = await import("../office/annotations");

    await expect(
      annotations.applyInlineAnnotations(definitions, occurrences, vi.fn()),
    ).rejects.toThrow("Microsoft 365 subscription");
  });
});

function installWordHarness(
  options: AnnotationHarnessOptions = {},
): AnnotationHarness {
  let nextAnnotationId = 1;
  const deletedAnnotationIds: string[] = [];
  const sync = vi.fn(async () => undefined);
  const occurrenceIdByCoordinates = new Map(
    occurrences.map((occurrence) => [
      `${occurrence.paragraphId}:${occurrence.start}:${occurrence.length}`,
      occurrence.id,
    ]),
  );
  let activeParagraphId = "";
  const insertAnnotations = vi.fn(
    ({ critiques }: { critiques: Word.Critique[] }) => {
      const rejected = critiques.some((critique) => {
        const occurrenceId = occurrenceIdByCoordinates.get(
          `${activeParagraphId}:${critique.start}:${critique.length}`,
        );
        return Boolean(occurrenceId && options.failOccurrenceIds?.has(occurrenceId));
      });
      if (rejected) {
        throw Object.assign(new Error("Annotation insertion failed"), {
          code: "GeneralException",
        });
      }
      return {
        value: critiques.map(() => `annotation-${nextAnnotationId++}`),
      };
    },
  );

  let context: {
    document: {
      getAnnotationById: (id: string) => { delete: () => void };
      getParagraphByUniqueLocalId: (paragraphId: string) => {
        insertAnnotations: (annotationSet: {
          critiques: Word.Critique[];
        }) => { value: string[] };
      };
      onAnnotationClicked: {
        add: (handler: (args: { id: string }) => Promise<void>) => {
          context: typeof context;
          remove: () => void;
        };
      };
      onAnnotationRemoved: {
        add: (handler: (args: { ids: string[] }) => Promise<void>) => {
          context: typeof context;
          remove: () => void;
        };
      };
    };
    sync: typeof sync;
  };

  context = {
    document: {
      getAnnotationById: (id) => ({
        delete: () => {
          deletedAnnotationIds.push(id);
        },
      }),
      getParagraphByUniqueLocalId: (paragraphId) => ({
        insertAnnotations: (annotationSet) => {
          activeParagraphId = paragraphId;
          return insertAnnotations(annotationSet);
        },
      }),
      onAnnotationClicked: {
        add: () => ({ context, remove: vi.fn() }),
      },
      onAnnotationRemoved: {
        add: () => ({ context, remove: vi.fn() }),
      },
    },
    sync,
  };

  const run = vi.fn(
    async (callback: (requestContext: typeof context) => Promise<void>) =>
      callback(context),
  );
  const word = {
    CritiqueColorScheme: { berry: "Berry" },
    run,
  };

  vi.stubGlobal("Word", word);
  vi.stubGlobal("window", {
    Office: {
      context: {
        requirements: {
          isSetSupported: (_setName: string, version: string) =>
            version === "1.7" && options.supportsWordApi17 !== false,
        },
      },
    },
    Word: word,
  });

  return {
    deletedAnnotationIds,
    insertAnnotations,
    run,
    sync,
  };
}
