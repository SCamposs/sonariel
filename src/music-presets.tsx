import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bookmark, RefreshCw, Star } from "lucide-react";
import { rpc, type Snapshot } from "./api";
import { tr } from "./i18n";
import { systemMessage } from "./i18n/system-message";
import { SelectControl } from "./ui/select-control";

type Preset = { id: string; name: string; description: string; engine_id: string; revision: number;
  family_id: string; parent_id: string | null; favorite: number; params: Record<string, unknown> };
const musicIds = ["acestep-v15-turbo", "stable-audio-3-small-music", "stable-audio-3-medium"];
type Action = (method: string, args?: Record<string, unknown>, message?: string) => Promise<unknown>;

export function MusicPresets({ data, busy, act }: { data: Snapshot; busy: boolean; act: Action }) {
  useTranslation();
  const projectId = data.selected_project;
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [captureId, setCaptureId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [revisionName, setRevisionName] = useState("");
  const [revisionDescription, setRevisionDescription] = useState("");
  const [review, setReview] = useState<Record<string, unknown>>();
  const version = useRef(0);
  const load = useCallback(async () => {
    const current = ++version.current;
    if (!projectId) { setPresets([]); setLoading(false); return; }
    setLoading(true);
    try {
      const value = await rpc<Preset[]>("music_presets_list", { project_id: projectId });
      if (current === version.current) { setPresets(value); setError(""); }
    } catch (cause) { if (current === version.current) setError(String(cause)); }
    finally { if (current === version.current) setLoading(false); }
  }, [projectId]);
  useEffect(() => {
    setSelectedId(""); setCaptureId(""); setName(""); setDescription(""); setReview(undefined);
    void load();
    return () => { version.current += 1; };
  }, [load]);
  const selected = presets.find(p => p.id === selectedId);
  const candidates = data.assets.filter(a => a.project_id === projectId && a.kind !== "reference"
    && musicIds.includes(String(a.metadata.parameters?._engine ?? a.metadata.parameters?.model)));
  const engineName = (id: string) => data.engines?.find(engine => engine.id === id)?.name ?? id;
  async function save(arguments_: Record<string, unknown>) {
    if (!projectId) return;
    const result = await act("music_preset_save", { project_id: projectId, ...arguments_ }, tr("production", "musicPresetSaved"));
    if (result) await load();
  }
  function choose(id: string) {
    setSelectedId(id); setReview(undefined);
    const preset = presets.find(p => p.id === id);
    setRevisionName(preset?.name ?? ""); setRevisionDescription(preset?.description ?? "");
  }
  return <details className="panel music-presets">
    <summary className="panel-title"><h2><Bookmark size={16} /> {tr("production", "musicPresets")}</h2>
      <span className="mono">{presets.length}</span></summary>
    <div className="studio-body">
      <div className="studio-toolbar"><p className="muted">{tr("production", "musicPresetHelp")}</p>
        <button className="icon-button" aria-label={tr("production", "refreshMusicPresets")} disabled={busy || loading} aria-busy={loading}
          onClick={() => void load()}><RefreshCw size={16} className={loading ? "spin" : undefined} /></button></div>
      {error && <p role="alert" className="message error">{systemMessage(error)}</p>}
      {!projectId ? <p>{tr("production", "presetChooseProject")}</p> : <>
        <label>{tr("production", "captureMusicResult")}<SelectControl label={tr("production", "captureMusicResult")} value={captureId} disabled={busy}
          onChange={id => { setCaptureId(id); const asset = candidates.find(a => a.id === id); setName(asset ? tr("production", "capturePresetName", { name: asset.name }) : ""); }}
          options={candidates.map(a => ({ value: a.id, label: a.name }))} placeholder={tr("production", "chooseMusicResult")} /></label>
        {!candidates.length && <p className="muted">{tr("production", "noMusicResultForPreset")}</p>}
        {captureId && <div className="form-grid">
          <label>{tr("production", "presetName")}<input value={name} onChange={e => setName(e.target.value)} maxLength={120} disabled={busy} /></label>
          <label className="full">{tr("production", "presetDescription")}<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} disabled={busy} /></label>
          <button className="outline" disabled={busy || !name.trim()} onClick={() => void save({ asset_id: captureId, name, description })}>{tr("production", "capturePreset")}</button>
        </div>}
        {!presets.length && <p>{tr("production", "noMusicPresets")}</p>}
        <div className="music-preset-list">{presets.map(preset => <div className="studio-result" key={preset.id}>
          <button className="text-button" onClick={() => choose(preset.id)} aria-pressed={selectedId === preset.id}>
            {preset.name} · {tr("production", "presetRevision", { revision: preset.revision })}</button>
          <span className="mono">{engineName(preset.engine_id)}</span>
          <button className={`icon-button ${preset.favorite ? "favorite" : ""}`} disabled={busy}
            aria-label={tr("production", "favoriteAsset", { name: preset.name })}
            onClick={() => void act("music_preset_favorite", { preset_id: preset.id, favorite: !preset.favorite }).then(value => { if (value) void load(); })}>
            <Star size={16} fill={preset.favorite ? "currentColor" : "none"} /></button>
        </div>)}</div>
        {selected && <section className="music-preset-review">
          <h3>{selected.name}</h3><p>{selected.description}</p>
          <p className="mono">{engineName(selected.engine_id)} · {tr("production", "presetRevision", { revision: selected.revision })}</p>
          <p className="muted">{tr("production", "presetDirection")}</p>
          <pre className="config-preview">{JSON.stringify(review?.parameters ?? selected.params, null, 2)}</pre>
          <p>{tr("production", "presetMcpId")} <code>{selected.id}</code></p>
          <div className="studio-toolbar"><button className="outline" disabled={busy}
            onClick={() => void act("music_preset_prepare", { preset_id: selected.id, project_id: projectId, intent: "reuse" }).then(value => { if (value) setReview(value as Record<string, unknown>); })}>
            {tr("production", "reviewMusicPreset")}</button></div>
          {review && <p role="status">{tr("production", "presetReviewed")}</p>}
          <p className="muted">{tr("production", "presetSeedWarning")}</p>
          <div className="form-grid">
            <label>{tr("production", "presetName")}<input value={revisionName} onChange={e => setRevisionName(e.target.value)} disabled={busy} maxLength={120} /></label>
            <label className="full">{tr("production", "presetDescription")}<textarea value={revisionDescription} onChange={e => setRevisionDescription(e.target.value)} disabled={busy} maxLength={2000} /></label>
            <div className="studio-toolbar full"><button className="outline" disabled={busy || !revisionName.trim()}
              onClick={() => void save({ base_id: selected.id, name: revisionName, description: revisionDescription })}>{tr("production", "savePresetRevision")}</button>
              <button className="outline" disabled={busy || !revisionName.trim()}
                onClick={() => void save({ base_id: selected.id, name: revisionName, description: revisionDescription, duplicate: true })}>{tr("production", "duplicateMusicPreset")}</button></div>
          </div>
        </section>}
      </>}
    </div>
  </details>;
}
