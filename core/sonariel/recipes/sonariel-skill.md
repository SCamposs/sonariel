---
name: sonariel
description: Manage local music and voice generation, non-destructive native FX, projects and safe Audacity handoffs through Sonariel MCP. Creative conversation stays in Codex.
---

# Sonariel workflow

1. Query `sonariel_engines_list` and `sonariel_projects_list`. Read the selected project's saved context. Save only context explicitly requested by the user, not the chat transcript. Installed, tested locally and artistically approved are separate states. Turbo remains the default music engine; alternatives require an explicit choice.
2. Register existing local audio with `sonariel_reference_register`. `reference_id` controls style. `source_id` provides source content for an explicitly selected `cover` task. Do not silently substitute these modes.
3. Call `sonariel_generate` with a stable request_key, explicit duration (10–120 s), BPM, key_scale, time_signature and seed. CPU requires batch_size=1, Turbo, DiT-only. Planning/LM/Flash Attention remain disabled. A cover's duration must match its source. The installed revision ignores cover strength in text2music, so that mode requires strength 1.
4. The call returns job_id promptly. Use `sonariel_job_get` or `sonariel_queue_list` to follow it. If a call times out, reuse the same request_key; do not create a duplicate job. Report stage and elapsed time, not invented percent or ETA. Waiting on memory is an expected queue state.
5. Inspect valid results with `sonariel_results_list`. Use `sonariel_result_feedback` to persist favorite, selected and notes after user feedback. Audio playback and comparisons are in the desktop app.
6. After the user requests editing, `sonariel_audacity_import` creates a new identified project. Use its edit_id for `sonariel_audacity_export` with bounded fade_in/fade_out seconds. The adapter refuses edits if the current Audacity project has changed. Never expose arbitrary scripting commands.
7. Use `sonariel_engine_stop` to unload an idle managed model. Queue cancellation only works before submission; active inference interruption is unsupported.

The engine and audio stay local. Codex's model runtime is separate. Inspect actual capabilities before promising GPU support. Setup and existing-environment linking are distinct operations; do not reinstall a working environment.

## Voice

Use `sonariel_voice_profiles_list` and optional `sonariel_voice_profile_save`; voice references require explicit authorization. Call `sonariel_voice_generate` with exact requested text, explicit supported language and seed, optional profile and supported expressivity parameters. It returns a shared-queue job_id. Do not autocorrect invented spelling, append content, or fix a universal language. Model-inherent normalization/pronunciation is not guaranteed by tokenizer acceptance. Identity across utterances is not proven. Preserve the official watermark.

## Native FX

Use `sonariel_fx_presets_list` then `sonariel_fx_render` with a validated recipe and stable request_key. FX accepts any registered WAV, does not load TTS/PyTorch and preserves the source. `preview=true` renders at most ten seconds of source plus configured tails; it is not a final candidate. Persist user choices with `sonariel_result_feedback`, inspect lineage and parameters with job_get/results_list, and copy a final WAV with `sonariel_result_export` (new destination only). Presets may be global or private to a project. Do not publish project data as generic defaults. Do not replace a validated chain with a similarly named approximation.

## Alternative music / setup

`sonariel_music_generate` handles configured Stable Audio 3 LiteRT text2audio explicitly; it is not the Turbo contract. Supply engine_id, prompt, seed and duration (5–60 seconds), batch_size=1, steps 4/8/16 (8 tested). CFG/APG remain 1. Do not promise exact BPM/key or silently route cover/reference requests through text2audio. SFT is listed as pending validation, not a working adapter.

Voice and LiteRT have independent setup_plan/install and environment_link tools. Inspect the plan first and obtain authorization before installation. Stable Audio requires explicit user acceptance of both Stability Community and Gemma terms before download/link; never infer acceptance or commercial registration. Do not override memory gates, kill unrelated processes or load multiple heavy engines. Existing assets remain usable while generation waits for RAM.

## Production tools (discover availability first)

Inspect tools/list: the installed stable server may not expose these source-build contracts yet. Never route an unsupported tool to an unrelated operation.

Loop creation is not available in packaged distributions. Discover capabilities in `snapshot` and tools/list; do not attempt `sonariel_fx_loop_render` when absent. Existing loop audio/metadata remain readable/exportable. Only explicitly authorized source development on a separate profile can enable this experiment; packaged runtimes reject it even if the development environment variable is present. Never silently substitute ordinary FX or reference excerpts for loop creation.

`sonariel_result_export_batch` copies selected WAV IDs to an existing user-selected folder, with configurable naming, rename/skip collision handling, per-file errors and optional portable manifest. Prompts and references require separate explicit authorization; omit them by default. Never include database/runtime/credential context, infer absent model metadata or overwrite originals. Export batching does not authorize generation batching.

Music presets are separate from DSP presets. Use `sonariel_music_presets_list`, `sonariel_music_preset_save` and `sonariel_music_preset_favorite`. Save creates immutable revisions/explicit duplicates with engine-compatible parameters and registered source/reference IDs. `sonariel_music_preset_prepare` reviews actual settings: reuse never queues, repeat preserves settings, variation requires another seed. Only an explicitly authorized `sonariel_music_preset_generate` with matching review_token, confirmed=true and stable request_key queues inference. Never promise bit-identical sound across environments/checkpoints. Creative prompt editing remains in Codex. Preserve user project privacy; do not publish private presets as generic defaults.

## Region and library contracts (discover availability first)

`sonariel_audio_region_create` confirms a sample-exact derived WAV from registered audio with start/end seconds, name, request_key and an explicit engine_id plus role=style/source. It does not generate. Later use must retain that role/engine; Stable Audio style is unsupported. Source duration checks use the excerpt, not its original. Reuse the same key after uncertainty; identical selections can reuse a verified derived asset. Preserve source hashes, lineage and reference protections. Rights remain the user's responsibility. Do not silently convert a style request into cover/audio2audio.

`sonariel_asset_tags_update` adds/removes organizational tags on explicit project-local asset IDs, up to 200 at once. `sonariel_project_tags_list` lists that project's active tags. `sonariel_results_list` combines query/favorite/session_id/kind/tags (all selected tags must match); `sonariel_library_filters_save` stores those filters per project. Tags are mutable organizational metadata, not generation identity or narrative requirements. Import/reference registration optionally accepts an existing session_id from the same project.

Loop integrity is not musical acceptance. The optional `beat_grid` on `sonariel_fx_loop_render` uses verified user-supplied BPM, meter, bars and audible anchor to compensate the overlap's shortening of the cycle. It neither detects nor repairs rhythm, harmony or phrasing. Do not infer true BPM from generation parameters, approve by numerical similarity, or silently time-stretch. Preserve rejected listening rounds and require the user's explicit listening acceptance. Join positions in the desktop player are navigation markers only, never embedded sounds.
