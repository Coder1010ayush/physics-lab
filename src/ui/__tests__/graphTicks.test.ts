import { describe, it, expect } from 'vitest';
import { niceTicks } from '../graphTicks';

describe('niceTicks — regression: degenerate floating-point ranges', () => {
  // Bug fixed 2026-10-27: launching the projectile at exactly 45° fed the
  // velocity-components graph two values 1 ulp apart (vx0 vs vy0). The tick
  // step came out below the ulp of the values, so t += step never changed t
  // and the loop pushed until RangeError: Invalid array length — killing the
  // whole React tree when Start was clicked.
  it('returns a small tick list for a 1-ulp range instead of hanging', () => {
    const a = 14.14213562373095;
    const b = 14.142135623730951; // a + 1 ulp
    const ticks = niceTicks(a, b, 4);
    expect(Array.isArray(ticks)).toBe(true);
    expect(ticks.length).toBeLessThanOrEqual(8);
  });

  it('returns the single value for an exactly equal range', () => {
    expect(niceTicks(3, 3)).toEqual([3]);
  });

  it('handles a zero-height range', () => {
    expect(niceTicks(0, 0)).toEqual([0]);
  });

  it('handles non-finite inputs without throwing', () => {
    const ticks = niceTicks(Number.NaN, 1);
    expect(Array.isArray(ticks)).toBe(true);
  });
});

describe('niceTicks — normal ranges', () => {
  it('gives 1/2/5-style steps for unit ranges', () => {
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.5, 1]);
    expect(niceTicks(-0.1, 1.1)).toEqual([0, 0.5, 1]);
  });

  it('steps by 1 over a 2-unit span near 15', () => {
    expect(niceTicks(13.59, 15.61, 4)).toEqual([14, 15]);
  });

  it('includes zero when it lies inside a negative-to-positive range', () => {
    expect(niceTicks(-5, 5)).toContain(0);
  });

  it('scales up for large ranges', () => {
    const ticks = niceTicks(0, 246.9, 5);
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks.length).toBeLessThan(30);
    expect(ticks).toContain(100);
  });
});
