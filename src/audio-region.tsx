import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Asset } from "./api";
import { formatNumber, tr } from "./i18n";
import type { Action } from "./library-workspace";
import { SelectControl } from "./ui/select-control";
import { AudioSlider } from "./ui/audio-slider";

export function AudioRegion({ assets, selectedId, onSelect, onPreview, busy, act, waveform }: {
  assets: Asset[]; selectedId: string; onSelect: (id: string) => void; busy: boolean; act: Action;
  onPreview: (asset: Asset, start: number, end: number) => void; waveform?: ReactNode;
}) {
  useTranslation();
  const source = assets.find(a => a.id === selectedId);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [role, setRole] = useState("source");
  const [engine, setEngine] = useState("acestep-v15-turbo");
  const [name, setName] = useState("");
  const [result, setResult] = useState<Asset>();
  const request = useRef({ signature: "", key: "" });
  const activeSource = useRef(selectedId);
  activeSource.current = selectedId;
  useEffect(() => { setStart(0); setEnd(Math.min(120, source?.metadata.duration ?? 0)); setResult(undefined); setName(source ? tr("library", "regionDefaultName", { name: source.name }) : ""); }, [source?.id]);
  const rate = source?.metadata.sample_rate ?? 1;
  const first = Math.round(start * rate), last = Math.round(end * rate);
  const duration = (last - first) / rate;
  const minimum = role === "style" ? .1 : engine === "acestep-v15-turbo" ? 10 : 5;
  const supported = role === "source" || engine === "acestep-v15-turbo";
  const valid = source && Number.isFinite(duration) && start >= 0 && end <= source.metadata.duration
    && duration >= minimum && duration <= 120 && [1, 2].includes(source.metadata.channels) && supported;
  async function confirm() {
    if (!source || !valid) return;
    const signature = JSON.stringify([source.id, start, end, role, engine, name.trim()]);
    if (request.current.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    const value = await act("audio_region_create", { asset_id: source.id, request_key: request.current.key,
      start_seconds: start, end_seconds: end, role, engine_id: engine, name: name.trim() }, tr("library", "regionSaved"));
    if (value && activeSource.current === source.id) setResult(value as Asset);
  }
  return <details className="panel audio-region">
    <summary className="panel-title"><h2>{tr("library", "regions")}</h2><span className="mono">{tr("production", "nonDestructive")}</span></summary>
    <div className="studio-body">
      <p className="muted">{tr("library", "regionHelp")}</p>
      <label>{tr("library", "regionSource")}<SelectControl label={tr("library", "regionSource")} value={selectedId} onChange={onSelect}
        options={assets.map(a => ({ value: a.id, label: a.name }))} disabled={busy} placeholder={tr("library", "chooseRegionSource")} /></label>
      {source && <>
        {waveform}
        <div className="form-grid">
          <label>{tr("production", "regionStart")}<input type="number" value={Number.isFinite(start) ? start : ""} min={0} max={source.metadata.duration} step={1 / rate}
            onChange={e => setStart(e.target.valueAsNumber)} disabled={busy} />
            <AudioSlider label={tr("production", "regionStart")} min={0} max={source.metadata.duration} step={.01} value={Number.isFinite(start) ? start : 0} onChange={setStart} disabled={busy} /></label>
          <label>{tr("production", "regionEnd")}<input type="number" value={Number.isFinite(end) ? end : ""} min={0} max={source.metadata.duration} step={1 / rate}
            onChange={e => setEnd(e.target.valueAsNumber)} disabled={busy} />
            <AudioSlider label={tr("production", "regionEnd")} min={0} max={source.metadata.duration} step={.01} value={Number.isFinite(end) ? end : 0} onChange={setEnd} disabled={busy} /></label>
          <label>{tr("library", "role")}<SelectControl label={tr("library", "role")} value={role} onChange={setRole} disabled={busy}
            options={[{ value: "style", label: tr("library", "styleRole") }, { value: "source", label: tr("library", "sourceRole") }]} /></label>
          <label>{tr("library", "targetEngine")}<SelectControl label={tr("library", "targetEngine")} value={engine} onChange={setEngine} disabled={busy}
            options={[{ value: "acestep-v15-turbo", label: "ACE-Step 1.5 Turbo" }, { value: "stable-audio-3-small-music", label: "Stable Audio 3 Small-Music" }, { value: "stable-audio-3-medium", label: "Stable Audio 3 Medium" }]} /></label>
          <label className="full">{tr("library", "regionName")}<input value={name} maxLength={120} onChange={e => setName(e.target.value)} disabled={busy} /></label>
        </div>
        <p className="mono">{tr("library", "effectiveRegion", { duration: formatNumber(duration, 3), frames: Number.isFinite(last - first) ? last - first : "—" })}</p>
        <p className="muted">{tr("library", role === "style" ? "styleExplanation" : "sourceExplanation")} {tr("library", "regionDurationLimits", { minimum })}</p>
        {!supported && <p role="status">{tr("library", "styleUnsupported")}</p>}
        {!valid && supported && <p role="status">{tr("library", "invalidRegion")}</p>}
        <div className="studio-toolbar"><button className="outline" disabled={busy || !valid} onClick={() => onPreview(source, first / rate, last / rate)}>{tr("library", "playRegion")}</button>
          <button className="primary" disabled={busy || !valid || !name.trim()} onClick={() => void confirm()}>{tr("library", "confirmRegion")}</button></div>
        <p className="muted">{tr("library", "regionRights")}</p>
        {result && <div role="status"><p>{tr("library", "regionReady")} <code>{result.id}</code></p>
          <button className="outline" onClick={() => onPreview(result, 0, result.metadata.duration)}>{tr("library", "playConfirmedRegion")}</button></div>}
      </>}
    </div>
  </details>;
}
