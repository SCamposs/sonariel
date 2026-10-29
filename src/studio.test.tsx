// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { FxStudio, VoiceStudio, MusicEngines } from "./studio";
import { rpc, type Asset, type Snapshot } from "./api";
import { RetainedWorkspace } from "./ui/retained-workspace";
import { tr } from "./i18n";
import userEvent from "@testing-library/user-event";

vi.mock("./api", async () => ({
  ...(await vi.importActual("./api")),
  rpc: vi.fn(),
}));
beforeAll(() => {
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
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const asset: Asset = {
  id: "a".repeat(32),
  project_id: "p",
  session_id: null,
  job_id: null,
  path: "C:/audio/source.wav",
  name: "Independent WAV",
  kind: "imported",
  parent_id: null,
  favorite: 0,
  selected: 0,
  notes: "",
  created: 1,
  metadata: {
    duration: 30,
    sample_rate: 48000,
    channels: 2,
    waveform: [],
    peak: 0.2,
    rms: 0.05,
    subtype: "FLOAT",
    sha256: "original",
  },
};
const snapshot = {
  projects: [{ id: "p", name: "Study", context: "" }],
  assets: [asset],
  jobs: [],
  selected_project: "p",
  engines: [
    {
      id: "chatterbox-v3",
      category: "voice",
      installed: true,
      languages: { pt: "Portuguese", fr: "French" },
    },
  ],
  setup: null,
} as unknown as Snapshot;
const props = () => ({
  data: snapshot,
  busy: false,
  act: vi.fn(async () => ({})),
  listen: vi.fn(),
  edit: vi.fn(),
});

it("offers loop creation only when explicitly granted by the core", () => {
  vi.mocked(rpc).mockResolvedValue([]);
  const p = props();
  const view = render(<FxStudio {...p} />);
  expect(screen.queryByText(tr("production", "loops"))).toBeNull();
  expect(screen.queryByRole("button", { name: tr("production", "createLoop") })).toBeNull();
  view.rerender(<FxStudio {...p} data={{ ...snapshot, capabilities: { loop_creation: false } }} />);
  expect(screen.queryByText(tr("production", "loops"))).toBeNull();
  view.rerender(<FxStudio {...p} data={{ ...snapshot, capabilities: { loop_creation: true } }} />);
  expect(screen.queryByText(tr("production", "loops"))).not.toBeNull();
});

it("retains the FX source and unsaved chain across module navigation, but resets on project change", async () => {
  vi.mocked(rpc).mockResolvedValue([]);
  const p = props();
  const workspace = (active: boolean, project = "p") => <RetainedWorkspace key={project} active={active}>
    <FxStudio {...p} data={{ ...snapshot, selected_project: project }} initialAssetId={asset.id} />
  </RetainedWorkspace>;
  const view = render(workspace(false));
  expect(rpc).not.toHaveBeenCalled();
  view.rerender(workspace(true));
  fireEvent.click(screen.getByRole("button", { name: "Adicionar efeito" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Ganho (dB)" }), { target: { value: "-9" } });
  view.rerender(workspace(false));
  expect(screen.queryByRole("button", { name: "Renderizar versão completa" })).toBeNull();
  view.rerender(workspace(true));
  expect((screen.getByRole("spinbutton", { name: "Ganho (dB)" }) as HTMLInputElement).value).toBe("-9");
  fireEvent.click(screen.getByRole("button", { name: "Renderizar versão completa" }));
  expect(p.act).toHaveBeenCalledWith("fx_render", expect.objectContaining({ asset_id: asset.id,
    recipe: expect.objectContaining({ chain: [{ wet: 1, effect: { type: "gain", db: -9 } }] }) }), expect.any(String));
  view.rerender(workspace(true, "other-project"));
  expect(screen.queryByRole("spinbutton", { name: "Ganho (dB)" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Renderizar versão completa" })).toBeNull();
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("fx_presets_list", { project_id: "other-project" }));
});

it("distinguishes text-only LiteRT setup from prepared audio-input capability", () => {
  const p=props();
  const data={...snapshot,engines:[{id:'stable-audio-3-medium',name:'Medium',category:'music',installed:true,backend:'litert-cpu',license:'Terms',audio_input_ready:false}]} as unknown as Snapshot;
  const view=render(<MusicEngines {...p} data={data} />);
  expect(screen.getByText(/Áudio de entrada requer encoder/)).toBeTruthy();
  view.rerender(<MusicEngines {...p} data={{...data,engines:data.engines!.map(e=>({...e,audio_input_ready:true}))}} />);
  expect(screen.getByText(/áudio de entrada até 120 s/)).toBeTruthy();
});

it("edits a real FX recipe without rendering on every control change", async () => {
  vi.mocked(rpc).mockResolvedValue([]);
  const p = props();
  render(<FxStudio {...p} initialAssetId={asset.id} />);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar efeito" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Ganho (dB)" }), {
    target: { value: "-9" },
  });
  expect(p.act).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Renderizar prévia (até 10 s)" }),
  );
  expect(p.act).toHaveBeenCalledWith(
    "fx_render",
    expect.objectContaining({
      asset_id: asset.id,
      preview: true,
      recipe: expect.objectContaining({
        chain: [{ wet: 1, effect: { type: "gain", db: -9 } }],
      }),
    }),
    expect.any(String),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Ativar Ganho 1" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Renderizar versão completa" }),
  );
  expect(p.act).toHaveBeenLastCalledWith(
    "fx_render",
    expect.objectContaining({
      preview: false,
      recipe: expect.objectContaining({
        chain: [{ wet: 0, effect: { type: "gain", db: -9 } }],
      }),
    }),
    expect.any(String),
  );
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith("fx_presets_list", { project_id: "p" }),
  );
});

