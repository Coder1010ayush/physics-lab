/**
 * Force & pulley simulation — two classroom modes.
 *
 * - `atwood`: the Atwood machine. Two masses over a frictionless,
 *   massless pulley — a 1-DOF constraint system. Acceleration a and rope
 *   tension T come from the engine's closed form `atwood(m1, m2, g)`;
 *   one displacement s is integrated (m1 moves DOWN by s, m2 UP by s).
 *   Equal masses balance (a = 0) and the run rides to the time cap.
 * - `tableEdge`: a block on a table connected over a pulley to a hanging
 *   mass. Static friction decides first: if mₕ·g ≤ μs·m_t·g the system
 *   sticks (a = 0, T = mₕ·g); otherwise it slides with kinetic friction
 *   and a = (mₕ·g − μk·m_t·g)/(m_t + mₕ), T = mₕ·(g − a).
 *
 * Runs on the pure engine (semi-implicit Euler, fixed timestep) so every
 * run is deterministic and repeatable in front of a class. SI units, no
 * React, no Math.random, no Date.now.
 */

import { Vec2 } from '../engine/vec2.js';
import { semiImplicitEuler } from '../engine/integrator.js';
import {
  G,
  atwood,
  maxStaticFriction,
  kineticFriction,
} from '../engine/forces.js';

export type PulleyMode = 'atwood' | 'tableEdge';

export interface PulleyParams {
  /** which classroom demo: two hanging masses, or a block pulled off a table */
  mode: PulleyMode;
  /** left hanging mass [kg] — atwood mode */
  m1: number;
  /** right hanging mass [kg] — atwood mode */
  m2: number;
  /** block mass on the table [kg] — tableEdge mode */
  mTable: number;
  /** hanging mass pulling the block [kg] — tableEdge mode */
  mHanging: number;
  /** static friction coefficient μs (dimensionless) — tableEdge mode */
  muStatic: number;
  /** kinetic friction coefficient μk (dimensionless) — tableEdge mode */
  muKinetic: number;
  /** gravitational acceleration [m/s²] (Earth 9.8, Moon 1.62) */
  g: number;
}

export type PulleyPhase = 'ready' | 'running' | 'done';

export type PulleyStatus =
  | 'm₁ descends'
  | 'm₂ descends'
  | 'balanced'
  | 'held by static friction'
  | 'sliding';

export interface PulleySnapshot {
  phase: PulleyPhase;
  t: number;
  mode: PulleyMode;
  /** positions [m] of both bodies along the rope: atwood → { m1 drop, m2 rise }
   *  (mirrored by the constraint), tableEdge → { table slide, hanging drop }. */
  positions: { body1: number; body2: number };
  /** rope speed [m/s] (same magnitude on both sides — one degree of freedom) */
  v: number;
  /** acceleration along the rope [m/s²] */
  a: number;
  /** rope tension [N] */
  T: number;
  status: PulleyStatus;
  pos1Samples: Array<[number, number]>;
  pos2Samples: Array<[number, number]>;
  vSamples: Array<[number, number]>;
}

const GRAPH_HZ = 30;
/** Atwood: both masses hang 1.1 m below the pulley at the start; the run ends
 *  when the descending mass reaches the floor (drop 1.1 m) or the ascending
 *  mass reaches the pulley (rise PULLEY_CLEAR). */
const ATWOOD_FLOOR_DROP = 1.1;
const PULLEY_CLEAR = 1.05;
/** tableEdge: the hanging mass starts at pulley level; the floor is this
 *  far below [m]. */
const TABLE_EDGE_FLOOR = 1.5;
/** Auto-complete: the run ends (the page pauses) after this much sim time [s]. */
const RUN_LIMIT_S = 30;

export class PulleySim {
  private params: PulleyParams;
  private phase: PulleyPhase = 'ready';
  private t = 0;
  /** rope displacement [m]: atwood → m1 drop (= m2 rise); tableEdge → hanging drop */
  private s = 0;
  private v = 0;
  private lastGraphAt = 0;
  readonly pos1Samples: Array<[number, number]> = [];
  readonly pos2Samples: Array<[number, number]> = [];
  readonly vSamples: Array<[number, number]> = [];

  constructor(params: PulleyParams = DEFAULT_PULLEY_PARAMS) {
    this.params = { ...params };
  }

  /** Current phase without copying the full snapshot (cheap, for animation loops). */
  getPhase(): PulleyPhase {
    return this.phase;
  }

  /** Second body's position [m] along the rope (see PulleySnapshot.positions). */
  private body2(): number {
    if (this.params.mode !== 'atwood') return this.s;
    return this.s === 0 ? 0 : -this.s;
  }

