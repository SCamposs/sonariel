# Phase 2: internationalization and production workflow

Development baseline: main `86b6864`, distributed version **v0.3.2**. This work does not publish an installer/release, change model installations, or use production profiles. Development validation uses small synthetic WAVs and isolated application data.

## Issue audit at baseline (26 October 2026)

All nine open issues were read and compared with the existing core/UI contracts.

| Issue | Classification | Evidence and decision |
| --- | --- | --- |
| [#1 Batch export](https://github.com/SCamposs/sonariel/issues/1) | Partially implemented | `fx_export` safely exports one result; library has A/B selection but no bulk export, naming policy or portable manifest. Priority for this phase. |
| [#2 Music presets](https://github.com/SCamposs/sonariel/issues/2) | Not started | Generation parameters/history and DSP presets exist; no separate reusable music-preset contract or UI. Priority for this phase. |
| [#3 Non-destructive loops](https://github.com/SCamposs/sonariel/issues/3) | Not started | Native DSP has fades/delay/layers, but no region/crossfade loop-render contract or seam preview. Priority for this phase. |
| [#4 Reference regions](https://github.com/SCamposs/sonariel/issues/4) | Partially implemented; later phase | Style/source roles, Stable source-audio compatibility and full-source duration checks exist. User-selected reference regions do not. Loop editing must not silently become reference conditioning. |
| [#5 Tags and session filters](https://github.com/SCamposs/sonariel/issues/5) | Partially implemented; later phase | Projects/sessions, search, favorites, selection and waveform comparison exist. Tags and persistent combined filters do not. |
| [#6 Strict offline](https://github.com/SCamposs/sonariel/issues/6) | Depends on experimentation | Local inference and optional update checks exist; no complete offline/cold-cache acceptance or explicit strict-offline policy. Keep open. |
| [#7 GPU profiles](https://github.com/SCamposs/sonariel/issues/7) | Depends on experimentation | Only isolated CPU recipes/adapters are supported. No driver/model/environment changes in this phase. |
| [#8 Active cancellation](https://github.com/SCamposs/sonariel/issues/8) | Depends on experimentation | Cancellation is deliberately limited to unsubmitted queued tasks. Preserve ownership/recovery safeguards. |
| [#9 Fast generation previews](https://github.com/SCamposs/sonariel/issues/9) | Depends on experimentation | Turbo uses eight steps; native DSP previews are already available but do not establish a generative draft/refinement mode. No benchmark generations here. |

## Implementation and validation record

Updated incrementally as independently verified work is completed. An implemented contract or mock test is not a live model acceptance test. Issues remain open until their actual criteria have been checked.

### Internationalization foundation

- Bundled i18next/react-i18next resources, separated by workspace, studio, storage, guide, updates, window, files, common, settings and system messages. No translation service or online language detection.
- The profile records whether it predates language preferences. Existing profiles initially keep PT-BR and retain their independent tutorial state. Fresh profiles choose a detected/suggested language before the guide; explicit language is persisted in SQLite through an additive preference-only contract.
- Settings in the sidebar changes mounted components immediately. Labels, tooltips, accessibility, notifications, dates/numbers and recognized core diagnostics are localized. Unknown external/OS diagnostics retain their verbatim technical detail with a localized recovery hint. User-authored content and stored technical identifiers are not translated.
- Foundation validation: **85 Python tests**, **55 TypeScript/UI tests**, typecheck and catalog/placeholder parity checks passed. Includes migration/settings preservation and no generation imports. Native desktop/resolution acceptance remains pending until the full phase is built in an isolated preview.
