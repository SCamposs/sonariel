import { expect, it } from "vitest";
import { beatAlignedRegion } from "./loop-grid";

it("keeps the audible downbeat and full bar period after overlap", () => {
  const grid = { anchor_seconds: 4, bpm: 120, beats_per_bar: 4, bars: 2 };
  const result = beatAlignedRegion(grid, 200, 48000, 15)!;
  expect(result.start).toBe(3.8);
  expect(result.end).toBe(8);
  expect(result.cycle).toBe(4);
  expect(result.end - result.start - .2).toBeCloseTo(4);
  expect(result.start + .2).toBeCloseTo(grid.anchor_seconds);
});
it("does not fabricate a valid region without headroom or known grid values", () => {
  const grid = { anchor_seconds: 0, bpm: 72, beats_per_bar: 4, bars: 2 };
  expect(beatAlignedRegion(grid, 200, 44100, 30)).toBeUndefined();
  expect(beatAlignedRegion({ ...grid, anchor_seconds: 4, bars: 32 }, 200, 44100, 30)).toBeUndefined();
  expect(beatAlignedRegion({ ...grid, bpm: NaN }, 200, 44100, 30)).toBeUndefined();
});
