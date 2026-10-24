# Validation receipt — 2026-10-23

This file records real execution separately from implementation coverage. No musical references, audio, private logs or machine-specific paths belong in this repository.

## v0.3.2 checks

- Python: 82 tests passed. Storage coverage includes managed music/voice/FX/preview/export roundtrips, unchanged external files, protected favorites/references/lineage/voice/Audacity dependencies, stale previews, missing confirmation, occupied restore targets, interrupted moves, tampered trash and consistent migration backups.
- Frontend: 38 tests passed, including native-picker filters, folder/file/save selection contracts, cancellation, failure/retry, focus return, manual typing and browser fallback; storage confirmation/cancellation and queue protections; shared refresh success/failure. Typecheck, Vite production build and Rust `cargo check --locked` passed. Browser mocks do not prove Windows native-dialog behavior.
- No production assets were discarded, moved or restored as validation. There is no permanent-delete operation, automatic cleanup or recursive filesystem scan. Trash retains bytes and does not reclaim disk space. Only already registered files appear in the inventory.
- The actual packaged core completed a stdio MCP handshake with 47 tools in a fresh isolated profile. A one-second synthetic WAV was processed with native gain (no AI), its managed output moved to the recoverable trash and restored with matching SHA-256; the external input remained unchanged and its parent dependency was protected. The final packaged runtime repeated this roundtrip successfully.
- The Windows desktop preview opened native executable and folder pickers and WAV Save As, showing the expected dialog types/default filename. Cancelling did not save/import/install anything. The central inventory and discard preview were inspected in the real desktop; production cleanup was not exercised. The final footer uses an explicit flex row, 12px gap and wrapping between cancel/confirm actions.

- ACE-Step cold-start threshold changed from 16 to 12 GiB at the owner's explicit request. Warm start remains 4 GiB; CPU/Turbo/DiT-only, disabled LM/Flash Attention and single-task ownership are unchanged.
- This is not an optimized lower-memory model or a new memory-safety benchmark. An already queued, separately authorized production job completed after the threshold reduction, reaching approximately 14.16 GiB engine RSS and a sampled low of 0.55 GiB available physical RAM. This demonstrates completion of that run, not comfortable headroom or reliability under other loads. No additional AI inference was launched for release validation. Existing queued work can proceed once 12 GiB are available.

## v0.2 release checks

- Python: 42 tests passed, including update preparation refusing queued/active work, setup and open MCP clients; the private desktop lifecycle operation is not a public MCP tool.
- Frontend: 13 tests passed, including first-use tutorial dismissal/replay/completion, hourly optional checks, remembered manual mode, retained available-version signal on network failure and no automatic installation. Typecheck and Rust `cargo check` passed; npm audit reported zero vulnerabilities.
- A real Edge layout regression reproduced the original transient horizontal scrollbar using the old rules. The corrected guide had no horizontal overflow across 2,142 sampled animation frames at 1440×940, 1000×700 and 1000×520. Vertical scrolling and reachable footer remained available on the short viewport, progress interpolated between steps and reduced motion disabled the transition.
- The updated installed desktop replayed the tutorial from the sidebar, navigated by keyboard and displayed the dismissal reminder. Existing projects and the selected production candidate remained intact. A packaged core handshake returned version 0.2.0 and 25 tools, with the existing compatible engine linked and unloaded.
- The official 0.2.0 NSIS artifact and version-bound updater signature were generated; the custom Sonariel license was verified in the bundled notices. The private signing key is outside Git and encrypted for the current Windows user with DPAPI.
- Publication hygiene reviewed tracked/untracked source and all 136 reachable historical blobs at publication. No known-token patterns, private-key blocks, personal Windows paths or audio/database/model assets were found. This is a bounded secret/privacy review, not a complete vulnerability audit or a guarantee that every possible secret was detected. Historical author metadata was retained at the owner's request; subsequent commits use GitHub no-reply.
- A source-available license and user-oriented README were added. The license permits commercial music production but restricts selling the application/derivatives or paid access to operate it. Third-party licenses remain separate; no legal review or ownership guarantee for generated audio is claimed.
- A local verification build with native version 0.1.99 was installed to exercise a real upgrade to the public 0.2.0 release. The app detected the version, displayed the amber signal, downloaded and verified the signed package, prepared the idle core, installed through NSIS and reopened automatically after the owner's explicit confirmation. Windows registration reported 0.2.0; the reopened app's startup query reported the current version with no update signal. Two projects, three audio assets and the one completed job remained intact. No audio generation or Audacity edits were performed for this check.
- The public release manifest was fetched without authentication (HTTP 200), and GitHub's published installer digest matched the local SHA-256. Original production WAV hashes were checked unchanged. The repository and stable v0.2.0 release are public; installer, signature, manifest, checksums and license are release assets rather than Git blobs.
- After the upgrade, the registered MCP command was launched verbatim and initialized as 0.2.0. While that real MCP process was open, the authenticated private update-preparation request was refused with the expected close-MCP instruction, and the core remained running. The distributed stdio smoke test again reported 25 tools and a compatible linked environment.

## Verified during implementation

