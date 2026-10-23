---
name: sonariel
description: Manage local music projects, ACE-Step generation jobs and safe Audacity handoffs through Sonariel MCP. Use for Sonariel audio work; creative conversation stays in Codex.
---

# Sonariel workflow

1. Query `sonariel_environment_status` and `sonariel_projects_list`. Read the selected project's saved musical context. Save only context explicitly requested by the user, not the chat transcript.
2. Register existing local audio with `sonariel_reference_register`. `reference_id` controls style. `source_id` provides source content for an explicitly selected `cover` task. Do not silently substitute these modes.
3. Call `sonariel_generate` with a stable request_key, explicit duration (10–120 s), BPM, key_scale, time_signature and seed. CPU requires batch_size=1, Turbo, DiT-only. Planning/LM/Flash Attention remain disabled. A cover's duration must match its source. The installed revision ignores cover strength in text2music, so that mode requires strength 1.
4. The call returns job_id promptly. Use `sonariel_job_get` or `sonariel_queue_list` to follow it. If a call times out, reuse the same request_key; do not create a duplicate job. Report stage and elapsed time, not invented percent or ETA. Waiting on memory is an expected queue state.
5. Inspect valid results with `sonariel_results_list`. Use `sonariel_result_feedback` to persist favorite, selected and notes after user feedback. Audio playback and comparisons are in the desktop app.
6. After the user requests editing, `sonariel_audacity_import` creates a new identified project. Use its edit_id for `sonariel_audacity_export` with bounded fade_in/fade_out seconds. The adapter refuses edits if the current Audacity project has changed. Never expose arbitrary scripting commands.
7. Use `sonariel_engine_stop` to unload an idle managed model. Queue cancellation only works before submission; active inference interruption is unsupported.

The engine and audio stay local. Codex's model runtime is separate. Inspect actual capabilities before promising GPU support. Setup and existing-environment linking are distinct operations; do not reinstall a working environment.