it("saves a project-scoped new preset revision and never overwrites originals", async () => {
  vi.mocked(rpc).mockResolvedValue([]);
  const p = props();
  render(<FxStudio {...p} initialAssetId={asset.id} />);
  fireEvent.change(screen.getByLabelText("Nome da revisão"), {
    target: { value: "Personal chain" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar revisão de preset DSP" }));
  expect(p.act).toHaveBeenCalledWith(
    "fx_preset_save",
    expect.objectContaining({ name: "Personal chain", project_id: "p" }),
    expect.any(String),
  );
  expect(asset.metadata.sha256).toBe("original");
});

it("requires explicit language and reference consent, without automatic continuation", async () => {
  vi.mocked(rpc).mockResolvedValue([]);
  const p = props();
  render(<VoiceStudio {...p} openFx={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Criar perfil manualmente" }));
  expect(
    (
      screen.getByRole("button", {
        name: "Salvar perfil vocal",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    screen.getByRole("combobox", { name: "Idioma do perfil vocal" })
      .textContent,
  ).toContain("Selecione");
  expect(screen.queryByRole("button", { name: /continuar|gerar/i })).toBeNull();
  expect(p.act).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith("voice_profiles_list", {
      project_id: "p",
    }),
  );
});

it("keeps voice fields out of the first-use path and retains a chosen manual draft only in its project", async () => {
  vi.mocked(rpc).mockResolvedValue([]);
  const p = props();
  const workspace = (active: boolean, project = "p") => <RetainedWorkspace key={project} active={active}>
    <VoiceStudio {...p} data={{ ...snapshot, selected_project: project }} openFx={vi.fn()} />
  </RetainedWorkspace>;
  const view = render(workspace(true));
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Criar perfil manualmente" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nome do perfil" }), { target: { value: "Unsaved voice" } });
  view.rerender(workspace(false));
  expect(screen.queryByRole("textbox", { name: "Nome do perfil" })).toBeNull();
  view.rerender(workspace(true));
  expect((screen.getByRole("textbox", { name: "Nome do perfil" }) as HTMLInputElement).value).toBe("Unsaved voice");
  view.rerender(workspace(true, "other"));
  expect(screen.queryByRole("textbox", { name: "Nome do perfil" })).toBeNull();
  expect(p.act).not.toHaveBeenCalled();
});

it("exports an explicit original rather than silently exporting a preview", async () => {
  vi.mocked(rpc).mockResolvedValue([]);
  const p = props();
  render(<FxStudio {...p} initialAssetId={asset.id} />);
  fireEvent.change(screen.getByLabelText("Destino do novo WAV"), {
    target: { value: "D:/exports/new.wav" },
  });
  expect((screen.getByRole("button", { name: "Exportar cópia WAV" }) as HTMLButtonElement).disabled).toBe(true);
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "Versão para exportar" }));
  await user.click(await screen.findByRole("option", { name: /Independent WAV.*Fonte/ }));
  fireEvent.click(screen.getByRole("button", { name: "Exportar cópia WAV" }));
  expect(p.act).toHaveBeenCalledWith(
    "result_export",
    { asset_id: asset.id, destination: "D:/exports/new.wav" },
    expect.any(String),
  );
});

it("exports the chosen processed identity and never substitutes a missing selection", async () => {
  vi.mocked(rpc).mockResolvedValue([]);
  const p = props();
  const processed = { ...asset, id: "b".repeat(32), parent_id: asset.id, kind: "processed", name: "Processed full version", path: "C:/audio/processed.wav", selected: 1 };
  const preview = { ...processed, id: "c".repeat(32), kind: "preview", name: "Short preview" };
  const data = { ...p.data, assets: [asset, preview, processed] };
  const view = render(<FxStudio {...p} data={data} initialAssetId={asset.id} />);
  fireEvent.change(screen.getByLabelText("Destino do novo WAV"), { target: { value: "D:/copy.wav" } });
  const button = screen.getByRole("button", { name: "Exportar cópia WAV" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true); // A project preference is not export consent.
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "Versão para exportar" }));
  expect(screen.queryByRole("option", { name: /Short preview/ })).toBeNull();
  await user.click(await screen.findByRole("option", { name: /Processed full version.*Versão processada/ }));
  fireEvent.click(button);
  expect(p.act).toHaveBeenCalledWith("result_export", { asset_id: processed.id, destination: "D:/copy.wav" }, expect.any(String));
  expect(screen.getByText(processed.path)).toBeTruthy();
  view.rerender(<FxStudio {...p} data={{ ...data, assets: [asset] }} initialAssetId={asset.id} />);
  expect(button.disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("não está mais disponível");
  p.act.mockClear(); fireEvent.click(button); expect(p.act).not.toHaveBeenCalled();
  view.rerender(<FxStudio {...p} data={{ ...data, selected_project: "other-project" }} initialAssetId={asset.id} />);
  expect(button.disabled).toBe(true);
});

