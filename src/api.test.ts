import { describe, expect, it } from 'vitest';
import { formatTime, secondsSince } from './api';

describe('audio timeline', () => {
  it('formats short and long elapsed times without implying a remaining-time prediction', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(125.9)).toBe('2:05');
    expect(formatTime(Number.NaN)).toBe('0:00');
  });
  it('does not show elapsed time before a job starts', () => {
    expect(secondsSince(null)).toBe(0);
    expect(secondsSince(Date.now() / 1000 + 10)).toBe(0);
  });
});
