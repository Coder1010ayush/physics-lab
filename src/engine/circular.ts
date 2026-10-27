/**
 * Circular motion closed forms — SI units, y-up world.
 *
 * Pure math — no React, no DOM, no Math.random, no Date.now. Every formula
 * here is the closed-form reference the sims and pages compare against, so
 * it must match the textbook exactly.
 *
 * Three classroom situations:
 * - uniform circular motion: v = ωr, a_c = ω²r, F_c = mω²r, T = 2π/ω
 * - loop-the-loop: h = r(1 − cos θ), v² = v₀² − 2gh, N = m(v²/r + g·cos θ)
 * - frictionless banked curve: v_opt = √(r·g·tan θ), N = m·g/cos θ
 */

/**
 * Tangential speed on the circle [m/s]: v = ω·r.
 * @param omega angular speed [rad/s]
 * @param r circle radius [m]
 */
export function ucmSpeed(omega: number, r: number): number {
  return omega * r;
}

/**
 * Centripetal acceleration [m/s²]: a_c = ω²·r. Points radially inward,
 * perpendicular to the velocity, at every instant.
 * @param omega angular speed [rad/s]
 * @param r circle radius [m]
 */
export function centripetalAccel(omega: number, r: number): number {
  return omega * omega * r;
}

/**
 * Centripetal force [N]: F_c = m·ω²·r — the net inward force the situation
 * must supply (tension, friction, gravity or a normal reaction).
 * @param m mass [kg]
 * @param omega angular speed [rad/s]
 * @param r circle radius [m]
 */
export function centripetalForce(m: number, omega: number, r: number): number {
  return m * centripetalAccel(omega, r);
}

/**
 * Period of one full revolution [s]: T = 2π/ω.
 * @param omega angular speed [rad/s], must be positive
 */
export function period(omega: number): number {
  if (omega <= 0) {
    throw new Error(`omega must be positive, got ${omega}`);
  }
  return (2 * Math.PI) / omega;
}

/**
 * Height above the loop bottom [m] at track angle θ (θ = 0 at the bottom,
 * θ = π at the top): h = r(1 − cos θ).
 * @param theta track angle [rad]
 * @param r loop radius [m]
 */
export function loopHeight(theta: number, r: number): number {
  return r * (1 - Math.cos(theta));
}

/**
 * Speed squared [m²/s²] at loop angle θ, from energy conservation between the
 * bottom (speed v₀) and height h(θ): v² = v₀² − 2g·h(θ).
 * At the top (θ = π) this is v₀² − 4g·r.
 * @param v0 launch speed at the loop bottom [m/s]
 * @param theta track angle [rad]
 * @param r loop radius [m]
 * @param g gravitational acceleration [m/s²]
 */
export function loopSpeedSquared(
  v0: number,
  theta: number,
  r: number,
  g: number,
): number {
  return v0 * v0 - 2 * g * loopHeight(theta, r);
}

/**
 * Track normal force [N] on a ball riding the INSIDE of a vertical loop:
 *   N = m(v²/r + g·cos θ)
 * θ measured from the loop bottom. Bottom (θ = 0): N = m(v²/r + g);
 * top (θ = π): N = m(v²/r − g). N < 0 would mean the track has to pull the
 * ball inward — the ball leaves the track instead.
 * @param m ball mass [kg]
 * @param v2 speed squared [m²/s²]
 * @param theta track angle [rad]
 * @param r loop radius [m]
 * @param g gravitational acceleration [m/s²]
 */
export function loopNormalForce(
  m: number,
  v2: number,
  theta: number,
  r: number,
  g: number,
): number {
  if (r <= 0) {
    throw new Error(`loop radius must be positive, got ${r}`);
  }
  return m * (v2 / r + g * Math.cos(theta));
}

/**
 * Minimum speed at the loop top [m/s] that still keeps contact:
 * N_top ≥ 0 needs v² ≥ g·r, so v_top,min = √(g·r).
 * @param r loop radius [m]
 * @param g gravitational acceleration [m/s²]
 */
export function minTopSpeed(r: number, g: number): number {
  return Math.sqrt(g * r);
}

/**
 * Minimum launch speed at the loop bottom [m/s] to complete the loop:
 * v₀² = v_top² + 4g·r ≥ g·r + 4g·r, so v₀,min = √(5g·r).
 * @param r loop radius [m]
 * @param g gravitational acceleration [m/s²]
 */
export function minLaunchSpeed(r: number, g: number): number {
  return Math.sqrt(5 * g * r);
}

/**
 * Optimum (frictionless) banked-curve speed [m/s]: v_opt = √(r·g·tan θ).
 * At this speed the horizontal component of the normal force supplies the
 * centripetal requirement exactly — no friction needed.
 * @param r turn radius [m]
 * @param g gravitational acceleration [m/s²]
 * @param thetaRad bank angle [rad]
 */
export function bankedOptimumSpeed(r: number, g: number, thetaRad: number): number {
  if (r <= 0) {
    throw new Error(`turn radius must be positive, got ${r}`);
  }
  return Math.sqrt(r * g * Math.tan(thetaRad));
}

/**
 * Normal force on a frictionless banked curve [N]: N = m·g/cos θ
 * (no vertical acceleration, so N·cos θ = m·g).
 * @param m car mass [kg]
 * @param g gravitational acceleration [m/s²]
 * @param thetaRad bank angle [rad], must be below 90°
 */
export function bankedNormal(m: number, g: number, thetaRad: number): number {
  const c = Math.cos(thetaRad);
  // cos(π/2) is ~6e-17 in floating point, so test against a small epsilon:
  // a bank at (or past) 90° cannot supply a normal force at all.
  if (c <= 1e-12) {
    throw new Error(`bank angle must be below 90°, cos θ = ${c}`);
  }
  return (m * g) / c;
}

/**
 * Centripetal force a frictionless bank can supply [N]: the horizontal
 * component of the normal force, m·g·tan θ.
 * @param m car mass [kg]
 * @param g gravitational acceleration [m/s²]
 * @param thetaRad bank angle [rad]
 */
export function bankedAvailableForce(m: number, g: number, thetaRad: number): number {
  return m * g * Math.tan(thetaRad);
}
