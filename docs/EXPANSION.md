# Audio engines expansion (0.3.0)

The historical 0.3.0 evidence below describes text-only Stable Audio integration.
Version 0.3.1 adds explicit source audio; see [STABLE_AUDIO_INPUT.md](STABLE_AUDIO_INPUT.md)
for the new setup, queue/MCP contract and separate live validation.

The owner authorized direct integration into main without a pull request and then
publication of the signed 0.3.0 release. The beta validation below predates release
promotion; publishing does not install the update or change production data.
No soundtrack, fictional language, production-specific preset or character data
is included in the app. Private presets are local project data, not shipped defaults.

## Current boundaries

- Music: existing ACE-Step Turbo remains the baseline. Stable Audio 3 Small-Music
  and Medium have experimental CPU LiteRT adapters and isolated setup recipes.
  SFT remains pending isolation/inference validation, not a working adapter.
  Stable Audio downloads/linking require explicit Stability Community and Gemma
  acceptance by each operator; developer local-test acceptance is not bundled.
- Voice: Chatterbox Multilingual V3, explicit language/text/seed, optional
  authorized reference profiles. No autocorrection or automatic continuation.
- FX: a native executable with ordered chains and layered processing, independent
  of inference/Audacity. Generic WAV input, immutable source, new versions and
  explicit lineage. No private production presets in the repository.

The existing SQLite queue handles music, voice and FX, with request-key idempotency.
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
   JSON explicitly; files are never overwritten. Create/import layered presets
   and adjust their pitch/formants/timing/modulation/chains in the GUI.
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
- Two controlled original 30-second Stable Audio renders completed using pinned
  official quantized components: Small-Music load 1.73 s, inference 11.53 s,
  sampled peak 1.96 GiB; Medium load 4.26 s, inference 33.82 s, peak 2.02 GiB.
  Both 44.1 kHz stereo float WAVs are finite/non-silent with no over-full-scale
  samples. These are technical results, not artistic approval or benchmarks.
- Independent LiteRT setup was executed for both families, reusing hash-verified
  weights (not a zero-cache clean-machine test). A subsequent 10-second task
  through the actual shared-queue adapter completed: load 1.82 s, inference
  6.41 s, process total 10.70 s, sampled peak 1.94 GiB and minimum free 6.46 GiB.
- Browser real FX flow (adjust -> explicit preview -> queued render -> player)
  passed. Native Rust workspace tests cover all three crates. Live Turbo/SFT
  inference needs the unchanged 16 GiB free RAM gate; it is not established by
  these voice/FX/LiteRT tests. Current Audacity/updater checks are separate.

## Optional experimental LiteRT setup

Setup & diagnostics shows all music engines and a separate LiteRT plan/install
flow. It uses Python 3.11.15, LiteRT 2.2.0 and hash-locked dependencies, never
PyTorch/CUDA or upstream installation scripts. Code/archive, tokenizer and model
revisions are pinned. Python source hashes normalize only CRLF to LF so a Windows
Git checkout and the official archive verify equally; binary hashes are exact.
Only selected DiT + shared T5Gemma/decoder weights are installed. Each job loads
text, DiT and decoder sequentially and exits; status uses actual sampler steps.

Use `music_generate` explicitly for Stable Audio, not the legacy Turbo `generate`
contract. Currently text2audio only, 5–60 seconds, batch one, 4/8/16 steps (8
tested), CFG/APG 1, original float32 export. Do not promise exact BPM/key or
audio2audio/inpaint just because upstream supports them. SFT is visibly pending.
The official Community/Gemma license texts and NOTICE remain with the engine.
Attribution: Powered by Stability AI. Acceptance does not register commercial
use; review the actual terms for the intended use. No weights are redistributed.

Use `scripts/validate-studio.py --help` for opt-in real validation. Supply private
golden fixture JSON externally; no test data is uploaded. Desktop/MCP clients
share state; a protocol smoke test is not proof that this running Codex chat
has loaded newly added tools.

## Final review evidence (2026-10-23)

### Real execution

- New independent V3 environment installed, linked and synthesized successfully;
  the two earlier measured utterances and their original receipts are retained.
  No repeated synthesis was needed for this final review.
- Both LiteRT families installed independently with pinned CPU dependencies and
  verified cache copies. Both 30-second isolated generations completed; a short
  Small-Music job also completed through the shared adapter. Medium's exact
  upstream inference path is measured, but a second Medium queue inference was
  deliberately not repeated. Musical quality/approval is still the user's choice.
- All three external deterministic DSP fixtures rendered through the queue again
  with byte-identical golden WAV hashes. Independent 30-second music DSP/export
  preserved the original; native processing took 0.27 seconds in that run.
