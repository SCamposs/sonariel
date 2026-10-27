export type BeatGrid = { anchor_seconds: number; bpm: number; beats_per_bar: number; bars: number };

/** Uses a user-supplied beat anchor and tempo, never estimated timing. */
export function beatAlignedRegion(grid: BeatGrid, crossfadeMs: number, sampleRate: number, duration: number) {
  if (![grid.anchor_seconds, grid.bpm, grid.beats_per_bar, grid.bars, crossfadeMs, sampleRate, duration].every(Number.isFinite)
    || grid.bpm < 30 || grid.bpm > 300 || ![2, 3, 4, 6].includes(grid.beats_per_bar)
    || !Number.isInteger(grid.bars) || grid.bars < 1 || grid.bars > 32 || crossfadeMs < 0 || sampleRate <= 0) return undefined;
  const anchor = Math.round(grid.anchor_seconds * sampleRate);
  const overlap = Math.round(crossfadeMs * sampleRate / 1000);
  const period = Math.round(60 / grid.bpm * grid.beats_per_bar * grid.bars * sampleRate);
  const first = anchor - overlap, last = anchor + period;
  if (first < 0 || last > Math.round(duration * sampleRate) || period < sampleRate * .1
    || (overlap > 0 && overlap < 2) || overlap > period) return undefined;
  return { start: first / sampleRate, end: last / sampleRate, cycle: period / sampleRate };
}
