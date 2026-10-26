import { tr } from "./i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import packageInfo from "../package.json";

export const APP_VERSION = packageInfo.version;
export const UPDATE_INTERVAL = 60 * 60 * 1000;
export const UPDATE_PREFERENCE = "sonariel.updates.automatic.v1";
export type AvailableUpdate = { version: string; notes?: string };
export type UpdateProgress = {
  phase: "downloading" | "installing";
  downloaded?: number;
  total?: number;
};
export type UpdateTransport = {
  supported: boolean;
  check: () => Promise<AvailableUpdate | null>;
  install: (
    version: string,
    onProgress: (value: UpdateProgress) => void,
  ) => Promise<void>;
};
const desktop: UpdateTransport = {
  supported: "__TAURI_INTERNALS__" in window,
  check: () => invoke("updates_check"),
  install: (version, onProgress) => {
    const channel = new Channel<UpdateProgress>();
    channel.onmessage = onProgress;
    return invoke("updates_install", { version, onProgress: channel });
  },
};

function savedPreference() {
  try {
    return localStorage.getItem(UPDATE_PREFERENCE) !== "off";
  } catch {
    return true;
  }
}

export function useUpdates(transport = desktop) {
  const [automatic, setAutomatic] = useState(savedPreference);
  const [available, setAvailable] = useState<AvailableUpdate | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress>();
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState<Date>();
  const inFlight = useRef(false);
  const installation = useRef(false);
  const mounted = useRef(false);

  const check = useCallback(async () => {
    if (!transport.supported || inFlight.current || installation.current)
      return;
    inFlight.current = true;
    setChecking(true);
    setError("");
    try {
      const result = await transport.check();
      if (mounted.current) {
        setAvailable(result);
        setCheckedAt(new Date());
      }
    } catch {
      if (mounted.current)
        setError(
          tr("updates", "couldNotCheckReleasesCheckYourConnectionAnd"),
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  }, [transport]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!automatic || !transport.supported) return;
    void check();
    const timer = setInterval(() => void check(), UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, [automatic, check, transport.supported]);

  function changeAutomatic(value: boolean) {
    setAutomatic(value);
    try {
      localStorage.setItem(UPDATE_PREFERENCE, value ? "on" : "off");
    } catch {
      /* Session preference still works. */
    }
  }
  async function install() {
    if (!available || installation.current || inFlight.current) return;
    installation.current = true;
    setInstalling(true);
    setError("");
    setProgress({ phase: "downloading" });
    try {
      await transport.install(available.version, (value) => {
        if (mounted.current) setProgress(value);
      });
    } catch (cause) {
      if (mounted.current) setError(String(cause));
    } finally {
      installation.current = false;
      if (mounted.current) {
        setInstalling(false);
        setProgress(undefined);
      }
    }
  }
  return {
    automatic,
    changeAutomatic,
    available,
    checking,
    installing,
    progress,
    error,
    checkedAt,
    check,
    install,
    supported: transport.supported,
  };
}
