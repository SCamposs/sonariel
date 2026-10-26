import { systemMessage } from "../i18n/system-message";
import i18n, { tr } from "../i18n";
import { useTranslation } from "react-i18next";
import { lazy, Suspense, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowDownToLine, Loader2, RefreshCw, X } from "lucide-react";
import { APP_VERSION, useUpdates } from "../updates";
import { SelectControl } from "./select-control";
import "./update-control.css";

const ReleaseNotes = lazy(() => import("./release-notes").then((module) => ({ default: module.ReleaseNotes })));

export function UpdateControl({ workflowBusy }: { workflowBusy: boolean }) {
  useTranslation();
  const update = useUpdates();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const percent = update.progress?.total
    ? Math.min(
        100,
        Math.round(
          ((update.progress.downloaded ?? 0) / update.progress.total) * 100,
        ),
      )
    : undefined;
  return (
    <>
      <button
        className="version-control"
        ref={trigger}
        onClick={() => setOpen(true)}
        aria-label={
          update.available
            ? tr("updates", "updateValueAvailable", { value0: update.available.version })
            : tr("updates", "versionValueUpdates", { value0: APP_VERSION })
        }
        title={tr("updates", "versionAndUpdates")}
      >
        {APP_VERSION}
        {update.available && <i className="update-dot" aria-hidden="true" />}
      </button>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!update.installing) setOpen(next);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="ui-panel-backdrop" />
          <Dialog.Popup
            className="workflow-guide updates-dialog"
            initialFocus={close}
            finalFocus={trigger}
          >
            <header className="guide-header">
              <Dialog.Title>{tr("updates", "versionUpdates")}</Dialog.Title>
              <Dialog.Close
                ref={close}
                className="icon-button"
                aria-label={tr("updates", "closeUpdates")}
                disabled={update.installing}
              >
                <X size={19} />
              </Dialog.Close>
            </header>
            <div className="updates-body">
              <span className="mono">SONARIEL / {APP_VERSION}</span>
              <h2>
                {update.available
                  ? tr("updates", "versionValueAvailable", { value0: update.available.version })
                  : update.checkedAt && !update.error
                    ? tr("updates", "youAreUpToDate")
                    : tr("updates", "applicationUpdates")}
              </h2>
              <Dialog.Description>
                {tr("updates", "checksUseOfficialGithubReleasesNoAudioPrompt")}</Dialog.Description>
              {!update.supported ? (
                <p className="muted">
                  {tr("updates", "automaticUpdatesAreAvailableInTheInstalledDesktop")}</p>
              ) : (
                <>
                  <label>
                    {tr("updates", "versionChecks")}<SelectControl
                      label={tr("updates", "versionChecks")}
                      value={update.automatic ? "automatic" : "manual"}
                      disabled={update.installing}
                      onChange={(value) =>
                        update.changeAutomatic(value === "automatic")
                      }
                      options={[
                        { value: "automatic", label: tr("updates", "atStartupAndEveryHour") },
                        {
                          value: "manual",
                          label: tr("updates", "onlyWhenIRequestIt"),
                        },
                      ]}
                    />
                  </label>
                  {update.available?.notes && (
                    <div className="update-notes">
                      <h3>{tr("updates", "whatSChanged")}</h3>
                      <Suspense fallback={<p>{tr("updates", "loadingNotes")}</p>}>
                        <ReleaseNotes notes={update.available.notes} />
                      </Suspense>
                    </div>
                  )}
                  {update.installing ? (
                    <p role="status">
                      <Loader2 size={16} className="spin" />{" "}
                      {update.progress?.phase === "installing"
                        ? tr("updates", "installingTheAppWillReopenAutomatically")
                        : tr("updates", "downloadingAndVerifyingSignaturevalue", { value0: percent !== undefined ? ` · ${percent}%` : "…" })}
                    </p>
                  ) : (
                    <p className="muted">
                      {update.checkedAt
                        ? tr("updates", "lastCheckValue", { value0: update.checkedAt.toLocaleTimeString(i18n.resolvedLanguage, { hour: "2-digit", minute: "2-digit" }) })
                        : tr("updates", "noCheckCompletedInThisSession")}
                    </p>
                  )}
                  {update.error && (
                    <p className="update-error" role="alert">
                      {systemMessage(update.error)}
                    </p>
                  )}
                  {workflowBusy && (
                    <p className="muted">
                      {tr("updates", "waitForTheQueueAndEnvironmentInstallationTo")}</p>
                  )}
                  <p className="update-safety">
                    {tr("updates", "updatingStartsOnlyWithYourConfirmationCloseSonariel")}</p>
                </>
              )}
            </div>
            <footer className="guide-footer guide-actions">
              <button
                className="outline"
                disabled={
                  !update.supported || update.checking || update.installing
                }
                onClick={() => void update.check()}
              >
                <RefreshCw
                  size={16}
                  className={update.checking ? "spin" : ""}
                />
                {update.checking ? tr("updates", "checking") : tr("updates", "checkNow")}
              </button>
              {update.available && (
                <button
                  className="primary"
                  disabled={
                    workflowBusy || update.installing || update.checking
                  }
                  onClick={() => void update.install()}
                >
                  <ArrowDownToLine size={16} />
                  {tr("updates", "updateAndRestart")}</button>
              )}
            </footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
