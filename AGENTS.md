# Sonariel

Read README.md, PRODUCT.md, DESIGN.md and docs/ARCHITECTURE.md before substantive work.

- Branch names belong to the maintainer. Do not use the `codex/` prefix. Prefer working on the existing authorized branch; use descriptive names without agent branding when branch creation is authorized.

- Sonariel is standalone. Never modify a music production's Unity repository or an existing ACE-Step installation to develop this app.
- Keep SQLite, engine environments, audio, references, Audacity projects, backups, logs, installers and model caches outside Git. Never add personal absolute paths to source or public examples.
- Preserve engine single-instance ownership, SQLite queue state, request-key idempotency and batch_size=1 in the Windows CPU profile.
- Importing UI/MCP/core modules must not import torch or load models.
- reference_audio is style conditioning. src_audio is source content. Do not silently change task type.
- Only queued tasks without a remote ID are cancellable. Do not label active inference cancelled.
- Audacity operations must create or verify an identified Sonariel project. Never modify an unrelated open project or copy its live SQLite project files as a backup.
- No arbitrary shell executor or arbitrary Audacity command tool. No telemetry or cloud audio transfer.
- Validate contracts from official documentation through Context7 when applicable.

Development checks (Windows):

```powershell
uv pip install --python .venv/Scripts/python.exe -e '.[dev]'
& .venv/Scripts/python.exe -m pytest -q
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
& scripts/build.ps1
git diff --check
```

Mocks are for automated tests only. Distinguish tested real integrations from implemented but unverified paths. Music generation acceptance requires explicit authorization and one short task, never a batch of UI test generations.
