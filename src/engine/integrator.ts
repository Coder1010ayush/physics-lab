/**
 * Deterministic fixed-timestep integration.
 *
 * Pure math — no React, no DOM, no Math.random, no Date.now.
 * SI units: positions [m], velocities [m/s], accelerations [m/s²], time [s].
 */

import { Vec2 } from './vec2.js';

/**
 * One semi-implicit (symplectic) Euler step — velocity first, then position:
 *   v' = v + a·dt
 *   p' = p + v'·dt
 *
 * Velocity-first ordering makes the integrator symplectic: for constant
 * acceleration it conserves energy far better than explicit Euler and stays
 * stable for oscillatory systems (springs, pendulums).
 *
 * Pure: returns new vectors, never mutates the inputs.
 *
 * @param pos position [m]
 * @param vel velocity [m/s]
 * @param acc acceleration [m/s²] (assumed constant over the step)
 * @param dt fixed timestep [s]
 */
export function semiImplicitEuler(
  pos: Vec2,
  vel: Vec2,
  acc: Vec2,
  dt: number,
): { pos: Vec2; vel: Vec2 } {
  if (dt < 0) {
    throw new Error(`dt must be non-negative, got ${dt}`);
  }
  const newVel = vel.add(acc.mul(dt));
  const newPos = pos.add(newVel.mul(dt));
  return { pos: newPos, vel: newVel };
}

/**
 * Fixed-timestep clock using the accumulator pattern.
 *
 * Frames arrive with variable real durations; physics always advances in
 * identical fixed steps of `fixedDt` [s], so the simulation is deterministic
 * and repeatable regardless of frame timing. Leftover time (< fixedDt) is
 * carried over to the next frame, never discarded.
 */
export class FixedStepClock {
  readonly fixedDt: number;
  readonly maxStepsPerFrame: number;
  /** Carried-over time [s] that has not yet been consumed by a step. */
  private accumulator = 0;

  constructor(fixedDt = 1 / 240, maxStepsPerFrame = 10) {
    if (fixedDt <= 0) {
      throw new Error(`fixedDt must be positive, got ${fixedDt}`);
    }
    if (maxStepsPerFrame < 1) {
      throw new Error(`maxStepsPerFrame must be >= 1, got ${maxStepsPerFrame}`);
    }
    this.fixedDt = fixedDt;
    this.maxStepsPerFrame = maxStepsPerFrame;
  }

  /**
   * Feed one frame's duration [s]; returns the list of fixed dts [s] to step
   * this frame (each equal to `fixedDt`). Never more than `maxStepsPerFrame`.
   * Excess time beyond the cap is dropped to avoid a spiral of death.
   */
  advance(frameDt: number): number[] {
    if (frameDt < 0) {
      throw new Error(`frameDt must be non-negative, got ${frameDt}`);
    }
    this.accumulator += frameDt;
    const steps: number[] = [];
    while (this.accumulator >= this.fixedDt && steps.length < this.maxStepsPerFrame) {
      this.accumulator -= this.fixedDt;
      steps.push(this.fixedDt);
    }
    // If we hit the cap with time still banked, discard the excess so a
    // stalled frame cannot accumulate into a runaway catch-up burst.
    if (steps.length === this.maxStepsPerFrame) {
      this.accumulator = 0;
    }
    return steps;
  }

  /** Reset the carried-over remainder to zero (e.g. on sim reset). */
  reset(): void {
    this.accumulator = 0;
  }
}
