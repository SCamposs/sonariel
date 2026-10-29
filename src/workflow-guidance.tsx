import { useState } from "react";
import { useTranslation } from "react-i18next";
import { tr } from "./i18n";
import type { Snapshot } from "./api";

export function agentRequest(data: Snapshot, kind: "music" | "voice") {
  const project = data.projects.find(p => p.id === data.selected_project);
  if (!project) return "";
  return tr("experience", "requestTemplate", { name: project.name, id: project.id,
    task: tr("experience", kind === "voice" ? "requestVoice" : "requestMusic") });
}

/** Explicit local clipboard handoff, never a generation command or private-data export. */
export function AgentHandoff({ data, kind, projects, connection }: {
  data: Snapshot; kind: "music" | "voice"; projects?: () => void; connection?: () => void;
}) {
  useTranslation();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const request = agentRequest(data, kind);
  const project = data.projects.find(p => p.id === data.selected_project);
  async function copy() {
    if (!request) return;
    try { await navigator.clipboard.writeText(request); setCopyState("copied"); }
    catch { setCopyState("error"); }
  }
  return <section className="panel agent-handoff">
    <header className="panel-title"><h2>{tr("experience", "withCodex")}</h2></header>
    <div className="studio-body">
      <p>{tr("experience", kind === "voice" ? "voiceAgentIntro" : "musicAgentIntro")}</p>
      {project ? <p className="muted">{tr("experience", "requestProject", { name: project.name })}</p>
        : <p>{tr("experience", "chooseProjectFirst")}</p>}
      <div className="studio-actions">
        {request ? <button className="primary" onClick={() => void copy()}>{tr("experience", "copyRequest")}</button>
          : projects && <button className="primary" onClick={projects}>{tr("experience", "chooseProject")}</button>}
        {connection && <button className="outline" onClick={connection}>{tr("experience", "reviewAgentConnection")}</button>}
      </div>
      {copyState !== "idle" && <p role={copyState === "error" ? "alert" : "status"}>{tr("experience", copyState === "copied" ? "requestCopied" : "requestCopyError")}</p>}
      {request && <details className="technical-details"><summary>{tr("experience", "inspectRequest")}</summary><pre className="config-preview">{request}</pre></details>}
      <p className="muted">{tr("experience", "agentOutcome")}</p>
    </div>
  </section>;
}
