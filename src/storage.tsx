import { systemMessage } from "./i18n/system-message";
import { tr, formatNumber, formatDate } from "./i18n";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmationDialog } from "./ui/confirmation-dialog";
import { rpc, type Snapshot } from "./api";
import "./storage.css";

type Item = { id: string; project_id: string; name: string; path: string; kind: string;
  favorite: boolean; selected: boolean; managed: boolean; bytes: number; exists: boolean;
  trashed: boolean; trash_path: string | null; state: string; expires_at?: number | null };
type Inventory = { items: Item[]; data_home: string; note: string };
type Plan = { token: string; managed_bytes: number; reclaimed_bytes: number;
  entries: { id: string; name: string; path?: string | null; bytes: number; action: string; blocked: string | null }[] };
const size = (bytes: number) => `${formatNumber((bytes / 1024 ** 2), 1)} MiB`;

export function StorageWorkspace({ data, act, busy }: {
  data: Snapshot; busy: boolean;
  act: (method: string, args?: Record<string, unknown>, message?: string) => Promise<unknown>;
}) {
  useTranslation();
  const [inventory, setInventory] = useState<Inventory>();
  const [all, setAll] = useState(false);
  const [trash, setTrash] = useState(false);
  const [external, setExternal] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const loadVersion = useRef(0);
  const projectId = all ? undefined : data.selected_project ?? undefined;
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const value = await rpc<Inventory>("storage_list", projectId ? { project_id: projectId } : {});
      if (version === loadVersion.current) { setInventory(value); setError(""); }
    }
    catch (e) { if (version === loadVersion.current) setError(String(e)); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [projectId]);
  useEffect(() => { setSelected([]); setPlan(undefined); void load(); }, [load]);
  const locked = busy || working || data.jobs.some(j => ["queued","loading","submitted","generating"].includes(j.state)
    || (j.state === "interrupted" && Boolean(j.remote_id)));
  const items = inventory?.items.filter(i => i.trashed === trash) ?? [];
  const preview = async () => {
    const version = loadVersion.current;
    setWorking(true); setError("");
    try { const value = await rpc<Plan>(trash ? "storage_purge_preview" : "storage_preview", { asset_ids: selected, include_external_files: external }); if (version === loadVersion.current) setPlan(value); }
    catch (e) { setError(String(e)); }
    finally { setWorking(false); }
  };
  const discard = async () => {
    if (!plan) return;
    setWorking(true); setError("");
    try {
      await rpc(trash ? "storage_purge" : "storage_discard", { asset_ids: plan.entries.map(e => e.id), preview_token: plan.token, confirmed: true, include_external_files: external });
      setPlan(undefined); setSelected([]);
      await act("storage_list", projectId ? { project_id: projectId } : {}, tr("storage", trash ? "permanentDeletionCompleted" : "recoverableDiscardCompletedNoExternalFileWasDeleted"));
    } catch (e) { setError(String(e)); setPlan(undefined); }
    finally { setWorking(false); await load(); }
  };
  const restore = async (id: string) => {
    setWorking(true);
    try { await act("storage_restore", { asset_id: id }, tr("storage", "recordRestored")); }
    finally { setWorking(false); await load(); }
  };
  return <div className="storage-workspace">
    <section className="panel">
      <header className="panel-title"><h2>{tr("storage", "audioStorage")}</h2>
        <button className="icon-button" title={tr("storage", "refreshInventory")} aria-label={tr("storage", "refreshInventory")}
          disabled={loading || working} aria-busy={loading} onClick={() => void load()}>
          <RefreshCw size={17} className={loading ? "spin" : undefined} />
        </button>
      </header>
      <div className="storage-summary">
        <p>{tr("storage", "allRegisteredAudioWithPathsAndSizesExternal")}</p>
        <div className="studio-toolbar">
          <label className="check"><input type="checkbox" checked={all} disabled={working} onChange={e => setAll(e.target.checked)} /> {tr("storage", "allProjects")}</label>
          <button disabled={working} className={`outline ${!trash ? "selected" : ""}`} onClick={() => { setTrash(false); setSelected([]); setExternal(false); }}>{tr("storage", "available")}</button>
          <button disabled={working} className={`outline ${trash ? "selected" : ""}`} onClick={() => { setTrash(true); setSelected([]); setExternal(false); }}>{tr("storage", "recoverableTrash")}</button>
          <button ref={trigger} className="outline" disabled={locked || !selected.length} onClick={() => void preview()}>
            <Trash2 size={16} /> {trash ? tr("storage", "reviewPermanentDeletion") : tr("storage", "reviewDiscard")}{selected.length})</button>
        </div>
        <label className="check"><input type="checkbox" checked={external} disabled={locked} onChange={e => { setExternal(e.target.checked); setPlan(undefined); }} /> {tr("storage", trash ? "deleteExternalFiles" : "moveExternalFiles")}</label>
        <p className="mono">{items.length} {tr("storage", "records")}{" "}{size(items.reduce((total, i) => total + i.bytes, 0))}</p>
        <p className="muted">{tr("storage", "referencesFavoritesSelectionsAndSourcesWithDependenciesAre")}</p>
        {locked && <p role="status">{tr("storage", "discardAndRestoreWaitForTheQueueTo")}</p>}
        {error && <p role="alert" className="message error">{systemMessage(error)}</p>}
      </div>
      <div className="storage-items">
        {!items.length && <p className="storage-empty">{loading ? tr("storage", "checkingFiles") : tr("storage", "noRecordsInThisView")}</p>}
        {items.map(item => <div className="storage-row" key={item.id}>
          <input type="checkbox" aria-label={tr("storage", "selectValue", { value0: item.name })}
            disabled={locked || item.favorite || item.selected || item.kind === "reference"}
            checked={selected.includes(item.id)} onChange={e => setSelected(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />
          <div className="storage-file"><strong>{item.name}</strong>
            <span className="mono">{data.projects.find(p => p.id === item.project_id)?.name ?? tr("storage", "project")} · {size(item.bytes)} · {item.managed ? tr("storage", "managed") : tr("storage", "protectedExternalFile")}{item.favorite ? tr("storage", "favorite") : ""}{item.selected ? tr("storage", "selected") : ""}{!item.exists ? tr("storage", "missingFile") : ""}</span>
            <code>{item.path}</code>
            {trash && item.trash_path && <small className="muted">{tr("storage", "trash")}{" "}{item.trash_path}</small>}
            {trash && item.expires_at && <small className="muted">{tr("storage", "expiresAt", { date: formatDate(item.expires_at) })}</small>}
            {item.state === "preparing" && <small>{tr("storage", "interruptedOperationUseRestoreToRecoverTheRecord")}</small>}
          </div>
          {trash && <button className="outline" disabled={locked || item.state === "purging"} onClick={() => void restore(item.id)}><RotateCcw size={15} /> {tr("storage", "restore")}</button>}
        </div>)}
      </div>
    </section>
    <ConfirmationDialog open={Boolean(plan)} title={tr("storage", trash ? "permanentDeletionTitle" : "reviewDiscard2")}
      description={tr("storage", trash ? "permanentDeletionDescription" : "onlyTheRecordsBelowYouCanRestoreThem")}
      confirmLabel={trash ? tr("storage", "confirmPermanentDeletion") : undefined}
      onClose={() => setPlan(undefined)} onConfirm={() => void discard()} busy={working}
      blocked={locked || Boolean(plan?.entries.some(e => Boolean(e.blocked)))} returnFocus={trigger}>
            {plan?.entries.map(entry => <div key={entry.id}><strong>{entry.name}</strong>{entry.path && <code>{entry.path}</code>}<p className="muted">{(entry.blocked ? systemMessage(entry.blocked) : null) ?? tr("storage", entry.action === "delete_file" ? "deleteFilePermanently" : entry.action === "forget_record" ? "forgetHiddenRecord" : entry.action === "move_to_trash" ? "moveManagedWavToTrash" : "hideRecordExternalFileStaysUnchanged")}</p></div>)}
            <p>{size(trash ? plan?.reclaimed_bytes ?? 0 : plan?.managed_bytes ?? 0)} {tr("storage", trash ? "spaceWillBeReclaimed" : "willRemainInTrashSpaceReclaimedNow0")}</p>
    </ConfirmationDialog>
  </div>;
}
