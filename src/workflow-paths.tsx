import { useTranslation } from "react-i18next";
import { tr } from "./i18n";
import type { Snapshot } from "./api";

/** Navigation only: none of these entries executes production or setup. */
export function WorkflowPaths({ data, music, voice, audio }: {
  data: Snapshot; music: () => void; voice: () => void; audio: () => void;
}) {
  useTranslation();
  const musicReady = data.engines?.some(e => e.category === "music" && e.installed && e.compatible && !e.blocked_reason);
  const voiceReady = data.engines?.some(e => e.category === "voice" && e.installed && e.compatible && !e.blocked_reason);
  return <section className="panel workflow-paths" aria-label={tr("workspace", "chooseTask")}>
    <header className="panel-title"><h2>{tr("workspace", "chooseTask")}</h2></header>
    <div className="workflow-path-grid">
      <div><button className="outline" onClick={music}>{tr("workspace", "createMusic")}</button>
        <p>{tr("workspace", musicReady ? "musicPathReady" : "musicPathSetup")}</p></div>
      <div><button className="outline" onClick={voice}>{tr("workspace", "produceVoice")}</button>
        <p>{tr("workspace", voiceReady ? "voicePathReady" : "voicePathSetup")}</p></div>
      <div><button className="outline" onClick={audio}>{tr("workspace", "processExistingAudio")}</button>
        <p>{tr("workspace", "audioPathHelp")}</p></div>
    </div>
    <p className="muted workflow-path-note">{tr("workspace", "pathsOnlyNavigate")}</p>
  </section>;
}
