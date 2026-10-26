import { tr } from "../i18n";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  CircleHelp,
  Cpu,
  Folder,
  Link2,
  X,
} from "lucide-react";
import "./workflow-guide.css";

export const GUIDE_STORAGE_KEY = "sonariel.workflow-guide.v1";
const getSteps = () => [
  {
    title: tr("guide", "fromIdeaToListeningAtYourOwnPace"),
    location: tr("guide", "yourLocalWorkflow"),
    icon: AudioLines,
    description:
      tr("guide", "useCodexToDirectMusicAndVoicesSonariel"),
    points: [
      tr("guide", "creativeDirectionAndGenerationRequestsStayInCodex"),
      tr("guide", "followExecutionListenCompareAndPrepareEditsHere"),
    ],
    note: tr("guide", "thisGuideTakesAboutAMinuteYouCan"),
  },
  {
    title: tr("guide", "prepareAnEngineOnce"),
    location: tr("guide", "environment"),
    icon: Cpu,
    description:
      tr("guide", "reviewEnginesInEnvironmentAndVoiceSetupIn"),
    points: [
      tr("guide", "turboRemainsTheMusicDefaultExperimentalAlternativesAnd"),
      tr("guide", "modelsLoadOnlyWhenAGenerationCanStart"),
    ],
    note: tr("guide", "openingTheAppDoesNotLoadAModel"),
  },
  {
    title: tr("guide", "giveYourProductionContext"),
    location: tr("guide", "projectsSessions"),
    icon: Folder,
    description:
      tr("guide", "createAProjectWithYourMusicalIntentAnd"),
    points: [
      tr("guide", "checkTheActiveProjectBeforeRequestingAGeneration"),
      tr("guide", "resultsReferencesAndDecisionsStayAssociatedWithThe"),
    ],
    note: tr("guide", "aSessionOrganizesProductionItDoesNotReplace"),
  },
  {
    title: tr("guide", "connectTheConversationToTheApp"),
    location: tr("guide", "audacityCodex"),
    icon: Link2,
    description:
      tr("guide", "useConfigureCodexConnectionToRegisterTheMcp"),
    points: [
      tr("guide", "askCodexToUseSonarielAndProvideDirection"),
      tr("guide", "savedConfigurationAndATestedConnectionAreDifferent"),
    ],
    note: tr("guide", "registrationPreservesOtherConnectionsAndBacksUpThe"),
  },
  {
    title: tr("guide", "followExecutionAndStayInControl"),
    location: tr("guide", "generationQueue"),
    icon: Activity,
    description:
      tr("guide", "theQueueShowsEachRequestSRealStage"),
    points: [
      tr("guide", "oneGenerationRunsAtATimeRequestsWait"),
      tr("guide", "onlyRequestsNotYetSubmittedToTheEngine"),
    ],
    note: tr("guide", "promptsSeedsAndParametersStayWithTheResult"),
  },
  {
    title: tr("guide", "listenChooseAndPrepareAnEdit"),
    location: tr("guide", "libraryVersionsFxOrAudacity"),
    icon: AudioLines,
    description:
      tr("guide", "listenInThePlayerCompareTwoVersionsAnd"),
    points: [
      tr("guide", "inFxAdjustChainsAndRequestAShort"),
      tr("guide", "renderAndExportNewVersionsWhilePreservingThe"),
    ],
    note: tr("guide", "readyToExploreStartInEnvironmentOrReturn"),
  },
];

function needsIntroduction() {
  try {
    return localStorage.getItem(GUIDE_STORAGE_KEY) === null;
  } catch {
    return true;
  }
}

/** Presentational tour only: never invokes setup, generation or editing RPCs. */
export function WorkflowGuide({ ready }: { ready: boolean }) {
  useTranslation();
  const returnHint = tr("guide", "thisGuideRemainsAvailableInTheSidebarUnder");
  const steps = getSteps();
  const [open, setOpen] = useState(needsIntroduction);
  const [step, setStep] = useState(0);
  const [reminder, setReminder] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const current = steps[step];
  const Icon = current.icon;
  const last = step === steps.length - 1;

  function dismiss() {
    setOpen(false);
    setReminder(true);
    try {
      localStorage.setItem(GUIDE_STORAGE_KEY, last ? "completed" : "dismissed");
    } catch {
      // Storage can be unavailable; dismissal must still work in this session.
    }
  }

  return (
    <>
      <button
        ref={trigger}
        className="text-button"
        onClick={() => {
          setStep(0);
          setReminder(false);
          setOpen(true);
        }}
      >
        <CircleHelp size={15} /> {tr("guide", "workflowInstructions")}</button>
      {reminder && (
        <p className="guide-return-notice" role="status">
          {returnHint}
        </p>
      )}
      <Dialog.Root
        open={ready && open}
        onOpenChange={(next) => {
          if (!next) dismiss();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="ui-panel-backdrop" />
          <Dialog.Popup
            className="workflow-guide"
            initialFocus={closeButton}
            finalFocus={trigger}
            onKeyDown={(event) => {
              if (
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey
              )
                return;
              if (event.key === "ArrowRight") {
                event.preventDefault();
                setStep((value) => Math.min(value + 1, steps.length - 1));
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setStep((value) => Math.max(0, value - 1));
              }
            }}
          >
            <header className="guide-header">
              <Dialog.Title>{tr("guide", "getToKnowSonariel")}</Dialog.Title>
              <Dialog.Close
                ref={closeButton}
                className="icon-button"
                aria-label={tr("guide", "closeTutorial")}
                title={tr("guide", "closeAndExploreOnYourOwn")}
              >
                <X size={19} />
              </Dialog.Close>
            </header>
            <Dialog.Description className="visually-hidden">
              {tr("guide", "sixStepGuideUseNextStepAndPrevious")}</Dialog.Description>
            <div className="guide-progress-row">
              <span className="mono" aria-hidden="true">
                {String(step + 1).padStart(2, "0")} / 06
              </span>
              <div
                className="guide-progress"
                role="progressbar"
                aria-label={tr("guide", "tutorialSteps")}
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuenow={step + 1}
                aria-valuetext={tr("guide", "stepValueOfValue", { value0: step + 1, value1: steps.length })}
              >
                <span
                  style={{ transform: `scaleX(${(step + 1) / steps.length})` }}
                />
              </div>
            </div>
            <div
              className="guide-step-viewport"
              aria-live="polite"
              aria-atomic="true"
            >
              <section className="guide-step" key={step}>
                <div className="guide-location">
                  <Icon size={18} aria-hidden="true" />
                  <span>{current.location}</span>
                </div>
                <h2>{current.title}</h2>
                <p className="guide-description">{current.description}</p>
                <ul>
                  {current.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <p className="guide-note">{current.note}</p>
              </section>
            </div>
            <footer className="guide-footer">
              <p>{returnHint}</p>
              <div className="guide-actions">
                <button
                  className="outline"
                  disabled={step === 0}
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                >
                  <ArrowLeft size={16} /> {tr("guide", "previousStep")}</button>
                <button
                  className="primary"
                  onClick={() =>
                    last
                      ? dismiss()
                      : setStep((value) =>
                          Math.min(value + 1, steps.length - 1),
                        )
                  }
                >
                  {last ? tr("guide", "finishTutorial") : tr("guide", "nextStep")}
                  {last ? <Check size={16} /> : <ArrowRight size={16} />}
                </button>
              </div>
            </footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
