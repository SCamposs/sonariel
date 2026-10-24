# Changelog

## Unreleased

- Format updater release notes as safe Markdown inside the existing dialog, preserving its framing and 170px scroll area. Embedded HTML/media and non-HTTPS links are not rendered. The renderer loads only when notes are shown.

## 0.3.0

- Shared persistent queue for music, Chatterbox Multilingual V3 voice and native DSP.
- Independent pinned CPU voice/LiteRT installation and read-only environment linking.
- Experimental Stable Audio 3 Small-Music/Medium text2audio, explicit per-operator terms.
- Voice profiles with explicit languages and authorized references; exact requested text, no automatic continuation.
- Native ordered/layered FX, explicit short previews, private/global preset revisions, lineage and verified WAV copies.
- Voice Studio/FX workspace, engine inventory, category-aware job details and original/processed comparisons.
- Expanded MCP contracts and known-version skill upgrade with backup; independent Audacity configuration.
- Schema-2 additive migration preserving existing projects, assets, jobs and settings.
- Portable isolated review launcher; production data remains separate from application files.
- Signed Windows release and updater manifest using the existing public-key trust chain.
- Integrated graphite titlebar with real Tauri drag, minimize, maximize/restore and close controls.

ACE-Step Turbo stays the baseline with its unchanged 16 GiB cold-start gate.
Additional Turbo/SFT inference is intentionally not required for this review.
SFT remains pending, not operational; artistic approval of alternative models is separate from technical validation.
See docs/EXPANSION.md for real/automated/untested evidence and limitations.
