import { describe, it, expect } from 'vitest';
import { Vec2 } from '../vec2.js';
import {
  G,
  gravity,
  inclineDirections,
  willSlide,
  slideAcceleration,
  maxStaticFriction,
  kineticFriction,
  quadraticDrag,
  atwood,
} from '../forces.js';

describe('gravity', () => {
  it('points down with magnitude g (y-up)', () => {
    expect(gravity()).toEqual(new Vec2(0, -G));
    expect(gravity().len()).toBeCloseTo(9.8, 12);
    expect(gravity(1.62)).toEqual(new Vec2(0, -1.62)); // Moon gravity
  });
});

describe('incline', () => {
  it('directions are unit vectors, perpendicular, correct orientation', () => {
    const { parallel, normal } = inclineDirections(Math.PI / 6); // 30°
    expect(parallel.len()).toBeCloseTo(1, 12);
    expect(normal.len()).toBeCloseTo(1, 12);
    expect(parallel.dot(normal)).toBeCloseTo(0, 12); // perpendicular
    // parallel points down-slope: negative y for a positive incline angle
    expect(parallel.y).toBeLessThan(0);
    // normal points away from the surface: positive y component
    expect(normal.y).toBeGreaterThan(0);
    // weight decomposes along these: mg·sinθ down-slope, mg·cosθ into surface
    const m = 2; // [kg]
    const w = gravity().mul(m);
    expect(Math.abs(w.dot(parallel))).toBeCloseTo(m * G * Math.sin(Math.PI / 6), 12);
    expect(Math.abs(w.dot(normal))).toBeCloseTo(m * G * Math.cos(Math.PI / 6), 12);
  });

  it('flat incline (θ=0): parallel is +x, normal is +y', () => {
    const { parallel, normal } = inclineDirections(0);
    expect(parallel.approxEquals(new Vec2(1, 0))).toBe(true);
    expect(normal.approxEquals(new Vec2(0, 1))).toBe(true);
  });

  it('willSlide flips exactly at tanθ = μs (angle of repose)', () => {
    const muStatic = 0.5;
    const thetaRepose = Math.atan(muStatic); // tan θ = μs boundary
    const eps = 1e-6; // just below/above the boundary

    // Below the boundary: no slide.
    expect(willSlide(thetaRepose - eps, muStatic)).toBe(false);
    // Exactly on the boundary: tanθ = μs, not >, so no slide.
    expect(willSlide(thetaRepose, muStatic)).toBe(false);
    // Above the boundary: slides.
    expect(willSlide(thetaRepose + eps, muStatic)).toBe(true);

    // Also check the boundary from the μ side at fixed θ.
    const theta = 0.5; // [rad]
    const muBoundary = Math.tan(theta);
    expect(willSlide(theta, muBoundary + eps)).toBe(false);
    expect(willSlide(theta, muBoundary - eps)).toBe(true);
  });

  it('slideAcceleration matches g(sinθ − μk cosθ)', () => {
    const cases: Array<[number, number]> = [
      [Math.PI / 6, 0.2],
      [Math.PI / 4, 0.3],
      [Math.PI / 3, 0.1],
      [0.2, 0.5], // friction wins: negative (decelerating) result
    ];
    for (const [theta, muK] of cases) {
      const expected = G * (Math.sin(theta) - muK * Math.cos(theta));
      expect(slideAcceleration(theta, muK)).toBeCloseTo(expected, 12);
    }
    // Frictionless: a = g sinθ
    expect(slideAcceleration(Math.PI / 6, 0)).toBeCloseTo(G * 0.5, 12);
    // Custom g (Moon)
    expect(slideAcceleration(Math.PI / 2, 0, 1.62)).toBeCloseTo(1.62, 12);
  });
});

describe('friction magnitudes', () => {
  it('maxStaticFriction = μs·N and kineticFriction = μk·N', () => {
    const N = 49; // [N] — e.g. 5 kg block on Earth: N = mg = 49 N
    expect(maxStaticFriction(0.4, N)).toBeCloseTo(19.6, 10);
    expect(kineticFriction(0.3, N)).toBeCloseTo(14.7, 10);
    expect(maxStaticFriction(0, N)).toBe(0);
    expect(kineticFriction(0, N)).toBe(0);
  });
});

describe('quadratic drag', () => {
  it('magnitude k|v|², direction opposing the velocity', () => {
    const k = 0.05; // [kg/m]
    const vel = new Vec2(3, 4); // |v| = 5 m/s
    const F = quadraticDrag(k, vel);
    expect(F.len()).toBeCloseTo(k * 25, 10); // k|v|² = 0.05·25 = 1.25 N
    // Opposes velocity: F = −k|v|·v → anti-parallel to v.
    expect(F.dot(vel)).toBeLessThan(0);
    expect(F.approxEquals(vel.mul(-k * 5), 1e-12)).toBe(true);
    // Zero velocity → zero force.
    expect(quadraticDrag(k, Vec2.zero()).len()).toBe(0);
  });
});

describe('Atwood machine (analytic reference)', () => {
  it('m1=3 kg, m2=2 kg, g=9.8 → a ≈ 1.96 m/s², T ≈ 23.52 N', () => {
    const { a, tension } = atwood(3, 2, 9.8);
    expect(a).toBeCloseTo(1.96, 10);
    expect(tension).toBeCloseTo(23.52, 10);
  });

  it('equal masses: a = 0, T = mg', () => {
    const { a, tension } = atwood(2, 2, 9.8);
    expect(a).toBeCloseTo(0, 12);
    expect(tension).toBeCloseTo(2 * 9.8, 12); // T = mg = 19.6 N
  });

  it('signed: m2 heavier → negative a (m2 side accelerates down)', () => {
    const { a } = atwood(2, 3, 9.8);
    expect(a).toBeCloseTo(-1.96, 10);
  });

  it('one mass negligible: a → g, T → 0', () => {
    const { a, tension } = atwood(1, 1e-9, 9.8);
    expect(a).toBeCloseTo(9.8, 6);
    expect(tension).toBeLessThan(1e-6);
  });

  it('matches the closed form for arbitrary masses', () => {
    const m1 = 1.7;
    const m2 = 4.2;
    const g = 9.8;
    const { a, tension } = atwood(m1, m2, g);
    expect(a).toBeCloseTo(((m1 - m2) * g) / (m1 + m2), 12);
    expect(tension).toBeCloseTo((2 * m1 * m2 * g) / (m1 + m2), 12);
  });
});
