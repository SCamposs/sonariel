# Audio engines expansion (unreleased)

This branch is under development. It does not change the published 0.2 release.
No soundtrack, fictional language, production-specific preset or character data
is included in the app. Private presets are local project data, not shipped defaults.

## Current boundaries

- Music: existing ACE-Step Turbo remains the baseline. SFT and Stable Audio 3
  appear as research candidates, not installed/validated adapters. Stable Audio
  downloads require a separate operator license decision.
- Voice: Chatterbox Multilingual V3, explicit language/text/seed, optional
  authorized reference profiles. No autocorrection or automatic continuation.
- FX: a native executable with ordered chains and layered processing, independent
  of inference/Audacity. Generic WAV input, immutable source, new versions and
  explicit lineage. No private production presets in the repository.

The existing SQLite queue handles voice and FX, with request-key idempotency.
One worker handles one task at a time. Owned Turbo is unloaded before local
processing. An orphaned owned local process blocks new work after a core crash;
the interrupted job is never silently submitted again. Active cancellation is
not exposed. Low-memory/time watchdog termination is a distinct safety failure.

Schema 2 adds `voice_profiles` and `fx_presets`; existing tables/rows remain
unchanged. A copied live schema-1 database was migrated and all original rows
compared exactly. A newer schema is refused rather than downgraded.

## Optional voice setup

Voice Studio offers an explicit installation plan and a separate destination.
The pinned recipe uses Python 3.11.15, torch/torchaudio 2.6.0+cpu, Chatterbox
0.1.7 at a fixed commit, official PerTh 1.1.0 at a fixed commit, and verified
V3 checkpoint files. It never installs upstream dependency metadata, moving
Git dependencies or CUDA. Cached weights are hash-checked and copied, not linked.
Sources are verified against pinned archives before installation/retry.

This headless recipe omits Gradio and the Chinese/Japanese optional
preprocessors. The engine declares 23 languages; CPU paths and pronunciation
are not all validated. Initial executed language paths are Portuguese/Swahili.
Reference conditioning is implemented, but cross-utterance voice identity has
not been validated with an authorized external recording. Do not promise it.

## Voice and FX workflow

1. Select a project. In Voice Studio, install/link V3 or consult its status.
2. Optionally save a project voice profile. Reference recordings require explicit
   authorization; otherwise use the engine's official builtin voice.
3. Ask Codex to call `sonariel_voice_generate` with the exact text, language,
   seed and optional profile. It returns `job_id` immediately.
4. Compare results in the shared player/library, then open a WAV in FX.
5. Add/reorder/bypass effects and adjust supported parameters. No render happens
   during slider movement. Request a preview of at most the first ten seconds
   of source, or a full render explicitly; tails add their configured duration.
6. Save a new preset revision globally or only for this project. Import/export
   JSON explicitly; files are never overwritten. Layered presets can be imported
   and their pitch/formants/timing/modulation/chains adjusted in the GUI.
7. Export a verified WAV copy or hand a version to an identified Audacity project.

Simple chains preserve explicit gain, without automatic loudness normalization.
Layered recipes have an explicit LUFS target and true-peak ceiling. Advanced
transformations are experimental for new material, even when algorithms are
deterministic. Official generator watermarks are never disabled; detectability
after FX is not promised.

## Evidence so far

- Original 42 core tests still pass; new schemas/profiles/queue/migration/export
  checks added. UI tests verify actual recipe values, explicit render triggers,
  private presets and required language/consent (not an aesthetic screenshot test).
- Three private deterministic regression fixtures rendered through the shared
  queue produce WAV hashes identical to their validated originals. Only the
  generic validation script is public; audio, names, texts and fixtures stay local.
- A real Portuguese V3 utterance ran through the core queue: 9.10 s model load,
  18.11 s inference, 6.54 GiB sampled process-tree peak, at least 3.79 GiB free.
- A second independent installation completed using verified existing weights,
  followed by actual voice synthesis. It is not a zero-cache clean-machine test.
- Browser flow verification and Windows packaging are ongoing. Music alternatives,
  live Turbo regression, current Audacity handoff and updater regression are not
  claimed completed by the above voice/FX checks.

Use `scripts/validate-studio.py --help` for opt-in real validation. Supply private
golden fixture JSON externally; no test data is uploaded. Desktop/MCP clients
share state; a protocol smoke test is not proof that this running Codex chat
has loaded newly added tools.
