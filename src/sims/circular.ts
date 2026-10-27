/**
 * Circular motion simulation — three classroom modes.
 *
 * - `uniform`: a ball on a string revolving at constant ω (plan view). The
 *   angle φ advances with φ += ω·dt — exact for constant ω; v, a_c, F_c and
 *   the period come from the engine's closed forms. Gravity does not enter
 *   a horizontal circle, so the Earth/Moon toggle only changes the readouts
 *   of the other two modes. Auto-completes after three full turns (φ ≥ 6π)
 *   or the 30 s cap.
 * - `loop`: a ball launched along the inside of a vertical loop. One-DOF
 *   integration along the track (angular position θ from the bottom,
 *   tangential acceleration a_t = −g·sin θ, semi-implicit Euler). Each step
 *   computes N = m(v²/r + g·cos θ); if N < 0 in the upper half the ball
 *   leaves the track and falls as a projectile from the current position
 *   with the current tangential velocity until it lands (y ≤ 0). Too slow to
 *   climb: it rolls back and oscillates in the lower half until the cap.
 *   θ ≥ 2π completes the loop.
 * - `banked`: a car circulating at constant speed v on a banked ring. The
 *   required centripetal force m·v²/r is compared live with what the banked
 *   road supplies frictionlessly (m·g·tan θ); v_opt = √(r·g·tan θ) needs
 *   no friction at all. Auto-completes after two laps or the 30 s cap.
 *
 * Runs on the pure engine (fixed timestep) so every run is deterministic and
 * repeatable in front of a class. SI units, no React, no Math.random, no
 * Date.now.
 */

import { Vec2 } from '../engine/vec2.js';
import { semiImplicitEuler } from '../engine/integrator.js';
import { G } from '../engine/forces.js';
import {
  ucmSpeed,
  centripetalAccel,
  centripetalForce,
  loopHeight,
  loopNormalForce,
  bankedOptimumSpeed,
  bankedAvailableForce,
} from '../engine/circular.js';

export type CircularMode = 'uniform' | 'loop' | 'banked';

/** `uniform` — ball on a string, plan view. */
export interface UniformParams {
  /** circle radius [m] */
  r: number;
  /** angular speed [rad/s] */
  omega: number;
  /** ball mass [kg] */
  m: number;
}

/** `loop` — ball on the inside of a vertical loop. */
export interface LoopParams {
  /** loop radius [m] */
  r: number;
  /** launch speed at the loop bottom [m/s] */
  v0: number;
  /** ball mass [kg] */
  m: number;
}

/** `banked` — car on a banked curve, seen in cross-section. */
export interface BankedParams {
  /** turn radius [m] */
  r: number;
  /** bank angle [deg] */
  thetaBankDeg: number;
  /** car speed [m/s] */
  v: number;
  /** car mass [kg] */
  m: number;
}

export interface CircularParams {
  /** which classroom demo: string, loop-the-loop, or banked curve */
  mode: CircularMode;
  /** ball-on-a-string settings */
  uniform: UniformParams;
  /** loop-the-loop settings */
  loop: LoopParams;
  /** banked-curve settings */
  banked: BankedParams;
  /** gravitational acceleration [m/s²] (Earth 9.8, Moon 1.62) */
  g: number;
}

export type CircularPhase = 'ready' | 'running' | 'done';

/** Free-fall state captured the instant the ball leaves the loop track. */
export interface LoopLeaveState {
  /** position [m] relative to the loop base */
  x: number;
  y: number;
  /** velocity [m/s] — tangential at the moment of leaving */
  vx: number;
  vy: number;
  /** sim time [s] when contact was lost */
  t: number;
}

export interface CircularSnapshot {
  phase: CircularPhase;
  t: number;
  mode: CircularMode;
  /** human-facing status chip text */
  status: string;

