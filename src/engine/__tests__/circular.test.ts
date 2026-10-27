import { describe, it, expect } from 'vitest';
import {
  ucmSpeed,
  centripetalAccel,
  centripetalForce,
  period,
  loopHeight,
  loopSpeedSquared,
  loopNormalForce,
  minTopSpeed,
  minLaunchSpeed,
  bankedOptimumSpeed,
  bankedNormal,
  bankedAvailableForce,
} from '../circular.js';

const PI = Math.PI;

/* ── uniform circular motion ─────────────────────────────────────────── */

describe('uniform circular motion', () => {
  it('ω = 2 rad/s, r = 1.5 m, m = 2 kg → v = 3.0 m/s, a_c = 6.0 m/s², F_c = 12.0 N, T = π s', () => {
    expect(ucmSpeed(2, 1.5)).toBeCloseTo(3.0, 9);
    expect(centripetalAccel(2, 1.5)).toBeCloseTo(6.0, 9);
    expect(centripetalForce(2, 2, 1.5)).toBeCloseTo(12.0, 9);
    expect(period(2)).toBeCloseTo(PI, 9);
  });

  it('scaling: doubling ω doubles v, quadruples a_c, halves the period', () => {
    expect(ucmSpeed(4, 1.5)).toBeCloseTo(2 * ucmSpeed(2, 1.5), 12);
    expect(centripetalAccel(4, 1.5)).toBeCloseTo(4 * centripetalAccel(2, 1.5), 12);
    expect(period(4)).toBeCloseTo(period(2) / 2, 12);
  });

  it('F_c = m·a_c for arbitrary m, ω, r', () => {
    const m = 3.7;
    const omega = 1.3;
    const r = 2.6;
    expect(centripetalForce(m, omega, r)).toBeCloseTo(
      m * centripetalAccel(omega, r),
      12,
    );
  });

  it('guards: period throws for ω ≤ 0', () => {
    expect(() => period(0)).toThrow();
    expect(() => period(-2)).toThrow();
  });
});

/* ── loop-the-loop ───────────────────────────────────────────────────── */

describe('loop-the-loop', () => {
  const r = 1;
  const g = 9.8;

  it('height above the bottom: h = r(1 − cos θ) — 0 at the bottom, r at the side, 2r at the top', () => {
    expect(loopHeight(0, r)).toBeCloseTo(0, 12);
    expect(loopHeight(PI / 2, r)).toBeCloseTo(r, 12);
    expect(loopHeight(PI, r)).toBeCloseTo(2 * r, 12);
  });

  it('energy: v² = v₀² − 2gh; at the top v² = v₀² − 4gr (v₀ = 8 → 24.8)', () => {
    expect(loopSpeedSquared(8, 0, r, g)).toBeCloseTo(64, 12);
    expect(loopSpeedSquared(8, PI, r, g)).toBeCloseTo(64 - 4 * g * r, 12);
    expect(loopSpeedSquared(8, PI, r, g)).toBeCloseTo(24.8, 9);
    // arbitrary values agree with the closed form
    const v0 = 6.3;
    const rr = 2.5;
    const gg = 1.62; // Moon
    const theta = 1.1;
    expect(loopSpeedSquared(v0, theta, rr, gg)).toBeCloseTo(
      v0 * v0 - 2 * gg * rr * (1 - Math.cos(theta)),
      12,
    );
  });

  it('normal force: bottom N = m(v²/r + g) = 73.8 N for v₀ = 8; top N = m(v²/r − g)', () => {
    // launched at v₀ = 8: v² at the bottom is 64 → N = 64 + 9.8 = 73.8
    expect(loopNormalForce(1, 64, 0, r, g)).toBeCloseTo(73.8, 9);
    // v_top² = 24.8 at the top: N = 24.8 − 9.8 = 15.0
    expect(loopNormalForce(1, 24.8, PI, r, g)).toBeCloseTo(15.0, 9);
    // v² = g·r at the top is exactly the contact boundary: N = 0
    expect(loopNormalForce(1, g * r, PI, r, g)).toBeCloseTo(0, 12);
    // arbitrary values
    const m = 2.5;
    const rr = 0.7;
    const gg = 1.62;
    const theta = 2.2;
    const v2 = 12.1;
    expect(loopNormalForce(m, v2, theta, rr, gg)).toBeCloseTo(
      m * (v2 / rr + gg * Math.cos(theta)),
      12,
    );
  });

  it('minimum speeds: v_top,min = √(gr) ≈ 3.13 m/s, v₀,min = √(5gr) = 7.0 m/s', () => {
    expect(minTopSpeed(r, g)).toBeCloseTo(Math.sqrt(9.8), 12);
    expect(minTopSpeed(r, g)).toBeCloseTo(3.13, 2);
    expect(minLaunchSpeed(r, g)).toBeCloseTo(Math.sqrt(49), 9); // √(5·9.8) = 7.0
    expect(minLaunchSpeed(r, g)).toBeCloseTo(7.0, 9);
    // launching at v₀,min leaves exactly v_top² = g·r at the top
    expect(loopSpeedSquared(minLaunchSpeed(r, g), PI, r, g)).toBeCloseTo(g * r, 9);
    // the brief's boundary case: v₀ = 7 → v_top² = 9.8 = g·r exactly
    expect(loopSpeedSquared(7, PI, r, g)).toBeCloseTo(9.8, 9);
    expect(loopSpeedSquared(7, PI, r, g)).toBeCloseTo(g * r, 9);
  });

  it('guards: loop radius must be positive', () => {
    expect(() => loopNormalForce(1, 10, 0, 0, g)).toThrow();
    expect(() => loopNormalForce(1, 10, PI, -1, g)).toThrow();
  });
});

