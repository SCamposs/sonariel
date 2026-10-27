# Agent compatibility

Scope: local Windows x64 with Sonariel **0.4.0**, reviewed 2026-10-27. The server uses stdio; its loopback authenticated RPC is not a public HTTP MCP transport. Agensi's remote MCP only delivers the skill. Supporting MCP in principle does not establish this integration's behavior.

| Client/path | Status | Evidence and limit |
| --- | --- | --- |
| Codex on local Windows | TESTED / TESTADO | Codex 0.153.4 app-server connected to the isolated distributed core, identified 0.4.0 and discovered 58 tools. The authoring Codex executed the skill's lightweight workflows through a separate stdio test driver. Marketplace delivery is not yet tested/published. |
| Claude Code 2.1.76 on local Windows | IMPLEMENTED, NOT VALIDATED / IMPLEMENTADO, NÃO VALIDADO | `claude mcp list` connected successfully with isolated configuration. This proves the transport health check only; skill loading, tool execution and a complete workflow were not validated in Claude. |
| Cursor desktop on local Windows | IMPLEMENTED, NOT VALIDATED / IMPLEMENTADO, NÃO VALIDADO | Documented local MCP configuration; no end-to-end Sonariel workflow claimed. |
| GitHub Copilot agent in local VS Code | IMPLEMENTED, NOT VALIDATED / IMPLEMENTADO, NÃO VALIDADO | Documented local MCP configuration; requires enabled agent/MCP features and applicable organization policy. |
| Other local MCP agents | IMPLEMENTED, NOT VALIDATED / IMPLEMENTADO, NÃO VALIDADO | Sonariel's protocol is generic; client-specific configuration and behavior still need verification. |
| Web-only or remote agents without access to this Windows runtime | NOT SUPPORTED / NÃO SUPORTADO | No local process bridge is provided; loading Agensi does not grant access to the user's PC. |
| Sonariel runtime on macOS/Linux, GPU execution or packaged loop creation | NOT SUPPORTED / NÃO SUPORTADO | Outside this distributed profile. A compatible agent on those systems does not make the Sonariel executable compatible. |

"Implemented" here means an available stdio/configuration path, not a new Sonariel adapter or vendor certification. See the [Phase 3 report](https://github.com/SCamposs/sonariel/blob/main/docs/PHASE3.md) for exact tested clients, versions and coverage.

## Configuration shapes for other clients

These are manual examples for a user who explicitly requests setup. Replace placeholders, preserve existing entries and review trust prompts yourself. Do not install clients, enable servers globally or edit their settings merely to load the skill. Keep private paths/configs out of source control.

Claude Code `.mcp.json` (project scope) and Cursor `.cursor/mcp.json` use `mcpServers`:

```json
{
  "mcpServers": {
    "sonariel": {
      "type": "stdio",
      "command": "<SONARIEL_INSTALL_DIR>/runtime/sonariel-core.exe",
      "args": ["mcp"]
    }
  }
}
```

Copilot in VS Code `.vscode/mcp.json` uses `servers`, not `mcpServers`:

```json
{
  "servers": {
    "sonariel": {
      "type": "stdio",
      "command": "<SONARIEL_INSTALL_DIR>/runtime/sonariel-core.exe",
      "args": ["mcp"]
    }
  }
}
```

Use the client UI to review/enable the server and discover its tools. Claude project trust and server approval depend on its version; `claude mcp list` can report pending approval. VS Code provides **MCP: List Servers** and **MCP: Reset Cached Tools**; workspace trust and organization policy can block startup. Do not disable those controls. In remote workspaces the command must execute where the Windows runtime actually exists; do not expose Sonariel on a network to work around that boundary.

Official contracts consulted: [Codex MCP](https://developers.openai.com/codex/mcp), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Cursor MCP](https://cursor.com/docs/mcp), [VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers). Versions and vendor behavior can change; inspect the installed client's documentation when troubleshooting.
