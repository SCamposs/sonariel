import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { rpc, type Snapshot } from "./api";
import { tr } from "./i18n";
import { systemMessage } from "./i18n/system-message";

type Recommendation = {
  id: string; name: string; revision: number; available: boolean; optional_download_bytes: number;
  minimum_available_gib: number; parameters: Record<string, unknown>; runtime: Record<string, unknown>;
  checkpoints: { path: string; sha256: string; bytes: number }[];
};

/** Read-only recipe discovery plus explicit local handoff; no setup or generation side effects. */
export function RecommendedMusic({ data, prepare }: { data: Snapshot; prepare: () => void }) {
  useTranslation();
  const [recipe, setRecipe] = useState<Recommendation>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const project = data.projects.find(p => p.id === data.selected_project);
  // Refresh installed availability after linking, without polling or loading model files.
  const installed = data.engines?.find(e => e.id === "stable-audio-3-medium");
  const availability = `${installed?.installed}:${installed?.compatible}:${installed?.quality_profiles?.join(",")}`;
  useEffect(() => {
    let alive = true;
    void rpc<Recommendation[]>("music_recommendations_list").then(value => {
      if (alive) { setRecipe(Array.isArray(value) ? value[0] : undefined); setError(""); }
    }).catch(cause => { if (alive) setError(String(cause)); });
    return () => { alive = false; };
  }, [availability, retry]);
  useEffect(() => { setCopyState("idle"); }, [project?.id]);
  const request = recipe && project ? tr("experience", "recommendedRequest", { name: project.name, project: project.id, recipe: recipe.id }) : "";
  async function copy() {
    try { await navigator.clipboard.writeText(request); setCopyState("copied"); }
    catch { setCopyState("error"); }
  }
  return <section className="recommended-music" aria-label={tr("experience", "recommendedMusic")}>
    <h3>{tr("experience", "recommendedMusic")}</h3>
    {error ? <div role="alert"><p>{systemMessage(error)}</p><button className="outline" onClick={() => setRetry(value => value + 1)}>{tr("experience", "retryRecommendation")}</button></div>
      : !recipe ? <p role="status" className="muted">{tr("experience", "loadingRecommendation")}</p> : <>
      <p><strong>{recipe.name}</strong> · {tr("experience", "recommendedTextMode")}</p>
      <p className="muted">{tr("experience", "recommendedScope")}</p>
      <p>{tr("experience", "recommendedCosts", { ram: recipe.minimum_available_gib, gb: (recipe.optional_download_bytes / 1e9).toFixed(2) })}</p>
      <div className="studio-actions">
        {recipe.available && request && <button className="outline" onClick={() => void copy()}>{tr("experience", "useRecommendedCodex")}</button>}
        <button className="outline" onClick={prepare}>{tr("experience", recipe.available ? "reviewRecommendedSetup" : "prepareRecommended")}</button>
      </div>
      {!recipe.available && <p className="muted">{tr("experience", "recommendedNotLinked")}</p>}
      {recipe.available && !project && <p className="muted">{tr("experience", "chooseProjectFirst")}</p>}
      {copyState !== "idle" && <p role={copyState === "error" ? "alert" : "status"}>{tr("experience", copyState === "copied" ? "requestCopied" : "requestCopyError")}</p>}
      <details className="technical-details"><summary>{tr("experience", "recommendedRecipe")}</summary>
        <p>{tr("experience", "recommendedTechnical")}</p>
        <pre className="config-preview">{JSON.stringify({ id: recipe.id, revision: recipe.revision, parameters: recipe.parameters, runtime: recipe.runtime, checkpoints: recipe.checkpoints }, null, 2)}</pre>
        {request && <pre className="config-preview">{request}</pre>}
      </details>
    </>}
  </section>;
}
