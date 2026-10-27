/**
 * Friction simulation — sticking and sliding in two classroom modes.
 *
 * - `horizontal`: a block on flat ground pushed by a force that ramps up at
 *   RAMP_RATE [N/s]. Static friction matches the push until it hits the
 *   μs·N limit, then the block slides with kinetic friction μk·N.
 * - `incline`: a block on a ramp tilted at θ. Below the angle of repose
 *   (tan θ* = μs) it stays put; above it slides down-slope with
 *   a = g(sin θ − μk cos θ).
 *
 * Runs on the pure engine (semi-implicit Euler, fixed timestep) so every run
 * is deterministic and repeatable in front of a class. SI units, no React.
 */

import { Vec2 } from '../engine/vec2.js';
import { semiImplicitEuler } from '../engine/integrator.js';
import {
  gravity,
  inclineDirections,
  willSlide,
  slideAcceleration,
  maxStaticFriction,
  kineticFriction,
} from '../engine/forces.js';

export type FrictionMode = 'horizontal' | 'incline';

export interface FrictionParams {
  /** which classroom demo: push on flat ground, or block on a ramp */
  mode: FrictionMode;
  /** block mass [kg] */
  mass: number;
  /** static friction coefficient μs (dimensionless) */
  muS: number;
  /** kinetic friction coefficient μk (dimensionless) */
  muK: number;
  /** ramp angle [deg] — used only in incline mode */
  inclineAngleDeg: number;
}

export type FrictionPhase = 'ready' | 'running' | 'done';

export interface FrictionSnapshot {
  phase: FrictionPhase;
  t: number;
  /** position [m]: along the ground (horizontal) or along the slope (incline) */
  x: number;
  /** velocity [m/s] along the same axis */
  v: number;
  mode: FrictionMode;
  /** applied push force [N] (ramps up in horizontal mode, 0 in incline mode) */
  applied: number;
  /** current friction force magnitude [N] */
  friction: number;
  /** true while the block is sliding (kinetic regime) */
  sliding: boolean;
  /** static limit μs·N [N] for the current params */
  maxStatic: number;
  /** angle of repose θ* = atan μs [deg] */
  angleReposeDeg: number;
  xSamples: Array<[number, number]>;
  vSamples: Array<[number, number]>;
  appliedSamples: Array<[number, number]>;
  frictionSamples: Array<[number, number]>;
}

const GRAPH_HZ = 30;
/** push force ramp rate in horizontal mode [N/s] */
const RAMP_RATE = 3;
/** horizontal mode auto-completes once the push ramps up to this [N] */
const F_MAX = 60;
/** incline mode auto-completes once the block slid this far down-slope [m] */
const TRACK_LEN = 12;
/** Auto-complete: the run ends (the page pauses) after this much sim time [s]. */
const RUN_LIMIT_S = 30;

export class FrictionSim {
  private params: FrictionParams;
  private phase: FrictionPhase = 'ready';
  private t = 0;
  private x = 0;
  private v = 0;
  private applied = 0;
  private friction = 0;
  private sliding = false;
  private lastGraphAt = 0;
  readonly xSamples: Array<[number, number]> = [];
  readonly vSamples: Array<[number, number]> = [];
  readonly appliedSamples: Array<[number, number]> = [];
  readonly frictionSamples: Array<[number, number]> = [];

  constructor(params: FrictionParams) {
    this.params = { ...params };
  }

  /** Current phase without copying the full snapshot (cheap, for animation loops). */
  getPhase(): FrictionPhase {
    return this.phase;
  }

  getSnapshot(): FrictionSnapshot {
    return {
      phase: this.phase,
      t: this.t,
      x: this.x,
      v: this.v,
      mode: this.params.mode,
      applied: this.applied,
      friction: this.friction,
      sliding: this.sliding,
      maxStatic: this.maxStaticLimit(),
      angleReposeDeg: (Math.atan(this.params.muS) * 180) / Math.PI,
      xSamples: this.xSamples.slice(),
      vSamples: this.vSamples.slice(),
      appliedSamples: this.appliedSamples.slice(),
      frictionSamples: this.frictionSamples.slice(),
    };
  }

  /** Static limit μs·N [N] for the current params and mode. */
  private maxStaticLimit(): number {
    const N = this.normalForce();
    return maxStaticFriction(this.params.muS, N);
  }

  /** Normal force magnitude N [N] — mg on flat ground, mg·cos θ on the ramp. */
  private normalForce(): number {
    const w = gravity().mul(this.params.mass); // weight vector (0, −mg)
    if (this.params.mode === 'horizontal') {
      return -w.y; // flat ground: N = mg
    }
    const theta = (this.params.inclineAngleDeg * Math.PI) / 180;
    const { normal } = inclineDirections(theta);
    return Math.abs(w.dot(normal)); // ramp: N = mg cos θ
  }

