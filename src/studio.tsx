import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Headphones,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { rpc, type Asset, type Snapshot, formatTime, states } from "./api";
import { AudioSlider } from "./ui/audio-slider";
import { PathField } from "./ui/path-field";
import { SelectControl } from "./ui/select-control";
import "./studio.css";

type Action = (
  method: string,
  args?: Record<string, unknown>,
  message?: string,
) => Promise<unknown>;
type StudioProps = {
  data: Snapshot;
  busy: boolean;
  act: Action;
  listen: (asset: Asset) => void;
  edit: (asset: Asset) => void;
};
type Profile = {
  id: string;
  name: string;
  language: string;
  reference_id: string | null;
  consent: number;
};
type Effect = { type: string; [key: string]: number | string };
type Stage = { wet: number; effect: Effect };
type Chain = {
  name: string;
  schema_version: number;
  output_channels: number;
  tail_seconds: number;
  bypass: boolean;
  chain: Stage[];
};
type Layer = {
  id: string;
  enabled: boolean;
  chain: Chain;
  [key: string]: string | number | boolean | Chain;
};
type Layered = {
  name: string;
  schema_version: number;
  bypass: boolean;
  wet: number;
  dry_db: number;
  lead_ms: number;
  reverse_swell_ms: number;
  reverse_swell_db: number;
  target_lufs: number;
  ceiling_dbtp: number;
  layers: Layer[];
  master: Chain;
};
type Recipe = Chain | Layered;
type SavedPreset = {
  id: string;
  name: string;
  project_id: string | null;
  recipe: Recipe;
};

export function MusicEngines({
  data,
  busy,
  act,
}: Pick<StudioProps, "data" | "busy" | "act">) {
  const [family, setFamily] = useState("sm-music");
  const [destination, setDestination] = useState("");
  const [python, setPython] = useState("");
  const [source, setSource] = useState("");
  const [models, setModels] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [plan, setPlan] = useState<Record<string, unknown>>();
  const licenseBase =
    "https://huggingface.co/stabilityai/stable-audio-3-optimized/blob/08b17423649b5714b22eab20f96bf00751f2358a/";
  const review = async () => {
    const value = await act("stable_setup_plan", { destination, family });
    if (value) setPlan(value as Record<string, unknown>);
  };
  const changeFamily = (value: string) => {
    setFamily(value);
    setPlan(undefined);
    setAuthorized(false);
  };
  return (
    <section className="panel">
      <header className="panel-title">
        <h2>Music Engines</h2>
        <span className="badge">PADRÃO · TURBO</span>
      </header>
      <div className="studio-body">
        <p className="muted">
          Ambientes independentes; uma tarefa por vez na mesma fila. A escolha
          de motor é explícita em cada solicitação ao Codex, sem trocar o padrão
          musical.
        </p>
        <div className="studio-results">
          {data.engines
            ?.filter((e) => e.category === "music")
            .map((engine) => (
              <div className="studio-result" key={engine.id}>
                <div>
                  <strong>{engine.name}</strong>
                  <p className="muted">
                    {engine.backend} · {engine.license}
                  </p>
                  {engine.id.startsWith("stable-audio") && (
                    <p className="muted">
                      {engine.audio_input_ready
                        ? "Texto até 60 s · áudio de entrada até 120 s, preservando a duração da fonte."
                        : "Texto até 60 s. Áudio de entrada requer encoder SAME-S e resampler; revise o setup LiteRT e vincule novamente."}
                    </p>
                  )}
                </div>
                <span className={`badge ${engine.installed ? "mint" : ""}`}>
                  {engine.tested
                    ? "TESTADO LOCALMENTE"
                    : engine.installed
                      ? "VINCULADO"
                      : engine.id.endsWith("sft")
                        ? "VALIDAÇÃO PENDENTE"
                        : "CONFIGURAR"}
                </span>
              </div>
            ))}
        </div>
        <details className="fx-layer">
          <summary>Configurar Stable Audio 3 · LiteRT CPU experimental</summary>
          <p>
            Powered by Stability AI · texto ou variação de áudio · DiT e codec w8a8. Sem
            garantia de BPM ou tonalidade exatos. A qualidade musical ainda
            depende de escuta.
          </p>
          <p className="muted">
            O setup inclui encoder SAME-S (~61 MiB) e resampler soxr para WAVs
            mono/estéreo. Registre a fonte em Referências e peça ao Codex
            mode=audio2audio com seu source_id. Isso usa o conteúdo da fonte,
            não apenas seu estilo. init_noise_level menor preserva mais a fonte;
            não garante identidade musical nem direitos para distribuição.
          </p>
          <SelectControl
            label="Família Stable Audio"
            value={family}
            onChange={changeFamily}
            options={[
              { value: "sm-music", label: "Small-Music" },
              { value: "medium", label: "Medium" },
            ]}
          />
          <p>
            <a
              href={licenseBase + "LICENSE.md"}
              target="_blank"
              rel="noreferrer"
            >
              Stability Community
            </a>{" "}
            ·{" "}
            <a
              href={licenseBase + "LICENSE_GEMMA.md"}
              target="_blank"
              rel="noreferrer"
            >
              Termos Gemma
            </a>
            . Condições próprias; o aceite não substitui registro ou autorização
            comercial.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />{" "}
            Li e aceito Stability Community e os termos Gemma para este uso.
          </label>
          <PathField label="Nova pasta dedicada fora do Git" kind="directory" disabled={busy}
              value={destination}
              onChange={(value) => {
                setDestination(value);
                setPlan(undefined);
                setAuthorized(false);
              }}
            />
          <button
            className="outline"
            disabled={busy || !destination}
            onClick={() => void review()}
          >
            Revisar receita LiteRT
          </button>
          {plan && (
            <div className="form-stack">
              <p className="muted">
                Python 3.11.15 · LiteRT 2.2.0 · dependências com hashes · cerca
                de 8 GiB em disco. Sem CUDA ou scripts de instalação upstream.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                />{" "}
                Autorizo baixar e instalar nessa pasta.
              </label>
              <button
                className="primary"
                disabled={
                  busy ||
                  !accepted ||
                  !authorized ||
                  !plan.supported ||
                  data.setup?.state === "running"
                }
                onClick={() =>
                  void act(
                    "stable_setup_install",
                    {
                      destination,
                      family,
                      authorized,
                      accepted_licenses: accepted,
                    },
                    "Setup LiteRT iniciado; acompanhe o diagnóstico.",
                  )
                }
              >
                Instalar LiteRT CPU
              </button>
            </div>
          )}
          <details className="fx-layer">
            <summary>Ou vincular instalação existente, sem reinstalar</summary>
            <PathField label="Python isolado" kind="executable" disabled={busy}
              value={python} onChange={setPython} placeholder="Caminho absoluto para Scripts/python.exe" />
            <PathField label="Fonte oficial fixada" kind="directory" disabled={busy}
              value={source} onChange={setSource} />
            <PathField label="Pasta dos modelos" kind="directory" disabled={busy}
              value={models} onChange={setModels} />
            <button
              className="outline"
              disabled={busy || !accepted || !python || !source || !models}
              onClick={() =>
                void act(
                  "stable_environment_link",
                  {
                    python_path: python,
                    source,
                    models,
                    families: [family],
                    accepted_licenses: accepted,
                  },
                  "LiteRT CPU verificado e vinculado.",
                )
              }
            >
              Verificar e vincular LiteRT
            </button>
          </details>
        </details>
      </div>
    </section>
  );
}

