import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { rpc, type Asset, type Snapshot } from "./api";
import { tr } from "./i18n";
import { systemMessage } from "./i18n/system-message";
import { SelectControl } from "./ui/select-control";

export type LibraryFilters = { query: string; favorite: boolean; tags: string[]; session_id: string | null; kind: string | null };
export const emptyFilters: LibraryFilters = { query: "", favorite: false, tags: [], session_id: null, kind: null };
export type Action = (method: string, args?: Record<string, unknown>, message?: string) => Promise<unknown>;

export function loopSeams(asset: Asset | undefined): number[] {
  const recipe = asset?.metadata.parameters?.recipe;
  if (!recipe || typeof recipe !== "object" || !("operation" in recipe) || recipe.operation !== "loop"
    || !("repetitions" in recipe) || typeof recipe.repetitions !== "number"
    || !Number.isInteger(recipe.repetitions) || recipe.repetitions < 2 || recipe.repetitions > 4
    || !asset || !Number.isFinite(asset.metadata.duration) || asset.metadata.duration <= 0) return [];
  const cycle = asset.metadata.duration / recipe.repetitions;
  return Array.from({ length: recipe.repetitions - 1 }, (_, i) => cycle * (i + 1));
}

export function useLibraryFilters(data: Snapshot | undefined) {
  const projectId = data?.selected_project ?? null;
  const [state, setState] = useState<{ project: string | null; filters: LibraryFilters }>({ project: null, filters: emptyFilters });
  const [error, setError] = useState("");
  const revision = useRef(0);
  const pendingSave = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (projectId === state.project) return;
    revision.current += 1;
    setError("");
    setState({ project: projectId, filters: { ...emptyFilters,
      ...(data?.library_filters?.project_id === projectId ? data.library_filters.filters : {}) } });
  }, [projectId, data?.library_filters, state.project]);
  const filters = state.project === projectId ? state.filters : emptyFilters;
  function update(next: LibraryFilters) {
    setState({ project: projectId, filters: next });
    const current = ++revision.current;
    if (projectId) {
      pendingSave.current = pendingSave.current.catch(() => undefined)
        .then(() => rpc("library_filters_save", { project_id: projectId, filters: next }))
        .then(() => { if (current === revision.current) setError(""); })
        .catch(cause => { if (current === revision.current) setError(String(cause)); });
    }
  }
  useEffect(() => {
    if (!data || state.project !== projectId || !filters.tags.length) return;
    const known = new Set([...data.assets, ...(data.references ?? [])].filter(a => a.project_id === projectId).flatMap(a => a.tags ?? []));
    const retained = filters.tags.filter(t => known.has(t));
    if (retained.length !== filters.tags.length) update({ ...filters, tags: retained });
  }, [data?.assets, data?.references, state.project, projectId, filters.tags]);
  return { filters, update, error };
}

export function filterLibrary(assets: Asset[], filters: LibraryFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return assets.filter(a => a.kind !== "preview" && (!filters.favorite || a.favorite)
    && (!filters.kind || a.kind === filters.kind) && (!filters.session_id || a.session_id === filters.session_id)
    && (!query || `${a.name} ${a.notes}`.toLocaleLowerCase().includes(query))
    && filters.tags.every(t => a.tags?.includes(t)));
}

