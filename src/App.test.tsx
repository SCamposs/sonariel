// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";
import { rpc } from "./api";

vi.mock("./api", async () => ({
  ...(await vi.importActual("./api")),
  rpc: vi.fn(),
}));
vi.mock("./ui/workflow-guide", () => ({ WorkflowGuide: () => null }));
vi.mock("./ui/update-control", () => ({ UpdateControl: () => null }));
vi.mock("./ui/select-control", () => ({ SelectControl: () => null }));
vi.mock("./ui/audio-slider", () => ({ AudioSlider: () => null }));
vi.mock("./studio", () => ({
  FxStudio: () => <div>FX workspace</div>,
  VoiceStudio: () => <div>Voice workspace</div>,
  MusicEngines: () => null,
}));

beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); });

it("switches Voice to retained FX without reusing the sibling workspace identity", async () => {
  const snapshot = {
    projects: [], sessions: [], assets: [], jobs: [], events: [], edits: [],
    selected_project: "project-one", setup: null, environment: null,
    engine: { state: "stopped", managed: false, rss_gib: 0 },
    telemetry: { available_gib: 8, total_gib: 24, used_percent: 67 },
    codex: { configured: false, tested: false },
    audacity: { running: false, pipe_available: false, tested: false },
    preferences: { idle_minutes: 10 },
  };
  vi.mocked(rpc).mockImplementation(async method => method === "snapshot" ? snapshot : {});
  render(<App />);
  await screen.findByText("Do contexto à próxima decisão.");
  fireEvent.click(screen.getByRole("button", { name: "Voice Studio" }));
  expect(screen.getByText("Voice workspace")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "FX & processamento" }));
  expect(screen.queryByText("Voice workspace")).toBeNull();
  expect(screen.getByText("FX workspace").closest("[hidden]")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Voice Studio" }));
  expect(screen.getByText("Voice workspace")).toBeTruthy();
  expect(screen.getByText("FX workspace").closest("[hidden]")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "FX & processamento" }));
  expect(screen.queryByText("Voice workspace")).toBeNull();
  expect(screen.getByText("FX workspace").closest("[hidden]")).toBeNull();
});

it.each([false, true])("keeps shared refresh busy through completion (failure=%s)", async (fails) => {
  const snapshot = {
    projects: [], sessions: [], assets: [], jobs: [], events: [], edits: [],
    selected_project: null, setup: null, environment: null,
    engine: { state: "stopped", managed: false, rss_gib: 0 },
    telemetry: { available_gib: 8, total_gib: 24, used_percent: 67 },
    codex: { configured: false, tested: false },
    audacity: { running: false, pipe_available: false, tested: false },
    preferences: { idle_minutes: 10 },
  };
  vi.mocked(rpc).mockImplementation(async (method) => method === "snapshot" ? snapshot : {});
  render(<App />);
  await screen.findByText("Do contexto à próxima decisão.");
  fireEvent.click(screen.getByRole("button", { name: "FX & processamento" }));
  expect(screen.getByText("FX workspace")).toBeTruthy();
  let finish!: (value: unknown) => void;
  let fail!: (reason: Error) => void;
  const pending = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
  vi.mocked(rpc).mockImplementation(() => pending);
  const button = screen.getByRole("button", { name: "Atualizar estado" }) as HTMLButtonElement;
  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.querySelector("svg")?.classList.contains("spin")).toBe(true);
  fireEvent.click(button);
  // Only the initial poll, connection and one manual refresh were sent.
  expect(rpc).toHaveBeenCalledTimes(3);
  await act(async () => { if (fails) fail(new Error("Refresh failed")); else finish(snapshot); });
  await waitFor(() => expect(button.disabled).toBe(false));
  expect(button.getAttribute("aria-busy")).toBe("false");
  expect(button.querySelector("svg")?.classList.contains("spin")).toBe(false);
  if (fails) expect(screen.getByRole("alert").textContent).toContain("Refresh failed");
});
