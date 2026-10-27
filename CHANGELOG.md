# Changelog

## 0.4.0

- Publish the Phase 2 production tools and bilingual UI as a stable Windows release, with signed updater assets.
- Retain the packaged loop-creation gate across UI/core/MCP and preserve all existing audio/lineage; issue #3 stays open.
- Promote the tested RC implementation by version identity/documentation only, with a separate signed build and stable release notes in English and Portuguese.
- Windows RC installation/basic use and isolated migration/MCP/FX checks passed. The full official v0.3.2 → v0.4.0 installer/updater lifecycle remains untested, explicitly accepted by the maintainer for publication. See [English notes](docs/releases/v0.4.0.md), [notas em português](docs/releases/v0.4.0.pt-BR.md) and the [Phase 2.7 report](docs/PHASE2_7.md).

## 0.4.0-rc.1 — test prerelease

- Prepare the proposed v0.4.0 without replacing the public v0.3.2 download/update.
- Bundle English/pt-BR UI, batch WAV export, versioned music presets, non-destructive reference/source regions, project tags and persistent combined filters.
- Preserve independent module scrolling and the unsaved FX workspace during navigation.
- Make schema-5 migration atomic, retaining consistent backups and refusing older-core downgrade.
- Disable loop creation in packaged UI/core/MCP while preserving existing loop WAVs, jobs and lineage. Explicit source development remains available on isolated profiles; musical issue #3 stays open.
- Refuse development builds that would overwrite a running core runtime.
- See the [candidate notes](docs/releases/v0.4.0-rc.1.md) / [notas em português](docs/releases/v0.4.0-rc.1.pt-BR.md). Windows installer/upgrade acceptance remains pending; the stable updater remains v0.3.2.

## 0.3.2

- Central registered-audio inventory and confirmed recoverable discard/restore. Managed output WAVs move to an internal trash journal; imported/external files are never moved or deleted. Protected references, favorites, chosen versions, shared files and dependencies cannot be discarded. No permanent erase or automatic cleanup; trash retains disk space.
- Schema 3 adds a discard journal, with a consistent pre-migration SQLite backup for schema 1/2 databases. Existing asset metadata, lineage and job history are retained.
- Lower the ACE-Step cold-start gate from 16 to 12 GiB at the owner's explicit request, retaining the 4 GiB warm gate and RAM telemetry. Not a new low-memory inference profile or a guarantee against paging/allocation failure.
- Native Windows file/folder selection next to editable path fields across library, environment, voice and FX. Presets offer separate open/save dialogs; cancellation preserves values and export still refuses overwriting existing files.
- Keep wrapped sidebar labels left-aligned with fixed-width navigation icons.
- Animate the shared workspace refresh control while its request is pending, disable duplicate clicks and reset its state on success or failure. Existing reduced-motion preferences are preserved.

## 0.3.1

- Format updater release notes as safe Markdown inside the existing dialog, preserving its framing and 170px scroll area. Embedded HTML/media and non-HTTPS links are not rendered. The renderer loads only when notes are shown.
- Explicit Stable Audio audio2audio through the shared queue/MCP, with same-project source ID, immutable hash, source-duration matching up to 120s, controlled latent perturbation and parent lineage. Existing text2audio requests remain capped at 60s.
- Pinned SAME-S encoder and soxr HQ input resampling in the isolated CPU setup. Older text-only environments stay usable; preparing/linking audio-input components requires an explicit setup action.

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
