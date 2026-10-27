import { describe, it, expect } from 'vitest';
import { FrictionSim, type FrictionParams } from '../friction.js';
import { G, slideAcceleration, willSlide } from '../../engine/forces.js';

const DT = 1 / 240; // fixed timestep [s]

const HORIZONTAL: FrictionParams = {
  mode: 'horizontal',
  mass: 5,
  muS: 0.5,
  muK: 0.3,
  inclineAngleDeg: 0,
};

const INCLINE: FrictionParams = {
  mode: 'incline',
  mass: 5,
  muS: 0.4,
  muK: 0.3,
  inclineAngleDeg: 20,
};

/** Start the sim and advance it by `seconds` of simulated time. */
function runFor(sim: FrictionSim, seconds: number): void {
  sim.start();
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    if (sim.getPhase() !== 'running') break;
    sim.step(DT);
  }
}

describe('FrictionSim — horizontal: push ramps up until the block breaks loose', () => {
  // m = 5 kg → N = mg = 49 N; static limit μs·N = 0.5 × 49 = 24.5 N.
  // The push ramps at 3 N/s → threshold at t = 24.5 / 3 ≈ 8.1667 s.
  const N = 5 * G;
  const fsMax = 0.5 * N; // 24.5 N
  const fk = 0.3 * N; // 14.7 N
  const tSlide = fsMax / 3; // ≈ 8.1667 s

  it('sticks below the threshold: x stays 0 and friction matches the push', () => {
    const sim = new FrictionSim(HORIZONTAL);
    runFor(sim, 8); // still under 24.5 N at t = 8 s
    const s = sim.getSnapshot();
    expect(s.t).toBeCloseTo(8, 5);
    expect(s.x).toBe(0); // never moved
    expect(s.v).toBe(0);
    expect(s.sliding).toBe(false);
    expect(s.applied).toBeCloseTo(3 * 8, 5); // F = 3 N/s × 8 s = 24 N
    expect(s.friction).toBeCloseTo(s.applied, 8); // static friction matches F
    expect(s.friction).toBeLessThanOrEqual(fsMax);
  });

  it('friction staircase: capped at μs·N = 24.5 N, then drops to μk·N = 14.7 N', () => {
    const sim = new FrictionSim(HORIZONTAL);
    runFor(sim, 10); // past the threshold (sliding since ≈ 8.17 s)
    const s = sim.getSnapshot();
    expect(s.sliding).toBe(true);

    // Sampled friction never exceeds the static limit.
    for (const [, f] of s.frictionSamples) {
      expect(f).toBeLessThanOrEqual(fsMax + 1e-9);
    }
    // Before sliding: friction tracks the ramp (a staircase under the limit).
    const before = s.frictionSamples.filter(([t]) => t < tSlide - 0.1);
    expect(before.length).toBeGreaterThan(3);
    for (const [t, f] of before) {
      expect(Math.abs(f - 3 * t)).toBeLessThan(0.2); // f = F(t) = 3t
    }
    // After sliding: kinetic friction, flat at μk·N = 14.7 N.
    const after = s.frictionSamples.filter(([t]) => t > tSlide + 0.5);
    expect(after.length).toBeGreaterThan(3);
    for (const [, f] of after) {
      expect(Math.abs(f - fk) / fk).toBeLessThan(0.01);
    }
  });

  it('slides above the threshold: a ≈ (F − μk·N)/m within 1%', () => {
    const sim = new FrictionSim(HORIZONTAL);
    runFor(sim, 9);
    const v1 = sim.getSnapshot().v;
    const t1 = sim.getSnapshot().t;
    for (let i = 0; i < Math.round(1 / DT); i++) sim.step(DT); // t = 10 s
    const s = sim.getSnapshot();
    expect(s.t).toBeCloseTo(10, 5);

    // Measured acceleration over the last second vs the closed form at the
    // midpoint t ≈ 9.5 s: a = (F − μk·N)/m.
    const tMid = (t1 + s.t) / 2;
    const F = 3 * tMid; // push at the midpoint (still ramping, < 60 N)
    const aExpected = (F - fk) / 5;
    const aMeasured = (s.v - v1) / (s.t - t1);
    expect(Math.abs(aMeasured - aExpected) / aExpected).toBeLessThan(0.01);
  });

  it('auto-completes when the push ramps up to F_MAX = 60 N (t = 20 s)', () => {
    const sim = new FrictionSim(HORIZONTAL);
    sim.start();
    let guard = 0;
    while (sim.getPhase() === 'running' && guard < 20000) {
      sim.step(DT);
      guard++;
    }
    const s = sim.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.applied).toBeCloseTo(60, 6);
    expect(s.t).toBeCloseTo(20, 2);
    expect(guard).toBeLessThan(20000);
  });
});

