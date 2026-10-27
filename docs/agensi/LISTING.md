# Agensi listing — owner review copy

Status: prepared, **not submitted**. Package version: **1.0.0**. Target: **Sonariel 0.4.0**. Pricing: **Free**.

## Name

Sonariel MCP Integration

## Short summary

Connect your agent to Sonariel's local audio workflow on Windows. Organize WAVs, create non-destructive FX previews, export verified versions, and submit requested music or voice jobs with clear capability checks and safe recovery.

## Detailed description

Turn an audio request into a traceable local workflow with Sonariel and your connected agent.

Sonariel MCP Integration helps the agent check the connection, identify the right project and session, discover usable engines, and choose an operation that matches your request. It explains the difference between an available engine and a configured one, between a style reference and source-audio transformation, and between valid audio and a result you actually like.

You can start without a model download: import a WAV you are allowed to use, make a native FX preview, compare the original and derived version, and export verified copies. When you choose music or speech generation, the skill guides the agent through the installed engine's parameters and persistent queue. If a response is lost, it recovers the original operation instead of creating another job.

**This is a workflow skill, not an application installer.** Sonariel is a free, separately installed Windows desktop application. You must configure its local MCP connection in your agent. Agensi supplies the skill instructions; it does not install or run the companion server. Audio models are prepared separately and have their own hardware needs and terms.

Sonariel audio generation and processing run locally. Your agent's model can still be a remote service. The skill does not upload your recordings, publish projects or accept external licenses for you.

## Features

- Connection and capability checks before choosing tools.
- Project/session selection, WAV registration, tags and combined library filters.
- Non-destructive native FX previews, source lineage and version comparison guidance.
- Individual and batch WAV exports with collision handling and integrity checks.
- Explicit music/voice request preparation and persistent job monitoring.
- Music preset review, style/source distinctions and non-destructive reference regions.
- Request-key recovery after uncertain submissions, plus actionable setup/error guidance.
- Optional identified-project Audacity handoff when you request editing.

## Requirements / Needs access to

