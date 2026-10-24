# Codex integration

Use the app's integration action after installation. It backs up `config.toml`, preserves other servers and refuses a conflicting Sonariel entry. The registered command is the distributed `sonariel-core.exe` with argument `mcp`. Credentials are not read or modified.

Equivalent example, using a user-selected installation path:

```toml
[mcp_servers.sonariel]
command = 'D:\Applications\Sonariel\runtime\sonariel-core.exe'
args = ['mcp']
startup_timeout_sec = 30
```

Reload the Codex client to discover newly registered tools. A server protocol test is recorded separately from registration. A test client handshake does not imply that a preexisting Codex conversation has loaded the server.

The bundled skill is installed at `~/.agents/skills/sonariel/SKILL.md`. It describes music/voice/FX contracts, CPU memory limits, request-key recovery and reference/source semantics. Registration can update the exact known v0.2 skill with a timestamped backup. Custom/unknown existing skill content is preserved for review. Reload Codex after installing this expansion to discover its new tools; the existing installed server is not silently replaced by development builds.

Recommended sequence: environment_status → projects_list → project_select → reference_register (if needed) → generate → job_get → result_feedback → audacity_import/export after an editing request. Tools are prefixed `sonariel_`. Complete schemas are returned by tools/list; unsupported fields/modes are rejected.

The UI has no competing creative chat or primary prompt editor. Prompt, model, seed, input roles and parameters remain visible in result details. Only explicitly saved musical context is persisted. Sonariel audio inference is local; the Codex model is a separate service.

## Stable Audio source input (0.3.1)

`music_generate` retains text2audio by default (5–60s). Source-driven variation is
explicit: register a WAV in the same project, prepare/link the LiteRT audio encoder
and resampler, and pass `mode="audio2audio"`, `source_id`, exact source duration
(5–120s), and optional `init_noise_level` (default 0.25, range 0.01 <= sigma < 1).
The source may be a registered reference or result. This is source-content
conditioning, not a `reference_audio` style control. Smaller sigma changes the
initial latent mix; it does not certify perceptual similarity. Sigma 1 is rejected
because it ignores the source. Never silently substitute text generation.

Use batch 1 and 8 steps as the tested CPU recipe. The source hash is checked at
enqueue, before the worker and after rendering; the result stores its source as
parent. Source duration is not silently truncated to fit a requested duration.
WAV mono/stereo at other sample rates is resampled with pinned soxr HQ inside the
isolated worker; the original is unchanged. New setups include the encoder and
resampler; older text-only links keep working but must explicitly prepare/relink
before audio input is available. No inference-active cancellation is added.

Official contracts consulted:

- https://developers.openai.com/codex/mcp
- https://developers.openai.com/codex/skills
- https://manual.audacityteam.org/man/scripting.html
- https://v2.tauri.app/
