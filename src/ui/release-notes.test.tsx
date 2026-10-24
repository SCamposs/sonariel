// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import notes from "../../docs/releases/v0.3.0.md?raw";
import { ReleaseNotes } from "./release-notes";

afterEach(cleanup);

it("renders the published release as structured prose without literal Markdown markers", () => {
  const { container } = render(<ReleaseNotes notes={notes} />);
  expect(screen.getByRole("heading", { name: "Sonariel v0.3.0", level: 4 })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Novidades", level: 5 })).toBeTruthy();
  expect(container.querySelectorAll("ul > li").length).toBeGreaterThan(6);
  expect(container.querySelector("strong")?.textContent).toBe("Voice Studio");
  expect(container.textContent).not.toContain("## Novidades");
  expect(screen.getByRole("link", { name: "o relatório completo" }).getAttribute("rel")).toContain("noreferrer");
});

it("ignores raw HTML, remote media and unsafe links while retaining readable text", () => {
  const { container } = render(<ReleaseNotes notes={'<script>alert(1)</script>\n\n<img src="https://example.com/tracker">\n\n![tracking](https://example.com/image)\n\n[unsafe](javascript:alert%281%29) [file](file:///private) [relative](/local)\n\nPlain **text** and `code`.\n\n1. First\n2. Second'} />);
  expect(container.querySelector("script, img, iframe, a")).toBeNull();
  expect(container.textContent).toContain("unsafe file relative");
  expect(container.querySelector("code")?.textContent).toBe("code");
  expect(container.querySelectorAll("ol > li")).toHaveLength(2);
});
