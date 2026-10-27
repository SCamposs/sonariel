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

Validation logistics: Windows Sandbox was unavailable; the first existing VM was Ubuntu. A disposable Windows 11 Hyper-V guest was prepared instead. Hyper-V guest file copy failed with `0x800710DF` (device not ready). At the owner's direction, the RC was published as a prerelease and downloaded from GitHub inside the guest. That resolved installer delivery; the transfer failure was not a Sonariel runtime failure. The owner later ended further VM checks and accepted the explicit limits below.

## Delivery and recommendation

Private evidence includes candidate inventory, packaged MCP/FX receipt, migration and restart receipts, VM installation observations, isolated builds and the unused updater fixture. These remain outside Git. The installed stable application, production data, model environments and Unity projects were untouched.

The owner accepted Windows installation/basic-use validation and explicitly chose to close Phase 2.7 with the untested update lifecycle recorded as a caveat, rather than retain it as an outstanding phase requirement. The remaining untested items above are retained as limits of this acceptance. That decision does not manufacture missing evidence. **Phase closed with caveats; suitable as a test prerelease. Complete v0.3.2 → RC update acceptance remains unverified for an unconditional stable-readiness claim.** Publishing/promoting stable and changing its update feed still require the owner's separate decision.


## Stable v0.4.0 publication follow-up

After closing the RC phase with caveats, the maintainer explicitly authorized a normal stable release and the public updater. The previous latest/feed v0.3.2 boundary above describes the RC acceptance checkpoint; it is superseded by the v0.4.0 publication decision. The untested full v0.3.2 → v0.4.0 installation/update cycle remains a documented, accepted caveat, not a passed test.

- Stable version identity `0.4.0` is coherent across npm, Cargo, Tauri, Python package and core. The implementation is unchanged from the RC: 109 runtime files compared; only the core version string differs. One additional bilingual diagnostic regression is test-only.
- A fresh isolated Windows build used the existing signing routine and key. No installed application, production profile or running runtime was overwritten. The signed installer is `Sonariel_0.4.0_x64-setup.exe`, 22,533,414 bytes, SHA-256 `3645f92b041085dbbeb5967407bcf54ac289a308450cfecbae51c5d837e27b5c`. The RC artifacts remain unchanged.
- Repeated stable checks: **131 Python**, **73 frontend**, **28 native Rust workspace** tests and typecheck passed. Production frontend/Tauri/NSIS build passed; existing nonblocking JavaScript chunk-size warning remains.
- Actual stable packaged stdio MCP handshake/version and **58 tools** passed. Both loop bypass attempts were rejected, including explicit development opt-in on the frozen package. Reference excerpt, one synthetic 10-second native gain preview and two hash-verified exports passed; original hash preserved; **zero AI jobs**. The test-owned core was prepared for clean shutdown afterward.
- Stable public-key signature and authenticated `0.4.0` version passed; modified bytes, truncation and invalid signature were rejected. No private signing material was exposed. This is not Authenticode.
- Stable release assets comprise installer, updater signature, `latest.json`, SHA-256 list and license. The public updater points to the stable signed installer; checking availability does not install it automatically. [Stable release](https://github.com/SCamposs/sonariel/releases/tag/v0.4.0), [English notes](releases/v0.4.0.md), [Portuguese notes](releases/v0.4.0.pt-BR.md).

The final stable installer was not rerun in the VM. Its installation evidence is the RC's actual VM exercise plus unchanged implementation and repeated stable packaging/contracts. The VM audible-output, uninstall, FX-in-guest and full-updater limits in the acceptance table remain explicit. Publication with these limits is the maintainer's accepted release decision; it does not claim every original acceptance scenario passed. No heavy generation, driver/RAM change, third musical loop round, host update or Unity change was performed.

Public verification completed on 2026-10-27: GitHub reports `v0.4.0` as latest, not draft/prerelease; the actual public `releases/latest/download/latest.json` returns `0.4.0`. Downloaded installer bytes match the SHA-256 above; public signature matches the manifest/local signed asset and verifies against the existing public key. The public updater notes include the accepted caveat. This confirms update availability, not execution of an installed client's update/restart cycle. Publication hygiene checked 544 reachable blobs and 238 working files with no configured-pattern findings; historical author emails remain as previously authorized. All 163 checked local Markdown links resolved.

Published phase commits: `65b0780` (RC implementation and loop gate), `7283643` (actual Windows installation evidence), `196642f` (owner-accepted phase closure/caveats), and `6fd9712` (stable version, notes, guides and signed-release source). Tag `v0.4.0` points to `6fd9712`; the final publication verification is recorded afterward in this report without replacing release binaries.
