// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { LoopStudio } from "./loop-studio";
import type { Asset } from "./api";

vi.mock("./ui/audio-slider", () => ({ AudioSlider: () => null }));
afterEach(() => cleanup());
it("queues explicit repeated previews and separate final cycles without altering the original", async () => {
  await i18n.changeLanguage("en");
  const action = vi.fn(async () => ({}));
  const source = { id: "original-id", name: "User name", metadata: { duration: 2 } } as Asset;
  render(<LoopStudio source={source} busy={false} act={action} />);
  fireEvent.click(screen.getByRole("button", { name: "Preview repeated seam" }));
  expect(action).toHaveBeenLastCalledWith("fx_loop_render", expect.objectContaining({ asset_id: source.id,
    start_seconds: 0, end_seconds: 2, crossfade_ms: 100, preview: true, repetitions: 3 }), expect.any(String));
  fireEvent.click(screen.getByRole("button", { name: "Create loop version" }));
  expect(action).toHaveBeenLastCalledWith("fx_loop_render", expect.objectContaining({ preview: false }), expect.any(String));
  const first = action.mock.calls[0] as unknown[];
  const second = action.mock.calls[1] as unknown[];
  expect((first[1] as Record<string, unknown>).request_key).not.toBe((second[1] as Record<string, unknown>).request_key);
  expect(source.name).toBe("User name");
  fireEvent.change(screen.getByLabelText("Region end (s)"), { target: { value: "9" } });
  expect((screen.getByRole("button", { name: "Create loop version" }) as HTMLButtonElement).disabled).toBe(true);
});
