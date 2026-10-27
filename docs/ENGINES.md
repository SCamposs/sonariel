# Engine capabilities and requirements

Version 0.5.0 adds an optional Medium `fidelity` profile (DiT FP32 + SAME-L FP32), separately downloaded and verified. It supports text-to-audio, records the selected profile in results/presets and requires 12 GiB available RAM to start. The compact profile remains default. See [implementation and validation boundaries](STORAGE_AND_QUALITY.md). The compact workflows below remain available.

[Documentation index](README.md) · [Quick start](QUICK_START.md)

This is the application profile shipped in **v0.5.0**, not a list of everything the upstream models can do. The adapters use Windows x64 CPU execution, batch size 1, and one shared task at a time. GPU/ROCm/CUDA acceleration is not implemented in this profile. Models are not loaded when the UI or MCP starts.

## Implemented workflows

| Engine | Application capabilities | Status and constraints |
| --- | --- | --- |
| ACE-Step 1.5 Turbo | `generate`: text-to-music and explicit source-guided `cover`; `reference_id` for style and `source_id` for source content | Baseline CPU/DiT-only, no additional LM/planning/autofill or Flash Attention. Explicit BPM/key/meter/seed; 10–120 s in the contract. Cover duration must match the full registered source. |
| Stable Audio 3 Small-Music / Medium | `music_generate`: `text2audio` (5–60 s) and explicit `audio2audio` (5–120 s) | Experimental LiteRT CPU with pinned quantized components. Source mode needs the verified SAME-S encoder/resampler and exact full-source duration. Batch 1, 8 steps is the tested recipe; exact BPM/key are not guaranteed. No inpainting. |
| Stable Audio 3 Medium optional FP32 / SAME-L | `quality_profile="fidelity"`, text-to-audio only; 7.60 GB extra pinned weights | Experimental CPU; 12 GiB available to start, 2.5 GiB system floor and 14.5 GiB child RSS ceiling. Compact remains default; source audio rejected. No promise of better artistic output. |
| Chatterbox Multilingual V3 | `voice_generate`: exact text/language/seed, expressivity controls, optional saved voice profiles and authorized reference conditioning | Experimental CPU recipe. 23 declared languages; Portuguese/Swahili paths have documented live testing, not all languages. Optional Chinese/Japanese preprocessors are omitted. Cross-utterance identity/reference consistency remains unvalidated. No automatic continuation or guaranteed phoneme/IPA/SSML controls. |
| Native DSP | `fx_render`: ordered/layered chains, explicit short previews, full WAV processing, versioned presets, verified export | Independent of generative models and Audacity. Gain, fades, filters, EQ, reverb, delay, chorus and layered transformations. Source preservation does not imply every processing setting preserves an upstream watermark's detectability. |

**ACE-Step SFT is pending, not installed/operational through the validated adapter.** A visible inventory entry is not proof of a working engine.

## RAM: admission is not a guarantee

| Adapter | Available physical RAM to start | Additional notes |
| --- | --- | --- |
| ACE-Step Turbo | 12 GiB cold; 4 GiB when the managed model is already resident | Setup recipe also requires ≥23 GiB total RAM and ≥16 GiB free disk. Local process RAM has exceeded 14 GiB and a run reached only ~0.55 GiB available system RAM. These are pressure observations, not recommended operating headroom. |
| Stable Audio Small-Music | 5 GiB | Independent process-tree watchdog; CPU LiteRT worker exits after its job. |
| Stable Audio Medium | 6 GiB | Same isolated lifecycle; slower/higher-capacity does not guarantee a better artistic result. |
| Chatterbox V3 | 7.5 GiB | Separate CPU environment and process-tree watchdog. |
| Native DSP | 3 GiB | No AI weights; processing can still consume memory for longer WAVs. |

The numbers are enforced starting thresholds from the current recipes/adapters, not estimates of peak usage, general model minimums, or guarantees against paging/allocation errors. Other applications, source conditioning and duration matter. Observed timings and memory samples in [VALIDATION.md](VALIDATION.md) and [EXPANSION.md](EXPANSION.md) are machine-specific, not performance promises.

## References are not interchangeable

- ACE-Step `reference_id` is style conditioning. A `cover` request uses a separate `source_id` as source content. Do not silently change the task type.
- Stable Audio `audio2audio` uses the actual source content, not just a style reference. `init_noise_level` changes the initial latent perturbation; it is not a guaranteed percentage of similarity. The contract accepts `0.01 <= sigma < 1`; 1 is rejected because it ignores the source. [Source-audio setup and integrity](STABLE_AUDIO_INPUT.md).
- Voice reference profiles require explicit authorization to use the recording. A profile does not establish ownership or guarantee stable identity across utterances.

Tasks persist model/parameters/source relationships as supported by their adapter. An interrupted or uncertain job is not silently resubmitted. Only tasks still waiting and not yet sent can be cancelled; active-inference cancellation is not supported.

## Licenses and output rights

Sonariel's [own license](../LICENSE) and the [third-party notices](../THIRD_PARTY_NOTICES.md) cover different things. Its permission to use the app in paid creative work is not a blanket commercial license for models, input recordings, or generated audio.

- ACE-Step's code is MIT; inspect the pinned model/component cards and their terms as well.
- Stable Audio setup requires operator acceptance of **Stability Community** and **Gemma** terms. This does not register commercial use or transfer the maintainer's local-test acceptance. Powered by Stability AI. Review the terms shipped with the chosen engine before using it in a commercial workflow.
- Chatterbox V3 and its dependencies have their own notices. Official PerTh watermark behavior is retained; no universal absence of watermarks, anonymity, exclusivity, or ownership guarantee is promised.
- Native DSP libraries have separate licenses retained in distribution notices. Processing a recording does not clear third-party rights in it.

Setup recipes pin dependency/archive/model revisions and check hashes. The validated versions are not necessarily the newest upstream versions. Do not upgrade an existing engine with upstream sync/batch scripts and assume the profile stays compatible. [Setup details](SETUP.md).

## Evidence, not inference from a model name

The [validation record](VALIDATION.md) is organized by release. The [expansion report](EXPANSION.md) includes historical v0.3.0 limits; v0.3.1 added Stable source audio and v0.3.2 changed the Turbo starting threshold. Read those dates before treating an old limit as current. Other agent clients, all voice languages, consistent reference-based voice identity, and zero-cache setup on another machine are not established by the existing tests.