  /** uniform: revolution angle [rad] — ball at (r·sin φ, r·cos φ), φ = 0 → top of the plan-view circle */
  phi: number;
  /** ball position [m]: uniform → on the string circle; loop → on the track or in flight */
  x: number;
  y: number;
  /** speed [m/s]: uniform → constant ω·r; loop → signed tangential speed on the track, flight speed after leaving; banked → car speed */
  v: number;
  /** velocity components [m/s] (uniform graphs; loop uses them in flight too) */
  vx: number;
  vy: number;
  /** uniform: centripetal acceleration [m/s²] */
  aC: number;
  /** uniform: centripetal force [N] */
  fC: number;
  /** uniform: completed revolutions, φ/2π */
  revolutions: number;

  /** loop: angular position [rad], θ = 0 at the bottom (frozen once airborne) */
  theta: number;
  /** loop: height above the loop base [m] */
  height: number;
  /** loop: track normal force [N] — 0 once the ball has left the track */
  N: number;
  /** loop: false once the ball has left the track */
  onTrack: boolean;
  /** loop: free-fall initial state at the instant of losing contact (null while on the track) */
  leave: LoopLeaveState | null;

  /** banked: ring angle [rad] */
  angle: number;
  /** banked: frictionless optimum speed √(r·g·tan θ) [m/s] */
  vOpt: number;
  /** banked: required centripetal force m·v²/r [N] */
  required: number;
  /** banked: force the bank supplies frictionlessly, m·g·tan θ [N] */
  available: number;
  /** banked: required − available [N] — friction must make up the difference */
  delta: number;
  /** banked: |Δ| within 1 % of the requirement → the bank alone is enough */
  perfect: boolean;

  /** 30 Hz sample arrays for graphs (only the active mode's arrays are filled) */
  vxSamples: Array<[number, number]>;
  vySamples: Array<[number, number]>;
  vSamples: Array<[number, number]>;
  nSamples: Array<[number, number]>;
  requiredSamples: Array<[number, number]>;
  availableSamples: Array<[number, number]>;
}

const GRAPH_HZ = 30;
/** uniform: auto-complete after this many full turns. */
const UNIFORM_TURNS = 3;
/** banked: auto-complete after this many laps. */
const BANKED_LAPS = 2;
/** loop: the loop is complete at θ = 2π. */
const FULL_LOOP = 2 * Math.PI;
/** Auto-complete: the run ends (the page pauses) after this much sim time [s]. */
const RUN_LIMIT_S = 30;

/** How the loop run is going / how it ended. */
type LoopOutcome = 'climbing' | 'fullLoop' | 'lostContact' | 'rollsBack';

export class CircularSim {
  private params: CircularParams;
  private phase: CircularPhase = 'ready';
  private t = 0;
  private lastGraphAt = 0;

  // uniform state: revolution angle [rad]
  private phi = 0;

  // loop state: angular position [rad] and angular velocity [rad/s] (v = w·r)
  private theta = 0;
  private w = 0;
  private onTrack = true;
  private leave: LoopLeaveState | null = null;
  private outcome: LoopOutcome = 'climbing';
  /** track angle [deg] at the instant contact was lost (status chip). */
  private leaveThetaDeg = 0;
  // free-fall state, valid once onTrack is false
  private fx = 0;
  private fy = 0;
  private fvx = 0;
  private fvy = 0;

  // banked state: ring angle [rad]
  private angle = 0;

  readonly vxSamples: Array<[number, number]> = [];
  readonly vySamples: Array<[number, number]> = [];
  readonly vSamples: Array<[number, number]> = [];
  readonly nSamples: Array<[number, number]> = [];
  readonly requiredSamples: Array<[number, number]> = [];
  readonly availableSamples: Array<[number, number]> = [];

  constructor(params: CircularParams = DEFAULT_CIRCULAR_PARAMS) {
    this.params = { ...params };
  }

  /** Current phase without copying the full snapshot (cheap, for animation loops). */
  getPhase(): CircularPhase {
    return this.phase;
  }

