# Contributing to Sonariel

Thanks for helping improve a reproducible local audio workflow. Read [AGENTS.md](AGENTS.md), [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), and the [architecture](docs/ARCHITECTURE.md) before a substantive change. Documentation and reproducible issue reports are useful contributions too.

## License and scope

The code and documentation use the [Sonariel Source Available License 1.0](LICENSE), not an OSI-approved open-source license. Study, modification, and free redistribution are allowed under its conditions; selling Sonariel/derivatives or paid access to operate it requires separate permission. Do not remove the notices or relicense third-party components. Contributions must be material you have the right to submit under the project's terms; no separate CLA is introduced here.

Discuss significant engine, security-boundary, schema, or workflow changes in an [issue](https://github.com/SCamposs/sonariel/issues) first. Do not add cloud audio transfer, arbitrary command execution, silent regeneration, automatic destructive cleanup, or hidden source/task substitutions as convenience features.

## Windows development setup

End users need the installer, not this toolchain. For development, use Windows x64, Node.js 22.12+, Rust **1.90+** with MSVC/C++ build tools, WebView2, Python 3.12, and `uv`. The dialog plugin sets the Rust minimum; the separately installed generative runtimes can use different pinned Python versions.

```powershell
git clone https://github.com/SCamposs/sonariel.git
cd sonariel
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe -e '.[dev]'
npm.cmd ci

# Choose a fresh development profile outside the checkout before starting the core/UI.
$env:SONARIEL_HOME = Join-Path $env:TEMP 'sonariel-dev-profile'
npm.cmd run dev
```

`npm run dev` is a loopback browser verification surface, not the distributed desktop. Native window/file dialogs are disabled there. `SONARIEL_HOME` isolates core data, not necessarily all WebView-local preferences. Do not connect a production agent or point development tools at a production audio profile by accident.

## Checks

Run the checks appropriate to the change:

```powershell
& .venv/Scripts/python.exe -m pytest -q
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
cargo test --locked --manifest-path native/fx/Cargo.toml
git diff --check
```

These commands do not authorize loading AI models or modifying a production project. Tests with mocks are not live engine validation. Native DSP tests do not prove a voice/music engine works. A full desktop build is separate:

```powershell
& scripts/build.ps1
& scripts/run-preview.ps1
```

The build prepares an unsigned-for-updater development installer; the preview launcher copies an executable/runtime into a separate application/profile and does not install it. Check its selected paths before running. Do not create, replace, or publish signing keys/releases as a routine contributor test. [Maintainer release procedure](docs/RELEASING.md).

## Module map

- `src/`: React workspace; `src/ui/` owns behavior adapters and visual contracts.
- `src-tauri/`: narrow desktop IPC, window lifecycle, updater, and native dialogs.
- `core/sonariel/`: lightweight RPC/MCP core, SQLite state, queue, setup, adapters and storage safeguards.
- `core/sonariel/recipes/`: pinned setup specifications and workers that run only in engine environments.
- `native/fx/`: deterministic Rust/C++ DSP, independent of AI runtimes.
- `tests/`: core contract/regression tests; UI tests live beside the UI source.
- `docs/`: current guides and explicitly dated validation/release history.

## Report a problem

Use [GitHub Issues](https://github.com/SCamposs/sonariel/issues). Include the app version, Windows version, selected engine/mode, reproduction steps, expected/actual result, exact error, and relevant available-RAM figures. Say whether this was an installer, preview, or browser-development run. For a queue failure, state whether it was queued, submitted, generating, or interrupted; do not rerun an uncertain job just to obtain a nicer report.

Review logs/screenshots before attaching them. Remove bearer tokens, usernames, personal paths, private prompts, voice references, proprietary audio, and database contents. Do not upload copyrighted recordings or anyone's voice without permission. A small original/synthetic reproduction is preferable. Never paste a private updater key or a full MCP/client configuration containing credentials.

## Submit a change

Keep changes small and scoped, explain the behavior/limitations, and include proportional tests/documentation. Use English Conventional Commit messages, for example `docs(readme): clarify engine requirements`. Open a pull request for external contributions; the maintainer decides how and when to integrate it. Do not rewrite published history or include unrelated local changes.

Before committing, inspect `git diff`, `git diff --check`, and the explicit staged-file list. **Never commit** generated audio, model weights, engine environments, SQLite/WAL files, logs, private presets, reference recordings, installers, caches, `.env` files, or signing material. Keep new engine installs outside Git even when ignore rules would hide them.

For docs, check relative links/anchors, image alt text, real UI labels, English/Portuguese parity, and current release/recipe versions. Real screenshots must use safe isolated demonstration data and clearly distinguish imports/DSP from AI generation. Do not relabel mocks, a successful build, or a protocol handshake as a working production integration.
