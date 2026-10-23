import { useRef, type ReactNode, type RefObject } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

export type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  returnFocus: RefObject<HTMLElement | null>;
};

export function SidePanel({
  open,
  onClose,
  title,
  children,
  returnFocus,
}: SidePanelProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="ui-panel-backdrop" />
        <Dialog.Popup
          className="detail-drawer"
          initialFocus={closeButton}
          finalFocus={returnFocus}
        >
          <header>
            <span className="signal-label">DETALHES DA VERSÃO</span>
            <Dialog.Close
              ref={closeButton}
              className="icon-button"
              aria-label="Fechar detalhes"
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description className="visually-hidden">
            Parâmetros, histórico e observações da versão de áudio.
          </Dialog.Description>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
