import { useEffect, useRef, useState, type ReactNode } from "react";
import { AudioSlider } from "./ui/audio-slider";
import { SelectControl } from "./ui/select-control";
import { SidePanel } from "./ui/side-panel";
import { WorkflowGuide } from "./ui/workflow-guide";
import { UpdateControl } from "./ui/update-control";
import { FxStudio, VoiceStudio, MusicEngines } from "./studio";
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
  states,
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
  | "environment"
  | "bridges";
const pages: {
  id: Page;
  name: string;
  icon: typeof Folder;
  caption: string;
}[] = [
  {
    id: "projects",
    name: "Projetos & sessões",
    icon: Folder,
    caption: "Seu espaço de produção",
  },
  {
    id: "queue",
    name: "Fila de geração",
    icon: Activity,
    caption: "Execução & monitoramento",
  },
  {
    id: "library",
    name: "Biblioteca & versões",
    icon: AudioLines,
    caption: "Escuta, comparação & decisão",
  },
  {
    id: "voice",
    name: "Voice Studio",
    icon: Headphones,
    caption: "Perfis, interpretação & versões",
  },
  {
    id: "fx",
    name: "FX & processamento",
    icon: Settings2,
    caption: "Cadeias nativas & render não destrutivo",
  },
  {
    id: "environment",
    name: "Ambiente",
    icon: Cpu,
    caption: "Setup & diagnóstico",
  },
  {
    id: "bridges",
    name: "Audacity & Codex",
    icon: Link2,
    caption: "Pontes do workflow",
  },
];
const date = (value: number) =>
  new Date(value * 1000).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
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
  return (
    <div
      className="waveform"
      role={onSeek ? "slider" : "img"}
      aria-label={`Forma de onda de ${asset.name}`}
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
  const [page, setPage] = useState<Page>("projects");
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [fxAssetId, setFxAssetId] = useState<string>();
  const [compare, setCompare] = useState<string[]>([]);
  const [connection, setConnection] = useState<{
    url: string;
    token: string;
  }>();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [detail, setDetail] = useState<Asset>();
  const [detailOpen, setDetailOpen] = useState(false);
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
    try {
      const state = await rpc<Snapshot>("snapshot");
      setData(state);
    } catch (e) {
      setError(String(e));
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
  const assets =
    data?.assets.filter(
      (a) =>
        a.kind !== "preview" &&
        (!project || a.project_id === project.id) &&
        (!favorites || a.favorite) &&
        a.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    ) ?? [];
  const active = data?.assets.find((a) => a.id === activeId);
  const activeJob = data?.jobs.find((j) =>
    ["loading", "generating", "submitted"].includes(j.state),
  );
  const queued = data?.jobs.filter((j) => j.state === "queued") ?? [];
  const chosen = data?.assets.find(
    (a) => a.selected && a.project_id === project?.id,
  );
  const selectAudio = (asset: Asset) => {
    if (asset.id !== activeId) {
      setPlaying(false);
      setPosition(0);
      setActiveId(asset.id);
    }
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
        setError("Reprodução: " + String(e));
      });
    } else element.pause();
  }, [playing, source]);
  const sendToAudacity = async (asset: Asset) => {
    const value = (await act(
      "audacity_import",
      { asset_id: asset.id },
      "Resultado importado em projeto novo do Audacity.",
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
          LOCAL AUDIO WORKSPACE{" "}
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
        <div className="rail-label">ESPAÇO DE TRABALHO</div>
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
          <span>PROJETO ATIVO</span>
          <SelectControl
            label="Projeto ativo"
            value={project?.id ?? ""}
            disabled={busy}
            onChange={(value) =>
              void act("project_select", { project_id: value })
            }
            placeholder="Selecione um projeto"
            options={
              data?.projects.map((p) => ({ value: p.id, label: p.name })) ?? []
            }
          />
          <small>
            {project
              ? `${project.result_count} resultados locais`
              : "Crie seu primeiro projeto"}
          </small>
        </div>
        <div className="rail-bottom">
          <Badge tone={connection ? "ok" : ""}>
            {connection ? "Núcleo local" : "Conectando núcleo"}
          </Badge>
          <p>
            Direção no Codex.
            <br />
            Produção sob seu controle.
          </p>
          <WorkflowGuide ready={Boolean(data)} />
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={12} />
            <strong>{project?.name ?? "Sonariel"}</strong>
          </div>
          <div className="top-signals">
            <span className="mono">
              <i className="dot" />{" "}
              {page === "voice"
                ? "V3 · CPU"
                : page === "fx"
                  ? "DSP · nativo"
                  : "CPU · DiT-only"}
            </span>
            <span className="mono">
              RAM {data?.telemetry.available_gib.toFixed(1) ?? "—"}{" "}
              <small>GiB livres</small>
            </span>
            <Badge tone={data?.codex.tested ? "ok" : ""}>
              MCP{" "}
              {data?.codex.tested
                ? "testado"
                : data?.codex.configured
                  ? "configurado"
                  : "não configurado"}
            </Badge>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="section-caption">{currentPage.caption}</p>
              <h1>{currentPage.name}</h1>
            </div>
            <div className="heading-actions">
              <button
                className="icon-button"
                title="Atualizar estado"
                onClick={() => void refresh()}
              >
                <RefreshCw size={17} />
              </button>
              {page === "projects" && (
                <button
                  className="primary"
                  onClick={() => {
                    setProjectForm(!projectForm);
                    setProjectName("");
                    setContext("");
                  }}
                >
                  <Plus size={16} /> Novo projeto
                </button>
              )}
              {page === "library" && (
                <button
                  className="primary"
                  onClick={() => setShowRegister(!showRegister)}
                >
                  <Plus size={16} /> Registrar arquivo
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="message error" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Fechar erro"
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="message" role="status">
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Fechar aviso"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading-state">
              <Loader2 className="spin" /> Conectando ao núcleo local…
            </div>
          ) : (
            <>
              {page === "voice" && (
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
                  openFx={(asset) => {
                    setFxAssetId(asset.id);
                    setPage("fx");
                  }}
                />
              )}
              {page === "fx" && (
                <FxStudio
                  key={data.selected_project}
                  data={data}
                  busy={busy}
                  act={act}
                  initialAssetId={fxAssetId}
                  listen={(asset) => {
                    selectAudio(asset);
                    setPlaying(true);
                  }}
                  edit={(asset) => void sendToAudacity(asset)}
                />
              )}
              {page === "projects" && (
                <>
                  {projectForm && (
                    <Panel title="Novo projeto">
                      <form
                        className="form-grid"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void act(
                            "project_create",
                            { name: projectName, context },
                            "Projeto criado.",
                          ).then((value) => {
                            if (value) setProjectForm(false);
                          });
                        }}
                      >
                        <label>
                          Nome do projeto
                          <input
                            required
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder="Nome da produção"
                          />
                        </label>
                        <label className="full">
                          Contexto musical salvo
                          <textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder="Objetivo, função emocional, decisões e limites que o Codex deve consultar."
                          />
                        </label>
                        <button className="primary" disabled={busy}>
                          Criar projeto
                        </button>
                      </form>
                    </Panel>
                  )}
                  <div className="overview-bar">
                    <div>
                      <span className="signal-label">WORKFLOW LOCAL</span>
                      <h2>Do contexto à próxima decisão.</h2>
                      <p>
                        Organize sessões, acompanhe a execução e escute cada
                        versão.
                        <br />A direção musical acontece na sua conversa com o
                        Codex.
                      </p>
                      <button
                        className="outline"
                        onClick={() => setPage("library")}
                      >
                        Abrir biblioteca <ChevronRight size={15} />
                      </button>
                    </div>
                    <div className="overview-readout">
                      <AudioLines size={58} strokeWidth={1} />
                      <dl>
                        <dt>Motor</dt>
                        <dd>
                          {states[data.engine.state] ?? data.engine.state}
                        </dd>
                        <dt>Modo validado</dt>
                        <dd>CPU / Turbo</dd>
                        <dt>Fila persistente</dt>
                        <dd>{queued.length} aguardando</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="two-columns">
                    <Panel
                      title="Projetos"
                      aside={
                        <span className="mono muted">
                          {data.projects.length} locais
                        </span>
                      }
                    >
                      <div className="project-list">
                        {data.projects.length === 0 && (
                          <div className="empty">
                            <Folder size={30} />
                            <h3>Abra um espaço para sua música</h3>
                            <p>
                              Crie um projeto para salvar contexto, sessões e
                              resultados.
                            </p>
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
                                {p.result_count} resultados · {date(p.created)}
                              </p>
                            </div>
                            <ChevronRight size={18} />
                          </button>
                        ))}
                      </div>
                    </Panel>
                    <Panel
                      title={project ? "Sessões de produção" : "Sessões"}
                      aside={<Badge>Contexto compartilhado</Badge>}
                    >
                      {project ? (
                        <>
                          <div className="inset">
                            <h3>{project.name}</h3>
                            <p className="context-preview">
                              {project.context ||
                                "Nenhum contexto musical salvo. O Codex pode registrá-lo explicitamente."}
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
                                </div>
                              ))}
                          </div>
                          <form
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
                              aria-label="Nome da nova sessão"
                              required
                              placeholder="Nome da nova sessão"
                              value={sessionName}
                              onChange={(e) => setSessionName(e.target.value)}
                            />
                            <button className="outline" disabled={busy}>
                              <Plus size={16} /> Criar sessão
                            </button>
                          </form>
                        </>
                      ) : (
                        <div className="empty">
                          <p>Selecione um projeto para organizar sessões.</p>
                        </div>
                      )}
                    </Panel>
                  </div>
                  {chosen && (
                    <Panel
                      title="Escolha atual"
                      aside={<Badge tone="ok">Selecionada</Badge>}
                    >
                      <div className="chosen-row">
                        <button
                          className="play-disc"
                          aria-label="Ouvir escolha atual"
                          onClick={() => {
                            selectAudio(chosen);
                            setPlaying(true);
                          }}
                        >
                          <Play size={22} />
                        </button>
                        <div>
                          <h3>{chosen.name}</h3>
                          <p>{chosen.notes || "Sem observações registradas"}</p>
                        </div>
                        <button
                          className="outline"
                          onClick={() => openDetail(chosen)}
                        >
                          Consultar versão <ChevronRight size={15} />
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
                      <strong>Memória do sistema</strong>
                      <p>
                        Uma geração por vez · batch 1 · modelo carregado sob
                        demanda
                      </p>
                    </div>
                    <div className="memory-values">
                      <b>
                        {data.telemetry.available_gib.toFixed(1)}{" "}
                        <small>
                          / {data.telemetry.total_gib.toFixed(1)} GiB livres
                        </small>
                      </b>
                      <meter
                        min="0"
                        max="100"
                        value={data.telemetry.used_percent}
                        aria-label="Memória RAM utilizada"
                      />
                      <span>{data.telemetry.used_percent}% utilizada</span>
                    </div>
                  </div>
                  <div className="two-columns wide-left">
                    <div>
                      <Panel
                        title="Pipeline de geração"
                        aside={
                          <Badge tone={activeJob ? "working" : ""}>
                            {activeJob ? "Em execução" : "Em espera"}
                          </Badge>
                        }
                        className="engine-panel"
                      >
                        <div className="pipeline">
                          {[
                            "Fila",
                            "Carregamento",
                            "Inferência",
                            "Validação",
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
                              Motor{" "}
                              {states[data.engine.state]?.toLowerCase() ??
                                data.engine.state}
                            </h3>
                            <p>
                              Peça uma geração ao Codex. A tarefa aparece aqui
                              assim que for recebida.
                            </p>
                            <span className="mono">
                              ACE-STEP 1.5 · TURBO · 8 PASSOS / ODE
                            </span>
                          </div>
                        )}
                        <div className="panel-footer">
                          <span className="mono muted">
                            {data.engine.rss_gib.toFixed(2)} GiB no processo do
                            motor
                          </span>
                          <button
                            className="outline"
                            disabled={
                              busy || !!activeJob || !data.engine.managed
                            }
                            onClick={() =>
                              void act("engine_stop", {}, "Motor descarregado.")
                            }
                          >
                            <Square size={12} /> Descarregar motor
                          </button>
                        </div>
                      </Panel>
                      <Panel
                        title="Fila de espera"
                        aside={
                          <span className="mono muted">
                            FIFO · {queued.length} tarefas
                          </span>
                        }
                      >
                        {queued.length === 0 ? (
                          <div className="empty compact">
                            Nenhuma tarefa aguardando.
                          </div>
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
                                      "Processamento local",
                                  ).slice(0, 75)}
                                </strong>
                                <p>
                                  {job.stage} · seed {String(job.params.seed)}
                                </p>
                              </div>
                              <button
                                className="outline"
                                disabled={!!job.remote_id || busy}
                                onClick={() =>
                                  void act("job_cancel", { job_id: job.id })
                                }
                              >
                                Cancelar espera
                              </button>
                            </div>
                          ))
                        )}
                      </Panel>
                      <Panel title="Histórico de execução">
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
                                  {states[job.state]}
                                </Badge>
                                <span className="mono">
                                  {job.id.slice(0, 10)}
                                </span>
                                <span>{date(job.created)}</span>
                                <ChevronRight size={15} />
                              </summary>
                              <JobPanel job={job} />
                            </details>
                          ))}
                        {data.jobs.length === 0 && (
                          <div className="empty compact">
                            O histórico será criado pelas tarefas reais.
                          </div>
                        )}
                      </Panel>
                    </div>
                    <div>
                      <Panel title="Conectores">
                        <div className="connector">
                          <Cpu size={19} />
                          <div>
                            <strong>ACE-Step API</strong>
                            <p className="mono">127.0.0.1:8001</p>
                          </div>
                          <Badge tone={data.engine.managed ? "ok" : ""}>
                            {states[data.engine.state]}
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
                              ? "Disponível"
                              : "Inativo"}
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
                        aria-label="Pesquisar resultados"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Pesquisar resultados…"
                      />
                    </label>
                    <button
                      className={favorites ? "outline selected" : "outline"}
                      onClick={() => setFavorites(!favorites)}
                    >
                      <Star size={15} /> Favoritas
                    </button>
                    <span className="muted">{assets.length} versões</span>
                    <span className="toolbar-end mono">
                      Comparação {compare.length}/2
                    </span>
                  </div>
                  {showRegister && (
                    <Panel title="Catalogar arquivo local">
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
                            },
                            "Arquivo registrado, original preservado.",
                          ).then((value) => {
                            if (value) setShowRegister(false);
                          });
                        }}
                      >
                        <label>
                          Tipo
                          <SelectControl
                            label="Tipo de arquivo"
                            value={registerType}
                            onChange={setRegisterType}
                            options={[
                              { value: "result", label: "Resultado existente" },
                              {
                                value: "reference",
                                label: "Referência musical",
                              },
                            ]}
                          />
                        </label>
                        <label>
                          Nome
                          <input
                            required
                            value={registerName}
                            onChange={(e) => setRegisterName(e.target.value)}
                          />
                        </label>
                        <label className="full">
                          Caminho local absoluto
                          <input
                            required
                            value={registerPath}
                            onChange={(e) => setRegisterPath(e.target.value)}
                          />
                        </label>
                        <button className="primary" disabled={busy || !project}>
                          Registrar arquivo
                        </button>
                      </form>
                    </Panel>
                  )}
                  {compare.length > 0 && (
                    <Panel
                      title="Comparação de candidatos"
                      aside={
                        <button
                          className="text-button"
                          onClick={() => setCompare([])}
                        >
                          Limpar comparação
                        </button>
                      }
                    >
                      <div className="comparison">
                        {compare.map((id, index) => {
                          const asset = data.assets.find((a) => a.id === id);
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
                                    <Headphones size={15} /> Ouvir{" "}
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
                                    RMS {asset.metadata.rms.toFixed(3)}
                                  </span>
                                </div>
                              </div>
                            )
                          );
                        })}
                        {compare.length === 1 && (
                          <div className="comparison-placeholder">
                            <ArrowLeftRight size={24} />
                            <p>Marque outro candidato para comparar.</p>
                          </div>
                        )}
                      </div>
                    </Panel>
                  )}
                  <div className="library-grid">
                    {assets.map((asset) => (
                      <article
                        className={`version-panel ${asset.id === activeId ? "listening" : ""}`}
                        key={asset.id}
                      >
                        <div className="version-top">
                          <span className="mono muted">
                            {asset.kind === "export"
                              ? "EDIÇÃO"
                              : asset.kind === "imported"
                                ? "IMPORTADO"
                                : "GERAÇÃO"}{" "}
                            / {asset.id.slice(0, 6)}
                          </span>
                          <button
                            className={`icon-button ${asset.favorite ? "favorite" : ""}`}
                            aria-label={`Favoritar ${asset.name}`}
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
                            aria-label={`Ouvir ${asset.name}`}
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
                        <div className="data-line">
                          <span>{formatTime(asset.metadata.duration)}</span>
                          <span>
                            {asset.metadata.sample_rate / 1000} kHz ·{" "}
                            {asset.metadata.channels === 2 ? "ST" : "MONO"}
                          </span>
                          <span>
                            {asset.metadata.parameters?.seed
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
                            Comparar
                          </label>
                          {!!asset.selected && (
                            <Badge tone="ok">Selecionada</Badge>
                          )}
                          <button
                            className="text-button"
                            onClick={() => openDetail(asset)}
                          >
                            Detalhes <ChevronRight size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {assets.length === 0 && (
                    <div className="empty library-empty">
                      <AudioLines size={48} />
                      <h2>Sua próxima escuta começa aqui</h2>
                      <p>
                        Os resultados pedidos ao Codex aparecem automaticamente.
                        <br />
                        Você também pode registrar arquivos que já produziu.
                      </p>
                    </div>
                  )}
                </>
              )}

              {page === "environment" && (
                <>
                  <MusicEngines data={data} busy={busy} act={act} />
                  <div className="profile-banner">
                    <ShieldCheck size={31} />
                    <div>
                      <h2>WINDOWS x64 / CPU</h2>
                      <p>
                        Receita versionada · DiT-only · Turbo · uma geração por
                        vez
                      </p>
                    </div>
                    <Badge tone={data.environment?.compatible ? "ok" : ""}>
                      {data.environment?.compatible
                        ? "Ambiente validado"
                        : "Configuração necessária"}
                    </Badge>
                  </div>
                  <div className="two-columns">
                    <Panel
                      title="Vincular ambiente existente"
                      aside={<Badge>Sem reinstalação</Badge>}
                    >
                      <form
                        className="form-stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void act(
                            "environment_link",
                            { root, audacity_path: audacityPath },
                            "Diagnóstico concluído.",
                          );
                        }}
                      >
                        <p className="muted">
                          Inspecione versões, componentes e o patch DiT-only
                          antes de vincular.
                        </p>
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
                          <Search size={15} /> Detectar instalações
                        </button>
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
                        <label>
                          Pasta do ambiente
                          <input
                            required
                            value={root}
                            placeholder={
                              data.environment?.root ??
                              "Pasta com .venv e ACE-Step-1.5"
                            }
                            onChange={(e) => setRoot(e.target.value)}
                          />
                        </label>
                        <label>
                          Executável do Audacity
                          <input
                            required
                            value={audacityPath}
                            placeholder={
                              data.environment?.audacity ??
                              "Caminho completo para Audacity.exe"
                            }
                            onChange={(e) => setAudacityPath(e.target.value)}
                          />
                        </label>
                        <button className="primary" disabled={busy}>
                          Inspecionar e vincular
                        </button>
                      </form>
                    </Panel>
                    <Panel
                      title="Instalar ambiente novo"
                      aside={<Badge>Receita CPU / v1</Badge>}
                    >
                      <div className="form-stack">
                        <p className="muted">
                          Python, dependências CPU, modelos necessários e
                          Audacity portátil. Downloads verificados, instalação
                          retomável.
                        </p>
                        <label>
                          Destino da instalação
                          <input
                            value={destination}
                            placeholder={`${data.data_home}\\engine`}
                            onChange={(e) => setDestination(e.target.value)}
                          />
                        </label>
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
                          Verificar plano de instalação
                        </button>
                        {setupPlan && (
                          <div className="installation-plan">
                            <strong>Plano de instalação</strong>
                            <p>{String(setupPlan.destination)}</p>
                            <ul>
                              {(setupPlan.components as string[]).map(
                                (component) => (
                                  <li key={component}>{component}</li>
                                ),
                              )}
                            </ul>
                            <p>
                              Espaço mínimo: 16 GiB · download aproximado: 7 GiB
                            </p>
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
                                  "Instalação iniciada. Acompanhe as etapas abaixo.",
                                )
                              }
                            >
                              Autorizar e instalar componentes
                            </button>
                          </div>
                        )}
                        {data.setup && (
                          <div className="message">
                            <Loader2 size={16} />
                            <span>
                              {states[data.setup.state] ?? data.setup.state}:{" "}
                              {data.setup.stage}
                            </span>
                          </div>
                        )}
                      </div>
                    </Panel>
                  </div>
                  <Panel
                    title="Inventário e verificações"
                    aside={
                      <span className="mono muted">
                        Versões validadas, sem atualização automática
                      </span>
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
                                <span>{key.replaceAll("_", " ")}</span>
                                <Badge tone={passed ? "ok" : "error"}>
                                  {passed ? "Verificado" : "Falhou"}
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
                                {(model.bytes / 2 ** 30).toFixed(2)} GiB
                              </span>
                              <Badge tone={model.present ? "ok" : "error"}>
                                {model.present ? "Presente" : "Ausente"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                        <div className="panel-footer mono muted">
                          GPU: detecção de hardware disponível no sistema;
                          aceleração ainda não implementada.
                        </div>
                      </>
                    ) : (
                      <div className="empty compact">
                        Nenhum ambiente vinculado. Escolha um dos caminhos
                        acima.
                      </div>
                    )}
                  </Panel>
                  <Panel title="Preferências do motor">
                    <div className="form-stack">
                      <label>
                        Descarregar modelo após ociosidade (minutos)
                        <input
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
                        Não há interrupção automática de inferência. A
                        preferência se aplica ao motor gerenciado e ocioso.
                      </p>
                    </div>
                  </Panel>
                </>
              )}

              {page === "bridges" && (
                <>
                  <div className="bridge-flow">
                    <span>
                      <Terminal size={24} />
                      <strong>Codex</strong>
                      <small>Direção criativa</small>
                    </span>
                    <ChevronRight />
                    <span>
                      <AudioLines size={24} />
                      <strong>Sonariel</strong>
                      <small>Estado & fila local</small>
                    </span>
                    <ChevronRight />
                    <span>
                      <Cpu size={24} />
                      <strong>Motores & FX</strong>
                      <small>Áudio em CPU</small>
                    </span>
                    <ChevronRight />
                    <span>
                      <Headphones size={24} />
                      <strong>Audacity</strong>
                      <small>Edição & exportação</small>
                    </span>
                  </div>
                  <div className="two-columns">
                    <Panel
                      title="Codex MCP / stdio"
                      aside={
                        <Badge tone={data.codex.tested ? "ok" : ""}>
                          {data.codex.tested
                            ? "Handshake testado"
                            : data.codex.configured
                              ? "Configurado"
                              : "Não configurado"}
                        </Badge>
                      }
                    >
                      <div className="form-stack">
                        <p>
                          Uma solicitação no Codex entra diretamente nesta fila.
                          Ferramentas consultam o mesmo banco de dados da
                          interface.
                        </p>
                        <dl className="property-list">
                          <dt>Transporte</dt>
                          <dd>stdio local</dd>
                          <dt>Estado persistente</dt>
                          <dd>SQLite compartilhado</dd>
                          <dt>Último teste</dt>
                          <dd>
                            {data.codex.last_handshake
                              ? `${date(data.codex.last_handshake)} · ${data.codex.client}`
                              : "Nenhum handshake registrado"}
                          </dd>
                        </dl>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              "codex_register",
                              {},
                              "MCP registrado com backup. Recarregue o cliente Codex para disponibilizar as ferramentas.",
                            )
                          }
                        >
                          <Link2 size={16} /> Configurar conexão Codex
                        </button>
                        <p className="muted">
                          A configuração preserva outros servidores. Reinicie ou
                          recarregue o cliente para carregar novas ferramentas.
                          O teste de protocolo é distinto da conexão desta
                          conversa.
                        </p>
                        <code className="code-block">
                          sonariel_environment_status
                          <br />
                          sonariel_projects_list
                          <br />
                          sonariel_generate → job_id
                          <br />
                          sonariel_job_get → resultado
                        </code>
                      </div>
                    </Panel>
                    <Panel
                      title="Audacity / mod-script-pipe"
                      aside={
                        <Badge tone={data.audacity.pipe_available ? "ok" : ""}>
                          {data.audacity.pipe_available
                            ? "Pipe disponível"
                            : "Pipe indisponível"}
                        </Badge>
                      }
                    >
                      <div className="form-stack">
                        <p>
                          Resultados são importados em projetos novos e
                          identificados. Exportações são registradas como
                          versões relacionadas.
                        </p>
                        <label>
                          Executável do Audacity (independente dos motores)
                          <input
                            value={audacityPath}
                            onChange={(e) => setAudacityPath(e.target.value)}
                            placeholder="Caminho absoluto para Audacity.exe"
                          />
                        </label>
                        <button
                          className="outline"
                          disabled={busy || !audacityPath}
                          onClick={() =>
                            void act(
                              "audacity_configure",
                              { executable: audacityPath },
                              "Caminho salvo; módulos e preferências preservados.",
                            )
                          }
                        >
                          Salvar caminho do Audacity
                        </button>
                        <button
                          className="outline"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              "audacity_probe",
                              {},
                              "Leitura do pipe confirmada.",
                            )
                          }
                        >
                          <RefreshCw size={16} /> Testar conexão de leitura
                        </button>
                        <dl className="property-list">
                          <dt>Aplicativo</dt>
                          <dd>
                            {data.audacity.running ? "Aberto" : "Fechado"}
                          </dd>
                          <dt>Resultado no player</dt>
                          <dd>
                            {active?.name ?? "Selecione um áudio na biblioteca"}
                          </dd>
                        </dl>
                        <button
                          className="primary"
                          disabled={!active || busy}
                          onClick={() => active && void sendToAudacity(active)}
                        >
                          <ArrowDownToLine size={16} /> Abrir resultado no
                          Audacity
                        </button>
                        {selectedEdit && (
                          <div className="installation-plan">
                            <strong>Edição registrada</strong>
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
                                  "Cópia exportada e registrada na biblioteca.",
                                )
                              }
                            >
                              Exportar cópia da edição atual
                            </button>
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
            <strong>{active?.name ?? "Selecione um resultado"}</strong>
            <span>
              {active
                ? `${active.metadata.sample_rate / 1000} kHz · ${active.metadata.subtype} · arquivo local`
                : "O player acompanha você em todas as áreas"}
            </span>
          </div>
          {active && (
            <button
              className="icon-button"
              aria-label="Detalhes da faixa em reprodução"
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
              aria-label="Voltar ao início"
              disabled={!active}
              onClick={() => {
                if (audio.current) audio.current.currentTime = 0;
              }}
            >
              <SkipBack size={16} />
            </button>
            <button
              className="transport-play"
              aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
              disabled={!active}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? (
                <Pause size={19} />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
            </button>
            <button
              className="icon-button"
              aria-label="Próximo candidato"
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
              label="Posição de reprodução"
              min={0}
              max={active?.metadata.duration ?? 1}
              step={0.05}
              value={position}
              disabled={!active}
              formatValue={(value) =>
                `${formatTime(value)} de ${formatTime(active?.metadata.duration ?? 0)}`
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
            label="Volume"
            value={volume}
            formatValue={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => {
              setVolume(value);
              if (audio.current) audio.current.volume = value;
            }}
          />
          <span className="mono">LOCAL OUT</span>
        </div>
        <audio
          ref={audio}
          src={source}
          onLoadedMetadata={() => {
            if (audio.current) audio.current.volume = volume;
          }}
          onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            if (source)
              setError("Não foi possível ler o arquivo de áudio local.");
          }}
          preload="metadata"
        />
      </footer>

      <SidePanel
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail?.name ?? "Detalhes da versão"}
        returnFocus={detailReturnFocus}
      >
        {detail && (
          <>
            <p className="mono muted">{detail.id}</p>
            <Waveform asset={detail} />
            <dl className="property-list">
              <dt>Duração</dt>
              <dd>{detail.metadata.duration.toFixed(3)} s</dd>
              <dt>Formato</dt>
              <dd>
                {detail.metadata.sample_rate} Hz · {detail.metadata.subtype}
              </dd>
              <dt>Versão anterior</dt>
              <dd>{detail.parent_id ?? "Versão inicial"}</dd>
              <dt>Arquivo</dt>
              <dd className="file-path">{detail.path}</dd>
            </dl>
            <label>
              Observações
              <textarea
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
                    "Seleção e observações salvas.",
                  ).then((value) => {
                    if (value) setDetail(value as Asset);
                  })
                }
              >
                <Check size={16} /> Selecionar versão
              </button>
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
                    "Observações salvas.",
                  )
                }
              >
                Salvar notas
              </button>
            </div>
            <button
              className="outline full-width"
              disabled={busy}
              onClick={() => void sendToAudacity(detail)}
            >
              <ArrowDownToLine size={16} /> Abrir no Audacity
            </button>
            <h3>Prompt e parâmetros recebidos</h3>
            <p className="muted">
              Somente leitura. A direção musical é feita pelo Codex.
            </p>
            <pre>
              {JSON.stringify(detail.metadata.parameters ?? {}, null, 2)}
            </pre>
          </>
        )}
      </SidePanel>
    </div>
  );
}

