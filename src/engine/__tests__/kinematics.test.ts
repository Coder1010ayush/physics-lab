import { describe, it, expect } from 'vitest';
import { Vec2 } from '../vec2.js';
import { semiImplicitEuler, FixedStepClock } from '../integrator.js';

const DT = 1 / 240; // fixed timestep [s]

describe('semiImplicitEuler — 1D kinematics vs closed form', () => {
  it('u = 3 m/s, a = 1.5 m/s², t = 2 s → s ≈ 9 m, v ≈ 6 m/s', () => {
    const u = 3; // [m/s]
    const a = 1.5; // [m/s²]
    const T = 2.0; // [s]

    let pos = new Vec2(0, 0);
    let vel = new Vec2(u, 0);
    const acc = new Vec2(a, 0);

    const steps = Math.round(T / DT);
    for (let i = 0; i < steps; i++) {
      ({ pos, vel } = semiImplicitEuler(pos, vel, acc, DT));
    }

    // Closed form: s = ut + ½at² = 3·2 + 0.5·1.5·4 = 9.0 m
    const sExact = u * T + 0.5 * a * T * T;
    expect(sExact).toBeCloseTo(9.0, 10);
    // Position within 0.5% of the closed form.
    expect(Math.abs(pos.x - sExact) / sExact).toBeLessThan(0.005);
    expect(pos.x).toBeGreaterThan(8.955);
    expect(pos.x).toBeLessThan(9.045);

    // v = u + at = 6 m/s — exact for constant acceleration.
    const vExact = u + a * T;
    expect(vExact).toBeCloseTo(6.0, 10);
    expect(Math.abs(vel.x - vExact) / vExact).toBeLessThan(0.001);
    expect(vel.x).toBeCloseTo(6.0, 6);

    // y components untouched (motion purely along x).
    expect(pos.y).toBe(0);
    expect(vel.y).toBe(0);
  });

  it('is pure — inputs are never mutated', () => {
    const pos = new Vec2(1, 2);
    const vel = new Vec2(3, 4);
    const acc = new Vec2(0, -9.8);
    const out = semiImplicitEuler(pos, vel, acc, DT);
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(2);
    expect(vel.x).toBe(3);
    expect(vel.y).toBe(4);
    expect(out.pos).not.toBe(pos);
    expect(out.vel).not.toBe(vel);
  });
});

describe('FixedStepClock — determinism', () => {
  it('same frameDt sequence always yields identical step lists', () => {
    const frames = [0.016, 0.017, 0.005, 0.25, 0.008, 0.033, 0.0012, 0.05];

    const run = () => {
      const clock = new FixedStepClock(1 / 240, 10);
      return frames.map((f) => clock.advance(f));
    };

    const first = run();
    const second = run();
    expect(second).toEqual(first);

    // Sanity: steps are always the fixed dt, never more than the cap.
    for (const steps of first) {
      expect(steps.length).toBeLessThanOrEqual(10);
      for (const dt of steps) expect(dt).toBeCloseTo(1 / 240, 12);
    }
  });

  it('accumulates sub-step frame time across frames (no time lost)', () => {
    const clock = new FixedStepClock(1 / 240, 10);
    // 240 frames of 1/480 s → exactly 120 steps total.
    let totalSteps = 0;
    for (let i = 0; i < 240; i++) totalSteps += clock.advance(1 / 480).length;
    expect(totalSteps).toBe(120);
  });

  it('caps steps per frame and does not spiral', () => {
    const clock = new FixedStepClock(1 / 240, 10);
    const steps = clock.advance(10); // a huge frame
    expect(steps.length).toBe(10);
    // Excess was discarded: the next small frame yields no leftover burst.
    expect(clock.advance(0.001).length).toBeLessThanOrEqual(10);
  });

  it('returns no steps for frames shorter than fixedDt', () => {
    const clock = new FixedStepClock(1 / 240, 10);
    expect(clock.advance(0.0001)).toEqual([]);
  });
});