- Existing CPU baseline discovered and linked through package/commit/model/patch inspection, without reinstalling or rewriting it.
- A separate engine root installed with managed Python, a new venv, pinned CPU dependencies and fixed ACE-Step source. All required model files were verified against the official pinned manifest before cache reuse.
- The isolated installation was repeated and remained compatible without creating another environment.
- First-run setup also passed through the real asynchronous service with a separate fresh application state. The compatible CPU environment was automatically linked; an existing linked environment is preserved.
- Official portable Audacity archive downloaded and verified. Existing open Audacity prevented configuration changes as designed.
- Core tests: 38 passed, covering persistence, input contracts, idempotency (including changed-request rejection), reference/source roles, cancellation, uncertain-submit recovery, file integrity, partial download resumption, corrupt-download rejection, retryable early setup failure, visible manual setup actions, first-install linking without replacing an existing environment, installer ownership, ZIP traversal, Codex configuration preservation and wrong-project refusal.
- Frontend tests: 6 passed, including Base UI wrapper keyboard selection, modal focus containment/restoration, Escape dismissal, slider value semantics and disabled controls. Typecheck and production frontend build passed. jsdom platform adapters are test-only and do not prove native layout.
- MCP initialization, tool discovery (25 tools) and project/environment operations passed through stdio.
- Windows x64 release build and NSIS installer succeeded. Installer executed successfully into a separate user application folder. Native desktop loaded the real shared database.
- Browser visual inspection confirmed the requested dark industrial visual language with locally packaged fonts.
- Existing proposal and edited WAV hashes remained unchanged. Sonariel did not close the original Audacity session or copy its live project files.
- The single authorized 10-second technical generation completed through the shared MCP queue using the newly installed CPU engine: 124.516 seconds to load, 23.19 seconds reported inference, 26.719 seconds submission-to-validated-output processing. Observed engine process-tree peak RSS was 13.990 GiB. Minimum sampled system available memory was only 0.0049 GiB, so this run passed under severe memory pressure, not with comfortable headroom.
- The resulting WAV validated as 10 seconds, stereo, 48 kHz, floating-point samples, peak 0.891251 and RMS 0.103593. SHA-256: `0d9328f57c9e77c741681a58a31a31d59b023a4be1c1c962e0ca7fceaad54f47`. Seed 4137; model and full parameters remain in the local asset metadata. The owned engine was stopped after completion to release memory.
- The cold-start gate was raised from 10 to 16 GiB available after observing this pressure. No second generation was launched to test the change.
- Real Audacity read probe, isolated import, track identity verification, project save and WAV export succeeded. Only the technical study was edited, with 0.4-second fade-in and 0.7-second fade-out. The exported WAV validated as 10 seconds and was cataloged with parent lineage.
- Installed desktop playback reached the end of the generated floating-point WAV. The exported PCM version was also played, and the real two-version comparison view was exercised.
- The interface was closed normally and reopened. Projects, selected project, completed task, original result and exported version remained in the shared store and appeared again in the desktop.
- The distributed core initialized over stdio and exposed 25 tools. Its registered command was tested verbatim, including after registration from the installed desktop. The original five MCP servers and all other parsed configuration remained unchanged; a backup was created and the workflow skill installed.
- The lightweight distributed core used approximately 60 MiB RSS while the model was unloaded. Opening it did not start a second inference process.
- Dependency audit reported zero npm vulnerabilities; automated tests, typecheck, production frontend build, optimized Windows build and NSIS packaging passed.
- The final desktop was returned to the preserved existing engine adapter, not left pointing at the isolated validation engine.
- Base UI 1.9.0 is isolated behind three application-owned components. Only those implementations import its subpaths. The desktop's selector popup was inspected with the original Sonariel appearance preserved; native scrollbar styling remains separate from its scrolling behavior.
- Final installed desktop checks confirmed modal Tab/Shift+Tab containment, Escape dismissal with focus restored to the originating details button, wheel scrolling with the custom scrollbar, playback and pointer seeking to approximately five seconds. Slider keyboard semantics additionally passed the DOM contract tests; no automated native screen-reader certification is claimed.
- A subsequent real client initialization identified itself as `codex-mcp-client`. This confirms a Codex protocol handshake, not a tool call from this conversation's model context.

## Resolved integration gates

- Fixed the desktop grid's minimum-size overflow: the main workspace now scrolls within the height reserved above the fixed player, instead of extending behind it. Wheel scrolling in the updated installed desktop exposed the complete final selected-candidate panel and its action above the player. The navigation rail can also scroll independently on short windows.

- The queue's memory gate was exercised: the technical job stayed queued below the cold-start threshold, then proceeded after memory was freed. The completed state and result are persisted.
- An earlier read probe returned Windows error 231 (`ERROR_PIPE_BUSY`); it was not bypassed. After the user closed the original Audacity session and resolved a module prompt manually, the read probe and bounded editing flow passed in a new session.
- The installed playback, restart persistence and packaged MCP registration gates passed. A test protocol handshake is distinct from loading tools into an already-running Codex conversation.

## Implemented but not fully validated in this environment

- The isolated setup used verified model cache reuse. This is a real new runtime/venv installation and generation, not a zero-cache machine test. Download resumption and failure guards have automated coverage; no destructive mid-install fault was injected into the working baseline.
- The portable Audacity archive was downloaded and hash-verified. Preparing its configuration was initially deferred with Audacity open, then completed safely when no Audacity process was running. A later launch resolved to the globally installed Audacity and a recovered session, which was not edited. A portable-only process/pipe handshake is therefore not claimed; the real handoff passed against the user's compatible installed Audacity.
- The new 16 GiB cold / 4 GiB warm gates are conservative safeguards informed by the measured run, not newly benchmarked memory guarantees for longer tasks. No extra generation was launched.

## Remaining user action and limitations

- Reload/restart the Codex client to load the registered tools in a new client session. This already-running conversation did not expose the new tools during validation; it must not be described as a proven live Codex tool call.
- The installer does not have a Windows publisher/Authenticode signature. Version 0.2 updater packages have a separate cryptographic signature. WebView2 bootstrap behavior on a computer without WebView2 was not exercised here.
- GPU inference, other upstream task types and active inference cancellation are not implemented. Automated mocks are not counted as live integration evidence.

The source repository contains no audio, model weights, engine environments, installer binaries, private logs or personal configuration. Distribution artifacts remain outside Git.
