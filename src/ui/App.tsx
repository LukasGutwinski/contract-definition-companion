import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
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
  selectParagraph,
  supportsAnnotations,
  waitForOffice,
} from "../office/wordClient";
import { findDefinitionForText, scanDocument } from "../parser/scan";
import type { DefinitionEntry, DocumentParagraph, ScanResult } from "../parser/types";
import {
  clearCachedScan,
  loadCachedScan,
  loadSettings,
  saveCachedScan,
  saveSettings,
  type AppSettings,
} from "../storage/localStore";

type Status = "idle" | "loading" | "ready" | "warning" | "error";

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [scan, setScan] = useState<ScanResult | undefined>();
  const [selectedId, setSelectedId] = useState<string | undefined>();
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
          setStatus({ type: "ready", message: "Lokal gespeicherter Scan geladen" });
        }
      }

      unsubscribeSelection = onSelectionChanged((selectedText) => {
        const currentScan = scanRef.current;
        if (!currentScan || !selectedText.trim()) return;
        const definition = findDefinitionForText(selectedText, currentScan.definitions);
        if (definition) setSelectedId(definition.id);
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
      const result = scanDocument(paragraphs, { language: settings.language });
      setScan(result);
      setSelectedId(result.definitions[0]?.id);

      if (settings.persistDefinitions) {
        saveCachedScan(documentKey, result);
      }

      if (settings.inlineMode) {
        await applyAnnotations(result, paragraphs);
      }

      setStatus({
        type: result.warnings.length ? "warning" : "ready",
        message: `${result.stats.definitionsFound} Definitionen, ${result.stats.occurrencesFound} Vorkommen`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Scan fehlgeschlagen",
      });
    }
  }

  async function handleInlineToggle(nextInlineMode: boolean) {
    setSettings((current) => ({ ...current, inlineMode: nextInlineMode }));
    setInlineCount(0);

    if (!nextInlineMode) {
      await clearInlineAnnotations();
      setStatus({ type: "ready", message: "Inline-Markierungen entfernt" });
      return;
    }

    if (!scan) {
      setStatus({ type: "warning", message: "Vor dem Inline-Modus zuerst scannen" });
      return;
    }

    await applyAnnotations(scan, paragraphsRef.current.length ? paragraphsRef.current : await readDocumentParagraphs());
  }

  async function applyAnnotations(result: ScanResult, paragraphs: DocumentParagraph[]) {
    if (!annotationsAvailable) {
      throw new Error("Inline-Modus ist in dieser Word-Version nicht verfügbar.");
    }

    setStatus({ type: "loading", message: "Inline-Markierungen werden erzeugt" });
    const count = await applyInlineAnnotations(
      paragraphs,
      result.definitions,
      result.occurrences,
      (definitionId) => setSelectedId(definitionId),
    );
    setInlineCount(count);
    setStatus({ type: "ready", message: `${count} Inline-Markierungen aktiv` });
  }

  async function handleClearCache() {
    clearCachedScan(documentKey);
    await clearInlineAnnotations();
    setScan(undefined);
    setSelectedId(undefined);
    setInlineCount(0);
    setSettings((current) => ({ ...current, inlineMode: false }));
    setStatus({ type: "ready", message: "Lokale Daten für dieses Dokument gelöscht" });
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

        <button
          className={settings.inlineMode ? "toggle-button active" : "toggle-button"}
          type="button"
          onClick={() => void handleInlineToggle(!settings.inlineMode)}
          disabled={!scan || !annotationsAvailable || status.type === "loading"}
          title={annotationsAvailable ? "Inline-Markierungen umschalten" : "WordApi 1.8 erforderlich"}
        >
          <Highlighter size={16} />
          Inline
        </button>

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
          onSelect={setSelectedId}
        />

        <DefinitionDetails
          definition={selectedDefinition}
          occurrenceCount={selectedId ? occurrenceCountByDefinition.get(selectedId) ?? 0 : 0}
          inlineCount={inlineCount}
          onJump={() =>
            void selectParagraph(selectedDefinition?.paragraphId, selectedDefinition?.paragraphIndex)
          }
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
          <span className="definition-meta">
            {definition.language.toUpperCase()} · {occurrenceCountByDefinition.get(definition.id) ?? 0}
          </span>
        </button>
      ))}
    </nav>
  );
}

function DefinitionDetails({
  definition,
  occurrenceCount,
  inlineCount,
  onJump,
}: {
  definition?: DefinitionEntry;
  occurrenceCount: number;
  inlineCount: number;
  onJump: () => void;
}) {
  if (!definition) {
    return (
      <article className="definition-detail empty-state">
        Scanne das Dokument oder wähle einen Begriff aus.
      </article>
    );
  }

  return (
    <article className="definition-detail">
      <div className="detail-heading">
        <div>
          <span className="eyebrow">{definition.language.toUpperCase()}</span>
          <h2>{definition.term}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onJump} title="Zur Definition springen">
          <ArrowUpRight size={17} />
        </button>
      </div>

      <p className="definition-copy">{definition.definition}</p>

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
          <dt>Inline</dt>
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
