// @vitest-environment jsdom
import { useRef, useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioSlider } from "./audio-slider";
import { SelectControl } from "./select-control";
import { SidePanel } from "./side-panel";
import { GUIDE_STORAGE_KEY, WorkflowGuide } from "./workflow-guide";

beforeAll(() => {
  // jsdom has no layout/media engine. These are test platform adapters, not app mocks.
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    value: TestPointerEvent,
  });
  Object.defineProperty(HTMLElement.prototype, "getClientRects", {
    configurable: true,
    value() {
      return this.hidden || this.style.display === "none"
        ? []
        : [new DOMRect(0, 0, 100, 24)];
    },
  });
  window.matchMedia ??= () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(cleanup);

function SelectExample() {
  const [value, setValue] = useState("one");
  return (
    <SelectControl
      label="Projeto ativo"
      value={value}
      onChange={setValue}
      options={[
        { value: "one", label: "Primeiro projeto" },
        { value: "two", label: "Segundo projeto" },
      ]}
    />
  );
}

function PanelExample() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} onClick={() => setOpen(true)}>
        Ver detalhes
      </button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Versão de teste"
        returnFocus={trigger}
      >
        <label>
          Observações
          <textarea />
        </label>
        <button>Salvar notas</button>
      </SidePanel>
    </>
  );
}

function SliderExample() {
  const [value, setValue] = useState(0.5);
  return (
    <AudioSlider
      label="Volume"
      value={value}
      onChange={setValue}
      step={0.1}
      formatValue={(current) => `${Math.round(current * 100)}%`}
    />
  );
}

describe("Sonariel interaction contracts", () => {
  it("selects an option by keyboard and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<SelectExample />);
    const trigger = screen.getByRole("combobox", { name: "Projeto ativo" });
    await user.click(trigger);
    expect(await screen.findByRole("listbox")).toBeTruthy();
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() =>
      expect(trigger.textContent).toContain("Segundo projeto"),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("contains focus inside the panel and restores it on Escape", async () => {
    const user = userEvent.setup();
    render(<PanelExample />);
    const trigger = screen.getByRole("button", { name: "Ver detalhes" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: "Versão de teste",
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Fechar detalhes" }),
      ),
    );
    for (let i = 0; i < 6; i++) {
      await user.tab();
      await waitFor(() =>
        expect(dialog.contains(document.activeElement)).toBe(true),
      );
    }
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("changes a slider by keyboard and exposes the human-readable value", async () => {
    const user = userEvent.setup();
    render(<SliderExample />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    const slider = screen.getByRole("slider", {
      name: "Volume",
    }) as HTMLInputElement;
    expect(Number(slider.value)).toBeCloseTo(0.6);
    expect(slider.getAttribute("aria-valuetext")).toBe("60%");
  });

  it("keeps inactive playback controls disabled", () => {
    render(
      <AudioSlider
        label="Posição de reprodução"
        value={0}
        onChange={() => {
          throw new Error("Disabled control changed");
        }}
        disabled
      />,
    );
    expect(
      (
        screen.getByRole("slider", {
          name: "Posição de reprodução",
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
  });
});

describe("Workflow introduction", () => {
  it("waits for the workspace, then introduces first-time users", async () => {
    localStorage.clear();
    const { rerender } = render(<WorkflowGuide ready={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<WorkflowGuide ready />);
    expect(
      await screen.findByRole("dialog", { name: "Conheça o Sonariel" }),
    ).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "1",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Passo anterior",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("remembers dismissal and reopens from the sidebar at the first step", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    const first = render(<WorkflowGuide ready />);
    await user.click(
      await screen.findByRole("button", { name: "Fechar tutorial" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(GUIDE_STORAGE_KEY)).toBe("dismissed");
    expect(screen.getByRole("status").textContent).toContain(
      "Instruções do workflow",
    );
    first.unmount();
    render(<WorkflowGuide ready />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const trigger = screen.getByRole("button", {
      name: "Instruções do workflow",
    });
    await user.click(trigger);
    expect(
      await screen.findByRole("heading", {
        name: "Da ideia à escuta, tudo no seu ritmo",
      }),
    ).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("keeps one progress track while navigating, completes and remains replayable", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    const { unmount } = render(<WorkflowGuide ready />);
    await screen.findByRole("dialog");
    const progress = screen.getByRole("progressbar");
    const fill = progress.firstElementChild;
    await user.click(screen.getByRole("button", { name: "Próximo passo" }));
    expect(screen.getByRole("progressbar")).toBe(progress);
    expect(progress.firstElementChild).toBe(fill);
    expect(progress.getAttribute("aria-valuenow")).toBe("2");
    await user.keyboard("{ArrowLeft}");
    expect(progress.getAttribute("aria-valuenow")).toBe("1");
    for (let i = 0; i < 5; i++)
      await user.click(screen.getByRole("button", { name: "Próximo passo" }));
    expect(progress.getAttribute("aria-valuenow")).toBe("6");
    expect((fill as HTMLElement).style.transform).toBe("scaleX(1)");
    expect(screen.getByText(/Este tutorial continua disponível/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Concluir tutorial" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(GUIDE_STORAGE_KEY)).toBe("completed");
    unmount();
    render(<WorkflowGuide ready />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Instruções do workflow" }),
    );
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "1",
    );
  });
});
