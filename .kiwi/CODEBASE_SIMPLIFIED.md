# CODEBASE SIMPLIFIED — physics-lab

**Read PLAN.md first** for the full vision, decisions and roadmap.

## Purpose
Interactive 2D physics simulation website for 12th-grade students: live,
classroom-presentable sims for mechanics (kinematics, forces, friction, pulleys,
circular/rotational motion, energy, momentum, oscillations, fluids).

## Stack (and why)
- **React 19 + Vite 8 + TypeScript 6** — 10+ sims share one UI kit; TS keeps the
  physics math honest; Vite gives instant dev loop + static build.
- **oxlint** for linting (template default).
- **Vitest** (to be added in P0-6) for engine tests against closed-form physics.
- Static output — host anywhere (GitHub Pages / Netlify), runs offline.

## Structure
```
physics-lab/
  index.html            entrypoint (Vite) — title: physics-lab
  src/
    main.tsx              React mount
    App.tsx                router shell + nav + footer (HashRouter)
    index.css              fontsource imports + theme/tokens.css + theme/global.css
    assets/                static assets
    engine/               PURE physics: no React, no canvas, no DOM imports allowed
      vec2.ts               2D vector algebra (immutable Vec2)
      integrator.ts         semiImplicitEuler + FixedStepClock (deterministic)
      forces.ts             gravity/incline/friction/drag/atwood closed forms
      __tests__/            Vitest tests vs textbook closed-form solutions (37)
    sims/                per-topic sim modules: state + params + step() (Phase 1)
    render/              canvas drawing: grid, arrows, trails, FBDs (Phase 1)
    ui/                  reusable: SimShell, Slider, FormulaBar, GraphPanel, ReadoutGroup
    theme/               design tokens (Chalk & Ultramarine): tokens.css, global.css
    content/             topics.ts: TOPIC_CONTENT — per-topic definition, concepts, textbook formulas
    pages/               HomePage (library), TopicDetailPage (classroom content),
                         PlaygroundPage (kit demo), ProjectilePage (2D motion sim)
  .kiwi/                project memory: Tasks.py, Completed.py, decisions.md
  PLAN.md               full project plan
```

## How to run
- `npm run dev` — dev server with hot reload.
- `npm run build` — type-check (tsc -b) + production build to dist/ (must pass clean).
- `npm run preview` — serve the production build locally.
- `npm run lint` — oxlint.
- `npm test` — Vitest engine suite: 37 tests vs closed-form physics.

## Key patterns (must follow)
1. **Engine purity:** `src/engine/**` never imports React or touches the DOM.
   This is what makes it testable against closed-form physics.
2. **Sims own state:** each sim module exposes params, `step(dt)`, readouts — no
   rendering inside sims.
3. **Render draws:** canvas layer reads sim state and draws. No physics in render.
4. **Determinism:** fixed-timestep semi-implicit Euler; same inputs must always
   produce the same trajectory (repeatable in front of a class).
5. **Formula bar:** every sim shows live equations with real numbers
   (e.g. F = μmg = 0.5 × 0.3 × 9.8 = 1.47 N).
6. **SI units everywhere** (m, s, kg, N). Pixel conversion happens only in render.

## How to add a sim (Phase 1+ pattern)
1. Physics: add/extend pure modules in `src/engine/` + tests in `engine/__tests__/`.
2. Sim module: `src/sims/<name>/` with state, params, step().
3. Renderer: `src/render/` drawing helpers for it.
4. Page: `src/pages/<Name>Page.tsx` using SimShell + UI kit; register route and
   home-gallery card.
5. Verify: engine tests + `npm run build` + browser check (screenshots, sliders,
   play/pause/reset, console clean) before marking complete.

## Pitfalls
- Importing React inside `src/engine/` — breaks testability (the biggest sin here).
- Variable-timestep integration — breaks determinism and replays.
- Math.random in sims — non-replayable; seed it if ever needed.
- Pixel units leaking into the engine — engine is SI; convert at render layer.
- Forgetting `timeout_sec` on long terminal commands (npm install etc.) —
  the CLI default timeout is much shorter than you expect.

## Verification tooling (added 2026-10-27)

- `node .kiwi/click-test.mjs` — real-browser click smoke test (puppeteer-core driving the system Chrome; dev server must be running on :5173). Run it after any change to sim pages, the playbar (SimShell) or GraphPanel. Render-level screenshots cannot catch interaction bugs — this harness exists because a 1-ulp floating-point degenerate range crashed the app on the first real Start click.
- Pitfall: GraphPanel consumes live series data whose ranges can be degenerate (all-equal values, or two values 1 ulp apart — e.g. vx0 vs vy0 at exactly 45°). Never hand-roll tick loops against raw min/max: route all axis math through `src/ui/graphTicks.ts` (`niceTicks`) and GraphPanel's `saneRange` normalisation.
- If `npm install` runs while the dev server is up, Vite may re-optimise dependencies and force client reloads (detaching automated-test frames). Restart the dev server before interaction testing.
- CLI default command timeout is short (~30s): always pass an explicit generous `timeout_sec` for npm/chrome commands.
