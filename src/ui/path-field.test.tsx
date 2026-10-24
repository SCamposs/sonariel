// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { PathField } from "./path-field";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));
beforeEach(() => { Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); Reflect.deleteProperty(window, "__TAURI_INTERNALS__"); });

it("selects a single folder without submitting a form", async () => {
  vi.mocked(open).mockResolvedValue("C:/My Models");
  const change = vi.fn(), submit = vi.fn();
  render(<form onSubmit={submit}><PathField label="Modelos" value="C:/Old" onChange={change} kind="directory" /></form>);
  fireEvent.click(screen.getByRole("button", { name: "Selecionar: Modelos" }));
  await waitFor(() => expect(change).toHaveBeenCalledWith("C:/My Models"));
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ directory: true, multiple: false, defaultPath: "C:/Old" }));
  expect(submit).not.toHaveBeenCalled();
});

it.each(["executable", "audio", "wav-save", "preset"] as const)("uses the matching filter for %s", async (kind) => {
  vi.mocked(open).mockResolvedValue(null); vi.mocked(save).mockResolvedValue(null);
  render(<PathField label="Caminho" value="" onChange={vi.fn()} kind={kind} />);
  fireEvent.click(screen.getByRole("button", { name: `${kind === "wav-save" ? "Salvar como" : "Selecionar"}: Caminho` }));
  const picker = kind === "wav-save" ? save : open;
  const extensions = kind === "executable" ? ["exe"] : kind === "audio" ? ["wav", "flac", "mp3", "ogg"] : kind === "preset" ? ["json"] : ["wav"];
  await waitFor(() => expect(picker).toHaveBeenCalledWith(expect.objectContaining({ filters: [{ name: expect.any(String), extensions }] })));
});

it("preserves the value on cancel and restores keyboard focus", async () => {
  vi.mocked(open).mockResolvedValue(null);
  const change = vi.fn();
  render(<PathField label="Fonte" value="C:/Original.wav" onChange={change} kind="audio" />);
  const button = screen.getByRole("button", { name: "Selecionar: Fonte" }) as HTMLButtonElement;
  fireEvent.click(button);
  await waitFor(() => expect(button.disabled).toBe(false));
  expect(change).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByLabelText("Fonte"));
  expect((screen.getByLabelText("Fonte") as HTMLInputElement).value).toBe("C:/Original.wav");
});

it("offers an independent save dialog for presets and retains manual typing", async () => {
  vi.mocked(save).mockResolvedValue("C:/New.json");
  const change = vi.fn();
  render(<PathField label="Preset" value="" onChange={change} kind="preset" />);
  fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "C:/Typed.json" } });
  expect(change).toHaveBeenCalledWith("C:/Typed.json");
  fireEvent.click(screen.getByRole("button", { name: "Salvar como: Preset" }));
  await waitFor(() => expect(change).toHaveBeenCalledWith("C:/New.json"));
  expect(open).not.toHaveBeenCalled();
});

it("shows picker errors without changing the path and allows retry", async () => {
  vi.mocked(open).mockRejectedValue(new Error("Dialog failed"));
  const change = vi.fn();
  render(<PathField label="Fonte" value="C:/Old.wav" onChange={change} kind="audio" />);
  fireEvent.click(screen.getByRole("button", { name: "Selecionar: Fonte" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Dialog failed");
  expect(change).not.toHaveBeenCalled();
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
});

it("does not pretend to offer a native picker in the browser preview", () => {
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  const change = vi.fn();
  render(<PathField label="Pasta" value="" onChange={change} kind="directory" />);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Pasta"), { target: { value: "C:/Typed" } });
  expect(change).toHaveBeenCalledWith("C:/Typed");
});
