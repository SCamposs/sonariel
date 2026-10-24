# Native offline DSP

Three small crates preserve the validated implementation and floating-point
operation order. `dsp-core` supplies ordered FunDSP stages and WAV IO;
`transform` supplies Signalsmith pitch/time/formants and EBU R128;
`sonariel-fx` composes layers, modulation, reverse-tail sends and master stages.

The executable accepts `input.wav output.wav preset.json`. Simple chain JSON
uses `name`, `schema_version:1`, `output_channels`, `tail_seconds`, `bypass`,
and `chain:[{wet,effect:{type,...}}]`. Layered JSON adds per-layer pitch,
formants, timing, pan, amplitude modulation and chains. The compatibility
`research_only` field has no product behavior. No production-specific presets,
recordings, vocabulary, translations or golden audio are distributed here.

Build: `cargo build --release --locked --manifest-path native/fx/Cargo.toml`.
Tests: run `cargo test --locked` for this manifest and the two child crates.
Originals are never overwritten; each output has a receipt. Simple chains keep
explicit gain (no hidden normalization). Layered recipes use their explicit
LUFS target with a true-peak ceiling and uniform gain, never a hidden limiter.
Advanced effects need listening validation for new content.

Upstream native snapshots, unmodified headers with accompanying MIT licenses:

- Signalsmith Stretch 1.3.2: `88061fd4eda56a2353c5d65c74aa3f4ccf76f9da`
- Signalsmith Linear: `7bb1c8f36794d6980080ce817c91f8da8fe56a66`

The lockfile preserves the dependency versions used during validation.
FunDSP 0.23 is MIT OR Apache-2.0; Hound 3.5.1 is Apache-2.0; ebur128 0.1.10
is MIT. Keep upstream notices when distributing the compiled engine.
