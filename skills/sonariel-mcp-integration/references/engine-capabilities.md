# Choose an available engine

Use the live `sonariel_engines_list` response and required tool schema before preparing a request. Check `installed`, `compatible`, `tested`, `blocked_reason` and mode-specific readiness. `upstream_modes` describes upstream possibilities, not supported Sonariel operations. Do not infer readiness from the name or a completed download.

| Stable v0.4.0 engine | Tool and usable profile | Available RAM gate |
| --- | --- | --- |
| `acestep-v15-turbo` | `sonariel_generate`: CPU, DiT-only; `text2music` or explicit `cover`; 10–120 s; batch 1 | 12 GiB cold / 4 GiB with managed resident model |
| `stable-audio-3-small-music` | `sonariel_music_generate`: experimental LiteRT CPU; `text2audio` 5–60 s; explicit `audio2audio` 5–120 s only when `audio_input_ready=true` | 5 GiB |
| `stable-audio-3-medium` | Same Stable contract, separate engine choice | 6 GiB |
| `chatterbox-v3` | `sonariel_voice_generate`: exact requested text, explicit supported `language`, seed, optional authorized profile | 7.5 GiB |
| `native-fx` | `sonariel_fx_render`: ordered/layered DSP; no model | 3 GiB |
| `acestep-v15-sft` | Inventory only, blocked pending validation; do not submit | Not operational |

These are admission thresholds, not peak-memory estimates or guarantees. Do not reduce them. The ACE setup recipe additionally requires at least 23 GiB total RAM; historical process usage exceeded 14 GiB. Use current diagnostics for the actual computer. Timings on another machine are not an ETA.

## Music request preparation

For Turbo, collect prompt, seed, duration, BPM, key and meter. `time_signature` is the numerator string: use `"4"` for 4/4, not `"4/4"`; inspect the allowed enum. An instrumental direction belongs in the prompt; do not invent an `instrumental` argument. The adapter fixes the Turbo inference recipe; do not add unsupported `steps`, LM/planning/autofill, Flash Attention or device fields. `batch_size=1` is mandatory. Turbo is the baseline; use an alternative only when the user chooses it.

For Stable Audio, use `engine_id`, prompt, duration, seed, batch 1 and a supported step count (4/8/16; 8 is the previously tested recipe). CFG/APG are fixed at 1. Exact BPM/key are not controllable guarantees. `audio2audio` additionally needs a registered same-project `source_id`, its full duration, encoder/resampler readiness, and an explicit `init_noise_level` in `[0.01,1)`. This value is not a perceptual similarity percentage. Do not silently crop, switch engine or fall back to text generation.

ACE style `reference_id`, ACE cover `source_id` and Stable source `source_id` are different controls. Stable Audio does **not** accept a style-only reference. When a user asks for a similar atmosphere, explain this distinction before suggesting source transformation. Regions inherit an explicit engine and style/source role; preserve that role in later requests.

## Voice request preparation

Use the exact text and the schema's `language` field; `language_id` is an upstream concept, not this MCP argument. Inspect the live language enum. Preserve fictional spelling intentionally supplied by the user; do not assume phonetic/IPA/SSML control or guaranteed pronunciation. Optional `original_text` is separate from the spoken text. Review same-project voice profiles; creating a referenced profile requires authorization to use that recording. No childlike timbre, identity or language should be inferred from a project's theme.

The release declares 23 languages but earlier live evidence is limited to Portuguese/Swahili paths. Cross-utterance identity is not validated. Keep official watermark behavior; do not offer removal. Model validity and the user's aesthetic approval remain separate.

## Setup and licensing boundaries

Plan first with the applicable `setup_plan`, `stable_setup_plan` or `voice_setup_plan`; inspect returned requirements. Install only after authorization. Stable installation/linking also requires this user's explicit Stability Community and Gemma acceptance; it does not register commercial use. Existing compatible installations should use their matching `environment_link` tool instead of a reinstall. ACE linking currently asks for an Audacity executable too; explain that contract rather than inventing a path.

GPU acceleration, SFT generation, Stable inpainting, active-inference cancellation and packaged loop creation are not supplied by this integration. See [v0.4.0 engine evidence and notices](https://github.com/SCamposs/sonariel/blob/v0.4.0/docs/ENGINES.md). No heavy model generation is part of this skill's acceptance demo.
