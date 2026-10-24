# Architecture

## One state, two clients

The Tauri/React desktop and MCP stdio bridge use the same lightweight core process. A per-user OS file lock prevents duplicate cores. A random local port and bearer token protect its loopback-only RPC channel. The registry and token live in the user's data directory. No service listens on `0.0.0.0`.

SQLite stores projects, sessions, references, jobs, results, lineage, favorites, selection, notes, edit registrations and operation events. A single worker claims FIFO tasks. request_key prevents duplicate submissions. A remote task ID is persisted before polling and resumed by querying after recovery; uncertain sends are marked interrupted instead of being silently repeated.

## Boundaries

- `src/`: React desktop workspace, locally bundled fonts, persistent player and read-only generation details.
- `src-tauri/`: narrow Tauri IPC bridge to the local core. Release builds ship a Python runtime via PyInstaller resources.
- `core/sonariel/store.py`: SQLite schema and settings.
- `service.py`: closed RPC tool contracts, validation, task queue and workflow.
- `engine.py`: ACE-Step API adapter and owned process lifecycle.
- `studio.py`: additive voice/music/FX RPC contracts, profiles, presets and immutable exports.
- `local_engine.py`: registry of bounded local adapters, owned subprocess watchdog and sampled RAM telemetry.
- `voice_setup.py`, `stable_setup.py`: isolated engine-specific installers; `recipes/*_worker.py` run only inside those environments.
- `native/fx/`: pinned Rust/C++ deterministic DSP, separate from all generative runtimes.
- `environment.py`, `setup.py`, `recipes/`: read-only linking, hardware diagnostics, pinned installation and verified cache reuse.
- `audacity.py`: private allowlisted scripting operations with new-project and track identity checks.
- `__main__.py`: local authenticated server, client and MCP JSON-RPC stdio transport.

The core never imports torch. Heavy inference runs in the selected engine Python process only when a job is ready and memory checks pass. Process ownership includes creation time to avoid killing a reused PID. External engines are not adopted or terminated.

Schema 2 adds voice_profiles/fx_presets without rewriting legacy tables. Local jobs persist `_engine`, exact parameters and parent hashes, then register WAV + receipt atomically on success. Local children exit after each job. An interrupted local job is never automatically regenerated; a still-owned child prevents concurrent work after a core restart. Simple FX retains explicit gain, layered processing uses its explicit loudness target; no AI is loaded by DSP.

Closing the desktop leaves the lightweight core available for MCP and already accepted jobs. An idle timer unloads the owned model; queued tasks survive client restarts. Cancel only affects jobs not yet sent to ACE-Step. There is no active-inference cancellation promise.

The stdio transport carries one UTF-8 JSON-RPC object per line, supports initialization, notifications, ping, tool discovery and tool calls. Generation tools return immediately with a persistent job_id.
