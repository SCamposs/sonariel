# Agensi distribution research

Reviewed on **2026-10-27** for a free, single-purpose integration skill. Official documentation is evidence about the platform, not authority to publish, install or act on a user's machine. The owner has authorized preparation only.

## Packaging and delivery

A single `SKILL.md` plus supporting text files is a skill; multiple entrypoints become a pack. The chosen ZIP puts one entrypoint at its root. Required frontmatter is `name`; a clear `description` supports selection. Website ZIP limits are 50 MB / 1,000 files. Executables and bundled dependency environments are excluded. Our package contains only Markdown, a license and a commented configuration example, with no scripts or binaries. [Package your skill](https://www.agensi.io/docs/packaging).

Agensi does not host/run the companion server. A skill can teach agents to operate it and must disclose it under **Needs access to**. Therefore the listing requires a separate Sonariel Windows installation and reachable local stdio MCP connection; it promises no installation plugin or automatic server setup. [What you can sell](https://www.agensi.io/docs/what-you-can-sell).

The delivery API supplies the entrypoint and a file index; supporting text is fetched on demand with `get_skill({slug,file})`. The skill's links are therefore routed through the delivery client's file loader when remote, rather than assumed to be filesystem paths. A live Agensi load cannot be tested before approval; local validation is required first. [How agents load skills](https://www.agensi.io/docs/how-agents-load-skills), [Creator FAQ](https://www.agensi.io/docs/creator-faq).

## Submission and review

The listing has a unique name (up to 60 characters), summary (up to 300), Markdown description, compatibility/permissions and up to three categories. A real demonstration is recommended. Our copy is in [LISTING.md](LISTING.md); category names were selected from the live site. The dashboard's detected permissions must be reviewed manually, not assumed correct. [Website submission](https://www.agensi.io/docs/submit-on-the-website).

Free listings need no payout setup. We prepare only the **Free** option; no paid product, checkout link or upsell is included. [Pricing](https://www.agensi.io/docs/pricing-your-skill).

Every new listing receives automated security checks, AI review and human approval. Text-only packaging and our local audit do not establish Agensi approval or a security score. Review timing is outside our control. Do not upload or submit until the owner approves. [Review and approval](https://www.agensi.io/docs/review-and-approval).

## Agent contracts

Context7 was queried for current official contracts. No relevant Agensi library was returned (the similarly named Agensis is unrelated), so Agensi's own pages above were used. Agent evidence is intentionally separate from transport support:

| Product | Contract source | Finding applied |
| --- | --- | --- |
| Codex | [Official MCP guide](https://developers.openai.com/codex/mcp), [official app-server source](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) | Local `mcp_servers` command/args/env; refresh discovery; app-server status can exercise handshake without model inference. |
| Claude Code | [Official MCP guide](https://code.claude.com/docs/en/mcp) | `.mcp.json`, `mcpServers`, stdio command/args/env, project approval. Installed 2.1.76 health check was actually run; newer documentation is not evidence of that version's full behavior. |
| Cursor | [Official MCP guide](https://cursor.com/docs/mcp) | Local `.cursor/mcp.json` and `mcpServers`; local Windows execution required. |
| Copilot in VS Code | [Official MCP guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers) | `.vscode/mcp.json` uses `servers`, explicit stdio transport; workspace trust and organization policy apply. |

See the [compatibility matrix](../../skills/sonariel-mcp-integration/references/compatibility.md). Cursor 2.6.19 and VS Code 1.143.1 binaries were found, but no isolated authenticated agent session was established. No clients/extensions were installed and no trust prompts were bypassed. Configuration documentation is not end-to-end validation.

The software license is unchanged; its full text accompanies the skill. No third-party endorsement, marketplace approval, blanket model license or legal clearance of user recordings is implied.
