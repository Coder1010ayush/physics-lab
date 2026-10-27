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
