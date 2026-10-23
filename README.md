# Sonariel

Desktop workspace for a local music workflow directed from Codex. Built with Tauri 2, React and TypeScript, with a lightweight Python orchestration core. Interface in Brazilian Portuguese.

Sonariel manages projects, sessions, a persistent generation queue, candidates, playback, comparisons, decisions, a reproducible Windows CPU engine setup and bounded Audacity handoffs. Musical prompts are read-only in the app; creative direction stays in Codex.

## Running

The Windows installer bundles the desktop app and lightweight Python core. End users do not need Node, Rust or a Python development installation. WebView2 is a Windows desktop prerequisite handled by the Tauri installer bootstrapper when needed.

Open **Ambiente** and either link a compatible existing engine or review and authorize a new isolated installation. Linking does not reinstall packages or alter engine configuration. Setup uses the versioned recipe in `core/sonariel/recipes`, never an unqualified latest installation.

Data defaults to `%USERPROFILE%\.sonariel`. `SONARIEL_HOME` may select a separate data directory. Audio, model caches and engine environments stay outside the source checkout. The app and MCP connect to one shared core and SQLite database. Opening the UI or MCP does not load ACE-Step.

## Codex

In **Audacity & Codex**, choose **Configurar conexão Codex**. The operation backs up the existing config, adds only the Sonariel MCP entry and installs the workflow skill. Reload the Codex client afterwards. A saved configuration is not proof of a client handshake; the interface reports these separately.

Tools include environment and project context inspection, reference registration, asynchronous generation, queue/result queries, favorites/selection/notes, and identified Audacity import/export. See [MCP integration](docs/CODEX.md).

## Development

Requires Node 22.12+, Rust/MSVC build tools and Python 3.12. These are development dependencies, not user engine prerequisites.

```powershell
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe -e '.[dev]'
npm.cmd ci
& .venv/Scripts/python.exe -m pytest -q
npm.cmd run typecheck
npm.cmd test
npm.cmd run dev
```

`npm run dev` is a local verification surface with a development-only bridge. The delivered product is the Tauri desktop app. Build it with `scripts/build.ps1`; it packages the core before building the Windows NSIS installer. Outputs are ignored under `build/` and `src-tauri/target/release/bundle/nsis/`.

## Documentation

- [Architecture and process boundaries](docs/ARCHITECTURE.md)
- [Application-owned interaction components](src/ui/README.md)
- [Setup and integrity](docs/SETUP.md)
- [Codex and MCP](docs/CODEX.md)
- [Recovery and limitations](docs/RECOVERY.md)
- [Validation receipt](docs/VALIDATION.md)
- [Third-party licenses and sources](THIRD_PARTY_NOTICES.md)

Only the Windows x64 CPU / DiT-only profile is implemented. GPU detection does not imply accelerated inference support. The first engine recipe is ACE-Step Turbo at a fixed commit, Python 3.12.10 and PyTorch 2.7.1 CPU. One generation runs at a time. See the validation receipt for actual measured coverage and outstanding limitations.
