# Task tree for physics-lab
# Update .kiwi/Completed.py as tasks finish. See PLAN.md for full details.

TASKS = [
    # ---- Phase 0: Foundation ----
    {"id": "P0-1", "title": "Scaffold Vite + React + TS project, deps installed, build passing", "status": "done"},
    {"id": "P0-2", "title": "Write PLAN.md + .kiwi docs (decisions, tasks, codebase map)", "status": "done"},
    {"id": "P0-3", "title": "Design tokens: colors, fonts, spacing + SimShell layout shell", "status": "done"},
    {"id": "P0-4", "title": "UI kit: Slider, FormulaBar, GraphPanel, ReadoutGroup", "status": "done"},
    {"id": "P0-5", "title": "Engine core: vec2.ts, integrator.ts (fixed-dt semi-implicit Euler), forces.ts", "status": "done"},
    {"id": "P0-6", "title": "Vitest setup + engine tests vs closed-form physics (projectile range, kinematics, Atwood a/T, incline threshold, friction staircase)", "status": "done"},

    # ---- Phase 1: MVP sims ----
    {"id": "P1-0", "title": "Topic detail pages for all library cards (definition, concepts, formulas, explanation + CTA to sim)", "status": "done"},
    {"id": "P1-1", "title": "Kinematics 1D sim (track, sliders, live x/v/a readouts, x-t & v-t graphs, equation bar)", "status": "done"},
    {"id": "P1-2", "title": "Projectile sim (aim + drag, trajectory trace, velocity vectors, drag toggle, range/height/time readouts)", "status": "done"},
    {"id": "P1-3", "title": "Friction sim: horizontal (staircase graph, F/f/N/W arrows) + incline (angle of repose)", "status": "done"},
    {"id": "P1-4", "title": "Pulley sim: Atwood machine (FBDs, tension) + table-edge variant (pulley + friction)", "status": "done"},
    {"id": "P1-5", "title": "Home page topic gallery + routing", "status": "done"},
    {"id": "P1-6", "title": "Browser verification pass on all MVP sims (local + production click-test, screenshots/OCR spot checks)", "status": "done"},


    # ---- UI/UX sprints (projector-first) ----
    {"id": "P1-7", "title": "UI Sprint: Projector mode (wrap strips), semantic-by-quantity vector colors, and sim stage sizing", "status": "done"},
    {"id": "P1-8", "title": "UI Sprint: Dark theme (chalkboard) with default-dark + projector-forces-light", "status": "done"},

    # ---- Phase 2: remaining topics ----
    {"id": "P2-1", "title": "2D motion / vector playground", "status": "todo"},
    {"id": "P2-2", "title": "Circular motion", "status": "todo"},
    {"id": "P2-3", "title": "Torque", "status": "todo"},
    {"id": "P2-4", "title": "Rotational motion", "status": "todo"},
    {"id": "P2-5", "title": "Work-energy-power (roller coaster track)", "status": "todo"},
    {"id": "P2-6", "title": "Momentum & collisions", "status": "todo"},
    {"id": "P2-7", "title": "Oscillations: pendulum + spring (SHM)", "status": "todo"},

    # ---- Phase 3: fluids + polish ----
    {"id": "P3-1", "title": "Fluids: buoyancy, Bernoulli, continuity", "status": "todo"},
    {"id": "P3-2", "title": "Challenge mode (hit-the-target etc.)", "status": "todo"},
    {"id": "P3-3", "title": "Deployment + polish: keep production stable; optionally verify a true offline run (no network)", "status": "todo"},
]
