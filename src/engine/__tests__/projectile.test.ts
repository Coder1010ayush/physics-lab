import { describe, it, expect } from 'vitest';
import { Vec2 } from '../vec2.js';
import { semiImplicitEuler } from '../integrator.js';
import { gravity, G } from '../forces.js';

const DT = 1 / 240; // fixed timestep [s]

/**
 * Integrate a projectile with semi-implicit Euler until it returns to y = 0
 * (crossing below it), then linearly interpolate the landing point.
 */
function simulateProjectile(v0: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  let pos = Vec2.zero();
  let vel = Vec2.fromAngle(angle, v0);
  const acc = gravity(G);

  let prev = { pos, vel };
  let steps = 0;
  const maxSteps = 1_000_000;
  while (pos.y >= 0 && steps < maxSteps) {
    prev = { pos, vel };
    ({ pos, vel } = semiImplicitEuler(pos, vel, acc, DT));
    steps++;
  }
  expect(steps).toBeLessThan(maxSteps); // must land, not loop forever

  // Linear interpolation between the last airborne point and the landing
  // point to find where y crosses zero.
  const y0 = prev.pos.y;
  const y1 = pos.y;
  const t = y0 / (y0 - y1); // fraction of the final step in the air
  const landX = prev.pos.x + t * (pos.x - prev.pos.x);

  // Max height: track the peak while the projectile is still rising.
  let maxY = 0;
  let p = Vec2.zero();
  let v = Vec2.fromAngle(angle, v0);
  while (v.y > 0) {
    ({ pos: p, vel: v } = semiImplicitEuler(p, v, acc, DT));
    maxY = Math.max(maxY, p.y);
  }
  return { range: landX, maxHeight: maxY, steps };
}

describe('projectile vs closed form (no drag)', () => {
  const v0 = 20; // [m/s]
  const thetaDeg = 45;
  const theta = (thetaDeg * Math.PI) / 180;

  // Closed form (no air resistance):
  const rangeExact = (v0 * v0 * Math.sin(2 * theta)) / G; // ≈ 40.816 m
  const heightExact = (v0 * v0 * Math.sin(theta) ** 2) / (2 * G); // ≈ 10.204 m

  it('closed-form references have the textbook values', () => {
    expect(rangeExact).toBeCloseTo(40.82, 1);
    expect(heightExact).toBeCloseTo(10.20, 1);
  });

  it('range within 0.5% of v₀²·sin2θ/g', () => {
    const { range } = simulateProjectile(v0, thetaDeg);
    expect(Math.abs(range - rangeExact) / rangeExact).toBeLessThan(0.005);
  });

  it('max height within 1% of v₀²·sin²θ/(2g)', () => {
    const { maxHeight } = simulateProjectile(v0, thetaDeg);
    expect(Math.abs(maxHeight - heightExact) / heightExact).toBeLessThan(0.01);
  });

  it('45° maximises range among sampled angles (symmetry check)', () => {
    const r45 = simulateProjectile(v0, 45).range;
    for (const deg of [30, 40, 50, 60]) {
      const r = simulateProjectile(v0, deg).range;
      expect(r).toBeLessThan(r45);
    }
  });

  it('horizontal velocity is conserved (no drag)', () => {
    let pos = Vec2.zero();
    let vel = Vec2.fromAngle((45 * Math.PI) / 180, v0);
    const acc = gravity(G);
    for (let i = 0; i < 1000; i++) {
      ({ pos, vel } = semiImplicitEuler(pos, vel, acc, DT));
    }
    expect(vel.x).toBeCloseTo(v0 * Math.cos((45 * Math.PI) / 180), 10);
  });
});
