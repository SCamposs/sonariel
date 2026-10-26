import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Repeat2 } from "lucide-react";
import { formatNumber, tr } from "./i18n";
import type { Asset } from "./api";
import { AudioSlider } from "./ui/audio-slider";

type Action = (method: string, args?: Record<string, unknown>, message?: string) => Promise<unknown>;
export function LoopStudio({ source, busy, act }: { source: Asset | undefined; busy: boolean; act: Action }) {
  useTranslation();
  const duration = source?.metadata.duration ?? 0;
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration);
  const [fade, setFade] = useState(100);
  const [repetitions, setRepetitions] = useState(3);
  useEffect(() => { setStart(0); setEnd(duration); setFade(Math.min(100, duration * 100)); }, [source?.id, duration]);
  const period = end - start - fade / 1000;
  const valid = Boolean(source) && start >= 0 && end <= duration && end - start >= 0.1
    && fade >= 0 && fade / 1000 <= (end - start) / 2 && period > 0;
  function render(preview: boolean) {
    if (!source || !valid) return;
    void act("fx_loop_render", { asset_id: source.id, request_key: crypto.randomUUID(),
      start_seconds: start, end_seconds: end, crossfade_ms: fade, repetitions, preview,
      name: tr("production", "loopVersionName") }, tr("production", preview ? "loopPreviewQueued" : "loopQueued"));
  }
  return <section className="panel loop-studio">
    <header className="panel-title"><h2><Repeat2 size={16} /> {tr("production", "loops")}</h2>
      <span className="mono">{tr("production", "nonDestructive")}</span></header>
    <div className="studio-body">
      <p className="muted">{tr("production", "loopHelp")}</p>
      {!source ? <p>{tr("production", "chooseLoopSource")}</p> : <>
        <p><strong>{source.name}</strong> · {formatNumber(duration, 3)} s</p>
        <div className="fx-fields">
          <label>{tr("production", "regionStart")}<input type="number" min={0} max={duration} step={0.001}
            value={Number.isFinite(start) ? start : ""} onChange={e => setStart(e.target.valueAsNumber)} disabled={busy} />
            <AudioSlider label={tr("production", "regionStart")} min={0} max={duration} step={0.01}
              value={Number.isFinite(start) ? start : 0} onChange={setStart} disabled={busy} /></label>
          <label>{tr("production", "regionEnd")}<input type="number" min={0} max={duration} step={0.001}
            value={Number.isFinite(end) ? end : ""} onChange={e => setEnd(e.target.valueAsNumber)} disabled={busy} />
            <AudioSlider label={tr("production", "regionEnd")} min={0} max={duration} step={0.01}
              value={Number.isFinite(end) ? end : duration} onChange={setEnd} disabled={busy} /></label>
          <label>{tr("production", "crossfade")}<input type="number" min={0} max={Math.max(0, (end - start) * 500)} step={1}
            value={Number.isFinite(fade) ? fade : ""} onChange={e => setFade(e.target.valueAsNumber)} disabled={busy} /></label>
          <label>{tr("production", "repetitions")}<input type="number" min={2} max={4} step={1}
            value={Number.isFinite(repetitions) ? repetitions : ""} onChange={e => setRepetitions(e.target.valueAsNumber)} disabled={busy} /></label>
        </div>
        <p className="mono">{tr("production", "loopDuration", { duration: formatNumber(Math.max(0, period), 3) })}</p>
        <p className="muted">{tr("production", "loopPreviewDuration", { duration: formatNumber(Math.max(0, period) * repetitions, 3) })}</p>
        {!valid && <p role="status">{tr("production", "invalidLoop")}</p>}
        {fade === 0 && <p role="status">{tr("production", "zeroCrossfade")}</p>}
        <div className="studio-toolbar">
          <button className="outline" disabled={busy || !valid || !Number.isInteger(repetitions) || repetitions < 2 || repetitions > 4 || period * repetitions > 600}
            onClick={() => render(true)}>{tr("production", "previewSeam")}</button>
          <button className="primary" disabled={busy || !valid} onClick={() => render(false)}>{tr("production", "createLoop")}</button>
        </div>
        <p className="muted">{tr("production", "loopListenHelp")}</p>
      </>}
    </div>
  </section>;
}