const defaults: Record<string, Effect> = {
  gain: { type: "gain", db: -3 },
  fade: { type: "fade", in_ms: 20, out_ms: 100 },
  highpass: { type: "highpass", hz: 80, q: 0.707 },
  lowpass: { type: "lowpass", hz: 6000, q: 0.707 },
  bell: { type: "bell", hz: 1000, q: 1, db: 0 },
  reverb: {
    type: "reverb",
    room_m: 9,
    rt60_s: 1.5,
    damping: 0.55,
    predelay_ms: 25,
  },
  delay: { type: "delay", ms: 180, feedback: 0.3 },
  chorus: {
    type: "chorus",
    seed: 42,
    separation_ms: 18,
    variation_ms: 2,
    rate_hz: 0.25,
  },
};
const labels: Record<string, string> = {
  gain: "Ganho",
  fade: "Entrada e saída",
  highpass: "Passa-altas",
  lowpass: "Passa-baixas",
  bell: "Equalização paramétrica",
  reverb: "Reverb",
  delay: "Delay",
  chorus: "Chorus",
  db: "Ganho (dB)",
  hz: "Frequência (Hz)",
  q: "Q",
  in_ms: "Entrada (ms)",
  out_ms: "Saída (ms)",
  room_m: "Sala (m)",
  rt60_s: "Decaimento (s)",
  damping: "Amortecimento",
  predelay_ms: "Pré-delay (ms)",
  ms: "Tempo (ms)",
  feedback: "Realimentação",
  seed: "Seed",
  separation_ms: "Separação (ms)",
  variation_ms: "Variação (ms)",
  rate_hz: "Modulação (Hz)",
  pitch_st: "Pitch (st)",
  formant_st: "Formantes (st)",
  time_ratio: "Duração (razão)",
  delay_ms: "Microatraso (ms)",
  gain_db: "Ganho (dB)",
  pan: "Panorama",
  ring_hz: "Ring (Hz)",
  ring_depth_start: "Modulação inicial",
  ring_depth_end: "Modulação final",
  dry_db: "Fonte seca (dB)",
  lead_ms: "Pre-roll (ms)",
  reverse_swell_ms: "Swell reverso (ms)",
  reverse_swell_db: "Swell (dB)",
  target_lufs: "Alvo (LUFS)",
  ceiling_dbtp: "Teto (dBTP)",
};
const limits: Record<string, [number, number, number]> = {
  db: [-60, 18, 0.1],
  hz: [10, 20000, 1],
  q: [0.1, 10, 0.01],
  in_ms: [0, 10000, 1],
  out_ms: [0, 10000, 1],
  room_m: [1, 50, 0.1],
  rt60_s: [0.1, 10, 0.1],
  damping: [0, 1, 0.01],
  predelay_ms: [0, 250, 1],
  ms: [1, 2000, 1],
  feedback: [-0.85, 0.85, 0.01],
  seed: [0, 4294967295, 1],
  separation_ms: [2, 50, 0.1],
  variation_ms: [0, 10, 0.1],
  rate_hz: [0.01, 2, 0.01],
  pitch_st: [-12, 12, 0.1],
  formant_st: [-6, 6, 0.1],
  time_ratio: [0.75, 1.5, 0.01],
  delay_ms: [0, 500, 1],
  gain_db: [-60, 0, 0.1],
  pan: [-1, 1, 0.01],
  ring_hz: [0, 160, 1],
  ring_depth_start: [0, 1, 0.01],
  ring_depth_end: [0, 1, 0.01],
  dry_db: [-60, 0, 0.1],
  lead_ms: [0, 1000, 1],
  reverse_swell_ms: [0, 1000, 1],
  reverse_swell_db: [-60, 0, 0.1],
  target_lufs: [-36, -16, 0.1],
  ceiling_dbtp: [-6, -0.5, 0.1],
};
const newChain = (): Chain => ({
  name: "Nova cadeia",
  schema_version: 1,
  output_channels: 2,
  tail_seconds: 2,
  bypass: false,
  chain: [],
});
const isLayered = (recipe: Recipe): recipe is Layered => "layers" in recipe;
const newLayer = (index: number): Layer => ({
  id: `Camada ${index}`,
  enabled: true,
  pitch_st: 0,
  formant_st: 0,
  time_ratio: 1,
  delay_ms: 0,
  gain_db: -6,
  pan: 0,
  ring_hz: 0,
  ring_depth_start: 0,
  ring_depth_end: 0,
  seed: 42,
  chain: { ...newChain(), name: `Camada ${index}`, tail_seconds: 0 },
});
const newLayered = (): Layered => ({
  name: "Nova cadeia em camadas",
  schema_version: 1,
  bypass: false,
  wet: 1,
  dry_db: -60,
  lead_ms: 0,
  reverse_swell_ms: 0,
  reverse_swell_db: -18,
  target_lufs: -26,
  ceiling_dbtp: -1,
  layers: [newLayer(1)],
  master: newChain(),
});

