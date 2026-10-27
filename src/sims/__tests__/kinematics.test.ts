import { describe, it, expect } from 'vitest';
import { KinematicsSim } from '../kinematics.js';

const DT = 1 / 240; // fixed timestep [s]

/** Start the sim and advance it by `seconds` of simulated time. */
function runFor(sim: KinematicsSim, seconds: number): void {
  sim.start();
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) sim.step(DT);
}

describe('KinematicsSim — constant acceleration vs closed form', () => {
  it('u = 3, a = 1.5: x ≈ 9.00 m (s = ut + ½at²) and v ≈ 6.00 m/s at t = 2 s', () => {
    const sim = new KinematicsSim({ u: 3, a: 1.5 });
    runFor(sim, 2);
    const s = sim.getSnapshot();
    expect(s.t).toBeCloseTo(2, 5);
    expect(Math.abs(s.x - 9) / 9).toBeLessThan(0.005);
    expect(Math.abs(s.v - 6) / 6).toBeLessThan(0.001);
  });

  it('u = 0, a = 2: x ≈ ½·2·t² = 9 m and v = 2t = 6 m/s at t = 3 s', () => {
    const sim = new KinematicsSim({ u: 0, a: 2 });
    runFor(sim, 3);
    const s = sim.getSnapshot();
    expect(Math.abs(s.x - 9) / 9).toBeLessThan(0.005);
    expect(Math.abs(s.v - 6) / 6).toBeLessThan(0.001);
  });
});

describe('KinematicsSim — turning point (braking)', () => {
  it('u = 5, a = −1: v crosses 0 at t ≈ 5 s, x ≈ 12.5 m (recorded)', () => {
    const sim = new KinematicsSim({ u: 5, a: -1 });
    runFor(sim, 6);
    const s = sim.getSnapshot();
    expect(s.v).toBeLessThan(0); // already heading back down the track
    expect(s.turningPoints.length).toBe(1);
    const tp = s.turningPoints[0];
    expect(Math.abs(tp.t - 5) / 5).toBeLessThan(0.01);
    expect(Math.abs(tp.x - 12.5) / 12.5).toBeLessThan(0.01);
  });

  it('travelled counts the out-and-back path, not the displacement', () => {
    const sim = new KinematicsSim({ u: 5, a: -1 });
    runFor(sim, 10); // back at the origin at t = 10 s
    const s = sim.getSnapshot();
    expect(Math.abs(s.x) / 12.5).toBeLessThan(0.01); // displacement ≈ 0
    expect(Math.abs(s.travelled - 25) / 25).toBeLessThan(0.01); // 12.5 out + 12.5 back
    expect(s.maxSpeed).toBeCloseTo(5, 6);
  });
});

describe('KinematicsSim — lifecycle', () => {
  it('auto-completes: phase done at t ≥ 30 s', () => {
    const sim = new KinematicsSim({ u: 2, a: 0.5 });
    sim.start();
    let guard = 0;
    while (sim.getPhase() === 'running' && guard < 20000) {
      sim.step(DT);
      guard++;
    }
    const s = sim.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.t).toBeGreaterThanOrEqual(30);
    expect(guard).toBeLessThan(20000);
  });

  it('update() re-arms: phase ready, state and samples cleared, v = new u', () => {
    const sim = new KinematicsSim({ u: 3, a: 1.5 });
    runFor(sim, 1);
    expect(sim.getPhase()).toBe('running');

    sim.update({ u: 10, a: -1 });
    const s = sim.getSnapshot();
    expect(s.phase).toBe('ready');
    expect(s.t).toBe(0);
    expect(s.x).toBe(0);
    expect(s.v).toBe(10);
    expect(s.xSamples.length).toBe(0);
    expect(s.vSamples.length).toBe(0);
    expect(s.turningPoints.length).toBe(0);
  });

  it('guards: step before start throws, double start throws, step after done throws', () => {
    const sim = new KinematicsSim({ u: 1, a: 0 });
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

  it('identical params and steps produce identical snapshots', () => {
    const run = () => {
      const sim = new KinematicsSim({ u: 4, a: -2 });
      sim.start();
      for (let i = 0; i < 1500; i++) sim.step(DT);
      return sim.getSnapshot();
    };
    expect(run()).toEqual(run());
  });
});
