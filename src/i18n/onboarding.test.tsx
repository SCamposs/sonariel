// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../App";
import { rpc, type Snapshot } from "../api";
import i18n from "./index";
import { GUIDE_STORAGE_KEY } from "../ui/workflow-guide";

vi.mock("../api", async () => ({ ...(await vi.importActual("../api")), rpc: vi.fn() }));
// Native picker/selector behavior has its own tests; this tests onboarding ordering.
vi.mock("../ui/select-control", () => ({ SelectControl: ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[];
}) => <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
  {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> }));
const snapshot = (existing: boolean, locale: "en" | "pt-BR" | null): Snapshot => ({
  projects: [], sessions: [], assets: [], jobs: [], events: [], edits: [], engines: [],
  selected_project: null, setup: null, environment: null,
  engine: { state: "stopped", managed: false, rss_gib: 0, load_seconds: null },
  telemetry: { available_gib: 8, total_gib: 24, used_percent: 67, cpu_percent: 0,
    cpu: "Synthetic test", platform: "Test", logical_cores: 4, free_disk_gib: 100 },
  data_home: "C:/SonarielDemo",
  codex: { configured: false, tested: false }, audacity: { running: false, pipe_available: false, tested: false },
  preferences: { idle_minutes: 10 }, ui_preferences: { existing_installation: existing, locale },
} as Snapshot);

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US"] });
});
afterEach(async () => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); await i18n.changeLanguage("pt-BR"); });

it("chooses language before the first tutorial and persists before continuing", async () => {
  let data = snapshot(false, null);
  vi.mocked(rpc).mockImplementation(async (method, args) => {
    if (method === "snapshot") return data;
    if (method === "ui_preferences_save") { data = snapshot(false, args!.locale as "en"); return data.ui_preferences; }
    return {};
  });
  const { unmount } = render(<App />);
  expect(await screen.findByRole("dialog", { name: "Choose your language" })).toBeTruthy();
  expect(screen.queryByRole("dialog", { name: "Get to know Sonariel" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("dialog", { name: "Get to know Sonariel" })).toBeTruthy();
  expect(rpc).toHaveBeenCalledWith("ui_preferences_save", { locale: "en" });
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(screen.getByRole("heading", { name: "Prepare an engine once" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close tutorial" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(localStorage.getItem(GUIDE_STORAGE_KEY)).toBe("dismissed");
  unmount(); render(<App />);
  await screen.findByRole("button", { name: "Settings" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("preserves an existing completed guide and changes mounted UI immediately", async () => {
  localStorage.setItem(GUIDE_STORAGE_KEY, "completed");
  let data = snapshot(true, null);
  vi.mocked(rpc).mockImplementation(async (method, args) => {
    if (method === "snapshot") return data;
    if (method === "ui_preferences_save") { data = snapshot(true, args!.locale as "en"); return data.ui_preferences; }
    return {};
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Configurações" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Idioma do aplicativo" }), { target: { value: "en" } });
  expect(await screen.findByRole("dialog", { name: "Settings" })).toBeTruthy();
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("ui_preferences_save", { locale: "en" }));
  fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
  expect(await screen.findByRole("button", { name: "Projects & sessions" })).toBeTruthy();
  expect(localStorage.getItem(GUIDE_STORAGE_KEY)).toBe("completed");
  expect(vi.mocked(rpc).mock.calls.every(([method]) => ["snapshot", "__connection", "ui_preferences_save"].includes(method))).toBe(true);
});
