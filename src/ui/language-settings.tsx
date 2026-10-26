import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Languages, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n, { detectLocale, type AppLocale } from "../i18n";
import { rpc } from "../api";
import { SelectControl } from "./select-control";
import "./workflow-guide.css";

export type UiPreferences = { locale: AppLocale | null; existing_installation: boolean };
export function useLocaleProfile(preferences: UiPreferences | undefined) {
  const initialized = useRef(false);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!preferences) return;
    const selected = preferences.locale ?? (preferences.existing_installation
      ? "pt-BR" : detectLocale(navigator.languages ?? [navigator.language]));
    void i18n.changeLanguage(selected);
    if (!initialized.current) {
      initialized.current = true;
      setPending(!preferences.locale && !preferences.existing_installation);
      setReady(true);
    }
  }, [preferences?.locale, preferences?.existing_installation]);
  return { pending, ready, confirmed: () => setPending(false) };
}

export function LanguageSettings({ required, onConfirmed, existing }: {
  required: boolean; onConfirmed: () => void; existing: boolean;
}) {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const select = useRef<HTMLDivElement>(null);
  async function save(locale: AppLocale) {
    void i18n.changeLanguage(locale);
    setSaving(true); setError(false); setSaved(false);
    try {
      await rpc("ui_preferences_save", { locale });
      setSaved(true);
      if (required) onConfirmed();
    } catch { setError(true); }
    finally { setSaving(false); }
  }
  return <>
    <button ref={trigger} className="text-button" onClick={() => setOpen(true)}>
      <Languages size={15} /> {t("title")}
    </button>
    <Dialog.Root open={required || open} onOpenChange={(next) => { if (!required && !saving) setOpen(next); }}>
      <Dialog.Portal><Dialog.Backdrop className="ui-panel-backdrop" />
        <Dialog.Popup className="workflow-guide language-settings" finalFocus={trigger} initialFocus={select}>
          <header className="guide-header"><Dialog.Title>{t(required ? "choose" : "title")}</Dialog.Title>
            {!required && <Dialog.Close className="icon-button" aria-label={t("close")} disabled={saving}><X size={18} /></Dialog.Close>}
          </header>
          <div className="language-settings-body" ref={select} tabIndex={-1}>
            <Dialog.Description>{t(required ? "firstUse" : existing ? "existing" : "saved")}</Dialog.Description>
            <label>{t("language")}
              <SelectControl label={t("language")} value={i18n.resolvedLanguage ?? "en"} disabled={saving}
                options={[{ value: "en", label: "English" }, { value: "pt-BR", label: "Português (Brasil)" }]}
                onChange={(value) => { if (required) void i18n.changeLanguage(value); else void save(value as AppLocale); }} />
            </label>
            {error && <p role="alert" className="message error">{t("saveFailed")}</p>}
            {saved && !required && <p role="status">{t("saved")}</p>}
            {saving && <p role="status">{t("saving")}</p>}
          </div>
          {required && <footer className="guide-footer"><button className="primary" disabled={saving}
            onClick={() => void save((i18n.resolvedLanguage ?? "en") as AppLocale)}>{t("continue")}</button></footer>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