  getSnapshot(): CircularSnapshot {
    const snap: CircularSnapshot = {
      phase: this.phase,
      t: this.t,
      mode: this.params.mode,
      status: '',
      phi: 0,
      x: 0,
      y: 0,
      v: 0,
      vx: 0,
      vy: 0,
      aC: 0,
      fC: 0,
      revolutions: 0,
      theta: 0,
      height: 0,
      N: 0,
      onTrack: true,
      leave: null,
      angle: 0,
      vOpt: 0,
      required: 0,
      available: 0,
      delta: 0,
      perfect: false,
      vxSamples: this.vxSamples.slice(),
      vySamples: this.vySamples.slice(),
      vSamples: this.vSamples.slice(),
      nSamples: this.nSamples.slice(),
      requiredSamples: this.requiredSamples.slice(),
      availableSamples: this.availableSamples.slice(),
    };
    if (this.params.mode === 'uniform') {
      this.fillUniform(snap);
    } else if (this.params.mode === 'loop') {
      this.fillLoop(snap);
    } else {
      this.fillBanked(snap);
    }
    snap.status = this.status();
    return snap;
  }

  /** Uniform-mode fields: closed forms from ω and r at the current angle φ. */
  private fillUniform(snap: CircularSnapshot): void {
    const u = this.params.uniform;
    const v = ucmSpeed(u.omega, u.r);
    snap.phi = this.phi;
    snap.x = u.r * Math.sin(this.phi);
    snap.y = u.r * Math.cos(this.phi);
    snap.v = v;
    snap.vx = v * Math.cos(this.phi);
    snap.vy = -v * Math.sin(this.phi);
    snap.aC = centripetalAccel(u.omega, u.r);
    snap.fC = centripetalForce(u.m, u.omega, u.r);
    snap.revolutions = this.phi / (2 * Math.PI);
  }

  /** Loop-mode fields: track position, signed tangential speed, N, height. */
  private fillLoop(snap: CircularSnapshot): void {
    const lp = this.params.loop;
    const onTrack = this.onTrack;
    const v = onTrack ? this.w * lp.r : Math.hypot(this.fvx, this.fvy);
    snap.x = onTrack ? lp.r * Math.sin(this.theta) : this.fx;
    snap.y = onTrack ? lp.r - lp.r * Math.cos(this.theta) : this.fy;
    snap.v = v;
    snap.vx = onTrack ? v * Math.cos(this.theta) : this.fvx;
    snap.vy = onTrack ? v * Math.sin(this.theta) : this.fvy;
    snap.theta = this.theta;
    snap.height = onTrack ? loopHeight(this.theta, lp.r) : this.fy;
    snap.N = this.loopN();
    snap.onTrack = onTrack;
    snap.leave = this.leave;
  }

  /** Banked-mode fields: live required vs available centripetal force. */
  private fillBanked(snap: CircularSnapshot): void {
    const q = this.bankedQuantities();
    snap.angle = this.angle;
    snap.v = this.params.banked.v;
    snap.vOpt = q.vOpt;
    snap.required = q.required;
    snap.available = q.available;
    snap.delta = q.delta;
    snap.perfect = q.perfect;
  }

  /** Banked-mode closed forms for the current params. */
  private bankedQuantities(): {
    vOpt: number;
    required: number;
    available: number;
    delta: number;
    perfect: boolean;
  } {
    const b = this.params.banked;
    const thetaRad = (b.thetaBankDeg * Math.PI) / 180;
    const vOpt = bankedOptimumSpeed(b.r, this.params.g, thetaRad);
    const required = centripetalForce(b.m, b.v / b.r, b.r); // m·v²/r
    const available = bankedAvailableForce(b.m, this.params.g, thetaRad);
    const delta = required - available;
    return {
      vOpt,
      required,
      available,
      delta,
      perfect: Math.abs(delta) < 0.01 * Math.max(1, required),
    };
  }

