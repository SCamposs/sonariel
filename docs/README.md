# Documentation

[English overview](../README.md) · [Português (Brasil)](../README.pt-BR.md)

Current distributed release: [v0.3.2](https://github.com/SCamposs/sonariel/releases/tag/v0.3.2). The desktop UI remains in Brazilian Portuguese. The two top-level READMEs describe the same capabilities; not every supporting document has been translated.

Source builds on main now include EN/pt-BR UI and the Phase 2 production tools. They have not been published as a release. [Phase 2: evidence, screenshots, limitations and isolated preview](PHASE2.md).

## Start here

| Document | Purpose | Language |
| --- | --- | --- |
| [Quick start](QUICK_START.md) | Install, prepare an engine, connect an agent, listen/process/export | English, with exact Portuguese UI labels |
| [Engine guide](ENGINES.md) | Implemented modes, CPU/RAM thresholds, experimental features, model terms | English |
| [Architecture](ARCHITECTURE.md) | Desktop/MCP shared core, queue, storage and process boundaries | English |
| [Codex/MCP](CODEX.md) | Registration, stdio contracts, source/reference roles | English |
| [Setup](SETUP.md) | Pinned isolated CPU installation and existing-environment inspection | English |
| [Storage](STORAGE.md) | Protected inventory, recoverable discard and migration backup | Português |
| [Stable Audio source input](STABLE_AUDIO_INPUT.md) | Encoder/resampler preparation, source-mode contract and live evidence | Português |
| [Recovery](RECOVERY.md) | Memory pressure, jobs, updates and recovery constraints | English |
| [Contributing](../CONTRIBUTING.md) | Development, tests, issue reports and privacy | English |
| [Screenshots and recording proposal](SHOWCASE.md) | Real capture provenance and a future demonstration plan | English |

## Release history and validation

- [Changelog](../CHANGELOG.md) and [release notes](releases/v0.3.2.md) (current release notes in Portuguese).
- [Validation record](VALIDATION.md): automated checks, real integrations, historical observations, and remaining limits. Test counts are tied to their release, not a guarantee about every machine.
- [Expansion report](EXPANSION.md): historical v0.3.0 implementation/evidence. Its text-only Stable Audio limit and 16 GiB Turbo gate were superseded by v0.3.1/v0.3.2, respectively.
- [Releasing](RELEASING.md): maintainer signing/publication procedure (Portuguese). This is not an installation guide.

## What is intentionally not claimed

No validated GPU profile, macOS/Linux installer, active-inference cancellation, operational SFT adapter, universally proven voice identity, or tested compatibility with every MCP client. Codex was exercised; MCP protocol interoperability is not equivalent to a tested client integration.

The app license is [Sonariel Source Available License 1.0](../LICENSE), not OSI-approved open source. Read the [third-party notices](../THIRD_PARTY_NOTICES.md) separately. No production audio, references, weights or private presets are included here.
