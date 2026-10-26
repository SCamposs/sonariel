// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BatchExport } from "./batch-export";
import type { Asset } from "./api";
import i18n from "./i18n";

vi.mock("./ui/path-field", () => ({ PathField: ({ label, onChange }: { label: string; onChange: (value: string) => void }) =>
  <label>{label}<input onChange={e => onChange(e.target.value)} /></label> }));
vi.mock("./ui/select-control", () => ({ SelectControl: () => null }));
afterEach(() => cleanup());
it("keeps compare selection separate and exports only explicitly selected results", async () => {
  await i18n.changeLanguage("en");
  const action = vi.fn(async () => ({ manifest: "manifest.json", files: [{ asset_id: "one", file: "001_Original.wav", status: "exported" }] }));
  const selection = vi.fn();
  const assets = [
    { id: "one", name: "Original", path: "C:/audio/one.wav", kind: "imported" },
    { id: "reference", name: "Reference", path: "C:/audio/ref.wav", kind: "reference" },
  ] as Asset[];
  render(<BatchExport assets={assets} selected={["one", "reference"]} onSelection={selection} busy={false} act={action} />);
  fireEvent.change(screen.getByLabelText("Export folder"), { target: { value: "C:/exports" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Save a portable JSON metadata manifest" }));
  fireEvent.click(screen.getByRole("button", { name: "Export selected WAVs" }));
  expect(action).toHaveBeenCalledWith("result_export_batch", expect.objectContaining({ asset_ids: ["one"],
    manifest: true, include_prompts: false, include_references: false }));
  expect((await screen.findByRole("status")).textContent).toContain("Exported and verified");
  fireEvent.click(screen.getByRole("button", { name: "Select project WAVs" }));
  expect(selection).toHaveBeenCalledWith(["one"]);
});