  /** Track normal force [N] at the current loop state (0 once airborne). */
  private loopN(): number {
    if (!this.onTrack) return 0;
    const lp = this.params.loop;
    const v = this.w * lp.r;
    return loopNormalForce(lp.m, v * v, this.theta, lp.r, this.params.g);
  }

  /** Human-facing status chip text for the current mode and state. */
  private status(): string {
    const p = this.params;
    if (p.mode === 'uniform') {
      return `ω = ${p.uniform.omega.toFixed(1)} rad/s · revolving`;
    }
    if (p.mode === 'loop') {
      if (this.outcome === 'fullLoop') return 'full loop';
      if (this.outcome === 'lostContact') {
        return `lost contact at θ = ${this.leaveThetaDeg.toFixed(1)}°`;
      }
      if (this.outcome === 'rollsBack') return 'rolls back';
      return 'climbing the loop';
    }
    const q = this.bankedQuantities();
    return q.perfect
      ? 'perfectly banked'
      : `friction must supply Δ = ${q.delta.toFixed(1)} N`;
  }

  /** Arm the run: ready → running, everything at the start with fresh samples. */
  start(): void {
    if (this.phase !== 'ready') {
      throw new Error(`start() requires phase 'ready', got '${this.phase}'`);
    }
    this.resetState();
    this.clearSamples();
    if (this.params.mode === 'uniform') {
      const v = ucmSpeed(this.params.uniform.omega, this.params.uniform.r);
      this.vxSamples.push([0, v]); // vx = v·cos 0
      this.vySamples.push([0, 0]); // vy = −v·sin 0
    } else if (this.params.mode === 'loop') {
      const v0 = this.w * this.params.loop.r;
      this.vSamples.push([0, v0]);
      this.nSamples.push([0, this.loopN()]); // bottom: N = m(v₀²/r + g)
    } else {
      const q = this.bankedQuantities();
      this.requiredSamples.push([0, q.required]);
      this.availableSamples.push([0, q.available]);
    }
    this.phase = 'running';
  }

  /** Change parameters — returns the sim to the ready state (re-armed). */
  update(params: CircularParams): void {
    this.params = { ...params };
    this.resetState();
    this.clearSamples();
    this.phase = 'ready';
  }

  /** Advance the run by one fixed timestep [s]. Throws unless running. */
  step(dt: number): void {
    if (this.phase !== 'running') {
      throw new Error(`step() requires phase 'running', got '${this.phase}'`);
    }

    this.t += dt;
    const mode = this.params.mode;
    if (mode === 'uniform') {
      this.phi += this.params.uniform.omega * dt; // constant ω — exact
    } else if (mode === 'loop') {
      this.stepLoop(dt);
    } else {
      this.angle += (this.params.banked.v / this.params.banked.r) * dt;
    }

    // Auto-complete: mode goal reached, loop landed, or the time cap.
    const finished =
      this.t >= RUN_LIMIT_S ||
      (mode === 'uniform'
        ? this.phi >= UNIFORM_TURNS * 2 * Math.PI
        : mode === 'loop'
          ? this.outcome === 'fullLoop' || (!this.onTrack && this.fy <= 0)
          : this.angle >= BANKED_LAPS * 2 * Math.PI);
    if (finished) {
      this.phase = 'done';
      this.pushSamples();
      return;
    }

    if (this.t - this.lastGraphAt >= 1 / GRAPH_HZ) {
      this.lastGraphAt = this.t;
      this.pushSamples();
    }
  }

