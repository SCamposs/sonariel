# Diagnose the observed symptom

| Symptom | Check and safe next step |
| --- | --- |
| The skill loaded, but no Sonariel tools exist | Agensi and Sonariel are separate connections. Follow [setup](setup.md); verify the installed runtime path and reload the local client. Do not generate a fake result. |
| Server cannot start | Check the local executable exists and belongs to the chosen installation; preserve the actual startup error. Do not download another binary or edit global configuration without consent. |
| Client reports approval required, but its policy cannot ask | Report the client-policy refusal separately from server connectivity. Ask the operator to review permission for the already-requested operation in that client; do not suggest disabling safeguards globally or repeat a mutation whose acceptance is uncertain. |
| Skill or supporting file cannot be read | Report the file-access restriction. Do not claim to have applied unread instructions or verified their workflow. The operator must restore appropriate local read access or the delivery client's file loader; an available MCP schema is not evidence that the skill loaded. |
| Connection works, library looks empty | Check `snapshot.data_home`, project ID and current filters privately. A different `SONARIEL_HOME` is a separate catalog. Do not import production databases to fill it. |
| Model name appears but cannot generate | Inspect `installed`, `compatible`, `blocked_reason` and `audio_input_ready`. Offer plan/linking instructions; do not install or accept terms automatically. SFT is not operational. |
| Waiting for RAM | Keep the same job. Report observed free RAM and the selected adapter's gate. The user can free memory manually or leave the job queued. Do not promise that crossing the gate guarantees completion. |
| Parameters rejected | Read the installed schema and error. Turbo meter uses `"4"` for 4/4; voice uses `language`, not `language_id`. Confirm changes that alter the requested output. Do not retry with a different model/mode. |
| Missing or changed source | Ask for its correct location or an explicit replacement. Preserve the original catalog/evidence; do not silently substitute, overwrite or falsify its hash. |
| Stable style conditioning requested | It has no style-only control. Explain explicit audio2audio content use and permission requirements, or offer the available ACE style workflow; let the user choose. |
| Region rejected | Verify boundaries, actual duration and target role/engine. Stable style is unsupported. Do not silently shorten or reinterpret the input. |
| Timeout or lost job response | Read [uncertain submissions](safety-and-recovery.md#uncertain-submissions); inspect job/queue, preserve exact arguments and request key. |
| Loop tool absent or rejected | Expected on stable v0.4.0. Explain the unavailable feature. Read/export existing WAVs if requested. No bypass. |
| Export collision/partial failure | Inspect per-file outcomes and `manifest_error`. Select a new destination or explicit rename/skip behavior. Verify already-created files before retrying; never overwrite. |
| Audacity pipe missing or project changed | Ask the user to enable/restart the documented module or restore the identified edit project. Do not alter unrelated projects or bypass identity checks. |
| English request receives Portuguese diagnostics | Explain the observed error accurately in the user's language. Do not interpret translated text as a new success code. |

Keep reports narrow: version, tool, sanitized arguments, error and observed state. Raw logs/configuration can expose credentials or private project paths; review them locally before sharing. Do not ask a beginner to post their entire data directory.
