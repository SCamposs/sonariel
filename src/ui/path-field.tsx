import { systemMessage } from "../i18n/system-message";
import { tr } from "../i18n";
import { useTranslation } from "react-i18next";
import { useId, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Save } from "lucide-react";
import "./path-field.css";

type PathKind = "directory" | "executable" | "audio" | "wav-save" | "preset";
const getFilters = () => ({
  executable: [{ name: tr("files", "windowsExecutable"), extensions: ["exe"] }],
  audio: [{ name: tr("files", "audio"), extensions: ["wav", "flac", "mp3", "ogg"] }],
  "wav-save": [{ name: tr("files", "wavAudio"), extensions: ["wav"] }],
  preset: [{ name: tr("files", "jsonPreset"), extensions: ["json"] }],
});

/** Native selection changes only the field; core validation still owns I/O. */
export function PathField({ label, value, onChange, kind, placeholder, required,
  disabled = false, className = "" }: {
  label: string; value: string; onChange: (value: string) => void;
  kind: PathKind; placeholder?: string; required?: boolean;
  disabled?: boolean; className?: string;
}) {
  useTranslation();
  const id = useId();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const native = "__TAURI_INTERNALS__" in window;
  const pick = async (saving: boolean) => {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setPicking(true);
    setError("");
    try {
      const options = { title: label, defaultPath: value || (saving
        ? (kind === "preset" ? "preset.json" : "audio.wav") : undefined),
        filters: kind === "directory" ? undefined : getFilters()[kind] };
      const selected = saving ? await save(options) : await open({ ...options,
        directory: kind === "directory", multiple: false });
      if (typeof selected === "string") onChange(selected);
    } catch (e) {
      setError(tr("files", "couldNotOpenTheFilePickerValue", { value0: String(e) }));
    } finally {
      inFlight.current = false;
      setPicking(false);
      input.current?.focus();
    }
  };
  return <div className={`path-field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <div className="path-field-control">
      <input id={id} ref={input} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required} disabled={disabled} readOnly={picking}
        aria-describedby={error ? `${id}-error` : undefined} />
      <button type="button" className="outline path-picker"
        disabled={disabled || picking || !native} aria-busy={picking}
        aria-label={`${kind === "wav-save" ? tr("files", "saveAs") : tr("files", "select")}: ${label}`}
        title={native ? label : tr("files", "theNativePickerIsAvailableInTheDesktop")}
        onClick={() => void pick(kind === "wav-save")}>
        <FolderOpen size={17} aria-hidden="true" />
      </button>
      {kind === "preset" && <button type="button" className="outline path-picker"
        disabled={disabled || picking || !native} aria-busy={picking}
        aria-label={`${tr("files", "saveAs")}: ${label}`} title={tr("files", "chooseADestinationForANewJsonPreset")}
        onClick={() => void pick(true)}><Save size={17} aria-hidden="true" /></button>}
    </div>
    {error && <span id={`${id}-error`} className="path-field-error" role="alert">{systemMessage(error)}</span>}
  </div>;
}
