# Codex integration

Use the app's integration action after installation. It backs up `config.toml`, preserves other servers and refuses a conflicting Sonariel entry. The registered command is the distributed `sonariel-core.exe` with argument `mcp`. Credentials are not read or modified.

Equivalent example, using a user-selected installation path:

```toml
[mcp_servers.sonariel]
command = 'D:\Applications\Sonariel\runtime\sonariel-core.exe'
args = ['mcp']
startup_timeout_sec = 30
```

Reload the Codex client to discover newly registered tools. A server protocol test is recorded separately from registration. A test client handshake does not imply that a preexisting Codex conversation has loaded the server.

The bundled skill is installed at `~/.agents/skills/sonariel/SKILL.md`. It describes music/voice/FX contracts, CPU memory limits, request-key recovery and reference/source semantics. Registration can update the exact known v0.2 skill with a timestamped backup. Custom/unknown existing skill content is preserved for review. Reload Codex after installing this expansion to discover its new tools; the existing installed server is not silently replaced by development builds.

Recommended sequence: environment_status → projects_list → project_select → reference_register (if needed) → generate → job_get → result_feedback → audacity_import/export after an editing request. Tools are prefixed `sonariel_`. Complete schemas are returned by tools/list; unsupported fields/modes are rejected.

Storage operations: `storage_list` inventories registered files; `storage_preview` produces a content-bound token; `storage_discard` requires that token and explicit confirmation of selected IDs. `storage_restore` recovers an item. Never infer discard approval from a missing favorite flag. Version 0.5.0 adds 30-day retention, opt-in external-file moves and separate `storage_purge_preview`/`storage_purge` tools for explicitly authorized permanent deletion. Distributed v0.4.0 still only hides external records. Discover the actual tool schemas before using new capabilities. See [STORAGE.md](STORAGE.md). Reload the MCP connection after upgrading.

The UI has no competing creative chat or primary prompt editor. Prompt, model, seed, input roles and parameters remain visible in result details. Only explicitly saved musical context is persisted. Sonariel audio inference is local; the Codex model is a separate service.

## Stable Audio source input (0.3.1)

`music_generate` retains text2audio by default (5–60s). Source-driven variation is
explicit: register a WAV in the same project, prepare/link the LiteRT audio encoder
and resampler, and pass `mode="audio2audio"`, `source_id`, exact source duration
(5–120s), and optional `init_noise_level` (default 0.25, range 0.01 <= sigma < 1).
The source may be a registered reference or result. This is source-content
conditioning, not a `reference_audio` style control. Smaller sigma changes the
initial latent mix; it does not certify perceptual similarity. Sigma 1 is rejected
because it ignores the source. Never silently substitute text generation.

Use batch 1 and 8 steps as the tested CPU recipe. The source hash is checked at
enqueue, before the worker and after rendering; the result stores its source as
parent. Source duration is not silently truncated to fit a requested duration.
WAV mono/stereo at other sample rates is resampled with pinned soxr HQ inside the
isolated worker; the original is unchanged. New setups include the encoder and
resampler; older text-only links keep working but must explicitly prepare/relink
before audio input is available. No inference-active cancellation is added.

Official contracts consulted:

- https://developers.openai.com/codex/mcp
- https://developers.openai.com/codex/skills
- https://manual.audacityteam.org/man/scripting.html
- https://v2.tauri.app/

## Phase 2 contracts (distributed in v0.4.0)

Phase 2 introduced the contracts below. Version 0.5.0 exposes 60 packaged tools in total; authorized source loop development exposes 61. Reload the MCP client after updating its runtime. Full parameter schemas remain available through `tools/list`.

