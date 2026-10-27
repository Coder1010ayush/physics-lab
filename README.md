# PhysicsLab

A free, interactive physics lab for Class-12 students and teachers — live,
classroom-presentable simulations where **every number on screen is traceable
to the textbook**.

- **Live site:** https://physics-lab-topaz.vercel.app
- **Repo:** https://github.com/Coder1010ayush/physics-lab
- Runs fully offline once loaded — safe for classrooms with bad Wi-Fi.

## What's inside

| Topic | Simulation | Classroom notes |
|---|---|---|
| 2D Motion & Vectors | Projectile Lab — aim, air drag, Moon gravity, ideal-path ghost | [→](/#/topic/vectors-2d) |
| Kinematics | 1D motion — car on a track, the three equations of motion updating live, turning-point detection | [→](/#/topic/kinematics) |
| Friction | Push-ramp staircase force graph + incline with angle-of-repose | [→](/#/topic/friction) |
| 8 more topics | Coming in Phase 2–3 | full notes pages live for all 11 |

Every library card opens a **topic page** with definition, numbered key
concepts, textbook formulas and an explanation — ending with a button into
the simulation.

## Tech stack

- **React 19 + Vite 8 + TypeScript 6** — one shared UI kit behind every sim.
- **Custom physics engine** (`src/engine/`) — pure, deterministic,
  unit-tested against closed-form textbook formulas (no physics libraries).
- **Vitest** — 73 tests proving the physics math.
- **oxlint** — linting, 0-warning policy.
- **Vercel** — deployment from `master` (auto-deploy on every push).
- Fonts (self-hosted via Fontsource, no CDN): **Archivo** (interface),
  **STIX Two Text** (definitions & formulas), **JetBrains Mono** (readouts,
  ticks, formula numbers).

## Getting started

```bash
git clone https://github.com/Coder1010ayush/physics-lab.git
cd physics-lab
npm install
npm run dev        # http://localhost:5173
```

Node.js 18+ required (built with Node v22).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`) + production build to `dist/` — must pass clean |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | oxlint — must report 0 warnings, 0 errors |
| `npm test` | Vitest suite — 73 physics tests, all must pass |
| `node .kiwi/click-test.mjs` | Real-browser interaction tests (17 checks; needs the dev server on :5173) |

## How the physics stays honest

Three layers, all required before any sim is marked done:

1. **Unit tests vs closed forms** — every engine/sim module is tested against
   the textbook equation it implements (range = v₀²·sin2θ/g, turning points,
   friction thresholds, Atwood `a` and `T` …).
2. **Static checks** — `npm run build` + `npm run lint` clean.
3. **Real-browser interaction tests** — `.kiwi/click-test.mjs` actually clicks
   Start/Pause, drags sliders and asserts the physics response on screen
   (measured R equals ideal R; the braking car rests at exactly t = u/|a|;
   the block breaks loose at μs·N). Run locally and against production:
   `BASE_URL=https://physics-lab-topaz.vercel.app node .kiwi/click-test.mjs`

## Conventions (short version — see `.kiwi/CODEBASE_SIMPLIFIED.md` for all)

- **Engine purity:** `src/engine/**` never imports React or touches the DOM.
- **Determinism:** fixed-timestep (1/240 s) semi-implicit Euler only; no
  `Math.random`, no `Date.now` in engine or sims. Same inputs → same run,
  every time — repeatable in front of a class.
- **SI units everywhere**; pixel conversion happens only in render code.
- **Styling:** design tokens only (`src/theme/tokens.css`) — no magic colors;
  cards are `chalk-lift` + shadow (never + border); arrowheads are SVG
  attributes, not CSS.
- **Axis math:** all tick/step computation goes through `src/ui/graphTicks.ts`
  and index-based tick loops — never hand-rolled against raw min/max
  (a 1-ulp degenerate range once crashed the app on first click).
- **Fonts:** numbers/instruments use `var(--font-mono)` (JetBrains Mono);
  prose is Archivo; definitions/formulas are STIX Two Text.

### Adding a new sim (the proven pipeline)

1. Pure physics in `src/engine/` + tests against closed forms.
2. Sim class in `src/sims/<name>.ts` — phases, `start/step/update`,
   `getSnapshot/getPhase`, 30 Hz sample arrays. No React.
3. Page `src/pages/<Name>Page.tsx` — SimShell + UI kit, inline SVG stage,
   refs-mirrors rAF loop with `FixedStepClock(1/240, 12)` + 30 Hz publish.
4. Wire: route in `App.tsx`, library card in `HomePage.tsx`,
   `simPath` in `src/content/topics.ts`.
5. Extend `.kiwi/click-test.mjs` with physics checks for this sim.
6. Verify: tests → build → lint → click-test → screenshots → push.

## Deployment

The repo is connected to Vercel: **every push to `master` auto-builds and
updates the live site** (~1 minute).

```bash
# standard flow
git add -A && git commit -m "..." && git push

# verify the deployment end-to-end
BASE_URL=https://physics-lab-topaz.vercel.app node .kiwi/click-test.mjs

# manual deploy (if ever needed)
vercel deploy --prod --yes
```

The site is a static build — no backend, no environment variables, no
secrets. It also runs offline: `npm run build && npm run preview` serves the
same build with no internet.

## Project memory

`.kiwi/` holds the working notes: `CODEBASE_SIMPLIFIED.md` (codebase map +
conventions), `decisions.md` (why each piece was built the way it was),
`Tasks.py` (roadmap), `Completed.py` (done list), `click-test.mjs`
(interaction tests), `screenshots/` (verified states).

`PLAN.md` at the repo root holds the full project plan and progress log.
