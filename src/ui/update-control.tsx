import { lazy, Suspense, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowDownToLine, Loader2, RefreshCw, X } from "lucide-react";
import { APP_VERSION, useUpdates } from "../updates";
import { SelectControl } from "./select-control";
import "./update-control.css";

const ReleaseNotes = lazy(() => import("./release-notes").then((module) => ({ default: module.ReleaseNotes })));

export function UpdateControl({ workflowBusy }: { workflowBusy: boolean }) {
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
            ? `Atualização ${update.available.version} disponível`
            : `Versão ${APP_VERSION}, atualizações`
        }
        title="Versão e atualizações"
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
              <Dialog.Title>Versão & atualizações</Dialog.Title>
              <Dialog.Close
                ref={close}
                className="icon-button"
                aria-label="Fechar atualizações"
                disabled={update.installing}
              >
                <X size={19} />
              </Dialog.Close>
            </header>
            <div className="updates-body">
              <span className="mono">SONARIEL / {APP_VERSION}</span>
              <h2>
                {update.available
                  ? `Versão ${update.available.version} disponível`
                  : update.checkedAt && !update.error
                    ? "Você está na versão atual"
                    : "Atualizações do aplicativo"}
              </h2>
              <Dialog.Description>
                As consultas usam as releases oficiais no GitHub. Nenhum áudio,
                prompt ou projeto é enviado.
              </Dialog.Description>
              {!update.supported ? (
                <p className="muted">
                  A atualização automática está disponível no aplicativo desktop
                  instalado.
                </p>
              ) : (
                <>
                  <label>
                    Verificação de versão
                    <SelectControl
                      label="Verificação de versão"
                      value={update.automatic ? "automatic" : "manual"}
                      disabled={update.installing}
                      onChange={(value) =>
                        update.changeAutomatic(value === "automatic")
                      }
                      options={[
                        { value: "automatic", label: "Ao abrir e a cada hora" },
                        {
                          value: "manual",
                          label: "Somente quando eu solicitar",
                        },
                      ]}
                    />
                  </label>
                  {update.available?.notes && (
                    <div className="update-notes">
                      <h3>O que mudou</h3>
                      <Suspense fallback={<p>Carregando notas…</p>}>
                        <ReleaseNotes notes={update.available.notes} />
                      </Suspense>
                    </div>
                  )}
                  {update.installing ? (
                    <p role="status">
                      <Loader2 size={16} className="spin" />{" "}
                      {update.progress?.phase === "installing"
                        ? "Instalando. O aplicativo será reaberto automaticamente…"
                        : `Baixando e verificando a assinatura${percent !== undefined ? ` · ${percent}%` : "…"}`}
                    </p>
                  ) : (
                    <p className="muted">
                      {update.checkedAt
                        ? `Última verificação: ${update.checkedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`
                        : "Nenhuma verificação concluída nesta sessão."}
                    </p>
                  )}
                  {update.error && (
                    <p className="update-error" role="alert">
                      {update.error}
                    </p>
                  )}
                  {workflowBusy && (
                    <p className="muted">
                      Aguarde a fila e a instalação do ambiente terminarem antes
                      de atualizar.
                    </p>
                  )}
                  <p className="update-safety">
                    A atualização só começa com sua confirmação. Feche conexões
                    MCP do Sonariel antes de instalar; projetos e áudios são
                    preservados.
                  </p>
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
                {update.checking ? "Verificando…" : "Verificar agora"}
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
                  Atualizar e reiniciar
                </button>
              )}
            </footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