function JobPanel({ job }: { job: Job }) {
  const engine = String(job.params._engine ?? "acestep-v15-turbo");
  const duration = job.params.audio_duration ?? job.params.duration;
  const fields = [
    [
      "Duração",
      duration === undefined ? "Conforme fonte / síntese" : `${duration} s`,
    ],
    ["Seed", String(job.params.seed ?? "Não aplicável")],
    [
      "Modo",
      String(
        job.params.task_type ??
          job.params.mode ??
          (engine === "native-fx" ? "DSP nativo" : "Texto para voz"),
      ),
    ],
    ["Modelo", engine],
  ];
  return (
    <div className="job-detail">
      <div className="job-meta">
        <span className="mono">JOB / {job.id.slice(0, 12)}</span>
        <Badge tone={job.state === "completed" ? "ok" : "working"}>
          {job.stage}
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
        <span>tempo decorrido</span>
      </div>
      <p className="readonly-label">
        PARÂMETROS DA SOLICITAÇÃO · SOMENTE LEITURA
      </p>
      <p className="prompt-text">
        {String(
          job.params.prompt ??
            job.params.text ??
            (job.params.recipe as { name?: string })?.name ??
            "Processamento local",
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
          <span>Carga: {job.metrics.load_seconds.toFixed(2)} s</span>
          <span>
            Inferência: {job.metrics.inference_seconds?.toFixed(2) ?? "—"} s
          </span>
          <span>Pico: {job.metrics.peak_rss_gib?.toFixed(2)} GiB</span>
        </div>
      )}
      {job.error && <p className="error-text">{job.error}</p>}
    </div>
  );
}
function EventLog({ data }: { data: Snapshot }) {
  return (
    <Panel
      title="Registro de operações"
      aside={<Terminal size={16} />}
      className="log-panel"
    >
      <div className="event-log">
        {data.events.slice(0, 20).map((event) => (
          <div key={event.id}>
            <time>
              {new Date(event.time * 1000).toLocaleTimeString("pt-BR")}
            </time>
            <span
              className={
                event.kind.includes("error") ? "error-text" : "event-kind"
              }
            >
              {event.kind}
            </span>
            <p>{event.message}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
