# Recommended music starting recipe

The public recipe `medium-fp32-same-l-v1` (revision 1) is recommended from the
maintainer's local listening evaluation, recorded in [issue #10](https://github.com/SCamposs/sonariel/issues/10).
It is not a universal ranking or a controlled attribution of quality to FP32.
No private prompt, audio, source path, production name or musical seed is bundled.

## How to use it

In Projects, choose **Create music** after selecting a project. The recommendation
appears with its preparation requirements. It is also available in Environment's
Stable Audio preparation. **Review recommended setup** explicitly selects Medium
and fidelity in the preparation form, without reviewing/downloading/installing
anything automatically. Existing license acceptance and download authorization
remain separate. Compact remains the lighter default; Turbo remains the baseline.

When linked, **Use this preset with Codex** copies a request for the current
project. It never sends a message. Inspect the request under its details before
copying. The request contains project name/ID and recipe ID, not saved production
context or file paths. If clipboard access fails, copy that visible text manually.

The agent discovers `sonariel_music_recommendations_list` and combines the recipe
with an explicitly chosen original prompt, seed and duration. Then
`sonariel_music_recommendation_save` creates a named project preset. It works
without model installation and does not generate anything. Use the established
`music_preset_prepare` and explicitly confirmed `music_preset_generate` workflow
only after reviewing actual values. Do not repeatedly submit an uncertain request.

## Exact recipe and limits

| Component | Setting |
| --- | --- |
| Engine / mode | `stable-audio-3-medium`, `text2audio` only, 5–60 seconds |
| Quality | `fidelity`: Medium DiT FP32 + SAME-L decoder FP32 + T5Gemma FP16 |
| Sampling | Eight steps, CFG 1, APG 1, batch 1, six CPU threads |
| Decoder | Trim 12, maximum rung 128 |
| Output | Original stereo WAV, float32, 44,100 Hz |
| Additional models | 7,596,935,760 bytes, separate optional download, verified reuse |
| Memory | 12 GiB available for admission; unchanged watchdog limits |

The code/model revisions and pinned checkpoint hashes are returned by discovery
and shown under recipe details. Saved presets retain an `origin_recommendation`
snapshot in profile settings; no database migration is needed. Revisions and
duplicates retain this origin, while their actual parameters remain independently
reviewable. **Origin is provenance, not a claim that later edits still match the
recipe.** Jobs/results and portable export metadata carry the preset origin via
the existing lineage path; workers still verify the actual checkpoint bytes and
write their own receipts. Existing presets without a public origin remain usable.

The process peak of approximately 5.75 GiB observed in a prior 30-second local
audition is not a requirement estimate for other durations or machines. Do not
lower admission limits or infer universal noise/quality improvements from it.

Audio-to-audio experiments using SAME-L source encoding were external production
experiments. This release does **not** integrate that encoder. It rejects fidelity
audio input and does not offer a transformation-strength control for this recipe.
Compact's separate audio-input mode remains unchanged; it is not the recommended
FP32 recipe. No automatic engine/profile fallback occurs if fidelity is unavailable.

Other model families require their own controlled comparisons of compatible
checkpoints/codecs, precision, sampler, conditioning and human listening. Copying
this recipe's values is not evidence that another family improves.