function NumberField({
  name,
  value,
  onChange,
  disabled = false,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const range = limits[name] ?? [-60, 60, 0.1];
  return (
    <label>
      {labels[name] ?? name}
      <input
        type="number"
        min={range[0]}
        max={range[1]}
        step={range[2]}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          if (Number.isFinite(e.target.valueAsNumber))
            onChange(e.target.valueAsNumber);
        }}
      />
    </label>
  );
}

function ChainEditor({
  value,
  onChange,
}: {
  value: Chain;
  onChange: (c: Chain) => void;
}) {
  const [kind, setKind] = useState("gain");
  const wetBackup = useRef(new WeakMap<Effect, number>());
  const update = (index: number, stage: Stage) =>
    onChange({
      ...value,
      chain: value.chain.map((s, i) => (i === index ? stage : s)),
    });
  const move = (index: number, offset: number) => {
    const chain = [...value.chain];
    [chain[index], chain[index + offset]] = [
      chain[index + offset],
      chain[index],
    ];
    onChange({ ...value, chain });
  };
  return (
    <div className="fx-chain">
      <div className="studio-toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={value.bypass}
            onChange={(e) => onChange({ ...value, bypass: e.target.checked })}
          />
          Bypass da cadeia
        </label>
        <label>
          Cauda (s)
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={value.tail_seconds}
            onChange={(e) =>
              onChange({ ...value, tail_seconds: e.target.valueAsNumber || 0 })
            }
          />
        </label>
      </div>
      <ol className="fx-stages">
        {value.chain.map((stage, index) => (
          <li key={index} className={stage.wet === 0 ? "fx-disabled" : ""}>
            <header>
              <label className="check">
                <input
                  type="checkbox"
                  aria-label={`Ativar ${labels[stage.effect.type]} ${index + 1}`}
                  checked={stage.wet > 0}
                  onChange={(e) => {
                    if (!e.target.checked)
                      wetBackup.current.set(stage.effect, stage.wet);
                    update(index, {
                      ...stage,
                      wet: e.target.checked
                        ? (wetBackup.current.get(stage.effect) ?? 1)
                        : 0,
                    });
                  }}
                />
                <strong>
                  {index + 1}. {labels[stage.effect.type] ?? stage.effect.type}
                </strong>
              </label>
              <div className="studio-actions">
                <button
                  className="icon-button"
                  aria-label={`Subir efeito ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Descer efeito ${index + 1}`}
                  disabled={index === value.chain.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Remover efeito ${index + 1}`}
                  onClick={() =>
                    onChange({
                      ...value,
                      chain: value.chain.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </header>
            <div className="fx-fields">
              {Object.entries(stage.effect)
                .filter(([, v]) => typeof v === "number")
                .map(([key, v]) => (
                  <NumberField
                    key={key}
                    name={key}
                    value={v as number}
                    disabled={stage.wet === 0}
                    onChange={(n) =>
                      update(index, {
                        ...stage,
                        effect: { ...stage.effect, [key]: n },
                      })
                    }
                  />
                ))}
            </div>
            <div className="studio-mix">
              <span>
                Dry / wet <output>{Math.round(stage.wet * 100)}%</output>
              </span>
              <AudioSlider
                label={`Mistura do efeito ${index + 1}`}
                value={stage.wet}
                onChange={(wet) => update(index, { ...stage, wet })}
              />
            </div>
          </li>
        ))}
      </ol>
      <div className="studio-toolbar">
        <SelectControl
          label="Efeito para adicionar"
          value={kind}
          onChange={setKind}
          options={Object.keys(defaults).map((value) => ({
            value,
            label: labels[value],
          }))}
        />
        <button
          className="outline"
          disabled={value.chain.length >= 32}
          onClick={() =>
            onChange({
              ...value,
              chain: [
                ...value.chain,
                { wet: 1, effect: { ...defaults[kind] } },
              ],
            })
          }
        >
          <Plus size={15} />
          Adicionar efeito
        </button>
      </div>
    </div>
  );
}

export function FxStudio({
  data,
  busy,
  act,
  listen,
  edit,
  initialAssetId,
}: StudioProps & { initialAssetId?: string }) {
  const [assetId, setAssetId] = useState(initialAssetId ?? "");
  const [recipe, setRecipe] = useState<Recipe>(newChain);
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [presetId, setPresetId] = useState("");
  const [privatePreset, setPrivatePreset] = useState(true);
  const [filePath, setFilePath] = useState("");
  const [exportPath, setExportPath] = useState("");
  const [loadError, setLoadError] = useState("");
  const projectId = data.selected_project;
  const sources = data.assets.filter(
    (a) =>
      a.project_id === projectId &&
      a.kind !== "preview" &&
      a.path.toLowerCase().endsWith(".wav"),
  );
  const selected = data.assets.find(
    (a) => a.id === assetId && a.project_id === projectId,
  );
  const results = data.assets.filter((a) => a.parent_id === selected?.id);
  const [exportId, setExportId] = useState("");
  const exportCandidates = [
    ...(selected ? [selected] : []),
    ...results.filter((a) => a.kind !== "preview"),
  ];
  const exportAsset =
    exportCandidates.find((a) => a.id === exportId) ??
    exportCandidates.find((a) => a.selected) ??
    exportCandidates[0];
  const reload = async () => {
    try {
      setPresets(
        await rpc<SavedPreset[]>(
          "fx_presets_list",
          projectId ? { project_id: projectId } : {},
        ),
      );
      setLoadError("");
    } catch (e) {
      setLoadError(String(e));
    }
  };
  useEffect(() => {
    let ignore = false;
    void rpc<SavedPreset[]>(
      "fx_presets_list",
      projectId ? { project_id: projectId } : {},
    )
      .then((value) => {
        if (!ignore) {
          setPresets(value);
          setLoadError("");
        }
      })
      .catch((e) => {
        if (!ignore) setLoadError(String(e));
      });
    return () => {
      ignore = true;
    };
  }, [projectId]);
  useEffect(() => {
    if (initialAssetId) setAssetId(initialAssetId);
  }, [initialAssetId]);
  const render = (preview: boolean) => {
    if (selected)
      void act(
        "fx_render",
        {
          asset_id: selected.id,
          request_key: crypto.randomUUID(),
          recipe,
          preview,
        },
        preview
          ? "Prévia na fila: até dez segundos da fonte."
          : "Render na fila; original preservado.",
      );
  };
  const pickPreset = (id: string) => {
    setPresetId(id);
    const saved = presets.find((p) => p.id === id);
    if (saved) setRecipe(structuredClone(saved.recipe));
  };
  return (
    <div className="studio-workspace fx-workspace">
      {loadError && (
        <p className="message error" role="alert">
          {loadError}
        </p>
      )}
      <section className="panel">
        <header className="panel-title">
          <h2>Fonte & versões</h2>
          <span className="mono muted">DSP NATIVO · SEM IA</span>
        </header>
        <div className="studio-body">
          <label>
            WAV do projeto
            <SelectControl
              label="WAV para processamento"
              value={selected?.id ?? ""}
              onChange={setAssetId}
              options={sources.map((a) => ({ value: a.id, label: a.name }))}
            />
          </label>
          {!sources.length && (
            <p className="muted">
              Registre um WAV na Biblioteca ou gere um áudio pelo Codex para
              começar.
            </p>
          )}
          {selected && (
            <div className="studio-toolbar">
              <button className="outline" onClick={() => listen(selected)}>
                <Headphones size={15} />
                Ouvir original
              </button>
              <span className="mono muted">
                {formatTime(selected.metadata.duration)} ·{" "}
                {selected.metadata.sample_rate / 1000} kHz
              </span>
            </div>
          )}
          <div className="studio-results">
            {results.map((a) => (
              <div className="studio-result" key={a.id}>
                <div>
                  <strong>{a.name}</strong>
                  <small className="mono muted">
                    {formatTime(a.metadata.duration)} ·{" "}
                    {a.kind === "preview" ? "prévia" : "versão"}
                  </small>
                </div>
                <div className="studio-actions">
                  <button className="outline" onClick={() => listen(a)}>
                    Ouvir versão
                  </button>
                  <button
                    className="outline"
                    disabled={busy || a.kind === "preview"}
                    onClick={() =>
                      void act(
                        "result_feedback",
                        {
                          asset_id: a.id,
                          favorite: !!a.favorite,
                          selected: true,
                          notes: a.notes,
                        },
                        "Versão preferida registrada.",
                      )
                    }
                  >
                    {a.selected ? "Selecionada" : "Preferir"}
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => edit(a)}
                  >
                    Audacity
                  </button>
                </div>
              </div>
            ))}
          </div>
          <SelectControl
            label="Versão para exportar"
            value={exportAsset?.id ?? ""}
            onChange={setExportId}
            options={exportCandidates.map((a) => ({
              value: a.id,
              label: a.name,
            }))}
          />
          <PathField label="Destino do novo WAV" kind="wav-save" disabled={busy}
            placeholder="Caminho absoluto de um arquivo novo" value={exportPath} onChange={setExportPath} />
          <button
            className="outline"
            disabled={busy || !exportAsset || !exportPath}
            onClick={() =>
              void act(
                "result_export",
                { asset_id: exportAsset!.id, destination: exportPath },
                "Cópia WAV exportada e verificada.",
              )
            }
          >
            Exportar WAV
          </button>
        </div>
      </section>
      <section className="panel">
        <header className="panel-title">
          <h2>Cadeia de processamento</h2>
          <span className="mono muted">ORIGINAL IMUTÁVEL</span>
        </header>
        <div className="studio-body">
          <div className="studio-two">
            <label>
              Preset salvo
              <SelectControl
                label="Preset DSP"
                value={presetId}
                onChange={pickPreset}
                options={presets.map((p) => ({
                  value: p.id,
                  label: `${p.name} · ${p.project_id ? "projeto" : "global"}`,
                }))}
              />
            </label>
            <label>
              Nome da revisão
              <input
                value={recipe.name}
                onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
              />
            </label>
          </div>
          {isLayered(recipe) ? (
            <>
              <p className="muted">
                Cadeia em camadas. Pitch, formantes e modulação são
                experimentais para novos materiais. Alterar parâmetros cria uma
                nova interpretação.
              </p>
              <div className="fx-fields">
                {(
                  [
                    "dry_db",
                    "lead_ms",
                    "reverse_swell_ms",
                    "reverse_swell_db",
                    "target_lufs",
                    "ceiling_dbtp",
                  ] as const
                ).map((key) => (
                  <NumberField
                    key={key}
                    name={key}
                    value={recipe[key]}
                    onChange={(value) => setRecipe({ ...recipe, [key]: value })}
                  />
                ))}
              </div>
              <div className="studio-mix">
                <span>
                  Mistura global{" "}
                  <output>{Math.round(recipe.wet * 100)}%</output>
                </span>
                <AudioSlider
                  label="Mistura global da cadeia"
                  value={recipe.wet}
                  onChange={(wet) => setRecipe({ ...recipe, wet })}
                />
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={recipe.bypass}
                  onChange={(e) =>
                    setRecipe({ ...recipe, bypass: e.target.checked })
                  }
                />
                Bypass global
              </label>
              {recipe.layers.map((layer, index) => (
                <details className="fx-layer" key={index}>
                  <summary>
                    {layer.id} · camada {index + 1}
                  </summary>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={layer.enabled}
                      onChange={(e) =>
                        setRecipe({
                          ...recipe,
                          layers: recipe.layers.map((l, i) =>
                            i === index
                              ? { ...l, enabled: e.target.checked }
                              : l,
                          ),
                        })
                      }
                    />
                    Ativar camada
                  </label>
                  <div className="fx-fields">
                    {Object.entries(layer)
                      .filter(([, v]) => typeof v === "number")
                      .map(([key, value]) => (
                        <NumberField
                          key={key}
                          name={key}
                          value={value as number}
                          onChange={(v) =>
                            setRecipe({
                              ...recipe,
                              layers: recipe.layers.map((l, i) =>
                                i === index ? { ...l, [key]: v } : l,
                              ),
                            })
                          }
                        />
                      ))}
                  </div>
                  <ChainEditor
                    value={layer.chain}
                    onChange={(chain) =>
                      setRecipe({
                        ...recipe,
                        layers: recipe.layers.map((l, i) =>
                          i === index ? { ...l, chain } : l,
                        ),
                      })
                    }
                  />
                  <button
                    className="text-button"
                    onClick={() =>
                      setRecipe({
                        ...recipe,
                        layers: recipe.layers.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remover camada
                  </button>
                </details>
              ))}
              <button
                className="outline"
                disabled={recipe.layers.length >= 12}
                onClick={() =>
                  setRecipe({
                    ...recipe,
                    layers: [
                      ...recipe.layers,
                      newLayer(recipe.layers.length + 1),
                    ],
                  })
                }
              >
                <Plus size={15} />
                Adicionar camada
              </button>
              <details className="fx-layer" open>
                <summary>Master · após mistura das camadas</summary>
                <ChainEditor
                  value={recipe.master}
                  onChange={(master) => setRecipe({ ...recipe, master })}
                />
              </details>
            </>
          ) : (
            <ChainEditor value={recipe} onChange={setRecipe} />
          )}
          <div className="studio-toolbar">
            <button
              className="outline"
              disabled={busy || !selected}
              onClick={() => render(true)}
            >
              Renderizar prévia (até 10 s)
            </button>
            <button
              className="primary"
              disabled={busy || !selected}
              onClick={() => render(false)}
            >
              <SlidersHorizontal size={15} />
              Renderizar versão completa
            </button>
          </div>
          <p className="muted">
            Ajustes não iniciam renderizações. Ouça a prévia antes de processar
            um arquivo longo; acompanhe a execução na fila.
          </p>
          <div className="studio-toolbar">
            <label className="check">
              <input
                type="checkbox"
                checked={privatePreset}
                onChange={(e) => setPrivatePreset(e.target.checked)}
              />
              Salvar apenas neste projeto
            </label>
            <button
              className="outline"
              disabled={busy || !recipe.name || (privatePreset && !projectId)}
              onClick={() =>
                void act(
                  "fx_preset_save",
                  {
                    name: recipe.name,
                    recipe,
                    ...(privatePreset && projectId
                      ? { project_id: projectId }
                      : {}),
                  },
                  "Nova revisão de preset salva.",
                ).then(reload)
              }
            >
              Salvar nova revisão
            </button>
            <button
              className="text-button"
              onClick={() => {
                setRecipe(newChain());
                setPresetId("");
              }}
            >
              Nova cadeia vazia
            </button>
            <button
              className="text-button"
              onClick={() => {
                setRecipe(newLayered());
                setPresetId("");
              }}
            >
              Nova cadeia em camadas
            </button>
          </div>
          <details className="fx-layer">
            <summary>Importar / compartilhar preset JSON</summary>
            <PathField label="Caminho JSON local" kind="preset" disabled={busy}
              value={filePath} onChange={setFilePath} />
            <div className="studio-toolbar">
              <button
                className="outline"
                disabled={busy || !filePath}
                onClick={() =>
                  void act(
                    "fx_preset_import",
                    {
                      path: filePath,
                      ...(privatePreset && projectId
                        ? { project_id: projectId }
                        : {}),
                    },
                    "Preset importado.",
                  ).then(reload)
                }
              >
                Importar JSON
              </button>
              <button
                className="outline"
                disabled={busy || !filePath || !presetId}
                onClick={() =>
                  void act(
                    "fx_preset_export",
                    { preset_id: presetId, destination: filePath },
                    "Preset exportado sem sobrescrita.",
                  )
                }
              >
                Exportar preset salvo
              </button>
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}

export function VoiceStudio({
  data,
  busy,
  act,
  listen,
  edit,
  openFx,
}: StudioProps & { openFx: (asset: Asset) => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("");
  const [reference, setReference] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [python, setPython] = useState("");
  const [models, setModels] = useState("");
  const [destination, setDestination] = useState("");
  const [installAuthorized, setInstallAuthorized] = useState(false);
  const [plan, setPlan] = useState<Record<string, unknown>>();
  const projectId = data.selected_project;
  const engine = data.engines?.find((e) => e.category === "voice");
  const results = data.assets.filter(
    (a) => a.project_id === projectId && a.kind === "voice",
  );
  const jobs = data.jobs.filter(
    (j) => j.project_id === projectId && j.params._engine === "chatterbox-v3",
  );
  useEffect(() => {
    let ignore = false;
    setProfiles([]);
    setLoadError("");
    if (projectId)
      void rpc<Profile[]>("voice_profiles_list", { project_id: projectId })
        .then((v) => {
          if (!ignore) setProfiles(v);
        })
        .catch((e) => {
          if (!ignore) setLoadError(String(e));
        });
    return () => {
      ignore = true;
    };
  }, [projectId]);
  const saveProfile = async () => {
    if (!projectId) return;
    let referenceId: string | undefined;
    if (reference) {
      const saved = (await act("reference_register", {
        project_id: projectId,
        name: `Referência · ${name}`,
        path: reference,
      })) as Asset | undefined;
      if (!saved) return;
      referenceId = saved.id;
    }
    const saved = (await act(
      "voice_profile_save",
      {
        project_id: projectId,
        name,
        language,
        ...(referenceId ? { reference_id: referenceId, authorized } : {}),
      },
      "Perfil salvo. Identidade entre falas ainda requer avaliação.",
    )) as Profile | undefined;
    if (saved) {
      setProfiles((p) => [...p, saved]);
      setName("");
      setReference("");
      setAuthorized(false);
    }
  };
  return (
    <div className="studio-workspace">
      {loadError && (
        <p className="message error" role="alert">
          {loadError}
        </p>
      )}
      <section className="panel">
        <header className="panel-title">
          <h2>Motor vocal</h2>
          <span className={`badge ${engine?.installed ? "mint" : ""}`}>
            {engine?.installed ? "VINCULADO" : "CONFIGURAR"}
          </span>
        </header>
        <div className="studio-body">
          <div>
            <h3>Chatterbox Multilingual V3</h3>
            <p className="muted">
              CPU · uma geração por vez · marca d’água oficial preservada
            </p>
          </div>
          <p>
            Peça a geração ao Codex com idioma, texto exato, seed e perfil
            opcional. Grafias estilizadas são enviadas sem correção automática
            ou adição de conteúdo.
          </p>
          <details className="fx-layer" open={!engine?.installed}>
            <summary>Vincular ambiente isolado existente</summary>
            <PathField label="Python do ambiente" kind="executable" disabled={busy}
              value={python} onChange={setPython} placeholder="Caminho absoluto para Scripts/python.exe" />
            <PathField label="Pasta dos checkpoints" kind="directory" disabled={busy}
              value={models} onChange={setModels} />
            <button
              className="outline"
              disabled={busy || !python || !models}
              onClick={() =>
                void act(
                  "voice_environment_link",
                  { python_path: python, models },
                  "Ambiente V3 verificado e vinculado, sem alterações.",
                )
              }
            >
              Verificar e vincular V3
            </button>
          </details>
          <details className="fx-layer">
            <summary>Instalar V3 CPU em pasta dedicada</summary>
            <PathField label="Nova pasta fora de repositórios" kind="directory" disabled={busy}
                value={destination}
                onChange={(value) => {
                  setDestination(value);
                  setPlan(undefined);
                  setInstallAuthorized(false);
                }}
              />
            <PathField label="Cache local de checkpoints (opcional)" kind="directory" disabled={busy}
              value={models} onChange={setModels} />
            <button
              className="outline"
              disabled={busy || !destination}
              onClick={() =>
                void act("voice_setup_plan", { destination }).then((p) => {
                  if (p) setPlan(p as Record<string, unknown>);
                })
              }
            >
              Revisar receita de voz
            </button>
            {plan && (
              <>
                <p>
                  Python 3.11.15, PyTorch CPU 2.6.0, V3 e PerTh fixados. Pelo
                  menos 14 GiB de disco. Código e pesos MIT; dependências têm
                  avisos próprios.
                </p>
                <p className="muted">
                  Receita headless: não instala a UI Gradio nem os
                  pré-processadores opcionais chinês/japonês. Os idiomas
                  declarados pelo modelo não representam caminhos todos
                  testados.
                </p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={installAuthorized}
                    onChange={(e) => setInstallAuthorized(e.target.checked)}
                  />
                  Autorizo a instalação isolada nesta pasta
                </label>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !installAuthorized ||
                    data.setup?.state === "running"
                  }
                  onClick={() =>
                    void act(
                      "voice_setup_install",
                      { destination, authorized: true, model_cache: models },
                      "Instalação de voz iniciada; acompanhe o diagnóstico.",
                    )
                  }
                >
                  Instalar ambiente V3
                </button>
              </>
            )}
            {data.setup && (
              <p className="mono muted" role="status">
                {states[data.setup.state] ?? data.setup.state}:{" "}
                {data.setup.stage}
              </p>
            )}
          </details>
          {jobs[0] && (
            <div className="studio-request">
              <div className="studio-toolbar">
                <strong>Última solicitação</strong>
                <span className="mono muted">
                  {states[jobs[0].state]} · {jobs[0].stage}
                </span>
              </div>
              <label>
                Texto original / exibido
                <textarea
                  readOnly
                  value={String(jobs[0].params.original_text ?? "")}
                />
              </label>
              <label>
                Texto solicitado ao TTS
                <textarea readOnly value={String(jobs[0].params.text ?? "")} />
              </label>
              <pre>
                {JSON.stringify(
                  {
                    language: jobs[0].params.language,
                    seed: jobs[0].params.seed,
                    expressivity: jobs[0].params.expressivity,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          )}
        </div>
      </section>
      <section className="panel">
        <header className="panel-title">
          <h2>Perfis do projeto</h2>
          <span className="mono muted">{profiles.length} PERFIS</span>
        </header>
        <div className="studio-body">
          {!projectId ? (
            <p>Selecione um projeto para organizar as vozes.</p>
          ) : (
            <>
              <div className="studio-results">
                {profiles.map((p) => (
                  <div className="studio-result" key={p.id}>
                    <strong>{p.name}</strong>
                    <span className="mono muted">
                      {p.language} ·{" "}
                      {p.reference_id
                        ? "referência autorizada"
                        : "voz padrão do motor"}{" "}
                      · {p.id.slice(0, 8)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="studio-two">
                <label>
                  Nome do perfil
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Idioma explícito
                  <SelectControl
                    label="Idioma do perfil vocal"
                    value={language}
                    onChange={setLanguage}
                    options={Object.entries(engine?.languages ?? {}).map(
                      ([value, label]) => ({
                        value,
                        label: `${label} (${value})`,
                      }),
                    )}
                  />
                </label>
              </div>
              <PathField label="Referência vocal própria/autorizada (opcional)" kind="audio" disabled={busy}
                value={reference} onChange={setReference} placeholder="Caminho local do áudio" />
              <label className="check">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                />
                Tenho autorização para utilizar esta referência vocal
              </label>
              <button
                className="outline"
                disabled={
                  busy || !name || !language || (!!reference && !authorized)
                }
                onClick={() => void saveProfile()}
              >
                Salvar perfil vocal
              </button>
              <p className="muted">
                O perfil registra idioma e referência. Consistência de
                identidade e pronúncia não são garantidas sem escuta
                comparativa.
              </p>
            </>
          )}
        </div>
      </section>
      <section className="panel">
        <header className="panel-title">
          <h2>Interpretações & comparação</h2>
          <span className="mono muted">{results.length} RESULTADOS</span>
        </header>
        <div className="studio-body">
          {!results.length && (
            <p className="muted">
              As interpretações solicitadas pelo Codex aparecerão aqui.
              Compare-as no player e preserve a versão preferida.
            </p>
          )}
          <div className="studio-results">
            {results.map((asset) => (
              <div className="studio-result" key={asset.id}>
                <div>
                  <strong>{asset.name}</strong>
                  <small className="mono muted">
                    {formatTime(asset.metadata.duration)} ·{" "}
                    {asset.metadata.sample_rate / 1000} kHz ·{" "}
                    {asset.metadata.parameters?.language as string}
                  </small>
                </div>
                <div className="studio-actions">
                  <button className="outline" onClick={() => listen(asset)}>
                    Ouvir
                  </button>
                  <button
                    className="outline"
                    disabled={busy}
                    onClick={() =>
                      void act("result_feedback", {
                        asset_id: asset.id,
                        favorite: !!asset.favorite,
                        selected: true,
                        notes: asset.notes,
                      })
                    }
                  >
                    {asset.selected ? "Preferida" : "Preferir"}
                  </button>
                  <button className="outline" onClick={() => openFx(asset)}>
                    Abrir em FX
                  </button>
                  <button className="text-button" onClick={() => edit(asset)}>
                    Audacity
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="muted">
            Use Biblioteca & versões para comparação A/B, notas e exportações.
            Efeitos criam versões novas; o áudio-base permanece intacto.
          </p>
        </div>
      </section>
    </div>
  );
}
