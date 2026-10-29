import { systemMessage } from "./i18n/system-message";
import { RecommendedMusic } from "./recommended-music";
import { tr, languageName } from "./i18n";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Headphones,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { rpc, type Asset, type Snapshot, formatTime, stateLabel } from "./api";
import { AudioSlider } from "./ui/audio-slider";
import { PathField } from "./ui/path-field";
import { SelectControl } from "./ui/select-control";
import { StatusBadge, Requirements } from "./ui/help-tip";
import "./studio.css";
import { LoopStudio } from "./loop-studio";
import { AgentHandoff } from "./workflow-guidance";

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
  prepareSetup = false,
}: Pick<StudioProps, "data" | "busy" | "act"> & { prepareSetup?: boolean }) {
  useTranslation();
  const [family, setFamily] = useState("sm-music");
  const [quality, setQuality] = useState("compact");
  const stableSetupDetails = useRef<HTMLDetailsElement>(null);
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
    const value = await act("stable_setup_plan", { destination, family, quality_profile: quality });
    if (value) setPlan(value as Record<string, unknown>);
  };
  const changeFamily = (value: string) => {
    setFamily(value);
    setQuality("compact");
    setPlan(undefined);
    setAuthorized(false);
  };
  return (
    <section className="panel">
      <header className="panel-title">
        <h2>{tr("studio", "musicEngines")}</h2>
        <span className="badge">{tr("studio", "defaultTurbo")}</span>
      </header>
      <div className="studio-body">
        <Requirements required={tr("experience", "musicRequired")} optional={tr("experience", "editorOptional")} />
        <RecommendedMusic data={data} prepare={() => {
          setFamily("medium"); setQuality("fidelity"); setPlan(undefined); setAuthorized(false);
          if (stableSetupDetails.current) {
            stableSetupDetails.current.open = true;
            stableSetupDetails.current.scrollIntoView?.({ block: "start" });
          }
        }} />
        <details className="technical-details"><summary>{tr("experience", "inspectEngines")}</summary><div className="studio-results">
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
                        ? tr("studio", "textUpTo60SSourceAudioUp")
                        : tr("studio", "textUpTo60SSourceAudioRequires")}
                    </p>
                  )}
                  {engine.id === "stable-audio-3-medium" && <p className="muted">{tr("studio", engine.quality_profiles?.includes("fidelity") ? "fidelityAvailable" : "fidelityOptional")}</p>}
                </div>
                <div>
                  <StatusBadge tone={engine.installed && engine.compatible ? "ok" : ""} help={tr("experience", engine.blocked_reason ? "musicBlockedHelp" : "musicStatusHelp")} label={tr("experience", "statusHelpLabel")}>
                    {engine.blocked_reason ? tr("studio", "validationPending") : engine.installed
                      ? tr("studio", engine.compatible ? "linked" : "needsVerification") : tr("studio", "setUp")}
                  </StatusBadge>
                  {engine.tested && <p className="mono muted">{tr("studio", "executionRecorded")}</p>}
                </div>
              </div>
            ))}
        </div></details>
        <details className="technical-details"><summary>{tr("experience", "advancedDetails")}</summary>
          <p className="muted">{tr("studio", "engineStateScope")}</p>
        </details>
        <details ref={stableSetupDetails} className="fx-layer" open={prepareSetup || undefined}>
          <summary>{tr("studio", "setUpStableAudio3ExperimentalLitertCpu")}</summary>
            <div className="disclosure-body">
          <p>
            {tr("studio", quality === "fidelity" ? "fidelityIntro" : "poweredByStabilityAiTextOrAudioVariation")}</p>
          {quality === "compact" && <details className="technical-details"><summary>{tr("experience", "advancedDetails")}</summary><p className="muted">
            {tr("studio", "setupIncludesTheSameSEncoder61Mib")}</p></details>
          }
          <SelectControl
            label={tr("studio", "stableAudioFamily")}
            value={family}
            onChange={changeFamily}
            options={[
              { value: "sm-music", label: "Small-Music" },
              { value: "medium", label: "Medium" },
            ]}
          />
          {family === "medium" && <SelectControl label={tr("studio", "qualityProfile")} value={quality}
            disabled={busy} onChange={value => { setQuality(value); setPlan(undefined); setAuthorized(false); }}
            options={[{ value: "compact", label: tr("studio", "compactProfile") }, { value: "fidelity", label: tr("studio", "fidelityProfile") }]} />}
          {family === "medium" && <p className="muted">{tr("studio", "fidelityProfileHelp")}</p>}
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
              {tr("studio", "gemmaTerms")}</a>
            {tr("studio", "separateConditionsApplyAcceptanceDoesNotReplaceCommercial")}</p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />{" "}
            {tr("studio", "iHaveReadAndAcceptStabilityCommunityAnd")}</label>
          <PathField label={tr("studio", "newDedicatedFolderOutsideGit")} kind="directory" disabled={busy}
              requirement="required" help={tr("experience", "folderHelp")}
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
            {tr("studio", "reviewLitertRecipe")}</button>
          {plan && (
            <div className="form-stack">
              <p>{tr("studio", quality === "fidelity" ? "fidelityDownload" : "compactDownload")}</p>
              <p className="muted">
                {tr("studio", "python31115Litert220")}</p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                />{" "}
                {tr("studio", "iAuthorizeDownloadingAndInstallingInThisFolder")}</label>
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
                      quality_profile: quality,
                      authorized,
                      accepted_licenses: accepted,
                    },
                    tr("studio", "litertSetupStartedFollowDiagnostics"),
                  )
                }
              >
                {tr("studio", "installLitertCpu")}</button>
            </div>
          )}
          <details className="fx-layer">
            <summary>{tr("studio", "orLinkAnExistingInstallationWithoutReinstalling")}</summary>
            <div className="disclosure-body">
            <PathField label={tr("studio", "isolatedPython")} kind="executable" disabled={busy}
              requirement="required"
              value={python} onChange={setPython} placeholder={tr("studio", "absolutePathToScriptsPythonExe")} />
            <PathField label={tr("studio", "pinnedOfficialSource")} kind="directory" disabled={busy}
              requirement="required"
              value={source} onChange={setSource} />
            <PathField label={tr("studio", "modelFolder")} kind="directory" disabled={busy}
              requirement="required"
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
                  tr("studio", "litertCpuVerifiedAndLinked"),
                )
              }
            >
              {tr("studio", "verifyAndLinkLitert")}</button>
          </div>
          </details>
        </div>
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
const getLabels = (): Record<string, string> => ({
  gain: tr("studio", "gain"),
  fade: tr("studio", "fadeInAndOut"),
  highpass: tr("studio", "highPass"),
  lowpass: tr("studio", "lowPass"),
  bell: tr("studio", "parametricEq"),
  reverb: "Reverb",
  delay: "Delay",
  chorus: "Chorus",
  db: tr("studio", "gainDb"),
  hz: tr("studio", "frequencyHz"),
  q: "Q",
  in_ms: tr("studio", "fadeInMs"),
  out_ms: tr("studio", "fadeOutMs"),
  room_m: tr("studio", "roomM"),
  rt60_s: tr("studio", "decayS"),
  damping: tr("studio", "damping"),
  predelay_ms: tr("studio", "predelayMs"),
  ms: tr("studio", "timeMs"),
  feedback: tr("studio", "feedback"),
  seed: "Seed",
  separation_ms: tr("studio", "separationMs"),
  variation_ms: tr("studio", "variationMs"),
  rate_hz: tr("studio", "modulationHz"),
  pitch_st: "Pitch (st)",
  formant_st: tr("studio", "formantsSt"),
  time_ratio: tr("studio", "durationRatio"),
  delay_ms: tr("studio", "microdelayMs"),
  gain_db: tr("studio", "gainDb"),
  pan: tr("studio", "pan"),
  ring_hz: "Ring (Hz)",
  ring_depth_start: tr("studio", "initialModulation"),
  ring_depth_end: tr("studio", "finalModulation"),
  dry_db: tr("studio", "drySourceDb"),
  lead_ms: "Pre-roll (ms)",
  reverse_swell_ms: tr("studio", "reverseSwellMs"),
  reverse_swell_db: "Swell (dB)",
  target_lufs: tr("studio", "targetLufs"),
  ceiling_dbtp: tr("studio", "ceilingDbtp"),
});
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
  name: tr("studio", "newChain"),
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
  chain: { ...newChain(), name: tr("studio", "layerValue", { value0: index }), tail_seconds: 0 },
});
const newLayered = (): Layered => ({
  name: tr("studio", "newLayeredChain"),
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
  useTranslation();
  const range = limits[name] ?? [-60, 60, 0.1];
  const labels = getLabels();
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
  useTranslation();
  const [kind, setKind] = useState("gain");
  const labels = getLabels();
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
          {tr("studio", "chainBypass")}</label>
        <label>
          {tr("studio", "tailS")}<input
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
                  aria-label={tr("studio", "enableValueValue", { value0: labels[stage.effect.type], value1: index + 1 })}
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
                  aria-label={tr("studio", "moveEffectValueUp", { value0: index + 1 })}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="icon-button"
                  aria-label={tr("studio", "moveEffectValueDown", { value0: index + 1 })}
                  disabled={index === value.chain.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="icon-button"
                  aria-label={tr("studio", "removeEffectValue", { value0: index + 1 })}
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
                {tr("studio", "dryWet")}{" "}<output>{Math.round(stage.wet * 100)}%</output>
              </span>
              <AudioSlider
                label={tr("studio", "effectValueMix", { value0: index + 1 })}
                value={stage.wet}
                onChange={(wet) => update(index, { ...stage, wet })}
              />
            </div>
          </li>
        ))}
      </ol>
      <div className="studio-toolbar">
        <SelectControl
          label={tr("studio", "effectToAdd")}
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
          {tr("studio", "addEffect")}</button>
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
  importAudio,
}: StudioProps & { initialAssetId?: string; importAudio?: () => void }) {
  useTranslation();
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
  const results = selected ? data.assets.filter((a) => a.parent_id === selected.id && a.project_id === projectId) : [];
  const [exportId, setExportId] = useState("");
  const exportCandidates = [
    ...(selected ? [selected] : []),
    ...results.filter((a) => a.kind !== "preview"),
  ];
  const exportAsset = exportCandidates.find((a) => a.id === exportId);
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
    if (initialAssetId) { setAssetId(initialAssetId); setExportId(""); }
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
          ? tr("studio", "previewQueuedUpToTenSecondsOfThe")
          : tr("studio", "renderQueuedOriginalPreserved"),
      );
  };
  const pickPreset = (id: string) => {
    setPresetId(id);
    const saved = presets.find((p) => p.id === id);
    if (saved) setRecipe(structuredClone(saved.recipe));
  };
  return (
    <div className="studio-workspace fx-workspace">
      <Requirements required={tr("experience", "fxRequired")} optional={tr("experience", "fxOptional")} />
      {!selected && <div className="panel studio-body"><h2>{tr("experience", "fxStart")}</h2>
        <p>{tr("experience", "fxNoSource")}</p>
        {importAudio && <button className="primary" onClick={importAudio}>{tr("experience", data.selected_project ? "openImport" : "chooseProject")}</button>}
      </div>}
      {loadError && (
        <p className="message error" role="alert">
          {systemMessage(loadError)}
        </p>
      )}
      <section className="panel">
        <header className="panel-title">
          <h2>{tr("studio", "sourceVersions")}</h2>
          <span className="mono muted">{tr("studio", "nativeDspNoAi")}</span>
        </header>
        <div className="studio-body">
          <label>
            {tr("studio", "projectWav")}<SelectControl
              label={tr("studio", "wavToProcess")}
              value={selected?.id ?? ""}
              onChange={setAssetId}
              options={sources.map((a) => ({ value: a.id, label: a.name }))}
            />
          </label>
          {!sources.length && (
            <p className="muted">
              {tr("studio", "registerAWavInTheLibraryOrGenerate")}</p>
          )}
          {selected && (
            <div className="studio-toolbar">
              <button className="outline" onClick={() => listen(selected)}>
                <Headphones size={15} />
                {tr("studio", "playOriginal")}</button>
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
                    {a.kind === "preview" ? tr("studio", "preview") : tr("studio", "version")}
                  </small>
                </div>
                <div className="studio-actions">
                  <button className="outline" onClick={() => listen(a)}>
                    {tr("studio", "playVersion")}</button>
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
                        tr("studio", "preferredVersionRecorded"),
                      )
                    }
                  >
                    {a.selected ? tr("studio", "selected") : tr("studio", "prefer")}
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

        </div>
      </section>
      <section className="panel" hidden={!selected}>
        <header className="panel-title">
          <h2>{tr("studio", "processingChain")}</h2>
          <span className="mono muted">{tr("studio", "immutableOriginal")}</span>
        </header>
        <div className="studio-body">
          <div className="studio-two">
            <label>
              {tr("studio", "savedPreset")}<SelectControl
                label={tr("studio", "dspPreset")}
                value={presetId}
                onChange={pickPreset}
                options={presets.map((p) => ({
                  value: p.id,
                  label: `${p.name} · ${p.project_id ? tr("studio", "project") : "global"}`,
                }))}
              />
            </label>
            <label>
              {tr("studio", "revisionName")}<input
                value={recipe.name}
                onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
              />
            </label>
          </div>
          {isLayered(recipe) ? (
            <>
              <p className="muted">
                {tr("studio", "layeredChainPitchFormantsAndModulationAreExperimental")}</p>
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
                  {tr("studio", "globalMix")}{" "}
                  <output>{Math.round(recipe.wet * 100)}%</output>
                </span>
                <AudioSlider
                  label={tr("studio", "globalChainMix")}
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
                {tr("studio", "globalBypass")}</label>
              {recipe.layers.map((layer, index) => (
                <details className="fx-layer" key={index}>
                  <summary>
                    {layer.id} {tr("studio", "layer")}{" "}{index + 1}
                  </summary>
            <div className="disclosure-body">
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
                    {tr("studio", "enableLayer")}</label>
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
                    {tr("studio", "removeLayer")}</button>
                </div>
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
                {tr("studio", "addLayer")}</button>
              <details className="fx-layer" open>
                <summary>{tr("studio", "masterAfterLayerMixing")}</summary>
            <div className="disclosure-body">
                <ChainEditor
                  value={recipe.master}
                  onChange={(master) => setRecipe({ ...recipe, master })}
                />
              </div>
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
              {tr("studio", "renderPreviewUpTo10S")}</button>
            <button
              className="primary"
              disabled={busy || !selected}
              onClick={() => render(false)}
            >
              <SlidersHorizontal size={15} />
              {tr("studio", "renderFullVersion")}</button>
          </div>
          <p className="muted">
            {tr("studio", "adjustmentsDoNotStartRenderingListenToA")}</p>
          <div className="studio-toolbar">
            <label className="check">
              <input
                type="checkbox"
                checked={privatePreset}
                onChange={(e) => setPrivatePreset(e.target.checked)}
              />
              {tr("studio", "saveInThisProjectOnly")}</label>
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
                  tr("studio", "newPresetRevisionSaved"),
                ).then(reload)
              }
            >
              {tr("studio", "saveNewRevision")}</button>
            <button
              className="text-button"
              onClick={() => {
                setRecipe(newChain());
                setPresetId("");
              }}
            >
              {tr("studio", "newEmptyChain")}</button>
            <button
              className="text-button"
              onClick={() => {
                setRecipe(newLayered());
                setPresetId("");
              }}
            >
              {tr("studio", "newLayeredChain")}</button>
          </div>
          <details className="fx-layer">
            <summary>{tr("studio", "importShareJsonPreset")}</summary>
            <div className="disclosure-body">
            <PathField label={tr("studio", "localJsonPath")} kind="preset" disabled={busy}
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
                    tr("studio", "presetImported"),
                  ).then(reload)
                }
              >
                {tr("studio", "importJson")}</button>
              <button
                className="outline"
                disabled={busy || !filePath || !presetId}
                onClick={() =>
                  void act(
                    "fx_preset_export",
                    { preset_id: presetId, destination: filePath },
                    tr("studio", "presetExportedWithoutOverwriting"),
                  )
                }
              >
                {tr("studio", "exportSavedPreset")}</button>
            </div>
          </div>
          </details>
        </div>
      </section>
      <section className="panel" hidden={!selected}>
        <header className="panel-title"><h2>{tr("studio", "exportWavCopy")}</h2></header>
        <div className="studio-body">
          <SelectControl
            label={tr("studio", "versionToExport")}
            value={exportAsset?.id ?? ""}
            onChange={setExportId}
            placeholder={tr("studio", "chooseExportVersion")}
            options={exportCandidates.map((a) => ({
              value: a.id,
              label: `${a.name} · ${tr("studio", a.id === selected?.id ? "exportSource" : "exportProcessed")} · ${formatTime(a.metadata.duration)} · ${a.id.slice(0, 8)}`,
            }))}
          />
          <p className="muted">{tr("studio", "explicitExportHelp")}</p>
          {exportId && !exportAsset && <p role="status">{tr("studio", "exportSelectionMissing")}</p>}
          {exportAsset && <div className="message" aria-live="polite">
            <div><strong>{exportAsset.name}</strong>
              <p>{tr("studio", exportAsset.id === selected?.id ? "exportSource" : "exportProcessed")} · {formatTime(exportAsset.metadata.duration)}</p>
              <code>{exportAsset.id}</code><p><code>{exportAsset.path}</code></p>
              <p>{tr("studio", "newWavDestination")}: <code>{exportPath || "—"}</code></p>
            </div>
          </div>}
          <PathField label={tr("studio", "newWavDestination")} kind="wav-save" disabled={busy}
            placeholder={tr("studio", "absolutePathForANewFile")} value={exportPath} onChange={setExportPath} />
          <button
            className="outline"
            disabled={busy || !exportAsset || !exportPath}
            onClick={() =>
              void act(
                "result_export",
                { asset_id: exportAsset!.id, destination: exportPath },
                tr("studio", "wavCopyExportedAndVerified"),
              )
            }
          >
            {tr("studio", "exportWav")}</button>
        </div>
      </section>
      {data.capabilities?.loop_creation === true && <LoopStudio source={selected} busy={busy} act={act} />}
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
  openProjects,
  openConnection,
}: StudioProps & { openFx: (asset: Asset) => void; openProjects?: () => void; openConnection?: () => void }) {
  useTranslation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [voiceSetupOpen, setVoiceSetupOpen] = useState(false);
  const [profileFormOpen, setProfileFormOpen] = useState(false);
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
        name: tr("studio", "referenceValue", { value0: name }),
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
      tr("studio", "profileSavedIdentityAcrossUtterancesStillRequiresAssessment"),
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
      <AgentHandoff data={data} kind="voice" projects={openProjects} connection={openConnection} />
      {loadError && (
        <p className="message error" role="alert">
          {systemMessage(loadError)}
        </p>
      )}
      <section className="panel">
        <header className="panel-title">
          <h2>{tr("studio", "voiceEngine")}</h2>
          <StatusBadge tone={engine?.installed && engine.compatible ? "ok" : ""} help={tr("experience", "voiceStatusHelp")} label={tr("experience", "statusHelpLabel")}>
            {engine?.installed ? tr("studio", engine.compatible ? "linked" : "needsVerification") : tr("studio", "setUp")}
          </StatusBadge>
        </header>
        <div className="studio-body">
          <div>
            <h3>Chatterbox Multilingual V3</h3>
            <p className="muted">
              {tr("studio", "cpuOneGenerationAtATimeOfficialWatermark")}</p>
          </div>
          <Requirements required={tr("experience", "voiceRequired")} optional={tr("experience", "voiceOptional")} />
          <p className="muted">{tr("experience", "voiceSetupChoice")}</p>
          <button className="outline" aria-expanded={voiceSetupOpen} aria-controls={`voice-setup-${projectId}`}
            onClick={() => setVoiceSetupOpen(value => !value)}>{tr("experience", "manualPreparation")}</button>
          <div id={`voice-setup-${projectId}`} hidden={!voiceSetupOpen}>
          <details className="fx-layer">
            <summary>{tr("studio", "linkAnExistingIsolatedEnvironment")}</summary>
            <div className="disclosure-body">
            <PathField label={tr("studio", "environmentPython")} kind="executable" disabled={busy}
              requirement="required" help={tr("experience", "pythonHelp")}
              value={python} onChange={setPython} placeholder={tr("studio", "absolutePathToScriptsPythonExe")} />
            <PathField label={tr("studio", "checkpointFolder")} kind="directory" disabled={busy}
              requirement="required" help={tr("experience", "checkpointsHelp")}
              value={models} onChange={setModels} />
            <button
              className="outline"
              disabled={busy || !python || !models}
              onClick={() =>
                void act(
                  "voice_environment_link",
                  { python_path: python, models },
                  tr("studio", "v3EnvironmentVerifiedAndLinkedWithoutModifications"),
                )
              }
            >
              {tr("studio", "verifyAndLinkV3")}</button>
            {(!python || !models) && <p className="action-requirement">{tr("experience", "voiceLinkMissing")}</p>}
          </div>
          </details>
          <details className="fx-layer">
            <summary>{tr("studio", "installV3CpuInADedicatedFolder")}</summary>
            <div className="disclosure-body">
            <PathField label={tr("studio", "newFolderOutsideRepositories")} kind="directory" disabled={busy}
                requirement="required" help={tr("experience", "folderHelp")}
                value={destination}
                onChange={(value) => {
                  setDestination(value);
                  setPlan(undefined);
                  setInstallAuthorized(false);
                }}
              />
            <PathField label={tr("studio", "localCheckpointCacheOptional")} kind="directory" disabled={busy}
              requirement="optional"
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
              {tr("studio", "reviewVoiceRecipe")}</button>
            {!destination && <p className="action-requirement">{tr("experience", "voiceInstallMissing")}</p>}
            {plan && (
              <>
                <p>
                  {tr("studio", "pinnedPython31115PytorchCpu2")}</p>
                <p className="muted">
                  {tr("studio", "headlessRecipeDoesNotInstallTheGradioUi")}</p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={installAuthorized}
                    onChange={(e) => setInstallAuthorized(e.target.checked)}
                  />
                  {tr("studio", "iAuthorizeIsolatedInstallationInThisFolder")}</label>
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
                      tr("studio", "voiceInstallationStartedFollowDiagnostics"),
                    )
                  }
                >
                  {tr("studio", "installV3Environment")}</button>
              </>
            )}
            {data.setup && (
              <p className="mono muted" role="status">
                {stateLabel(data.setup.state) ?? data.setup.state}:{" "}
                {systemMessage(data.setup.stage)}
              </p>
            )}
          </div>
          </details>
          </div>
          {jobs[0] && (
            <details className="technical-details"><summary>{tr("studio", "latestRequest")}</summary><div className="studio-request">
              <div className="studio-toolbar">
                <strong>{tr("studio", "latestRequest")}</strong>
                <span className="mono muted">
                  {stateLabel(jobs[0].state)} · {systemMessage(jobs[0].stage)}
                </span>
              </div>
              <dl className="request-readout">
                <dt>{tr("studio", "originalDisplayedText")}</dt><dd>{String(jobs[0].params.original_text ?? "")}</dd>
                <dt>{tr("studio", "textSubmittedToTts")}</dt><dd>{String(jobs[0].params.text ?? "")}</dd>
              </dl>
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
            </div></details>
          )}
        </div>
      </section>
      <section className="panel">
        <header className="panel-title">
          <h2>{tr("studio", "projectProfiles")}</h2>
          <span className="mono muted">{profiles.length} {tr("studio", "profiles")}</span>
        </header>
        <div className="studio-body">
          {!projectId ? (
            <p>{tr("studio", "selectAProjectToOrganizeVoices")}</p>
          ) : (
            <>
              <div className="studio-results">
                {profiles.map((p) => (
                  <div className="studio-result" key={p.id}>
                    <strong>{p.name}</strong>
                    <span className="mono muted">
                      {p.language} ·{" "}
                      {p.reference_id
                        ? tr("studio", "authorizedReference")
                        : tr("studio", "engineDefaultVoice")}{" "}
                      · {p.id.slice(0, 8)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="muted">{tr("experience", "profilesChoice")}</p>
              <button className="outline" aria-expanded={profileFormOpen} aria-controls={`voice-profile-${projectId}`}
                onClick={() => setProfileFormOpen(value => !value)}>{tr("experience", "manualProfile")}</button>
              <div className="disclosure-body" id={`voice-profile-${projectId}`} hidden={!profileFormOpen}>
              <div className="studio-two">
                <label>
                  {tr("studio", "profileName")}<input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  {tr("studio", "explicitLanguage")}<SelectControl
                    label={tr("studio", "voiceProfileLanguage")}
                    value={language}
                    onChange={setLanguage}
                    options={Object.entries(engine?.languages ?? {}).map(
                      ([value]) => ({
                        value,
                        label: `${languageName(value)} (${value})`,
                      }),
                    )}
                  />
                </label>
              </div>
              <PathField label={tr("studio", "yourOwnAuthorizedVoiceReferenceOptional")} kind="audio" disabled={busy}
                requirement="optional"
                value={reference} onChange={setReference} placeholder={tr("studio", "localAudioPath")} />
              <label className="check">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                />
                {tr("studio", "iAmAuthorizedToUseThisVoiceReference")}</label>
              <button
                className="outline"
                disabled={
                  busy || !name || !language || (!!reference && !authorized)
                }
                onClick={() => void saveProfile()}
              >
                {tr("studio", "saveVoiceProfile")}</button>
              <p className="muted">
                {tr("studio", "aProfileRecordsLanguageAndReferenceIdentityAnd")}</p>
              </div>
            </>
          )}
        </div>
      </section>
      <section className="panel">
        <header className="panel-title">
          <h2>{tr("studio", "performancesComparison")}</h2>
          <span className="mono muted">{results.length} {tr("studio", "results")}</span>
        </header>
        <div className="studio-body">
          {!results.length && (
            <p className="muted">
              {tr("studio", "performancesRequestedThroughCodexWillAppearHereCompare")}</p>
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
                    {tr("studio", "play")}</button>
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
                    {asset.selected ? tr("studio", "preferred") : tr("studio", "prefer")}
                  </button>
                  <button className="outline" onClick={() => openFx(asset)}>
                    {tr("studio", "openInFx")}</button>
                  <button className="text-button" onClick={() => edit(asset)}>
                    Audacity
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="muted">
            {tr("studio", "useLibraryVersionsForABComparisonNotes")}</p>
        </div>
      </section>
    </div>
  );
}
