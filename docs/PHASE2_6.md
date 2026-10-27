# Phase 2.6: stabilization and release readiness

[Português (Brasil)](PHASE2_6.pt-BR.md)

Assessment date: 27 October 2026. Baseline: `84f5237`, clean `main`. Distributed release: **v0.3.2 / schema 3**. Development: **schema 5**, still unreleased. No release number, tag, official installer, signing-key initialization or updater publication is authorized by this assessment.

## Decision summary

The implemented library, reference-region, bilingual UI, presets and export workflows are technically suitable for a release-candidate decision, with the evidence boundaries below. **This is not approval to publish.** Musical loop continuity remains unapproved. The next version's complete signed installer/update acceptance remains a release gate; source-level migration and an existing signed package do not replace that test.

Two reproduced defects were fixed:

- Schema creation, `user_version` and the initial locale preference previously committed in separate steps. Injecting a denied table creation left additional tables; denying preference insertion left the profile marked schema 5. They now share one explicit transaction. Failure rolls back the migration, including the version marker, before retry.
- The development build could start removing an in-use PyInstaller directory before Windows rejected a locked DLL. The builder now checks ownership before Cargo/PyInstaller. A Windows regression test confirms that the build tools are not invoked in that state. Notice collection accepts a separate output directory so private packaging does not write to a running runtime.

No UI redesign, new engine, export format, inference profile, RAM-gate change or dependency was added. Existing source presets, jobs and asset formats are unchanged.

## Migration, restart and recovery

The automated fixture contains the exact SQL scripts from the distributed tag, rather than a schema-5 database relabeled as schema 3. It includes projects, sessions, favorite/selected assets, parent lineage, edits, DSP presets, authorized voice profiles, opaque settings and three queue states. A live WAL connection remains open while the online backup and migration are checked.

The new tests verify old-row preservation, SQLite integrity/foreign keys, the original schema-3 backup, locale origin/persistence, restart without repeated backup, future-schema refusal, two injected migration failures and abrupt loss of a test-owned process after uncommitted DDL/version changes. Retry succeeds without restoring a raw live database copy.

A separate private integration used the **actual v0.3.2 `Store` implementation**, upgraded its synthetic profile with current code and then opened it through the newly packaged Windows core twice. Original fixture files retained their hashes. The old implementation refused schema 5 without changing database rows. Recovery was exercised with the worker disabled: queued stays queued, confirmed remote identity is retained for query, and uncertain submission becomes interrupted. Synthetic history was explicitly completed before starting the packaged worker; no inference was allowed.

Favorite/selected flags are persisted and preserved. **The desktop A/B pair is temporary React state**, reset on project change/restart; there was no persistent A/B pair in v0.3.2 to migrate. An arbitrary stored setting is not evidence of application comparison persistence. Browser-local guide/update preferences remain outside SQLite; the existing WebView location must survive a real installation update. No new promise of persistent comparison, FX drafts across restarts, or WebView migration is introduced.

The published installer was not installed over another app in this phase. Repeat that lifecycle with the chosen future version and an isolated installation/profile after explicit publication-build authorization. Stable users' data, models, client registration and settings were not modified.

The real packaged core also passed its private update-preparation lifecycle on the migrated isolated profile: preparation returned ready, the identified core exited, a subsequent snapshot started a different process, and every persisted table except expected lifecycle events matched. No installer was executed. Only this validation-owned profile/process participated; this does not verify NSIS or WebView preferences.

## Loop diagnosis: what the rejected files establish

Both rejected sets remain unchanged and private. No third musical round was generated. The owner's rejection prevails.

