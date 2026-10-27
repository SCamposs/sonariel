# Work from intent to a verified version

Read installed schemas before using these names; tool arguments are objects with strict fields. Responses arrive as MCP text content containing JSON on success. Check `isError` as well as JSON-RPC errors: successful transport is not successful work. Keep IDs from responses; names and list positions are not IDs.

## A first result without model downloads

For the sample request in [README](../README.md), use these steps with user-selected paths. The user has authorized import, one preview and both exports; no additional generation or artistic selection is implied.

1. Query environment, engines, capabilities and projects. `native-fx` must be installed/compatible. Choose/create **Audio Workshop** and **First pass**; save the returned `project_id`/`session_id`. Query existing records before retrying create operations: project/session creation has no request-key contract.
2. Call `sonariel_result_import` with `project_id`, `session_id`, the local WAV `path` and a descriptive `name`. Do not invent generation parameters for imported material. It catalogs the existing file; it is not a managed backup of that external source. Keep the source where it is.
3. Confirm the returned asset `id`, project/session and `metadata` (duration, channels, sample rate, SHA-256). Use `sonariel_asset_tags_update` on that explicit ID with `add:["demo"]`; query `sonariel_project_tags_list` or filtered `sonariel_results_list` to verify the change.
4. Submit `sonariel_fx_render` with `asset_id`, a recorded new `request_key`, `preview:true`, and this complete recipe:

```json
{
  "schema_version": 1,
  "name": "Quiet preview",
  "output_channels": 2,
  "tail_seconds": 0,
  "bypass": false,
  "chain": [{"wet": 1, "effect": {"type": "gain", "db": -3}}]
}
```

5. Record the returned `job_id`. Poll `sonariel_job_get` at a modest interval (for example 2–5 seconds for short FX; back off for long jobs) until completed or attention is needed. Inspect its `results` and errors. A preview uses up to ten source seconds plus configured tails; label it as a preview even for a shorter source. Do not silently render a full version afterward.
6. Query `sonariel_results_list` for the project and inspect the derived asset's parent, parameters and measured metadata. The desktop's Library/versions player and A/B comparison support listening; the MCP does not provide a playback-control tool. Technical checks cannot choose the preferred sound for the user.
7. Call `sonariel_result_export_batch` with only the original and preview IDs, an existing local `directory`, `collisions:"rename"`, `manifest:true`, `include_prompts:false`, `include_references:false`. Inspect each `files` status and `manifest_error`. Successful WAVs and a failed optional manifest are separate outcomes. Report actual filenames and hashes. If file access is available, independently compare copied bytes with the reported hashes. Do not claim independent verification when only the core's verification was observed.

## Music, voice and presets

Read [engine capabilities](engine-capabilities.md). Resolve the user's project/session, authorized inputs and complete supported parameters before enqueueing. Record exact arguments and a unique request key for a new requested operation. Submit through `sonariel_generate`, `sonariel_music_generate` or `sonariel_voice_generate` as appropriate; use the returned job, never an assumed result path. Monitor/verify as above. If the user asks only to enqueue, stop after returning the job ID.

Music presets are separate from FX presets and voice profiles. `sonariel_music_preset_save` captures a compatible music result or explicit configuration; revisions and duplicates preserve earlier settings. `sonariel_music_presets_list`/`sonariel_music_preset_favorite` manage them without generating.

Before requested preset generation, call `sonariel_music_preset_prepare` with the exact desired parameters and intent: `reuse` only reviews; `repeat` preserves the saved configuration; `variation` requires a different seed. Present the returned actual settings. Use `sonariel_music_preset_generate` only with the matching `review_token`, same overrides, `confirmed:true`, generation intent and request key after explicit confirmation. A settings review is not generation permission; seed reuse is not a bit-identical audio guarantee.

## Reference, source and region decisions

Use `sonariel_reference_register` for an authorized reference recording and `sonariel_result_import` for an existing production result. Both preserve external files and can take a same-project session. Inspect registered assets before re-registering after uncertainty; these calls do not expose request keys.

For a requested excerpt, use `sonariel_audio_region_create` with `asset_id`, stable `request_key`, `start_seconds`, `end_seconds`, name, explicit `engine_id` and `role:"style"` or `"source"`. Source excerpts require 10–120 s for Turbo or 5–120 s for Stable; style requirements differ and come from the schema/validator. The returned derived asset ID is the input for the later operation, not the full original. Inspect actual frame/duration metadata. Same-key replay requires identical parameters; a verified identical region can be reused. This does not run inference, make a musical loop or authorize a subsequent generation.

## Library, feedback and export

- Combine `results_list` filters with an explicit project: `query`, `favorite`, `session_id`, `kind` and `tags`. Tags use AND semantics. An empty filtered list is not missing data: inspect/reset filters only as requested. `library_filters_save` persists filters and affects the desktop. In a snapshot the values are nested at `library_filters.filters`, beside `library_filters.project_id`.
- Record `result_feedback` only from the user's feedback. It requires `favorite`, `selected` and `notes` together; read current values and preserve unrelated fields. Do not turn "technically valid" into a favorite or project selection. A preview cannot be selected as the preferred final result; obtain a request for a full render first.
- Use `result_export` for one WAV and a new absolute `destination` in an existing local folder. Use batch export for 1–200 explicit IDs. Naming allows `{index}`, `{name}`, `{id}`, `{model}`, `{seed}`; collision modes are `rename` or `skip`. Never retry an uncertain export blindly: inspect destination/status first, because exports do not have request keys and rename could create duplicates.
- Portable manifests omit private paths/runtime context; prompts and reference inclusion remain explicit opt-ins. A chosen folder that syncs to a cloud is still a disclosure decision—do not choose it for the user. MP3 encoding is not an export tool in this release.
- For FX presets, preserve the requested validated recipe, project scope and version. A similarly named chain is not an equivalent replacement. FX preset export also needs an unused local destination.

## Optional Audacity and discard

Use `sonariel_audacity_probe` only when the user wants the Audacity bridge. After an edit request, `sonariel_audacity_import` opens a new identified project. Keep its `edit_id`; `sonariel_audacity_export` verifies that identity before optional bounded fades and a separate output. Missing pipe/module or changed active project means stop and ask the user to restore the correct state.

For requested cleanup, inspect `sonariel_storage_list`, obtain `sonariel_storage_preview` for explicit IDs, show the preview and use the user's explicit authorization before `sonariel_storage_discard`. The preview token binds the selected content; re-preview if changed. Restore with `sonariel_storage_restore` after request. Distributed v0.4.0 only hides external records. Newer development schemas add opt-in `include_external_files`, 30-day trash and separate `sonariel_storage_purge_preview` / `sonariel_storage_purge`. Discover those tools before use; never claim an older runtime supports them. Permanent deletion and external-file changes require explicit user authorization. Protected/dependent assets remain blocked. Do not substitute shell deletion when a runtime lacks the requested capability.