  getSnapshot(): PulleySnapshot {
    // −0 → 0 so readouts and strict equality stay clean while at rest.
    return {
      phase: this.phase,
      t: this.t,
      mode: this.params.mode,
      positions: { body1: this.s, body2: this.body2() },
      v: this.v,
      a: this.accel(),
      T: this.tension(),
      status: this.status(),
      pos1Samples: this.pos1Samples.slice(),
      pos2Samples: this.pos2Samples.slice(),
      vSamples: this.vSamples.slice(),
    };
  }

  /** Acceleration along the rope [m/s²] for the current params (0 while held/balanced). */
  private accel(): number {
    const p = this.params;
    if (p.mode === 'atwood') {
      return atwood(p.m1, p.m2, p.g).a; // signed: + → m1 accelerates down
    }
    if (this.holds()) {
      return 0; // static friction wins: the system sticks
    }
    const fk = kineticFriction(p.muKinetic, p.mTable * p.g);
    return (p.mHanging * p.g - fk) / (p.mTable + p.mHanging);
  }

  /** Rope tension [N] for the current params. */
  private tension(): number {
    const p = this.params;
    if (p.mode === 'atwood') {
      return atwood(p.m1, p.m2, p.g).tension;
    }
    if (this.holds()) {
      return p.mHanging * p.g; // static friction holds: T = mₕ·g
    }
    return p.mHanging * (p.g - this.accel()); // T = mₕ(g − a)
  }

  /** tableEdge static check: does static friction hold the system at rest? */
  private holds(): boolean {
    const p = this.params;
    const fsMax = maxStaticFriction(p.muStatic, p.mTable * p.g);
    return p.mHanging * p.g <= fsMax;
  }

  /** Human-facing status chip text for the current params. */
  private status(): PulleyStatus {
    const p = this.params;
    if (p.mode === 'atwood') {
      const { a } = atwood(p.m1, p.m2, p.g);
      if (a > 0) return 'm₁ descends';
      if (a < 0) return 'm₂ descends';
      return 'balanced';
    }
    return this.holds() ? 'held by static friction' : 'sliding';
  }

  /** Arm the run: ready → running, both bodies at the start with fresh samples. */
  start(): void {
    if (this.phase !== 'ready') {
      throw new Error(`start() requires phase 'ready', got '${this.phase}'`);
    }
    this.t = 0;
    this.s = 0;
    this.v = 0;
    this.pos1Samples.length = 0;
    this.pos2Samples.length = 0;
    this.vSamples.length = 0;
    this.pos1Samples.push([0, 0]);
    this.pos2Samples.push([0, 0]);
    this.vSamples.push([0, 0]);
    this.lastGraphAt = 0;
    this.phase = 'running';
  }

  /** Change parameters — returns the sim to the ready state (re-armed). */
  update(params: PulleyParams): void {
    this.params = { ...params };
    this.phase = 'ready';
    this.t = 0;
    this.s = 0;
    this.v = 0;
    this.pos1Samples.length = 0;
    this.pos2Samples.length = 0;
    this.vSamples.length = 0;
    this.lastGraphAt = 0;
  }

  /** Advance the run by one fixed timestep [s]. Throws unless running. */
  step(dt: number): void {
    if (this.phase !== 'running') {
      throw new Error(`step() requires phase 'running', got '${this.phase}'`);
    }

    const prevT = this.t;
    const a = this.accel(); // constant for fixed params — closed form

    // 1D motion through the 2D engine: the rope is the x-axis.
    const next = semiImplicitEuler(
      new Vec2(this.s, 0),
      new Vec2(this.v, 0),
      new Vec2(a, 0),
      dt,
    );
    this.s = next.pos.x;
    this.v = next.vel.x;
    this.t = prevT + dt;

    // Auto-complete: floor / pulley-off / table-edge floor / time cap.
    const finished =
      this.t >= RUN_LIMIT_S ||
      (this.params.mode === 'atwood'
        ? this.s >= ATWOOD_FLOOR_DROP || this.s <= -PULLEY_CLEAR
        : this.s >= TABLE_EDGE_FLOOR);
    if (finished) {
      this.phase = 'done';
      this.pos1Samples.push([this.t, this.s]);
      this.pos2Samples.push([this.t, this.body2()]);
      this.vSamples.push([this.t, this.v]);
      return;
    }

    if (this.t - this.lastGraphAt >= 1 / GRAPH_HZ) {
      this.lastGraphAt = this.t;
      this.pos1Samples.push([this.t, this.s]);
      this.pos2Samples.push([this.t, this.body2()]);
      this.vSamples.push([this.t, this.v]);
    }
  }
}

/** Default parameters (exported for pages/tests convenience). */
export const DEFAULT_PULLEY_PARAMS: PulleyParams = {
  mode: 'atwood',
  m1: 3,
  m2: 2,
  mTable: 5,
  mHanging: 1,
  muStatic: 0.3,
  muKinetic: 0.2,
  g: G,
};
