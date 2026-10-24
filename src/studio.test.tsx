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
  fireEvent.click(screen.getByRole("button", { name: "Salvar nova revisão" }));
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

it("exports an explicit original rather than silently exporting a preview", async () => {
  vi.mocked(rpc).mockResolvedValue([]);
  const p = props();
  render(<FxStudio {...p} initialAssetId={asset.id} />);
  fireEvent.change(screen.getByLabelText("Destino do novo WAV"), {
    target: { value: "D:/exports/new.wav" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Exportar WAV" }));
  expect(p.act).toHaveBeenCalledWith(
    "result_export",
    { asset_id: asset.id, destination: "D:/exports/new.wav" },
    expect.any(String),
  );
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
  });
});
