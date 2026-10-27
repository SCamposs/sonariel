# Phase 3 — free Sonariel MCP integration skill

Date: **2026-10-27**. Deliverable: **Sonariel MCP Integration 1.0.0**, targeting the published **Sonariel 0.4.0** Windows x64 distribution. The skill is prepared for the owner's review; **no Agensi listing has been created or submitted**.

## Scope and delivery

The main branch began clean at `87b36f2`, synchronized with `origin/main`. GitHub confirmed `v0.4.0` is public, stable and not a draft. This phase adds only integration skill source and documentation. It does not modify runtime/frontend/native code, app versions, bundled skill, software license, production configuration, audio/model environments or Unity projects. No application release/update-feed change was made.

Source tree:

```text
skills/sonariel-mcp-integration/
  SKILL.md
  README.md
  LICENSE
  references/
    setup.md
    mcp-workflow.md
    engine-capabilities.md
    safety-and-recovery.md
    troubleshooting.md
    compatibility.md
  templates/
    codex-mcp.toml.example
```

The ZIP contains exactly these ten text files at its root, without the containing directory. The included license is byte-identical to the repository's existing license. Submission copies/receipts/runtimes/audio remain outside Git. The [package audit](agensi/PACKAGE_AUDIT.md) records the final archive name, size and SHA-256.

The main skill is a decision-oriented entrypoint: discover installed tools, inspect the user's environment/project, route to the needed reference, preserve authorization and recover uncertain operations. It does not load all 58 schemas or prescribe every operation for every request. The [beginner guide](../skills/sonariel-mcp-integration/README.md) starts with imported WAV/native FX, requiring no AI model. The separate [platform research](agensi/RESEARCH.md), [listing copy](agensi/LISTING.md) and [behavioral review](agensi/BEHAVIORAL_REVIEW.md) are public maintainer documents, not payload files.

## Actual distribution and isolation

Tests used the payload extracted from the **downloaded public signed v0.4.0 installer**, not a rebuilt main branch or source-only MCP server:

- Installer SHA-256: `3645f92b041085dbbeb5967407bcf54ac289a308450cfecbae51c5d837e27b5c`.
- Extracted `runtime/sonariel-core.exe` SHA-256: `aaadc69e524bb1782b68ea2e462abbc3591938fe10dae2ed0da97b225792a2bc`.
- Fresh, separate `SONARIEL_HOME` profiles for discovery, workflow and client connection tests. They contained only synthetic demonstration material; no existing engine was linked.
- The payload was extracted into a private directory without running NSIS again, avoiding registry/shortcut changes to the production installation. This is distribution-runtime/skill acceptance, **not a new Windows installer acceptance claim**.
- Actual initialization identified `sonariel` version `0.4.0`; `tools/list` returned **58 tools**. The loop tool was absent and `snapshot.capabilities.loop_creation` was false. No enable flag, loop call or bypass was attempted in this phase.

The public updater/installation caveat from [Phase 2.7](PHASE2_7.md) remains unchanged. This work did not retest the complete v0.3.2 → v0.4.0 installer/updater cycle.

## Executed scenarios

| Scenario | Result | Evidence and limit |
| --- | --- | --- |
| A: first connection | PASS | Real stable initialization, tool discovery, capabilities, empty projects, environment and engine catalog. Native FX installed; generative engines unconfigured. |
| B: organize WAV | PASS | Created generic project/session; imported 12 s stereo/24 kHz float WAV; inspected ID/metadata/hash; applied tags and combined query/session/kind/tag filters. Empty filter returned empty results without deleting data. |
| C: non-destructive FX | PASS | One native gain job, -3 dB, preview=true. New 10 s stereo/24 kHz WAV; finite nonzero samples, correct parent. Maximum sample difference against expected gain: `6.364096291622268e-09`. Original SHA unchanged. |
| D: library/export | PASS | One individual export and two batch copies independently hashed. Existing destination rejected; skip collisions preserved bytes. Portable manifest verified; reference export without opt-in rejected. Later privacy probe excluded synthetic prompt/path/token canaries. |
| E: recovery/errors | PASS for exercised cases | Same-key replay recovered one job before/after restart. Changed arguments rejected. Missing engine, invalid meter, missing WAV, absent tool and unsupported style role rejected. Missing MCP executable failed safely. Low-RAM response was reviewed as a **tabletop simulation**, not forced on the host. |
| F: authorization | PASS for explicit guards; guided review for agent choices | Real refusals for unconfirmed preset generation, installation without authorization, missing Stable terms, voice reference without consent and unconfirmed discard. No installation/download, generation duplication, private export or destructive operation occurred. Instruction adherence is not proven for every future model. |
| Region and presets | PASS | Non-destructive 10 s Turbo source region preserved parent/hash, replay returned same ID. Saved/reviewed a music preset without queueing inference. |
| Persistence | PASS | Restarted the test-owned core: project/session, filters, assets, preset and completed job survived. Exact request replay still returned the same job. |

There were **27 workflow/persistence assertions plus 6 boundary assertions**, all passing after correcting the test driver's filter-response shape. This is not a claim of 33 independent UI/agent tests. **One native FX job; zero music/voice inference runs; zero model downloads.** Available RAM snapshots were 9.490 GiB before and 8.902 GiB after the main run; these are system observations, not peak DSP memory measurements. No RAM gate or host process was changed.

