import { describe, it, expect } from 'vitest';
import { CircularSim, type CircularParams } from '../circular.js';

const DT = 1 / 240; // fixed timestep [s]

const BASE: CircularParams = {
  mode: 'uniform',
  uniform: { r: 1.5, omega: 2, m: 2 },
  loop: { r: 1, v0: 8, m: 1 },
  banked: { r: 50, thetaBankDeg: 30, v: 16.8, m: 2 },
  g: 9.8,
};

const UNIFORM: CircularParams = { ...BASE };
const LOOP: CircularParams = { ...BASE, mode: 'loop' };
const BANKED: CircularParams = { ...BASE, mode: 'banked' };

/** Start the sim and advance it by `seconds` of simulated time. */
function runFor(sim: CircularSim, seconds: number): void {
  sim.start();
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    if (sim.getPhase() !== 'running') break;
    sim.step(DT);
  }
}

/** Run until the sim auto-completes (guard against infinite loops). */
function runToDone(sim: CircularSim): void {
  sim.start();
  let guard = 0;
  while (sim.getPhase() === 'running' && guard < 20000) {
    sim.step(DT);
    guard++;
  }
}

/* ── uniform: closed forms, exact stepping ───────────────────────────── */

describe('CircularSim — uniform: ball on a string', () => {
  it('ready state: v = 3.0 and a_c = 6.0 exactly, F_c = 12.0, ball at the top, status chip', () => {
    const sim = new CircularSim(UNIFORM);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('ready');
    expect(s.v).toBe(3); // ω·r = 2 × 1.5 — exact closed form
    expect(s.aC).toBe(6); // ω²·r = 4 × 1.5 — exact closed form
    expect(s.fC).toBe(12); // m·a_c = 2 × 6
    expect(s.x).toBe(0); // φ = 0 → (r·sin 0, r·cos 0) = (0, r)
    expect(s.y).toBe(1.5);
    expect(s.status).toBe('ω = 2.0 rad/s · revolving');
  });

  it('after 1 s: v/a_c still exact, φ ≈ 2 rad and revolutions ≈ 1/π (0.1 %)', () => {
    const sim = new CircularSim(UNIFORM);
    runFor(sim, 1);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('running');
    expect(s.v).toBe(3);
    expect(s.aC).toBe(6);
    expect(Math.abs(s.phi - 2) / 2).toBeLessThan(0.001);
    expect(Math.abs(s.revolutions - 1 / Math.PI) / (1 / Math.PI)).toBeLessThan(0.001);
    // velocity components follow the circle: vx = v·cos φ, vy = −v·sin φ
    expect(s.vx).toBeCloseTo(3 * Math.cos(s.phi), 12);
    expect(s.vy).toBeCloseTo(-3 * Math.sin(s.phi), 12);
  });

  it('after π seconds: φ has advanced by 2π (0.1 %)', () => {
    const sim = new CircularSim(UNIFORM);
    runFor(sim, Math.PI);
    const s = sim.getSnapshot();
    expect(Math.abs(s.phi - 2 * Math.PI) / (2 * Math.PI)).toBeLessThan(0.001);
  });

  it('auto-completes after three full turns: revolutions ≈ 3 (0.1 %)', () => {
    const sim = new CircularSim(UNIFORM);
    runToDone(sim);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.phi).toBeGreaterThanOrEqual(6 * Math.PI);
    expect(Math.abs(s.revolutions - 3) / 3).toBeLessThan(0.001);
    // the last sample was pushed on completion
    expect(s.vxSamples.length).toBeGreaterThan(0);
    expect(s.vxSamples[s.vxSamples.length - 1][0]).toBeCloseTo(s.t, 12);
  });

  it('sample arrays are 30 Hz sinusoids: vx starts at v = 3, vy at 0', () => {
    const sim = new CircularSim(UNIFORM);
    sim.start();
    const s = sim.getSnapshot();
    expect(s.vxSamples[0][1]).toBeCloseTo(3, 12); // v·cos 0
    expect(s.vySamples[0][1]).toBe(0); // −v·sin 0
  });
});

