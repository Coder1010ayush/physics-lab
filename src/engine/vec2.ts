/**
 * Immutable 2D vector (SI units: metres, seconds, kilograms, newtons).
 *
 * Pure math — no React, no DOM, no imports. Every operation returns a new
 * Vec2; existing instances are never mutated.
 *
 * Coordinate convention: y is UP (standard physics convention).
 */

export class Vec2 {
  /** x component [m] (or the unit of whatever this vector represents). */
  readonly x: number;
  /** y component [m]. */
  readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /** The zero vector (0, 0). */
  static zero(): Vec2 {
    return new Vec2(0, 0);
  }

  /**
   * Unit-multiples of a direction vector.
   * @param rad angle in radians, measured counter-clockwise from +x axis
   * @param len length of the resulting vector [m] (default 1, i.e. unit vector)
   */
  static fromAngle(rad: number, len = 1): Vec2 {
    return new Vec2(len * Math.cos(rad), len * Math.sin(rad));
  }

  /** Vector sum: this + other. */
  add(other: Vec2): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  /** Vector difference: this − other. */
  sub(other: Vec2): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  /** Scalar multiplication: s · this. */
  mul(scalar: number): Vec2 {
    return new Vec2(this.x * scalar, this.y * scalar);
  }

  /** Scalar division: this / s. */
  div(scalar: number): Vec2 {
    return new Vec2(this.x / scalar, this.y / scalar);
  }

  /** Negation: −this. */
  neg(): Vec2 {
    return new Vec2(-this.x, -this.y);
  }

  /** Dot product: this · other [m²]. */
  dot(other: Vec2): number {
    return this.x * other.x + this.y * other.y;
  }

  /**
   * 2D cross product (z-component of the 3D cross product): this × other [m²].
   * Positive means `other` is counter-clockwise from `this` (within 180°).
   */
  cross(other: Vec2): number {
    return this.x * other.y - this.y * other.x;
  }

  /** Length |this| [m]. */
  len(): number {
    return Math.hypot(this.x, this.y);
  }

  /** Squared length |this|² [m²]. */
  lenSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  /** Unit vector in the same direction. Zero vector returns (0, 0). */
  norm(): Vec2 {
    const l = this.len();
    return l === 0 ? Vec2.zero() : new Vec2(this.x / l, this.y / l);
  }

  /** Rotate counter-clockwise by `rad` radians. */
  rot(rad: number): Vec2 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
  }

  /** Direction angle in radians (atan2(y, x)); (0,0) → 0. */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /** Distance |this − other| [m]. */
  dist(other: Vec2): number {
    return this.sub(other).len();
  }

  /** Component-wise approximate equality within `eps` (default 1e-9). */
  approxEquals(other: Vec2, eps = 1e-9): boolean {
    return Math.abs(this.x - other.x) <= eps && Math.abs(this.y - other.y) <= eps;
  }
}
