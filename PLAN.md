# Physics Lab — Complete Idea & Plan (v1.0)

**Prepared:** 2026-10-27 · **Status:** Phase 0 (foundation) in progress

## 1. The Idea

A web-based physics laboratory for 12th-grade students where every mechanics
concept from the syllabus is a live, interactive simulation.

**Two use cases:**
1. **Classroom mode** — the teacher presents and simulates live in front of students.
2. **Self-study & fun** — students open the site themselves and learn by playing.

**Non-negotiable #1:** the site must look awesome — students should *want* to use it.
Chosen direction: **clean, light, modern** (projector-friendly), with physics that
feels alive — smooth animations, live graphs, a real-time formula bar.

## 2. Locked Decisions

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| 1 | Physics engine | **Custom, built from scratch** | Formula-accurate and transparent; every number on screen traceable to the textbook. Matter.js rejected (game-collision black box that fights SHM/circular motion/Bernoulli). |
| 2 | Tech stack | **React + Vite + TypeScript** | Component reuse across 10+ sims, best path to a polished UI. |
| 3 | Visual design | **Clean light modern** | Readable on any classroom projector; bright, friendly, professional. |
| 4 | MVP scope | **Force & pulley · Friction · Kinematics (1D + projectile)** | Teacher's own priority order for classroom use. |

## 3. Full Topic Roadmap

- **Phase 1 (MVP):** kinematics (1D + projectile), friction, force & pulley.
- **Phase 2:** 2D motion / vector playground, circular motion, torque, rotational
  motion, work-energy-power, momentum & collisions, oscillations (pendulum + spring).
- **Phase 3:** fluids (buoyancy, Bernoulli, continuity — no full SPH), gamified
  challenge mode, sound, deployment & polish.

Full requested topic list: 2D motion · projectile motion · force · friction ·
circular motion · torque · work-energy-power · momentum · rotational motion ·
oscillation · fluids.

## 4. MVP Sims — Detailed Spec

### 4.1 Kinematics (two modes)

**1D motion mode**
- Runner/car on a track; sliders for initial velocity u and acceleration a.
- Live readouts: position x, velocity v, acceleration a.
- Real-time graphs: x–t and v–t drawn as the sim runs.
- Live equation bar with real numbers: v = u + at · s = ut + ½at² · v² = u² + 2as.

**Projectile mode**
- Aim by dragging, plus sliders for v₀ and launch angle.
- Trajectory trace; velocity vector with vx/vy components drawn on the projectile.
- Live readouts: range, max height, time of flight.
- Air-drag toggle to compare ideal vs real trajectory.
- Graphs: height vs t, velocity components vs t.
- Fun presets: Moon gravity (g = 1.62 m/s²); hit-the-target challenge in Phase 3.

### 4.2 Friction (two modes)

**Horizontal mode**
- Block pushed by adjustable applied force F.
- Static friction: block sticks until F > μs·N, then slides with kinetic friction μk.
- Live staircase graph of applied force vs friction force (the exam classic).
- Force arrows visible on the block: F, f, N, W.

**Incline mode**
- Tilt-angle slider; weight components (mg·sinθ, mg·cosθ) drawn.
- Angle of repose: block starts sliding spontaneously when tanθ > μs.
- Live acceleration a = g(sinθ − μk·cosθ).

### 4.3 Force & Pulley System (two modes)

**Atwood machine**
- Two masses m₁, m₂ over a frictionless, massless pulley; sliders for both.
- Live free-body diagrams on each mass.
- Readouts: a = (m₁ − m₂)g/(m₁ + m₂) · tension T = 2m₁m₂g/(m₁ + m₂).

**Table-edge variant**
- Block on a table with adjustable friction + hanging mass over a pulley.
- Combines pulley + friction — the classic 12th-grade exam archetype.

## 5. Architecture

```
physics-lab/
  src/
    engine/        pure TypeScript physics — no React, no canvas, just math
      vec2.ts        2D vector algebra
      integrator.ts  fixed-timestep semi-implicit Euler (deterministic, repeatable)
      forces.ts      gravity, normal, static/kinetic friction, drag, rope tension
      __tests__/     unit tests verified against textbook closed-form solutions
    sims/          per-topic state and step(): kinematics/, projectile/, friction/, pulley/
    render/        canvas layer: grid, arrows, trails, free-body diagrams
    ui/            reusable: Slider, FormulaBar, GraphPanel, ReadoutGroup, SimShell
    theme/         design tokens (colors, spacing, fonts)
    pages/         Home (topic gallery) + one page per sim
```

**Why the separation:** the engine never imports React, so it can be unit-tested
against closed-form physics. Every number shown in class is traceable to a
textbook formula.

## 6. Design System

- Off-white background, soft-shadow rounded cards, generous spacing.
- Typography: Inter for UI + a math-friendly display font for formulas.
- Accent: sky-blue → violet gradient; high contrast so it stays readable on classroom projectors.
- Home page: topic gallery with animated preview cards.
- One consistent sim layout everywhere: canvas stage (left) · controls (right) · graphs & formula bar (bottom) — muscle memory across all sims.
- Fun comes from physics being alive — slow-mo, time scrubbing, live formula bar, satisfying traces — not cartoon clutter.

## 7. Verification Plan

- **Vitest unit tests** comparing the engine to closed-form physics:
  projectile range v₀²·sin2θ/g; kinematics s = ut + ½at²; Atwood a and T;
  incline slide threshold tanθ = μs; friction staircase behaviour.
- `tsc + vite build` must pass clean.
- Every sim verified in a real browser: screenshots, slider interactions, play/pause/reset, clean console.

## 8. Prerequisites & Deployment

- Node.js 18+ and npm (machine has Node v22.22.1, npm 9.2.0 ✓).
- Static site — no backend, no logins. Free hosting: GitHub Pages or Netlify.
- Also runs fully offline from the laptop for classroom reliability.

## 9. Out of Scope (v1)

- Student accounts and progress tracking.
- Backend server or database.
- Full computational fluid dynamics (fluids = buoyancy, Bernoulli, continuity only).
- Mobile app.

## 10. Build Phases & Next Steps

See `.kiwi/Tasks.py` for the task tree with IDs. Summary:
1. **Phase 0 — foundation:** scaffold ✓, docs ✓, design tokens, UI kit, engine core + analytic tests.
2. **Phase 1 — MVP sims:** kinematics → projectile → friction → pulley, each verified in the browser before the next.
3. **Phase 2 — remaining topics** (teacher review after Phase 1).
4. **Phase 3 — fluids, challenge mode, deployment.**