  /** One loop-mode step: track climb / contact loss / free fall / rollback. */
  private stepLoop(dt: number): void {
    const lp = this.params.loop;
    const g = this.params.g;

    if (this.onTrack) {
      // 1-DOF along the track through the 2D engine: θ is the position,
      // w the angular velocity (v = w·r), α = a_t/r = −(g/r)·sin θ.
      const alpha = (-g * Math.sin(this.theta)) / lp.r;
      const next = semiImplicitEuler(
        new Vec2(this.theta, 0),
        new Vec2(this.w, 0),
        new Vec2(alpha, 0),
        dt,
      );
      this.theta = next.pos.x;
      this.w = next.vel.x;
      const v = this.w * lp.r;

      // Contact check at the new position: N < 0 in the upper half means the
      // track would have to pull the ball inward — it flies off instead.
      if (this.loopN() < 0 && Math.cos(this.theta) < 0) {
        this.onTrack = false;
        this.outcome = 'lostContact';
        this.leaveThetaDeg = (this.theta * 180) / Math.PI;
        this.fx = lp.r * Math.sin(this.theta);
        this.fy = lp.r - lp.r * Math.cos(this.theta);
        this.fvx = v * Math.cos(this.theta); // tangent for increasing θ
        this.fvy = v * Math.sin(this.theta);
        this.leave = { x: this.fx, y: this.fy, vx: this.fvx, vy: this.fvy, t: this.t };
        return;
      }

      if (this.theta >= FULL_LOOP) {
        this.outcome = 'fullLoop';
        return;
      }

      // Too slow to climb: the tangential speed reverses (or the ball never
      // left the bottom) — it rolls back and oscillates in the lower half.
      if (v < 0 || (this.t > 0 && v <= 0 && this.theta <= 0)) {
        this.outcome = 'rollsBack';
      }
      return;
    }

    // Free fall after losing contact: a projectile with the current velocity.
    const next = semiImplicitEuler(
      new Vec2(this.fx, this.fy),
      new Vec2(this.fvx, this.fvy),
      new Vec2(0, -g),
      dt,
    );
    this.fx = next.pos.x;
    this.fy = next.pos.y;
    this.fvx = next.vel.x;
    this.fvy = next.vel.y;
    if (this.fy <= 0) {
      this.fy = 0; // lands on the floor (loop base level)
    }
  }

  /** Push one 30 Hz sample of every active-mode graph series. */
  private pushSamples(): void {
    const mode = this.params.mode;
    if (mode === 'uniform') {
      const v = ucmSpeed(this.params.uniform.omega, this.params.uniform.r);
      this.vxSamples.push([this.t, v * Math.cos(this.phi)]);
      this.vySamples.push([this.t, -v * Math.sin(this.phi)]);
    } else if (mode === 'loop') {
      const v = this.onTrack
        ? this.w * this.params.loop.r
        : Math.hypot(this.fvx, this.fvy);
      this.vSamples.push([this.t, v]);
      this.nSamples.push([this.t, this.loopN()]);
    } else {
      const q = this.bankedQuantities();
      this.requiredSamples.push([this.t, q.required]);
      this.availableSamples.push([this.t, q.available]);
    }
  }

  /** Zero every piece of run state (used by start() and update()). */
  private resetState(): void {
    this.t = 0;
    this.phi = 0;
    this.theta = 0;
    this.w = this.params.loop.v0 / this.params.loop.r;
    this.onTrack = true;
    this.leave = null;
    this.outcome = 'climbing';
    this.leaveThetaDeg = 0;
    this.fx = 0;
    this.fy = 0;
    this.fvx = 0;
    this.fvy = 0;
    this.angle = 0;
    this.lastGraphAt = 0;
  }

  /** Empty all sample arrays. */
  private clearSamples(): void {
    this.vxSamples.length = 0;
    this.vySamples.length = 0;
    this.vSamples.length = 0;
    this.nSamples.length = 0;
    this.requiredSamples.length = 0;
    this.availableSamples.length = 0;
  }
}

/** Default parameters (exported for pages/tests convenience). */
export const DEFAULT_CIRCULAR_PARAMS: CircularParams = {
  mode: 'uniform',
  uniform: { r: 1.5, omega: 2, m: 2 },
  loop: { r: 1, v0: 8, m: 1 },
  banked: { r: 50, thetaBankDeg: 30, v: 16.8, m: 2 },
  g: G,
};