/* ── loop-the-loop: contact, energy, landing ────────────────────────── */

describe('CircularSim — loop-the-loop', () => {
  it('starts at the bottom: N = m(v₀²/r + g) = 73.8 N (1 %), v = v₀, h = 0', () => {
    const sim = new CircularSim(LOOP);
    sim.start();
    const s = sim.getSnapshot();
    expect(Math.abs(s.N - 73.8) / 73.8).toBeLessThan(0.01);
    expect(s.v).toBe(8);
    expect(s.height).toBe(0);
    expect(s.onTrack).toBe(true);
    expect(s.status).toBe('climbing the loop');
  });

  it('fast launch (v₀ = 8): completes the loop, v at the top ≈ √24.8 (1 %)', () => {
    const sim = new CircularSim(LOOP);
    sim.start();
    let vAtTop = NaN;
    let guard = 0;
    while (sim.getPhase() === 'running' && guard < 20000) {
      const prevTheta = sim.getSnapshot().theta;
      sim.step(DT);
      const s = sim.getSnapshot();
      if (prevTheta < Math.PI && s.theta >= Math.PI) {
        vAtTop = s.v; // captured the instant the ball passes the top
      }
      guard++;
    }
    const s = sim.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.status).toBe('full loop');
    expect(Math.abs(vAtTop - Math.sqrt(24.8)) / Math.sqrt(24.8)).toBeLessThan(0.01);
  });

  it('boundary launch (v₀ = 7, v_top² = g·r): run ends with min N < 0.5 N', () => {
    const sim = new CircularSim({ ...LOOP, loop: { r: 1, v0: 7, m: 1 } });
    runToDone(sim);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('done');
    // either it (barely) completes or it loses contact near the top
    expect(s.status === 'full loop' || s.status.includes('lost')).toBe(true);
    const minN = Math.min(...s.nSamples.map(([, n]) => n));
    expect(minN).toBeLessThan(0.5);
  });

  it('slow launch (v₀ = 5): loses contact and ends on the floor', () => {
    const sim = new CircularSim({ ...LOOP, loop: { r: 1, v0: 5, m: 1 } });
    runToDone(sim);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.status.includes('lost')).toBe(true);
    expect(s.onTrack).toBe(false);
    expect(s.y).toBeLessThanOrEqual(0); // landed: y clamped to the floor
    expect(s.N).toBe(0); // airborne: no contact force
    expect(s.leave).not.toBeNull();
    expect(s.leave!.vy).toBeGreaterThan(0); // still moving up along the track
  });

  it('too slow to climb (v₀ = 3): rolls back, oscillates in the lower half until the cap', () => {
    const sim = new CircularSim({ ...LOOP, loop: { r: 1, v0: 3, m: 1 } });
    runFor(sim, 2);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('running'); // rides to the 30 s cap
    expect(s.status).toBe('rolls back');
    expect(s.onTrack).toBe(true);
    expect(Math.abs(s.theta)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
  });

  it('Moon gravity (g = 1.62): v₀,min = √(5gr) ≈ 2.85 m/s, so v₀ = 8 completes easily', () => {
    const sim = new CircularSim({ ...LOOP, g: 1.62 });
    runToDone(sim);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.status).toBe('full loop');
  });
});

/* ── banked curve: required vs available ────────────────────────────── */

