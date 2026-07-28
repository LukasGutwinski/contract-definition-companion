import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Github,
  Highlighter,
  Info,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pin,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  AnnotationUnavailableError,
  applyInlineAnnotations,
  clearInlineAnnotations,
} from "../office/annotations";
import {
  onSelectionChanged,
  readDocumentParagraphs,
  selectOccurrence,
  selectParagraph,
  supportsAnnotations,
  waitForOffice,
} from "../office/wordClient";
import { findDefinitionForText, scanDocument } from "../parser/scan";
import type { DefinitionEntry, Occurrence, ScanResult } from "../parser/types";
import {
  clearLegacyCachedScans,
  loadSettings,
  saveSettings,
  type InlineMode,
} from "../storage/localStore";

type AppView =
  | "initializing"
  | "scanning"
  | "ready"
  | "empty"
  | "error"
  | "outside-word";
type StatusTone = "neutral" | "success" | "warning";
type InfoView = "about" | "privacy";

const GUT_VENTURES_URL =
  "https://gut-ventures.com/?utm_source=contract_definitions&utm_medium=word_addin";
const CUSTOM_SOLUTIONS_URL =
  "https://gut-ventures.com/?utm_source=contract_definitions&utm_medium=word_addin&utm_campaign=custom_legal_tech";
const GITHUB_URL = "https://github.com/LukasGutwinski";
const FEEDBACK_URL =
  "mailto:lukas@gut-ventures.com?subject=Contract%20Definitions%20feedback";

