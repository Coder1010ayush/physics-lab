import { describe, it, expect } from 'vitest';
import { Vec2 } from '../vec2.js';

const EPS = 1e-9;

describe('Vec2 algebra identities', () => {
  it('add is commutative and associative', () => {
    const a = new Vec2(1.5, -2);
    const b = new Vec2(-0.5, 4);
    const c = new Vec2(2, 2);
    expect(a.add(b).approxEquals(b.add(a), EPS)).toBe(true);
    expect(a.add(b).add(c).approxEquals(a.add(b.add(c)), EPS)).toBe(true);
  });

  it('sub gives the difference and a.sub(b).add(b) === a', () => {
    const a = new Vec2(3, 7);
    const b = new Vec2(-1, 2);
    expect(a.sub(b).approxEquals(new Vec2(4, 5), EPS)).toBe(true);
    expect(a.sub(b).add(b).approxEquals(a, EPS)).toBe(true);
  });

  it('mul/div scale components and are inverses', () => {
    const a = new Vec2(3, -4);
    expect(a.mul(2).approxEquals(new Vec2(6, -8), EPS)).toBe(true);
    expect(a.mul(3).div(3).approxEquals(a, EPS)).toBe(true);
  });

  it('neg flips direction; neg().neg() === identity', () => {
    const a = new Vec2(2, -5);
    expect(a.neg().approxEquals(new Vec2(-2, 5), EPS)).toBe(true);
    expect(a.neg().neg().approxEquals(a, EPS)).toBe(true);
  });

  it('dot: commutative, zero for perpendicular, |v|² for self', () => {
    const a = new Vec2(3, 4);
    expect(a.dot(a)).toBeCloseTo(25, 10); // |a|²
    const perp = new Vec2(-4, 3); // perpendicular to a
    expect(a.dot(perp)).toBeCloseTo(0, 10);
    const b = new Vec2(1, 2);
    expect(a.dot(b)).toBeCloseTo(b.dot(a), 10);
  });

  it('cross: zero for parallel, |a||b| for perpendicular, antisymmetric', () => {
    const a = new Vec2(3, 0);
    const b = new Vec2(0, 4);
    expect(a.cross(b)).toBeCloseTo(12, 10); // |a||b| sin 90°
    expect(b.cross(a)).toBeCloseTo(-12, 10); // antisymmetric
    expect(a.cross(a.mul(5))).toBeCloseTo(0, 10); // parallel
  });

  it('len and lenSq agree (Pythagoras)', () => {
    const a = new Vec2(3, 4);
    expect(a.len()).toBeCloseTo(5, 12);
    expect(a.lenSq()).toBeCloseTo(25, 12);
    expect(Vec2.zero().len()).toBe(0);
  });

  it('norm gives a unit vector in the same direction', () => {
    const a = new Vec2(3, -4);
    const n = a.norm();
    expect(n.len()).toBeCloseTo(1, 12);
    expect(n.mul(a.len()).approxEquals(a, 1e-9)).toBe(true);
    expect(Vec2.zero().norm().approxEquals(Vec2.zero(), EPS)).toBe(true);
  });

  it('rot preserves length; rot(θ).angle() === angle + θ', () => {
    const a = Vec2.fromAngle(0.7, 2);
    const rotated = a.rot(1.1);
    expect(rotated.len()).toBeCloseTo(2, 12);
    expect(rotated.angle()).toBeCloseTo(0.7 + 1.1, 12);
    // Full round trip: rotating by 2π returns the original vector.
    expect(a.rot(2 * Math.PI).approxEquals(a, 1e-9)).toBe(true);
  });

  it('fromAngle builds (len cos θ, len sin θ)', () => {
    const v = Vec2.fromAngle(Math.PI / 3, 5);
    expect(v.x).toBeCloseTo(2.5, 10);
    expect(v.y).toBeCloseTo((5 * Math.sqrt(3)) / 2, 10);
    expect(Vec2.fromAngle(0).approxEquals(new Vec2(1, 0), EPS)).toBe(true);
  });

  it('angle() is atan2(y, x)', () => {
    expect(new Vec2(1, 1).angle()).toBeCloseTo(Math.PI / 4, 12);
    expect(new Vec2(0, -1).angle()).toBeCloseTo(-Math.PI / 2, 12);
  });

  it('dist is symmetric and equals |a − b|', () => {
    const a = new Vec2(1, 2);
    const b = new Vec2(4, 6);
    expect(a.dist(b)).toBeCloseTo(5, 12);
    expect(a.dist(b)).toBeCloseTo(b.dist(a), 12);
    expect(a.dist(a)).toBe(0);
  });

  it('is immutable: operations return new instances', () => {
    const a = new Vec2(1, 2);
    const b = a.add(new Vec2(3, 4));
    expect(a.x).toBe(1);
    expect(a.y).toBe(2);
    expect(b).not.toBe(a);
    expect(b.approxEquals(new Vec2(4, 6), EPS)).toBe(true);
  });

  it('approxEquals respects epsilon', () => {
    const a = new Vec2(1, 1);
    expect(a.approxEquals(new Vec2(1 + 1e-10, 1), 1e-9)).toBe(true);
    expect(a.approxEquals(new Vec2(1 + 1e-6, 1), 1e-9)).toBe(false);
  });
});
