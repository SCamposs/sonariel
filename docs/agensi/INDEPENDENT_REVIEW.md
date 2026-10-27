# Independent skill review — 2026-10-27

**Result: PASSOU for the bounded Codex beginner workflow. Recommendation: ready for the owner's submission review.** Skill: Sonariel MCP Integration 1.0.0. Runtime: unchanged distributed Sonariel 0.4.0. No marketplace submission or app release was made.

| Check | Result | Observed evidence |
| --- | --- | --- |
| Initial test-environment setup | FALHOU, then corrected | Early sessions lacked usable file/tool permission configuration. Their traces are preserved and excluded from the accepted skill result; details below. |
| Normal skill loading | PASSOU | Fresh Codex CLI 0.153.4; native repo-scoped `.agents/skills` discovery; only this skill enabled. The agent automatically selected and read `SKILL.md`, `references/setup.md` and `references/mcp-workflow.md`. |
| Beginner workflow without developer coaching | PASSOU | One natural Portuguese request supplied a synthetic WAV, project/session names, -3 dB preview, organization and output folder. No tool names, recipe, expected answer or development history were supplied. No follow-up instructions were sent to the accepted session. |
| Real agent operations | PASSOU | The agent made 14 MCP calls across 13 tools: discovery, project/session creation/selection, WAV import, tags, one FX submission, job inspection, batch export and filtered results. It also made four successful shell calls to read skill files and check files/hashes. |
| Independent artifact checks | PASSOU | 27 read-only assertions verified source bytes, project/session, tags, one completed native job, its persisted request key, source lineage, -3 dB samples, export hashes, manifest privacy, final answer and negative selection cases. |
| Unrelated requests | PASSOU | Separate fresh sessions answered a writing request and an audio-concept question with zero skill-file reads or MCP tool calls. No Sonariel job was created by either. |
| Corrected troubleshooting guidance | PASSOU | Another fresh session read the final troubleshooting reference and explained the previously observed client-policy error without MCP calls, configuration edits or audio operations. This used the reported error as input; it was not a new live fault injection. |
| Constraints | PASSOU for observed behavior | No model inference, installation, download, external terms, destructive action or artistic preference assignment. Native preview only. |
| Claude Code workflow | NÃO TESTADO | `claude auth status` reported no active authentication. No login, account or credential setup was attempted. Its earlier handshake remains transport evidence only. |
| Agensi live delivery, heavy engines, active cancellation, fault-injected recovery | NÃO TESTADO in this review | No live listing exists. This acceptance does not expand coverage to those workflows or all possible agent decisions. |

## Isolation and unsuccessful attempts

The evaluated conversations were new `codex exec --ephemeral` sessions, without resume/fork or this conversation's history. User configuration/instructions/plugins and other skills were excluded for the run; existing CLI authentication was reused without copying credentials. Each case had its own workspace and `SONARIEL_HOME`. The core came from the public installer payload, SHA-256 `aaadc69e524bb1782b68ea2e462abbc3591938fe10dae2ed0da97b225792a2bc`. Production app/profile/configuration and functional source were not changed.

Two initial attempts did not establish skill acceptance: one was blocked by client tool/file approval policy; another completed a workflow from MCP schemas while its skill file remained unreadable. Both are retained privately and **not counted as skill execution**. The latter transparently mentioned its unread guide during execution. The accepted fresh run explicitly selected the already-prepared Windows `elevated` sandbox and session-only preauthorization for the requested lightweight MCP operations; other actions retained approval requirements. No security setting was changed globally and no new Windows sandbox installation was performed. A nonblocking PowerShell shell-snapshot warning remained; accepted file reads and hash commands exited successfully.

Preparation scripts copied the skill unchanged and created the synthetic input/folders. They did not provide a solution or run the accepted session's production operations. A separate read-only catalog query confirmed native skill discovery. Verification scripts subsequently read JSONL evidence, SQLite and WAV/export bytes; they did not generate the accepted preview, import/tag assets, export files or replay its request. The unique request key appeared in the agent's submission event and matched the sole persisted job; no lost-response fault was injected in this round.

## Measured result and corrections

The agent preserved the 12-second stereo/24 kHz PCM source and created one 10-second stereo native preview. Its samples matched source × `10^(-3/20)` with maximum error `6.617174169720741e-09`. Source SHA-256: `6636316a94d76259784aee49866ed6126078cb70a1db5e559e1dc052991b212f`; preview: `342010250dbc76b041bab7639ba0d387659511dbfb1e91cc8f45ec5a2bbcfcb7`. Both exported WAVs matched their registered hashes. The final answer correctly described the duration limit, filenames, IDs and lack of a preferred version. No follow-up clarification was needed because the request supplied the necessary paths and authorization.

The entrypoint and the two workflow references actually used passed unchanged. Only compatibility evidence and troubleshooting guidance for client-policy/unread-skill failures were refined in the payload. Supporting reports/listing were updated and the final ZIP rebuilt/audited; see [PACKAGE_AUDIT.md](PACKAGE_AUDIT.md). This is one positive workflow and two negative-routing examples, not a statistical benchmark or independent human usability study. Detailed traces, IDs, paths and fixtures stay private.

## Manual next step

Review the definitive [ZIP audit](PACKAGE_AUDIT.md) and [listing/manual submission steps](LISTING.md#manual-submission-after-owner-approval), then choose whether to submit the free listing. The app and models remain separate installations. After Agensi approval, validate its actual entrypoint/reference delivery as a new test; it is not claimed here.