  /** Arm the run: ready → running, block at the start with fresh samples. */
  start(): void {
    if (this.phase !== 'ready') {
      throw new Error(`start() requires phase 'ready', got '${this.phase}'`);
    }
    this.t = 0;
    this.x = 0;
    this.v = 0;
    this.applied = 0;
    this.sliding = false;
    this.friction = 0;
    if (this.params.mode === 'incline') {
      // Block starts at rest near the top: friction holds it (mg sin θ) or it
      // begins sliding immediately with kinetic friction.
      const theta = (this.params.inclineAngleDeg * Math.PI) / 180;
      this.sliding = willSlide(theta, this.params.muS);
      this.friction = this.sliding
        ? kineticFriction(this.params.muK, this.normalForce())
        : this.downSlopeDrive();
    }
    this.xSamples.length = 0;
    this.vSamples.length = 0;
    this.appliedSamples.length = 0;
    this.frictionSamples.length = 0;
    this.xSamples.push([0, 0]);
    this.vSamples.push([0, 0]);
    this.appliedSamples.push([0, this.applied]);
    this.frictionSamples.push([0, this.friction]);
    this.lastGraphAt = 0;
    this.phase = 'running';
  }

  /** Change parameters — returns the sim to the ready state (re-armed). */
  update(params: FrictionParams): void {
    this.params = { ...params };
    this.phase = 'ready';
    this.t = 0;
    this.x = 0;
    this.v = 0;
    this.applied = 0;
    this.friction = 0;
    this.sliding = false;
    this.xSamples.length = 0;
    this.vSamples.length = 0;
    this.appliedSamples.length = 0;
    this.frictionSamples.length = 0;
    this.lastGraphAt = 0;
  }

  /** Down-slope drive force |mg · parallel| [N] — the pull of gravity along the ramp. */
  private downSlopeDrive(): number {
    const theta = (this.params.inclineAngleDeg * Math.PI) / 180;
    const w = gravity().mul(this.params.mass);
    const { parallel } = inclineDirections(theta);
    return Math.abs(w.dot(parallel)); // mg sin θ
  }

  /** Advance the run by one fixed timestep [s]. Throws unless running. */
  step(dt: number): void {
    if (this.phase !== 'running') {
      throw new Error(`step() requires phase 'running', got '${this.phase}'`);
    }

    const prevT = this.t;
    let a = 0; // acceleration along the motion axis [m/s²]

    if (this.params.mode === 'horizontal') {
      // The push ramps up: push harder and harder until the block breaks loose.
      this.applied = Math.min(this.applied + RAMP_RATE * dt, F_MAX);
      const N = this.normalForce();
      const fsMax = maxStaticFriction(this.params.muS, N);

      if (!this.sliding && this.applied > fsMax) {
        this.sliding = true; // static limit broken — the block breaks loose
      }
      if (this.sliding) {
        const fk = kineticFriction(this.params.muK, N);
        this.friction = fk;
        a = (this.applied - fk) / this.params.mass; // net force along the ground
      } else {
        this.friction = this.applied; // static friction matches the push
      }
    } else {
      const theta = (this.params.inclineAngleDeg * Math.PI) / 180;
      if (!this.sliding) {
        if (willSlide(theta, this.params.muS)) {
          this.sliding = true; // past the angle of repose — it lets go
        } else {
          this.friction = this.downSlopeDrive(); // static friction holds: f = mg sin θ
        }
      }
      if (this.sliding) {
        a = slideAcceleration(theta, this.params.muK); // g(sin θ − μk cos θ)
        this.friction = kineticFriction(this.params.muK, this.normalForce());
      }
    }

    // 1D motion through the 2D engine: the ground / slope is the x-axis.
    const next = semiImplicitEuler(
      new Vec2(this.x, 0),
      new Vec2(this.v, 0),
      new Vec2(a, 0),
      dt,
    );
    this.x = next.pos.x;
    this.v = next.vel.x;
    this.t = prevT + dt;

    // Re-stick: slid back to a stop while the push is under the static limit.
    if (this.sliding && this.v <= 0 && this.applied <= this.maxStaticLimit()) {
      this.sliding = false;
      this.v = 0;
      this.friction = this.applied;
    }

    // Auto-complete: ramp maxed out, block reached the ramp foot, or time limit.
    const finished =
      this.t >= RUN_LIMIT_S ||
      (this.params.mode === 'horizontal'
        ? this.applied >= F_MAX
        : this.x >= TRACK_LEN);
    if (finished) {
      this.phase = 'done';
      this.xSamples.push([this.t, this.x]);
      this.vSamples.push([this.t, this.v]);
      this.appliedSamples.push([this.t, this.applied]);
      this.frictionSamples.push([this.t, this.friction]);
      return;
    }

    if (this.t - this.lastGraphAt >= 1 / GRAPH_HZ) {
      this.lastGraphAt = this.t;
      this.xSamples.push([this.t, this.x]);
      this.vSamples.push([this.t, this.v]);
      this.appliedSamples.push([this.t, this.applied]);
      this.frictionSamples.push([this.t, this.friction]);
    }
  }
}
