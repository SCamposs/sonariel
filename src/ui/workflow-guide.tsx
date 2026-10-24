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
const returnHint =
  "Este tutorial continua disponível na sidebar, em “Instruções do workflow”.";
const steps = [
  {
    title: "Da ideia à escuta, tudo no seu ritmo",
    location: "Seu workflow local",
    icon: AudioLines,
    description:
      "Use o Codex para dirigir músicas e vozes. O Sonariel organiza a execução local, os efeitos e suas versões.",
    points: [
      "Direção e pedidos de geração ficam no Codex.",
      "Aqui você acompanha, escuta, compara e prepara a edição.",
    ],
    note: "Este guia leva cerca de um minuto. Você pode fechar agora e voltar depois.",
  },
  {
    title: "Prepare o motor uma única vez",
    location: "Ambiente",
    icon: Cpu,
    description:
      "Revise os motores em Ambiente e o setup vocal em Voice Studio. Cada instalação usa sua própria pasta isolada.",
    points: [
      "Turbo continua como padrão musical. Alternativas experimentais e voz têm capacidades e licenças próprias.",
      "Modelos só são carregados quando uma geração pode começar. A RAM livre é verificada antes.",
    ],
    note: "Abrir o aplicativo não carrega o modelo. Detectar uma GPU não significa usá-la para gerar.",
  },
  {
    title: "Dê um contexto à sua produção",
    location: "Projetos & sessões",
    icon: Folder,
    description:
      "Crie um projeto com a intenção musical e use sessões para organizar os momentos de trabalho.",
    points: [
      "Confira o projeto ativo antes de pedir uma geração.",
      "Resultados, referências e decisões ficam associados ao projeto.",
    ],
    note: "A sessão organiza a produção; não substitui o projeto de edição do Audacity.",
  },
  {
    title: "Conecte a conversa ao aplicativo",
    location: "Audacity & Codex",
    icon: Link2,
    description:
      "Use “Configurar conexão Codex” para registrar a ponte MCP. Depois, recarregue o cliente Codex para carregar as ferramentas.",
    points: [
      "Peça ao Codex para usar o Sonariel e informe direção, duração e parâmetros.",
      "Configuração salva e conexão testada são estados diferentes. Confira o diagnóstico da ponte.",
    ],
    note: "O registro preserva as outras conexões e cria um backup da configuração existente.",
  },
  {
    title: "Acompanhe sem perder o controle",
    location: "Fila de geração",
    icon: Activity,
    description:
      "A fila mostra a etapa real de cada pedido, o tempo decorrido e a memória observada.",
    points: [
      "Uma geração é executada por vez. Se faltar RAM, o pedido aguarda.",
      "Só pedidos ainda não enviados ao motor podem ser cancelados. Fechar a janela não interrompe o processamento.",
    ],
    note: "Prompt, seed e parâmetros ficam junto do resultado para permitir novas iterações.",
  },
  {
    title: "Escute, escolha e leve para edição",
    location: "Biblioteca & versões → FX ou Audacity",
    icon: AudioLines,
    description:
      "Ouça no player, compare duas versões e registre notas, favoritas e a escolha atual antes de editar.",
    points: [
      "Em FX, ajuste cadeias e peça uma prévia curta; os controles não disparam renders a cada movimento.",
      "Renderize e exporte novas versões preservando o original. Audacity é opcional e exige mod-script-pipe.",
    ],
    note: "Pronto para explorar. Comece em Ambiente ou retome seu projeto atual.",
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
        <CircleHelp size={15} /> Instruções do workflow
      </button>
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
              <Dialog.Title>Conheça o Sonariel</Dialog.Title>
              <Dialog.Close
                ref={closeButton}
                className="icon-button"
                aria-label="Fechar tutorial"
                title="Fechar e explorar por conta própria"
              >
                <X size={19} />
              </Dialog.Close>
            </header>
            <Dialog.Description className="visually-hidden">
              Guia de uso em seis etapas. Use Próximo passo e Passo anterior, ou
              as setas do teclado. Pode ser fechado a qualquer momento e
              reaberto em Instruções do workflow na sidebar.
            </Dialog.Description>
            <div className="guide-progress-row">
              <span className="mono" aria-hidden="true">
                {String(step + 1).padStart(2, "0")} / 06
              </span>
              <div
                className="guide-progress"
                role="progressbar"
                aria-label="Etapas do tutorial"
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuenow={step + 1}
                aria-valuetext={`Etapa ${step + 1} de ${steps.length}`}
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
                  <ArrowLeft size={16} /> Passo anterior
                </button>
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
                  {last ? "Concluir tutorial" : "Próximo passo"}
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
