//! Native offline DSP. No inference runtime or product-specific presets.
use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use sonariel_transform as essence;
use sonariel_dsp_core as fx;
use std::{fs, path::Path, time::Instant};
mod loop_render;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Layer {
    id: String,
    enabled: bool,
    pitch_st: f32,
    formant_st: f32,
    time_ratio: f32,
    delay_ms: f32,
    gain_db: f32,
    pan: f32,
    ring_hz: f32,
    ring_depth_start: f32,
    ring_depth_end: f32,
    seed: u32,
    chain: fx::Preset,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Recipe {
    schema_version: u32,
    name: String,
    #[serde(default)]
    research_only: bool,
    bypass: bool,
    wet: f32,
    dry_db: f32,
    lead_ms: f32,
    reverse_swell_ms: f32,
    reverse_swell_db: f32,
    target_lufs: f64,
    ceiling_dbtp: f64,
    layers: Vec<Layer>,
    master: fx::Preset,
}
fn bounded(v: f32, a: f32, b: f32) -> Result<()> {
    ensure!(v.is_finite() && (a..=b).contains(&v), "Out of bounds: {v}");
    Ok(())
}
fn gain(db: f32) -> f32 {
    10_f32.powf(db / 20.)
}
fn validate(p: &Recipe, sr: u32) -> Result<()> {
    ensure!(
        p.schema_version == 1,
        "Unsupported recipe schema"
    );
    bounded(p.wet, 0., 1.)?;
    bounded(p.dry_db, -60., 0.)?;
    bounded(p.lead_ms, 0., 1000.)?;
    bounded(p.reverse_swell_ms, 0., p.lead_ms)?;
    bounded(p.reverse_swell_db, -60., 0.)?;
    ensure!(p.layers.len() <= 12, "Too many layers");
    fx::validate(&p.master, sr)?;
    ensure!(
        p.master.output_channels == 2 && p.master.tail_seconds <= 10.,
        "Invalid master shape"
    );
    for l in &p.layers {
        bounded(l.pitch_st, -12., 12.)?;
        bounded(l.formant_st, -6., 6.)?;
        bounded(l.time_ratio, 0.75, 1.5)?;
        bounded(l.delay_ms, 0., 500.)?;
        bounded(l.gain_db, -60., 0.)?;
        bounded(l.pan, -1., 1.)?;
        bounded(l.ring_hz, 0., 160.)?;
        bounded(l.ring_depth_start, 0., 1.)?;
        bounded(l.ring_depth_end, 0., 1.)?;
        fx::validate(&l.chain, sr)?;
        ensure!(
            l.chain.output_channels == 2 && l.chain.tail_seconds <= 6.,
            "Invalid layer shape"
        );
    }
    Ok(())
}
fn edge(data: &mut [[f32; 2]], sr: u32, fade_ms: f32) {
    let n = data.len();
    let fade = (sr as f32 * fade_ms / 1000.).max(1.);
    for (i, x) in data.iter_mut().enumerate() {
        let a = (i as f32 / fade).min(1.);
        let b = ((n - 1 - i) as f32 / fade).min(1.);
        let v = (a * std::f32::consts::FRAC_PI_2).sin() * (b * std::f32::consts::FRAC_PI_2).sin();
        x[0] *= v;
        x[1] *= v;
    }
}
fn add(out: &mut Vec<[f32; 2]>, data: &[[f32; 2]], start: usize, level: f32, pan: f32) {
    out.resize(out.len().max(start + data.len()), [0.; 2]);
    // Balance pan: center preserves channels; no implicit mono collapse.
    let left = (1. - pan.max(0.)).sqrt() * level;
    let right = (1. + pan.min(0.)).sqrt() * level;
    for (i, x) in data.iter().enumerate() {
        out[start + i][0] += x[0] * left;
        out[start + i][1] += x[1] * right;
    }
}
fn process(x: &[[f32; 2]], sr: u32, p: &Recipe) -> Result<Vec<[f32; 2]>> {
    validate(p, sr)?;
    ensure!(
        !x.is_empty() && x.len() <= sr as usize * 600,
        "Offline input limit: ten minutes"
    );
    ensure!(
        x.iter().flatten().all(|v| v.is_finite()),
        "Nonfinite source"
    );
    if p.bypass || p.wet == 0. {
        return Ok(x.to_vec());
    }
    let lead = (p.lead_ms * sr as f32 / 1000.).round() as usize;
    let mut out = vec![[0.; 2]; lead + x.len()];
    add(&mut out, x, lead, gain(p.dry_db), 0.);
    for l in p.layers.iter().filter(|l| l.enabled) {
        let mut part = if l.pitch_st == 0. && l.formant_st == 0. && l.time_ratio == 1. {
            x.to_vec()
        } else {
            essence::stretch(x, sr, l.time_ratio, l.pitch_st, l.formant_st, l.seed)?
        };
        let length = part.len();
        for (i, frame) in part.iter_mut().enumerate() {
            let t = i as f32 / (length - 1).max(1) as f32;
            let depth = l.ring_depth_start + t * (l.ring_depth_end - l.ring_depth_start);
            // Ring modulation, not a claim of formant tracking or intelligent continuation.
            let carrier = (std::f32::consts::TAU * l.ring_hz * i as f32 / sr as f32).sin();
            let g = if l.ring_hz == 0. {
                1.
            } else {
                1. - depth + depth * carrier
            };
            frame[0] *= g;
            frame[1] *= g;
        }
        edge(&mut part, sr, 4.);
        let part = fx::process(&part, sr, &l.chain)?;
        let start = lead + (l.delay_ms * sr as f32 / 1000.).round() as usize;
        add(&mut out, &part, start, gain(l.gain_db), l.pan);
    }
    if p.reverse_swell_ms > 0. {
        let reverbed = fx::process(
            x,
            sr,
            &fx::Preset {
                name: "reverse-tail send".into(),
                schema_version: 1,
                output_channels: 2,
                tail_seconds: 1.,
                bypass: false,
                chain: vec![fx::Stage {
                    wet: 1.,
                    effect: fx::Effect::Reverb {
                        room_m: 13.,
                        rt60_s: 1.8,
                        damping: 0.5,
                        predelay_ms: 0.,
                    },
                }],
            },
        )?;
        let count = (p.reverse_swell_ms * sr as f32 / 1000.).round() as usize;
        // Reverse only the early post-utterance tail, never reorder syllables.
        let end = (x.len() + count).min(reverbed.len());
        let mut tail: Vec<_> = reverbed[x.len()..end].iter().rev().copied().collect();
        edge(&mut tail, sr, 10.);
        add(
            &mut out,
            &tail,
            lead - tail.len(),
            gain(p.reverse_swell_db),
            0.,
        );
    }
    out = fx::process(&out, sr, &p.master)?;
    // Global wet crossfade; bypass above is exact, dry alignment includes deliberate lead.
    for (i, frame) in out.iter_mut().enumerate() {
        let dry = if i >= lead && i - lead < x.len() {
            x[i - lead]
        } else {
            [0.; 2]
        };
        for c in 0..2 {
            frame[c] = frame[c] * p.wet + dry[c] * (1. - p.wet);
        }
    }
    edge(&mut out, sr, 15.);
    ensure!(
        out.iter().flatten().all(|v| v.is_finite()),
        "Nonfinite render"
    );
    Ok(out)
}
fn normalize(
    data: &mut [[f32; 2]],
    sr: u32,
    target: f64,
    ceiling: f64,
) -> Result<serde_json::Value> {
    ensure!(
        (-36. ..=-16.).contains(&target) && (-6. ..=-0.5).contains(&ceiling),
        "Unsafe target"
    );
    let before = essence::loudness(data, sr)?;
    let mut iterations = vec![];
    // Absolute BS1770 gating is level-dependent near the noise floor. Iterate
    // only a single uniform gain over the WHOLE signal, never an AGC/limiter.
    for _ in 0..8 {
        let measured = essence::loudness(data, sr)?;
        let correction = target - measured.lufs;
        if correction.abs() < 0.05 {
            ensure!(measured.dbtp <= ceiling + 0.01, "True peak exceeds ceiling");
            return Ok(
                serde_json::json!({"method":"EBU R128 integrated; iterative static uniform gain; no limiter",
                "before":before,"after":measured,"gain_db":iterations.iter().sum::<f64>(),
                "iterations":iterations,"ceiling_dbtp":ceiling}),
            );
        }
        ensure!(
            measured.dbtp + correction <= ceiling,
            "Cannot match target without clipping; lower common target"
        );
        let g = 10_f64.powf(correction / 20.) as f32;
        for f in data.iter_mut() {
            f[0] *= g;
            f[1] *= g;
        }
        iterations.push(correction);
    }
    anyhow::bail!("Absolute loudness gate did not converge")
}
fn main() -> Result<()> {
    let args: Vec<_> = std::env::args().collect();
    ensure!(
        args.len() == 4,
        "Usage: sonariel-fx input.wav output.wav recipe.json"
    );
    let input = Path::new(&args[1]);
    let output = Path::new(&args[2]);
    ensure!(
        !output.exists() && !output.with_extension("json").exists(),
        "Refusing overwrite"
    );
    let raw = fs::read(&args[3])?;
    let value: serde_json::Value = serde_json::from_slice(&raw)?;
    if value.get("operation").and_then(|v| v.as_str()) == Some("loop") {
        return loop_render::render(input, output, &raw);
    }
    if value.get("layers").is_none() {
        return fx::cli();
    }
    let p: Recipe = serde_json::from_slice(&raw)?;
    let start = Instant::now();
    let before = fx::hash(input)?;
    let (x, sr, _) = fx::load(input)?;
    let mut y = process(&x, sr, &p)?;
    let normalization = if p.bypass || p.wet == 0. {
        None
    } else {
        Some(normalize(&mut y, sr, p.target_lufs, p.ceiling_dbtp)?)
    };
    if p.bypass || p.wet == 0. {
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(input, output)?;
    } else {
        essence::write(output, &y, sr)?;
    }
    ensure!(fx::hash(input)? == before, "Source changed");
    let receipt = serde_json::json!({"engine":"sonariel-fx 0.1.0", "source":input, "output":output,
        "source_sha256":before,"output_sha256":fx::hash(output)?,"recipe":p,
        "normalization":normalization,"metrics":fx::metrics(&y,sr,2),"loudness":essence::loudness(&y,sr)?,
        "elapsed_s":start.elapsed().as_secs_f64(),
        "watermark":"No removal intent. Original preserved. Detectability after FX not asserted."});
    fs::write(
        output.with_extension("json"),
        serde_json::to_vec_pretty(&receipt)?,
    )?;
    println!("{}", serde_json::to_string(&receipt)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn signal() -> Vec<[f32; 2]> {
        (0..24000)
            .map(|i| [0.05 * (std::f32::consts::TAU * 220. * i as f32 / 24000.).sin(); 2])
            .collect()
    }
    fn empty() -> fx::Preset {
        fx::Preset {
            name: "test".into(),
            schema_version: 1,
            output_channels: 2,
            tail_seconds: 0.,
            bypass: false,
            chain: vec![],
        }
    }
    fn recipe() -> Recipe {
        Recipe {
            schema_version: 1,
            name: "test".into(),
            research_only: true,
            bypass: false,
            wet: 1.,
            dry_db: -60.,
            lead_ms: 100.,
            reverse_swell_ms: 0.,
            reverse_swell_db: -18.,
            target_lufs: -26.,
            ceiling_dbtp: -1.,
            master: empty(),
            layers: vec![Layer {
                id: "primary".into(),
                enabled: true,
                pitch_st: 7.,
                formant_st: 0.,
                time_ratio: 1.,
                delay_ms: 20.,
                gain_db: -3.,
                pan: 0.,
                ring_hz: 0.,
                ring_depth_start: 0.,
                ring_depth_end: 0.,
                seed: 5,
                chain: empty(),
            }],
        }
    }
    #[test]
    fn bypass_and_zero_wet_are_exact() {
        let x = signal();
        let mut p = recipe();
        p.bypass = true;
        assert_eq!(process(&x, 24000, &p).unwrap(), x);
        p.bypass = false;
        p.wet = 0.;
        assert_eq!(process(&x, 24000, &p).unwrap(), x);
    }
    #[test]
    fn seeded_layers_reproduce_and_keep_expected_duration() {
        let x = signal();
        let p = recipe();
        let a = process(&x, 24000, &p).unwrap();
        assert_eq!(a.len(), 26880);
        assert_eq!(a, process(&x, 24000, &p).unwrap());
        assert_ne!(&a[2880..], &x[..]);
        assert_eq!(a[0], [0.; 2]);
        assert_eq!(a[a.len() - 1], [0.; 2]);
    }
    #[test]
    fn disabled_layer_changes_result() {
        let x = signal();
        let mut p = recipe();
        let a = process(&x, 24000, &p).unwrap();
        p.layers[0].enabled = false;
        assert_ne!(a, process(&x, 24000, &p).unwrap());
    }
    #[test]
    fn pan_and_ring_are_effective() {
        let x = signal();
        let mut p = recipe();
        p.layers[0].pan = -1.;
        p.layers[0].ring_hz = 63.;
        p.layers[0].ring_depth_end = 0.8;
        let a = process(&x, 24000, &p).unwrap();
        let left: f32 = a.iter().map(|x| x[0] * x[0]).sum();
        let right: f32 = a.iter().map(|x| x[1] * x[1]).sum();
        assert!(left > right * 100.);
    }
    #[test]
    fn reverse_tail_has_finite_nonzero_preroll() {
        let x = signal();
        let mut p = recipe();
        p.reverse_swell_ms = 100.;
        let a = process(&x, 24000, &p).unwrap();
        assert!(a[..2400].iter().flatten().any(|x| x.abs() > 1e-7));
        assert!(a.iter().flatten().all(|x| x.is_finite()));
    }
    #[test]
    fn invalid_parameters_and_nonfinite_source_fail() {
        let mut p = recipe();
        p.layers[0].time_ratio = 0.1;
        assert!(process(&signal(), 24000, &p).is_err());
        let mut x = signal();
        x[100][0] = f32::NAN;
        assert!(process(&x, 24000, &recipe()).is_err());
        p = recipe();
        p.reverse_swell_ms = 500.;
        assert!(process(&signal(), 24000, &p).is_err());
    }
    #[test]
    fn quiet_long_tail_normalization_converges_without_limiter() {
        let mut x = signal();
        for i in 0..168000 {
            let t = i as f32 / 24000.;
            x.push([0.0001 * (-t * 1.8).exp() * (t * 1382.3).sin(); 2]);
        }
        let n = normalize(&mut x, 24000, -26., -1.).unwrap();
        assert!((n["after"]["lufs"].as_f64().unwrap() + 26.).abs() < 0.05);
        assert!(n["after"]["dbtp"].as_f64().unwrap() <= -1.);
    }
}
