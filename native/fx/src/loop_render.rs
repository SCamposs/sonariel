//! Circular overlap editing. No resynthesis, fades to silence, or source writes.
use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use sonariel_dsp_core as fx;
use std::{fs, path::Path, time::Instant};

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LoopRecipe {
    pub operation: String,
    pub schema_version: u32,
    pub name: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub crossfade_ms: f64,
    pub repetitions: usize,
}

fn cycle(source: &[[f32; 2]], sr: u32, recipe: &LoopRecipe) -> Result<Vec<[f32; 2]>> {
    ensure!(recipe.operation == "loop" && recipe.schema_version == 1, "Unknown loop recipe");
    ensure!(recipe.start_seconds.is_finite() && recipe.end_seconds.is_finite()
        && recipe.crossfade_ms.is_finite(), "Nonfinite loop parameter");
    ensure!(recipe.start_seconds >= 0. && recipe.end_seconds > recipe.start_seconds
        && recipe.crossfade_ms >= 0., "Invalid loop region");
    let start = (recipe.start_seconds * sr as f64).round() as usize;
    let end = (recipe.end_seconds * sr as f64).round() as usize;
    let overlap = (recipe.crossfade_ms * sr as f64 / 1000.).round() as usize;
    ensure!(end <= source.len() && end > start && end - start >= (sr / 10) as usize,
        "Loop region must fit source and contain at least 0.1 seconds");
    let selected = &source[start..end];
    ensure!(overlap == 0 || (overlap >= 2 && overlap <= selected.len() / 2),
        "Crossfade must contain at least two frames and fit half the region");
    ensure!(selected.iter().flatten().all(|v| v.is_finite()), "Nonfinite source");
    if overlap == 0 { return Ok(selected.to_vec()); }
    // Rotate the seam into the cycle. Interior -> tail/head overlap -> interior.
    // Linear convex weights avoid the gain increase of equal-power crossfades.
    let mut output = selected[overlap..selected.len() - overlap].to_vec();
    for index in 0..overlap {
        let head = index as f64 / (overlap - 1) as f64;
        let tail = 1. - head;
        output.push(std::array::from_fn(|channel| {
            (selected[selected.len() - overlap + index][channel] as f64 * tail
                + selected[index][channel] as f64 * head) as f32
        }));
    }
    Ok(output)
}

pub fn render(input: &Path, output: &Path, raw: &[u8]) -> Result<()> {
    let recipe: LoopRecipe = serde_json::from_slice(raw)?;
    ensure!((1..=4).contains(&recipe.repetitions), "Loop repetitions must be 1..4");
    let started = Instant::now();
    let before = fx::hash(input)?;
    let (source, sr, channels) = fx::load(input)?;
    let edited = cycle(&source, sr, &recipe)?;
    ensure!(edited.len() * recipe.repetitions <= sr as usize * 600,
        "Loop preview/output limit: ten minutes; select a shorter region or fewer repetitions");
    let seam_delta = (0..2).map(|c| (edited[edited.len() - 1][c] - edited[0][c]).abs())
        .fold(0_f32, f32::max);
    let repeated = edited.repeat(recipe.repetitions);
    sonariel_transform::write(output, &repeated, sr)?;
    ensure!(fx::hash(input)? == before, "Source changed");
    let receipt = serde_json::json!({
        "engine":"sonariel-fx", "operation":"loop", "recipe":recipe,
        "source_sha256":before, "output_sha256":fx::hash(output)?,
        "source_channels":channels, "output_channels":2, "loop_frames":edited.len(),
        "loop_duration_seconds":edited.len() as f64 / sr as f64,
        "source_start_frame":(recipe.start_seconds * sr as f64).round() as usize,
        "source_end_frame":(recipe.end_seconds * sr as f64).round() as usize,
        "crossfade_frames":(recipe.crossfade_ms * sr as f64 / 1000.).round() as usize,
        "seam_delta":seam_delta, "metrics":fx::metrics(&repeated,sr,2),
        "elapsed_s":started.elapsed().as_secs_f64(),
        "method":"circular linear overlap; output duration is region minus crossfade; no automatic beat alignment",
        "watermark":"Original preserved. Detectability after processing not asserted."
    });
    fs::write(output.with_extension("json"), serde_json::to_vec_pretty(&receipt)?)?;
    println!("{}", serde_json::to_string(&receipt)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn recipe() -> LoopRecipe {
        LoopRecipe { operation:"loop".into(),schema_version:1,name:"Test".into(),
            start_seconds:0.1,end_seconds:0.9,crossfade_ms:50.,repetitions:1 }
    }
    #[test]
    fn circular_seam_is_an_adjacent_source_pair_and_does_not_clip() {
        let source: Vec<_> = (0..8000).map(|i| [(i as f32 * 0.025).sin() * 0.6; 2]).collect();
        let original = source.clone();
        let edited = cycle(&source,8000,&recipe()).unwrap();
        assert_eq!(edited.len(),6000);
        assert_eq!(edited[0],source[1200]);
        assert_eq!(edited[edited.len()-1],source[1199]);
        assert!((edited[0][0]-edited[edited.len()-1][0]).abs() < 0.016);
        assert!(edited.iter().flatten().all(|v| v.abs() <= 0.6));
        assert_eq!(source,original);
    }
    #[test]
    fn zero_crossfade_crops_without_modifying_samples() {
        let source=vec![[0.1,0.2];8000];
        let mut p=recipe();p.crossfade_ms=0.;
        assert_eq!(cycle(&source,8000,&p).unwrap(),source[800..7200]);
    }
    #[test]
    fn invalid_regions_and_overlaps_are_rejected() {
        let source=vec![[0.1;2];8000];let mut p=recipe();
        p.end_seconds=1.1;assert!(cycle(&source,8000,&p).is_err());
        p.end_seconds=0.9;p.crossfade_ms=401.;assert!(cycle(&source,8000,&p).is_err());
        p.crossfade_ms=f64::NAN;assert!(cycle(&source,8000,&p).is_err());
    }
}
