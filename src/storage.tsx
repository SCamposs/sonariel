import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmationDialog } from "./ui/confirmation-dialog";
import { rpc, type Snapshot } from "./api";
import "./storage.css";

type Item = { id: string; project_id: string; name: string; path: string; kind: string;
  favorite: boolean; selected: boolean; managed: boolean; bytes: number; exists: boolean;
  trashed: boolean; trash_path: string | null; state: string };
type Inventory = { items: Item[]; data_home: string; note: string };
type Plan = { token: string; managed_bytes: number; reclaimed_bytes: number;
  entries: { id: string; name: string; bytes: number; action: string; blocked: string | null }[] };
const size = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MiB`;

export function StorageWorkspace({ data, act, busy }: {
  data: Snapshot; busy: boolean;
  act: (method: string, args?: Record<string, unknown>, message?: string) => Promise<unknown>;
}) {
  const [inventory, setInventory] = useState<Inventory>();
  const [all, setAll] = useState(false);
  const [trash, setTrash] = useState(false);
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
    setWorking(true); setError("");
    try { setPlan(await rpc<Plan>("storage_preview", { asset_ids: selected })); }
    catch (e) { setError(String(e)); }
    finally { setWorking(false); }
  };
  const discard = async () => {
    if (!plan) return;
    setWorking(true); setError("");
    try {
      await rpc("storage_discard", { asset_ids: plan.entries.map(e => e.id), preview_token: plan.token, confirmed: true });
      setPlan(undefined); setSelected([]);
      await act("storage_list", projectId ? { project_id: projectId } : {}, "Descarte recuperável concluído. Nenhum arquivo externo foi apagado.");
    } catch (e) { setError(String(e)); setPlan(undefined); }
    finally { setWorking(false); await load(); }
  };
  const restore = async (id: string) => {
    setWorking(true);
    try { await act("storage_restore", { asset_id: id }, "Registro restaurado."); }
    finally { setWorking(false); await load(); }
  };
  return <div className="storage-workspace">
    <section className="panel">
      <header className="panel-title"><h2>Áudios & armazenamento</h2>
        <button className="icon-button" title="Atualizar inventário" aria-label="Atualizar inventário"
          disabled={loading || working} aria-busy={loading} onClick={() => void load()}>
          <RefreshCw size={17} className={loading ? "spin" : undefined} />
        </button>
      </header>
      <div className="storage-summary">
        <p>Todos os áudios catalogados, com seus caminhos e tamanhos. Arquivos externos permanecem onde estão; nada é movido automaticamente.</p>
        <div className="studio-toolbar">
          <label className="check"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> Todos os projetos</label>
          <button className={`outline ${!trash ? "selected" : ""}`} onClick={() => { setTrash(false); setSelected([]); }}>Disponíveis</button>
          <button className={`outline ${trash ? "selected" : ""}`} onClick={() => { setTrash(true); setSelected([]); }}>Lixeira recuperável</button>
          {!trash && <button ref={trigger} className="outline" disabled={locked || !selected.length} onClick={() => void preview()}>
            <Trash2 size={16} /> Revisar descarte ({selected.length})</button>}
        </div>
        <p className="mono">{items.length} registros · {size(items.reduce((total, i) => total + i.bytes, 0))}</p>
        <p className="muted">Referências, favoritas, escolhas e origens com dependências são protegidas. A lixeira mantém os bytes para restauração, sem liberar espaço nem apagar permanentemente.</p>
        {locked && <p role="status">Descarte e restauração aguardam a fila terminar.</p>}
        {error && <p role="alert" className="message error">{error}</p>}
      </div>
      <div className="storage-items">
        {!items.length && <p className="storage-empty">{loading ? "Consultando arquivos…" : "Nenhum registro nesta visualização."}</p>}
        {items.map(item => <div className="storage-row" key={item.id}>
          {!trash && <input type="checkbox" aria-label={`Selecionar ${item.name}`}
            disabled={locked || item.favorite || item.selected || item.kind === "reference"}
            checked={selected.includes(item.id)} onChange={e => setSelected(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />}
          <div className="storage-file"><strong>{item.name}</strong>
            <span className="mono">{data.projects.find(p => p.id === item.project_id)?.name ?? "Projeto"} · {size(item.bytes)} · {item.managed ? "Gerenciado" : "Externo protegido"}{item.favorite ? " · Favorita" : ""}{item.selected ? " · Escolhida" : ""}{!item.exists ? " · Arquivo ausente" : ""}</span>
            <code>{item.path}</code>
            {trash && item.trash_path && <small className="muted">Lixeira: {item.trash_path}</small>}
            {item.state === "preparing" && <small>Operação interrompida: use Restaurar para recuperar o registro.</small>}
          </div>
          {trash && <button className="outline" disabled={locked} onClick={() => void restore(item.id)}><RotateCcw size={15} /> Restaurar</button>}
        </div>)}
      </div>
    </section>
    <ConfirmationDialog open={Boolean(plan)} title="Revisar descarte"
      description="Somente os registros abaixo. Você poderá restaurá-los na aba Armazenamento, em Lixeira recuperável."
      onClose={() => setPlan(undefined)} onConfirm={() => void discard()} busy={working}
      blocked={locked || Boolean(plan?.entries.some(e => Boolean(e.blocked)))} returnFocus={trigger}>
            {plan?.entries.map(entry => <div key={entry.id}><strong>{entry.name}</strong><p className="muted">{entry.blocked ?? (entry.action === "move_to_trash" ? "Mover WAV gerenciado para a lixeira" : "Ocultar registro; arquivo externo não será alterado")}</p></div>)}
            <p>{size(plan?.managed_bytes ?? 0)} serão mantidos na lixeira. Espaço liberado agora: 0 MiB. Não há exclusão permanente nesta operação.</p>
    </ConfirmationDialog>
  </div>;
}
