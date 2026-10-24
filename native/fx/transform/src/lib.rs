use anyhow::{Result, ensure};
use ebur128::{EbuR128, Mode};
use serde::{Deserialize, Serialize};
pub use sonariel_dsp_core::{hash, load, metrics};
use std::{fs, path::Path, time::Instant};

unsafe extern "C" {
    fn essence_stretch(
        l: *const f32,
        r: *const f32,
        n: i32,
        ol: *mut f32,
        or: *mut f32,
        on: i32,
        sr: i32,
        pitch: f32,
        formant: f32,
        seed: u32,
    ) -> i32;
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Fragment {
    pub id: String,
    pub start_ms: f32,
    pub end_ms: f32,
    pub stretch_ratio: f32,
    pub gain_db: f32,
    pub gap_before_ms: f32,
    pub enabled: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Recipe {
    pub schema_version: u32,
    pub name: String,
    pub target_lufs: f64,
    pub ceiling_dbtp: f64,
    pub lead_ms: f32,
    pub tail_ms: f32,
    pub splice_ms: f32,
    pub edge_fade_ms: f32,
    pub seed: u32,
    pub bypass: bool,
    pub fragments: Vec<Fragment>,
}
pub fn stretch(
    input: &[[f32; 2]],
    sr: u32,
    ratio: f32,
    pitch: f32,
    formant: f32,
    seed: u32,
) -> Result<Vec<[f32; 2]>> {
    ensure!(
        (0.75..=1.5).contains(&ratio),
        "Time ratio outside tested range"
    );
    ensure!(
        pitch.is_finite() && formant.is_finite() && pitch.abs() <= 12. && formant.abs() <= 6.,
        "Invalid pitch/formant"
    );
    ensure!(
        (8000..=192000).contains(&sr) && !input.is_empty(),
        "Invalid input shape"
    );
    ensure!(
        input.iter().flatten().all(|v| v.is_finite()),
        "Nonfinite input"
    );
    let pad = (sr as f32 * 0.16).round() as usize;
    let n = input.len() + 2 * pad;
    let out_len = (input.len() as f32 * ratio).round() as usize;
    let padded_out = (n as f32 * ratio).round() as usize;
    ensure!(
        n <= i32::MAX as usize && padded_out <= i32::MAX as usize,
        "Buffer too large"
    );
    let mut left = vec![0.; n];
    let mut right = left.clone();
    for (i, x) in input.iter().enumerate() {
        left[i + pad] = x[0];
        right[i + pad] = x[1];
    }
    let mut ol = vec![0.; padded_out];
    let mut or = ol.clone();
    // The C ABI owns no buffers and catches all exceptions; lengths match allocations.
    let rc = unsafe {
        essence_stretch(
            left.as_ptr(),
            right.as_ptr(),
            n as i32,
            ol.as_mut_ptr(),
            or.as_mut_ptr(),
            padded_out as i32,
            sr as i32,
            pitch,
            formant,
            seed,
        )
    };
    ensure!(rc == 0, "Signalsmith exact failed ({rc})");
    let begin = (pad as f32 * ratio).round() as usize;
    ensure!(begin + out_len <= padded_out, "Invalid latency trim");
    let out: Vec<_> = (begin..begin + out_len).map(|i| [ol[i], or[i]]).collect();
    ensure!(
        out.iter().flatten().all(|v| v.is_finite()),
        "Nonfinite Signalsmith output"
    );
    Ok(out)
}
#[derive(Debug, Serialize)]
pub struct Loudness {
    pub lufs: f64,
    pub true_peak: f64,
    pub dbtp: f64,
}
pub fn loudness(data: &[[f32; 2]], sr: u32) -> Result<Loudness> {
    ensure!(
        data.len() >= sr as usize * 4 / 10,
        "Need 400ms for integrated loudness"
    );
    let mut meter = EbuR128::new(2, sr, Mode::I | Mode::TRUE_PEAK)?;
    let interleaved: Vec<_> = data.iter().flatten().copied().collect();
    meter.add_frames_f32(&interleaved)?;
    let lufs = meter.loudness_global()?;
    let peak = meter.true_peak(0)?.max(meter.true_peak(1)?);
    ensure!(
        lufs.is_finite() && peak > 0.,
        "Silence has no finite loudness"
    );
    Ok(Loudness {
        lufs,
        true_peak: peak,
        dbtp: 20. * peak.log10(),
    })
}
pub fn normalize(
    data: &mut [[f32; 2]],
    sr: u32,
    target: f64,
    ceiling: f64,
) -> Result<serde_json::Value> {
    ensure!(
        (-36. ..=-16.).contains(&target) && (-6. ..=-0.5).contains(&ceiling),
        "Unsafe normalization target"
    );
    let before = loudness(data, sr)?;
    let gain_db = target - before.lufs;
    let gain = 10_f64.powf(gain_db / 20.);
    ensure!(
        before.dbtp + gain_db <= ceiling,
        "Cannot loudness-match without exceeding true peak: choose lower common target ({} dBTP)",
        before.dbtp + gain_db
    );
    for x in data.iter_mut() {
        x[0] *= gain as f32;
        x[1] *= gain as f32;
    }
    let after = loudness(data, sr)?;
    ensure!(
        (after.lufs - target).abs() < 0.15 && after.dbtp <= ceiling + 0.02,
        "Normalization validation failed"
    );
    Ok(
        serde_json::json!({"method":"EBU R128 integrated stereo BS1770; static gain, no limiter","before":before,"after":after,"gain_db":gain_db,"ceiling_dbtp":ceiling}),
    )
}
fn range(v: f32, a: f32, b: f32) -> Result<()> {
    ensure!(
        v.is_finite() && v >= a && v <= b,
        "Parameter outside bounds: {v}"
    );
    Ok(())
}
pub fn edit(input: &[[f32; 2]], sr: u32, p: &Recipe) -> Result<Vec<[f32; 2]>> {
    ensure!(p.schema_version == 2, "Unknown schema");
    if p.bypass {
        return Ok(input.to_vec());
    }
    range(p.lead_ms, 0., 500.)?;
    range(p.tail_ms, 0., 2000.)?;
    range(p.splice_ms, 0., 20.)?;
    range(p.edge_fade_ms, 0.5, 10.)?;
    ensure!(
        !p.fragments.is_empty() && p.fragments.len() <= 12,
        "Invalid fragment count"
    );
    let mut out = vec![[0.; 2]; (p.lead_ms * sr as f32 / 1000.).round() as usize];
    for f in &p.fragments {
        if !f.enabled {
            continue;
        }
        range(f.start_ms, 0., input.len() as f32 * 1000. / sr as f32)?;
        range(
            f.end_ms,
            f.start_ms + 40.,
            input.len() as f32 * 1000. / sr as f32,
        )?;
        range(f.gain_db, -18., 6.)?;
        range(f.gap_before_ms, 0., 500.)?;
        range(f.stretch_ratio, 0.75, 1.5)?;
        let start = (f.start_ms * sr as f32 / 1000.).round() as usize;
        let end = (f.end_ms * sr as f32 / 1000.).round() as usize;
        let gain = 10_f32.powf(f.gain_db / 20.);
        let mut part = if (f.stretch_ratio - 1.).abs() < 1e-6 {
            input[start..end].to_vec()
        } else {
            stretch(&input[start..end], sr, f.stretch_ratio, 0., 0., p.seed)?
        };
        let fade = (p.edge_fade_ms * sr as f32 / 1000.).round() as usize;
        let len = part.len();
        for (i, x) in part.iter_mut().enumerate() {
            let a = (i as f32 / fade as f32).min(1.);
            let b = ((len - 1 - i) as f32 / fade as f32).min(1.);
            let env = (a * std::f32::consts::FRAC_PI_2).sin()
                * (b * std::f32::consts::FRAC_PI_2).sin()
                * gain;
            x[0] *= env;
            x[1] *= env;
        }
        let gap = (f.gap_before_ms * sr as f32 / 1000.).round() as usize;
        if gap > 0 {
            out.resize(out.len() + gap, [0.; 2]);
        }
        let overlap = if gap > 0 {
            0
        } else {
            std::cmp::min(
                (p.splice_ms * sr as f32 / 1000.).round() as usize,
                std::cmp::min(out.len(), part.len()),
            )
        };
        let offset = out.len() - overlap;
        for i in 0..overlap {
            let t = if overlap < 2 {
                1.
            } else {
                i as f32 / (overlap - 1) as f32
            };
            let a = (t * std::f32::consts::FRAC_PI_2).cos();
            let b = (t * std::f32::consts::FRAC_PI_2).sin();
            for c in 0..2 {
                out[offset + i][c] = out[offset + i][c] * a + part[i][c] * b;
            }
        }
        out.extend_from_slice(&part[overlap..]);
    }
    ensure!(
        out.iter().flatten().any(|v| v.abs() > 1e-5),
        "All events disabled or silent"
    );
    out.resize(
        out.len() + (p.tail_ms * sr as f32 / 1000.).round() as usize,
        [0.; 2],
    );
    Ok(out)
}
pub fn write(path: &Path, data: &[[f32; 2]], sr: u32) -> Result<()> {
    ensure!(!path.exists(), "Refusing overwrite");
    let m = metrics(data, sr, 2);
    ensure!(
        m.clipping_samples == 0 && m.rms > 1e-7,
        "Clipped/silent output"
    );
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut w = hound::WavWriter::create(
        path,
        hound::WavSpec {
            channels: 2,
            sample_rate: sr,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        },
    )?;
    for x in data {
        w.write_sample(x[0])?;
        w.write_sample(x[1])?;
    }
    w.finalize()?;
    Ok(())
}
pub fn render(
    input: &Path,
    output: &Path,
    recipe: Option<&Recipe>,
    target: f64,
) -> Result<serde_json::Value> {
    ensure!(
        !output.exists() && !output.with_extension("json").exists(),
        "Output or receipt exists"
    );
    let t = Instant::now();
    let before = hash(input)?;
    let (data, sr, _) = load(input)?;
    let mut out = if let Some(p) = recipe {
        edit(&data, sr, p)?
    } else {
        data
    };
    let ceiling = recipe.map(|p| p.ceiling_dbtp).unwrap_or(-1.);
    let norm = normalize(&mut out, sr, target, ceiling)?;
    write(output, &out, sr)?;
    ensure!(hash(input)? == before, "Source changed");
    let result = serde_json::json!({"engine":"essence-fx 0.2.0 / Signalsmith Stretch 1.3.2","source":std::path::absolute(input)?,"output":std::path::absolute(output)?,"source_sha256":before,"output_sha256":hash(output)?,"recipe":recipe,"normalization":norm,"metrics":metrics(&out,sr,2),"elapsed_s":t.elapsed().as_secs_f64(),"watermark":"source unmodified; no removal intent; post-transform detectability not asserted"});
    fs::write(
        output.with_extension("json"),
        serde_json::to_vec_pretty(&result)?,
    )?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn tone() -> Vec<[f32; 2]> {
        (0..24000)
            .map(|i| [0.08 * (std::f32::consts::TAU * 220. * i as f32 / 24000.).sin(); 2])
            .collect()
    }
    fn frequency(x: &[[f32; 2]]) -> f64 {
        let center = &x[4800..19200];
        center
            .windows(2)
            .filter(|f| f[0][0] <= 0. && f[1][0] > 0.)
            .count() as f64
            / 0.6
    }
    #[test]
    fn exact_stretch_length_and_seed() {
        let x = tone();
        let a = stretch(&x, 24000, 1.12, 0., 0., 11).unwrap();
        let b = stretch(&x, 24000, 1.12, 0., 0., 11).unwrap();
        assert_eq!(a.len(), 26880);
        assert_eq!(a, b);
        assert!(metrics(&a, 24000, 2).rms > 0.01);
        assert!((frequency(&a) - 220.).abs() < 4.);
    }
    #[test]
    fn pitch_shift_keeps_length() {
        let x = tone();
        let a = stretch(&x, 24000, 1., 7., 0., 11).unwrap();
        assert_eq!(a.len(), x.len());
        assert!(metrics(&a, 24000, 2).rms > 0.001);
        assert_ne!(a, x);
        assert!((frequency(&a) - 220. * 2_f64.powf(7. / 12.)).abs() < 4.);
    }
    #[test]
    fn short_fragment_padded_not_silent() {
        let x = tone();
        let a = stretch(&x[..2000], 24000, 0.85, 0., 0., 11).unwrap();
        assert_eq!(a.len(), 1700);
        assert!(metrics(&a, 24000, 2).rms > 0.01);
    }
    #[test]
    fn loudness_match() {
        let mut x = tone();
        let n = normalize(&mut x, 24000, -26., -1.).unwrap();
        assert!((n["after"]["lufs"].as_f64().unwrap() + 26.).abs() < 0.05);
    }
    #[test]
    fn formant_shift_is_repeatable() {
        let x = tone();
        let a = stretch(&x, 24000, 1., 0., 3., 3).unwrap();
        assert_eq!(a, stretch(&x, 24000, 1., 0., 3., 3).unwrap());
    }
    fn recipe() -> Recipe {
        Recipe {
            schema_version: 2,
            name: "test".into(),
            target_lufs: -26.,
            ceiling_dbtp: -1.,
            lead_ms: 50.,
            tail_ms: 100.,
            splice_ms: 7.,
            edge_fade_ms: 2.,
            seed: 42,
            bypass: false,
            fragments: vec![
                Fragment {
                    id: "a".into(),
                    start_ms: 50.,
                    end_ms: 250.,
                    stretch_ratio: 1.,
                    gain_db: 0.,
                    gap_before_ms: 0.,
                    enabled: true,
                },
                Fragment {
                    id: "b".into(),
                    start_ms: 350.,
                    end_ms: 550.,
                    stretch_ratio: 1.,
                    gain_db: 0.,
                    gap_before_ms: 40.,
                    enabled: true,
                },
            ],
        }
    }
    #[test]
    fn edit_bypass_and_per_event_disable() {
        let x = tone();
        let mut p = recipe();
        let full = edit(&x, 24000, &p).unwrap();
        p.fragments[1].enabled = false;
        let short = edit(&x, 24000, &p).unwrap();
        assert!(full.len() > short.len());
        p.bypass = true;
        assert_eq!(edit(&x, 24000, &p).unwrap(), x);
    }
    #[test]
    fn edit_fades_and_order() {
        let x = tone();
        let p = recipe();
        let a = edit(&x, 24000, &p).unwrap();
        assert_eq!(a[0], [0.; 2]);
        assert_eq!(a[a.len() - 1], [0.; 2]);
        assert!(metrics(&a, 24000, 2).max_adjacent_delta < 0.02);
        let mut b = p.clone();
        b.fragments.reverse();
        assert_ne!(a, edit(&x, 24000, &b).unwrap());
    }
    #[test]
    fn invalid_regions_and_ratio_rejected() {
        let x = tone();
        let mut p = recipe();
        p.fragments[0].end_ms = 2000.;
        assert!(edit(&x, 24000, &p).is_err());
        assert!(stretch(&x, 24000, 0.1, 0., 0., 1).is_err());
    }
}
