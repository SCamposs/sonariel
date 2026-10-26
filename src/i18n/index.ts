import enFiles from "./locales/en/files.json";
import ptFiles from "./locales/pt-BR/files.json";
import enWindow from "./locales/en/window.json";
import ptWindow from "./locales/pt-BR/window.json";
import enGuide from "./locales/en/guide.json";
import ptGuide from "./locales/pt-BR/guide.json";
import enUpdates from "./locales/en/updates.json";
import ptUpdates from "./locales/pt-BR/updates.json";
import enCommon from "./locales/en/common.json";
import ptCommon from "./locales/pt-BR/common.json";
import enStorage from "./locales/en/storage.json";
import ptStorage from "./locales/pt-BR/storage.json";
import enStudio from "./locales/en/studio.json";
import ptStudio from "./locales/pt-BR/studio.json";
import enWorkspace from "./locales/en/workspace.json";
import ptWorkspace from "./locales/pt-BR/workspace.json";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enSettings from "./locales/en/settings.json";
import ptSettings from "./locales/pt-BR/settings.json";
import enSystem from "./locales/en/system.json";
import ptSystem from "./locales/pt-BR/system.json";
import enProduction from "./locales/en/production.json";
import ptProduction from "./locales/pt-BR/production.json";

export type AppLocale = "en" | "pt-BR";
export const supportedLocales: AppLocale[] = ["en", "pt-BR"];
export function detectLocale(languages: readonly string[]): AppLocale {
  for (const language of languages) {
    const normalized = language.toLowerCase().replaceAll("_", "-");
    if (normalized === "pt-br") return "pt-BR";
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
  }
  return "en";
}

// Bundled resources only. Changing UI language never requests translations online.
void i18n.use(initReactI18next).init({
  resources: {
    en: { workspace: enWorkspace, studio: enStudio, storage: enStorage, common: enCommon,
      updates: enUpdates, guide: enGuide, window: enWindow, files: enFiles, settings: enSettings, system: enSystem, production: enProduction },
    "pt-BR": { workspace: ptWorkspace, studio: ptStudio, storage: ptStorage, common: ptCommon,
      updates: ptUpdates, guide: ptGuide, window: ptWindow, files: ptFiles, settings: ptSettings, system: ptSystem, production: ptProduction },
  },
  lng: "pt-BR", // Preserve the legacy UI until the profile is inspected.
  fallbackLng: "en",
  supportedLngs: supportedLocales,
  defaultNS: "settings",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  initAsync: false,
});

i18n.on("languageChanged", (language) => {
  if (typeof document !== "undefined") document.documentElement.lang = language;
});
if (typeof document !== "undefined") document.documentElement.lang = i18n.language;
export default i18n;
export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(i18n.resolvedLanguage, {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
}
export function formatDate(value: number | Date) {
  return new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "short", timeStyle: "short",
  }).format(value instanceof Date ? value : new Date(value * 1000));
}
export function languageName(code: string) {
  return new Intl.DisplayNames([i18n.resolvedLanguage ?? "en"], { type: "language" }).of(code) ?? code;
}

export function tr(namespace: string, key: string, values: Record<string, unknown> = {}): string {
  return i18n.t(key, { ns: namespace, ...values });
}