| Failure dimension | Evidence and limit | Appropriate response |
| --- | --- | --- |
| Sample/phase discontinuity | Four existing faded cycles are finite, below full scale; boundary steps are 0.00207–0.01014, below their within-cycle 99th-percentile adjacent steps. This does not rule out an audible transient or cancellation inside the overlap. | Inspect both channels around the whole overlap; use a local edit for a demonstrated sample defect. Do not equate one boundary metric with musical quality. |
| Pulse/attacks | The rejected rounds did not establish audible downbeats or a stable pulse. Round 2 used unverified recurrence/tempo hypotheses. | Verify attacks and pulse across the complete phrase before choosing boundaries. Similar spectra are insufficient. |
| Period loss | Round 1 selected 16 s and emitted 15.8 s: **1.25% shorter**. Round 2 lost 120 ms: **2.81% / 1.51%** of its two selected regions. This is the algorithm's documented behavior, not random timing drift. | For verified anchor A and intended period P, select A−L through A+P. Existing compensated selection emits P frames. Arbitrary compensated material can still fail musically. |
| Harmonic compatibility | No verified chord progression or equivalent harmonic position was recorded for either rejected selection. | Human harmonic/phrase selection or rearrangement. A fade curve does not make incompatible chords equivalent. |
| Interrupted melody | No verified complete repeatable phrase/cadence was established. | Choose a complete phrase with a viable return; otherwise compose/edit a transition or different arrangement. |
| Reverb/tails | A stereo mix does not identify which instrument/chord owns each tail. Raw overlap correlations vary by channel and cannot prove a correct tail transfer. | Deliberate pickup/post-exit editing, potentially in an identified Audacity project; do not assume a universal overlap length. |
| Arrangement/dynamics | Spectral similarity and headroom do not certify equivalent orchestration, dynamic direction or instrument entry/exit. | Listen to complete source/phrase, not just the seam. Reject unsuitable source regions. |
| No naturally repeating phrase | Not established either way for these compositions. | Remains a musical investigation, not a DSP defect to hide. Loop-ready composition may be required. |

Raw channel correlation is not phase alignment for polyphonic music; neither it nor an estimated BPM is treated as musical ground truth. No chord, melody, reverb or arrangement fault is asserted solely from these numerical observations.

### Strategy comparison and next listening gate

The current method is a linear convex circular overlap. It bounds gain but can attenuate unrelated/antiphase material. Equal-power curves can reduce some level dips yet raise peaks on correlated material; they do not preserve attacks, period, harmony or phrases automatically. Adding curve choices now would not address the demonstrated missing musical selection evidence. No new DSP algorithm was justified or implemented.

Use the existing manual selection and overlap-compensated verified-tempo aid first. The important difference from both rejected attempts is **verified phrase/pulse/harmony and retained period**, not a different random fade. Fixed timing works for a stable measured phrase, fails when its tempo drifts or arrangement cannot return. Ambient material without a pulse still needs compatible texture, dynamics and tail handling; a forced bar grid is inappropriate.

Before another private comparison, require: an authorized original with hash; audible entry/exit anchors; observed pulse stability over multiple repetitions when applicable; a complete phrase with compatible harmony; sufficient pre-entry/post-exit material; intentional attack/tail treatment; unchanged listening level; one cycle and three cycles with recorded joins. Include an unfaded period-preserving control and the justified overlap. If these facts cannot be established, stop and propose a musical edit or loop-ready arrangement. The owner alone approves the subsequent listening result; **#3 stays open**.