export function LibraryTools({ data, assets, filters, update, selected, onSelection, busy, act, saveError }: {
  data: Snapshot; assets: Asset[]; filters: LibraryFilters; update: (value: LibraryFilters) => void;
  selected: string[]; onSelection: (ids: string[]) => void; busy: boolean; act: Action; saveError: string;
}) {
  useTranslation();
  const [tagText, setTagText] = useState("");
  const project = data.selected_project;
  useEffect(() => setTagText(""), [project]);
  const tags = [...new Set([...assets.flatMap(a => a.tags ?? []), ...filters.tags])].sort();
  const patch = (value: Partial<LibraryFilters>) => update({ ...filters, ...value });
  const count = assets.filter(a => selected.includes(a.id)).length;
  const matching = filterLibrary(assets, filters);
  const activeFilters = [filters.query, filters.favorite ? tr("workspace", "favorites") : "",
    data.sessions.find(s => s.id === filters.session_id && s.project_id === project)?.name,
    filters.kind ? tr("library", `kind_${filters.kind}`) : "", ...filters.tags].filter(Boolean);
  async function tag(operation: "add" | "remove") {
    if (!project) return;
    const result = await act("asset_tags_update", { project_id: project,
      asset_ids: assets.filter(a => selected.includes(a.id)).map(a => a.id),
      [operation]: tagText.split(",").map(t => t.trim()).filter(Boolean) }, tr("library", "tagsSaved"));
    if (result) setTagText("");
  }
  return <section className="panel library-tools" aria-label={tr("library", "organization")}>
    <div className="studio-body">
      <p className="muted">{tr("workspace", "activeFiltersSummary")}: {activeFilters.length ? activeFilters.join(" · ") : tr("workspace", "noActiveFilters")}</p>
      <div className="form-grid">
        <label>{tr("library", "session")}<SelectControl label={tr("library", "session")} value={filters.session_id ?? "all"}
          onChange={value => patch({ session_id: value === "all" ? null : value })}
          options={[{ value: "all", label: tr("library", "allSessions") }, ...data.sessions.filter(s => s.project_id === project).map(s => ({ value: s.id, label: s.name }))]} /></label>
        <label>{tr("library", "versionType")}<SelectControl label={tr("library", "versionType")} value={filters.kind ?? "all"}
          onChange={value => patch({ kind: value === "all" ? null : value })} options={[{ value: "all", label: tr("library", "allTypes") },
            ...["generated", "imported", "processed", "export", "voice", "region", "reference"].map(value => ({ value, label: tr("library", `kind_${value}`) }))]} /></label>
      </div>
      <details><summary>{tr("library", "tagFilters")}</summary>
        <p className="muted">{tr("library", "tagFilterHelp")}</p>
        <div className="studio-toolbar">{tags.map(tag => <button key={tag} className={filters.tags.includes(tag) ? "outline selected" : "outline"}
          aria-pressed={filters.tags.includes(tag)} onClick={() => patch({ tags: filters.tags.includes(tag) ? filters.tags.filter(t => t !== tag) : [...filters.tags, tag] })}>{tag}</button>)}</div>
        {!tags.length && <p className="muted">{tr("library", "noTags")}</p>}
      </details>
      <div className="studio-toolbar">
        <button className="text-button" onClick={() => update({ ...emptyFilters })}>{tr("library", "clearFilters")}</button>
        <button className="text-button" disabled={busy || !matching.length}
          onClick={() => onSelection(matching.slice(0, 200).map(a => a.id))}>{tr("library", matching.length > 200 ? "selectFirstMatching" : "selectVisible")}</button>
        {!!selected.length && <button className="text-button" onClick={() => onSelection([])} disabled={busy}>{tr("library", "clearSelection")}</button>}
      </div>
      {saveError && <p role="alert">{tr("library", "filtersSaveFailed")} {systemMessage(saveError)}</p>}
      {!!count && <div className="library-tag-editor">
        <label>{tr("library", "editSelectedTags", { count })}<input value={tagText} maxLength={1600} disabled={busy}
          onChange={e => setTagText(e.target.value)} placeholder={tr("library", "tagPlaceholder")} /></label>
        <p className="muted">{tr("library", "tagRules")}</p>
        {count > 200 && <p role="status">{tr("library", "selectionLimit")}</p>}
        <div className="studio-toolbar"><button className="outline" disabled={busy || !tagText.trim() || count > 200} onClick={() => void tag("add")}>{tr("library", "addTags")}</button>
          <button className="outline" disabled={busy || !tagText.trim() || count > 200} onClick={() => void tag("remove")}>{tr("library", "removeTags")}</button></div>
      </div>}
    </div>
  </section>;
}
