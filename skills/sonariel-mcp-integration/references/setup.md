# Connect Sonariel

## For someone new to MCP

MCP is the connection that lets your agent ask Sonariel to do work. There are two separate connections when using Agensi: Agensi provides these instructions; the **local Sonariel server** provides audio tools. Seeing this skill is not proof that the audio tools are connected.

1. Download the Windows x64 installer from the [official stable v0.4.0 release](https://github.com/SCamposs/sonariel/releases/tag/v0.4.0). Install and open Sonariel, choose your language and optionally follow its guide. End users do not need Node, Rust or development Python. WebView2 is required; the installer can offer its bootstrap. Windows may show an unknown-publisher warning: the updater signature is not Authenticode. Review the publisher/source yourself; the agent must not dismiss security prompts for you.
2. In **Audacity & Codex**, use the action to configure the Codex connection (`Configurar conexão Codex` in pt-BR). This existing app action backs up Codex's configuration, preserves other server entries and refuses a conflicting Sonariel entry. It can also install/update the bundled Sonariel skill. Do not replace a custom skill or resolve a configuration conflict automatically.
3. Reload the agent's MCP connections, or restart the client and open a fresh conversation if it cannot refresh them. A running old conversation may retain old tools. Sonariel registration and protocol testing are separate indicators.
4. Ask: "Check my Sonariel connection without generating anything." The agent should discover the tools and successfully query environment/engines/projects. A server initialized as `sonariel`, version `0.4.0`, with 58 tools and `loop_creation=false` is the tested baseline. Successful queries prove connectivity; an empty engine setup does not mean the connection failed.
5. Start by importing a short WAV and using native FX. For model generation later, open **Environment / Ambiente**, review the desired engine's plan and choose preparation or linking an existing compatible installation. Review the downloads, disk/RAM needs and external terms before approving them. Linking and reinstalling are different actions.

Sonariel defaults to a per-user data profile, separate from application code. `SONARIEL_HOME` selects another profile only when intentionally configured. Desktop and agent must use the **same chosen profile** to see the same projects. Never point a test client at production data or copy a live database to make a test fixture.

## Manual Codex configuration, only when requested

Prefer the app action. The [TOML template](../templates/codex-mcp.toml.example) is explanatory, not an installer. Replace the installation placeholder with the real local runtime path. The command is the installed `sonariel-core.exe`; its argument is `mcp`. Do not run a source checkout or use the loopback RPC address as an MCP HTTP endpoint.

Before changing configuration, show the exact server block and target to the user; preserve other entries, custom settings and backups. Do not change global agent configuration merely because this skill was loaded. The template's optional profile must match the intended desktop profile; normally omit it.

For Claude Code, Cursor or Copilot in VS Code, consult [compatibility](compatibility.md). Their configuration formats differ. A web-only/cloud agent cannot reach this local Windows stdio server without an additional integration; this skill does not provide one.

Official references: [Sonariel quick start](https://github.com/SCamposs/sonariel/blob/v0.4.0/docs/QUICK_START.md), [Sonariel Codex integration](https://github.com/SCamposs/sonariel/blob/v0.4.0/docs/CODEX.md), [Codex MCP](https://developers.openai.com/codex/mcp).
