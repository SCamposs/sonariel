# Sonariel MCP Integration

Free integration skill, version **1.0.0**, for **Sonariel v0.4.0 on Windows x64**.

Sonariel organizes audio projects and runs local music, speech and native effects. This skill teaches a connected agent how to use that workflow safely. The app and optional audio models are installed separately. Agensi delivers the instructions; it does not run Sonariel on your computer.

Start with [setup](references/setup.md). If your agent is already connected, try:

> Help me use Sonariel for the first time. Check the connection and available engines. Do not download models or generate audio yet.

Then, with a short WAV you are allowed to use:

> Create a Sonariel project named Audio Workshop and a session named First pass. Import my chosen WAV, tag it demo, and make one native FX preview at -3 dB. Preserve the original. Export both versions into the empty local folder I selected, without prompts or reference recordings. Do not generate music or speech.

The agent needs the actual WAV path and export folder from you. No model is needed for this example; native FX requires 3 GiB of available RAM. Listen to the original and derived version in Sonariel before deciding which to keep.

- [Workflow and reproducible FX recipe](references/mcp-workflow.md)
- [Engines, modes and memory](references/engine-capabilities.md)
- [Safety and recovery](references/safety-and-recovery.md)
- [Troubleshooting](references/troubleshooting.md)
- [Agent compatibility and evidence](references/compatibility.md)
- [Manual Codex template](templates/codex-mcp.toml.example)

The skill and Sonariel documentation are covered by the included [Sonariel Source Available License 1.0](LICENSE). The software license is unchanged. This is not an OSI-approved open-source license. External model/input rights remain separate. No affiliation or certification by agent vendors is claimed.

Maintainer: [SCamposs/sonariel](https://github.com/SCamposs/sonariel). This source is separate from the desktop's bundled `sonariel` skill; installing or loading it does not replace that skill.
