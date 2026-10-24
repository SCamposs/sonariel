//! Small offline adapter: WAV -> ordered JSON chain -> new WAV + receipt.
//! No model runtime, no Audacity code, no implicit normalization or clipping.
use anyhow::{Result, bail, ensure};
use fundsp::prelude32::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, path::Path, time::Instant};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Preset {
    pub name: String,
    pub schema_version: u32,
    pub output_channels: u16,
    pub tail_seconds: f32,
    pub bypass: bool,
    pub chain: Vec<Stage>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Stage {
    pub wet: f32,
    pub effect: Effect,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Effect {
    Gain {
        db: f32,
    },
    Fade {
        in_ms: f32,
        out_ms: f32,
    },
    Highpass {
        hz: f32,
        q: f32,
    },
    Lowpass {
        hz: f32,
        q: f32,
    },
    Bell {
        hz: f32,
        q: f32,
        db: f32,
    },
    Reverb {
        room_m: f32,
        rt60_s: f32,
        damping: f32,
        predelay_ms: f32,
    },
    Delay {
        ms: f32,
        feedback: f32,
    },
    Chorus {
        seed: u64,
        separation_ms: f32,
        variation_ms: f32,
        rate_hz: f32,
    },
}
pub fn hash(path: &Path) -> Result<String> {
    Ok(format!("{:x}", Sha256::digest(fs::read(path)?)))
}
pub fn load(path: &Path) -> Result<(Vec<[f32; 2]>, u32, u16)> {
    let mut r = hound::WavReader::open(path)?;
    let s = r.spec();
    ensure!(
        (1..=2).contains(&s.channels),
        "Only mono/stereo WAV supported"
    );
    ensure!(
        (8000..=192000).contains(&s.sample_rate),
        "Unsupported sample rate"
    );
    ensure!(
        r.duration() as u64 <= s.sample_rate as u64 * 600,
        "Offline safety limit: ten minutes"
    );
    let samples: Vec<f32> = match s.sample_format {
        hound::SampleFormat::Float => r.samples::<f32>().collect::<std::result::Result<_, _>>()?,
        hound::SampleFormat::Int => r
            .samples::<i32>()
            .map(|x| x.map(|v| v as f32 / 2.0_f32.powi(s.bits_per_sample as i32 - 1)))
            .collect::<std::result::Result<_, _>>()?,
    };
    ensure!(samples.iter().all(|x| x.is_finite()), "Nonfinite source");
    ensure!(samples.len() % s.channels as usize == 0, "Partial frame");
    let frames = samples
        .chunks(s.channels as usize)
        .map(|x| [x[0], x[if s.channels == 1 { 0 } else { 1 }]])
        .collect();
    Ok((frames, s.sample_rate, s.channels))
}
fn range(v: f32, lo: f32, hi: f32) -> Result<()> {
    ensure!(
        v.is_finite() && v >= lo && v <= hi,
        "Parameter {v} outside {lo}..{hi}"
    );
    Ok(())
}
pub fn validate(p: &Preset, sr: u32) -> Result<()> {
    ensure!(p.schema_version == 1, "Unknown schema version");
    ensure!(
        (1..=2).contains(&p.output_channels),
        "Output channels must be 1 or 2"
    );
    range(p.tail_seconds, 0., 30.)?;
    ensure!(p.chain.len() <= 32, "Too many stages");
    for s in &p.chain {
        range(s.wet, 0., 1.)?;
        match s.effect {
            Effect::Gain { db } => range(db, -60., 18.)?,
            Effect::Fade { in_ms, out_ms } => {
                range(in_ms, 0., 10000.)?;
                range(out_ms, 0., 10000.)?;
            }
            Effect::Highpass { hz, q } | Effect::Lowpass { hz, q } | Effect::Bell { hz, q, .. } => {
                range(hz, 10., sr as f32 * 0.45)?;
                range(q, 0.1, 10.)?;
                if let Effect::Bell { db, .. } = s.effect {
                    range(db, -24., 12.)?;
                }
            }
            Effect::Reverb {
                room_m,
                rt60_s,
                damping,
                predelay_ms,
            } => {
                range(room_m, 1., 50.)?;
                range(rt60_s, 0.1, 10.)?;
                range(damping, 0., 1.)?;
                range(predelay_ms, 0., 250.)?;
            }
            Effect::Delay { ms, feedback } => {
                range(ms, 1., 2000.)?;
                range(feedback, -0.85, 0.85)?;
            }
            Effect::Chorus {
                separation_ms,
                variation_ms,
                rate_hz,
                ..
            } => {
                range(separation_ms, 2., 50.)?;
                range(variation_ms, 0., 10.)?;
                range(rate_hz, 0.01, 2.)?;
                ensure!(
                    variation_ms < separation_ms,
                    "Variation must be below separation"
                );
            }
        }
    }
    Ok(())
}
fn run_unit(data: &mut [[f32; 2]], sr: u32, mut unit: Box<dyn AudioUnit>) {
    unit.set_sample_rate(sr as f64);
    unit.allocate();
    for x in data {
        let mut out = [0.; 2];
        unit.tick(x, &mut out);
        *x = out;
    }
}
pub fn process(source: &[[f32; 2]], sr: u32, p: &Preset) -> Result<Vec<[f32; 2]>> {
    validate(p, sr)?;
    if p.bypass {
        return Ok(source.to_vec());
    }
    let mut data = source.to_vec();
    data.resize(
        data.len() + (p.tail_seconds * sr as f32).round() as usize,
        [0.; 2],
    );
    for stage in &p.chain {
        if stage.wet == 0. {
            continue;
        }
        let dry = data.clone();
        match stage.effect {
            Effect::Gain { db } => {
                let gain = 10_f32.powf(db / 20.);
                for x in &mut data {
                    x[0] *= gain;
                    x[1] *= gain;
                }
            }
            Effect::Fade { in_ms, out_ms } => {
                let a = in_ms * sr as f32 / 1000.;
                let b = out_ms * sr as f32 / 1000.;
                let len = data.len();
                for (i, x) in data.iter_mut().enumerate() {
                    // Equal-power raised-sine ramps, exactly zero at boundaries.
                    let fi = if a <= 1. {
                        1.
                    } else {
                        (i as f32 / (a - 1.)).clamp(0., 1.)
                    };
                    let fo = if b <= 1. {
                        1.
                    } else {
                        ((len - 1 - i) as f32 / (b - 1.)).clamp(0., 1.)
                    };
                    let g = (fi * std::f32::consts::FRAC_PI_2).sin()
                        * (fo * std::f32::consts::FRAC_PI_2).sin();
                    x[0] *= g;
                    x[1] *= g;
                }
            }
            Effect::Highpass { hz, q } => run_unit(
                &mut data,
                sr,
                Box::new(highpass_hz(hz, q) | highpass_hz(hz, q)),
            ),
            Effect::Lowpass { hz, q } => run_unit(
                &mut data,
                sr,
                Box::new(lowpass_hz(hz, q) | lowpass_hz(hz, q)),
            ),
            Effect::Bell { hz, q, db } => {
                let g = 10_f32.powf(db / 20.);
                run_unit(
                    &mut data,
                    sr,
                    Box::new(bell_hz(hz, q, g) | bell_hz(hz, q, g)),
                );
            }
            Effect::Reverb {
                room_m,
                rt60_s,
                damping,
                predelay_ms,
            } => {
                run_unit(
                    &mut data,
                    sr,
                    Box::new(reverb_stereo(room_m, rt60_s, damping)),
                );
                let n = (predelay_ms * sr as f32 / 1000.).round() as usize;
                for i in (0..data.len()).rev() {
                    data[i] = if i >= n { data[i - n] } else { [0.; 2] };
                }
            }
            Effect::Delay { ms, feedback } => {
                let n = (ms * sr as f32 / 1000.).round().max(1.) as usize;
                let mut ring = vec![[0.; 2]; n];
                let mut pos = 0;
                for x in &mut data {
                    let y = ring[pos];
                    ring[pos] = [x[0] + y[0] * feedback, x[1] + y[1] * feedback];
                    *x = y;
                    pos = (pos + 1) % n;
                }
            }
            Effect::Chorus {
                seed,
                separation_ms,
                variation_ms,
                rate_hz,
            } => {
                // FunDSP chorus contains direct signal; wet is a crossfade to its output.
                run_unit(
                    &mut data,
                    sr,
                    Box::new(
                        chorus(seed, separation_ms / 1000., variation_ms / 1000., rate_hz)
                            | chorus(
                                seed.wrapping_add(1),
                                separation_ms / 1000.,
                                variation_ms / 1000.,
                                rate_hz,
                            ),
                    ),
                );
            }
        }
        for (x, d) in data.iter_mut().zip(&dry) {
            for c in 0..2 {
                x[c] = d[c] * (1. - stage.wet) + x[c] * stage.wet;
            }
        }
        ensure!(
            data.iter().flatten().all(|x| x.is_finite()),
            "Nonfinite stage output"
        );
    }
    Ok(data)
}
#[derive(Debug, Serialize)]
pub struct Metrics {
    pub sample_rate: u32,
    pub channels: u16,
    pub frames: usize,
    pub duration_s: f64,
    pub peak: f32,
    pub rms: f64,
    pub clipping_samples: usize,
    pub max_adjacent_delta: f32,
    pub last_50ms_rms: f64,
}
pub fn metrics(x: &[[f32; 2]], sr: u32, ch: u16) -> Metrics {
    let samples: Vec<f32> = x
        .iter()
        .flat_map(|f| f[..ch as usize].iter().copied())
        .collect();
    let rms = |s: &[f32]| {
        if s.is_empty() {
            0.
        } else {
            (s.iter().map(|v| (*v as f64).powi(2)).sum::<f64>() / s.len() as f64).sqrt()
        }
    };
    let tail = std::cmp::min(sr as usize * ch as usize / 20, samples.len());
    Metrics {
        sample_rate: sr,
        channels: ch,
        frames: x.len(),
        duration_s: x.len() as f64 / sr as f64,
        peak: samples.iter().fold(0_f32, |a, b| a.max(b.abs())),
        rms: rms(&samples),
        clipping_samples: samples.iter().filter(|v| v.abs() >= 1.).count(),
        max_adjacent_delta: x
            .windows(2)
            .flat_map(|w| (0..ch as usize).map(move |c| (w[1][c] - w[0][c]).abs()))
            .fold(0., f32::max),
        last_50ms_rms: rms(&samples[samples.len() - tail..]),
    }
}
pub fn render(input: &Path, output: &Path, p: &Preset) -> Result<serde_json::Value> {
    ensure!(!output.exists(), "Refusing overwrite");
    ensure!(
        !output.with_extension("json").exists(),
        "Receipt already exists"
    );
    let start = Instant::now();
    let before = hash(input)?;
    let (data, sr, ch) = load(input)?;
    let src_metrics = metrics(&data, sr, ch);
    let mut rendered = process(&data, sr, p)?;
    let out_ch = if p.bypass { ch } else { p.output_channels };
    if !p.bypass && out_ch == 1 {
        for f in &mut rendered {
            f[0] = (f[0] + f[1]) * 0.5;
            f[1] = f[0];
        }
    }
    let measured = metrics(&rendered, sr, out_ch);
    ensure!(
        measured.peak < 1.,
        "Output would clip: reduce gain (peak {})",
        measured.peak
    );
    ensure!(
        src_metrics.rms < 1e-7 || measured.rms > 1e-7,
        "Unexpected silent output"
    );
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    if p.bypass {
        fs::copy(input, output)?;
    } else {
        let mut writer = hound::WavWriter::create(
            output,
            hound::WavSpec {
                channels: out_ch,
                sample_rate: sr,
                bits_per_sample: 32,
                sample_format: hound::SampleFormat::Float,
            },
        )?;
        for x in &rendered {
            for v in &x[..out_ch as usize] {
                writer.write_sample(*v)?;
            }
        }
        writer.finalize()?;
    }
    ensure!(hash(input)? == before, "Source hash changed");
    Ok(
        serde_json::json!({"engine":"FunDSP 0.23.0 / lab 0.1.0","input":input,"output":output,
        "source_sha256":before,"output_sha256":hash(output)?,"preset":p,"input_metrics":src_metrics,
        "output_metrics":measured,"elapsed_s":start.elapsed().as_secs_f64(),"subjective_quality":"requires listening"}),
    )
}
pub fn cli() -> Result<()> {
    let a: Vec<_> = std::env::args().collect();
    if a.len() != 4 {
        bail!("Usage: sonariel-dsp-core input.wav output.wav preset.json");
    }
    let p: Preset = serde_json::from_slice(&fs::read(&a[3])?)?;
    let receipt = render(Path::new(&a[1]), Path::new(&a[2]), &p)?;
    let meta = Path::new(&a[2]).with_extension("json");
    ensure!(!meta.exists(), "Receipt already exists");
    fs::write(meta, serde_json::to_vec_pretty(&receipt)?)?;
    println!("{}", serde_json::to_string_pretty(&receipt)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn preset(effect: Effect, wet: f32) -> Preset {
        Preset {
            name: "test".into(),
            schema_version: 1,
            output_channels: 2,
            tail_seconds: 1.,
            bypass: false,
            chain: vec![Stage { wet, effect }],
        }
    }
    fn impulse() -> Vec<[f32; 2]> {
        let mut x = vec![[0.; 2]; 2400];
        x[0] = [0.1; 2];
        x
    }
    #[test]
    fn dry_is_exact() {
        let p = preset(Effect::Gain { db: -6. }, 0.);
        let x = impulse();
        let y = process(&x, 24000, &p).unwrap();
        assert_eq!(&y[..x.len()], &x);
        assert!(y[x.len()..].iter().all(|x| *x == [0.; 2]));
    }
    #[test]
    fn gain_correct() {
        let p = preset(Effect::Gain { db: -6.0206 }, 1.);
        let y = process(&impulse(), 24000, &p).unwrap();
        assert!((y[0][0] - 0.05).abs() < 1e-6);
    }
    #[test]
    fn delay_arrival_and_decay() {
        let p = preset(
            Effect::Delay {
                ms: 10.,
                feedback: 0.5,
            },
            1.,
        );
        let y = process(&impulse(), 24000, &p).unwrap();
        assert_eq!(y[0], [0.; 2]);
        assert!((y[240][0] - 0.1).abs() < 1e-7);
        assert!((y[480][0] - 0.05).abs() < 1e-7);
    }
    #[test]
    fn reverb_tail_deterministic() {
        let mut p = preset(
            Effect::Reverb {
                room_m: 5.,
                rt60_s: 0.3,
                damping: 0.6,
                predelay_ms: 20.,
            },
            1.,
        );
        p.tail_seconds = 2.;
        let a = process(&impulse(), 24000, &p).unwrap();
        let b = process(&impulse(), 24000, &p).unwrap();
        assert_eq!(a, b);
        assert!(a[2400..6000].iter().flatten().any(|v| v.abs() > 1e-7));
        assert!(metrics(&a, 24000, 2).last_50ms_rms < 1e-5);
    }
    #[test]
    fn fades_reach_zero() {
        let mut p = preset(
            Effect::Fade {
                in_ms: 10.,
                out_ms: 10.,
            },
            1.,
        );
        p.tail_seconds = 0.;
        let y = process(&vec![[0.1; 2]; 1000], 24000, &p).unwrap();
        assert_eq!(y[0], [0.; 2]);
        assert_eq!(y[999], [0.; 2]);
        assert!((y[500][0] - 0.1).abs() < 1e-7);
    }
    #[test]
    fn invalid_rejected() {
        let p = preset(
            Effect::Delay {
                ms: 0.,
                feedback: 1.,
            },
            1.,
        );
        assert!(process(&impulse(), 24000, &p).is_err());
    }
    #[test]
    fn chorus_repeatable() {
        let p = preset(
            Effect::Chorus {
                seed: 11,
                separation_ms: 15.,
                variation_ms: 2.,
                rate_hz: 0.2,
            },
            0.1,
        );
        assert_eq!(
            process(&impulse(), 48000, &p).unwrap(),
            process(&impulse(), 48000, &p).unwrap()
        );
    }
    #[test]
    fn wet_half_is_linear_mix() {
        let p = preset(
            Effect::Delay {
                ms: 10.,
                feedback: 0.,
            },
            0.5,
        );
        let y = process(&impulse(), 24000, &p).unwrap();
        assert!((y[0][0] - 0.05).abs() < 1e-7);
        assert!((y[240][0] - 0.05).abs() < 1e-7);
    }
    #[test]
    fn lowpass_attenuates_high_tone() {
        let x: Vec<_> = (0..24000)
            .map(|i| [0.1 * (std::f32::consts::TAU * 8000. * i as f32 / 24000.).sin(); 2])
            .collect();
        let mut p = preset(Effect::Lowpass { hz: 800., q: 0.707 }, 1.);
        p.tail_seconds = 0.;
        let y = process(&x, 24000, &p).unwrap();
        assert!(metrics(&y[1000..], 24000, 2).rms < 0.002);
    }
    #[test]
    fn chain_order_is_observed() {
        let mut a = preset(
            Effect::Fade {
                in_ms: 50.,
                out_ms: 0.,
            },
            1.,
        );
        a.tail_seconds = 0.;
        a.chain.push(Stage {
            wet: 1.,
            effect: Effect::Delay {
                ms: 10.,
                feedback: 0.,
            },
        });
        let mut b = a.clone();
        b.chain.reverse();
        let x = impulse();
        assert_ne!(
            process(&x, 24000, &a).unwrap(),
            process(&x, 24000, &b).unwrap()
        );
    }
}