- Packaged 0.3.0-beta.1 MCP initialized with 43 closed-schema tools, using the same
  SQLite core as the preview desktop. A native FX request, completion, lineage and
  verified export passed over actual stdio RPC. This is not a claim that this
  preexisting Codex conversation reloaded its installed server/tools.
- Real Windows Tauri preview launched with isolated data/runtime. Selecting a
  source, adding gain, explicitly rendering a ten-second source preview plus a
  two-second tail, and playback to its 12-second endpoint passed. The preview job
  completed in 0.30 seconds. Original and processed versions remain separate.
- A/B library comparison displayed both existing 30-second WAVs and their measured
  waveforms/RMS. The details panel opened with close-button focus; Escape closed
  it and restored focus to its original Details button. At 1000x700 the body
  width stayed 1000, the titlebar measured 32px, and main bottom/player top both
  measured 612px with workspace scrolling available. The original larger Windows
  preview was also exercised; browser layout evidence is distinguished from native.
- The custom titlebar maximized/restored using its real Windows button and the
  double-click drag area. The owner then confirmed the requested manual
  drag/minimize/close/reopen checks worked normally. This owner validation is
  distinct from automated tests and the browser's disabled native controls.
- The existing Turbo environment linked successfully by read-only diagnosis in the
  isolated preview, without starting inference. Existing V3 runtime/checkpoint
  hashes were rechecked without synthesis. The stable database was read in SQLite
  read-only mode and remained at its original schema 1.
- A live database backup migrated to schema 2 with original row contents preserved;
  restart/queue recovery and immutable source/export hashes are separately checked.

### Automated validation

- Python: 60 tests, including legacy contracts, migration, idempotency, uncertain
  local-job recovery, consent, source integrity, preset/export, protected updater
  lifecycle and unchanged 16 GiB Turbo gate.
- Frontend: 21 tests, including native-titlebar commands/failures, FX values/bypass/explicit render, project-private
  presets, explicit language, export choice, both LiteRT setup confirmations,
  tutorial focus/lifecycle and optional updater behavior. Typecheck/build pass.
- Native DSP workspace: 25 tests across the three crates. Tauri cargo test builds
  successfully but currently contains zero Rust unit tests; it is a compilation
  check, not additional UI/updater integration coverage.
- Pattern-based publication hygiene reports no findings. This is not an exhaustive
  security audit. No audio, weights, databases, private presets or local acceptance
  records are included in Git or the installer.

### Explicitly not revalidated / pending

- Additional live Turbo and initial SFT inference were waived for this delivery
  by the owner. The measured Turbo history is retained in VALIDATION.md, not
  represented as a fresh run. The 16 GiB gate is unchanged; SFT remains visibly
  pending and cannot be selected as an operational adapter.
- Audacity opened at the configured installation but mod-script-pipe was unavailable
  in the current session; the import stopped before modifying a project. Modules,
  preferences and trust dialogs were not changed automatically. Historical real
  Audacity handoff evidence and automated wrong-project protections remain valid,
  but a new live handoff is not claimed. Native FX/WAV export does not require it.
- Reference-based voice identity, all 23 language paths, and zero-cache setup on
  another machine remain unproven. Current CPU recipes and tested languages are
  described above; no automatic voice continuation is implemented.
- This review does not reinstall over stable or exercise another signed self-update.
  The existing signed-update acceptance evidence is historical; updater UI/lifecycle
  regression checks pass. The earlier beta installer was unsigned; 0.3.0 release
  artifacts use the existing updater signing key. No new live self-update is claimed.
- Custom titlebar uses Tauri window commands with explicit capabilities. Its HTML
  maximize button does not implement the Windows native Snap hover menu. Browser
  preview controls are disabled; native behavior is checked separately.
- The review launcher was exercised for initial preparation, same-build reuse and
  refusal of the stable data profile with process launching stubbed. Actual native
  launches are recorded separately above; the filesystem test is not a UI test.

### Delivery

Release promotion reran all 60 Python, 21 frontend and 25 DSP workspace tests,
typecheck and the signed Windows build. The newly packaged MCP reports 0.3.0
and 43 tools in a separate empty profile, without generation. The updater public
key/application identifier match v0.2.0. Independent public-key verification of
the installer signature and signed version passed; a modified byte was rejected.
These checks do not install the update on the maintainer's machine.

Build with `scripts/build.ps1 -SignUpdates` for release or without signing for review. The installer is generated under
`src-tauri/target/release/bundle/nsis/` (ignored by Git). Use
`scripts/run-preview.ps1` for a separate executable/profile; it refuses the stable
data profile and will not overwrite a running preview. No installer is launched
automatically. Engine weights, environments, licenses and acceptance records stay
outside the application bundle. See CHANGELOG.md and README.md for user steps.
