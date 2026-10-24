# Third-party components

Sonariel does not relicense external code, models or fonts. Their original notices and licenses continue to apply.

Original Sonariel code is covered by the Sonariel Source Available License 1.0 in `LICENSE`. Its restrictions do not replace or narrow licenses independently granted by the third-party components below. Dependency notices are bundled with the installer.

| Component | License / upstream |
| --- | --- |
| Tauri | MIT or Apache-2.0 · https://github.com/tauri-apps/tauri |
| React | MIT · https://github.com/facebook/react |
| react-markdown | MIT · https://github.com/remarkjs/react-markdown; safe release-note rendering without raw HTML plugins |
| Base UI / Floating UI | MIT · https://github.com/mui/base-ui and https://github.com/floating-ui/floating-ui; unstyled interaction primitives behind Sonariel-owned components |
| Vite, Vitest | MIT · https://github.com/vitejs/vite and https://github.com/vitest-dev/vitest |
| Lucide | ISC · https://github.com/lucide-icons/lucide |
| Tauri dialog plugin / rfd | Apache-2.0 OR MIT / MIT · https://github.com/tauri-apps/plugins-workspace and https://github.com/PolyMeilex/rfd; native file and folder selection |
| Barlow, Urbanist, JetBrains Mono | SIL Open Font License 1.1; license texts ship in their Fontsource packages |
| Python | Python Software Foundation License · https://www.python.org/psf/license/ |
| PyInstaller | GPL-2.0-or-later with bootloader exception · https://pyinstaller.org/en/stable/license.html |
| psutil | BSD-3-Clause · https://github.com/giampaolo/psutil |
| Requests | Apache-2.0 · https://requests.readthedocs.io/ |
| SoundFile, libsndfile | BSD-3-Clause / LGPL-2.1-or-later · https://python-soundfile.readthedocs.io/ |
| NumPy | BSD-3-Clause · https://numpy.org/ |
| Python-soxr / libsoxr | LGPL-2.1-or-later · https://github.com/dofuuz/python-soxr; runs inside the separately installed LiteRT environment, with its package notices |
| jsonschema | MIT · https://github.com/python-jsonschema/jsonschema |
| ACE-Step 1.5 | MIT; model cards and component-specific licenses apply · https://github.com/ace-step/ACE-Step-1.5 |
| PyTorch / torchaudio | BSD-style licenses · https://pytorch.org/ |
| Qwen3 embedding model | See pinned model card and Apache-2.0 license · https://huggingface.co/Qwen/Qwen3-Embedding-0.6B |
| uv | MIT or Apache-2.0 · https://github.com/astral-sh/uv |
| Audacity | GPL-3.0 · https://github.com/audacity/audacity |

The Windows installer bundles the lightweight application core and libraries, not the ACE-Step models or Audacity. The setup downloads external components from their official sources after authorization. Their archives and notices are retained outside Git. Musical references and generated studies are user content and are never distributed with source or installer.

Visual references guide composition and material tone only. No game logos, characters or proprietary fonts are packaged.
## Native audio processing

The optional native FX executable uses FunDSP 0.23.0 (MIT OR Apache-2.0),
Hound 3.5.1 (Apache-2.0), ebur128 0.1.10 (MIT), Signalsmith Stretch 1.3.2
and Signalsmith Linear (MIT), plus the dependencies pinned in
`native/fx/Cargo.lock`. Original Signalsmith copyright/license texts accompany
the vendored headers. Distribution builds collect the resolved crate notices,
including Unicode license terms, into `licenses/native-fx`.

Chatterbox and official PerTh run in a separately installed environment and
are not bundled as Python modules or model weights in the desktop installer.
Their source/model notices and the terms of their Python/native dependencies
must remain with that environment. Installing an optional engine does not
change the Sonariel license or grant rights over reference recordings.
