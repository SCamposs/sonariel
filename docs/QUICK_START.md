# Quick start

[English overview](../README.md) · [Visão geral em português](../README.pt-BR.md) · [Documentation index](README.md)

This guide follows the distributed Windows x64 application, currently v0.5.0. Choose English or Brazilian Portuguese at first use or in Settings; the examples below retain the Portuguese labels. No command-line development tools are needed to use the installer.

## Installation and updates

Download `Sonariel_<version>_x64-setup.exe` from the [official releases](https://github.com/SCamposs/sonariel/releases/latest) and install it. WebView2 is required; the installer offers its bootstrap component. Bootstrapping on a machine with no existing WebView2 is not part of the documented clean-machine validation.

The installer has no Windows Authenticode publisher signature. Windows may display an unknown-publisher warning; assess the source before running any installer. This guide does not ask you to disable Windows protections. Updater packages have a separate cryptographic signature tied to the version, which does not establish Windows publisher identity.

Click the version number in the sidebar for **Versão & atualizações**. Checks run at startup and hourly by default. Choose **Somente quando eu solicitar** to disable automatic checks, or **Verificar agora** for a manual check. **Atualizar e reiniciar** starts installation only after your confirmation. Finish the queue/setup and close Sonariel MCP connections first; data lives outside the installation directory. Version 0.1 needs a manual 0.2-or-later installation to acquire the updater.

## 1. Choose a workflow and prepare its engine

| UI section | What to do |
| --- | --- |
| **Ambiente** | Review installation plans, authorize downloads, or inspect/link a compatible music environment. |
| **Voice Studio** | Review the V3 CPU voice setup or link an existing compatible voice environment. |
| **FX & processamento** | Import/select a WAV and use the bundled native DSP without loading an AI model. |

Keep engine environments in dedicated folders outside Git. Use the folder/file buttons beside path fields or paste an absolute local path. Selection alone does not install anything. Review the displayed plan and destination before authorizing a setup.

An arbitrary existing ACE-Step, Python, or Chatterbox installation is not automatically compatible: Sonariel checks its pinned recipe, versions, and model files. Linking is inspection, not reinstallation. Engine dependencies and weights are prepared separately; the app does not synchronize upstream CUDA dependencies or change graphics drivers. [Setup internals](SETUP.md).

Stable Audio requires individual acceptance of Stability Community and Gemma terms. The maintainer's test acceptance does not authorize your use, replace commercial registration where applicable, or grant rights in an input recording. See [engine capabilities and terms](ENGINES.md).

## 2. Connect an agent

For the validated Codex path:

1. Open **Audacity & Codex**.
2. Choose **Configurar conexão Codex**. The action backs up Codex configuration, preserves other servers, and refuses a conflicting Sonariel entry rather than overwriting it silently.
3. Reload/restart the Codex MCP connection to discover the tools. Ask the agent to inspect the Sonariel environment and project list before generating.

Registration, a protocol handshake, and the tools actually loaded in a conversation are different states. After upgrading, reload the connection to discover added contracts. The server is designed for MCP interoperability; other agent clients are not validated just because they support MCP. [Manual configuration and contracts](CODEX.md).

The agent's language model is separate from Sonariel. It may be remote. Do not share private prompts, names, references, or files with the agent unless that is appropriate for your provider and workflow.

## 3. Create/select a project

In **Projetos & sessões**, create a project and optionally a session. Save the purpose, constraints, and production notes you want the agent to consult. Check **PROJETO ATIVO** before submitting a task. Sonariel does not turn your entire conversation into saved project context automatically.

To use an existing sound, open **Biblioteca & versões → Registrar arquivo** and choose whether it is a result or reference. Registering a path catalogs the existing file; it is not a copy or permission to redistribute it.

## 4. Request one short generation

Use a compatible installed engine with enough available RAM. An ACE-Step example:

> Inspect Sonariel's environment and selected project. If the linked Turbo CPU environment is compatible, submit one original 15-second instrumental synthesizer study, seed 4137, 72 BPM, D minor, 4/4, batch_size=1, text2music. Use no reference/source audio. Keep DiT-only, LM planning/autofill disabled, and Flash Attention disabled. Use a stable request_key, submit once, and return the job_id. Do not change the setup or edit anything in Audacity.

This is an example to run deliberately, not a task the README submits. For Stable Audio, use `music_generate` with an explicit engine ID, duration, seed, and mode. For voice, use `voice_generate` with exact text, language, seed, and an optional authorized profile. [Supported contracts](ENGINES.md).

Watch **Fila de geração**. Stages and RAM readings come from the core; they are not fixed generation ETAs. A task can wait for memory. ACE-Step's 12 GiB cold-start gate is not a promise that the complete render will fit; local runs have exceeded 14 GiB process RAM. Close unnecessary applications yourself if you need headroom. Never submit duplicate tasks merely because loading is slow. Only tasks not yet sent can be cancelled; active inference is not safely cancellable through this profile.

## 5. Listen, compare, process, export

- In **Biblioteca & versões**, play a result, inspect its parameters, and choose two versions for comparison. Mark a favorite or selection only after listening.
- In **FX & processamento**, choose a WAV, add/reorder effects, and adjust settings. Editing a slider does not render automatically. Request **Renderizar prévia (até 10 s)** first, then **Renderizar versão completa** when ready. Tails can extend the resulting duration.
- Save presets as new revisions. Export a WAV to a new destination; core validation refuses overwriting an existing file even if a native save dialog lets you select it.
- **Armazenamento** inventories registered assets. Recoverable discard has a preview/confirmation step and retains physically moved files for 30 days. Expiry runs while the core is open and idle; older trash receives an upgrade grace period. Permanent deletion requires its own preview/confirmation and frees disk space. Imported originals stay unchanged unless you explicitly enable their physical move/deletion. [Storage guide](STORAGE.md).

You can start with an imported WAV and native FX instead of generation. This needs no music/voice weights, no agent request, and no Audacity connection.

## Optional: Audacity

Select the local Audacity executable in **Audacity & Codex**. In Audacity, enable `mod-script-pipe` and restart the editor yourself. Use Sonariel's read probe before a handoff. Do not assume a running Audacity process means the pipe is available.

Sonariel imports into a new identified project and verifies track/project identity before bounded edits or export. It does not provide arbitrary Audacity scripting. Do not use the bridge to edit an unrelated open project. Native FX and WAV export do not require Audacity.

## If something does not work

Check the engine's status and the real job error first. Avoid changing an environment or updating the app while it is busy. Preserve original files and parameters; an uncertain submission is not permission to generate again with a new key. For reported/known limits, see [recovery](RECOVERY.md), [validation](VALIDATION.md), and [contribution/reporting guidance](../CONTRIBUTING.md#report-a-problem).
