# Codex integration

Use the app's integration action after installation. It backs up `config.toml`, preserves other servers and refuses a conflicting Sonariel entry. The registered command is the distributed `sonariel-core.exe` with argument `mcp`. Credentials are not read or modified.

Equivalent example, using a user-selected installation path:

```toml
[mcp_servers.sonariel]
command = 'D:\Applications\Sonariel\runtime\sonariel-core.exe'
args = ['mcp']
startup_timeout_sec = 30
```

Reload the Codex client to discover newly registered tools. A server protocol test is recorded separately from registration. A test client handshake does not imply that a preexisting Codex conversation has loaded the server.

The bundled skill is installed at `~/.agents/skills/sonariel/SKILL.md`. It describes the real tool sequence, CPU memory limits, request-key recovery and reference/source semantics. A different existing skill is preserved for review.

Recommended sequence: environment_status → projects_list → project_select → reference_register (if needed) → generate → job_get → result_feedback → audacity_import/export after an editing request. Tools are prefixed `sonariel_`. Complete schemas are returned by tools/list; unsupported fields/modes are rejected.

The UI has no competing creative chat or primary prompt editor. Prompt, model, seed, input roles and parameters remain visible in result details. Only explicitly saved musical context is persisted. Sonariel audio inference is local; the Codex model is a separate service.

Official contracts consulted:

- https://developers.openai.com/codex/mcp
- https://developers.openai.com/codex/skills
- https://manual.audacityteam.org/man/scripting.html
- https://v2.tauri.app/
