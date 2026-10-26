// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MusicPresets } from "./music-presets";
import { rpc, type Snapshot } from "./api";
import i18n from "./i18n";
vi.mock("./api", () => ({ rpc: vi.fn() }));
vi.mock("./ui/select-control", () => ({ SelectControl: () => null }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("consults and reviews a preset without dispatching generation", async () => {
  await i18n.changeLanguage("en");
  const preset = { id: "preset-1", name: "Original settings", description: "User description",
    engine_id: "acestep-v15-turbo", revision: 1, family_id: "preset-1", parent_id: null, favorite: 0,
    params: { prompt: "User prompt stays as written", seed: 0 } };
  vi.mocked(rpc).mockResolvedValue([preset]);
  const action = vi.fn(async (_method: string, _args?: Record<string, unknown>) => ({ parameters: preset.params }));
  const data = { selected_project: "project-1", assets: [], engines: [] } as unknown as Snapshot;
  render(<MusicPresets data={data} busy={false} act={action} />);
  fireEvent.click(screen.getByText("Music presets"));
  fireEvent.click(await screen.findByRole("button", { name: "Original settings · Revision 1" }));
  expect(screen.getByText(/User prompt stays as written/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Review settings without generating" }));
  expect(action).toHaveBeenCalledWith("music_preset_prepare", { preset_id: "preset-1", project_id: "project-1", intent: "reuse" });
  expect(await screen.findByRole("status")).toBeTruthy();
  expect(action.mock.calls.every(([method]) => method !== "generate")).toBe(true);
});
