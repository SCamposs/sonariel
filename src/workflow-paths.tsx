import { useTranslation } from "react-i18next";
import { tr } from "./i18n";
import type { Snapshot } from "./api";
import { HelpTip } from "./ui/help-tip";
import { useState } from "react";
import { AgentHandoff } from "./workflow-guidance";

/** Navigation only: none of these entries executes production or setup. */
export function WorkflowPaths({ data, music, voice, audio, createProject }: {
  data: Snapshot; music: () => void; voice: () => void; audio: () => void; createProject: () => void;
}) {
  useTranslation();
  const [intent, setIntent] = useState<"music" | "voice" | "audio">();
  const project = data.projects.find(p => p.id === data.selected_project);
  const musicReady = data.engines?.some(e => e.category === "music" && e.installed && e.compatible && !e.blocked_reason);
  const voiceReady = data.engines?.some(e => e.category === "voice" && e.installed && e.compatible && !e.blocked_reason);
  return <section className="panel workflow-paths" aria-label={tr("workspace", "chooseTask")}>
    <header className="panel-title"><h2>{tr("workspace", "chooseTask")}</h2>
    </header>
    <div className="workflow-path-grid">
      <div><HelpTip label={tr("workspace", "createMusic")} trigger={<button className={`outline ${intent === "music" ? "selected" : ""}`} aria-pressed={intent === "music"} onClick={() => setIntent("music")}>{tr("workspace", "createMusic")}</button>}>{tr("experience", "workflowHelpText")}</HelpTip></div>
      <div><HelpTip label={tr("workspace", "produceVoice")} trigger={<button className={`outline ${intent === "voice" ? "selected" : ""}`} aria-pressed={intent === "voice"} onClick={() => setIntent("voice")}>{tr("workspace", "produceVoice")}</button>}>{tr("experience", "voiceRequired")}</HelpTip></div>
      <div><HelpTip label={tr("workspace", "processExistingAudio")} trigger={<button className={`outline ${intent === "audio" ? "selected" : ""}`} aria-pressed={intent === "audio"} onClick={() => setIntent("audio")}>{tr("workspace", "processExistingAudio")}</button>}>{tr("experience", "fxOptional")}</HelpTip></div>
    </div>
    {intent === "music" && project && musicReady ? <AgentHandoff key={project.id} data={data} kind="music" connection={music} /> : !intent ? <p className="task-plan-intro muted">{tr("experience", "startByChoosing")}</p> : <div className="task-start-plan" role="region" aria-label={tr("experience", "nextStep")}>
      <h3>{tr("experience", intent === "audio" ? "inApp" : "withCodex")}</h3>
      <p>{tr("experience", `intent_${intent}`)}</p>
      <p className="muted">{!project ? tr("experience", "chooseProjectFirst") : intent === "audio"
        ? tr("experience", "audioReady") : tr("experience", (intent === "music" ? musicReady : voiceReady) ? "engineReadyForRequest" : "engineNeededForRequest")}</p>
      <button className="primary" onClick={!project ? createProject : intent === "music" ? music : intent === "voice" ? voice : audio}>
        {tr("experience", !project ? "createProjectStep" : intent === "audio" ? "importWavStep" : intent === "voice" ? "openVoiceStep" : musicReady ? "openAgentStep" : "prepareMusicStep")}
      </button>
    </div>}
  </section>;
}
