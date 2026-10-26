// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import i18n, { detectLocale } from "./index";
import { useLocaleProfile } from "../ui/language-settings";

afterEach(async () => { cleanup(); await i18n.changeLanguage("pt-BR"); });
it.each([
  [["en-US"], "en"], [["pt-BR"], "pt-BR"], [["pt_BR"], "pt-BR"],
  [["de-DE"], "en"], [["pt-PT"], "en"], [["ja-JP", "en-GB"], "en"],
])("detects supported preferences from %j", (languages, expected) => {
  expect(detectLocale(languages as string[])).toBe(expected);
});
it("keeps existing users in Portuguese without a required selection", async () => {
  const { result } = renderHook(() => useLocaleProfile({ locale: null, existing_installation: true }));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.pending).toBe(false);
  expect(i18n.resolvedLanguage).toBe("pt-BR");
});
it("requires selection only for a fresh, unconfirmed profile", async () => {
  const { result } = renderHook(() => useLocaleProfile({ locale: null, existing_installation: false }));
  await waitFor(() => expect(result.current.pending).toBe(true));
  act(() => result.current.confirmed());
  expect(result.current.pending).toBe(false);
});
it("restores a saved language and updates the document language without reopening onboarding", async () => {
  const { result, rerender } = renderHook(({ locale }) => useLocaleProfile({ locale, existing_installation: true }), {
    initialProps: { locale: "en" as "en" | "pt-BR" },
  });
  await waitFor(() => expect(i18n.resolvedLanguage).toBe("en"));
  expect(document.documentElement.lang).toBe("en");
  expect(result.current.pending).toBe(false);
  rerender({ locale: "pt-BR" });
  await waitFor(() => expect(document.documentElement.lang).toBe("pt-BR"));
});
