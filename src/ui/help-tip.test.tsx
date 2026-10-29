// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelpTip, StatusBadge } from "./help-tip";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

it("makes explanatory help available by keyboard and closes with Escape", async () => {
  const user = userEvent.setup();
  render(<HelpTip label="About voice">A profile is not an installed engine.</HelpTip>);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "About voice" }));
  expect((await screen.findByRole("tooltip")).textContent).toContain("A profile is not an installed engine.");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
});

it("opens help by click without turning status into a setup action", async () => {
  const execute = vi.fn();
  const user = userEvent.setup();
  render(<div onClick={execute}><StatusBadge help="Link an environment below." label="Engine status">Not linked</StatusBadge></div>);
  expect(screen.queryByRole("button", { name: "Not linked" })).toBeNull();
  await user.hover(screen.getByText("Not linked"));
  expect((await screen.findByRole("tooltip")).textContent).toContain("Link an environment below.");
  await user.click(screen.getByText("Not linked"));
  expect(execute).not.toHaveBeenCalled();
});

it("adds context directly to an action while preserving its label and single execution", async () => {
  const user = userEvent.setup();
  const execute = vi.fn();
  render(<HelpTip label="Action context" trigger={<button className="outline" onClick={execute}>Prepare connection</button>}>Registers local tools.</HelpTip>);
  const action = screen.getByRole("button", { name: "Prepare connection" });
  expect(screen.queryByRole("button", { name: "Action context" })).toBeNull();
  await user.hover(action);
  expect((await screen.findByRole("tooltip")).textContent).toContain("Registers local tools.");
  await user.click(action);
  expect(execute).toHaveBeenCalledTimes(1);
});
