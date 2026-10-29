import { tr } from "./i18n";
import { invoke } from "@tauri-apps/api/core";

export async function rpc<T = unknown>(
  method: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if ("__TAURI_INTERNALS__" in window)
    return invoke<T>("rpc", { method, args });
  const response = await fetch("/__sonariel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, args }),
  });
  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.result as T;
}

export type Project = {
  id: string;
  name: string;
  context: string;
  created: number;
  result_count: number;
};
export type Session = {
  id: string;
  project_id: string;
  name: string;
  created: number;
};
export type Asset = {
  tags?: string[];
  id: string;
  project_id: string;
  session_id: string | null;
  job_id: string | null;
  path: string;
  name: string;
  kind: string;
  parent_id: string | null;
  favorite: number;
  selected: number;
  notes: string;
  created: number;
  metadata: {
    duration: number;
    sample_rate: number;
    channels: number;
    waveform: number[];
    peak: number;
    rms: number;
    subtype: string;
    parameters?: Record<string, unknown>;
    music_preset?: { preset_id: string; family_id: string; revision: number; engine_id: string; intent: string; source_asset_id: string | null };
    sha256: string;
    region?: { source_id: string; source_sha256: string; start_frame: number; end_frame: number; sample_rate: number; role: "style" | "source"; engine_id: string };
  };
};
export type Job = {
  id: string;
  project_id: string;
  remote_id: string | null;
  state: string;
  stage: string;
  created: number;
  started: number | null;
  finished: number | null;
  error: string | null;
  params: Record<string, unknown>;
  metrics: {
    peak_rss_gib?: number;
    minimum_available_gib?: number;
    load_seconds?: number;
    inference_seconds?: number;
  };
};
export type Snapshot = {
  capabilities?: { loop_creation?: boolean };
  references?: Asset[];
  library_filters?: { project_id: string | null; filters: Partial<import("./library-workspace").LibraryFilters> };
  ui_preferences?: { locale: "en" | "pt-BR" | null; existing_installation: boolean };
  engines?: EngineInfo[];
  voice_environment?: { python: string; models: string } | null;
  projects: Project[];
  sessions: Session[];
  assets: Asset[];
  jobs: Job[];
  selected_project: string | null;
  events: {
    id: number;
    time: number;
    kind: string;
    message: string;
    job_id: string | null;
  }[];
  environment: {
    root: string;
    python_path: string;
    repo: string;
    model_root: string;
    audacity: string;
    compatible: boolean;
    checks: Record<string, boolean>;
    commit: string;
    versions: { python: string; packages: Record<string, string> };
    models: { name: string; present: boolean; bytes: number }[];
  } | null;
  engine: {
    state: string;
    managed: boolean;
    rss_gib: number;
    load_seconds: number | null;
  };
  telemetry: {
    total_gib: number;
    available_gib: number;
    used_percent: number;
    cpu_percent: number;
    cpu: string;
    platform: string;
    logical_cores: number;
    free_disk_gib: number;
  };
  audacity: { running: boolean; pipe_available: boolean; tested: boolean };
  codex: {
    configured: boolean;
    tested: boolean;
    client?: string;
    last_handshake?: number;
    client_reload_required?: boolean;
  };
  setup: { state: string; stage: string; destination?: string } | null;
  preferences: { idle_minutes: number };
  data_home: string;
  edits: {
    id: string;
    asset_id: string;
    project_path: string;
    created: number;
  }[];
};

export type EngineInfo = {
  id: string;
  name: string;
  category: "music" | "voice" | "fx";
  installed: boolean;
  compatible: boolean;
  experimental: boolean;
  tested?: boolean;
  backend: string;
  license: string;
  modes?: string[];
  audio_input_ready?: boolean;
  quality_profiles?: ("compact" | "fidelity")[];
  fidelity_audio_input_ready?: boolean;
  quality_modes?: Record<string, string[]>;
  audio_input_note?: string | null;
  languages?: Record<string, string>;
  blocked_reason?: string;
};

export function stateLabel(state: string): string {
  const states: Record<string, string> = {
  queued: tr("common", "waiting"),
  loading: tr("common", "loading"),
  submitted: tr("common", "submitting"),
  generating: tr("common", "generating"),
  completed: tr("common", "completed"),
  interrupted: tr("common", "interrupted"),
  cancelled: tr("common", "cancelled"),
  stopped: tr("common", "unloaded"),
  ready: tr("common", "ready"),
  error: tr("common", "failed"),
  running: tr("common", "running"),
  };
  return states[state] ?? state;
}
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function secondsSince(value: number | null) {
  return value ? Math.max(0, Date.now() / 1000 - value) : 0;
}
