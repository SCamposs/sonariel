// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StorageWorkspace } from "./storage";
import { rpc, type Snapshot } from "./api";
vi.mock("./api", async () => ({ ...(await vi.importActual("./api")), rpc: vi.fn() }));
beforeAll(() => {
  window.matchMedia ??= () => ({ matches: false, media: "", onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const fixture = { id: "a".repeat(32), project_id: "p", name: "Candidate", path: "C:/fixture.wav", kind: "generated",
  favorite: false, selected: false, managed: true, bytes: 1024, exists: true, trashed: false, state: "available" };
const data = { projects: [{ id: "p", name: "Production" }], selected_project: "p", jobs: [] } as unknown as Snapshot;

it("inventories paths but never discards automatically; cancelling preserves everything", async () => {
  vi.mocked(rpc).mockImplementation(async method => method === "storage_list" ? { items: [fixture] } : {
    token: "b".repeat(64), entries: [{ ...fixture, action: "move_to_trash", blocked: null }], managed_bytes: 1024, reclaimed_bytes: 0 });
  render(<StorageWorkspace data={data} act={vi.fn()} busy={false} />);
  expect(await screen.findByText("C:/fixture.wav")).toBeTruthy();
  expect(rpc).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Candidate" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar descarte (1)" }));
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Manter arquivos" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(vi.mocked(rpc).mock.calls.some(([method]) => method === "storage_discard")).toBe(false);
});

it("prevents selecting protected results and blocks cleanup during generation", async () => {
  vi.mocked(rpc).mockResolvedValue({ items: [{ ...fixture, favorite: true }] });
  render(<StorageWorkspace data={{ ...data, jobs: [{ state: "generating" }] } as Snapshot} act={vi.fn()} busy={false} />);
  const checkbox = await screen.findByRole("checkbox", { name: "Selecionar Candidate" }) as HTMLInputElement;
  expect(checkbox.disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("aguardam a fila");
});

it("only submits discard after preview and explicit confirmation", async () => {
  let removed = false;
  vi.mocked(rpc).mockImplementation(async method => {
    if (method === "storage_list") return { items: removed ? [] : [fixture] };
    if (method === "storage_discard") { removed = true; return { discarded: [fixture.id] }; }
    return { token: "b".repeat(64), entries: [{ ...fixture, action: "move_to_trash", blocked: null }], managed_bytes: 1024, reclaimed_bytes: 0 };
  });
  const action = vi.fn(async () => ({}));
  render(<StorageWorkspace data={data} act={action} busy={false} />);
  fireEvent.click(await screen.findByRole("checkbox", { name: "Selecionar Candidate" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar descarte (1)" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar descarte recuperável" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("storage_discard", { asset_ids: [fixture.id], preview_token: "b".repeat(64), confirmed: true }));
  await waitFor(() => expect(screen.queryByText("Candidate")).toBeNull());
});
