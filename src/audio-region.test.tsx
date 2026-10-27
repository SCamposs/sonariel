// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AudioRegion } from "./audio-region";
import i18n from "./i18n";
import type { Asset } from "./api";
vi.mock("./ui/select-control", () => ({ SelectControl: ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[];
}) => <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
vi.mock("./ui/audio-slider", () => ({ AudioSlider: () => null }));
afterEach(() => cleanup());
const asset = { id: "source", name: "Imported", metadata: { duration: 15, sample_rate: 16000, channels: 2 } } as Asset;
it("previews through the existing player callback and confirms without generating", async () => {
  await i18n.changeLanguage("en");
  const act = vi.fn(async (_method: string, _args?: Record<string, unknown>, _message?: string) => undefined), preview = vi.fn();
  render(<AudioRegion assets={[asset]} selectedId={asset.id} onSelect={vi.fn()} onPreview={preview} busy={false} act={act} />);
  fireEvent.click(screen.getByText("Audio regions & reference roles"));
  fireEvent.change(screen.getByLabelText("Region start (s)"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Region end (s)"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Listen to selected region" }));
  expect(preview).toHaveBeenCalledWith(asset, 1, 12);
  fireEvent.click(screen.getByRole("button", { name: "Confirm derived region" }));
  await waitFor(() => expect(act).toHaveBeenCalledTimes(1));
  expect(act.mock.calls[0]).toEqual(["audio_region_create", expect.objectContaining({ start_seconds: 1, end_seconds: 12, role: "source", engine_id: "acestep-v15-turbo" }), expect.any(String)]);
  fireEvent.click(screen.getByRole("button", { name: "Confirm derived region" }));
  expect(act.mock.calls[1][1]).toEqual(act.mock.calls[0][1]);
});
it("rejects style for Stable Audio without silently changing roles", async () => {
  await i18n.changeLanguage("en");
  render(<AudioRegion assets={[asset]} selectedId={asset.id} onSelect={vi.fn()} onPreview={vi.fn()} busy={false} act={vi.fn()} />);
  fireEvent.click(screen.getByText("Audio regions & reference roles"));
  fireEvent.change(screen.getByLabelText("Intended audio role"), { target: { value: "style" } });
  fireEvent.change(screen.getByLabelText("Target music engine"), { target: { value: "stable-audio-3-medium" } });
  expect(screen.getByRole("status").textContent).toContain("no style-reference contract");
  expect((screen.getByRole("button", { name: "Confirm derived region" }) as HTMLButtonElement).disabled).toBe(true);
});
