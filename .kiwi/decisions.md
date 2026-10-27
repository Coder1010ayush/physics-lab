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
Delivered by subagent, parent-reviewed: src/content/topics.ts (11 topics × tagline/definition/5 concepts/textbook formulas/2-paragraph explanation; simPath '/sim/projectile' on kinematics + vectors-2d only) and src/pages/TopicDetailPage.tsx + css (route /topic/:topicId, unknown ids redirect home; back link, h1, tagline, CTA 'Open simulation'/'Open the playground', four cards: Definition, Key concepts, Formulas, Understanding; design tokens only). Parent wired the route into App.tsx.

### Validation
Parent read all 11 topics' content: formulas byte-exact vs spec; friction worked example (μk 0.25, 30° → ≈2.8 m/s²) and Atwood limit checks verified by hand. Subagent ran build + lint 0/0 and machine-checked all 39 formula strings. Parent re-ran build/lint/test after wiring and browser-verified a sim topic and a non-sim topic.

### Status
Validated

### Validation
Parent reviews content physics + code after subagent report; wired into routes by parent; browser verification of card → detail → sim flow.

## Subtask: Fix — Start button crash on /sim/projectile (user-reported)

### Subtask relevance
First user-reported bug: clicking Start in the Projectile Lab appeared to do nothing — in reality the whole React tree crashed. Blocking issue for the flagship sim; exposed a verification gap (render-only checks had missed it).

### Implementation
Root cause: launching at exactly 45°, vx0 = 20·cos45° and vy0 = 20·sin45° differ by 1 ulp (≈2.2e-16). The velocity-components graph got ymin/ymax 1 ulp apart, computed a tick step (5e-16) below the double-precision spacing at 14.14 — so t += step never changed t, the tick loop pushed forever until RangeError: Invalid array length, and React unmounted the tree.
Fix in two layers: (1) src/ui/graphTicks.ts — pure module exporting niceTicks with a degenerate-range guard (step ≤ 0 or first + step === first → single tick; 1000-iteration cap); (2) GraphPanel normalises near-degenerate (≤1e-9 relative), non-finite or inverted min/max to a ±0.5 window before drawing.
Also built .kiwi/click-test.mjs — a puppeteer-core real-click smoke test (Start/Pause/landing on both sim pages) so interaction bugs are caught before users are.

### Validation
8 new niceTicks unit tests including the exact 1-ulp regression input (55/55 total); build + lint 0/0; click test 9/9 PASS with evidence: t advances 0→1.3 s, trail drawn, Pause freezes, landing measures R = 40.8 m (ideal 40.8 m), zero console/page errors. Dev server restarted to clear a stale dependency graph.

### Status
Validated

## Subtask: GitHub repo + Vercel production deployment (user-requested)

### Subtask relevance
User asked to publish the project to their GitHub and deploy live on Vercel (both CLIs logged in). Decisions approved via ask_human: Public repo, name physics-lab, deploy now.

### Implementation
- .gitignore: added .vercel (CLI local state). Click-test now accepts BASE_URL override so the deployed site gets the same interaction verification as localhost.
- `gh repo create physics-lab --public --source=. --push` → github.com/Coder1010ayush/physics-lab (master tracks origin, full history pushed).
- `vercel deploy --prod --yes` → https://physics-lab-topaz.vercel.app (Vite auto-detected, remote build 8s). The GitHub repo was auto-connected for push-to-deploy CI.

### Validation
Live URL returns HTTP 200. Full click-test executed against the PRODUCTION URL: 9/9 PASS — Start runs the sim (t 0→1.3 s), trail drawn, Pause freezes, landing measures R = 40.8 m (ideal 40.8 m), playground runs, zero console/page errors. Push-to-deploy pipeline verified by triggering a rebuild from the docs commit.

### Status
Validated

## Subtask: P1-1 — 1D Kinematics simulation (sim + page)

### Subtask relevance
First of the user's three must-have MVP sims: 1D motion with live x/v/a, the three equations of motion substituted with live numbers, x–t and v–t graphs, and turning-point detection (the v = 0 exam moment).

### Implementation
Subagent (Autocode) built 4 files mirroring the projectile gold-standard: src/sims/kinematics.ts (KinematicsSim: ready/running/done phases, engine semiImplicitEuler 1D-through-Vec2, 30 Hz graph samples, travelled + max|v| tracking, exact turning-point math t* = t_prev − v_prev/a and x* = x_prev − v_prev²/(2a), auto-done at t ≥ 30 s), 8 unit tests, KinematicsPage (auto-zooming track with index-based ticks — structurally immune to the degenerate-range bug class from the projectile crash; car + velocity/acceleration arrows using --vec-* tokens; live FormulaBar with all three equations at 2 decimals; ReadoutGroups incl. 'At rest: t = X s'; position & velocity GraphPanels), module css. Parent wired: route /sim/kinematics, HomePage kinematics card → live, topics.ts kinematics CTA → /sim/kinematics, click-test braking scenario.

### Validation
63/63 unit tests (8 new: closed-form x/v at t = 2; turning point u = 5, a = −1 → t* ≈ 5 s, x* ≈ 12.5 m; out-and-back travelled = 25 m; auto-done; re-arm; lifecycle guards; determinism). Parent hand-verified the turning-point formulas. Build ✓, lint 0/0. Click-test 12/12 incl. a new end-to-end physics check: real slider set to u = 5, a = −1 → Start → the car comes to rest at exactly t = 5.00 s (readout verified in-browser). Screenshot OCR confirms live formula arithmetic (5.00 + −1.00 × 5.81 = −0.81 m/s ✓), travelled > displacement once reversing, parabola x–t and zero-crossing v–t graphs.

