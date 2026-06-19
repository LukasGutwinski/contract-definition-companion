import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Highlighter,
  ListRestart,
  Loader2,
  Search,
} from "lucide-react";
import { clearInlineAnnotations, applyInlineAnnotations } from "../office/annotations";
import {
  getDocumentKey,
  onSelectionChanged,
  readDocumentParagraphs,
  selectOccurrence,
  selectParagraph,
  supportsAnnotations,
  waitForOffice,
} from "../office/wordClient";
import { findDefinitionForText, scanDocument } from "../parser/scan";
import type { DefinitionEntry, DocumentParagraph, Occurrence, ScanResult } from "../parser/types";
import {
  clearCachedScan,
  loadCachedScan,
  loadSettings,
  saveCachedScan,
  saveSettings,
  type InlineMode,
} from "../storage/localStore";

type Status = "idle" | "loading" | "ready" | "warning" | "error";

export function App() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [scan, setScan] = useState<ScanResult | undefined>();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedOccurrenceIndex, setSelectedOccurrenceIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [documentKey, setDocumentKey] = useState<string>("demo-document");
  const [status, setStatus] = useState<{ type: Status; message: string }>({
    type: "idle",
    message: "Bereit",
  });
  const [inlineCount, setInlineCount] = useState(0);
  const [annotationsAvailable, setAnnotationsAvailable] = useState(false);

  const paragraphsRef = useRef<DocumentParagraph[]>([]);
  const scanRef = useRef<ScanResult | undefined>();
  const selectedIdRef = useRef<string | undefined>();
  const suppressSelectionUntilRef = useRef(0);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    scanRef.current = scan;
  }, [scan]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    let unsubscribeSelection: () => void = () => undefined;
    let cancelled = false;

    async function initialize() {
      const environment = await waitForOffice();
      if (cancelled) return;

      setAnnotationsAvailable(supportsAnnotations());
      const key = await getDocumentKey();
      setDocumentKey(key);

      if (!environment.available) {
        setStatus({ type: "warning", message: environment.reason ?? "Demo-Modus aktiv" });
      }

      const cached = loadCachedScan(key);
      if (cached) {
        setScan(cached);
        updateSelectedId(cached.definitions[0]?.id);
        setSelectedOccurrenceIndex(0);
        setStatus({ type: "ready", message: "Lokal gespeicherter Scan geladen" });
      }

      unsubscribeSelection = onSelectionChanged((selectedText) => {
        if (Date.now() < suppressSelectionUntilRef.current) return;

        const currentScan = scanRef.current;
        if (!currentScan || !selectedText.trim()) return;
        const definition = findDefinitionForText(selectedText, currentScan.definitions);
        if (definition) activateDefinition(definition.id);
      });
    }

    initialize();
    return () => {
      cancelled = true;
      unsubscribeSelection();
    };
  }, []);

  const selectedDefinition = useMemo(
    () => scan?.definitions.find((definition) => definition.id === selectedId),
    [scan, selectedId],
  );

  const activeOccurrences = useMemo(
    () => scan?.occurrences.filter((occurrence) => occurrence.definitionId === selectedId) ?? [],
    [scan, selectedId],
  );

  const filteredDefinitions = useMemo(() => {
    if (!scan) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return scan.definitions;
    return scan.definitions.filter(
      (definition) =>
        definition.term.toLocaleLowerCase().includes(normalizedQuery) ||
        definition.definition.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [query, scan]);

  const occurrenceCountByDefinition = useMemo(() => {
    const counts = new Map<string, number>();
    scan?.occurrences.forEach((occurrence) => {
      counts.set(occurrence.definitionId, (counts.get(occurrence.definitionId) ?? 0) + 1);
    });
    return counts;
  }, [scan]);

  async function handleScan() {
    setStatus({ type: "loading", message: "Dokument wird lokal gescannt" });
    setInlineCount(0);

    try {
      const paragraphs = await readDocumentParagraphs();
      paragraphsRef.current = paragraphs;
      const result = scanDocument(paragraphs, { language: "auto" });
      const firstDefinitionId = result.definitions[0]?.id;
      setScan(result);
      updateSelectedId(firstDefinitionId);
      setSelectedOccurrenceIndex(0);

      saveCachedScan(documentKey, result);

      if (annotationsAvailable && settings.inlineMode === "all") {
        await applyAnnotations(result, paragraphs, "all");
      } else {
        if (settings.inlineMode !== "off") {
          setSettings((current) => ({ ...current, inlineMode: "off" }));
        }
        await clearInlineAnnotations();
        setStatus({
          type: result.warnings.length ? "warning" : "ready",
          message: `${result.stats.definitionsFound} Definitionen, ${result.stats.occurrencesFound} Vorkommen`,
        });
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Scan fehlgeschlagen",
      });
    }
  }

  async function handleInlineToggle(enabled: boolean) {
    const nextInlineMode = enabled ? "all" : "off";
    setSettings((current) => ({ ...current, inlineMode: nextInlineMode }));
    setInlineCount(0);

    if (!enabled) {
      await clearInlineAnnotations();
      setStatus({ type: "ready", message: "Inline-Markierungen entfernt" });
      return;
    }

    if (!scan) {
      setStatus({ type: "warning", message: "Vor dem Inline-Modus zuerst scannen" });
      return;
    }

    try {
      const paragraphs = await ensureParagraphs();
      await applyAnnotations(scan, paragraphs, "all");
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Inline-Markierungen fehlgeschlagen",
      });
    }
  }

  async function handleHighlightSelectedDefinition() {
    if (!scan || !selectedId) {
      setStatus({ type: "warning", message: "Bitte zuerst eine Definition auswählen" });
      return;
    }

    try {
      const paragraphs = await ensureParagraphs();
      await applyAnnotations(scan, paragraphs, "selected", selectedId);
      setSettings((current) => ({ ...current, inlineMode: "selected" }));
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Markierung fehlgeschlagen",
      });
    }
  }

  async function applyAnnotations(
    result: ScanResult,
    paragraphs: DocumentParagraph[],
    inlineMode: Exclude<InlineMode, "off">,
    definitionId?: string,
  ) {
    if (!annotationsAvailable) {
      throw new Error("Inline-Modus ist in dieser Word-Version nicht verfügbar.");
    }

    const visibleDefinitions =
      inlineMode === "all"
        ? result.definitions
        : result.definitions.filter((definition) => definition.id === definitionId);
    const uncappedOccurrences =
      inlineMode === "all"
        ? result.occurrences
        : result.occurrences.filter((occurrence) => occurrence.definitionId === definitionId);

    setStatus({ type: "loading", message: "Inline-Markierungen werden erzeugt" });
    const count = await applyInlineAnnotations(
      paragraphs,
      visibleDefinitions,
      uncappedOccurrences,
      activateDefinition,
    );
    setInlineCount(count);
    setStatus({
      type: "ready",
      message:
        inlineMode === "all"
          ? `${count} Inline-Markierungen aktiv`
          : `${count} Markierungen für aktuellen Begriff`,
    });
  }

  async function handleClearCache() {
    clearCachedScan(documentKey);
    await clearInlineAnnotations();
    setScan(undefined);
    updateSelectedId(undefined);
    setSelectedOccurrenceIndex(0);
    setInlineCount(0);
    setSettings((current) => ({ ...current, inlineMode: "off" }));
    setStatus({ type: "ready", message: "Lokale Daten für dieses Dokument gelöscht" });
  }

  function activateDefinition(definitionId: string, occurrenceId?: string) {
    const currentScan = scanRef.current;
    const isSameDefinition = definitionId === selectedIdRef.current;
    updateSelectedId(definitionId);

    const definitionOccurrences =
      currentScan?.occurrences.filter((occurrence) => occurrence.definitionId === definitionId) ?? [];
    const occurrenceIndex = occurrenceId
      ? definitionOccurrences.findIndex((occurrence) => occurrence.id === occurrenceId)
      : -1;
    if (occurrenceIndex >= 0) {
      setSelectedOccurrenceIndex(occurrenceIndex);
    } else if (!isSameDefinition) {
      setSelectedOccurrenceIndex(0);
    }
  }

  async function ensureParagraphs(): Promise<DocumentParagraph[]> {
    if (paragraphsRef.current.length) return paragraphsRef.current;
    const paragraphs = await readDocumentParagraphs();
    paragraphsRef.current = paragraphs;
    return paragraphs;
  }

  function updateSelectedId(nextSelectedId: string | undefined) {
    selectedIdRef.current = nextSelectedId;
    setSelectedId(nextSelectedId);
  }

  function suppressSelectionEvents(durationMs = 2000) {
    suppressSelectionUntilRef.current = Math.max(
      suppressSelectionUntilRef.current,
      Date.now() + durationMs,
    );
  }

  async function handleOccurrenceJump(nextIndex: number) {
    if (!activeOccurrences.length) return;

    const boundedIndex = Math.min(Math.max(nextIndex, 0), activeOccurrences.length - 1);
    const occurrence = activeOccurrences[boundedIndex];
    setSelectedOccurrenceIndex(boundedIndex);
    suppressSelectionEvents(3000);
    await selectOccurrence(occurrence, getOccurrenceIndexInParagraph(occurrence, activeOccurrences));
    suppressSelectionEvents(1200);
  }

  async function handleDefinitionJump() {
    if (!selectedDefinition) return;

    suppressSelectionEvents(3000);
    await selectParagraph(selectedDefinition.paragraphId, selectedDefinition.paragraphIndex);
    suppressSelectionEvents(1200);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Definitions</h1>
          <p>{status.message}</p>
        </div>
        <StatusBadge status={status.type} />
      </header>

      <section className="toolbar" aria-label="Aktionen">
        <button className="primary-button" type="button" onClick={handleScan} disabled={status.type === "loading"}>
          {status.type === "loading" ? <Loader2 className="spin" size={16} /> : <ListRestart size={16} />}
          Scan
        </button>

        <button
          className={settings.inlineMode !== "off" ? "toggle-button active" : "toggle-button"}
          type="button"
          onClick={() => void handleInlineToggle(settings.inlineMode === "off")}
          disabled={!scan || !annotationsAvailable || status.type === "loading"}
          title={annotationsAvailable ? "Inline-Markierungen ein- oder ausschalten" : "WordApi 1.8 erforderlich"}
        >
          <Highlighter size={16} />
          Inline
        </button>

        <button className="icon-button" type="button" onClick={() => void handleClearCache()} title="Lokalen Cache löschen">
          <Eraser size={16} />
        </button>
      </section>

      {scan?.warnings.length ? (
        <section className="warning-list" aria-label="Hinweise">
          {scan.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      ) : null}

      <DefinitionDetails
        definition={selectedDefinition}
        occurrenceCount={selectedId ? occurrenceCountByDefinition.get(selectedId) ?? 0 : 0}
        activeOccurrences={activeOccurrences}
        selectedOccurrenceIndex={selectedOccurrenceIndex}
        inlineCount={inlineCount}
        onJumpDefinition={() => void handleDefinitionJump()}
        onHighlightDefinition={() => void handleHighlightSelectedDefinition()}
        onPreviousOccurrence={() => void handleOccurrenceJump(selectedOccurrenceIndex - 1)}
        onNextOccurrence={() => void handleOccurrenceJump(selectedOccurrenceIndex + 1)}
      />

      <section className="search-row">
        <Search size={16} />
        <input
          type="search"
          placeholder="Definition suchen"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </section>

      <section className="definition-layout">
        <DefinitionList
          definitions={filteredDefinitions}
          occurrenceCountByDefinition={occurrenceCountByDefinition}
          selectedId={selectedId}
          onSelect={(definitionId) => activateDefinition(definitionId)}
        />
      </section>
    </main>
  );
}

