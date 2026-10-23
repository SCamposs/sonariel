# Validation receipt — 2026-10-23

This file records real execution separately from implementation coverage. No musical references, audio, private logs or machine-specific paths belong in this repository.

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
- The installer is unsigned. WebView2 bootstrap behavior on a computer without WebView2 was not exercised here.
- GPU inference, other upstream task types and active inference cancellation are not implemented. Automated mocks are not counted as live integration evidence.

The source repository contains no audio, model weights, engine environments, installer binaries, private logs or personal configuration. Distribution artifacts remain outside Git.
