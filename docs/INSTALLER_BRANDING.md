# Windows installer branding

The next installer build uses the original Sonariel icon for installation and
uninstallation, a dark sidebar, warm ivory surfaces, amber rules and static
audio artwork. The artwork uses the desktop's Urbanist, Barlow and JetBrains
Mono fonts. It contains no production assets or simulated telemetry.

## Implementation boundary

`src-tauri/tauri.conf.json` uses Tauri's supported NSIS image/icon settings and
`installerHooks`. There is **no custom installer template**. The included
`src-tauri/installer/branding.nsh` only sets Modern UI colors and visual
initialization callbacks, preserving registers around those callbacks.

Tauri continues to own installation, maintenance, upgrades, WebView2 setup,
shortcuts, passive/silent operation and uninstallation. The existing per-user
install mode, Portuguese/English languages, updater keys, endpoint and signing
settings are unchanged. The title bar, buttons, radio buttons, directory fields
and other controls remain native Windows controls; some page surfaces retain
system colors. No custom frame, control painting or additional NSIS plugin is
introduced. Fonts are rasterized into artwork, never installed globally.

## Artwork maintenance

Committed 24-bit RGB BMPs are ready for normal builds; Pillow is **not** needed
to build, install or run Sonariel. Only regenerating artwork requires Pillow
(validated with 12.3.0) and the pinned Fontsource files installed by `npm ci`:

```powershell
python scripts/render-installer-branding.py
```

The script renders at 4x and downsamples to the documented NSIS dimensions:
header 150 × 57 and sidebar 164 × 314. The audio-mark geometry/palette derives
from the original `assets/icon.svg`. Existing third-party font notices apply.

## Local validation — 2026-10-27

- Tauri CLI 2.12.4 / bundled NSIS compiled the branded installer successfully
  from the existing desktop/core binaries. No runtime rebuild was necessary.
- A local, unsigned `0.4.0-installer-preview.1` configuration kept the public
  0.4.0 installer and its signature untouched. This is a packaging preview,
  **not a release candidate to install or distribute**.
- Real Windows UI inspection verified the welcome artwork, icon, maintenance
  header and readable standard controls. Cancel exited before any installation
  or uninstallation. The footer retains native system rendering.
- PE resource inspection verified that the installer embeds every icon frame
  from Sonariel's ICO. BMP format/dimensions, repeatable artwork output and the
  unchanged updater/runtime configuration were checked separately.
- This cosmetic change does not constitute a new end-to-end installation,
  upgrade or uninstall acceptance test; the existing release caveats remain.
- No public release, tag, updater manifest or production profile was changed.

For a future authorized release, follow [the normal signed release process](RELEASING.md).
Do not replace already published version assets with the branded build.

References: [Tauri NSIS customization](https://v2.tauri.app/distribute/windows-installer/#customizing-the-nsis-installer),
the installed Tauri CLI configuration schema and bundled NSIS Modern UI 2 definitions.
