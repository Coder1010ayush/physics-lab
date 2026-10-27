/**
 * Projectile simulation — 2D motion with optional quadratic air drag.
 *
 * Runs on the pure engine (semi-implicit Euler, fixed timestep) so every
 * trajectory is deterministic and repeatable in front of a class.
 * SI units, y-up, launch from the origin (0, 0).
 */

import { Vec2 } from '../engine/vec2.js';
import { semiImplicitEuler } from '../engine/integrator.js';
import { gravity, quadraticDrag } from '../engine/forces.js';

export type ProjectilePhase = 'aim' | 'flying' | 'landed';

export interface ProjectileParams {
  /** launch speed [m/s] */
  v0: number;
  /** launch angle [degrees] */
  angleDeg: number;
  /** quadratic drag coefficient [kg/m]; 0 = ideal motion (no air resistance) */
  k: number;
  /** gravitational acceleration [m/s²] */
  g: number;
}

export interface ProjectilePredictions {
  range: number;
  height: number;
  time: number;
}

/** Closed-form (no-drag) predictions — the textbook values to compare against. */
export function idealPredictions(p: ProjectileParams): ProjectilePredictions {
  const th = (p.angleDeg * Math.PI) / 180;
  const vy0 = p.v0 * Math.sin(th);
  return {
    range: (p.v0 * p.v0 * Math.sin(2 * th)) / p.g,
    height: (vy0 * vy0) / (2 * p.g),
    time: (2 * vy0) / p.g,
  };
}

export interface ProjectileState {
  phase: ProjectilePhase;
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Array<[number, number]>;
  range: number;
  maxHeight: number;
  flightTime: number;
}

export interface ProjectileSamples {
  height: Array<[number, number]>;
  vx: Array<[number, number]>;
  vy: Array<[number, number]>;
}

const TRAIL_HZ = 60;
const GRAPH_HZ = 30;
const MAX_TRAIL_POINTS = 6000;

export class ProjectileSim {
  private params: ProjectileParams;
  private phase: ProjectilePhase = 'aim';
  private t = 0;
  private pos = Vec2.zero();
  private vel = Vec2.zero();
  private trail: Array<[number, number]> = [];
  private range = 0;
  private maxHeight = 0;
  private flightTime = 0;
  private lastTrailAt = -1;
  private lastGraphAt = -1;
  readonly samples: ProjectileSamples = { height: [], vx: [], vy: [] };

  constructor(params: ProjectileParams) {
    this.params = { ...params };
  }

  getParams(): ProjectileParams {
    return { ...this.params };
  }

  /** Current phase without copying the full state (cheap, for animation loops). */
  getPhase(): ProjectilePhase {
    return this.phase;
  }

  getState(): ProjectileState {
    return {
      phase: this.phase,
      t: this.t,
      x: this.pos.x,
      y: this.pos.y,
      vx: this.vel.x,
      vy: this.vel.y,
      trail: this.trail.slice(),
      range: this.range,
      maxHeight: this.maxHeight,
      flightTime: this.flightTime,
    };
  }

  /** Change parameters — returns the sim to the aim state (re-armed). */
  update(params: ProjectileParams): void {
    this.params = { ...params };
    this.resetToAim();
  }

  resetToAim(): void {
    this.phase = 'aim';
    this.t = 0;
    this.pos = Vec2.zero();
    this.vel = Vec2.zero();
    this.trail = [];
    this.range = 0;
    this.maxHeight = 0;
    this.flightTime = 0;
    this.samples.height = [];
    this.samples.vx = [];
    this.samples.vy = [];
  }

  launch(): void {
    if (this.phase !== 'aim') return;
    const th = (this.params.angleDeg * Math.PI) / 180;
    this.pos = Vec2.zero();
    this.vel = new Vec2(
      this.params.v0 * Math.cos(th),
      this.params.v0 * Math.sin(th),
    );
    this.t = 0;
    this.phase = 'flying';
    this.maxHeight = 0;
    this.range = 0;
    this.flightTime = 0;
    this.trail = [[0, 0]];
    this.samples.height = [[0, 0]];
    this.samples.vx = [[0, this.vel.x]];
    this.samples.vy = [[0, this.vel.y]];
    this.lastTrailAt = 0;
    this.lastGraphAt = 0;
  }

  /** Advance the flight by one fixed timestep [s]. No-op unless flying. */
  step(dt: number): void {
    if (this.phase !== 'flying') return;

    // Projectile of mass m = 1 kg ⇒ acceleration = gravity + drag force.
    const acc = gravity(this.params.g).add(
      quadraticDrag(this.params.k, this.vel),
    );
    const prev = this.pos;
    const next = semiImplicitEuler(this.pos, this.vel, acc, dt);
    this.pos = next.pos;
    this.vel = next.vel;
    this.t += dt;
    if (this.pos.y > this.maxHeight) this.maxHeight = this.pos.y;

    // Landed? Interpolate the exact y = 0 crossing for an accurate range.
    if (this.pos.y <= 0 && this.vel.y < 0) {
      const f = prev.y / (prev.y - this.pos.y); // 0..1 between prev and pos
      const landX = prev.x + (this.pos.x - prev.x) * f;
      const landT = this.t - dt + dt * f;
      this.pos = new Vec2(landX, 0);
      this.phase = 'landed';
      this.range = landX;
      this.flightTime = landT;
      this.pushTrail(landX, 0);
      this.samples.height.push([landT, 0]);
      this.samples.vx.push([landT, this.vel.x]);
      this.samples.vy.push([landT, this.vel.y]);
      return;
    }

    if (this.t - this.lastTrailAt >= 1 / TRAIL_HZ) {
      this.lastTrailAt = this.t;
      this.pushTrail(this.pos.x, this.pos.y);
    }
    if (this.t - this.lastGraphAt >= 1 / GRAPH_HZ) {
      this.lastGraphAt = this.t;
      this.pushGraph(this.t, this.pos.y, this.vel.x, this.vel.y);
    }
  }

  private pushTrail(x: number, y: number): void {
    if (this.trail.length >= MAX_TRAIL_POINTS) return;
    this.trail.push([x, y]);
  }

  private pushGraph(
    t: number,
    y: number,
    vx: number,
    vy: number,
  ): void {
    this.samples.height.push([t, y]);
    this.samples.vx.push([t, vx]);
    this.samples.vy.push([t, vy]);
  }
}
