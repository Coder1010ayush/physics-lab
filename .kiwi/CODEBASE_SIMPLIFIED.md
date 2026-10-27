# CODEBASE SIMPLIFIED — physics-lab

**Read PLAN.md first** for the full vision, decisions and roadmap. README.md
is the public-facing version of this file.

## Purpose
Interactive 2D physics simulation website for 12th-grade students: live,
classroom-presentable sims for mechanics (kinematics, forces, friction,
pulleys, circular/rotational motion, energy, momentum, oscillations, fluids).

**Current state:** Phase 1 complete — 4 sims live (projectile, kinematics, friction,
pulley), 11 topic notes pages, deployed at https://physics-lab-topaz.vercel.app.
Phase 2 next (conceptual chain: circular → torque → rotational → work-energy →
momentum → oscillations).

## Stack (and why)
- **React 19 + Vite 8 + TypeScript 6** — 10+ sims share one UI kit; TS keeps
  the physics math honest; Vite gives instant dev loop + static build.
- **oxlint** for linting — 0-warning policy.
- **Vitest** — 73 physics tests in 8 files (engine closed-form tests + sim
  behaviour tests).
- **Vercel** — auto-deploys every push to `master`.
- Fonts via Fontsource (self-hosted, offline-safe): Archivo (interface),
  STIX Two Text (definitions/formulas), **JetBrains Mono** (instrument font:
  readout values, slider values, playbar time, formula-bar numbers, stage
  ticks — swapped in for IBM Plex Mono on 2026-10-27).

## Structure
```
physics-lab/
  index.html            entrypoint (Vite) — title: physics-lab
  README.md             public-facing docs: setup, scripts, conventions, deployment
  PLAN.md               full project plan + progress log
  src/
    main.tsx              React mount
    App.tsx               HashRouter + top bar toggles: Projector + Dark theme.
                         Persists to localStorage (`physicslab_ui_projector`, `physicslab_ui_theme`).
                         Default for first-time visitors: Dark; Projector mode forces Light.
                         Routes: / /playground /topic/:id /sim/{projectile,kinematics,friction}
    index.css            fontsource imports + theme/tokens.css + theme/global.css
    engine/               PURE physics: no React, no canvas, no DOM imports allowed
      vec2.ts               2D vector algebra (immutable Vec2)
      integrator.ts         semiImplicitEuler + FixedStepClock (deterministic)
      forces.ts             gravity/incline/friction/drag/atwood closed forms
      __tests__/            Vitest vs textbook closed-form solutions
    sims/                per-topic sim CLASSES (flat files, no React imports)
      projectile.ts         aim/fire lifecycle, drag, Moon gravity, samples
      kinematics.ts         u/a params, turning-point math, auto-done at 30 s
      friction.ts           two modes: push-ramp staircase + incline/repose
      pulley.ts             two modes: Atwood machine + table-edge (pulley+friction)
      __tests__/            sim behaviour tests (thresholds, determinism, lifecycle)
    ui/                  reusable kit: SimShell (stage/playbar/controls/graphs
                         layout), Slider, FormulaBar, GraphPanel (canvas,
                         graphTicks-guarded axes), ReadoutGroup
    theme/               tokens.css (design system + semantic-by-quantity `--vec-*` colors)
                         global.css (layout primitives, containers/measure, projector scaling, components)
                         Theme is driven by <html> data attrs: `data-theme='dark'` and `data-ui='projector'`.
    content/topics.ts    TOPIC_CONTENT — 11 topics: definition, concepts,
                         formulas, explanation, optional simPath
    pages/
      HomePage.tsx         hero + topic library (cards → topic pages)
      TopicDetailPage.tsx  classroom notes: hero definition (STIX serif +
                           ultramarine rule), numbered concepts, featured
                           formulas, lead paragraph, 'See it move' payoff panel
      PlaygroundPage.tsx   UI-kit demo (live oscillator)
      ProjectilePage.tsx   2D motion — drag-aim, vx/vy vectors, ideal ghost
      KinematicsPage.tsx   1D motion — auto-zoom track, car, live equations
      FrictionPage.tsx     stick/slide — two SVG stages, staircase graph
      PulleyPage.tsx       Atwood + table-edge — FBDs, live tension, two modes
  .kiwi/
    Tasks.py             task tree (roadmap)
    Completed.py         completed task IDs
    decisions.md         per-subtask build decisions + validation evidence
    click-test.mjs       17 real-browser interaction checks (see below)
    screenshots/         verified-state screenshots
```

## How to run
- `npm run dev` — dev server with hot reload (port 5173).
- `npm run build` — type-check (tsc -b) + production build to dist/ (must pass clean).
- `npm run preview` — serve the production build locally.
- `npm run lint` — oxlint (must be 0 warnings, 0 errors).
- `npm test` — Vitest: 84 tests, all must pass.
- `node .kiwi/click-test.mjs` — 22 real-browser interaction checks
  (dev server must be running; `BASE_URL=…` overrides to test production).

