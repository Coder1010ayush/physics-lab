import { describe, it, expect } from 'vitest';
import { ProjectileSim, idealPredictions } from '../projectile.js';

const DT = 1 / 240; // fixed timestep [s]

/** Launch and step until landed (guards against infinite loops). */
function fly(sim: ProjectileSim): void {
  sim.launch();
  let guard = 0;
  while (sim.getPhase() === 'flying' && guard < 200000) {
    sim.step(DT);
    guard++;
  }
  expect(sim.getPhase()).toBe('landed');
  expect(guard).toBeLessThan(200000);
}

describe('ProjectileSim — ideal case (k = 0) vs closed form', () => {
  const params = { v0: 20, angleDeg: 45, k: 0, g: 9.8 };
  const pred = idealPredictions(params);

  it(`range ≈ ${pred.range.toFixed(2)} m within 0.5%`, () => {
    const sim = new ProjectileSim(params);
    fly(sim);
    const s = sim.getState();
    expect(s.range).toBeGreaterThan(0);
    expect(Math.abs(s.range - pred.range) / pred.range).toBeLessThan(0.005);
  });

  it(`max height ≈ ${pred.height.toFixed(2)} m within 1%`, () => {
    const sim = new ProjectileSim(params);
    fly(sim);
    const s = sim.getState();
    expect(Math.abs(s.maxHeight - pred.height) / pred.height).toBeLessThan(0.01);
  });

  it(`flight time ≈ ${pred.time.toFixed(3)} s within 1%`, () => {
    const sim = new ProjectileSim(params);
    fly(sim);
    const s = sim.getState();
    expect(Math.abs(s.flightTime - pred.time) / pred.time).toBeLessThan(0.01);
  });

  it('lands exactly at y = 0', () => {
    const sim = new ProjectileSim(params);
    fly(sim);
    expect(sim.getState().y).toBe(0);
  });

  it('records graph samples over the flight', () => {
    const sim = new ProjectileSim(params);
    fly(sim);
    expect(sim.samples.height.length).toBeGreaterThan(10);
    expect(sim.samples.vx.length).toBe(sim.samples.height.length);
    expect(sim.samples.vy.length).toBe(sim.samples.height.length);
  });
});

describe('ProjectileSim — air drag', () => {
  it('drag shortens both range and max height vs the ideal case', () => {
    const ideal = new ProjectileSim({ v0: 20, angleDeg: 45, k: 0, g: 9.8 });
    const dragged = new ProjectileSim({ v0: 20, angleDeg: 45, k: 0.02, g: 9.8 });
    fly(ideal);
    fly(dragged);
    const i = ideal.getState();
    const d = dragged.getState();
    expect(d.range).toBeLessThan(i.range);
    expect(d.maxHeight).toBeLessThan(i.maxHeight);
  });

  it('zero drag is the ideal case (the k = 0 option must be exact)', () => {
    const sim = new ProjectileSim({ v0: 30, angleDeg: 60, k: 0, g: 9.8 });
    const pred = idealPredictions({ v0: 30, angleDeg: 60, k: 0, g: 9.8 });
    fly(sim);
    const s = sim.getState();
    expect(Math.abs(s.range - pred.range) / pred.range).toBeLessThan(0.005);
    expect(Math.abs(s.maxHeight - pred.height) / pred.height).toBeLessThan(0.01);
  });
});

describe('ProjectileSim — Moon gravity', () => {
  it('g = 1.62: range ≈ 400/1.62 = 246.9 m for v₀ = 20 at 45°', () => {
    const sim = new ProjectileSim({ v0: 20, angleDeg: 45, k: 0, g: 1.62 });
    const pred = idealPredictions({ v0: 20, angleDeg: 45, k: 0, g: 1.62 });
    expect(pred.range).toBeCloseTo(246.91, 1);
    fly(sim);
    const s = sim.getState();
    expect(Math.abs(s.range - pred.range) / pred.range).toBeLessThan(0.01);
  });
});

describe('ProjectileSim — lifecycle & determinism', () => {
  it('update() re-aims mid-flight; relaunch after reset flies again', () => {
    const sim = new ProjectileSim({ v0: 20, angleDeg: 45, k: 0, g: 9.8 });
    sim.launch();
    sim.step(DT);
    expect(sim.getPhase()).toBe('flying');

    sim.update({ v0: 30, angleDeg: 60, k: 0, g: 9.8 });
    expect(sim.getPhase()).toBe('aim');
    expect(sim.getState().trail.length).toBe(0);

    sim.launch();
    expect(sim.getPhase()).toBe('flying');
  });

  it('identical params and steps produce identical trails', () => {
    const run = () => {
      const sim = new ProjectileSim({ v0: 25, angleDeg: 37, k: 0.01, g: 9.8 });
      sim.launch();
      for (let i = 0; i < 2000; i++) sim.step(DT);
      return sim.getState().trail;
    };
    expect(run()).toEqual(run());
  });
});
