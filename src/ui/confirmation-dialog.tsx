import { tr } from "../i18n";
import { useTranslation } from "react-i18next";
import { useRef, type ReactNode, type RefObject } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

export function ConfirmationDialog({ open, title, description, children, onClose,
  onConfirm, busy, blocked, returnFocus, confirmLabel }: {
  open: boolean; title: string; description: string; children: ReactNode;
  onClose: () => void; onConfirm: () => void; busy: boolean; blocked: boolean;
  returnFocus: RefObject<HTMLButtonElement | null>;
  confirmLabel?: string;
}) {
  useTranslation();
  const cancel = useRef<HTMLButtonElement>(null);
  return <Dialog.Root open={open} onOpenChange={next => { if (!next && !busy) onClose(); }}>
    <Dialog.Portal><Dialog.Backdrop className="ui-panel-backdrop" />
      <Dialog.Popup className="workflow-guide storage-dialog" initialFocus={cancel} finalFocus={returnFocus}>
        <header className="guide-header"><Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close className="icon-button" disabled={busy} aria-label={tr("common", "closePreview")}><X size={18} /></Dialog.Close>
        </header>
        <div className="storage-confirm"><Dialog.Description>{description}</Dialog.Description>{children}</div>
        <footer className="guide-footer"><Dialog.Close ref={cancel} className="outline" disabled={busy}>{tr("common", "keepFiles")}</Dialog.Close>
          <button className="primary" disabled={busy || blocked} onClick={onConfirm}>{confirmLabel ?? tr("common", "confirmRecoverableDiscard")}</button></footer>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
