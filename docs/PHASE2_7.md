# Phase 2.7 — Windows distribution candidate

[Português (Brasil)](PHASE2_7.pt-BR.md)

## Candidate and publication boundary

Candidate **0.4.0-rc.1**, implementation commit `65b0780`, proposed stable version 0.4.0. Python package metadata uses the equivalent PEP 440 form `0.4.0rc1`. The owner subsequently authorized publishing this [test prerelease](https://github.com/SCamposs/sonariel/releases/tag/v0.4.0-rc.1) to download it inside the Windows VM. It is not the stable release: **v0.3.2 remains latest**, and the public updater manifest was not replaced.

Windows x64 NSIS installer: `Sonariel_0.4.0-rc.1_x64-setup.exe`, 22,534,304 bytes. SHA-256:

```text
4f35135835624b3f57acf357d1cb58ffea0545081031a7d2b0c6b286916814bf
```

The reviewed source and 97 relevant executable inputs matched the isolated build snapshot. No production profile, audio, model or private signing material was committed or uploaded.

## Included functionality and loops

The candidate includes EN/PT-BR, Voice Studio, experimental Stable Audio, native FX, library/A/B comparison, batch WAV exports, musical presets, reference regions, tags/filters, recoverable discard and MCP. Audacity remains optional. Existing engine limits and RAM gates remain unchanged; no new heavy generation was performed in this phase.

**Loop creation is unavailable in packaged distributions.** The UI omits it, MCP omits its dedicated tool, and the core rejects both direct calls and generic FX recipes containing loops. An environment variable cannot enable it in a frozen package. Source development requires an explicit opt-in and a separate non-production profile. Previously queued loops are interrupted before execution; their records, files, metadata and lineage remain preserved. Reference excerpts and ordinary FX remain available.

Issue [#3](https://github.com/SCamposs/sonariel/issues/3) remains open: both earlier musical rounds were rejected; no third round was run. Issues #6–9 remain separate, unimplemented follow-ups. Temporary A/B selections are not promised to survive restart.

## Acceptance record — 2026-10-27

| Area | Result | Evidence and limits |
| --- | --- | --- |
| Automated regressions | PASS | 131 Python, 73 frontend and 28 native Rust workspace tests; typecheck passed. The Tauri test target compiled and ran zero tests, not a UI test. |
| Build and packaging | PASS | Isolated PyInstaller core, optimized Tauri app and actual NSIS installer built with existing signing routine/key. No new dependencies. |
| Signature and integrity | PASS | Candidate public-key verification and authenticated RC version passed. Modified/truncated bytes and invalid signatures were rejected. Tauri signature is not Authenticode; unknown-publisher warnings may remain. |
| Packaged MCP | PASS | Actual stdio handshake and 58 tools. Packaged loop enablement and direct/generic bypasses rejected; reference region succeeded. This test ran outside the VM in an isolated profile. |
| Native FX and export | PASS outside VM | Actual synthetic 10-second native gain preview completed; source hash preserved and two exports hash-verified. Zero AI jobs. |
| SQLite migration | PASS outside VM | Real v0.3.2 Store schema 3 migrated to 5 in an isolated fixture; rows, language, files and consistent backup preserved; old core refused newer database without altering it. This was not installer/update acceptance. |
| Core update preparation | PASS outside VM | Test-owned idle core exited, candidate core restarted and persisted tables survived except expected lifecycle events. No installer was exercised by this check. |
| Clean Sonariel installation on Windows | PASS, owner accepted | Official GitHub RC installer ran to completion in a disposable Hyper-V Windows 11 guest with a fresh Sonariel profile, 6 GiB RAM and no AI engines installed. The OS already supplied WebView2; a missing-WebView2 bootstrap was not exercised. |
| First use and language | PASS in VM | Core initialized; English suggested; language chooser and tutorial opened; next-step and optional dismissal worked. PT-BR switch saved immediately. |
| Projects, import and library | PASS in VM | Created a test project; selected a guest Windows WAV through the native picker; registered it and loaded its waveform/48 kHz PCM-16 metadata. No production assets used. |
| Playback | PASS for transport; audible output NOT TESTED | Playback position advanced and reached the end. The basic VM audio output was not independently heard or captured. |
| WAV export | PASS in VM | Exported to a new guest Downloads WAV; core reported the copy exported and verified. Guest bytes were not independently extracted for another hash computation. |
| Close/reopen and preferences | PASS in VM | Reopened using installed desktop shortcut; project, registered result and PT-BR persisted; first-use guide did not repeat. |
| Native FX in VM | NOT COMPLETED | One gain preview correctly waited for 3 GiB free; the guest had about 1.7–2.4 GiB. Cancelled before execution; history retained. No RAM gate was reduced. |
| NSIS uninstall | NOT TESTED | Installed app and test data preserved. |
| Official v0.3.2 → RC installer/updater lifecycle | NOT TESTED | The old installer was downloaded, but the old app was not installed/run before an upgrade. No complete updater download/install/relaunch, WebView preference migration or injected updater interruption is claimed. |

No functional failure was observed in the completed VM checks. RAM prevented the guest FX render from starting; it is not a successful render. A separate private transport-only v0.3.2 updater client was built but not exercised in the guest and is not an official/public artifact.

## Delivery and recommendation

Private evidence includes candidate inventory, packaged MCP/FX receipt, migration and restart receipts, VM installation observations, isolated builds and the unused updater fixture. These remain outside Git. The installed stable application, production data, model environments and Unity projects were untouched.

The owner accepted Windows installation/basic-use validation and explicitly chose to close Phase 2.7 with the untested update lifecycle recorded as a caveat, rather than retain it as an outstanding phase requirement. The remaining untested items above are retained as limits of this acceptance. That decision does not manufacture missing evidence. **Phase closed with caveats; suitable as a test prerelease. Complete v0.3.2 → RC update acceptance remains unverified for an unconditional stable-readiness claim.** Publishing/promoting stable and changing its update feed still require the owner's separate decision.
