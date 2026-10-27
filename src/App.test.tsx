// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  FxStudio: ({ initialAssetId }: { initialAssetId?: string }) => <><div>FX workspace</div><output aria-label="FX source identity">{initialAssetId}</output></>,
  VoiceStudio: () => <div>Voice workspace</div>,
  MusicEngines: () => null,
}));

beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {}); vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); });

it("links a music engine through the environment UI without an Audacity field", async () => {
  const snapshot = {
    projects: [], sessions: [], assets: [], jobs: [], events: [], edits: [],
    selected_project: null, setup: null, environment: null,
    engine: { state: "stopped", managed: false, rss_gib: 0 },
    telemetry: { available_gib: 8, total_gib: 24, used_percent: 67 },
    codex: { configured: false, tested: false },
    audacity: { running: false, pipe_available: false, tested: false },
    preferences: { idle_minutes: 10 },
  };
  vi.mocked(rpc).mockImplementation(async method => method === "snapshot" ? snapshot : {});
  render(<App />);
  await screen.findByText("O que você quer fazer?");
  fireEvent.click(screen.getByRole("button", { name: "Ambiente" }));
  expect(screen.queryByLabelText("Executável do Audacity")).toBeNull();
  expect(screen.getByText(/Audacity é opcional/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Pasta do ambiente"), { target: { value: "D:/synthetic-engine" } });
  fireEvent.click(screen.getByRole("button", { name: "Inspecionar e vincular" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("environment_link", { root: "D:/synthetic-engine" }));
});

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
  await screen.findByText("O que você quer fazer?");
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
  await screen.findByText("O que você quer fazer?");
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

const workflowAsset = (id: string, name: string, project = "p") => ({
  id, name, project_id: project, session_id: "s", job_id: null as string | null, path: `C:/fixtures/${id}.wav`, kind: "imported",
  parent_id: null, favorite: 0, selected: 0, notes: "", created: 1,
  metadata: { duration: 12, sample_rate: 24000, channels: 1, waveform: [], peak: .1, rms: .05, subtype: "PCM_16", sha256: "synthetic" },
});
const workflowSnapshot = () => ({
  projects: [{ id: "p", name: "Study", context: "", created: 1, result_count: 2 }],
  sessions: [{ id: "s", project_id: "p", name: "Session one", created: 1 }],
  assets: [workflowAsset("a".repeat(32), "First signal"), workflowAsset("b".repeat(32), "Second signal")],
  references: [], jobs: [] as Record<string, unknown>[], events: [], edits: [], selected_project: "p", setup: null, environment: null,
  engine: { state: "stopped", managed: false, rss_gib: 0 },
  telemetry: { available_gib: 8, total_gib: 24, used_percent: 67 },
  codex: { configured: false, tested: false }, audacity: { running: false, pipe_available: false, tested: false },
  preferences: { idle_minutes: 10 },
});

it("routes task intentions without generating, downloading or installing", async () => {
  const data = workflowSnapshot();
  vi.mocked(rpc).mockImplementation(async method => method === "snapshot" ? data : method.endsWith("_list") ? [] : {});
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Criar música" }));
  expect(screen.getByRole("button", { name: "Inspecionar e vincular" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Projetos & sessões" }));
  fireEvent.click(screen.getByRole("button", { name: "Produzir voz" }));
  expect(screen.getByText("Voice workspace")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Projetos & sessões" }));
  fireEvent.click(screen.getByRole("button", { name: "Processar um WAV existente" }));
  expect(screen.getByRole("heading", { name: "Catalogar arquivo local" })).toBeTruthy();
  expect(vi.mocked(rpc).mock.calls.some(([method]) => /generate|setup_install|engine_start/.test(method))).toBe(false);
});

it("puts audio before advanced tools and hands the chosen asset to FX independently of playback", async () => {
  const data = workflowSnapshot();
  vi.mocked(rpc).mockImplementation(async method => method === "snapshot" ? data : method.endsWith("_list") ? [] : {});
  render(<App />);
  await screen.findByText("O que você quer fazer?");
  fireEvent.click(screen.getByRole("button", { name: "Biblioteca & versões" }));
  const first = document.querySelector(`[data-asset-id="${data.assets[0].id}"]`)!;
  const second = document.querySelector(`[data-asset-id="${data.assets[1].id}"]`)!;
  const advanced = screen.getByText("Trechos de áudio e presets musicais");
  expect(first.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(within(first as HTMLElement).getByRole("button", { name: /Ouvir First signal/ }));
  fireEvent.click(within(second as HTMLElement).getByRole("button", { name: "Abrir no FX" }));
  expect(screen.getByLabelText("FX source identity").textContent).toBe(data.assets[1].id);
  expect(screen.getByRole("button", { name: "Detalhes da faixa em reprodução" })).toBeTruthy();
});

it("opens session results with the real session filter and preserves it across module navigation", async () => {
  const data = workflowSnapshot();
  vi.mocked(rpc).mockImplementation(async method => method === "snapshot" ? data : method.endsWith("_list") ? [] : {});
  render(<App />);
  await screen.findByText("O que você quer fazer?");
  fireEvent.click(screen.getByRole("button", { name: "Abrir resultados da sessão" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("library_filters_save", { project_id: "p", filters: expect.objectContaining({ session_id: "s" }) }));
  expect(screen.getByText(/Filtros ativos: Session one/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Voice Studio" }));
  fireEvent.click(screen.getByRole("button", { name: "Biblioteca & versões" }));
  expect(screen.getByText(/Filtros ativos: Session one/)).toBeTruthy();
});

it("opens a completed foreign-project job by its actual result and switches project before navigation", async () => {
  const data = workflowSnapshot();
  data.projects.push({ id: "q", name: "Other study", context: "", created: 2, result_count: 1 });
  const foreign = { ...workflowAsset("c".repeat(32), "Foreign result", "q"), job_id: "d".repeat(32) };
  data.assets.push(foreign);
  data.jobs.push({ id: foreign.job_id, project_id: "q", state: "completed", remote_id: null, stage: "Concluída", params: { _engine: "native-fx" }, metrics: {}, created: 1, started: 1, finished: 2 });
  vi.mocked(rpc).mockImplementation(async (method, args) => {
    if (method === "snapshot") return { ...data };
    if (method === "project_select") { data.selected_project = String(args?.project_id); return { project_id: data.selected_project }; }
    return method.endsWith("_list") ? [] : {};
  });
  render(<App />);
  await screen.findByText("O que você quer fazer?");
  fireEvent.click(screen.getByRole("button", { name: "Fila de geração" }));
  fireEvent.click(screen.getByText(foreign.job_id.slice(0, 10)).closest("summary")!);
  fireEvent.click(screen.getByRole("button", { name: "Abrir resultado na biblioteca" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("project_select", { project_id: "q" }));
  await waitFor(() => expect(document.querySelector(`[data-asset-id="${foreign.id}"]`)).not.toBeNull());
  expect(document.querySelector(`[data-asset-id="${data.assets[0].id}"]`)).toBeNull();
  expect(document.activeElement?.getAttribute("data-asset-id")).toBe(foreign.id);
});