## Key patterns (must follow)
1. **Engine purity:** `src/engine/**` never imports React or touches the DOM.
2. **Sims own state:** class with phases `'ready' | 'running' | 'done'`,
   `start()/step(dt)/update(params)/getSnapshot()/getPhase()`; 30 Hz sample
   arrays for graphs; no rendering inside sims; no React imports in `src/sims/`.
3. **Pages mirror the gold-standard loop** (KinematicsPage/ProjectilePage):
   `FixedStepClock(1/240, 12)` + rAF loop, refs mirrors (never read refs
   during render), 30 Hz `publish`, auto-pause on `'done'`, slider change →
   `sim.update` + pause (re-arms).
4. **Stages are inline SVG** in the page module (arrows via `<marker>` defs,
   index-based distance ticks with a guaranteed ≥10 m view span);
   graphs are the canvas GraphPanel.
5. **Determinism:** fixed-timestep semi-implicit Euler; same inputs always
   produce the same run. No `Math.random`, no `Date.now` in engine or sims.
6. **Formula bar:** every sim shows live equations with real substituted
   numbers at 2 decimals (e.g. `v = 5.00 + (−1.00) × 5.81 = −0.81 m/s`).
7. **SI units everywhere** (m, s, kg, N). Pixel conversion only in stages.
8. **Reuse engine helpers** (`forces.ts`) instead of re-deriving g·sinθ etc.
   in sims.

## How to add a sim (the proven pipeline)
1. Pure physics in `src/engine/` + closed-form tests.
2. Sim class `src/sims/<name>.ts` (pattern above) + behaviour tests in
   `src/sims/__tests__/` (thresholds vs textbook values, determinism,
   lifecycle guards).
3. Page `src/pages/<Name>Page.tsx` + `<Name>Page.module.css` — mirror the
   sibling pages' structure exactly; tokens only.
4. Wire: route in `App.tsx`, library card in `HomePage.tsx` (status → 'live'),
   `simPath` in `src/content/topics.ts` for the topic CTA.
5. Extend `.kiwi/click-test.mjs` with physics checks for this sim
   (assert on readouts/values that EXIST in that UI state — see pitfalls).
6. Verify before 'done': tests → build → lint → click-test (local AND
   production) → screenshot + OCR the physics numbers → push (auto-deploy).

## Pitfalls
- Importing React inside `src/engine/` — breaks testability (the biggest sin here).
- Variable-timestep integration — breaks determinism and replays.
- `Math.random`/`Date.now` in sims — non-replayable.
- Pixel units leaking into the engine — engine is SI; convert in stages.
- **Axis math:** GraphPanel consumes live series whose ranges can be
  degenerate (all-equal values, or two values 1 ulp apart — e.g. vx0 vs vy0
  at exactly 45°). Never hand-roll tick loops against raw min/max: route all
  axis math through `src/ui/graphTicks.ts` (`niceTicks` + the 1-ulp guard)
  and GraphPanel's `saneRange`. Stage tick loops must be index-based
  (integer i, `i * step`) with a guaranteed minimum span.
- **CTAs that are links:** global `a:hover` color rules outrank component
  classes — scope plain-link colors with `a:not(.btn)` or CTA text vanishes
  on hover/press.
- **Interaction tests:** assert on readouts that actually exist in the UI
  state under test (e.g. friction's status chip is horizontal-mode-only);
  the full 17-check suite takes ~45 s — pass an explicit `timeout_sec`.
- Forgetting `timeout_sec` on long terminal commands — the CLI default
  timeout is ~30 s.
- If `npm install` runs while the dev server is up, Vite re-optimises and
  detaches automated-test frames — restart the dev server before testing.

## Verification tooling

- `node .kiwi/click-test.mjs` — puppeteer-core driving system Chrome: 17
  checks across projectile (Start/Pause/landing R = ideal), kinematics
  (braking car rests at exactly t = u/|a|), friction (stick → breakaway at
  μs·N; incline rest/slide across the repose angle) and the playground —
  plus console/page-error cleanliness on every page. Run it after any change
  to sim pages, SimShell or GraphPanel. Render-level screenshots cannot
  catch interaction bugs — this harness exists because a 1-ulp degenerate
  range crashed the app on the first real Start click.

## Deployment

- Live site: https://physics-lab-topaz.vercel.app
- Repo: https://github.com/Coder1010ayush/physics-lab (public, `master` → origin)
- Deploy: push to `master` (auto-builds, ~1 min) or `vercel deploy --prod --yes`.
- Verify a deployment: `BASE_URL=https://physics-lab-topaz.vercel.app
  node .kiwi/click-test.mjs` (17 checks against production).
- Static build, no backend/env/secret; should run offline from the laptop (verify once with Wi‑Fi off).