- **Sonariel MCP**, from the separately installed [Sonariel v0.4.0 Windows x64 app](https://github.com/SCamposs/sonariel/releases/tag/v0.4.0).
- A local compatible agent able to launch the installed stdio server and access the local files you select.
- A local WAV and an existing local output folder for the no-model example.
- At least 3 GiB available RAM for native FX; model workflows have higher, engine-specific gates. These are starting thresholds, not peak-memory guarantees.
- Separately prepared engines/models for music or speech, explicit authorization for setup and any required external terms. Audacity is optional for its bridge.

Permission disclosure: read chosen project/audio metadata; write requested Sonariel project state and new derived/export files; enqueue only requested jobs. Setup downloads require separate consent. Agensi needs network access for skill delivery; the Sonariel stdio connection is local. No general shell executor, cloud generation service or automatic global agent configuration is provided.

## Compatibility note

Windows x64, Sonariel 0.4.0, local stdio MCP. Codex connection/discovery and real lightweight workflows were tested. Claude Code transport health check connected; its full workflow is not validated. Cursor and GitHub Copilot in VS Code have documented configurations but were not tested end to end. Remote/web-only clients without a local Windows bridge are not supported by this skill. No vendor certification is claimed.

## Use cases

- A first safe Sonariel workflow without installing an AI model.
- Comparing an imported recording with an effects preview while keeping the original.
- Organizing local music or voice candidates into projects and sessions.
- Preparing an explicitly requested engine job and following its real state.
- Exporting chosen WAV versions without exposing private prompts or source paths.

## See it in action

This demonstration used the actual runtime extracted from the public Sonariel 0.4.0 installer, with an isolated empty profile and synthetic audio. It did not use a music or voice model.

**Request:** “Create an Audio Workshop project and a First pass session. Import this synthetic WAV, tag it demo and source, make one -3 dB native FX preview, and export the original and preview to my chosen local folder. Preserve the original and omit prompts and reference recordings. Do not generate music or speech.”

**Result:** The 12-second stereo WAV was registered at 24 kHz, with its original SHA-256 recorded. The agent applied project/session and tag filters, then submitted one native FX job. The preview completed as a new 10-second stereo WAV at the same sample rate, retaining the original as its parent. Its samples matched the expected -3 dB gain within floating-point tolerance. The original file's hash remained unchanged. Both batch-exported WAVs matched their recorded hashes, and the portable manifest omitted private paths and prompts. Repeating the exact FX request with its original request key returned the same job; no second render was created. Restarting the isolated core preserved the project, session, filters, assets and completed job. No artistic preference was assigned: listening and selection remain the user's decision.

## Limitations

- Packaged Sonariel 0.4.0 does **not** offer loop creation or an approved perfect-loop workflow.
- Windows x64 CPU profile, one task at a time; no supported GPU/SFT generation or active-inference cancellation through these adapters.
- Stable Audio and multilingual voice paths are experimental. Model names do not guarantee output quality, pronunciation, identity consistency or exact musical metadata.
- Heavy music/voice inference was not rerun to validate this skill. Earlier engine evidence is separate from this lightweight demonstration.
- Export is WAV; this skill does not add MP3 encoding, permanent deletion or a new engine capability.
- Audio/reference rights and external model terms remain the user's responsibility. Free Sonariel use does not grant rights in third-party recordings.
- The full historical v0.3.2 → v0.4.0 installer/updater cycle remains an accepted, documented application-validation caveat.

## FAQ

**Does this include Sonariel or its models?** No. Install Sonariel separately, connect its local MCP server, and prepare any desired models separately. Native FX does not need model weights.

**Do I need to understand MCP first?** No. The setup guide explains the connection and prioritizes Sonariel's built-in Codex setup action. The agent checks whether the tools are actually reachable before doing work.

**Will it generate or download something as soon as I load it?** No. Discovery is read-only; generation must match your request, and installation/downloads and external terms need explicit authorization.

**Can I use it with an agent other than Codex?** The server uses standard local stdio MCP. Other clients have different configuration and trust rules. See the compatibility note for what was actually tested; generic MCP support is not a completed integration test.

**Can it recreate the style of a reference?** It explains the installed engine's real controls. ACE style conditioning and source-driven cover/Stable audio2audio are different operations. It does not guarantee a similarity percentage or assume permission to use someone else's recording.

**Is my audio sent to Agensi?** The workflow does not send audio to Agensi. Agensi delivers the skill text; Sonariel processes locally. Review the connected agent's separate data policy and avoid sharing unnecessary private project information.

**Can I use Sonariel for paid creative work?** Sonariel's license permits using it as a tool in commercial creative production. Model terms and rights in inputs/outputs remain separate. Selling the software or paid access to operate it is restricted by its existing license.

## Categories and tags

Primary category: **Agents & Orchestration**. Additional categories: **Workflow Automation**, **Game Development**.

Tags: Sonariel, MCP, local audio, Windows, native DSP, music workflow, voice workflow, non-destructive editing, audio export.

Documentation link: https://github.com/SCamposs/sonariel/blob/main/skills/sonariel-mcp-integration/README.md

## Manual submission after owner approval

1. Review the final ZIP hash and [audit](PACKAGE_AUDIT.md), this copy and the [validation report](../PHASE3.md).
2. Sign in to [Agensi's submission dashboard](https://www.agensi.io/dashboard/submit). Upload the reviewed ZIP; do not upload an app installer, model or test audio.
3. Set the display name above and choose **Free**. Confirm name availability; the local preparation does not reserve it. Use the summary, description, actual demonstration, requirements, FAQ and limitations above.
4. Set **Needs access to: Sonariel MCP**, review detected permissions and select the categories. An optional logo/screenshot must contain only public/generic content; no such media is required for this text package.
5. Check desktop/mobile listing previews. Submit only after you approve the complete listing and any platform terms shown in your account. This delivery has not accepted those terms on your behalf.
6. Wait for the platform's review. After it is live, test loading the published skill and an auxiliary reference through Agensi, then one authorized lightweight workflow. Record that as new marketplace-delivery evidence, not as a test already completed here.
