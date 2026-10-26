import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownToLine } from "lucide-react";
import { tr } from "./i18n";
import type { Asset } from "./api";
import { PathField } from "./ui/path-field";
import { SelectControl } from "./ui/select-control";

type ExportReport = { manifest: string | null; manifest_error?: string | null; files: { asset_id: string; file: string | null;
  status: "exported" | "skipped" | "failed"; error_code?: string }[] };
export function BatchExport({ assets, selected, onSelection, busy, act }: {
  assets: Asset[]; selected: string[]; onSelection: (ids: string[]) => void; busy: boolean;
  act: (method: string, args?: Record<string, unknown>, message?: string) => Promise<unknown>;
}) {
  useTranslation();
  const [directory, setDirectory] = useState("");
  const [naming, setNaming] = useState("{index}_{name}");
  const [collisions, setCollisions] = useState("rename");
  const [manifest, setManifest] = useState(false);
  const [prompts, setPrompts] = useState(false);
  const [report, setReport] = useState<ExportReport>();
  const eligible = assets.filter(a => a.kind !== "reference" && a.kind !== "preview" && a.path.toLowerCase().endsWith(".wav"));
  const chosen = eligible.filter(a => selected.includes(a.id));
  async function run() {
    setReport(undefined);
    const value = await act("result_export_batch", { asset_ids: chosen.map(a => a.id), directory,
      naming, collisions, manifest, include_prompts: manifest && prompts, include_references: false });
    if (value) setReport(value as ExportReport);
  }
  return <section className="panel batch-export">
    <header className="panel-title"><h2><ArrowDownToLine size={16} /> {tr("production", "batchExport")}</h2>
      <div className="studio-toolbar"><button className="text-button" disabled={busy || !eligible.length}
        onClick={() => onSelection(eligible.map(a => a.id))}>{tr("production", "selectProjectWavs")}</button>
        {!!selected.length && <button className="text-button" disabled={busy} onClick={() => onSelection([])}>{tr("production", "clearExportSelection")}</button>}</div>
    </header>
    <div className="studio-body">
      {!chosen.length ? <p className="muted">{tr("production", "batchHelp")}</p> : <>
        <p>{tr("production", "selectedForExport", { count: chosen.length })}</p>
        <details><summary>{tr("production", "reviewExportSelection")}</summary><ul>{chosen.map(a => <li key={a.id}>{a.name}</li>)}</ul></details>
        <PathField label={tr("production", "exportFolder")} kind="directory" value={directory} onChange={setDirectory} disabled={busy} />
        <label>{tr("production", "namingPattern")}<input value={naming} onChange={e => setNaming(e.target.value)} disabled={busy} maxLength={160} /></label>
        <p className="muted">{tr("production", "namingHelp")} <code>{"{index} {name} {model} {seed} {id}"}</code></p>
        <label>{tr("production", "nameCollisions")}<SelectControl label={tr("production", "nameCollisions")} value={collisions} onChange={setCollisions} disabled={busy}
          options={[{ value: "rename", label: tr("production", "renameCopies") }, { value: "skip", label: tr("production", "skipCopies") }]} /></label>
        <label className="check"><input type="checkbox" checked={manifest} onChange={e => setManifest(e.target.checked)} disabled={busy} />{tr("production", "includeManifest")}</label>
        {manifest && <label className="check"><input type="checkbox" checked={prompts} onChange={e => setPrompts(e.target.checked)} disabled={busy} />{tr("production", "includePrompts")}</label>}
        <p className="muted">{tr("production", "exportPrivacy")}</p>
        <button className="primary" disabled={busy || !directory || !naming} onClick={() => void run()} aria-busy={busy}>
          <ArrowDownToLine size={16} />{tr("production", "exportSelected")}</button>
      </>}
      {report && <div role="status"><h3>{tr("production", "exportReport")}</h3>
        <ul>{report.files.map((entry, index) => <li key={`${entry.asset_id}-${index}`}>
          <strong>{entry.file ?? assets.find(a => a.id === entry.asset_id)?.name ?? entry.asset_id}</strong>
          {" · "}{tr("production", `exportStatus_${entry.status}`)}
          {entry.error_code && <>: {tr("production", `exportError_${entry.error_code}`)}</>}
        </li>)}</ul>
        {report.manifest && <p>{tr("production", "manifestCreated")} <code>{report.manifest}</code></p>}
        {report.manifest_error && <p role="alert">{tr("production", "manifestFailed")} {tr("production", `exportError_${report.manifest_error}`)}</p>}
      </div>}
    </div>
  </section>;
}