describe('CircularSim — banked curve', () => {
  it('v = 16.817 m/s, r = 50 m, θ = 30°: perfectly banked (|Δ| < 1 % of required)', () => {
    const sim = new CircularSim({
      ...BANKED,
      banked: { r: 50, thetaBankDeg: 30, v: 16.817, m: 2 },
    });
    const s0 = sim.getSnapshot();
    expect(s0.perfect).toBe(true);
    expect(Math.abs(s0.delta)).toBeLessThan(0.01 * Math.max(1, s0.required));
    expect(s0.status).toBe('perfectly banked');
    expect(s0.vOpt).toBeCloseTo(Math.sqrt(50 * 9.8 * Math.tan(Math.PI / 6)), 12);
    expect(s0.available).toBeCloseTo(2 * 9.8 * Math.tan(Math.PI / 6), 12);
  });

  it('circulates at constant speed: after 1 s the ring angle ≈ v/r (0.1 %), flat force series', () => {
    const sim = new CircularSim({
      ...BANKED,
      banked: { r: 50, thetaBankDeg: 30, v: 16.817, m: 2 },
    });
    runFor(sim, 1);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('running');
    expect(Math.abs(s.angle - 16.817 / 50) / (16.817 / 50)).toBeLessThan(0.001);
    expect(s.requiredSamples.length).toBeGreaterThan(5);
    const req = s.requiredSamples.map(([, value]) => value);
    const avail = s.availableSamples.map(([, value]) => value);
    expect(Math.max(...req) - Math.min(...req)).toBe(0); // constant params
    expect(Math.max(...avail) - Math.min(...avail)).toBe(0);
  });

  it('mismatch (v = 25 m/s): Δ = required − available > 0 — friction must supply it', () => {
    const sim = new CircularSim({
      ...BANKED,
      banked: { r: 50, thetaBankDeg: 30, v: 25, m: 2 },
    });
    const s = sim.getSnapshot();
    expect(s.delta).toBeCloseTo(
      (2 * 25 * 25) / 50 - 2 * 9.8 * Math.tan(Math.PI / 6),
      9,
    );
    expect(s.delta).toBeGreaterThan(0);
    expect(s.perfect).toBe(false);
    expect(s.status).toContain('friction must supply');
  });

  it('auto-completes after two laps', () => {
    const sim = new CircularSim({
      ...BANKED,
      banked: { r: 50, thetaBankDeg: 30, v: 25, m: 2 },
    });
    runToDone(sim);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.angle).toBeGreaterThanOrEqual(4 * Math.PI);
  });
});

/* ── lifecycle ──────────────────────────────────────────────────────── */

describe('CircularSim — lifecycle', () => {
  it('guards: step before start throws, double start throws, step after done throws', () => {
    const sim = new CircularSim(UNIFORM);
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
    const sim = new CircularSim(UNIFORM);
    runFor(sim, 0.5);
    expect(sim.getPhase()).toBe('running');

    sim.update(LOOP);
    const s = sim.getSnapshot();
    expect(s.phase).toBe('ready');
    expect(s.t).toBe(0);
    expect(s.mode).toBe('loop');
    expect(s.vxSamples.length).toBe(0);
    expect(s.vSamples.length).toBe(0);
    expect(s.theta).toBe(0);
    expect(s.v).toBe(8); // loop ready state: v = v₀ at the bottom
    expect(s.status).toBe('climbing the loop');
  });

  it('determinism: identical params and steps produce identical sample arrays', () => {
    const runUniform = () => {
      const sim = new CircularSim({ ...UNIFORM });
      runFor(sim, 2);
      return sim.getSnapshot();
    };
    const a = runUniform();
    const b = runUniform();
    expect(JSON.stringify(a.vxSamples)).toBe(JSON.stringify(b.vxSamples));
    expect(JSON.stringify(a.vySamples)).toBe(JSON.stringify(b.vySamples));

    const runLoop = () => {
      const sim = new CircularSim({ ...LOOP });
      runToDone(sim);
      return sim.getSnapshot();
    };
    const c = runLoop();
    const d = runLoop();
    expect(JSON.stringify(c.vSamples)).toBe(JSON.stringify(d.vSamples));
    expect(JSON.stringify(c.nSamples)).toBe(JSON.stringify(d.nSamples));
  });
});
