// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useWorkspaceScroll } from "./use-workspace-scroll";
afterEach(() => cleanup());
it("starts new modules at the top and restores only their own project location", () => {
  function Harness({ module }: { module: string }) {
    const props = useWorkspaceScroll(module);
    return <main {...props}>Workspace</main>;
  }
  const view = render(<Harness module="project:library" />);
  const main = screen.getByRole("main");
  main.scrollTop = 240;
  fireEvent.scroll(main);
  view.rerender(<Harness module="project:voice" />);
  expect(main.scrollTop).toBe(0);
  main.scrollTop = 100;
  fireEvent.scroll(main);
  view.rerender(<Harness module="project:library" />);
  expect(main.scrollTop).toBe(240);
  view.rerender(<Harness module="other-project:library" />);
  expect(main.scrollTop).toBe(0);
});