export function App() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [scan, setScan] = useState<ScanResult | undefined>();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedOccurrenceIndex, setSelectedOccurrenceIndex] = useState(-1);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<AppView>("initializing");
  const [statusMessage, setStatusMessage] = useState("Scanning this document locally…");
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [errorMessage, setErrorMessage] = useState("");
  const [inlineCount, setInlineCount] = useState(0);
  const [annotationsAvailable, setAnnotationsAvailable] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [infoView, setInfoView] = useState<InfoView | undefined>();
  const [pinnedDefinitionIds, setPinnedDefinitionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [definitionScrollRequest, setDefinitionScrollRequest] = useState(0);

  const scanRef = useRef<ScanResult | undefined>();
  const selectedIdRef = useRef<string | undefined>();
  const suppressSelectionUntilRef = useRef(0);
  const menuRef = useRef<HTMLDetailsElement>(null);

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
    if (!infoView) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInfoView(undefined);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [infoView]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        menuRef.current?.open &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        menuRef.current.open = false;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let unsubscribeSelection: () => void = () => undefined;
    let cancelled = false;

    async function initialize() {
      clearLegacyCachedScans();

      const environment = await waitForOffice();
      if (cancelled) return;

      const isBrowserPreview = !environment.available && import.meta.env.DEV;
      if (!environment.available && !isBrowserPreview) {
        setView("outside-word");
        setStatusMessage("Microsoft Word is required");
        setErrorMessage(
          environment.reason ?? "Open this add-in in Microsoft Word to analyze a document.",
        );
        return;
      }

      const canAnnotate = environment.available && supportsAnnotations();
      setAnnotationsAvailable(canAnnotate);

      if (!canAnnotate && settings.inlineMode !== "off") {
        setSettings((current) => ({ ...current, inlineMode: "off" }));
      }

      unsubscribeSelection = onSelectionChanged((selectedText) => {
        if (Date.now() < suppressSelectionUntilRef.current) return;

        const currentScan = scanRef.current;
        if (!currentScan || !selectedText.trim()) return;
        const definition = findDefinitionForText(selectedText, currentScan.definitions);
        if (!definition) return;

        activateDefinition(definition.id, undefined, true);
      });

      await runScan({
        canAnnotate,
        isBrowserPreview,
        isCancelled: () => cancelled,
      });
    }

    void initialize();
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
    return scan.definitions.filter(
      (definition) =>
        !normalizedQuery ||
        definition.term.toLocaleLowerCase().includes(normalizedQuery),
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
    if (!selectedId) return;
    if (filteredDefinitions.some((definition) => definition.id === selectedId)) return;

    updateSelectedId(undefined);
    setSelectedOccurrenceIndex(-1);
  }, [filteredDefinitions, selectedId]);
  async function runScan(
    options: {
      background?: boolean;
      canAnnotate?: boolean;
      isBrowserPreview?: boolean;
      isCancelled?: () => boolean;
    } = {},
  ) {
    const keepCurrentResults = Boolean(options.background && scanRef.current?.definitions.length);
    const cancelled = options.isCancelled ?? (() => false);
    const canAnnotate = options.canAnnotate ?? annotationsAvailable;

    setErrorMessage("");
    setInlineCount(0);
    if (keepCurrentResults) {
      setIsRefreshing(true);
      setStatusTone("neutral");
      setStatusMessage(
        options.isBrowserPreview ? "Browser preview · Updating…" : "Updating definitions…",
      );
    } else {
      setView("scanning");
      setStatusTone("neutral");
      setStatusMessage("Scanning this document locally…");
      scanRef.current = undefined;
      setScan(undefined);
      updateSelectedId(undefined);
    }

    try {
      const paragraphs = await readDocumentParagraphs();
      if (cancelled()) return;

      const result = scanDocument(paragraphs, { language: "en" });
      if (cancelled()) return;
      installScan(result);

      if (!result.definitions.length) {
        await clearInlineAnnotations();
        if (cancelled()) return;
        setSettings((current) => ({ ...current, inlineMode: "off" }));
        setView("empty");
        setStatusTone("warning");
        setStatusMessage("No definitions found");
        return;
      }

      setView("ready");
      setStatusTone(result.warnings.length ? "warning" : "success");
      setStatusMessage(
        options.isBrowserPreview
          ? `Browser preview · ${formatDefinitionCount(result.definitions.length)}`
          : `${formatDefinitionCount(result.definitions.length)} · Updated just now`,
      );

      if (canAnnotate && settings.inlineMode === "all") {
        try {
          const count = await applyAnnotationsToResult(result, "all");
          if (cancelled()) return;
          setInlineCount(count);
          setStatusMessage(
            `${formatDefinitionCount(result.definitions.length)} · ${formatHighlightCount(count)}`,
          );
        } catch (error) {
          setSettings((current) => ({ ...current, inlineMode: "off" }));
          setStatusTone("warning");
          setStatusMessage(
            `${formatDefinitionCount(result.definitions.length)} · ${formatAnnotationError(error)}`,
          );
        }
      } else {
        await clearInlineAnnotations();
        if (!canAnnotate && settings.inlineMode !== "off") {
          setSettings((current) => ({ ...current, inlineMode: "off" }));
        }
      }
    } catch {
      if (keepCurrentResults && scanRef.current?.definitions.length) {
        setView("ready");
        setStatusTone("warning");
        setStatusMessage("Showing current results · Refresh failed");
      } else {
        setView("error");
        setStatusTone("warning");
        setStatusMessage("Document scan failed");
        setErrorMessage(
          "We couldn’t read this document. Make sure a Word document is open and try again.",
        );
      }
    } finally {
      if (!cancelled()) setIsRefreshing(false);
    }
  }

  async function handleHighlightSelectedDefinition() {
    if (!scan || !selectedId || !selectedDefinition) return;

    setIsHighlighting(true);
    try {
      const count = await applyAnnotationsToResult(scan, "selected", selectedId);
      setSettings((current) => ({ ...current, inlineMode: "selected" }));
      setInlineCount(count);
      setStatusTone("success");
      setStatusMessage(`${formatHighlightCount(count)} for ${selectedDefinition.term}`);
    } catch (error) {
      setStatusTone("warning");
      setStatusMessage(formatAnnotationError(error));
    } finally {
      setIsHighlighting(false);
    }
  }

  async function handleHighlightAllDefinitions() {
    if (!scan) return;

    closeMenu();
    setIsHighlighting(true);
    try {
      const count = await applyAnnotationsToResult(scan, "all");
      setSettings((current) => ({ ...current, inlineMode: "all" }));
      setInlineCount(count);
      setStatusTone("success");
      setStatusMessage(
        `${formatDefinitionCount(scan.definitions.length)} · ${formatHighlightCount(count)}`,
      );
    } catch (error) {
      setStatusTone("warning");
      setStatusMessage(formatAnnotationError(error));
    } finally {
      setIsHighlighting(false);
    }
  }

  async function handleRemoveHighlights() {
    closeMenu();
    setIsHighlighting(true);
    try {
      await clearInlineAnnotations();
      setSettings((current) => ({ ...current, inlineMode: "off" }));
      setInlineCount(0);
      setStatusTone("success");
      setStatusMessage(
        scan
          ? `${formatDefinitionCount(scan.definitions.length)} · Annotations removed`
          : "Annotations removed",
      );
    } finally {
      setIsHighlighting(false);
    }
  }

  async function applyAnnotationsToResult(
    result: ScanResult,
    inlineMode: Exclude<InlineMode, "off">,
    definitionId?: string,
  ) {
    const visibleDefinitions =
      inlineMode === "all"
        ? result.definitions
        : result.definitions.filter((definition) => definition.id === definitionId);
    const visibleOccurrences =
      inlineMode === "all"
        ? result.occurrences
        : result.occurrences.filter((occurrence) => occurrence.definitionId === definitionId);

    return applyInlineAnnotations(
      visibleDefinitions,
      visibleOccurrences,
      (definitionId, occurrenceId) =>
        activateDefinition(definitionId, occurrenceId, true),
    );
  }

  function installScan(result: ScanResult) {
    scanRef.current = result;
    setScan(result);

    const currentSelection = selectedIdRef.current;
    const nextSelection =
      currentSelection && result.definitions.some((definition) => definition.id === currentSelection)
        ? currentSelection
        : undefined;
    updateSelectedId(nextSelection);
    setSelectedOccurrenceIndex(-1);
  }

  function activateDefinition(
    definitionId: string,
    occurrenceId?: string,
    scrollIntoView = false,
  ) {
    const currentScan = scanRef.current;
    const isSameDefinition = definitionId === selectedIdRef.current;
    updateSelectedId(definitionId);
    if (scrollIntoView) {
      setDefinitionScrollRequest((current) => current + 1);
    }

    const definitionOccurrences =
      currentScan?.occurrences.filter((occurrence) => occurrence.definitionId === definitionId) ?? [];
    const occurrenceIndex = occurrenceId
      ? definitionOccurrences.findIndex((occurrence) => occurrence.id === occurrenceId)
      : -1;
    if (occurrenceIndex >= 0) {
      setSelectedOccurrenceIndex(occurrenceIndex);
    } else if (!isSameDefinition) {
      setSelectedOccurrenceIndex(-1);
    }
  }

  function toggleDefinition(definitionId: string) {
    if (definitionId === selectedIdRef.current) {
      updateSelectedId(undefined);
      setSelectedOccurrenceIndex(-1);
      return;
    }

    activateDefinition(definitionId);
  }

  function togglePinnedDefinition(definitionId: string) {
    const isPinned = pinnedDefinitionIds.has(definitionId);
    setPinnedDefinitionIds((current) => {
      const next = new Set(current);
      if (next.has(definitionId)) {
        next.delete(definitionId);
      } else {
        next.add(definitionId);
      }
      return next;
    });

    if (!isPinned && definitionId === selectedIdRef.current) {
      updateSelectedId(undefined);
      setSelectedOccurrenceIndex(-1);
    }
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

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  function openInfo(nextView: InfoView) {
    closeMenu();
    setInfoView(nextView);
  }

  const canRefresh = view === "ready" || view === "empty" || view === "error";
  const highlightsActive = settings.inlineMode !== "off" && inlineCount > 0;
  const canToggleAllHighlights = Boolean(annotationsAvailable && scan?.definitions.length);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <h1>Contract Definitions</h1>
          <StatusLine message={statusMessage} tone={statusTone} loading={isRefreshing} />
        </div>

        <details className="app-menu" ref={menuRef}>
          <summary className="icon-button" aria-label="Open menu">
            <MoreHorizontal aria-hidden="true" size={19} />
          </summary>
          <div className="menu-popover">
            <button type="button" onClick={() => openInfo("about")}>
              <Info aria-hidden="true" size={16} />
              About Contract Definitions
            </button>
            <button type="button" onClick={() => openInfo("privacy")}>
              <ShieldCheck aria-hidden="true" size={16} />
              Privacy
            </button>
            <a href={FEEDBACK_URL} onClick={closeMenu}>
              <MessageSquare aria-hidden="true" size={16} />
              Send feedback
            </a>
            <a href={CUSTOM_SOLUTIONS_URL} target="_blank" rel="noreferrer" onClick={closeMenu}>
              <ExternalLink aria-hidden="true" size={16} />
              GUT Ventures - Custom Legal Tech solutions
            </a>
          </div>
        </details>
      </header>

      {canRefresh ? (
        <section className="app-actions" aria-label="Document actions">
          <button
            className="app-action-button refresh-action"
            type="button"
            disabled={isRefreshing}
            onClick={() =>
              void runScan({
                background: Boolean(scanRef.current?.definitions.length),
                canAnnotate: annotationsAvailable,
              })
            }
          >
            <RefreshCw aria-hidden="true" size={15} />
            <span>Refresh</span>
          </button>

          {canToggleAllHighlights ? (
            <button
              className={`app-action-button highlight-action${highlightsActive ? " active" : ""}`}
              type="button"
              aria-pressed={highlightsActive}
              title={highlightsActive ? "Remove annotations" : "Annotate all defined terms"}
              disabled={isHighlighting}
              onClick={() =>
                void (highlightsActive
                  ? handleRemoveHighlights()
                  : handleHighlightAllDefinitions())
              }
            >
              <Highlighter aria-hidden="true" size={15} />
              <span>{highlightsActive ? "Remove annotations" : "Annotate all defined terms"}</span>
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="app-content">
        {view === "initializing" || view === "scanning" ? (
          <LoadingState />
        ) : view === "ready" && scan ? (
          <section className="result-view">
            {scan.warnings.filter((warning) => !warning.startsWith("No definitions")).length ? (
              <section className="warning-list" aria-label="Scan notices">
                {scan.warnings
                  .filter((warning) => !warning.startsWith("No definitions"))
                  .map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
              </section>
            ) : null}

            <section className="definition-layout">
              <div className="list-heading">
                <h2>Definitions</h2>
                <span>{scan.definitions.length}</span>
              </div>
              <section className="search-row" aria-label="Search definitions">
                <Search aria-hidden="true" size={16} />
                <input
                  type="search"
                  aria-label="Search definitions"
                  placeholder="Search definitions…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </section>
              <DefinitionList
                definitions={filteredDefinitions}
                occurrenceCountByDefinition={occurrenceCountByDefinition}
                selectedId={selectedId}
                selectedDefinition={selectedDefinition}
                activeOccurrences={activeOccurrences}
                selectedOccurrenceIndex={selectedOccurrenceIndex}
                pinnedDefinitionIds={pinnedDefinitionIds}
                scrollRequest={definitionScrollRequest}
                annotationsAvailable={annotationsAvailable}
                isHighlighting={isHighlighting}
                query={query}
                onClearQuery={() => setQuery("")}
                onToggle={toggleDefinition}
                onTogglePin={togglePinnedDefinition}
                onJumpDefinition={() => void handleDefinitionJump()}
                onHighlightDefinition={() => void handleHighlightSelectedDefinition()}
                onCurrentOccurrence={() => void handleOccurrenceJump(selectedOccurrenceIndex)}
                onPreviousOccurrence={() => void handleOccurrenceJump(selectedOccurrenceIndex - 1)}
                onNextOccurrence={() => void handleOccurrenceJump(selectedOccurrenceIndex + 1)}
              />
            </section>
          </section>
        ) : view === "empty" ? (
          <MessageState
            icon={<Search aria-hidden="true" size={24} />}
            title="No definitions found"
            description="We couldn’t find a standard definitions section in this document."
            actionLabel="Scan again"
            onAction={() => void runScan({ canAnnotate: annotationsAvailable })}
            secondary={
              <a href={FEEDBACK_URL}>
                Is your contract structured differently? Send feedback
                <ExternalLink aria-hidden="true" size={14} />
              </a>
            }
          />
        ) : view === "error" ? (
          <MessageState
            icon={<AlertCircle aria-hidden="true" size={24} />}
            title="We couldn’t read this document"
            description={
              errorMessage || "Make sure a Word document is open and try again."
            }
            actionLabel="Try again"
            onAction={() => void runScan({ canAnnotate: annotationsAvailable })}
          />
        ) : (
          <MessageState
            icon={<AlertCircle aria-hidden="true" size={24} />}
            title="Open this add-in in Microsoft Word"
            description={
              errorMessage || "A Word document is required before it can be analyzed."
            }
          />
        )}
      </section>

        <footer className="app-footer">
          <a href={GUT_VENTURES_URL} target="_blank" rel="noreferrer">
            {"Built by "}
            <span className="footer-brand">GUT Ventures</span>
            {" · Legal Tech"}
            <ExternalLink aria-hidden="true" size={12} />
          </a>
        </footer>

      {infoView ? <InfoDialog view={infoView} onClose={() => setInfoView(undefined)} /> : null}
    </main>
  );
}

function LoadingState() {
  return (
    <section className="loading-state" aria-live="polite">
      <Loader2 className="spin" aria-hidden="true" size={26} />
      <div>
        <h2>Scanning this document locally…</h2>
        <p>Your document never leaves Word.</p>
      </div>
      <div className="privacy-assurance" aria-label="Privacy assurances">
        <span>No uploads</span>
        <span>No AI</span>
      </div>
    </section>
  );
}

function StatusLine({
  message,
  tone,
  loading,
}: {
  message: string;
  tone: StatusTone;
  loading: boolean;
}) {
  return (
    <p className={`status-line ${tone}`}>
      {loading ? (
        <Loader2 className="spin" aria-hidden="true" size={13} />
      ) : tone === "warning" ? (
        <AlertCircle aria-hidden="true" size={13} />
      ) : tone === "success" ? (
        <CheckCircle2 aria-hidden="true" size={13} />
      ) : null}
      <span>{message}</span>
    </p>
  );
}

function DefinitionList({
  definitions,
  occurrenceCountByDefinition,
  selectedId,
  selectedDefinition,
  activeOccurrences,
  selectedOccurrenceIndex,
  pinnedDefinitionIds,
  scrollRequest,
  annotationsAvailable,
  isHighlighting,
  query,
  onClearQuery,
  onToggle,
  onTogglePin,
  onJumpDefinition,
  onHighlightDefinition,
  onCurrentOccurrence,
  onPreviousOccurrence,
  onNextOccurrence,
}: {
  definitions: DefinitionEntry[];
  occurrenceCountByDefinition: Map<string, number>;
  selectedId?: string;
  selectedDefinition?: DefinitionEntry;
  activeOccurrences: Occurrence[];
  selectedOccurrenceIndex: number;
  pinnedDefinitionIds: Set<string>;
  scrollRequest: number;
  annotationsAvailable: boolean;
  isHighlighting: boolean;
  query: string;
  onClearQuery: () => void;
  onToggle: (id: string) => void;
  onTogglePin: (id: string) => void;
  onJumpDefinition: () => void;
  onHighlightDefinition: () => void;
  onCurrentOccurrence: () => void;
  onPreviousOccurrence: () => void;
  onNextOccurrence: () => void;
}) {
  const selectedRowRef = useRef<HTMLDivElement>(null);
  const handledScrollRequestRef = useRef(0);
  const [pinnedSectionExpanded, setPinnedSectionExpanded] = useState(true);
  const [scrollSpacerDefinitionId, setScrollSpacerDefinitionId] = useState<string>();
  const pinnedDefinitions = definitions.filter((definition) =>
    pinnedDefinitionIds.has(definition.id),
  );
  const regularDefinitions = definitions.filter(
    (definition) => !pinnedDefinitionIds.has(definition.id),
  );
  const selectedIsPinned = Boolean(selectedId && pinnedDefinitionIds.has(selectedId));

  useEffect(() => {
    if (scrollRequest === handledScrollRequestRef.current) return;
    if (!selectedId) {
      handledScrollRequestRef.current = scrollRequest;
      return;
    }
    if (selectedIsPinned && !pinnedSectionExpanded) {
      setPinnedSectionExpanded(true);
      return;
    }
    if (!selectedIsPinned && scrollSpacerDefinitionId !== selectedId) {
      setScrollSpacerDefinitionId(selectedId);
      return;
    }

    selectedRowRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    handledScrollRequestRef.current = scrollRequest;
  }, [
    pinnedSectionExpanded,
    scrollRequest,
    scrollSpacerDefinitionId,
    selectedId,
    selectedIsPinned,
  ]);

  const regularScrollSpacerActive = Boolean(
    selectedId &&
      !selectedIsPinned &&
      scrollSpacerDefinitionId === selectedId,
  );

  function releaseScrollSpacer() {
    setScrollSpacerDefinitionId(undefined);
  }

  if (!definitions.length) {
    return (
      <div className="search-empty-state">
        <p>No definitions match “{query.trim()}”.</p>
        <button type="button" onClick={onClearQuery}>
          Clear search
        </button>
      </div>
    );
  }

  function renderDefinition(definition: DefinitionEntry) {
    const count = occurrenceCountByDefinition.get(definition.id) ?? 0;
    const isExpanded = definition.id === selectedId;
    const isPinned = pinnedDefinitionIds.has(definition.id);
    const detailId = `definition-details-${definition.id}`;
    const triggerId = `definition-trigger-${definition.id}`;

    return (
      <div
        className={isExpanded ? "definition-item expanded" : "definition-item"}
        key={definition.id}
      >
        <div
          className={isExpanded ? "definition-row selected" : "definition-row"}
          ref={isExpanded ? selectedRowRef : undefined}
          onClick={() => onToggle(definition.id)}
        >
          <button
            className="definition-toggle"
            type="button"
            id={triggerId}
            aria-controls={detailId}
            aria-expanded={isExpanded}
            aria-label={`${definition.term}, ${formatUseCount(count)}`}
          >
            <span className="definition-term">{definition.term}</span>
          </button>
          <button
            className={isPinned ? "definition-pin pinned" : "definition-pin"}
            type="button"
            aria-label={`${isPinned ? "Unpin" : "Pin"} ${definition.term}`}
            aria-pressed={isPinned}
            title={isPinned ? "Unpin definition" : "Pin definition"}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(definition.id);
            }}
          >
            <Pin aria-hidden="true" size={14} />
          </button>
          <span className="definition-meta">{formatUseCount(count)}</span>
        </div>

        {isExpanded && selectedDefinition?.id === definition.id ? (
          <DefinitionDetails
            id={detailId}
            labelledBy={triggerId}
            definition={selectedDefinition}
            activeOccurrences={activeOccurrences}
            selectedOccurrenceIndex={selectedOccurrenceIndex}
            annotationsAvailable={annotationsAvailable}
            isHighlighting={isHighlighting}
            onJumpDefinition={onJumpDefinition}
            onHighlightDefinition={onHighlightDefinition}
            onCurrentOccurrence={onCurrentOccurrence}
            onPreviousOccurrence={onPreviousOccurrence}
            onNextOccurrence={onNextOccurrence}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="definition-lists">
      {pinnedDefinitions.length ? (
        <section className="pinned-section" aria-label="Pinned definitions">
          <button
            className="pinned-section-toggle"
            type="button"
            aria-controls="pinned-definitions"
            aria-expanded={pinnedSectionExpanded}
            onClick={() => setPinnedSectionExpanded((current) => !current)}
          >
            <span className="pinned-section-title">
              <Pin aria-hidden="true" size={13} />
              Pinned
            </span>
            <span className="pinned-section-meta">
              {pinnedDefinitions.length}
              <ChevronDown className="pinned-section-chevron" aria-hidden="true" size={15} />
            </span>
          </button>
          {pinnedSectionExpanded ? (
            <nav
              className={
                selectedIsPinned
                  ? "pinned-definition-list has-selection"
                  : "pinned-definition-list"
              }
              id="pinned-definitions"
              aria-label="Pinned definitions"
            >
              {pinnedDefinitions.map(renderDefinition)}
            </nav>
          ) : null}
        </section>
      ) : null}

      {regularDefinitions.length ? (
        <nav
          className={
            regularScrollSpacerActive
              ? "definition-list has-scroll-spacer"
              : "definition-list"
          }
          aria-label="Definitions"
          onWheel={releaseScrollSpacer}
          onTouchStart={releaseScrollSpacer}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) releaseScrollSpacer();
          }}
          onKeyDown={(event) => {
            if (
              ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "End", "Home"].includes(event.key)
            ) {
              releaseScrollSpacer();
            }
          }}
        >
          {regularDefinitions.map(renderDefinition)}
        </nav>
      ) : (
        <div className="search-empty-state">
          <p>
            {query.trim()
              ? `No other definitions match “${query.trim()}”.`
              : "All definitions are pinned."}
          </p>
          {query.trim() ? (
            <button type="button" onClick={onClearQuery}>
              Clear search
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DefinitionDetails({
  id,
  labelledBy,
  definition,
  activeOccurrences,
  selectedOccurrenceIndex,
  annotationsAvailable,
  isHighlighting,
  onJumpDefinition,
  onHighlightDefinition,
  onCurrentOccurrence,
  onPreviousOccurrence,
  onNextOccurrence,
}: {
  id: string;
  labelledBy: string;
  definition?: DefinitionEntry;
  activeOccurrences: Occurrence[];
  selectedOccurrenceIndex: number;
  annotationsAvailable: boolean;
  isHighlighting: boolean;
  onJumpDefinition: () => void;
  onHighlightDefinition: () => void;
  onCurrentOccurrence: () => void;
  onPreviousOccurrence: () => void;
  onNextOccurrence: () => void;
}) {
  if (!definition) return null;

  const selectedOccurrence = activeOccurrences[Math.max(selectedOccurrenceIndex, 0)];

  return (
    <article className="definition-detail" id={id} aria-labelledby={labelledBy}>
      <p className="definition-copy">{definition.definition}</p>

      <div className="detail-actions">
        <button className="action-button" type="button" onClick={onJumpDefinition}>
          <ArrowUpRight aria-hidden="true" size={16} />
          Go to definition
        </button>
        {annotationsAvailable && activeOccurrences.length ? (
          <button
            className="action-button"
            type="button"
            disabled={isHighlighting}
            onClick={onHighlightDefinition}
          >
            {isHighlighting ? (
              <Loader2 className="spin" aria-hidden="true" size={16} />
            ) : (
              <Highlighter aria-hidden="true" size={16} />
            )}
            Annotate this term
          </button>
        ) : null}
      </div>

      {activeOccurrences.length ? (
        <>
          <div
            className={`occurrence-nav ${activeOccurrences.length === 1 ? "single" : "multiple"}`}
            aria-label="Uses in this document"
          >
            {activeOccurrences.length === 1 ? (
              <button className="occurrence-single" type="button" onClick={onCurrentOccurrence}>
                <ArrowUpRight aria-hidden="true" size={15} />
                Go to use
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onPreviousOccurrence}
                  disabled={selectedOccurrenceIndex <= 0}
                >
                  <ChevronLeft aria-hidden="true" size={15} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={onNextOccurrence}
                  disabled={selectedOccurrenceIndex >= activeOccurrences.length - 1}
                >
                  <span>Next</span>
                  <ChevronRight aria-hidden="true" size={15} />
                </button>
              </>
            )}
          </div>
          {selectedOccurrence ? <OccurrenceContext occurrence={selectedOccurrence} /> : null}
        </>
      ) : (
        <p className="no-occurrences">This term is not used elsewhere in the document.</p>
      )}
    </article>
  );
}

function MessageState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondary,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondary?: React.ReactNode;
}) {
  return (
    <section className="message-state">
      <span className="message-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button className="message-action" type="button" onClick={onAction}>
          <RefreshCw aria-hidden="true" size={16} />
          {actionLabel}
        </button>
      ) : null}
      {secondary ? <div className="message-secondary">{secondary}</div> : null}
    </section>
  );
}

function InfoDialog({ view, onClose }: { view: InfoView; onClose: () => void }) {
  const isPrivacy = view === "privacy";
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" size={18} />
        </button>
        <span className="modal-icon">
          {isPrivacy ? <ShieldCheck aria-hidden="true" size={22} /> : <Info aria-hidden="true" size={22} />}
        </span>
        <h2 id="info-dialog-title">{isPrivacy ? "Privacy" : "About Contract Definitions"}</h2>
        {isPrivacy ? (
          <>
            <p>
              Contract text is analyzed locally inside the Word add-in. It is not uploaded to an
              application server and is not sent to an AI service.
            </p>
            <p>
              Contract text and scan results stay in memory only while the taskpane is open. Local
              browser storage is used only for non-document preferences such as the highlighting
              mode.
            </p>
          </>
        ) : (
          <>
            <p>
              Contract Definitions is a free, local-first Word add-in that makes defined terms easy
              to find, review and navigate.
            </p>
            <p>
              Built by GUT Ventures, a Vienna-based software company creating AI-enabled Legal Tech
              products and custom solutions for contract, due diligence, KYC and legal workflows —
              backed by more than a decade of Legal Tech experience.
            </p>
          </>
        )}
        {!isPrivacy ? (
          <div className="modal-links">
            <a className="primary" href={GUT_VENTURES_URL} target="_blank" rel="noreferrer">
              Explore GUT Ventures
              <ExternalLink aria-hidden="true" size={14} />
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Github aria-hidden="true" size={14} />
              GitHub
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
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

function formatDefinitionCount(count: number) {
  return `${count} ${count === 1 ? "definition" : "definitions"} found`;
}

function formatUseCount(count: number) {
  return `${count} ${count === 1 ? "use" : "uses"}`;
}

function formatHighlightCount(count: number) {
  return `${count} ${count === 1 ? "annotation" : "annotations"} active`;
}

function formatAnnotationError(error: unknown) {
  if (error instanceof AnnotationUnavailableError) {
    return error.message;
  }
  return "Word couldn't display annotations. Try again.";
}

function getOccurrenceIndexInParagraph(occurrence: Occurrence, activeOccurrences: Occurrence[]): number {
  const searchText = occurrence.contextHit || occurrence.term;

  return activeOccurrences.filter(
    (item) =>
      item.paragraphIndex === occurrence.paragraphIndex &&
      item.paragraphId === occurrence.paragraphId &&
      (item.contextHit || item.term) === searchText &&
      item.start < occurrence.start,
  ).length;
}
