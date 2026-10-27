# Setup

## Existing engine

Provide a dedicated root containing `.venv/Scripts/python.exe` and `ACE-Step-1.5/acestep/api_server.py`. Audacity is optional and configured separately in Audacity & Codex. Legacy `environment_link` calls may still supply `audacity_path`; omitting it preserves a configured editor. Inspection reads package metadata, the Git commit (or Sonariel installation receipt), model presence and the DiT-only patch. It does not run `uv sync`, launch upstream Windows batch scripts or rewrite the environment.

## New engine

Review the plan and authorize the displayed destination. Installation refuses nonempty unowned folders, Git checkouts and broad roots. It downloads a fixed uv archive with a SHA-256 from the official release, installs managed Python 3.12.10, creates one venv and installs the pinned baseline dependency list including CPU wheels. Upstream is installed with `--no-deps`; its CUDA dependency metadata is never synchronized.

The fixed ACE-Step archive has a committed SHA-256. A guarded patch removes only the disabled LM checkpoint from mandatory model components. Turbo, VAE and text-encoder files come from a fixed Hugging Face revision with expected SHA-256 values. No LM weights are requested. Cache reuse requires matching these hashes; production files are copied so writes cannot affect the source cache.

Downloads keep `.part` files and use HTTP Range to resume. Steps and installed versions are written to `sonariel-install.json`. A retry verifies existing artifacts and fills missing work instead of creating another environment. A damaged cache entry cannot be accepted by size alone.

ACE-Step setup no longer downloads Audacity or modifies its preferences. Existing configured editor paths are preserved on resumable setup. Select an existing Audacity executable separately for optional editing/handoff; native FX, playback and WAV export do not require an editor. The portable-Audacity specification remains in the historical recipe for compatibility, but engine setup does not execute that optional recipe.

The validated recipe is distinct from latest available software. There is no silent update. New recipes must receive their own compatibility validation. Full isolated installation with verified cache reuse is different from a zero-cache download test; report them separately.

## Official sources

- https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/INSTALL.md
- https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/API.md
- https://ace-step.github.io/ACE-Step-1.5/en/API
- https://github.com/astral-sh/uv
- https://download.pytorch.org/whl/cpu
- https://huggingface.co/ACE-Step/Ace-Step1.5
- https://github.com/audacity/audacity/releases