describe('FrictionSim — incline: angle of repose decides stick or slide', () => {
  it('θ = 20° < θ* (tan 20° ≈ 0.364 < μs = 0.4): stays at rest forever', () => {
    const sim = new FrictionSim(INCLINE);
    runFor(sim, 5);
    const s = sim.getSnapshot();
    expect(s.x).toBe(0);
    expect(s.v).toBe(0);
    expect(s.sliding).toBe(false);
    // Static friction holds the block: f = mg sin θ.
    const fHold = 5 * G * Math.sin((20 * Math.PI) / 180);
    expect(Math.abs(s.friction - fHold) / fHold).toBeLessThan(0.01);
  });

  it('θ = 25° > θ*: slides with a = g(sin θ − μk cos θ) ≈ 1.55 m/s²', () => {
    const sim = new FrictionSim({ ...INCLINE, inclineAngleDeg: 25 });
    const theta = (25 * Math.PI) / 180;
    const a = slideAcceleration(theta, 0.3); // 9.8(sin25° − 0.3·cos25°)
    expect(a).toBeGreaterThan(0); // past the repose angle it does slide
    expect(willSlide(theta, 0.4)).toBe(true);

    runFor(sim, 3);
    const s = sim.getSnapshot();
    expect(s.sliding).toBe(true);
    expect(Math.abs(s.v - a * 3) / (a * 3)).toBeLessThan(0.01); // v = at
    expect(Math.abs(s.x - 0.5 * a * 9) / (0.5 * a * 9)).toBeLessThan(0.01); // x = ½at²
    // Kinetic friction while sliding: f = μk·mg cos θ.
    const fk = 0.3 * 5 * G * Math.cos(theta);
    expect(Math.abs(s.friction - fk) / fk).toBeLessThan(0.01);
  });

  it('angle of repose boundary: just under θ* stays, just over θ* slides', () => {
    const reposeDeg = (Math.atan(0.4) * 180) / Math.PI; // θ* ≈ 21.80°
    const eps = 0.05; // half a slider step on either side — no FP boundary

    const under = new FrictionSim({ ...INCLINE, inclineAngleDeg: reposeDeg - eps });
    runFor(under, 2);
    expect(under.getSnapshot().x).toBe(0); // sticks below θ*

    const over = new FrictionSim({ ...INCLINE, inclineAngleDeg: reposeDeg + eps });
    runFor(over, 2);
    const so = over.getSnapshot();
    expect(so.sliding).toBe(true); // lets go above θ*
    expect(so.x).toBeGreaterThan(0);
  });
});

describe('FrictionSim — lifecycle', () => {
  it('guards: step before start throws, double start throws, step after done throws', () => {
    const sim = new FrictionSim(HORIZONTAL);
    expect(() => sim.step(DT)).toThrow();
    sim.start();
    expect(() => sim.start()).toThrow();
    let guard = 0;
    while (sim.getPhase() === 'running' && guard < 20000) {
      sim.step(DT);
      guard++;
    }
    expect(sim.getPhase()).toBe('done');
    expect(() => sim.step(DT)).toThrow();
  });

  it('update() re-arms: phase ready, state and samples cleared', () => {
    const sim = new FrictionSim(HORIZONTAL);
    runFor(sim, 5);
    expect(sim.getPhase()).toBe('running');

    sim.update({ ...INCLINE, mode: 'incline' });
    const s = sim.getSnapshot();
    expect(s.phase).toBe('ready');
    expect(s.t).toBe(0);
    expect(s.x).toBe(0);
    expect(s.v).toBe(0);
    expect(s.applied).toBe(0);
    expect(s.mode).toBe('incline');
    expect(s.xSamples.length).toBe(0);
    expect(s.frictionSamples.length).toBe(0);
    expect(s.angleReposeDeg).toBeCloseTo((Math.atan(0.4) * 180) / Math.PI, 6);
  });

  it('identical params and steps produce identical snapshots', () => {
    const run = () => {
      const sim = new FrictionSim({ ...INCLINE, inclineAngleDeg: 25 });
      sim.start();
      for (let i = 0; i < 3000; i++) {
        if (sim.getPhase() !== 'running') break;
        sim.step(DT);
      }
      return sim.getSnapshot();
    };
    expect(run()).toEqual(run());
  });
});
