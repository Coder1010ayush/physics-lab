/**
 * Textbook force formulas — SI units, y-up convention.
 *
 * Pure math — no React, no DOM. Every formula here is the closed-form
 * reference the sims compare against, so it must match the textbook exactly.
 *
 * Units: mass [kg], length [m], time [s], force [N], angles [rad].
 */

import { Vec2 } from './vec2.js';

/** Standard gravitational acceleration near Earth's surface [m/s²]. */
export const G = 9.8;

/**
 * Gravitational acceleration vector [m/s²], pointing DOWN (y is up):
 * (0, −g). Multiply by mass to get the weight force [N].
 */
export function gravity(g = G): Vec2 {
  return new Vec2(0, -g);
}

/**
 * Unit direction vectors for a block on an incline tilted at angle theta
 * [rad] above horizontal (y-up world).
 *
 * - `parallel`: unit vector pointing DOWN the slope (direction the block
 *   slides when it slides).
 * - `normal`: unit vector perpendicular to the surface, pointing AWAY from
 *   it (the direction of the normal force on the block).
 *
 * With the slope rising to the right, down-slope is (+cos θ, −sin θ) and the
 * *outward* normal is (+sin θ, +cos θ).
 */
export function inclineDirections(theta: number): {
  parallel: Vec2;
  normal: Vec2;
} {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return {
    parallel: new Vec2(c, -s),
    normal: new Vec2(s, c),
  };
}

/**
 * Angle of repose: a block at rest on an incline starts to slide
 * spontaneously exactly when tan θ > μs (static friction limit).
 */
export function willSlide(theta: number, muStatic: number): boolean {
  return Math.tan(theta) > muStatic;
}

/**
 * Acceleration [m/s²] of a block sliding down an incline with kinetic
 * friction coefficient μk:
 *   a = g (sin θ − μk cos θ)
 * along the down-slope direction. Negative result means friction wins and
 * the block decelerates (or does not start from rest).
 */
export function slideAcceleration(
  theta: number,
  muKinetic: number,
  g = G,
): number {
  return g * (Math.sin(theta) - muKinetic * Math.cos(theta));
}

/**
 * Maximum static friction force [N]: fs,max = μs · N.
 * N is the normal force magnitude [N].
 */
export function maxStaticFriction(muStatic: number, N: number): number {
  return muStatic * N;
}

/**
 * Kinetic friction force magnitude [N]: fk = μk · N.
 * Direction always opposes relative motion (applied by the caller).
 */
export function kineticFriction(muKinetic: number, N: number): number {
  return muKinetic * N;
}

/**
 * Quadratic air drag force [N]: F = −k |v| v.
 * Magnitude k|v|², direction opposite to the velocity. k [kg/m] is the
 * drag coefficient (½ ρ Cd A in the standard model).
 */
export function quadraticDrag(k: number, vel: Vec2): Vec2 {
  return vel.mul(-k * vel.len());
}

/**
 * Atwood machine over a frictionless, massless pulley.
 * m1 hangs on the left, m2 on the right [kg].
 *
 *   a = (m1 − m2) g / (m1 + m2)      [m/s²]
 *   T = 2 m1 m2 g / (m1 + m2)        [N]
 *
 * `a` is signed: positive means m1 accelerates downward (m1 heavier).
 * `T` is the rope tension, same on both sides (massless rope + pulley).
 */
export function atwood(
  m1: number,
  m2: number,
  g = G,
): { a: number; tension: number } {
  const total = m1 + m2;
  if (total <= 0) {
    throw new Error(`total mass must be positive, got ${total}`);
  }
  return {
    a: ((m1 - m2) * g) / total,
    tension: (2 * m1 * m2 * g) / total,
  };
}