### Status
Validated

## Subtask: P1-3 — Friction simulation (both modes) + topic-page typography redesign

### Subtask relevance
Second MVP sim (user's must-have list): static vs kinetic friction — the staircase force graph on flat ground, and the angle-of-repose demo on an incline. Plus a user-requested typography redesign of all topic pages ("text looks like someone just put it there").

### Implementation
Friction sim built by subagent (4 files, kinematics pattern): src/sims/friction.ts (FrictionSim, two modes: horizontal push-ramp 3 N/s to 60 N with static-match/μs·N breakaway/kinetic regime + re-stick branch; incline with willSlide/slideAcceleration from the tested engine helpers — nothing re-derived), 10 unit tests, FrictionPage (segmented mode toggle, hatched-ground + incline-triangle stages with full force-vector sets incl. mg components and the repose ray, staircase Forces-vs-time GraphPanel, mode-specific readouts + FormulaBars). Parent wired: /sim/friction route, HomePage card → live, topics.ts friction simPath, click-test physics section.
Topic redesign (parent, commit a3f3ca6): TopicDetailPage restructured — definition as hero statement (textbook serif, ultramarine rule, no card), numbered concepts (01/02…), featured centered formulas, lead paragraph, and a 'See it move' payoff panel ending every topic at the sim.

### Validation
Friction: 73/73 unit tests; parent hand-reviewed friction.ts physics (stick threshold, re-stick behaviour incl. stick-slip edge cases). Build ✓ lint 0/0. Click-test 17/17 on localhost AND live production, incl. end-to-end threshold physics: block holds while F ramps, breaks loose past μs·N = 24.5 N at ~8.2 s; incline 20° (< repose 26.57°) → position stays exactly 0 m after 3 s; incline 35° → slides. Screenshots OCR-verified with closed-form math: a = 9.8(sin35° − 0.3·cos35°) = 3.21 m/s² ✓, f = μk·mg·cos35° = 12.04 N ✓, v = at ✓, x = ½at² ✓. One test-harness fix during integration (incline has no status readout → assert on position x; plus the suite outgrew the 30 s command timeout).
Redesign: build ✓ lint 0/0, desktop OCR confirms all sections render, mobile overflow check scrollW == clientW at 390 px ✓.

### Status
Validated

## Subtask: Font swap — JetBrains Mono as the instrument font (user decision)

### Subtask relevance
User requested JetBrains Mono for the frontend. Clarified scope via ask_human: user chose 'Numbers + captions only' — replace IBM Plex Mono, keep Archivo (prose/UI) and STIX Two Text (definitions/formulas) so the praised textbook character stays intact.

### Implementation
npm install @fontsource/jetbrains-mono (self-hosted, offline-safe, no CDN), npm uninstall @fontsource/ibm-plex-mono. Edits: src/index.css fontsource imports + header comment; src/theme/tokens.css --font-mono; src/ui/GraphPanel.tsx hardcoded canvas font string (canvas cannot use CSS vars — legitimate hardcode, keep in sync with tokens). --font-mono consumers verified: ReadoutGroup values, Slider values, SimShell playbar/time chips, FormulaBar numbers, TopicDetail concept numerals, stage tick labels on all sim pages — the full 'instrument' layer.

### Validation
Build ✓ lint 0/0, 73/73 tests. Live production font check via puppeteer document.fonts: JetBrains Mono 400 + 600 loaded, 12 active font faces, zero IBM Plex faces remaining. (First dev-server check showed a stale plexGone flag — HMR artifact; the fresh production check is authoritative.)

### Status
Validated

## UI Sprint 1 — Projector mode + wrap strips + semantic velocity color

- Added global Projector toggle in top bar (persisted in localStorage) applying `data-ui='projector'`.
- Projector mode scales UI 1.2×.
- FormulaBar wraps in projector mode (no horizontal scroll).
- Projectile velocity-components graph uses velocity color for both vx/vy; vy is dashed.
- Tuned light-mode `--vec-*` tokens for projector contrast.

## UI Sprint 2 — Dark theme (chalkboard) + top-bar toggle (forced Light in Projector mode)

- Added top-bar Dark toggle persisted in localStorage.
- Dark theme applied via `data-theme='dark'` on `<html>`.
- Projector mode forces Light (Dark toggle disabled while projector is on).
- Top bar background now uses `--topbar-bg` token so it adapts to light/dark.

## UI Sprint 3 — Typography tuning + dark-by-default

- Dark theme defaults ON for first-time visitors (no saved preference); projector mode still forces Light.
- Tuned global type scale tokens (`--step-*`) for better hierarchy.
- Tweaked global caption typography for readability.

## UI Sprint 4 — Narrower measure (65ch) + centered topic layout

- Introduced `--measure: 65ch` token and applied it to paragraph max-width.
- Reduced global `.container` max width to 980px.
- TopicDetailPage now centers the reading column (`.pageHead`, `.sections` constrained to `max-width: var(--measure)` with `margin-inline: auto`).

## UI Sprint 5 — Bigger simulation stage (wider container + taller stage)

- Added `.containerWide` (max-width 1200px) for simulation pages and applied it in SimShell.
- Increased stage minimum height to 360px, and 440px on desktop screens (≥960px).
