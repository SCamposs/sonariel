import { systemMessage } from "./i18n/system-message";
import i18n, { tr, formatDate, formatNumber } from "./i18n";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AudioSlider } from "./ui/audio-slider";
import { SelectControl } from "./ui/select-control";
import { SidePanel } from "./ui/side-panel";
import { WorkflowGuide } from "./ui/workflow-guide";
import { LanguageSettings, useLocaleProfile } from "./ui/language-settings";
import { UpdateControl } from "./ui/update-control";
import { PathField } from "./ui/path-field";
import { HelpTip, StatusBadge, Requirements } from "./ui/help-tip";
import { StorageWorkspace } from "./storage";
import { BatchExport } from "./batch-export";
import { MusicPresets } from "./music-presets";
import { LibraryTools, emptyFilters, filterLibrary, loopSeams, useLibraryFilters } from "./library-workspace";
import { WorkflowPaths } from "./workflow-paths";
import { jobRecoveryKey } from "./workflow-state";
import { AudioRegion } from "./audio-region";
import { useWorkspaceScroll } from "./ui/use-workspace-scroll";
import { FxStudio, VoiceStudio, MusicEngines } from "./studio";
import { RetainedWorkspace } from "./ui/retained-workspace";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  AudioLines,
  Check,
  ChevronRight,
  Clock3,
  Cpu,
  Disc3,
  Folder,
  Headphones,
  Link2,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Square,
  Star,
  Terminal,
  Volume2,
  X,
} from "lucide-react";
import {
  formatTime,
  rpc,
  secondsSince,
  stateLabel,
  type Asset,
  type Job,
  type Snapshot,
} from "./api";

type Page =
  | "projects"
  | "queue"
  | "library"
  | "voice"
  | "fx"
  | "storage"
  | "environment"
  | "bridges";
const getPages = (): {
  id: Page;
  name: string;
  icon: typeof Folder;
  caption: string;
}[] => [
  {
    id: "projects",
    name: tr("workspace", "projectsSessions"),
    icon: Folder,
    caption: tr("workspace", "yourProductionWorkspace"),
  },
  {
    id: "queue",
    name: tr("workspace", "generationQueue"),
    icon: Activity,
    caption: tr("workspace", "executionMonitoring"),
  },
  {
    id: "library",
    name: tr("workspace", "libraryVersions"),
    icon: AudioLines,
    caption: tr("workspace", "listenCompareDecide"),
  },
  {
    id: "voice",
    name: tr("workspace", "voiceStudio"),
    icon: Headphones,
    caption: tr("workspace", "profilesPerformanceVersions"),
  },
  {
    id: "fx",
    name: tr("workspace", "fxProcessing"),
    icon: Settings2,
    caption: tr("workspace", "nativeChainsNonDestructiveRendering"),
  },
  {
    id: "storage",
    name: tr("workspace", "storage"),
    icon: Disc3,
    caption: tr("workspace", "inventoryRecoverableDiscard"),
  },
  {
    id: "environment",
    name: tr("workspace", "environment"),
    icon: Cpu,
    caption: tr("workspace", "setupDiagnostics"),
  },
  {
    id: "bridges",
    name: tr("workspace", "audacityCodex"),
    icon: Link2,
    caption: tr("workspace", "workflowBridges"),
  },
];
const date = formatDate;

