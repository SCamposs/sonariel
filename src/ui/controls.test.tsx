// @vitest-environment jsdom
import { useRef, useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioSlider } from "./audio-slider";
import { SelectControl } from "./select-control";
import { SidePanel } from "./side-panel";

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
