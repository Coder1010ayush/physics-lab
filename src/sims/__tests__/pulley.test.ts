import { describe, it, expect } from 'vitest';
import { PulleySim, type PulleyParams } from '../pulley.js';
import { atwood } from '../../engine/forces.js';

const DT = 1 / 240; // fixed timestep [s]

const ATWOOD: PulleyParams = {
  mode: 'atwood',
  m1: 3,
  m2: 2,
  mTable: 5,
  mHanging: 1,
  muStatic: 0.3,
  muKinetic: 0.2,
  g: 9.8,
};

const TABLE_EDGE: PulleyParams = {
  ...ATWOOD,
  mode: 'tableEdge',
  mTable: 5,
  mHanging: 1,
  muStatic: 0.3,
  muKinetic: 0.2,
};

/** Start the sim and advance it by `seconds` of simulated time. */
function runFor(sim: PulleySim, seconds: number): void {
  sim.start();
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    if (sim.getPhase() !== 'running') break;
    sim.step(DT);
  }
}

describe('PulleySim — atwood: closed-form a and T from the engine', () => {
  it('m1 = 3, m2 = 2, g = 9.8 → a ≈ 1.96 m/s², T ≈ 23.52 N', () => {
    const sim = new PulleySim(ATWOOD);
    const s = sim.getSnapshot();
    expect(s.a).toBeCloseTo(1.96, 3); // (3 − 2)·9.8 / 5
    expect(s.T).toBeCloseTo(23.52, 2); // 2·3·2·9.8 / 5
    expect(s.status).toBe('m₁ descends');
  });

  it('after 1 s: v ≈ 1.96 m/s and s ≈ 0.98 m, still in flight', () => {
    const sim = new PulleySim(ATWOOD);
    runFor(sim, 1);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('running'); // drop limit is 1.1 m — not reached yet
    expect(Math.abs(s.v - 1.96) / 1.96).toBeLessThan(0.005); // v = at
    expect(Math.abs(s.positions.body1 - 0.98) / 0.98).toBeLessThan(0.005); // s = ½at²
    expect(s.positions.body2).toBeCloseTo(-s.positions.body1, 10); // rope constraint
  });

  it('auto-completes when the descending mass reaches the floor: drop ≈ 1.1 m', () => {
    const sim = new PulleySim(ATWOOD);
    sim.start();
    let guard = 0;
    while (sim.getPhase() === 'running' && guard < 20000) {
      sim.step(DT);
      guard++;
    }
    const s = sim.getSnapshot();
    expect(s.phase).toBe('done');
    expect(Math.abs(s.positions.body1 - 1.1) / 1.1).toBeLessThan(0.01); // floor
    expect(guard).toBeLessThan(20000); // t* = √(2·1.1/1.96) ≈ 1.06 s
  });

  it('equal masses (4, 4): a = 0 exactly, T = 39.2 N, status balanced, s stays 0', () => {
    const sim = new PulleySim({ ...ATWOOD, m1: 4, m2: 4 });
    const s0 = sim.getSnapshot();
    expect(s0.a).toBe(0); // exact: (4 − 4)·g / 8
    expect(s0.T).toBeCloseTo(39.2, 2); // T = mg = 4·9.8
    expect(s0.status).toBe('balanced');

    runFor(sim, 2);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('running'); // balanced rides to the 30 s cap
    expect(s.positions.body1).toBe(0); // never moved
    expect(s.positions.body2).toBe(0);
    expect(s.v).toBe(0);
  });

  it('Moon gravity (3, 2, g = 1.62): a ≈ 0.324 m/s², T ≈ 3.888 N', () => {
    const sim = new PulleySim({ ...ATWOOD, g: 1.62 });
    const s = sim.getSnapshot();
    expect(s.a).toBeCloseTo(0.324, 3); // (3 − 2)·1.62 / 5
    expect(s.T).toBeCloseTo(3.888, 2); // 2·3·2·1.62 / 5
    // agrees with the engine's analytic reference
    const ref = atwood(3, 2, 1.62);
    expect(s.a).toBeCloseTo(ref.a, 12);
    expect(s.T).toBeCloseTo(ref.tension, 12);
  });
});