Technical references: [Audacity beat alignment and fade shapes](https://manual.audacityteam.org/man/creating_a_crossfade.html), [Audacity gain/power curves](https://manual.audacityteam.org/man/crossfade_tracks.html), [Ableton timing/warp principles](https://www.ableton.com/en/live-manual/12/audio-clips-tempo-and-warping/), [composer pre-entry/post-exit treatment](https://edu.maximegoulet.com/en/pre-entry-and-post-exit/). These are editing principles, not added dependencies. See [the detailed protocol](LOOP_ACCEPTANCE.md).

## Workflow and evidence matrix

| Area | Phase 2.6 evidence | Distribution boundary |
| --- | --- | --- |
| Installation/packaging | New PyInstaller Windows core with isolated notice directory; optimized Tauri build without bundle. Build ownership refusal tested. | No new NSIS installation, WebView2 bootstrap or cold Windows machine acceptance. |
| Setup/engines | Existing pinned setup/download/ownership/resource tests retained; engine recipes and RAM gates unchanged. Legacy FX preview behavior retained except the already-tested loop-specific full-region path. | No repeated model install/load/inference; SFT/GPU remain unvalidated. |
| MCP | Actual packaged stdio handshake, 59 tools, clean unlinked profile, engine categories; actual snapshot against migrated profile. | Does not prove every third-party MCP client or new global client registration. Existing registration untouched. |
| Projects/library/references/presets | Python regression suite covers validation, ownership, schema, regions, tags/filters, music/DSP presets, voice profiles, exports and recovery. | Mock adapters are contract evidence, not live model acceptance. |
| Playback/comparison/export/accessibility | Reuse [Phase 2.5 native checks and direct screenshots](PHASE2_5.md) at 1000×700 and 1280×720 EN/PT-BR. No frontend source changed in Phase 2.6; 71 frontend tests passed again. | No new native click round claimed; previous targeted focus/keyboard acceptance is not assistive-technology/DPI certification. 900×600 remains unsupported. |
| Update/authentication | Public latest manifest v0.3.2 retrieved; local public installer hash matches GitHub asset digest. Public-key verification passed and modified bytes were rejected; authenticated version is 0.3.2. | No secret-key access, signing or installation. Future-version updater restart, WebView preference retention and rollback procedure still require an isolated candidate test. |
| Recovery | Injected SQL failures and real termination of a test-owned migration child; consistent backup, retry, source hashes and old-core refusal. Existing uncertain-send/update-busy guards passed. | Not an OS power-loss/storage-hardware certification; no production process was terminated. |

## Checks and performance

- **126 Python tests passed**; five upgrade tests and one Windows build-ownership regression added.
- **71 frontend tests passed**, including catalog/placeholder parity, onboarding, known diagnostics, retained workspaces and controls; typecheck passed in the frontend/Windows builds.
- **28 native Rust workspace tests passed**. Tauri test target compiled and ran **zero tests**; it is not UI acceptance.
- Production frontend and optimized Windows build without bundle passed; new packaged lightweight core and separate notices succeeded. No AI task or model installation was submitted.
- Frontend output: main JavaScript **736.39 kB / 235.33 kB gzip**; already-lazy release notes **120.15 kB / 37.16 kB gzip**; CSS **50.66 kB / 15.85 kB gzip**. Gzip size is a build statistic, not a local WebView download or RAM measurement.
- Studio/library modules are eagerly imported, while release notes already load on demand. Further splitting could defer module code, but current measurements do not demonstrate a startup/RAM problem or a before/after benefit. No optimization, dependency or whole-UI refactor was added merely to remove the warning. The chunk warning remains nonblocking; native large-library interaction evidence is from Phase 2.5, not a scalability benchmark.
- The first standard core build encountered a running development runtime. Windows refused a locked file after partial cleanup. Missing development files were restored from the matching preserved runtime, with identical executable hash, without replacing existing files or stopping processes. The fixed builder now refuses before modifications; the new acceptance package was built separately. Installed stable files were untouched.

SQLite transaction behavior was checked against the [Python 3.12 connection/executescript documentation](https://docs.python.org/3.12/library/sqlite3.html) and [SQLite transaction documentation](https://www.sqlite.org/lang_transaction.html). Schema DDL/version/locale commit together; online backup remains before the migration transaction.

## Release gates and remaining decisions

**Ready:** implemented project/library/region/tag/filter/preset/export functionality, bilingual presentation and lightweight MCP contracts within the recorded tests. **Experimental:** existing Stable Audio/voice profiles under their documented engine limits; musical loop tools remain unapproved. **Blocking publication:** owner's loop availability decision, chosen version and explicit release authorization, then complete isolated signed candidate installation/update acceptance. Do not present an untested installer lifecycle as passed.

Options for loops:

- **A — exclude from next distribution:** permits other functionality to progress, but requires a separately evaluated availability change that consistently handles UI, MCP and existing loop assets/jobs. Nothing has been hidden/deleted in this phase.
- **B — clearly experimental:** preserves access but needs explicit product language and owner agreement; cannot promise musical continuity or close #3.
- **C — wait for a justified improvement and human acceptance:** **technical recommendation for the loop feature**, given two rejections and unverified musical boundaries. It is not selected on the owner's behalf and does not automatically require holding every unrelated improvement.

No availability switch or new third musical round was implemented without the preceding evidence. The recommendation is not a release authorization.

Nonblocking/known limits: unsigned Windows publisher, bundle warning, temporary A/B selection, no new heavy-engine/DAW/cold-cache benchmark. #6 strict offline remains high-priority dependent on actual installed-component/cache/network tests; disabling updater checks alone is insufficient. #7 GPU and #8 active cancellation remain medium-priority separate feasibility work; #9 generative previews remains low priority pending measurable quality/performance benefit. None was implemented or closed.

Validated stabilization commits: `b471c6f` (atomic migration and recovery regressions) and `a09c89f` (build ownership refusal and isolated notices). This report accompanies their publication on `main`, without a PR or release. Publication hygiene checked 475 reachable blobs and 230 working files with no configured pattern findings; changed Markdown validation checked 38 local links without errors. This is a bounded privacy check, not a complete security audit. Historical author emails remain as previously authorized.

Private migration, rejected-audio diagnostics and signature receipts remain outside Git. The previous signed release/updater artifacts remain unchanged.