function Badge({
  children,
  tone = "",
  help,
}: {
  children: ReactNode;
  tone?: string;
  help?: string;
}) {
  useTranslation();
  return (
    <StatusBadge tone={tone} help={help}>{children}</StatusBadge>
  );
}
function Panel({
  title,
  children,
  aside,
  className = "",
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  useTranslation();
  return (
    <section className={`panel ${className}`}>
      <header className="panel-title">
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
function Waveform({
  asset,
  position = 0,
  onSeek,
}: {
  asset: Asset;
  position?: number;
  onSeek?: (ratio: number) => void;
}) {
  useTranslation();
  return (
    <div
      className="waveform"
      role={onSeek ? "slider" : "img"}
      aria-label={tr("workspace", "waveformForValue", { value0: asset.name })}
      aria-valuenow={onSeek ? Math.round(position * 100) : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onSeek?.(Math.min(1, position + 0.05));
        if (event.key === "ArrowLeft") onSeek?.(Math.max(0, position - 0.05));
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        onSeek?.((event.clientX - bounds.left) / bounds.width);
      }}
    >
      {asset.metadata.waveform?.map((peak, index, all) => (
        <i
          key={index}
          className={index / all.length < position ? "heard" : ""}
          style={{ height: `${Math.max(3, Math.sqrt(peak) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function App() {
  useTranslation();
  const pages = getPages();
  const [page, setPage] = useState<Page>("projects");
  const [data, setData] = useState<Snapshot>();
  const locale = useLocaleProfile(data ? (data.ui_preferences ?? { locale: "pt-BR", existing_installation: true }) : undefined);
  const workspaceScroll = useWorkspaceScroll(`${data?.selected_project ?? ""}:${page}`);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [preparation, setPreparation] = useState<"link" | "install" | "other">();
  const [recommendedAudio, setRecommendedAudio] = useState<boolean>();
  useEffect(() => { if (page !== "environment") setRecommendedAudio(undefined); }, [page]);
  const refreshInFlight = useRef(0);
  const library = useLibraryFilters(data);
  const query = library.filters.query;
  const favorites = library.filters.favorite;
  const [regionAssetId, setRegionAssetId] = useState("");
  const advancedLibrary = useRef<HTMLDetailsElement>(null);
  const [importSessionId, setImportSessionId] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(50);
  useEffect(() => setVisibleLimit(50), [data?.selected_project, library.filters]);
  const [playRange, setPlayRange] = useState<{ assetId: string; start: number; end: number }>();
  const [activeId, setActiveId] = useState<string>();
  const [fxAssetId, setFxAssetId] = useState<string>();
  const [navigationTarget, setNavigationTarget] = useState<{ projectId: string; assetId?: string; sessionId?: string; action: "library" | "listen" }>();
  const navigationSerial = useRef(0);
  const [focusedAssetId, setFocusedAssetId] = useState<string>();
  const [compare, setCompare] = useState<string[]>([]);
  const [exportSelection, setExportSelection] = useState<string[]>([]);
  useEffect(() => { setExportSelection([]); setCompare([]); setRegionAssetId(""); setImportSessionId(""); }, [data?.selected_project]);
  const [connection, setConnection] = useState<{
    url: string;
    token: string;
  }>();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [detail, setDetail] = useState<Asset>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [codexPhase, setCodexPhase] = useState<"idle" | "working" | "done" | "error">("idle");
  const detailReturnFocus = useRef<HTMLElement | null>(null);
  const [notes, setNotes] = useState("");
  const [projectForm, setProjectForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [context, setContext] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [root, setRoot] = useState("");
  const [audacityPath, setAudacityPath] = useState("");
  const [destination, setDestination] = useState("");
  const [detected, setDetected] = useState<{ root: string }[]>([]);
  const [setupPlan, setSetupPlan] = useState<Record<string, unknown>>();
  const [registerPath, setRegisterPath] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerType, setRegisterType] = useState("result");
  const [showRegister, setShowRegister] = useState(false);
  const [lastEdit, setLastEdit] = useState<string>();
  const audio = useRef<HTMLAudioElement>(null);

  const refresh = async () => {
    refreshInFlight.current += 1;
    setRefreshing(true);
    try {
      const state = await rpc<Snapshot>("snapshot");
      setData(state);
    } catch (e) {
      setError(String(e));
    } finally {
      refreshInFlight.current -= 1;
      setRefreshing(refreshInFlight.current > 0);
    }
  };
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const state = await rpc<Snapshot>("snapshot");
        if (!disposed) setData(state);
      } catch (e) {
        if (!disposed) setError(String(e));
      }
      if (!disposed) timer = setTimeout(poll, 2500);
    };
    void poll();
    void rpc<{ url: string; token: string }>("__connection")
      .then((value) => {
        if (!disposed) setConnection(value);
      })
      .catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, []);
  const act = async (
    method: string,
    args: Record<string, unknown> = {},
    message = "",
  ) => {
    setBusy(true);
    setError("");
    try {
      const value = await rpc(method, args);
      await refresh();
      if (message) setNotice(message);
      return value;
    } catch (e) {
      setError(String(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  const project = data?.projects.find((p) => p.id === data.selected_project);
  const configureCodex = async () => {
    if (busy || codexPhase === "working") return;
    setCodexPhase("working");
    const result = await act("codex_register");
    setCodexPhase(result ? "done" : "error");
  };
  const allAudio = [...(data?.assets ?? []), ...(data?.references ?? [])];
  const projectAudio = allAudio.filter(a => a.project_id === project?.id && a.kind !== "preview");
  const assets = filterLibrary(projectAudio.filter(a => library.filters.kind === "reference" || a.kind !== "reference"), library.filters);
  const regionSource = projectAudio.find(a => a.id === regionAssetId);
  const active = allAudio.find((a) => a.id === activeId);
  const navigateLibrary = async (target: NonNullable<typeof navigationTarget>) => {
    if (!data?.projects.some(p => p.id === target.projectId)) return;
    const serial = ++navigationSerial.current;
    if (data.selected_project !== target.projectId) {
      const changed = await act("project_select", { project_id: target.projectId });
      if (!changed || serial !== navigationSerial.current) return;
    }
    setNavigationTarget(target);
  };
  useEffect(() => {
    if (!navigationTarget || !data) return;
    const target = navigationTarget;
    setNavigationTarget(undefined);
    if (data.selected_project !== target.projectId) return;
    const asset = target.assetId ? allAudio.find(a => a.id === target.assetId && a.project_id === target.projectId) : undefined;
    if (target.assetId && !asset) { setNotice(tr("workspace", "navigationAssetMissing")); return; }
    if (target.sessionId && !data.sessions.some(s => s.id === target.sessionId && s.project_id === target.projectId)) return;
    if (target.action === "listen" && asset) { selectAudio(asset); setPlayRange(undefined); setPlaying(true); return; }
    library.update(asset ? { ...emptyFilters, kind: asset.kind === "reference" ? "reference" : null } : { ...library.filters, session_id: target.sessionId ?? null });
    setFocusedAssetId(asset?.id);
    setPage("library");
    if (asset) setNotice(tr("workspace", "openedVersionByIdentity", { name: asset.name }));
  }, [navigationTarget, data?.selected_project]);
  useEffect(() => {
    if (!focusedAssetId || page !== "library") return;
    const index = assets.findIndex(a => a.id === focusedAssetId);
    if (index < 0) { setFocusedAssetId(undefined); return; }
    if (visibleLimit <= index) { setVisibleLimit(Math.ceil((index + 1) / 50) * 50); return; }
    const node = [...document.querySelectorAll<HTMLElement>("[data-asset-id]")].find(n => n.dataset.assetId === focusedAssetId);
    node?.scrollIntoView?.({ block: "nearest" });
    node?.focus({ preventScroll: true });
    setFocusedAssetId(undefined);
  }, [focusedAssetId, page, visibleLimit, assets.length, library.filters]);
  const sendToFx = (asset: Asset) => {
    if (asset.project_id !== data?.selected_project || !allAudio.some(a => a.id === asset.id && a.project_id === asset.project_id)) return;
    setFxAssetId(asset.id);
    setPage("fx");
  };
  const activeJob = data?.jobs.find((j) =>
    ["loading", "generating", "submitted"].includes(j.state),
  );
  const queued = data?.jobs.filter((j) => j.state === "queued") ?? [];
  const chosen = data?.assets.find(
    (a) => a.selected && a.project_id === project?.id,
  );
  const selectAudio = (asset: Asset) => {
    setPlayRange(undefined);
    if (asset.id !== activeId) {
      setPlaying(false);
      setPosition(0);
      setActiveId(asset.id);
    }
  };
  const previewRegion = (asset: Asset, start: number, end: number) => {
    setPlayRange({ assetId: asset.id, start, end });
    setActiveId(asset.id);
    setPosition(start);
    if (asset.id === activeId && audio.current) audio.current.currentTime = start;
    setPlaying(true);
  };
  const openDetail = (asset: Asset) => {
    detailReturnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDetail(asset);
    setNotes(asset.notes);
    setDetailOpen(true);
  };
  const toggleCompare = (id: string) =>
    setCompare((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current.slice(-1), id],
    );
  const source =
    active && connection
      ? `${connection.url}/audio/${active.id}?token=${encodeURIComponent(connection.token)}`
      : undefined;
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    if (playing) {
      void element.play().catch((e) => {
        setPlaying(false);
        setError(tr("workspace", "playback") + String(e));
      });
    } else element.pause();
  }, [playing, source]);
  const sendToAudacity = async (asset: Asset) => {
    const value = (await act(
      "audacity_import",
      { asset_id: asset.id },
      tr("workspace", "resultImportedIntoANewAudacityProject"),
    )) as { edit_id?: string } | undefined;
    if (value?.edit_id) setLastEdit(value.edit_id);
  };
  const selectedEdit =
    data?.edits.find((e) => e.id === lastEdit) ??
    data?.edits.find((e) => e.asset_id === activeId);
  const currentPage = pages.find((p) => p.id === page)!;

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand">
          <div className="signal-mark">
            <i />
            <i />
            <i />
          </div>
          <span>
            sonariel<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="product-meta">
          {tr("workspace", "localAudioWorkspace")}{" "}
          <UpdateControl
            workflowBusy={Boolean(
              data?.jobs.some((job) =>
                ["queued", "loading", "submitted", "generating"].includes(
                  job.state,
                ),
              ) || data?.setup?.state === "running",
            )}
          />
        </div>
        <div className="rail-label">{tr("workspace", "workspace")}</div>
        <nav>
          {pages.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "nav-item active" : "nav-item"}
              onClick={() => setPage(id)}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{name}</span>
              {id === "queue" && queued.length > 0 && <b>{queued.length}</b>}
            </button>
          ))}
        </nav>
        <div className="rail-project">
          <span>{tr("workspace", "activeProject")}</span>
          <SelectControl
            label={tr("workspace", "activeProject2")}
            value={project?.id ?? ""}
            disabled={busy}
            onChange={(value) =>
              void act("project_select", { project_id: value })
            }
            placeholder={tr("workspace", "selectAProject")}
            options={
              data?.projects.map((p) => ({ value: p.id, label: p.name })) ?? []
            }
          />
          <small>
            {project
              ? tr("workspace", "valueLocalResults", { value0: project.result_count })
              : tr("workspace", "createYourFirstProject")}
          </small>
        </div>
        <div className="rail-bottom">
          <Badge tone={connection ? "ok" : ""}>
            {connection ? tr("workspace", "localCore") : tr("workspace", "connectingToCore")}
          </Badge>
          <p>
            {tr("workspace", "directionInCodex")}<br />
            {tr("workspace", "productionUnderYourControl")}</p>
          {locale.ready && <LanguageSettings required={locale.pending} onConfirmed={locale.confirmed}
            existing={data?.ui_preferences?.existing_installation ?? true} />}
          <WorkflowGuide ready={Boolean(data) && locale.ready && !locale.pending} />
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            {tr("workspace", "workspace2")}{" "}<ChevronRight size={12} />
            <strong>{project?.name ?? "Sonariel"}</strong>
          </div>
          <div className="top-signals">
            <span className="mono">
              <i className="dot" />{" "}
              {page === "voice"
                ? "V3 · CPU"
                : page === "fx"
                  ? tr("workspace", "dspNative")
                  : page === "queue" ? tr("production", "sharedQueue")
                  : tr("workspace", "localAudioWorkspace")}
            </span>
            <span className="mono">
              RAM {formatNumber(data?.telemetry.available_gib, 1) ?? "—"}{" "}
              <small>{tr("workspace", "gibAvailable")}</small>
            </span>
            <Badge tone={data?.codex.tested ? "ok" : ""} help={tr("experience", "page_bridges")}>
              MCP{" "}
              {data?.codex.tested
                ? tr("workspace", "handshakeRecorded")
                : data?.codex.configured
                  ? tr("workspace", "configured")
                  : tr("workspace", "notConfigured")}
            </Badge>
          </div>
        </header>
        <main ref={workspaceScroll.ref} onScroll={workspaceScroll.onScroll}>
          <div className="page-heading">
            <div>
              <p className="section-caption">{currentPage.caption}</p>
              <div className="page-title-row"><h1>{currentPage.name}</h1>
                <HelpTip label={tr("experience", "pageHelpLabel", { name: currentPage.name })}>{tr("experience", `page_${page}`)}</HelpTip>
              </div>
            </div>
            <div className="heading-actions">
              <button
                className="icon-button"
                title={tr("workspace", "refreshState")}
                aria-label={tr("workspace", "refreshState")}
                aria-busy={refreshing}
                disabled={refreshing}
                onClick={() => void refresh()}
              >
                <RefreshCw size={17} className={refreshing ? "spin" : undefined} />
              </button>
              {page === "projects" && (
                <button
                  className="primary"
                  onClick={() => {
                    setProjectForm(!projectForm);
                  }}
                >
                  <Plus size={16} /> {tr("workspace", "newProject")}</button>
              )}
              {page === "library" && (
                <button
                  className={showRegister ? "outline" : "primary"}
                  aria-expanded={showRegister}
                  onClick={() => setShowRegister(!showRegister)}
                >
                  <Plus size={16} /> {tr("experience", showRegister ? "cancelImport" : "beginImport")}</button>
              )}
            </div>
          </div>
          {error && (
            <div className="message error" role="alert">
              <span>{systemMessage(error)}</span>
              <button
                className="icon-button"
                aria-label={tr("workspace", "dismissError")}
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="message" role="status">
              <span>{systemMessage(notice)}</span>
              <button
                className="icon-button"
                aria-label={tr("workspace", "dismissNotification")}
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading-state">
              <Loader2 className="spin" /> {tr("workspace", "connectingToTheLocalCore")}</div>
          ) : (
            <>
              {page === "storage" && <StorageWorkspace data={data} act={act} busy={busy} />}
              <RetainedWorkspace key={`voice:${data.selected_project}`} active={page === "voice"}>
                <VoiceStudio
                  key={data.selected_project}
                  data={data}
                  busy={busy}
                  act={act}
                  listen={(asset) => {
                    selectAudio(asset);
                    setPlaying(true);
                  }}
                  edit={(asset) => void sendToAudacity(asset)}
                  openFx={sendToFx}
                  openProjects={() => { setPage("projects"); }}
                  openConnection={() => setPage("bridges")}
                />
              </RetainedWorkspace>
              <RetainedWorkspace key={`fx:${data.selected_project}`} active={page === "fx"}>
                <FxStudio
                  data={data}
                  busy={busy}
                  act={act}
                  initialAssetId={fxAssetId}
                  importAudio={() => { if (project) { setPage("library"); setShowRegister(true); } else setPage("projects"); }}
                  listen={(asset) => {
                    selectAudio(asset);
                    setPlaying(true);
                  }}
                  edit={(asset) => void sendToAudacity(asset)}
                />
              </RetainedWorkspace>
              {page === "projects" && (
                <>
                  <WorkflowPaths data={data}
                    createProject={() => setProjectForm(true)}
                    prepareMusic={(audioInput = false) => { setRecommendedAudio(audioInput); setPreparation("other"); setPage("environment"); }}
                    music={() => setPage(data.engines?.some(e => e.category === "music" && e.installed && e.compatible && !e.blocked_reason) ? "bridges" : "environment")}
                    voice={() => setPage("voice")}
                    audio={() => { if (!project) { setProjectForm(true); setNotice(tr("workspace", "chooseProjectForAudio")); } else { setPage("library"); setShowRegister(true); } }} />
                  {projectForm && (
                    <Panel title={tr("workspace", "newProject")}>
                      <form
                        className="form-grid"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void act(
                            "project_create",
                            { name: projectName, context },
                            tr("workspace", "projectCreated"),
                          ).then((value) => {
                            if (value) { setProjectForm(false); setProjectName(""); setContext(""); }
                          });
                        }}
                      >
                        <label>
                          {tr("workspace", "projectName")}<input
                            required
                            autoFocus
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder={tr("workspace", "productionName")}
                          />
                        </label>
                        <label className="full">
                          {tr("workspace", "savedMusicContext")}<textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder={tr("workspace", "purposeEmotionalRoleDecisionsAndConstraintsForCodex")}
                          />
                        </label>
                        <button className="primary" disabled={busy}>
                          {tr("workspace", "createProject")}</button>
                      </form>
                    </Panel>
                  )}
                  <div className="two-columns">
                    <Panel
                      title={tr("workspace", "projects")}
                      aside={
                        <span className="mono muted">
                          {data.projects.length} {tr("workspace", "local")}</span>
                      }
                    >
                      <div className="project-list">
                        {data.projects.length === 0 && (
                          <div className="empty">
                            <Folder size={30} />
                            <h3>{tr("workspace", "openAWorkspaceForYourAudio")}</h3>
                            <p>
                              {tr("workspace", "createAProjectToSaveContextSessionsAnd")}</p>
                          </div>
                        )}
                        {data.projects.map((p) => (
                          <button
                            key={p.id}
                            className={`project-row ${project?.id === p.id ? "selected" : ""}`}
                            onClick={() =>
                              void act("project_select", { project_id: p.id })
                            }
                          >
                            <div className="project-symbol">
                              <Folder size={23} />
                            </div>
                            <div>
                              <h3>{p.name}</h3>
                              <p>
                                {p.result_count} {tr("workspace", "results")}{" "}{date(p.created)}
                              </p>
                            </div>
                            <ChevronRight size={18} />
                          </button>
                        ))}
                      </div>
                    </Panel>
                    <Panel
                      title={project ? tr("workspace", "productionSessions") : tr("workspace", "sessions")}
                      aside={<Badge>{tr("workspace", "sharedContext")}</Badge>}
                    >
                      {project ? (
                        <>
                          <div className="inset">
                            <h3>{project.name}</h3>
                            <p className="context-preview">
                              {project.context ||
                                tr("workspace", "noMusicContextSavedCodexCanRecordIt")}
                            </p>
                          </div>
                          <div className="session-list">
                            {data.sessions
                              .filter((s) => s.project_id === project.id)
                              .map((s) => (
                                <div className="session-row" key={s.id}>
                                  <Disc3 size={17} />
                                  <span>{s.name}</span>
                                  <small>{date(s.created)}</small>
                                  <button className="text-button" disabled={busy} onClick={() => void navigateLibrary({ projectId: s.project_id, sessionId: s.id, action: "library" })}>{tr("workspace", "openSessionResults")}</button>
                                </div>
                              ))}
                          </div>
                          <details className="technical-details session-create"><summary>{tr("workspace", "createSession")}</summary><form
                            className="inline-form"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void act("session_create", {
                                project_id: project.id,
                                name: sessionName,
                              }).then((value) => {
                                if (value) setSessionName("");
                              });
                            }}
                          >
                            <input
                              aria-label={tr("workspace", "newSessionName")}
                              required
                              placeholder={tr("workspace", "newSessionName")}
                              value={sessionName}
                              onChange={(e) => setSessionName(e.target.value)}
                            />
                            <button className="outline" disabled={busy}>
                              <Plus size={16} /> {tr("workspace", "createSession")}</button>
                          </form></details>
                        </>
                      ) : (
                        <div className="empty">
                          <p>{tr("workspace", "selectAProjectToOrganizeSessions")}</p>
                        </div>
                      )}
                    </Panel>
                  </div>
                  {chosen && (
                    <Panel
                      title={tr("workspace", "currentSelection")}
                      aside={<Badge tone="ok">{tr("workspace", "selected")}</Badge>}
                    >
                      <div className="chosen-row">
                        <button
                          className="play-disc"
                          aria-label={tr("workspace", "playCurrentSelection")}
                          onClick={() => {
                            selectAudio(chosen);
                            setPlaying(true);
                          }}
                        >
                          <Play size={22} />
                        </button>
                        <div>
                          <h3>{chosen.name}</h3>
                          <p>{chosen.notes || tr("workspace", "noNotesRecorded")}</p>
                        </div>
                        <button
                          className="outline"
                          onClick={() => openDetail(chosen)}
                        >
                          {tr("workspace", "viewVersion")}{" "}<ChevronRight size={15} />
                        </button>
                      </div>
                    </Panel>
                  )}
                </>
              )}

              {page === "queue" && (
                <>
                  <div className="memory-strip">
                    <Cpu size={24} />
                    <div>
                      <strong>{tr("workspace", "systemMemory")}</strong>
                      <p>
                        {tr("workspace", "oneGenerationAtATimeBatch1Model")}</p>
                    </div>
                    <div className="memory-values">
                      <b>
                        {formatNumber(data.telemetry.available_gib, 1)}{" "}
                        <small>
                          / {formatNumber(data.telemetry.total_gib, 1)} {tr("workspace", "gibAvailable")}</small>
                      </b>
                      <meter
                        min="0"
                        max="100"
                        value={data.telemetry.used_percent}
                        aria-label={tr("workspace", "ramUsage")}
                      />
                      <span>{data.telemetry.used_percent}{tr("workspace", "used")}</span>
                    </div>
                  </div>
                  <div className="two-columns wide-left">
                    <div>
                      <Panel
                        title={tr("workspace", "generationPipeline")}
                        aside={
                          <Badge tone={activeJob ? "working" : ""}>
                            {activeJob ? tr("workspace", "running") : tr("workspace", "waiting2")}
                          </Badge>
                        }
                        className="engine-panel"
                      >
                        <div className="pipeline">
                          {[
                            tr("workspace", "queue"),
                            tr("workspace", "loading"),
                            tr("production", "processingStage"),
                            tr("workspace", "validation"),
                          ].map((step, i) => (
                            <span
                              key={step}
                              className={
                                activeJob &&
                                (activeJob.state === "loading"
                                  ? i === 1
                                  : i === 2)
                                  ? "current"
                                  : ""
                              }
                            >
                              <b>{String(i + 1).padStart(2, "0")}</b>
                              {step}
                              {i < 3 && <ChevronRight size={13} />}
                            </span>
                          ))}
                        </div>
                        {activeJob ? (
                          <JobPanel job={activeJob} />
                        ) : (
                          <div className="empty engine-empty">
                            <AudioLines size={45} />
                            <h3>
                              {tr("production", "queueIdle")}
                            </h3>
                            <p>
                              {tr("production", "queueIdleHelp")}</p>
                            <span className="mono">
                              ACE-Step 1.5 Turbo · {stateLabel(data.engine.state)}</span>
                          </div>
                        )}
                        <div className="panel-footer">
                          <span className="mono muted">
                            {activeJob?.params._engine
                              ? <>{formatNumber(activeJob.metrics.peak_rss_gib, 2)} GiB · {tr("production", "observedJobPeak")}</>
                              : <>{formatNumber(data.engine.rss_gib, 2)} GiB · ACE-Step</>}</span>
                          <button
                            className="outline"
                            disabled={
                              busy || !!activeJob || !data.engine.managed
                            }
                            onClick={() =>
                              void act("engine_stop", {}, tr("workspace", "engineUnloaded"))
                            }
                          >
                            <Square size={12} /> {tr("workspace", "unloadEngine")}</button>
                        </div>
                      </Panel>
                      <Panel
                        title={tr("workspace", "waitingQueue")}
                        aside={
                          <span className="mono muted">
                            {tr("workspace", "fifo")}{" "}{queued.length} {tr("workspace", "tasks")}</span>
                        }
                      >
                        {queued.length === 0 ? (
                          <div className="empty compact">
                            {tr("workspace", "noTasksWaiting")}</div>
                        ) : (
                          queued.map((job) => (
                            <div className="queue-row" key={job.id}>
                              <Clock3 size={19} />
                              <div>
                                <strong>
                                  {String(
                                    job.params.prompt ??
                                      job.params.text ??
                                      (job.params.recipe as { name?: string })
                                        ?.name ??
                                      tr("workspace", "localProcessing"),
                                  ).slice(0, 75)}
                                </strong>
                                <p>
                                  {systemMessage(job.stage)} {tr("workspace", "seed")}{" "}{String(job.params.seed)}
                                </p>
                                <p className="muted">{tr("workspace", jobRecoveryKey(job) ?? "queuedTaskHelp")}</p>
                              </div>
                              <button
                                className="outline"
                                disabled={!!job.remote_id || busy}
                                onClick={() =>
                                  void act("job_cancel", { job_id: job.id })
                                }
                              >
                                {tr("workspace", "cancelWaitingTask")}</button>
                            </div>
                          ))
                        )}
                      </Panel>
                      <Panel title={tr("workspace", "executionHistory")}>
                        {data.jobs
                          .filter(
                            (j) =>
                              ![
                                "queued",
                                "loading",
                                "generating",
                                "submitted",
                              ].includes(j.state),
                          )
                          .map((job) => (
                            <details className="history-row" key={job.id}>
                              <summary>
                                <Badge
                                  tone={
                                    job.state === "completed"
                                      ? "ok"
                                      : job.state === "interrupted"
                                        ? "error"
                                        : ""
                                  }
                                >
                                  {stateLabel(job.state)}
                                </Badge>
                                <span className="mono">
                                  {job.id.slice(0, 10)}
                                </span>
                                <span>{date(job.created)}</span>
                                <ChevronRight size={15} />
                              </summary>
                              <JobPanel job={job} results={data.assets.filter(a => a.job_id === job.id && a.project_id === job.project_id)} onResult={asset => void navigateLibrary({ projectId: asset.project_id, assetId: asset.id, action: "library" })} onListen={asset => void navigateLibrary({ projectId: asset.project_id, assetId: asset.id, action: "listen" })} />
                            </details>
                          ))}
                        {data.jobs.length === 0 && (
                          <div className="empty compact">
                            {tr("workspace", "historyWillBeCreatedByRealTasks")}</div>
                        )}
                      </Panel>
                    </div>
                    <div>
                      <Panel title={tr("workspace", "connectors")}>
                        <div className="connector">
                          <Cpu size={19} />
                          <div>
                            <strong>ACE-Step API</strong>
                            <p className="mono">127.0.0.1:8001</p>
                          </div>
                          <Badge tone={data.engine.managed ? "ok" : ""}>
                            {stateLabel(data.engine.state)}
                          </Badge>
                        </div>
                        <div className="connector">
                          <Link2 size={19} />
                          <div>
                            <strong>Audacity</strong>
                            <p>mod-script-pipe</p>
                          </div>
                          <Badge
                            tone={data.audacity.pipe_available ? "ok" : ""}
                          >
                            {data.audacity.pipe_available
                              ? tr("workspace", "available")
                              : tr("workspace", "inactive")}
                          </Badge>
                        </div>
                      </Panel>
                      <EventLog data={data} />
                    </div>
                  </div>
                </>
              )}

              {page === "library" && (
                <>
                  <div className="library-toolbar">
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label={tr("workspace", "searchResults")}
                        value={query}
                        onChange={(e) => library.update({ ...library.filters, query: e.target.value })}
                        placeholder={tr("workspace", "searchResults2")}
                      />
                    </label>
                    <button
                      className={favorites ? "outline selected" : "outline"}
                      onClick={() => library.update({ ...library.filters, favorite: !favorites })}
                    >
                      <Star size={15} /> {tr("workspace", "favorites")}</button>
                    <span className="muted">{assets.length} {tr("workspace", "versions")}</span>
                    <span className="toolbar-end mono">
                      {tr("workspace", "comparison")}{" "}{compare.length}/2
                    </span>
                  </div>
                  {showRegister && (
                    <Panel title={tr("workspace", "registerALocalFile")}>
                      <form
                        className="form-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!project) return;
                          void act(
                            registerType === "result"
                              ? "result_import"
                              : "reference_register",
                            {
                              project_id: project.id,
                              path: registerPath,
                              name: registerName,
                              ...(importSessionId ? { session_id: importSessionId } : {}),
                            },
                            tr("workspace", "fileRegisteredOriginalPreserved"),
                          ).then((value) => {
                            if (value) setShowRegister(false);
                          });
                        }}
                      >
                        <label>
                          {tr("workspace", "type")}<SelectControl
                            label={tr("workspace", "fileType")}
                            value={registerType}
                            onChange={setRegisterType}
                            options={[
                              { value: "result", label: tr("workspace", "existingResult") },
                              {
                                value: "reference",
                                label: tr("workspace", "musicReference"),
                              },
                            ]}
                          />
                        </label>
                        <label>
                          {tr("workspace", "name")}<input
                            required
                            value={registerName}
                            onChange={(e) => setRegisterName(e.target.value)}
                          />
                        </label>
                        <PathField className="full" label={tr("workspace", "absoluteLocalPath")} kind="audio"
                          required value={registerPath} onChange={setRegisterPath} disabled={busy} />
                        <label className="full">{tr("library", "importSession")}<SelectControl label={tr("library", "importSession")}
                          value={importSessionId || "none"} disabled={busy} onChange={value => setImportSessionId(value === "none" ? "" : value)}
                          options={[{ value: "none", label: tr("library", "noSession") }, ...data.sessions.filter(s => s.project_id === project?.id).map(s => ({ value: s.id, label: s.name }))]} /></label>
                        <button className="primary" disabled={busy || !project}>
                          {tr("workspace", "registerFile")}</button>
                      </form>
                    </Panel>
                  )}
                  {compare.length > 0 && (
                    <Panel
                      title={tr("workspace", "candidateComparison")}
                      aside={
                        <button
                          className="text-button"
                          onClick={() => setCompare([])}
                        >
                          {tr("workspace", "clearComparison")}</button>
                      }
                    >
                      <div className="comparison">
                        {compare.map((id, index) => {
                          const asset = allAudio.find((a) => a.id === id);
                          return (
                            asset && (
                              <div key={id}>
                                <div className="comparison-title">
                                  <span className="letter">
                                    {index === 0 ? "A" : "B"}
                                  </span>
                                  <strong>{asset.name}</strong>
                                  <button
                                    className="outline"
                                    onClick={() => {
                                      selectAudio(asset);
                                      setPlaying(true);
                                    }}
                                  >
                                    <Headphones size={15} /> {tr("workspace", "play")}{" "}
                                    {index === 0 ? "A" : "B"}
                                  </button>
                                </div>
                                <Waveform asset={asset} />
                                <div className="data-line">
                                  <span>
                                    {formatTime(asset.metadata.duration)}
                                  </span>
                                  <span>
                                    {asset.metadata.sample_rate / 1000} kHz
                                  </span>
                                  <span>{asset.metadata.subtype}</span>
                                  <span>
                                    RMS {formatNumber(asset.metadata.rms, 3)}
                                  </span>
                                </div>
                              </div>
                            )
                          );
                        })}
                        {compare.length === 1 && (
                          <div className="comparison-placeholder">
                            <ArrowLeftRight size={24} />
                            <p>{tr("workspace", "selectAnotherCandidateToCompare")}</p>
                          </div>
                        )}
                      </div>
                    </Panel>
                  )}
                  <LibraryTools data={data} assets={projectAudio} filters={library.filters} update={library.update}
                    selected={exportSelection} onSelection={setExportSelection} busy={busy} act={act} saveError={library.error} />
                  <div hidden={!exportSelection.length}><BatchExport assets={projectAudio} selected={exportSelection}
                    onSelection={setExportSelection} busy={busy} act={act} /></div>
                  <div className="library-grid">
                    {assets.slice(0, visibleLimit).map((asset) => (
                      <article
                        className={`version-panel ${asset.id === activeId ? "listening" : ""}`}
                        key={asset.id}
                        data-asset-id={asset.id} tabIndex={-1}
                      >
                        <div className="version-top">
                          <span className="mono muted">
                            {asset.kind === "export"
                              ? tr("workspace", "edit")
                              : asset.kind === "imported"
                                ? tr("workspace", "imported")
                                : asset.kind === "processed" ? tr("production", "processedBadge")
                                  : asset.kind === "voice" ? tr("production", "voiceBadge")
                                    : asset.kind === "region" ? tr("library", "regionBadge")
                                      : asset.kind === "reference" ? tr("library", "kind_reference") : tr("workspace", "generation")}{" "}
                            / {asset.id.slice(0, 6)}
                          </span>
                          <button
                            className={`icon-button ${asset.favorite ? "favorite" : ""}`}
                            aria-label={tr("production", "favoriteAsset", { name: asset.name })}
                            disabled={busy}
                            onClick={() =>
                              void act("result_feedback", {
                                asset_id: asset.id,
                                favorite: !asset.favorite,
                                selected: !!asset.selected,
                                notes: asset.notes,
                              })
                            }
                          >
                            <Star
                              size={16}
                              fill={asset.favorite ? "currentColor" : "none"}
                            />
                          </button>
                        </div>
                        <div className="version-name">
                          <button
                            className="play-disc small"
                            aria-label={tr("production", "playAsset", { name: asset.name })}
                            onClick={() => {
                              selectAudio(asset);
                              setPlaying(true);
                            }}
                          >
                            <Play size={18} />
                          </button>
                          <div>
                            <h3>{asset.name}</h3>
                            <p>{date(asset.created)}</p>
                          </div>
                        </div>
                        <Waveform
                          asset={asset}
                          position={
                            asset.id === activeId
                              ? position / asset.metadata.duration
                              : 0
                          }
                        />
                        {!!asset.tags?.length && <div className="library-tags" aria-label={tr("library", "candidateTags")}>{asset.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
                        <div className="data-line">
                          <span>{formatTime(asset.metadata.duration)}</span>
                          <span>
                            {asset.metadata.sample_rate / 1000} kHz ·{" "}
                            {asset.metadata.channels === 2 ? "ST" : "MONO"}
                          </span>
                          <span>
                            {asset.metadata.parameters?.seed !== undefined
                              ? `Seed ${asset.metadata.parameters.seed}`
                              : asset.metadata.subtype}
                          </span>
                        </div>
                        {asset.notes && (
                          <p className="version-note">{asset.notes}</p>
                        )}
                        <div className="version-actions">
                          <label className="check-label">
                            <input
                              type="checkbox"
                              checked={compare.includes(asset.id)}
                              onChange={() => toggleCompare(asset.id)}
                            />{" "}
                            {tr("workspace", "compare")}</label>
                          <label className="check-label">
                            <input type="checkbox" disabled={busy} checked={exportSelection.includes(asset.id)}
                              aria-label={tr("library", "selectCandidate", { name: asset.name })}
                              onChange={e => setExportSelection(ids => e.target.checked ? [...ids, asset.id] : ids.filter(id => id !== asset.id))} />
                            {tr("library", "select")}
                          </label>
                          {!!asset.selected && (
                            <Badge tone="ok">{tr("workspace", "selected")}</Badge>
                          )}
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => openDetail(asset)}
                          >
                            {tr("workspace", "details")}{" "}<ChevronRight size={14} />
                          </button>
                        </div>
                        <div className="version-tools">
                          <button className="text-button" onClick={() => { setRegionAssetId(asset.id); if (advancedLibrary.current) { advancedLibrary.current.open = true; advancedLibrary.current.scrollIntoView?.({ block: "start" }); } }}>{tr("workspace", "createAudioRegion")}</button>
                          {asset.kind !== "reference" && <button className="text-button" onClick={() => sendToFx(asset)}>{tr("workspace", "openInFx")}</button>}
                          {asset.parent_id && allAudio.some(a => a.id === asset.parent_id && a.project_id === asset.project_id) && <button className="text-button" onClick={() => void navigateLibrary({ projectId: asset.project_id, assetId: asset.parent_id!, action: "library" })}>{tr("workspace", "viewSource")}</button>}
                        </div>
                      </article>
                    ))}
                  </div>
                  {assets.length > visibleLimit && <button className="outline" onClick={() => setVisibleLimit(value => value + 50)}>{tr("library", "showMore", { shown: visibleLimit, total: assets.length })}</button>}
                  <details ref={advancedLibrary} className="panel library-advanced"><summary>{tr("workspace", "advancedLibraryTools")}</summary>
                  <AudioRegion assets={projectAudio} selectedId={regionAssetId} onSelect={setRegionAssetId}
                    onPreview={previewRegion} busy={busy} act={act} waveform={regionSource && <Waveform asset={regionSource} />} />
                  <MusicPresets data={data} busy={busy} act={act} />
                  </details>
                  {assets.length === 0 && (
                    <div className="empty library-empty">
                      <AudioLines size={48} />
                      <h2>{projectAudio.length ? tr("library", "noMatches") : tr("workspace", "yourNextListeningSessionStartsHere")}</h2>
                      <p>
                        {projectAudio.length ? tr("library", "noMatchesHelp") : <>{tr("workspace", "resultsRequestedThroughCodexAppearAutomatically")}<br />
                        {tr("workspace", "youCanAlsoRegisterFilesYouHaveAlready")}</>}</p>
                    </div>
                  )}
                </>
              )}

              {page === "environment" && (
                <>
                  <section className="panel environment-choice">
                    <h2>{tr("experience", "environmentChoice")}</h2><p className="muted">{tr("experience", "environmentIntro")}</p>
                    <div className="environment-options">
                      {(["link", "install", "other"] as const).map(choice => <button key={choice} className={`outline ${preparation === choice ? "selected" : ""}`} aria-pressed={preparation === choice}
                        onClick={() => setPreparation(choice)}>{tr("experience", choice === "link" ? "prepareLink" : choice === "install" ? "prepareInstall" : "prepareOther")}</button>)}
                      <button className="outline" onClick={() => setPage("voice")}>{tr("experience", "voiceSetupLink")}</button>
                    </div>
                    {preparation && <p className="muted">{tr("experience", "manualSetupNote")}</p>}
                  </section>
                  <div hidden={preparation !== "other"}><MusicEngines data={data} busy={busy} act={act} prepareSetup={preparation === "other"} initialRecommendation={recommendedAudio} /></div>
                  <div className="environment-forms">
                    <div hidden={preparation !== "link"}>
                    <Panel
                      title={tr("workspace", "linkAnExistingEnvironment")}
                      aside={<Badge>{tr("workspace", "noReinstallation")}</Badge>}
                    >
                      <form
                        className="form-stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void act(
                            "environment_link",
                            { root },
                            tr("workspace", "diagnosticsCompleted"),
                          );
                        }}
                      >
                        <p className="muted">
                          {tr("workspace", "inspectVersionsComponentsAndTheDitOnlyPatch")}</p>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => {
                            void rpc<{ detected: { root: string }[] }>(
                              "environment_status",
                            )
                              .then((value) => setDetected(value.detected))
                              .catch((e) => setError(String(e)));
                          }}
                        >
                          <Search size={15} /> {tr("workspace", "findInstallations")}</button>
                        {detected.map((item) => (
                          <button
                            type="button"
                            className="detected-path"
                            key={item.root}
                            onClick={() => setRoot(item.root)}
                          >
                            {item.root}
                            <ChevronRight size={14} />
                          </button>
                        ))}
                        <PathField label={tr("workspace", "environmentFolder")} kind="directory" required
                          value={root} onChange={setRoot} disabled={busy}
                          placeholder={data.environment?.root ?? tr("workspace", "folderContainingVenvAndAceStep15")} />
                        <p className="muted">{tr("workspace", "audacityOptionalLink")}</p>
                        <button className="primary" disabled={busy}>
                          {tr("workspace", "inspectAndLink")}</button>
                      </form>
                    </Panel>
                    </div><div hidden={preparation !== "install"}>
                    <Panel
                      title={tr("workspace", "installANewEnvironment")}
                      aside={<Badge>{tr("workspace", "cpuRecipeV1")}</Badge>}
                    >
                      <div className="form-stack">
                        <p className="muted">
                          {tr("workspace", "pythonCpuDependenciesRequiredModelsAndPortableAudacity")}</p>
                        <PathField label={tr("workspace", "installationDestination")} kind="directory"
                          value={destination} onChange={setDestination} disabled={busy}
                          placeholder={`${data.data_home}\\engine`} />
                        <button
                          className="outline"
                          disabled={busy}
                          onClick={() => {
                            void rpc<Record<string, unknown>>("setup_plan", {
                              destination:
                                destination || `${data.data_home}\\engine`,
                            })
                              .then(setSetupPlan)
                              .catch((e) => setError(String(e)));
                          }}
                        >
                          {tr("workspace", "reviewInstallationPlan")}</button>
                        {setupPlan && (
                          <div className="installation-plan">
                            <strong>{tr("workspace", "installationPlan")}</strong>
                            <p>{String(setupPlan.destination)}</p>
                            <ul>
                              {(setupPlan.components as string[]).map(
                                (component) => (
                                  <li key={component}>{component}</li>
                                ),
                              )}
                            </ul>
                            <p>
                              {tr("workspace", "minimumDiskSpace16GibEstimatedDownload7")}</p>
                            <button
                              className="primary"
                              disabled={
                                busy ||
                                !setupPlan.supported ||
                                data.setup?.state === "running"
                              }
                              onClick={() =>
                                void act(
                                  "setup_install",
                                  {
                                    destination: setupPlan.destination,
                                    authorized: true,
                                  },
                                  tr("workspace", "installationStartedFollowTheStagesBelow"),
                                )
                              }
                            >
                              {tr("workspace", "authorizeAndInstallComponents")}</button>
                          </div>
                        )}
                        {data.setup && (
                          <div className="message">
                            <Loader2 size={16} />
                            <span>
                              {stateLabel(data.setup.state) ?? data.setup.state}:{" "}
                              {systemMessage(data.setup.stage)}
                            </span>
                          </div>
                        )}
                      </div>
                    </Panel>
                    </div>
                  </div>
                  <div className="profile-banner">
                    <ShieldCheck size={31} />
                    <div>
                      <h2>WINDOWS x64 / CPU</h2>
                      <p>
                        {tr("workspace", "versionedRecipeDitOnlyTurboOneGenerationAt")}</p>
                    </div>
                    <Badge tone={data.environment?.compatible ? "ok" : ""} help={tr("experience", "musicStatusHelp")}>
                      {data.environment?.compatible
                        ? tr("workspace", "environmentValidated")
                        : tr("workspace", "setupRequired")}
                    </Badge>
                  </div>
                  <Panel
                    title={tr("workspace", "inventoryAndChecks")}
                    aside={
                      <span className="mono muted">
                        {tr("workspace", "validatedVersionsNoAutomaticUpgrades")}</span>
                    }
                  >
                    {data.environment ? (
                      <>
                        <div className="inventory">
                          <div>
                            <span>Python</span>
                            <strong>{data.environment.versions.python}</strong>
                          </div>
                          <div>
                            <span>PyTorch CPU</span>
                            <strong>
                              {data.environment.versions.packages.torch}
                            </strong>
                          </div>
                          <div>
                            <span>Torchaudio</span>
                            <strong>
                              {data.environment.versions.packages.torchaudio}
                            </strong>
                          </div>
                          <div>
                            <span>ACE-Step</span>
                            <strong title={data.environment.commit}>
                              {data.environment.commit.slice(0, 12)}
                            </strong>
                          </div>
                        </div>
                        <div className="check-grid">
                          {Object.entries(data.environment.checks).map(
                            ([key, passed]) => (
                              <div key={key}>
                                <Check size={15} />
                                <span title={key}>{tr("production", `check_${key}`, { defaultValue: key })}</span>
                                <Badge tone={passed ? "ok" : "error"}>
                                  {passed ? tr("workspace", "verified") : tr("workspace", "failed")}
                                </Badge>
                              </div>
                            ),
                          )}
                        </div>
                        <div className="model-list">
                          {data.environment.models.map((model) => (
                            <div key={model.name}>
                              <AudioLines size={17} />
                              <code>{model.name}</code>
                              <span>
                                {formatNumber((model.bytes / 2 ** 30), 2)} GiB
                              </span>
                              <Badge tone={model.present ? "ok" : "error"}>
                                {model.present ? tr("workspace", "present") : tr("workspace", "missing")}
                              </Badge>
                            </div>
                          ))}
                        </div>
                        <div className="panel-footer mono muted">
                          {tr("workspace", "gpuHardwareDetectionIsAvailableAccelerationIsNot")}</div>
                      </>
                    ) : (
                      <div className="empty compact">
                        {tr("workspace", "noEnvironmentLinkedChooseOneOfTheOptions")}</div>
                    )}
                  </Panel>
                  <Panel title={tr("workspace", "enginePreferences")}>
                    <details className="technical-details"><summary>{tr("experience", "manualPreferences")}</summary>
                    <div className="form-stack">
                      <label>
                        {tr("workspace", "unloadIdleModelAfterMinutes")}<input
                          type="number"
                          min="1"
                          max="60"
                          defaultValue={data.preferences.idle_minutes}
                          onBlur={(e) => {
                            const value = Number(e.target.value);
                            if (value >= 1 && value <= 60)
                              void act("preferences_save", {
                                idle_minutes: value,
                              });
                          }}
                        />
                      </label>
                      <p className="muted">
                        {tr("workspace", "activeInferenceIsNotInterruptedAutomaticallyThisPreference")}</p>
                    </div>
                    </details>
                  </Panel>
                </>
              )}

              {page === "bridges" && (
                <>
                  <Requirements required={tr("experience", "agentRequired")} optional={tr("experience", "editorOptional")} />
                  <div className="bridge-flow">
                    <span>
                      <Terminal size={24} />
                      <strong>Codex</strong>
                      <small>{tr("workspace", "creativeDirection")}</small>
                    </span>
                    <ChevronRight />
                    <span>
                      <AudioLines size={24} />
                      <strong>Sonariel</strong>
                      <small>{tr("workspace", "localStateQueue")}</small>
                    </span>
                    <ChevronRight />
                    <span>
                      <Cpu size={24} />
                      <strong>{tr("workspace", "enginesFx")}</strong>
                      <small>{tr("workspace", "cpuAudio")}</small>
                    </span>
                    <ChevronRight />
                    <span>
                      <Headphones size={24} />
                      <strong>Audacity</strong>
                      <small>{tr("workspace", "editingExport")}</small>
                    </span>
                  </div>
                  <div className="two-columns">
                    <Panel
                      title={tr("workspace", "codexMcpStdio")}
                      aside={
                        <Badge tone={data.codex.tested ? "ok" : ""}>
                          {data.codex.tested
                            ? tr("workspace", "handshakeRecorded")
                            : data.codex.configured
                              ? tr("workspace", "configured2")
                              : tr("workspace", "notConfigured2")}
                        </Badge>
                      }
                    >
                      <div className="form-stack">
                        <p>{tr("experience", "codexActionSummary")}</p>

                        <HelpTip label={tr("experience", "codexActionHelpLabel")} trigger={<button
                          className="primary"
                          disabled={busy}
                          aria-busy={codexPhase === "working"}
                          onClick={() => void configureCodex()}
                        >
                          {codexPhase === "working" ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />}
                          {tr("experience", codexPhase === "working" ? "codexWorking" : "codexAction")}</button>}>{tr("experience", "codexActionHelp")}</HelpTip>
                        {codexPhase !== "idle" && <div className="connection-feedback" data-state={codexPhase} role={codexPhase === "error" ? "alert" : "status"}>
                          <strong>{tr("experience", `codex_${codexPhase}`)}</strong>
                          <p>{tr("experience", codexPhase === "done" ? "codexNext" : codexPhase === "error" ? "codexErrorHelp" : "codexWait")}</p>
                        </div>}
                        <details className="technical-details"><summary>{tr("experience", "connectionDetails")}</summary>
                        <dl className="property-list">
                          <dt>{tr("workspace", "transport")}</dt>
                          <dd>stdio local</dd>
                          <dt>{tr("workspace", "persistentState")}</dt>
                          <dd>{tr("workspace", "sharedSqlite")}</dd>
                          <dt>{tr("workspace", "lastTest")}</dt>
                          <dd>
                            {data.codex.last_handshake
                              ? `${date(data.codex.last_handshake)} · ${data.codex.client}`
                              : tr("workspace", "noHandshakeRecorded")}
                          </dd>
                        </dl>
                        <p className="muted">{tr("workspace", "configurationPreservesOtherServersRestartOrReloadThe")}</p>
                        <code className="code-block">
                          sonariel_environment_status
                          <br />
                          sonariel_projects_list
                          <br />
                          sonariel_generate → job_id
                          <br />
                          {tr("workspace", "sonarielJobGetResult")}</code></details>
                      </div>
                    </Panel>
                    <Panel
                      title={tr("workspace", "audacityModScriptPipe")}
                      aside={
                        <Badge tone={data.audacity.pipe_available ? "ok" : ""}>
                          {data.audacity.pipe_available
                            ? tr("workspace", "pipeAvailable")
                            : tr("workspace", "pipeUnavailable")}
                        </Badge>
                      }
                    >
                      <div className="form-stack">
                        <p>
                          {tr("workspace", "resultsAreImportedIntoNewIdentifiedProjectsExports")}</p>
                        {!data.audacity.pipe_available && <p className="muted">{tr("workspace", "audacityUnavailableHelp")}</p>}
                        <PathField label={tr("workspace", "audacityExecutableIndependentOfEngines")} kind="executable"
                          value={audacityPath} onChange={setAudacityPath} disabled={busy}
                          placeholder={tr("workspace", "absolutePathToAudacityExe")} />
                        <button
                          className="outline"
                          disabled={busy || !audacityPath}
                          onClick={() =>
                            void act(
                              "audacity_configure",
                              { executable: audacityPath },
                              tr("workspace", "pathSavedModulesAndPreferencesPreserved"),
                            )
                          }
                        >
                          {tr("workspace", "saveAudacityPath")}</button>
                        <button
                          className="outline"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              "audacity_probe",
                              {},
                              tr("workspace", "pipeReadConfirmed"),
                            )
                          }
                        >
                          <RefreshCw size={16} /> {tr("workspace", "testReadConnection")}</button>
                        <dl className="property-list">
                          <dt>{tr("workspace", "application")}</dt>
                          <dd>
                            {data.audacity.running ? tr("workspace", "open") : tr("workspace", "closed")}
                          </dd>
                          <dt>{tr("workspace", "resultInPlayer")}</dt>
                          <dd>
                            {active?.name ?? tr("workspace", "selectAudioInTheLibrary")}
                          </dd>
                        </dl>
                        <button
                          className="primary"
                          disabled={!active || busy}
                          onClick={() => active && void sendToAudacity(active)}
                        >
                          <ArrowDownToLine size={16} /> {tr("workspace", "openResultInAudacity")}</button>
                        {selectedEdit && (
                          <div className="installation-plan">
                            <strong>{tr("workspace", "registeredEdit")}</strong>
                            <code>{selectedEdit.project_path}</code>
                            <button
                              className="outline"
                              disabled={busy}
                              onClick={() =>
                                void act(
                                  "audacity_export",
                                  {
                                    edit_id: selectedEdit.id,
                                    fade_in: 0,
                                    fade_out: 0,
                                  },
                                  tr("workspace", "copyExportedAndRegisteredInTheLibrary"),
                                )
                              }
                            >
                              {tr("workspace", "exportACopyOfTheCurrentEdit")}</button>
                          </div>
                        )}
                      </div>
                    </Panel>
                  </div>
                  <EventLog data={data} />
                </>
              )}
            </>
          )}
        </main>
      </div>

      <footer className="player">
        <div className="player-track">
          <div className="cover-symbol">
            <AudioLines size={24} />
          </div>
          <div>
            <strong>{active?.name ?? tr("workspace", "selectAResult")}</strong>
            {playRange && playRange.assetId === activeId && <span>{tr("library", "playbackRegion", { start: formatNumber(playRange.start, 2), end: formatNumber(playRange.end, 2) })}</span>}
            {!!loopSeams(active).length && <div className="player-seams"><span>{tr("library", "seams")}</span>
              {loopSeams(active).map(at => <button className="text-button" key={at}
                aria-label={tr("library", "listenToSeam", { at: formatNumber(at, 2) })}
                onClick={() => { setPlayRange(undefined); if (audio.current) audio.current.currentTime = Math.max(0, at - .75); setPlaying(true); }}>
                {formatNumber(at, 2)} s</button>)}</div>}
            <span>
              {active
                ? tr("workspace", "valueKhzValueLocalFile", { value0: active.metadata.sample_rate / 1000, value1: active.metadata.subtype })
                : tr("workspace", "thePlayerFollowsYouAcrossTheWorkspace")}
            </span>
          </div>
          {active && (
            <button
              className="icon-button"
              aria-label={tr("workspace", "detailsOfThePlayingTrack")}
              onClick={() => openDetail(active)}
            >
              <Settings2 size={16} />
            </button>
          )}
        </div>
        <div className="transport">
          <div className="transport-buttons">
            <button
              className="icon-button"
              aria-label={tr("workspace", "returnToStart")}
              disabled={!active}
              onClick={() => {
                if (audio.current) audio.current.currentTime = playRange && playRange.assetId === activeId ? playRange.start : 0;
              }}
            >
              <SkipBack size={16} />
            </button>
            <button
              className="transport-play"
              aria-label={playing ? tr("workspace", "pauseAudio") : tr("workspace", "playAudio")}
              disabled={!active}
              onClick={() => {
                if (!playing && audio.current && playRange && playRange.assetId === activeId
                  && (audio.current.currentTime >= playRange.end || audio.current.currentTime < playRange.start)) {
                  audio.current.currentTime = playRange.start;
                }
                setPlaying(!playing);
              }}
            >
              {playing ? (
                <Pause size={19} />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
            </button>
            <button
              className="icon-button"
              aria-label={tr("workspace", "nextCandidate")}
              disabled={!active || compare.length < 2}
              onClick={() => {
                const next = data?.assets.find(
                  (a) => a.id === compare.find((id) => id !== activeId),
                );
                if (next) {
                  selectAudio(next);
                  setPlaying(true);
                }
              }}
            >
              <SkipForward size={16} />
            </button>
          </div>
          <div className="seek-row">
            <span>{formatTime(position)}</span>
            <AudioSlider
              label={tr("workspace", "playbackPosition")}
              min={0}
              max={active?.metadata.duration ?? 1}
              step={0.05}
              value={position}
              disabled={!active}
              formatValue={(value) =>
                tr("workspace", "valueOfValue", { value0: formatTime(value), value1: formatTime(active?.metadata.duration ?? 0) })
              }
              onChange={(value) => {
                if (audio.current) audio.current.currentTime = value;
                setPosition(value);
              }}
            />
            <span>{formatTime(active?.metadata.duration ?? 0)}</span>
          </div>
        </div>
        <div className="player-output">
          <Volume2 size={17} />
          <AudioSlider
            label={tr("workspace", "volume")}
            value={volume}
            formatValue={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => {
              setVolume(value);
              if (audio.current) audio.current.volume = value;
            }}
          />
          <span className="mono">{tr("workspace", "localOut")}</span>
        </div>
        <audio
          ref={audio}
          src={source}
          onLoadedMetadata={() => {
            if (audio.current) {
              audio.current.volume = volume;
              if (playRange && playRange.assetId === activeId) audio.current.currentTime = playRange.start;
            }
          }}
          onTimeUpdate={() => {
            const current = audio.current?.currentTime ?? 0;
            setPosition(current);
            if (playRange && playRange.assetId === activeId && current >= playRange.end && audio.current) {
              audio.current.pause(); setPlaying(false);
            }
          }}
          onEnded={() => setPlaying(false)}
          onError={() => {
            if (source)
              setError(tr("workspace", "theLocalAudioFileCouldNotBeRead"));
          }}
          preload="metadata"
        />
      </footer>

      <SidePanel
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail?.name ?? tr("workspace", "versionDetails")}
        returnFocus={detailReturnFocus}
      >
        {detail && (
          <>
            <p className="mono muted">{detail.id}</p>
            <Waveform asset={detail} />
            <dl className="property-list">
              <dt>{tr("workspace", "duration")}</dt>
              <dd>{formatNumber(detail.metadata.duration, 3)} s</dd>
              <dt>{tr("workspace", "format")}</dt>
              <dd>
                {detail.metadata.sample_rate} Hz · {detail.metadata.subtype}
              </dd>
              <dt>{tr("workspace", "previousVersion")}</dt>
              <dd>{detail.parent_id ?? tr("workspace", "initialVersion")}</dd>
              {detail.metadata.region && <>
                <dt>{tr("library", "role")}</dt><dd>{tr("library", detail.metadata.region.role === "style" ? "styleRole" : "sourceRole")}</dd>
                <dt>{tr("library", "targetEngine")}</dt><dd><code>{detail.metadata.region.engine_id}</code></dd>
                <dt>{tr("library", "regionRange")}</dt><dd>{formatNumber(detail.metadata.region.start_frame / detail.metadata.region.sample_rate, 3)}–{formatNumber(detail.metadata.region.end_frame / detail.metadata.region.sample_rate, 3)} s</dd>
              </>}
              {detail.metadata.music_preset && <>
                <dt>{tr("production", "musicPresets")}</dt>
                <dd><code>{detail.metadata.music_preset.preset_id}</code> · {tr("production", "presetRevision", { revision: detail.metadata.music_preset.revision })}</dd>
              </>}
              <dt>{tr("workspace", "file")}</dt>
              <dd className="file-path">{detail.path}</dd>
            </dl>
            <label>
              {tr("workspace", "notes")}<textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </label>
            <div className="drawer-actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void act(
                    "result_feedback",
                    {
                      asset_id: detail.id,
                      favorite: !!detail.favorite,
                      selected: true,
                      notes,
                    },
                    tr("workspace", "selectionAndNotesSaved"),
                  ).then((value) => {
                    if (value) setDetail(value as Asset);
                  })
                }
              >
                <Check size={16} /> {tr("workspace", "selectVersion")}</button>
              <button
                className="outline"
                disabled={busy}
                onClick={() =>
                  void act(
                    "result_feedback",
                    {
                      asset_id: detail.id,
                      favorite: !!detail.favorite,
                      selected: !!detail.selected,
                      notes,
                    },
                    tr("workspace", "notesSaved"),
                  )
                }
              >
                {tr("workspace", "saveNotes")}</button>
            </div>
            <button
              className="outline full-width"
              disabled={busy}
              onClick={() => void sendToAudacity(detail)}
            >
              <ArrowDownToLine size={16} /> {tr("workspace", "openInAudacity")}</button>
            <h3>{tr("workspace", "receivedPromptAndParameters")}</h3>
            <p className="muted">
              {tr("workspace", "readOnlyMusicDirectionTakesPlaceInCodex")}</p>
            <pre>
              {JSON.stringify(detail.metadata.parameters ?? {}, null, 2)}
            </pre>
          </>
        )}
      </SidePanel>
    </div>
  );
}

function JobPanel({ job, results = [], onResult, onListen }: { job: Job; results?: Asset[]; onResult?: (asset: Asset) => void; onListen?: (asset: Asset) => void }) {
  useTranslation();
  const engine = String(job.params._engine ?? "acestep-v15-turbo");
  const duration = job.params.audio_duration ?? job.params.duration;
  const fields = [
    [
      tr("workspace", "duration"),
      duration === undefined ? tr("workspace", "fromSourceSynthesis") : `${duration} s`,
    ],
    ["Seed", String(job.params.seed ?? tr("workspace", "notApplicable"))],
    [
      tr("workspace", "mode"),
      String(
        job.params.task_type ??
          job.params.mode ??
          (engine === "native-fx" ? tr("workspace", "nativeDsp") : tr("workspace", "speechText")),
      ),
    ],
    [tr("workspace", "model"), engine],
    ...(job.params.mode === "audio2audio" ? [
      [tr("workspace", "source"), String(job.params.source_id ?? tr("workspace", "notProvided"))],
      [tr("workspace", "sourcePerturbation"), String(job.params.init_noise_level)],
    ] : []),
  ];
  return (
    <div className="job-detail">
      <div className="job-meta">
        <span className="mono">JOB / {job.id.slice(0, 12)}</span>
        <Badge tone={job.state === "completed" ? "ok" : "working"}>
          {systemMessage(job.stage)}
        </Badge>
      </div>
      <div className="job-clock">
        <Clock3 size={18} />
        <strong>
          {formatTime(
            job.finished && job.started
              ? job.finished - job.started
              : secondsSince(job.started),
          )}
        </strong>
        <span>{tr("workspace", "elapsedTime")}</span>
      </div>
      <p className="readonly-label">
        {tr("workspace", "requestParametersReadOnly")}</p>
      <p className="prompt-text">
        {String(
          job.params.prompt ??
            job.params.text ??
            (job.params.recipe as { name?: string })?.name ??
            tr("workspace", "localProcessing"),
        )}
      </p>
      <div className="inventory job-inventory">
        {fields.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {job.metrics.load_seconds !== undefined && (
        <div className="data-line">
          <span>{tr("workspace", "loading2")}{" "}{formatNumber(job.metrics.load_seconds, 2)} s</span>
          <span>
            {tr("workspace", "inference2")}{" "}{formatNumber(job.metrics.inference_seconds, 2) ?? "—"} s
          </span>
          <span>{tr("workspace", "peak")}{" "}{formatNumber(job.metrics.peak_rss_gib, 2)} GiB</span>
        </div>
      )}
      {job.state === "completed" && results.map(asset => <div className="studio-toolbar" key={asset.id}>
        <span>{asset.name} · {formatTime(asset.metadata.duration)} · <code>{asset.id.slice(0, 8)}</code></span>
        <button className="outline" onClick={() => onListen?.(asset)}>{tr("workspace", "listenToResult")}</button>
        {asset.kind !== "preview" && <button className="outline" onClick={() => onResult?.(asset)}>{tr("workspace", "openResultInLibrary")}</button>}
      </div>)}
      {job.error && <p className="error-text">{systemMessage(job.error)}</p>}
      {jobRecoveryKey(job) && <p className="message" role="status">{tr("workspace", jobRecoveryKey(job)!)}</p>}
    </div>
  );
}
function EventLog({ data }: { data: Snapshot }) {
  useTranslation();
  return (
    <Panel
      title={tr("workspace", "operationLog")}
      aside={<Terminal size={16} />}
      className="log-panel"
    >
      <div className="event-log">
        {data.events.slice(0, 20).map((event) => (
          <div key={event.id}>
            <time>
              {new Date(event.time * 1000).toLocaleTimeString(i18n.resolvedLanguage)}
            </time>
            <span
              className={
                event.kind.includes("error") ? "error-text" : "event-kind"
              }
            >
              {event.kind}
            </span>
            <p>{systemMessage(event.message)}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
