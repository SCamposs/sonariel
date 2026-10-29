// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RecommendedMusic } from "./recommended-music";
import { rpc, type Snapshot } from "./api";
import i18n from "./i18n";
vi.mock("./api", () => ({ rpc: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); Reflect.deleteProperty(navigator, "clipboard"); });
const recipe = { id: "medium-fp32-same-l-v1", name: "Medium FP32 + SAME-L FP32", revision: 1,
  available: false, minimum_available_gib: 12, optional_download_bytes: 7596935760, parameters: { steps: 8 }, runtime: {}, checkpoints: [] };
const data = { projects: [{ id: "p", name: "Generic study", context: "PRIVATE NOT TO COPY" }], selected_project: "p", engines: [] } as unknown as Snapshot;

it("offers explicit optional preparation without choosing a new engine or downloading", async () => {
  await i18n.changeLanguage("en");
  vi.mocked(rpc).mockResolvedValue([recipe]);
  const prepare = vi.fn();
  render(<RecommendedMusic data={data} prepare={prepare} />);
  expect(await screen.findByText("Medium FP32 + SAME-L FP32")).toBeTruthy();
  expect(screen.getByText(/12 GiB/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Use this preset with Codex" })).toBeNull();
  expect(prepare).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Review recommended setup" }));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(vi.mocked(rpc).mock.calls.map(([method]) => method)).toEqual(["music_recommendations_list"]);
});

it("copies only the explicit current-project request and resets feedback on project change", async () => {
  await i18n.changeLanguage("en");
  vi.mocked(rpc).mockResolvedValue([{ ...recipe, available: true }]);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const view = render(<RecommendedMusic data={data} prepare={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Use this preset with Codex" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  const request = writeText.mock.calls[0][0] as string;
  expect(request).toContain("ID p"); expect(request).toContain(recipe.id);
  expect(request).not.toContain("PRIVATE"); expect(request).toContain("explicit confirmation");
  await screen.findByRole("status");
  view.rerender(<RecommendedMusic data={{ ...data, selected_project: null }} prepare={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Use this preset with Codex" })).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
});

it("reports lookup errors and supports retry without performing setup", async () => {
  await i18n.changeLanguage("en");
  vi.mocked(rpc).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce([recipe]);
  render(<RecommendedMusic data={data} prepare={vi.fn()} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry recipe lookup" }));
  expect(await screen.findByText(recipe.name)).toBeTruthy();
});