describe('PulleySim — tableEdge: static friction decides hold or slide', () => {
  it('mₕg = 9.8 N < μs·N = 14.7 N → sticks: a = 0, T = 9.8 N, status held', () => {
    const sim = new PulleySim(TABLE_EDGE);
    const s0 = sim.getSnapshot();
    expect(s0.a).toBe(0);
    expect(s0.T).toBeCloseTo(9.8, 2); // T = mₕ·g while held
    expect(s0.status).toBe('held by static friction');

    runFor(sim, 2);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('running'); // held forever → 30 s cap
    expect(s.positions.body2).toBe(0); // hanging mass never dropped
    expect(s.positions.body1).toBe(0); // block never slid
    expect(s.v).toBe(0);
  });

  it('mₕg = 49 N > μs·N = 1.96 N → slides: a ≈ 6.44, T ≈ 16.8, both T forms agree', () => {
    const params: PulleyParams = {
      ...TABLE_EDGE,
      mTable: 2,
      mHanging: 5,
      muStatic: 0.1,
      muKinetic: 0.2,
    };
    const sim = new PulleySim(params);
    const s = sim.getSnapshot();
    expect(s.status).toBe('sliding');
    expect(s.a).toBeCloseTo(6.44, 2); // (49 − 3.92) / 7
    expect(s.T).toBeCloseTo(16.8, 2); // 5·(9.8 − 6.44)

    // consistency: T = mₕ(g − a) = m_t·a + μk·m_t·g
    const TfromHanging = params.mHanging * (params.g - s.a);
    const TfromTable = params.mTable * s.a + params.muKinetic * params.mTable * params.g;
    expect(s.T).toBeCloseTo(TfromHanging, 10);
    expect(s.T).toBeCloseTo(TfromTable, 10);

    // and it actually moves: v = at, x = ½at² after 0.5 s
    runFor(sim, 0.5);
    const after = sim.getSnapshot();
    expect(Math.abs(after.v - 6.44 * 0.5) / (6.44 * 0.5)).toBeLessThan(0.01);
    expect(Math.abs(after.positions.body1 - 0.5 * 6.44 * 0.25) / (0.5 * 6.44 * 0.25)).toBeLessThan(0.01);
  });

  it('auto-completes when the hanging mass reaches the floor 1.5 m below', () => {
    const sim = new PulleySim({ ...TABLE_EDGE, mTable: 2, mHanging: 5, muStatic: 0.1 });
    sim.start();
    let guard = 0;
    while (sim.getPhase() === 'running' && guard < 20000) {
      sim.step(DT);
      guard++;
    }
    const s = sim.getSnapshot();
    expect(s.phase).toBe('done');
    expect(Math.abs(s.positions.body1 - 1.5) / 1.5).toBeLessThan(0.01);
  });
});

describe('PulleySim — lifecycle', () => {
  it('guards: step before start throws, double start throws, step after done throws', () => {
    const sim = new PulleySim(ATWOOD);
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

  it('update() mid-run re-arms: phase ready, state and samples cleared', () => {
    const sim = new PulleySim(ATWOOD);
    runFor(sim, 0.5);
    expect(sim.getPhase()).toBe('running');

    sim.update({ ...TABLE_EDGE });
    const s = sim.getSnapshot();
    expect(s.phase).toBe('ready');
    expect(s.t).toBe(0);
    expect(s.positions.body1).toBe(0);
    expect(s.positions.body2).toBe(0);
    expect(s.v).toBe(0);
    expect(s.mode).toBe('tableEdge');
    expect(s.pos1Samples.length).toBe(0);
    expect(s.vSamples.length).toBe(0);
  });

  it('determinism: identical params and steps produce identical sample arrays', () => {
    const run = () => {
      const sim = new PulleySim({ ...ATWOOD });
      sim.start();
      for (let i = 0; i < 3000; i++) {
        if (sim.getPhase() !== 'running') break;
        sim.step(DT);
      }
      return sim.getSnapshot();
    };
    const a = run();
    const b = run();
    expect(JSON.stringify(a.pos1Samples)).toBe(JSON.stringify(b.pos1Samples));
    expect(JSON.stringify(a.pos2Samples)).toBe(JSON.stringify(b.pos2Samples));
    expect(JSON.stringify(a.vSamples)).toBe(JSON.stringify(b.vSamples));
  });
});