/* ── banked curve ────────────────────────────────────────────────────── */

describe('banked curve', () => {
  const r = 50;
  const g = 9.8;
  const m = 2;
  const theta = PI / 6; // 30°
  const tan30 = Math.tan(theta);
  const cos30 = Math.cos(theta);

  it('v_opt = √(r·g·tan θ) ≈ 16.82 m/s for r = 50 m, θ = 30° (brief: 16.817)', () => {
    const expected = Math.sqrt(r * g * tan30);
    expect(bankedOptimumSpeed(r, g, theta)).toBeCloseTo(expected, 12);
    expect(bankedOptimumSpeed(r, g, theta)).toBeCloseTo(16.82, 2);
    // satisfies the balance condition tan θ = v²/(r·g)
    const v = bankedOptimumSpeed(r, g, theta);
    expect((v * v) / (r * g)).toBeCloseTo(tan30, 9);
  });

  it('N = m·g/cos θ ≈ 22.632 N; available = m·g·tan θ ≈ 11.316 N (brief: 11.315)', () => {
    expect(bankedNormal(m, g, theta)).toBeCloseTo((2 * 9.8) / cos30, 12);
    expect(bankedNormal(m, g, theta)).toBeCloseTo(22.632, 3);
    expect(bankedAvailableForce(m, g, theta)).toBeCloseTo(2 * 9.8 * tan30, 12);
    expect(bankedAvailableForce(m, g, theta)).toBeCloseTo(11.315, 2);
    // Moon gravity scales both
    expect(bankedNormal(m, 1.62, theta)).toBeCloseTo((2 * 1.62) / cos30, 12);
  });

  it('at v_opt the required centripetal force m·v²/r equals the available m·g·tan θ (1e-6)', () => {
    const vOpt = bankedOptimumSpeed(r, g, theta);
    const required = (m * vOpt * vOpt) / r;
    const available = bankedAvailableForce(m, g, theta);
    expect(Math.abs(required - available)).toBeLessThan(1e-6);
  });

  it('guards: bank angle below 90°, turn radius positive', () => {
    expect(() => bankedNormal(2, 9.8, PI / 2)).toThrow();
    expect(() => bankedOptimumSpeed(0, 9.8, theta)).toThrow();
  });
});
