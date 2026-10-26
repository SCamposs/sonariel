import { afterEach, expect, it } from "vitest";
import i18n from "./index";
import { identifySystemMessage, systemMessage } from "./system-message";

afterEach(async () => { await i18n.changeLanguage("pt-BR"); });
it("localizes known core failures while preserving their stable presentation identity", async () => {
  const before = identifySystemMessage("Error: Arquivo original mudou desde o registro; registre uma nova versão");
  await i18n.changeLanguage("en");
  expect(systemMessage("Error: Arquivo original mudou desde o registro; registre uma nova versão"))
    .toBe("The original file changed since registration; register a new version");
  expect(identifySystemMessage("Error: Arquivo original mudou desde o registro; registre uma nova versão")).toEqual(before);
});
it("translates parameterized stages without changing numeric readings or paths", async () => {
  await i18n.changeLanguage("en");
  expect(systemMessage("Aguardando memória: 7.5 / 12 GiB livres")).toBe("Waiting for memory: 7.5 / 12 GiB available");
  expect(systemMessage("Verificar modelo: checkpoints/model.safetensors"))
    .toBe("Verify model: checkpoints/model.safetensors");
});
it("retranslates an already displayed notification after switching language", async () => {
  await i18n.changeLanguage("en");
  const notification = systemMessage("Projeto criado.");
  expect(notification).toBe("Project created.");
  await i18n.changeLanguage("pt-BR");
  expect(systemMessage(notification)).toBe("Projeto criado.");
});
it("keeps unknown diagnostics verbatim with a localized recovery hint", async () => {
  await i18n.changeLanguage("en");
  const detail = "Allocation failed: E42 at C:/audio/session.wav";
  expect(systemMessage(detail)).toContain(detail);
  expect(systemMessage(detail)).toContain("Review the operation and diagnostics before retrying.");
  expect(systemMessage(null)).toBe("");
});