function DefinitionList({
  definitions,
  occurrenceCountByDefinition,
  selectedId,
  onSelect,
}: {
  definitions: DefinitionEntry[];
  occurrenceCountByDefinition: Map<string, number>;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (!definitions.length) {
    return <div className="empty-state">Keine Definitionen im aktuellen Scan.</div>;
  }

  return (
    <nav className="definition-list" aria-label="Definitionen">
      {definitions.map((definition) => (
        <button
          className={definition.id === selectedId ? "definition-row selected" : "definition-row"}
          type="button"
          key={definition.id}
          onClick={() => onSelect(definition.id)}
        >
          <span className="definition-term">{definition.term}</span>
          <span className="definition-meta">{occurrenceCountByDefinition.get(definition.id) ?? 0}</span>
        </button>
      ))}
    </nav>
  );
}

function DefinitionDetails({
  definition,
  occurrenceCount,
  activeOccurrences,
  selectedOccurrenceIndex,
  inlineCount,
  onJumpDefinition,
  onHighlightDefinition,
  onPreviousOccurrence,
  onNextOccurrence,
}: {
  definition?: DefinitionEntry;
  occurrenceCount: number;
  activeOccurrences: Occurrence[];
  selectedOccurrenceIndex: number;
  inlineCount: number;
  onJumpDefinition: () => void;
  onHighlightDefinition: () => void;
  onPreviousOccurrence: () => void;
  onNextOccurrence: () => void;
}) {
  if (!definition) {
    return (
      <article className="definition-detail active-detail empty-state">
        Scanne das Dokument oder wähle einen Begriff aus.
      </article>
    );
  }

  const selectedOccurrence = activeOccurrences[selectedOccurrenceIndex];
  const occurrencePosition = activeOccurrences.length ? selectedOccurrenceIndex + 1 : 0;

  return (
    <article className="definition-detail active-detail">
      <div className="detail-heading">
        <div>
          <h2>{definition.term}</h2>
        </div>
        <div className="detail-actions">
          <button className="icon-button" type="button" onClick={onHighlightDefinition} title="Diesen Begriff markieren">
            <Highlighter size={17} />
          </button>
          <button className="icon-button" type="button" onClick={onJumpDefinition} title="Zur Definition springen">
            <ArrowUpRight size={17} />
          </button>
        </div>
      </div>

      <p className="definition-copy">{definition.definition}</p>

      <div className="occurrence-nav" aria-label="Vorkommen">
        <button
          className="small-nav-button"
          type="button"
          onClick={onPreviousOccurrence}
          disabled={selectedOccurrenceIndex <= 0}
          title="Voriges Vorkommen"
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Vorkommen {occurrencePosition} / {activeOccurrences.length}
        </span>
        <button
          className="small-nav-button"
          type="button"
          onClick={onNextOccurrence}
          disabled={!activeOccurrences.length || selectedOccurrenceIndex >= activeOccurrences.length - 1}
          title="Nächstes Vorkommen"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {selectedOccurrence ? <OccurrenceContext occurrence={selectedOccurrence} /> : null}

      <dl className="definition-facts">
        <div>
          <dt>Vorkommen</dt>
          <dd>{occurrenceCount}</dd>
        </div>
        <div>
          <dt>Quelle</dt>
          <dd>{definition.source}</dd>
        </div>
        <div>
          <dt>Markiert</dt>
          <dd>{inlineCount}</dd>
        </div>
      </dl>
    </article>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "loading") return <Loader2 className="status-icon spin" size={18} />;
  if (status === "ready") return <CheckCircle2 className="status-icon ok" size={18} />;
  if (status === "warning") return <CheckCircle2 className="status-icon warn" size={18} />;
  if (status === "error") return <CheckCircle2 className="status-icon error" size={18} />;
  return null;
}

function OccurrenceContext({ occurrence }: { occurrence: Occurrence }) {
  if (!occurrence.contextHit) {
    return <p className="occurrence-context">{occurrence.context}</p>;
  }

  return (
    <p className="occurrence-context">
      {occurrence.contextBefore ? <>{occurrence.contextBefore} </> : null}
      <mark>{occurrence.contextHit}</mark>
      {occurrence.contextAfter ? <> {occurrence.contextAfter}</> : null}
    </p>
  );
}

function getOccurrenceIndexInParagraph(occurrence: Occurrence, activeOccurrences: Occurrence[]): number {
  return activeOccurrences.filter(
    (item) =>
      item.paragraphIndex === occurrence.paragraphIndex &&
      item.paragraphId === occurrence.paragraphId &&
      item.start < occurrence.start,
  ).length;
}
