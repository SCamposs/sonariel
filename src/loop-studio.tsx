import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Repeat2 } from "lucide-react";
import { formatNumber, tr } from "./i18n";
import type { Asset } from "./api";
import { AudioSlider } from "./ui/audio-slider";
import { beatAlignedRegion, type BeatGrid } from "./loop-grid";
import { SelectControl } from "./ui/select-control";

type Action = (method: string, args?: Record<string, unknown>, message?: string) => Promise<unknown>;
export function LoopStudio({ source, busy, act }: { source: Asset | undefined; busy: boolean; act: Action }) {
  useTranslation();
  const duration = source?.metadata.duration ?? 0;
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration);
  const [fade, setFade] = useState(100);
  const [repetitions, setRepetitions] = useState(3);
  const [bpm, setBpm] = useState(NaN);
  const [beats, setBeats] = useState(4);
  const [bars, setBars] = useState(2);
  const [anchor, setAnchor] = useState(NaN);
  const [appliedGrid, setAppliedGrid] = useState<BeatGrid>();
  useEffect(() => { setStart(0); setEnd(duration); setFade(Math.min(100, duration * 100)); setAppliedGrid(undefined); setBpm(NaN); setAnchor(NaN); }, [source?.id, duration]);
  const changeStart = (value: number) => { setStart(value); setAppliedGrid(undefined); };
  const changeEnd = (value: number) => { setEnd(value); setAppliedGrid(undefined); };
  const grid = { anchor_seconds: anchor, bpm, beats_per_bar: beats, bars };
  const plan = beatAlignedRegion(grid, fade, source?.metadata.sample_rate ?? 1, duration);
  const period = end - start - fade / 1000;
  const valid = Boolean(source) && start >= 0 && end <= duration && end - start >= 0.1
    && fade >= 0 && fade / 1000 <= (end - start) / 2 && period > 0;
  function render(preview: boolean) {
    if (!source || !valid) return;
    void act("fx_loop_render", { asset_id: source.id, request_key: crypto.randomUUID(),
      start_seconds: start, end_seconds: end, crossfade_ms: fade, repetitions, preview,
      ...(appliedGrid ? { beat_grid: appliedGrid } : {}),
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
            value={Number.isFinite(start) ? start : ""} onChange={e => changeStart(e.target.valueAsNumber)} disabled={busy} />
            <AudioSlider label={tr("production", "regionStart")} min={0} max={duration} step={0.01}
              value={Number.isFinite(start) ? start : 0} onChange={changeStart} disabled={busy} /></label>
          <label>{tr("production", "regionEnd")}<input type="number" min={0} max={duration} step={0.001}
            value={Number.isFinite(end) ? end : ""} onChange={e => changeEnd(e.target.valueAsNumber)} disabled={busy} />
            <AudioSlider label={tr("production", "regionEnd")} min={0} max={duration} step={0.01}
              value={Number.isFinite(end) ? end : duration} onChange={changeEnd} disabled={busy} /></label>
          <label>{tr("production", "crossfade")}<input type="number" min={0} max={Math.max(0, (end - start) * 500)} step={1}
            value={Number.isFinite(fade) ? fade : ""} onChange={e => { setFade(e.target.valueAsNumber); setAppliedGrid(undefined); }} disabled={busy} /></label>
          <label>{tr("production", "repetitions")}<input type="number" min={2} max={4} step={1}
            value={Number.isFinite(repetitions) ? repetitions : ""} onChange={e => setRepetitions(e.target.valueAsNumber)} disabled={busy} /></label>
        </div>
        <details className="loop-beat-grid"><summary>{tr("library", "beatAssist")}</summary>
          <p className="muted">{tr("library", "beatAssistHelp")}</p>
          <div className="fx-fields">
            <label>{tr("library", "knownBpm")}<input type="number" min={30} max={300} step={.01} value={Number.isFinite(bpm) ? bpm : ""} onChange={e => setBpm(e.target.valueAsNumber)} disabled={busy} /></label>
            <label>{tr("library", "beatsPerBar")}<SelectControl label={tr("library", "beatsPerBar")} value={String(beats)} onChange={value => setBeats(Number(value))}
              options={[2, 3, 4, 6].map(value => ({ value: String(value), label: String(value) }))} disabled={busy} /></label>
            <label>{tr("library", "bars")}<input type="number" min={1} max={32} step={1} value={Number.isFinite(bars) ? bars : ""} onChange={e => setBars(e.target.valueAsNumber)} disabled={busy} /></label>
            <label>{tr("library", "beatAnchor")}<input type="number" min={0} max={duration} step={.001} value={Number.isFinite(anchor) ? anchor : ""} onChange={e => setAnchor(e.target.valueAsNumber)} disabled={busy} /></label>
          </div>
          <button className="outline" disabled={busy || !plan} onClick={() => {
            if (plan) { setStart(plan.start); setEnd(plan.end); setAppliedGrid({ ...grid }); }
          }}>{tr("library", "applyBeatGrid")}</button>
          {!plan && <p role="status">{tr("library", "invalidBeatGrid")}</p>}
        </details>
        {appliedGrid && <p className="muted">{tr("library", "beatGridApplied", { bars: appliedGrid.bars, bpm: formatNumber(appliedGrid.bpm, 2) })}</p>}
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
