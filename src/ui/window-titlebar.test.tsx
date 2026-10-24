// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { WindowTitlebar } from "./window-titlebar";
const operations = vi.hoisted(() => ({
  isMaximized: vi.fn(),
  onResized: vi.fn(),
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
  startDragging: vi.fn(),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => operations,
}));
beforeEach(() => {
  operations.isMaximized.mockResolvedValue(false);
  operations.onResized.mockResolvedValue(vi.fn());
  for (const key of [
    "minimize",
    "toggleMaximize",
    "close",
    "startDragging",
  ] as const)
    operations[key].mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});
it("does not simulate native operations in a browser preview", () => {
  render(<WindowTitlebar />);
  expect(
    (
      screen.getByRole("button", {
        name: "Minimizar janela",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(operations.onResized).not.toHaveBeenCalled();
});
it("operates native controls, updates restore state and reports failures", async () => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
  render(<WindowTitlebar />);
  fireEvent.click(screen.getByRole("button", { name: "Minimizar janela" }));
  await waitFor(() => expect(operations.minimize).toHaveBeenCalledTimes(1));
  operations.isMaximized.mockResolvedValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Maximizar janela" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Restaurar janela" }),
    ).toBeDefined(),
  );
  operations.close.mockRejectedValueOnce(new Error("Window command rejected"));
  fireEvent.click(screen.getByRole("button", { name: "Fechar janela" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Falha"),
  );
});
it("drags only with the primary button and maximizes on double click", async () => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
  render(<WindowTitlebar />);
  const region = screen.getByText("Sonariel").parentElement!;
  fireEvent.mouseDown(region, { button: 2, detail: 1 });
  expect(operations.startDragging).not.toHaveBeenCalled();
  fireEvent.mouseDown(region, { button: 0, detail: 1 });
  await waitFor(() =>
    expect(operations.startDragging).toHaveBeenCalledTimes(1),
  );
  fireEvent.mouseDown(region, { button: 0, detail: 2 });
  await waitFor(() =>
    expect(operations.toggleMaximize).toHaveBeenCalledTimes(1),
  );
});
