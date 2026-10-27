# physics-lab — Decision Log

Project: interactive 2D physics simulation website for 12th-grade students.
Started: 2026-10-27. Location: /home/zang/Documents/physics-lab.

## D1 — Physics engine: custom, built from scratch
- **Options considered:** (a) custom engine, (b) existing library (Matter.js / Planck.js), (c) hybrid.
- **User's choice:** custom (recommended option accepted).
- **Reasoning:** the topic list (projectile, SHM, circular motion, Bernoulli) is
  formula/integration-driven, not collision-driven. A custom engine keeps every
  number traceable to textbook formulas — a pedagogical feature, not just plumbing.
  Game-collision libraries are black boxes that actively fight formula-accurate
  curriculum physics. Engine must be pure TypeScript with unit tests against
  closed-form solutions.

## D2 — Tech stack: React + Vite + TypeScript
- **Options considered:** React+Vite+TS, vanilla JS+Canvas, p5.js.
- **User's choice:** React + Vite + TypeScript (recommended option accepted).
- **Reasoning:** 10+ simulations share the same UI kit (sliders, graphs, formula
  bar, sim shell); component reuse is the difference between weeks and months.

## D3 — Visual design: clean light modern
- **Options considered:** dark neon lab, clean light modern, playful colorful.
- **User's choice:** clean light modern (overrode the dark-neon recommendation).
- **Reasoning:** the site is primarily presented on classroom projectors; light
  themes stay readable on cheap projectors. Fun comes from physics being alive
  (live graphs, slow-mo, real-time formula bar), not cartoon styling.

## D4 — MVP scope: force & pulley · friction · kinematics (1D + projectile)
- **User's choice (own words):** "First three i want to must have is force pully
  system, friction, kinematics (including simple motion and projectile)".
- **Reasoning:** matches the teacher's classroom sequence. Original suggestion
  (projectile + friction + circular) was dropped in favour of the teacher's order.
  Pulley sim includes the Atwood machine and a table-edge variant combining
  pulley + friction.

## D5 — Standing assumptions (not objected to; revisit if needed)
- Static site, no backend, no student accounts in v1.
- Free hosting (GitHub Pages or Netlify) + runs offline from the laptop.
- English UI with standard physics symbols (g, μ, θ, ω).
- Fluids scoped to buoyancy, Bernoulli, continuity — no SPH.

## D6 — Project location
- /home/zang/Documents/physics-lab (user: "setup the project in my Documents folder").

## Subtask: Projectile simulation (2D motion) — P1-2, moved first per user request

### Subtask relevance
First real simulation, reordered by the user ahead of 1D kinematics. Demonstrates 2D motion: velocity components, trajectory, ideal vs air-drag comparison (user explicitly wants drag with a zero option). Establishes the reusable sim pattern (engine-driven module + fixed-timestep loop + page) that all later sims copy. Depends on engine core (P0-5/P0-6).

### Implementation
Implemented in src/sims/projectile.ts (ProjectileSim: aim→flying→landed lifecycle, engine-driven quadratic drag, exact y=0 landing interpolation) + src/pages/ProjectilePage.tsx (stage SVG with ideal ghost path, vx/vy component vectors, Moon gravity, auto-zoom; sliders v₀/θ/k; two readout groups; two graphs; formula bar) + route /sim/projectile; home cards now link to topic pages, vectors-2d marked live.

### Validation
47/47 Vitest (10 new: ideal range/height/flight-time vs closed form ±0.5–1%, drag shortens range and height, k=0 exact, Moon g=1.62, determinism, lifecycle). Build passes, lint 0/0. Headless Chrome screenshot + OCR verified the aim state renders (ground ticks 5–40 m consistent with the 40.8 m ideal range at 20 m/s, 45°).

### Status
Validated

## Subtask: Topic detail pages — P1-0

### Subtask relevance
User request: clicking ANY library card must open a detail page (definition, concepts, formulas, explanation) with a CTA button to that topic's simulation (playground fallback for unbuilt topics). Turns the library into a teaching resource, not just a status board. Delegated to a subagent with exact formula lists supplied by the parent to guarantee physics accuracy.

### Implementation
In progress (subagent owns src/content/topics.ts + src/pages/TopicDetailPage.tsx + css).

### Validation
Parent reviews content physics + code after subagent report; wired into routes by parent; browser verification of card → detail → sim flow.
