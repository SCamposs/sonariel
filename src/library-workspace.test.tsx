// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { filterLibrary, loopSeams, LibraryTools, emptyFilters, useLibraryFilters } from "./library-workspace";
import { rpc, type Asset, type Snapshot } from "./api";
vi.mock("./api", () => ({ rpc: vi.fn(async () => ({})) }));
vi.mock("./ui/select-control", () => ({ SelectControl: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const assets = [
  { id: "one", project_id: "project", name: "Soft field", notes: "", kind: "imported", favorite: 1, session_id: "session", tags: ["warm", "quiet"] },
  { id: "two", project_id: "project", name: "Soft field", notes: "", kind: "processed", favorite: 0, session_id: "other", tags: ["warm"] },
] as Asset[];
it("locates real repeated-cycle joins without adding WAV markers", () => {
  const preview = { metadata: { duration: 47.4, parameters: { recipe: { operation: "loop", repetitions: 3 } } } } as unknown as Asset;
  expect(loopSeams(preview)[0]).toBeCloseTo(15.8);
  expect(loopSeams(preview)[1]).toBeCloseTo(31.6);
  expect(loopSeams({ ...preview, metadata: { ...preview.metadata, parameters: { recipe: { operation: "loop", repetitions: 1 } } } })).toEqual([]);
  expect(loopSeams(undefined)).toEqual([]);
});
it("combines every filter without changing candidates or A/B state", () => {
  const filters = { ...emptyFilters, query: "soft", favorite: true, session_id: "session", kind: "imported", tags: ["warm", "quiet"] };
  expect(filterLibrary(assets, filters).map(a => a.id)).toEqual(["one"]);
  expect(filterLibrary(assets, { ...filters, query: "missing" })).toEqual([]);
  expect(assets).toHaveLength(2);
});
it("applies tags only to explicitly selected project candidates", async () => {
  await i18n.changeLanguage("en");
  const act = vi.fn(async () => ({}));
  render(<LibraryTools data={{ selected_project: "project", sessions: [] } as unknown as Snapshot} assets={assets}
    filters={emptyFilters} update={vi.fn()} selected={["one"]} onSelection={vi.fn()} busy={false} act={act} saveError="" />);
  fireEvent.change(screen.getByLabelText("Tags for 1 selected candidates"), { target: { value: "Quiet, Field" } });
  fireEvent.click(screen.getByRole("button", { name: "Add tags" }));
  await waitFor(() => expect(act).toHaveBeenCalledWith("asset_tags_update", { project_id: "project", asset_ids: ["one"], add: ["Quiet", "Field"] }, expect.any(String)));
  expect(rpc).not.toHaveBeenCalled();
});
it("restores filters only from their own project and serializes saves", async () => {
  let resolveFirst: (() => void) | undefined;
  vi.mocked(rpc).mockImplementationOnce(() => new Promise<void>(resolve => { resolveFirst = resolve; }));
  function Harness({ project }: { project: string }) {
    const { filters, update } = useLibraryFilters({ selected_project: project, library_filters: { project_id: project, filters: { query: project } } } as Snapshot);
    return <><output>{filters.query}</output><button onClick={() => update({ ...filters, query: filters.query + "x" })}>Change</button></>;
  }
  const view = render(<Harness project="one" />);
  expect(screen.getByRole("status").textContent).toBe("one");
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
  resolveFirst!();
  await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
  expect(vi.mocked(rpc).mock.calls[1][1]).toEqual({ project_id: "one", filters: expect.objectContaining({ query: "onexx" }) });
  view.rerender(<Harness project="two" />);
  expect(screen.getByRole("status").textContent).toBe("two");
});