it("reviews LiteRT setup but requires both license consent and install authorization", async () => {
  const p = props();
  p.act.mockResolvedValue({ supported: true });
  render(<MusicEngines data={p.data} busy={false} act={p.act} />);
  fireEvent.click(
    screen.getByText("Configurar Stable Audio 3 · LiteRT CPU experimental"),
  );
  fireEvent.change(screen.getByLabelText("Nova pasta dedicada fora do Git"), {
    target: { value: "D:/Engines/LiteRT" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Revisar receita LiteRT" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Instalar LiteRT CPU" }),
    ).toBeDefined(),
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Instalar LiteRT CPU",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(p.act).toHaveBeenCalledTimes(1);
  expect(p.act).toHaveBeenCalledWith("stable_setup_plan", {
    destination: "D:/Engines/LiteRT",
    family: "sm-music",
    quality_profile: "compact",
  });
});

it("opens and reopens the recommended recipe without reviewing, authorizing or downloading", async () => {
  vi.mocked(rpc).mockResolvedValue([{ id: "medium-fp32-same-l-v1", name: "Medium FP32 + SAME-L FP32",
    available: false, revision: 1, minimum_available_gib: 12, optional_download_bytes: 7596935760,
    parameters: {}, runtime: {}, checkpoints: [] }]);
  const p = props();
  render(<MusicEngines data={p.data} busy={false} act={p.act} />);
  const choose = await screen.findByRole("button", { name: tr("experience", "prepareRecommended") });
  fireEvent.click(choose);
  const setup = screen.getByText(tr("studio", "setUpStableAudio3ExperimentalLitertCpu")).closest("details")!;
  expect(setup.open).toBe(true);
  setup.open = false;
  fireEvent.click(choose);
  expect(setup.open).toBe(true);
  expect(p.act).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(tr("studio", "newDedicatedFolderOutsideGit")), { target: { value: "D:/Engines/Optional" } });
  fireEvent.click(screen.getByRole("button", { name: tr("studio", "reviewLitertRecipe") }));
  await waitFor(() => expect(p.act).toHaveBeenCalledWith("stable_setup_plan", {
    destination: "D:/Engines/Optional", family: "medium", quality_profile: "fidelity",
  }));
});