Demonstration source SHA-256: `3264657794044b9d59ca6e4574f7f50282aea8cfbcb82c658a9997109712fe65`.
Preview SHA-256: `74bb705d23ddc66bd1ff7585145f5b73aae0cbd46f5177269fe98de62e131717`.
The generic project/job/asset IDs and complete raw traces remain in private receipts. The public [listing demonstration](agensi/LISTING.md#see-it-in-action) reports only this actual run. No aesthetic approval, user testimonial or synthetic result disguised as AI music is included.

## MCP contracts actually exercised

All 58 schemas were collected from the packaged server. Positive calls exercised these **26 distinct tools**:

```text
sonariel_snapshot                 sonariel_environment_status
sonariel_engines_list             sonariel_projects_list
sonariel_project_create           sonariel_project_select
sonariel_session_create           sonariel_result_import
sonariel_results_list             sonariel_reference_register
sonariel_references_list          sonariel_asset_tags_update
sonariel_project_tags_list        sonariel_library_filters_save
sonariel_fx_presets_list          sonariel_fx_render
sonariel_queue_list               sonariel_job_get
sonariel_audio_region_create      sonariel_result_export
sonariel_result_export_batch      sonariel_music_preset_save
sonariel_music_preset_prepare     sonariel_music_presets_list
sonariel_storage_preview          sonariel_voice_profiles_list
```

Negative calls exercised rejection paths in `audio_region_create`, `fx_render`, `generate`, `job_cancel`, `music_generate`, `music_preset_generate`, `result_export`, `result_import`, `setup_install`, `stable_setup_install`, `storage_discard` and `voice_profile_save`. A deliberately nonexistent tool separately returned the expected protocol error. These are **34 distinct advertised tools** across success/rejection paths, plus the nonexistent-tool probe; uncalled tools are not marked validated. Positive generation/install/discard/Audacity operations were intentionally not performed.

MCP error handling checks both JSON-RPC errors and `isError` in tool results. A transported response does not establish operation success. The lost-response case withheld a real submission result from the recovery step; it did not simulate a physical network fault. The [behavior review](agensi/BEHAVIORAL_REVIEW.md) separates documentary/tabletop cases from execution.

## Client compatibility

| Client | Status | What was actually tested |
| --- | --- | --- |
| Codex 0.153.4, Windows | TESTED / TESTADO, bounded coverage | Isolated app-server initialized real MCP and discovered v0.4.0/58 tools. Authoring Codex executed the skill workflow through a separate stdio driver. No live Agensi skill delivery or autonomous fresh-conversation benchmark. |
| Claude Code 2.1.76, Windows | IMPLEMENTED, NOT VALIDATED / IMPLEMENTADO, NÃO VALIDADO | Isolated `.mcp.json` and configuration directory; `claude mcp list` returned Connected. Transport only; no Claude tool workflow or model request. |
| Cursor 2.6.19 | IMPLEMENTED, NOT VALIDATED / IMPLEMENTADO, NÃO VALIDADO | Installed binary detected, official stdio config documented. No isolated agent workflow exercised. |
| Copilot in VS Code 1.143.1 | IMPLEMENTED, NOT VALIDATED / IMPLEMENTADO, NÃO VALIDADO | Editor detected; official `servers` config documented. No authenticated isolated Copilot workflow exercised. |
| Other local MCP clients | IMPLEMENTED, NOT VALIDATED / IMPLEMENTADO, NÃO VALIDADO | Generic protocol path; no certification or blanket compatibility claim. |
| Remote/web-only clients without local Windows execution; Sonariel on macOS/Linux | NOT SUPPORTED / NÃO SUPORTADO | No bridge or compatible Sonariel distribution supplied here. |

No global agent configurations or credentials were copied/modified. No client or extension installation was required. The [package matrix](../skills/sonariel-mcp-integration/references/compatibility.md) includes current official contracts and manual examples.

## Review findings and remaining limits

Resolved in the skill/validation documents: YAML quoting; nested filter response shape; Agensi on-demand reference loading; explicit first-use explanation; preview/final distinction; exact meter/language fields; no-key import/export recovery; and clear separation of transport tests from agent workflows. No blocking Sonariel functional defect was found and no application patch was made.

Heavy engine behavior relies on earlier [engine evidence](ENGINES.md) and [validation](VALIDATION.md), not this phase. There was no active inference to cancel, no Audacity identity test, no real low-memory event, no installer cycle and no autonomous adversarial agent benchmark. Artistic approval still belongs to the user. The guidance cannot guarantee a third-party model's choices or clear rights/licensing of recordings.

Agensi acceptance, account terms, name availability and final live delivery remain **manual future steps**, after owner approval. They are outside this preparation's completion criterion. The free desktop remains independent of Agensi. Do not put this ZIP in an app release or change the app updater to distribute it.

## Publication handoff

Review the [listing and manual steps](agensi/LISTING.md#manual-submission-after-owner-approval), [ZIP audit](agensi/PACKAGE_AUDIT.md) and [source files](../skills/sonariel-mcp-integration/README.md). Only validated skill/documentation source is published to main; the ZIP stays private. No branch, PR, paid product, new Sonariel release or Agensi submission is part of this delivery.
