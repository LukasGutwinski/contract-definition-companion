import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Eraser,
  Highlighter,
  ListRestart,
  Loader2,
  Search,
  ShieldCheck,
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
  type AppSettings,
  type InlineMode,
} from "../storage/localStore";

type Status = "idle" | "loading" | "ready" | "warning" | "error";

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
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
  const suppressSelectionUntilRef = useRef(0);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    scanRef.current = scan;
  }, [scan]);

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

      if (settings.persistDefinitions) {
        const cached = loadCachedScan(key);
        if (cached) {
          setScan(cached);
          setSelectedId(cached.definitions[0]?.id);
          setSelectedOccurrenceIndex(0);
          setStatus({ type: "ready", message: "Lokal gespeicherter Scan geladen" });
        }
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
  }, [settings.persistDefinitions]);

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

  useEffect(() => {
    if (settings.inlineMode !== "selected" || !scan || !selectedId || !annotationsAvailable) return;

    const currentScan = scan;
    const currentSelectedId = selectedId;
    let cancelled = false;
    async function refreshSelectedAnnotations() {
      try {
        const paragraphs = await ensureParagraphs();
        if (!cancelled) {
          await applyAnnotations(currentScan, paragraphs, "selected", currentSelectedId);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            type: "error",
            message: error instanceof Error ? error.message : "Inline-Markierungen fehlgeschlagen",
          });
        }
      }
    }

    void refreshSelectedAnnotations();
    return () => {
      cancelled = true;
    };
  }, [annotationsAvailable, scan, selectedId, settings.inlineMode]);

  async function handleScan() {
    setStatus({ type: "loading", message: "Dokument wird lokal gescannt" });
    setInlineCount(0);

    try {
      const paragraphs = await readDocumentParagraphs();
      paragraphsRef.current = paragraphs;
      const result = scanDocument(paragraphs, { language: settings.language });
      const firstDefinitionId = result.definitions[0]?.id;
      setScan(result);
      setSelectedId(firstDefinitionId);
      setSelectedOccurrenceIndex(0);

      if (settings.persistDefinitions) {
        saveCachedScan(documentKey, result);
      }

      if (annotationsAvailable && settings.inlineMode === "all") {
        await applyAnnotations(result, paragraphs, "all");
      } else {
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

  async function handleInlineModeChange(nextInlineMode: InlineMode) {
    setSettings((current) => ({ ...current, inlineMode: nextInlineMode }));
    setInlineCount(0);

    if (nextInlineMode === "off") {
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
      await applyAnnotations(scan, paragraphs, nextInlineMode, selectedId);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Inline-Markierungen fehlgeschlagen",
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
    setSelectedId(undefined);
    setSelectedOccurrenceIndex(0);
    setInlineCount(0);
    setSettings((current) => ({ ...current, inlineMode: "off" }));
    setStatus({ type: "ready", message: "Lokale Daten für dieses Dokument gelöscht" });
  }

  function activateDefinition(definitionId: string, occurrenceId?: string) {
    const currentScan = scanRef.current;
    const isSameDefinition = definitionId === selectedId;
    setSelectedId(definitionId);

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

  async function handleOccurrenceJump(nextIndex: number) {
    if (!activeOccurrences.length) return;

    const boundedIndex = Math.min(Math.max(nextIndex, 0), activeOccurrences.length - 1);
    const occurrence = activeOccurrences[boundedIndex];
    setSelectedOccurrenceIndex(boundedIndex);
    suppressSelectionUntilRef.current = Date.now() + 1200;
    await selectOccurrence(occurrence, getOccurrenceIndexInParagraph(occurrence, activeOccurrences));
  }

  function updateSettings(update: Partial<AppSettings>) {
    setSettings((current) => ({ ...current, ...update }));
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

        <label className="field">
          <span>Sprache</span>
          <select
            value={settings.language}
            onChange={(event) => updateSettings({ language: event.target.value as AppSettings["language"] })}
          >
            <option value="auto">Auto</option>
            <option value="en">EN</option>
            <option value="de">DE</option>
          </select>
        </label>

        <label className="field inline-field" title={annotationsAvailable ? "Inline-Modus wählen" : "WordApi 1.8 erforderlich"}>
          <span>
            <Highlighter size={13} />
            Inline
          </span>
          <select
            value={settings.inlineMode}
            onChange={(event) => void handleInlineModeChange(event.target.value as InlineMode)}
            disabled={!scan || !annotationsAvailable || status.type === "loading"}
          >
            <option value="off">Aus</option>
            <option value="selected">Aktuell</option>
            <option value="all">Alle</option>
          </select>
        </label>

        <button className="icon-button" type="button" onClick={() => void handleClearCache()} title="Lokalen Cache löschen">
          <Eraser size={16} />
        </button>
      </section>

      <section className="privacy-row">
        <ShieldCheck size={16} />
        <span>Clientseitige Verarbeitung</span>
        <label className="persist-toggle">
          <input
            type="checkbox"
            checked={settings.persistDefinitions}
            onChange={(event) => updateSettings({ persistDefinitions: event.target.checked })}
          />
          <Database size={14} />
          Lokal merken
        </label>
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
        onJumpDefinition={() =>
          void selectParagraph(selectedDefinition?.paragraphId, selectedDefinition?.paragraphIndex)
        }
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
  onPreviousOccurrence,
  onNextOccurrence,
}: {
  definition?: DefinitionEntry;
  occurrenceCount: number;
  activeOccurrences: Occurrence[];
  selectedOccurrenceIndex: number;
  inlineCount: number;
  onJumpDefinition: () => void;
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
        <button className="icon-button" type="button" onClick={onJumpDefinition} title="Zur Definition springen">
          <ArrowUpRight size={17} />
        </button>
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

      {selectedOccurrence ? <p className="occurrence-context">{selectedOccurrence.context}</p> : null}

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

function getOccurrenceIndexInParagraph(occurrence: Occurrence, activeOccurrences: Occurrence[]): number {
  return activeOccurrences.filter(
    (item) =>
      item.paragraphIndex === occurrence.paragraphIndex &&
      item.paragraphId === occurrence.paragraphId &&
      item.start < occurrence.start,
  ).length;
}
