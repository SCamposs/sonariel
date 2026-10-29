// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Snapshot } from "./api";
import { AgentHandoff, agentRequest } from "./workflow-guidance";
import { WorkflowPaths } from "./workflow-paths";

afterEach(() => { cleanup(); vi.restoreAllMocks(); Reflect.deleteProperty(navigator, "clipboard"); });
const data = (selected: string | null = "p", ready = false) => ({
  selected_project: selected,
  projects: [{ id: "p", name: "Study one", context: "PRIVATE CONTEXT NOT AUTOMATICALLY COPIED" }, { id: "q", name: "Study two", context: "" }],
  engines: [{ id: "music", category: "music", installed: ready, compatible: ready }],
} as unknown as Snapshot);

it("shows a task next step before navigation and requires a project first", () => {
  const music = vi.fn(), voice = vi.fn(), audio = vi.fn(), createProject = vi.fn();
  render(<WorkflowPaths data={data(null)} {...{ music, voice, audio, createProject }} />);
  fireEvent.click(screen.getByRole("button", { name: "Produzir voz" }));
  expect(screen.getByRole("region", { name: "Próximo passo" })).toBeTruthy();
  expect(voice).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Criar projeto para começar" }));
  expect(createProject).toHaveBeenCalledTimes(1);
  expect(music).not.toHaveBeenCalled(); expect(audio).not.toHaveBeenCalled();
});

it("offers a ready music handoff rather than sending the user back to setup", () => {
  render(<WorkflowPaths data={data("p", true)} music={vi.fn()} voice={vi.fn()} audio={vi.fn()} createProject={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Criar música" }));
  expect(screen.getByRole("button", { name: "Copiar pedido-base para Codex" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Preparar motor musical" })).toBeNull();
});

it("copies only an explicit current-project starter request without generating or sharing context", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<AgentHandoff data={data("q")} kind="voice" />);
  expect(writeText).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Copiar pedido-base para Codex" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  const copied = writeText.mock.calls[0][0];
  expect(copied).toContain("Study two"); expect(copied).toContain("ID: q");
  expect(copied).not.toContain("Study one"); expect(copied).not.toContain("PRIVATE CONTEXT");
  expect(copied).toContain("Não inicie geração");
  expect(await screen.findByRole("status")).toBeTruthy();
});

it("keeps a missing-project handoff empty and reports clipboard failure honestly", async () => {
  expect(agentRequest(data(null), "music")).toBe("");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
  render(<AgentHandoff data={data()} kind="music" />);
  fireEvent.click(screen.getByRole("button", { name: "Copiar pedido-base para Codex" }));
  expect((await screen.findByRole("alert")).textContent).toContain("copie-o manualmente");
});
