# Validation receipt

This file records real execution separately from implementation coverage. No musical references, audio, private logs or machine-specific paths belong in this repository.

## Verified during implementation

- Existing CPU baseline discovered and linked through package/commit/model/patch inspection, without reinstalling or rewriting it.
- A separate engine root installed with managed Python, a new venv, pinned CPU dependencies and fixed ACE-Step source. All required model files were verified against the official pinned manifest before cache reuse.
- The isolated installation was repeated and remained compatible without creating another environment.
- Official portable Audacity archive downloaded and verified. Existing open Audacity prevented configuration changes as designed.
- Core tests: 32 passed, covering persistence, input contracts, idempotency (including changed-request rejection), reference/source roles, cancellation, uncertain-submit recovery, file integrity, installer ownership, ZIP traversal, Codex configuration preservation and wrong-project refusal.
- Frontend tests: 2 passed. Typecheck and production frontend build passed.
- MCP initialization, tool discovery (25 tools) and project/environment operations passed through stdio.
- Windows x64 release build and NSIS installer succeeded. Installer executed successfully into a separate user application folder. Native desktop loaded the real shared database.
- Browser visual inspection confirmed the requested dark industrial visual language with locally packaged fonts.
- Existing proposal and edited WAV hashes remained unchanged. The open Audacity project was not copied or closed.
- The single authorized 10-second technical generation completed through the shared MCP queue using the newly installed CPU engine: 124.516 seconds to load, 23.19 seconds reported inference, 26.719 seconds submission-to-validated-output processing. Observed engine process-tree peak RSS was 13.990 GiB. Minimum sampled system available memory was only 0.0049 GiB, so this run passed under severe memory pressure, not with comfortable headroom.
- The resulting WAV validated as 10 seconds, stereo, 48 kHz, floating-point samples, peak 0.891251 and RMS 0.103593. SHA-256: `0d9328f57c9e77c741681a58a31a31d59b023a4be1c1c962e0ca7fceaad54f47`. Seed 4137; model and full parameters remain in the local asset metadata. The owned engine was stopped after completion to release memory.
- The cold-start gate was raised from 10 to 16 GiB available after observing this pressure. No second generation was launched to test the change.
- Real Audacity read probe, isolated import, track identity verification, project save and WAV export succeeded. Only the technical study was edited, with 0.4-second fade-in and 0.7-second fade-out. The exported WAV validated as 10 seconds and was cataloged with parent lineage.

## In progress / integration gates

- The queue's memory gate was exercised: the technical job stayed queued below the cold-start threshold, then proceeded after memory was freed. The completed state and result are persisted.
- An earlier read probe returned Windows error 231 (`ERROR_PIPE_BUSY`); it was not bypassed. After the user closed the original Audacity session and resolved a module prompt manually, the read probe and bounded editing flow passed in a new session.
- The desktop's installed playback, restart persistence and final packaged MCP registration are verified before closing this receipt.

## Scope limits

The isolated setup used verified model cache reuse. This is a real new runtime/venv installation, but is not a zero-cache machine test. Automated tests use mocks where appropriate and are not counted as live integration evidence. GPU inference, other upstream task types and active inference cancellation are not implemented.