- `ui_preferences_save(locale)`: EN (`en`) or Brazilian Portuguese (`pt-BR`); no engine/job changes.
- **Authorized source development only:** `fx_loop_render(asset_id, request_key, start_seconds, end_seconds, crossfade_ms, preview, repetitions)`. Packaged distributions do not expose/permit loop creation. Preview repeats 2–4 complete edited cycles; final output is one cycle. It has no approved musical-continuity guarantee. Never change request keys after an uncertain submission.
- `result_export_batch(asset_ids, directory, naming, collisions, manifest, include_prompts, include_references)`: copies 1–200 selected WAVs. Naming fields: `{index}`, `{name}`, `{id}`, `{model}`, `{seed}`. Collision modes `rename` and `skip` never overwrite. Each item reports success/failure. Optional portable JSON omits paths, runtime context and credentials; prompts and references require separate explicit inclusion. Unknown metadata remains absent/null. Inspect `manifest_error` separately from successful WAV copies.
- `music_presets_list`, `music_preset_save`, `music_preset_favorite`: capture compatible music-result parameters or an explicit engine configuration; revisions/duplicates preserve earlier settings. DSP and voice retain separate presets/profiles.
- `music_preset_prepare`: `reuse` reviews settings only; `repeat` preserves saved parameters; `variation` requires an explicitly different seed. Engine-incompatible settings and foreign-project conditioning fail closed.
- `music_preset_generate`: requires `repeat`/`variation`, the matching review token, `confirmed=true`, and a request key. A genuinely new request needs a new key; recovery of an accepted request uses its existing key/job. Results retain preset ID/revision/intent lineage. Reusing a seed does not guarantee identical audio across model revisions or environments.

The desktop exposes preset capture, favorite, revision/duplicate and review. Creative parameter/prompt changes and generation remain directed through Codex/MCP. No generic shell or arbitrary Audacity execution tool was added. See [Phase 2 validation](PHASE2.md) before using these contracts.

## Phase 2.5 contracts (distributed in v0.4.0)

The packaged v0.5.0 core exposes 60 tools, with loop creation excluded. Discover actual installed availability first. Phase 2.5 added these four tools:

- `audio_region_create`: registered asset ID, request key, sample-rounded start/end seconds, name, engine ID and explicit `style`/`source` role. Confirmed excerpts become derived WAV assets; identical selections reuse a verified asset. Never reuse a key with changed parameters. Refer to the returned asset ID in later generation/preset requests, preserving its intended role/engine. No model loads or generation occurs when confirming a region.
- `asset_tags_update`: atomic add/remove of normalized organizational tags on up to 200 explicit same-project assets. Tags do not alter audio/generation identity. No production defaults are shipped.
- `project_tags_list`: active tags/counts only for the specified project.
- `library_filters_save`: combined query/favorite/session/type/all-tags-match filters, persisted per project. The selected project's stored filters are available in `snapshot`.

Existing contracts extend without changing their defaults: `results_list` accepts those combined filters; `reference_register` and `result_import` optionally accept a same-project session ID. `snapshot` includes references and library preferences. Region role/engine checks apply to generation/preset reuse; an original unrestricted asset retains its existing explicit-use behavior.

Loop creation is disabled in packaged distributions and omitted from MCP tools/list; the core also rejects direct calls. `snapshot.capabilities.loop_creation` is authoritative. Existing derived files/recipes remain readable/exportable. Source-only experimentation requires explicit `SONARIEL_DEVELOPMENT_LOOPS=1` and an isolated profile outside the stable tree; packaged runtimes cannot opt in. Reference excerpts and ordinary native FX are independent of this restriction.

In that authorized development context only, `fx_loop_render` optionally accepts `beat_grid={anchor_seconds,bpm,beats_per_bar,bars}`. Use verified timing, not a model's requested BPM or an onset estimate. For anchor A, cycle P and overlap L, select A−L through A+P. This preserves the period without certifying harmonic/phrase continuity. [Musical loop acceptance](LOOP_ACCEPTANCE.md).

## Public music recommendations (v0.6.0)

Discover `sonariel_music_recommendations_list`, then explicitly save a project preset with `sonariel_music_recommendation_save` using a chosen prompt, seed and duration. This does not install or generate. Review/confirmation and request-key rules remain unchanged. Fidelity supports text2audio only. See [recipe guide](MUSIC_RECOMMENDATIONS.md). Reload the client MCP connection to discover newly shipped tools.
