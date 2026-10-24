import { useEffect, useState, type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AudioLines, Copy, Minus, Square, X } from "lucide-react";
import "./window-titlebar.css";

/** Narrow desktop adapter: never pretends browser preview controls operated a window. */
export function WindowTitlebar() {
  const native = "__TAURI_INTERNALS__" in window;
  const [maximized, setMaximized] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!native) return;
    let active = true;
    let stop: (() => void) | undefined;
    const appWindow = getCurrentWindow();
    const refresh = async () => {
      try {
        const value = await appWindow.isMaximized();
        if (active) setMaximized(value);
      } catch (reason) {
        if (active) setError(String(reason));
      }
    };
    void refresh();
    void appWindow
      .onResized(() => void refresh())
      .then((unlisten) => {
        if (active) stop = unlisten;
        else unlisten();
      })
      .catch((reason) => {
        if (active) setError(String(reason));
      });
    return () => {
      active = false;
      stop?.();
    };
  }, [native]);
  const operate = async (
    action: "minimize" | "toggleMaximize" | "close" | "startDragging",
  ) => {
    if (!native) return;
    try {
      const appWindow = getCurrentWindow();
      await appWindow[action]();
      if (action === "toggleMaximize")
        setMaximized(await appWindow.isMaximized());
      setError("");
    } catch (reason) {
      setError(String(reason));
    }
  };
  const drag = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !native) return;
    event.preventDefault();
    void operate(event.detail === 2 ? "toggleMaximize" : "startDragging");
  };
  return (
    <header
      className="window-titlebar"
      aria-label="Barra de título do Sonariel"
    >
      <div className="window-drag-region" onMouseDown={drag}>
        <AudioLines size={14} aria-hidden="true" />
        <span className="window-title">Sonariel</span>
        <span className="window-title-context">LOCAL AUDIO WORKSPACE</span>
      </div>
      {error && (
        <span className="window-control-error" role="alert" title={error}>
          Falha no controle da janela
        </span>
      )}
      <div
        className="window-controls"
        role="group"
        aria-label="Controles da janela"
      >
        <button
          className="window-button"
          disabled={!native}
          aria-label="Minimizar janela"
          title="Minimizar"
          onClick={() => void operate("minimize")}
        >
          <Minus size={14} />
        </button>
        <button
          className="window-button"
          disabled={!native}
          aria-label={maximized ? "Restaurar janela" : "Maximizar janela"}
          title={maximized ? "Restaurar" : "Maximizar"}
          onClick={() => void operate("toggleMaximize")}
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          className="window-button window-close"
          disabled={!native}
          aria-label="Fechar janela"
          title="Fechar"
          onClick={() => void operate("close")}
        >
          <X size={15} />
        </button>
      </div>
    </header>
  );
}
