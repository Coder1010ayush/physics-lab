/**
 * 1D kinematics simulation — constant acceleration along a straight track.
 *
 * Runs on the pure engine (semi-implicit Euler, fixed timestep) so every run
 * is deterministic and repeatable in front of a class.
 * SI units, x along the track, start at the origin (x = 0).
 */

import { Vec2 } from '../engine/vec2.js';
import { semiImplicitEuler } from '../engine/integrator.js';

export type KinematicsPhase = 'ready' | 'running' | 'done';

export interface KinematicsParams {
  /** initial speed u [m/s] */
  u: number;
  /** constant acceleration a [m/s²] */
  a: number;
}

/** A moment where v crosses zero — the car is instantaneously at rest. */
export interface KinematicsTurningPoint {
  t: number;
  x: number;
}

export interface KinematicsSnapshot {
  phase: KinematicsPhase;
  t: number;
  x: number;
  v: number;
  /** total distance travelled (path length, not displacement) [m] */
  travelled: number;
  /** max |v| reached so far [m/s] */
  maxSpeed: number;
  xSamples: Array<[number, number]>;
  vSamples: Array<[number, number]>;
  turningPoints: KinematicsTurningPoint[];
}

const GRAPH_HZ = 30;
/** Auto-complete: the run ends (the page pauses) after this much sim time [s]. */
const RUN_LIMIT_S = 30;

export class KinematicsSim {
  private params: KinematicsParams;
  private phase: KinematicsPhase = 'ready';
  private t = 0;
  private x = 0;
  private v = 0;
  private travelled = 0;
  private maxSpeed = 0;
  private turningPoints: KinematicsTurningPoint[] = [];
  private lastGraphAt = 0;
  readonly xSamples: Array<[number, number]> = [];
  readonly vSamples: Array<[number, number]> = [];

  constructor(params: KinematicsParams) {
    this.params = { ...params };
    this.v = params.u;
    this.maxSpeed = Math.abs(params.u);
  }

  /** Current phase without copying the full snapshot (cheap, for animation loops). */
  getPhase(): KinematicsPhase {
    return this.phase;
  }

  getSnapshot(): KinematicsSnapshot {
    return {
      phase: this.phase,
      t: this.t,
      x: this.x,
      v: this.v,
      travelled: this.travelled,
      maxSpeed: this.maxSpeed,
      xSamples: this.xSamples.slice(),
      vSamples: this.vSamples.slice(),
      turningPoints: this.turningPoints.map((tp) => ({ ...tp })),
    };
  }

  /** Arm the run: ready → running, car at the origin with speed u. */
  start(): void {
    if (this.phase !== 'ready') {
      throw new Error(`start() requires phase 'ready', got '${this.phase}'`);
    }
    this.t = 0;
    this.x = 0;
    this.v = this.params.u;
    this.travelled = 0;
    this.maxSpeed = Math.abs(this.params.u);
    this.turningPoints = [];
    this.xSamples.length = 0;
    this.vSamples.length = 0;
    this.xSamples.push([0, 0]);
    this.vSamples.push([0, this.v]);
    this.lastGraphAt = 0;
    this.phase = 'running';
  }

  /** Change parameters — returns the sim to the ready state (re-armed). */
  update(params: KinematicsParams): void {
    this.params = { ...params };
    this.phase = 'ready';
    this.t = 0;
    this.x = 0;
    this.v = this.params.u;
    this.travelled = 0;
    this.maxSpeed = Math.abs(this.params.u);
    this.turningPoints = [];
    this.xSamples.length = 0;
    this.vSamples.length = 0;
    this.lastGraphAt = 0;
  }

  /** Advance the run by one fixed timestep [s]. Throws unless running. */
  step(dt: number): void {
    if (this.phase !== 'running') {
      throw new Error(`step() requires phase 'running', got '${this.phase}'`);
    }

    const a = this.params.a;
    const prevT = this.t;
    const prevX = this.x;
    const prevV = this.v;

    // 1D motion through the 2D engine: the track is the x-axis.
    const next = semiImplicitEuler(
      new Vec2(prevX, 0),
      new Vec2(prevV, 0),
      new Vec2(a, 0),
      dt,
    );
    this.x = next.pos.x;
    this.v = next.vel.x;
    this.t = prevT + dt;

    this.travelled += Math.abs(this.x - prevX);
    if (Math.abs(this.v) > this.maxSpeed) this.maxSpeed = Math.abs(this.v);

    // Turning point: v changed sign during this step. With constant a the
    // crossing is exact (continuous motion, not the stepped samples):
    //   v = 0  at  t* = t_prev − v_prev / a
    //   x*     =  x_prev − v_prev² / (2a)   (= x_prev + v_prev² / 2|a|)
    if (a !== 0 && ((prevV > 0 && this.v <= 0) || (prevV < 0 && this.v >= 0))) {
      this.turningPoints.push({
        t: prevT - prevV / a,
        x: prevX - (prevV * prevV) / (2 * a),
      });
    }

    // Auto-complete at the run limit; the page pauses on 'done'.
    if (this.t >= RUN_LIMIT_S) {
      this.phase = 'done';
      this.xSamples.push([this.t, this.x]);
      this.vSamples.push([this.t, this.v]);
      return;
    }

    if (this.t - this.lastGraphAt >= 1 / GRAPH_HZ) {
      this.lastGraphAt = this.t;
      this.xSamples.push([this.t, this.x]);
      this.vSamples.push([this.t, this.v]);
    }
  }
}
