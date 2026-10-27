/**
 * Topic detail content — the classroom text shown at /topic/:topicId.
 *
 * The formula strings are the exact textbook forms, written with unicode math
 * glyphs (v₀, ², ½, θ, ω, μ, ·). Do not re-typeset them: teachers read these
 * aloud in class and every glyph is deliberate.
 */

export interface TopicFormula {
  name: string;
  formula: string;
}

export interface TopicContent {
  id: string;
  title: string;
  tagline: string;
  definition: string;
  concepts: string[];
  formulas: TopicFormula[];
  /** One or two short paragraphs, separated by a blank line ('\n\n'). */
  explanation: string;
  /** Route of the topic's live simulation page, when one is built. */
  simPath?: string;
}

/** Route ids in library order — keep in sync with the keys of TOPIC_CONTENT. */
export const TOPIC_IDS: string[] = [
  'kinematics',
  'friction',
  'pulley',
  'vectors-2d',
  'circular',
  'torque',
  'rotational',
  'work-energy',
  'momentum',
  'oscillations',
  'fluids',
];

export const TOPIC_CONTENT: Record<string, TopicContent> = {
  /* ── kinematics ────────────────────────────────────────────────────── */
  kinematics: {
    id: 'kinematics',
    title: 'Kinematics',
    tagline: 'Describing motion with equations — position, velocity and acceleration.',
    definition:
      'Kinematics describes motion in terms of position, velocity and acceleration, without asking what forces cause it. When the acceleration is uniform, three equations of motion connect the five quantities u, v, a, s and t. The same equations, applied separately to the horizontal and vertical directions, describe projectile motion.',
    concepts: [
      'Displacement is the change in position — a vector quantity, unlike the scalar distance travelled.',
      'Velocity is the rate of change of displacement; acceleration is the rate of change of velocity.',
      'The three equations of motion hold only while the acceleration is uniform.',
      'In projectile motion the horizontal velocity is constant while the vertical velocity changes at g = 9.8 m/s².',
      'At the highest point of the flight the vertical velocity is zero, but the horizontal velocity is unchanged.',
    ],
    formulas: [
      { name: 'Velocity–time relation', formula: 'v = u + at' },
      { name: 'Position–time relation', formula: 's = ut + ½at²' },
      { name: 'Velocity–position relation', formula: 'v² = u² + 2as' },
    ],
    explanation:
      'The three equations of motion can be read straight off a velocity–time graph: the slope gives the acceleration, and the area under the graph gives the displacement. Each equation simply leaves out one of the five quantities, so in a problem you pick the one that connects what you know to what you want.\n\nProjectile motion is two independent 1D motions running side by side. Horizontally there is no acceleration, so the ball covers equal distances in equal times; vertically it is free fall under gravity. Adding the two components back together at every instant traces the parabola you can watch in the simulation.',
    simPath: '/sim/kinematics',
  },

  /* ── friction ───────────────────────────────────────────────────────── */
  friction: {
    id: 'friction',
    title: 'Friction',
    tagline: 'The contact force that resists sliding — static, kinetic and the angle of repose.',
    definition:
      'Friction is the tangential force between two surfaces that opposes relative sliding, or the tendency to slide. Static friction adjusts itself to match the applied force up to a maximum value, after which sliding begins and kinetic friction takes over. Both are proportional to the normal reaction between the surfaces.',
    concepts: [
      'Static friction is self-adjusting: it grows with the applied force only until the maximum f_s,max = μ_s·N is reached.',
      'Once sliding starts, kinetic friction f_k = μ_k·N acts with a roughly constant magnitude, and μ_k is usually smaller than μ_s.',
      'The coefficient of friction depends on the nature of the surfaces in contact, not on the area of contact.',
      'On a rough inclined plane, the angle of repose is the steepest angle at which the block just stays at rest.',
      'Friction is essential, not a nuisance — walking, gripping and rolling all rely on it.',
    ],
    formulas: [
      { name: 'Maximum static friction', formula: 'f_s,max = μ_s·N' },
      { name: 'Kinetic friction', formula: 'f_k = μ_k·N' },
      { name: 'Angle of repose', formula: 'tan θ = μ_s' },
      { name: 'Acceleration down a rough incline', formula: 'a = g(sin θ − μ_k cos θ)' },
    ],
    explanation:
      'The angle of repose follows from the balance of forces along an incline at the moment slipping just begins: the component of weight down the slope equals maximum static friction, which cancels to tan θ = μ_s. Tilt the plane a hair further and the block slides.\n\nOnce sliding, the component of weight along the plane outmuscles kinetic friction, and the leftover force per unit mass gives the acceleration formula above. Try it in numbers: with a coefficient of kinetic friction of 0.25 on a 30° incline, the acceleration is about 2.8 m/s².',
    simPath: '/sim/friction',
  },

  /* ── pulley ─────────────────────────────────────────────────────────── */
  pulley: {
    id: 'pulley',
    title: 'Force & Pulley',
    tagline: 'One string, two masses, a single shared acceleration.',
    definition:
      'A pulley system joins two masses with a light, inextensible string, so the string carries a single tension and both masses move with the same magnitude of acceleration. In the ideal Atwood machine the pulley is massless and frictionless, with a mass hanging on each side. Newton’s second law, applied to each mass separately and solved together, gives both the acceleration and the tension.',
    concepts: [
      'A light, inextensible string carries the same tension throughout, and both masses share one magnitude of speed and acceleration.',
      'An ideal pulley is frictionless and massless — it only redirects the tension.',
      'Draw one free-body diagram per mass; the connecting equations do the rest.',
      'The heavier mass accelerates downward and the lighter one upward with the same magnitude of acceleration.',
      'Sanity checks matter: equal masses give zero acceleration and a tension equal to the weight of each mass.',
    ],
    formulas: [
      { name: 'Acceleration of the system', formula: 'a = (m₁ − m₂)g / (m₁ + m₂)' },
      { name: 'Tension in the string', formula: 'T = 2m₁m₂g / (m₁ + m₂)' },
    ],
    explanation:
      'Take downward as positive for the heavier mass and upward for the lighter one, and write F = ma for each. Adding the two equations removes the tension and gives the acceleration; substituting back gives the tension — the two-body version of Newton’s second law.\n\nThe formulas reward quick checks: equal masses mean nothing accelerates and each string holds a full weight; if one mass dwarfs the other, the acceleration approaches g and the tension nearly vanishes — free fall.',
    simPath: '/sim/pulley',
  },

  /* ── vectors-2d ────────────────────────────────────────────────────── */
  'vectors-2d': {
    id: 'vectors-2d',
    title: '2D Motion & Vectors',
    tagline: 'Resolve into components, then let each axis work alone.',
    definition:
      'A vector carries both a magnitude and a direction; a scalar carries only a magnitude. Any vector making an angle θ with a reference axis can be resolved into two perpendicular components, and those components add to rebuild the whole. Projectile motion is the standard example: the horizontal and vertical motions are independent, and the position at every instant is their vector sum.',
    concepts: [
      'Vectors add by the triangle or parallelogram rule; the resultant follows from the perpendicular components.',
      'Resolution and addition are inverse operations — the two components of a vector do not affect each other.',
      'In projectile motion the horizontal acceleration is zero while the vertical acceleration is −g, so the axes are solved separately.',
      'The trajectory of a projectile is a parabola.',
      'The range is maximum at θ = 45°, and complementary angles θ and 90° − θ give the same range.',
    ],
    formulas: [
      { name: 'Horizontal component', formula: 'v_x = v cos θ' },
      { name: 'Vertical component', formula: 'v_y = v sin θ' },
      { name: 'Range', formula: 'R = v₀² sin 2θ / g' },
      { name: 'Maximum height', formula: 'H = v₀² sin²θ / 2g' },
      { name: 'Time of flight', formula: 'T = 2v₀ sin θ / g' },
    ],
    explanation:
      'Every 2D problem starts the same way: choose axes, then split each vector into components. After that, the x-direction and the y-direction are two ordinary 1D problems that never talk to each other — the only thing they share is the time.\n\nFor a projectile launched at angle θ, the vertical motion decides how long the ball stays in the air, the horizontal motion runs at constant speed for exactly that time to fix the range, and the vertical velocity vanishing at the top fixes the maximum height. Launching straight up gives zero range and the greatest height — a quick check worth trying live in the simulation.',
    simPath: '/sim/projectile',
  },

  /* ── circular ───────────────────────────────────────────────────────── */
  circular: {
    id: 'circular',
    title: 'Circular Motion',
    tagline: 'Constant speed, ever-changing direction — with a force pulling inward.',
    definition:
      'In uniform circular motion a particle moves around a circle at constant speed. Because the direction of the velocity keeps changing, the motion is accelerated: the centripetal acceleration points radially inward at every instant. A real net force — tension, friction, gravity or a normal reaction — must supply that acceleration.',
    concepts: [
      'Uniform circular motion has constant speed but changing velocity, so it is accelerated motion.',
      'Centripetal acceleration is directed toward the centre, perpendicular to the velocity.',
      'Centripetal force is not a new kind of force — it is the name for whatever net inward force the situation provides.',
      'Angular speed ω ties linear speed to radius through v = ωr.',
      'Remove the inward force and the body flies off along the tangent, not along the radius.',
    ],
    formulas: [
      { name: 'Speed on the circle', formula: 'v = ωr' },
      { name: 'Centripetal acceleration', formula: 'a_c = v²/r = ω²r' },
      { name: 'Centripetal force', formula: 'F_c = mv²/r' },
    ],
    explanation:
      'Why inward? Velocity is a vector, so even at constant speed, turning the arrow changes it. The change between two nearby instants points toward the centre — and that is exactly where the acceleration, and hence the net force, must point.\n\nOn real tracks the supplier changes: friction between tyre and road turns a car, gravity turns a satellite, tension turns a stone on a string. The same three formulas cover every case — only the name of the inward force changes.',
  },

  /* ── torque ─────────────────────────────────────────────────────────── */
  torque: {
    id: 'torque',
    title: 'Torque',
    tagline: 'The turning effect of a force — where you push matters as much as how hard.',
    definition:
      'Torque is the rotational analogue of force: the tendency of a force to rotate a body about an axis. Its magnitude grows with the applied force, with the distance of its point of application from the axis, and with the sine of the angle between the force and that distance. The net torque on a rigid body determines its angular acceleration.',
    concepts: [
      'Only the component of the force perpendicular to the position vector produces torque.',
      'Torque is largest when the force acts at right angles to the lever arm.',
      'A couple — two equal, opposite forces with different lines of action — produces pure rotation with zero net force.',
      'Rotational equilibrium requires the net torque about any axis to be zero.',
      'In planar problems the sign of a torque is set by its sense: anticlockwise positive, clockwise negative.',
    ],
    formulas: [
      { name: 'Torque of a force', formula: 'τ = rF sin θ' },
      { name: 'Rotational second law', formula: 'τ_net = Iα' },
      { name: 'Rotational equilibrium', formula: 'Στ = 0' },
    ],
    explanation:
      'Why does a door handle live far from the hinge? Pushing at a larger distance with the same force gives a larger torque. Push along a line through the hinge and nothing turns at all — the perpendicular component is zero.\n\nEquilibrium problems — a loaded beam on two supports, a see-saw with two children — are solved by taking moments about a well-chosen axis. Because the net torque must vanish about every point, pick the point through which an unknown force passes and that unknown drops out of the equation.',
  },

  /* ── rotational ────────────────────────────────────────────────────── */
  rotational: {
    id: 'rotational',
    title: 'Rotational Motion',
    tagline: 'Spinning bodies have their own energy, momentum and laws.',
    definition:
      'Rotational dynamics parallels linear dynamics about a fixed axis. Moment of inertia I plays the role of mass, angular velocity ω the role of velocity, and net torque the role of net force. A rolling body adds the translation of its centre of mass to rotation about that centre.',
    concepts: [
      'Moment of inertia depends on how the mass is distributed — moving mass away from the axis increases it.',
      'A rolling body carries both translational kinetic energy and rotational kinetic energy.',
      'Angular momentum stays constant when no net external torque acts — a skater pulling in her arms spins faster.',
      'Torque is the rate of change of angular momentum.',
      'In pure rolling the contact point is momentarily at rest, which ties the centre’s speed to the spin rate.',
    ],
    formulas: [
      { name: 'Rotational kinetic energy', formula: 'KE_rot = ½Iω²' },
      { name: 'Angular momentum', formula: 'L = Iω' },
      { name: 'Torque on a spinning body', formula: 'τ = dL/dt' },
      { name: 'Rolling without slipping', formula: 'v_cm = ωR' },
    ],
    explanation:
      'Every linear formula has a rotational twin: mass becomes moment of inertia, velocity becomes angular velocity, momentum becomes angular momentum, force becomes torque. Conservation of angular momentum explains the spinning skater, and the energy split between translation and rotation explains why different shapes roll down the same incline at different speeds.\n\nRolling without slipping ties the two motions together with one condition — the centre moves exactly as fast as the rim spins. That link lets you treat a rolling problem as a pure rotation about the point of contact.',
  },

  /* ── work-energy ───────────────────────────────────────────────────── */
  'work-energy': {
    id: 'work-energy',
    title: 'Work & Energy',
    tagline: 'Force acting over a distance — and the theorem that balances the books.',
    definition:
      'Work is done when a force acts through a displacement, and only the component of the force along the displacement contributes. Kinetic energy is the energy a body owns because it is moving. The work–energy theorem states that the net work done on a body equals the change in its kinetic energy.',
    concepts: [
      'Work is zero when the force is perpendicular to the displacement — uniform circular motion does no net work.',
      'Only the net work changes kinetic energy; positive and negative contributions from individual forces can cancel.',
      'When only conservative forces act, the total mechanical energy, kinetic plus potential, stays constant.',
      'Power is the rate of doing work — the instantaneous power delivered by a force is P = F·v.',
      'Friction does negative work and converts mechanical energy into heat; the books still balance.',
    ],
    formulas: [
      { name: 'Work by a constant force', formula: 'W = Fs cos θ' },
      { name: 'Kinetic energy', formula: 'KE = ½mv²' },
      { name: 'Work–energy theorem', formula: 'W_net = ΔKE' },
      { name: 'Instantaneous power', formula: 'P = F·v' },
    ],
    explanation:
      'The work–energy theorem is Newton’s second law integrated over distance: the net work equals half the mass times the change in the squared speed. It converts a force problem into an energy bookkeeping problem, often with far less algebra.\n\nOn a frictionless track, gravity trades potential energy for kinetic energy and back, keeping the sum fixed. Add friction and the same ledger shows where the energy went: the missing amount is the work done against friction, released as heat.',
  },

  /* ── momentum ──────────────────────────────────────────────────────── */
  momentum: {
    id: 'momentum',
    title: 'Momentum & Collisions',
    tagline: 'What every collision conserves — before and after.',
    definition:
      'Linear momentum is the quantity of motion carried by a body; it is the product of mass and velocity and is a vector. Newton’s second law identifies the net force as the rate of change of momentum. When no net external force acts on a system, its total momentum stays constant — which is why every collision, elastic or not, conserves momentum.',
    concepts: [
      'Momentum is a vector: direction matters, and opposite momenta cancel.',
      'A brief, large force — an impulse — changes momentum by the product of force and time.',
      'Momentum is conserved in all collisions; kinetic energy is conserved only in elastic ones.',
      'A perfectly inelastic collision ends with the colliding bodies moving together.',
      'Momentum conservation is applied one axis at a time.',
    ],
    formulas: [
      { name: 'Linear momentum', formula: 'p = mv' },
      { name: 'Force as rate of change of momentum', formula: 'F = Δp/Δt' },
      { name: 'Conservation of momentum', formula: 'm₁u₁ + m₂u₂ = m₁v₁ + m₂v₂' },
    ],
    explanation:
      'In a collision, the internal forces between the bodies come in equal and opposite pairs, so whatever momentum one body loses the other gains — the total never moves. Write the conservation equation for the whole system, before versus after, and solve for the unknowns.\n\nThe check that separates the two collision types is kinetic energy: elastic collisions keep it, inelastic ones lose some to heat and deformation. Momentum is conserved either way — work the numbers for any collision and both halves of the story hold.',
  },

  /* ── oscillations ──────────────────────────────────────────────────── */
  oscillations: {
    id: 'oscillations',
    title: 'Oscillations',
    tagline: 'Restoring force, repeating motion — the pendulum and the spring.',
    definition:
      'Simple harmonic motion is oscillation about a fixed mean position under a restoring force that is proportional to the displacement and directed opposite to it. The displacement then varies sinusoidally with time. A small-amplitude pendulum and an ideal spring–mass system are the two standard examples.',
    concepts: [
      'The restoring force always points toward the mean position and grows with displacement (F = −kx).',
      'Amplitude is the maximum displacement; period is the time of one full cycle.',
      'Angular frequency ω = 2π/T links simple harmonic motion to uniform circular motion.',
      'Speed is maximum at the mean position and zero at the turning points, where the energy is all potential.',
      'The pendulum period does not depend on the bob’s mass; the spring period does not depend on g or on amplitude.',
    ],
    formulas: [
      { name: 'Displacement in SHM', formula: 'x = A sin(ωt + φ)' },
      { name: 'Period of a simple pendulum', formula: 'T = 2π√(l/g)' },
      { name: 'Period of a spring–mass system', formula: 'T = 2π√(m/k)' },
      { name: 'Maximum speed', formula: 'v_max = Aω' },
    ],
    explanation:
      'Energy shuttles back and forth in simple harmonic motion: all kinetic at the mean position, all potential at the extremes. Because the restoring force grows in exact proportion to the displacement, the period is independent of amplitude — a stronger pull on a bigger swing is exactly paid for by the longer journey.\n\nNotice what each period ignores: the pendulum does not care about the bob’s mass, and the spring does not care about gravity. These independence checks are favourite exam questions — and quick sanity tests for any lab data.',
  },

  /* ── fluids ────────────────────────────────────────────────────────── */
  fluids: {
    id: 'fluids',
    title: 'Fluids',
    tagline: 'Pressure at rest, buoyancy afloat, and the two rules of flow.',
    definition:
      'A fluid at rest presses on every surface in contact with it, and the pressure grows linearly with depth. Archimedes’ principle gives the upward buoyant force on an immersed body as the weight of the fluid it displaces. For steady, streamline flow, Bernoulli’s theorem expresses energy conservation along a streamline while the continuity equation expresses conservation of mass.',
    concepts: [
      'Pressure at a point inside a fluid is the same in every direction.',
      'Gauge pressure at depth h is ρgh; absolute pressure adds the atmosphere above.',
      'A floating body displaces exactly its own weight of fluid; a fully submerged one displaces its own volume.',
      'Continuity means the fluid speeds up wherever the pipe narrows.',
      'Along a streamline, faster flow means lower pressure — Bernoulli’s theorem at a glance.',
    ],
    formulas: [
      { name: 'Hydrostatic pressure', formula: 'P = ρgh' },
      { name: 'Archimedes’ principle', formula: 'F_b = ρVg' },
      { name: 'Bernoulli’s equation', formula: 'P + ½ρv² + ρgh = constant' },
      { name: 'Equation of continuity', formula: 'A₁v₁ = A₂v₂' },
    ],
    explanation:
      'The two flow rules work as a pair. Continuity first: squeeze the same fluid through a smaller area and it must move faster. Then Bernoulli: that extra speed is paid for by pressure, so the narrow section also carries the lowest pressure — the physics behind aerofoil lift and the atomiser.\n\nAt rest, the same idea shows up as buoyancy: pressure on the bottom of an immersed body exceeds pressure on its top, and summing that difference over the surface gives exactly the weight of the displaced fluid.',
  },
};
