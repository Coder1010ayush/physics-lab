import { useCallback, useEffect, useRef, useState } from 'react';
import SimShell from '../ui/SimShell';
import Slider from '../ui/Slider';
import ReadoutGroup from '../ui/ReadoutGroup';
import GraphPanel from '../ui/GraphPanel';
import FormulaBar from '../ui/FormulaBar';
import { FixedStepClock } from '../engine/integrator.js';
import {
  atwood,
  maxStaticFriction,
  kineticFriction,
} from '../engine/forces.js';
import {
  PulleySim,
  type PulleyParams,
  type PulleyMode,
  type PulleyPhase,
  type PulleyStatus,
} from '../sims/pulley.js';
import classes from './PulleyPage.module.css';

const PUBLISH_HZ = 30;

interface Snapshot {
  phase: PulleyPhase;
  t: number;
  mode: PulleyMode;
  positions: { body1: number; body2: number };
  v: number;
  a: number;
  T: number;
  status: PulleyStatus;
  pos1Series: Array<[number, number]>;
  pos2Series: Array<[number, number]>;
  vSeries: Array<[number, number]>;
}

const EMPTY_SNAPSHOT: Snapshot = {
  phase: 'ready',
  t: 0,
  mode: 'atwood',
  positions: { body1: 0, body2: 0 },
  v: 0,
  a: 0,
  T: 0,
  status: 'm₁ descends',
  pos1Series: [],
  pos2Series: [],
  vSeries: [],
};

const MODES: Array<{ label: string; value: PulleyMode }> = [
  { label: 'Atwood machine', value: 'atwood' },
  { label: 'Block pulled off a table', value: 'tableEdge' },
];

const GRAVITIES = [
  { label: 'Earth', value: 9.8 },
  { label: 'Moon', value: 1.62 },
];

export default function PulleyPage() {
  const [params, setParams] = useState<PulleyParams>({
    mode: 'atwood',
    m1: 3,
    m2: 2,
    mTable: 5,
    mHanging: 1,
    muStatic: 0.3,
    muKinetic: 0.2,
    g: 9.8,
  });
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);

  const [sim] = useState(() => new PulleySim(params));
  const [clock] = useState(() => new FixedStepClock(1 / 240, 12));

  // latest mirrors for the animation loop (never read refs during render)
  const paramsRef = useRef(params);
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const publish = useCallback(
    (sim: PulleySim) => {
      const s = sim.getSnapshot();
      setSnap({
        phase: s.phase,
        t: s.t,
        mode: s.mode,
        positions: s.positions,
        v: s.v,
        a: s.a,
        T: s.T,
        status: s.status,
        pos1Series: s.pos1Samples,
        pos2Series: s.pos2Samples,
        vSeries: s.vSamples,
      });
    },
    [sim],
  );

  const setRun = (v: boolean) => {
    runningRef.current = v;
    setRunning(v);
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPublish = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      if (runningRef.current && sim.getPhase() === 'running') {
        const steps = clock.advance(dt * speedRef.current);
        for (const stepDt of steps) {
          sim.step(stepDt);
          if (sim.getPhase() === 'done') break; // step() throws once done
        }
        if (sim.getPhase() === 'done') {
          setRun(false); // auto-pause at the run limit
          publish(sim);
        }
      }

      if (now - lastPublish >= 1000 / PUBLISH_HZ) {
        lastPublish = now;
        publish(sim);
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sim, clock, publish]);

  const updateParam = (patch: Partial<PulleyParams>) => {
    const next = { ...paramsRef.current, ...patch };
    paramsRef.current = next;
    setParams(next);
    sim.update(next); // re-arms with the new starting conditions
    clock.reset();
    setRun(false);
    publish(sim);
  };

  const handleToggleRun = () => {
    if (sim.getPhase() === 'ready') {
      sim.start();
      clock.reset();
      setRun(true);
    } else if (sim.getPhase() === 'running') {
      setRun(!runningRef.current);
    } else {
      // done → replay the same settings
      sim.update(paramsRef.current);
      sim.start();
      clock.reset();
      setRun(true);
    }
    publish(sim);
  };

  const handleReset = () => {
    sim.update(paramsRef.current);
    clock.reset();
    setRun(false);
    publish(sim);
  };

  // live physics from the current params (engine closed forms — the analytic
  // reference the sim must agree with)
  const atwoodMode = params.mode === 'atwood';
  const at = atwoodMode ? atwood(params.m1, params.m2, params.g) : null;
  const Ntable = params.mTable * params.g;
  const fsMax = maxStaticFriction(params.muStatic, Ntable);
  const fk = kineticFriction(params.muKinetic, Ntable);
  const holds = !atwoodMode && params.mHanging * params.g <= fsMax;
  const aSlide =
    !atwoodMode && !holds
      ? (params.mHanging * params.g - fk) / (params.mTable + params.mHanging)
      : 0;
  const TSlide = !atwoodMode
    ? holds
      ? params.mHanging * params.g
      : params.mHanging * (params.g - aSlide)
    : 0;

  const pos1Label = atwoodMode ? 'drop m₁' : 'slide x';
  const pos2Label = atwoodMode ? 'rise m₂' : 'drop mₕ';

  return (
    <SimShell
      title="Force & Pulley — Tension and Constraint Motion"
      subtitle="Two masses over one pulley: the rope ties them together, so one displacement drives both bodies — watch the tension stay equal on both sides while static friction decides whether anything moves at all."
      badge="FORCES"
      running={running}
      onToggleRun={handleToggleRun}
      onReset={handleReset}
      speed={speed}
      onSpeedChange={setSpeed}
      time={snap.t}
      stage={
        snap.mode === 'atwood' ? (
          <AtwoodStage params={params} snap={snap} />
        ) : (
          <TableEdgeStage params={params} snap={snap} />
        )
      }
      controls={
        <>
          <div className={classes.modeRow}>
            <span className={classes.modeLabel}>Mode</span>
            <div className={classes.seg} role="group" aria-label="Pulley mode">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={
                    params.mode === m.value ? classes.segActive : classes.segBtn
                  }
                  aria-pressed={params.mode === m.value}
                  onClick={() => updateParam({ mode: m.value })}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {atwoodMode ? (
            <>
              <Slider
                label="Mass m₁"
                value={params.m1}
                onChange={(v) => updateParam({ m1: v })}
                min={0.5}
                max={10}
                step={0.1}
                unit="kg"
                precision={1}
                hint="the heavier side accelerates down: a = (m₁ − m₂)g/(m₁ + m₂)"
              />
              <Slider
                label="Mass m₂"
                value={params.m2}
                onChange={(v) => updateParam({ m2: v })}
                min={0.5}
                max={10}
                step={0.1}
                unit="kg"
                precision={1}
                hint="equal masses balance: a = 0, T = mg on both sides"
              />
            </>
          ) : (
            <>
              <Slider
                label="Table block mₜ"
                value={params.mTable}
                onChange={(v) => updateParam({ mTable: v })}
                min={0.5}
                max={10}
                step={0.1}
                unit="kg"
                precision={1}
                hint="heavier block → larger N = mₜg → larger friction forces"
              />
              <Slider
                label="Hanging mass mₕ"
                value={params.mHanging}
                onChange={(v) => updateParam({ mHanging: v })}
                min={0.5}
                max={10}
                step={0.1}
                unit="kg"
                precision={1}
                hint="its weight mₕg pulls the rope — static friction decides if that is enough"
              />
              <Slider
                label="Static μs"
                value={params.muStatic}
                onChange={(v) => updateParam({ muStatic: v })}
                min={0}
                max={1.5}
                step={0.05}
                precision={2}
                color="var(--vec-friction)"
                hint="holds while mₕg ≤ μs·mₜg — past that the block breaks loose"
              />
              <Slider
                label="Kinetic μk"
                value={params.muKinetic}
                onChange={(v) => updateParam({ muKinetic: v })}
                min={0}
                max={1.5}
                step={0.05}
                precision={2}
                color="var(--vec-friction)"
                hint="while sliding: f = μk·N, smaller than the static limit"
              />
            </>
          )}
          <div className={classes.modeRow}>
            <span className={classes.modeLabel}>Gravity</span>
            <div className={classes.seg} role="group" aria-label="Gravity">
              {GRAVITIES.map((gOpt) => (
                <button
                  key={gOpt.label}
                  type="button"
                  className={
                    params.g === gOpt.value ? classes.segActive : classes.segBtn
                  }
                  aria-pressed={params.g === gOpt.value}
                  onClick={() => updateParam({ g: gOpt.value })}
                >
                  {gOpt.label}
                </button>
              ))}
            </div>
          </div>
          <ReadoutGroup
            items={[
              { label: 'time', value: snap.t, unit: 's', precision: 2 },
              { label: pos1Label, value: snap.positions.body1, unit: 'm', precision: 2 },
              { label: pos2Label, value: snap.positions.body2, unit: 'm', precision: 2 },
              {
                label: 'speed v',
                value: snap.v,
                unit: 'm/s',
                color: 'var(--vec-velocity)',
                precision: 2,
              },
            ]}
          />
          <ReadoutGroup
            items={[
              {
                label: 'accel a',
                value: snap.a,
                unit: 'm/s²',
                color: 'var(--vec-acceleration)',
                precision: 2,
              },
              {
                label: 'tension T',
                value: snap.T,
                unit: 'N',
                color: 'var(--vec-tension)',
                precision: 2,
              },
              {
                label: 'status',
                value: snap.status,
                color: 'var(--vec-tension)',
              },
            ]}
          />
        </>
      }
      graphs={
        <>
          <GraphPanel
            title="Positions vs time"
            series={[
              {
                label: `${pos1Label} (m)`,
                color: 'var(--ultramarine)',
                data: snap.pos1Series,
              },
              {
                label: `${pos2Label} (m)`,
                color: 'var(--vec-tension)',
                data: snap.pos2Series,
              },
            ]}
            xLabel="t (s)"
            yLabel="s (m)"
          />
          <GraphPanel
            title="Speed vs time"
            series={[
              { label: 'v (m/s)', color: 'var(--vec-velocity)', data: snap.vSeries },
            ]}
            xLabel="t (s)"
            yLabel="v (m/s)"
          />
        </>
      }
      formulas={
        atwoodMode && at ? (
          <FormulaBar
            items={[
              {
                label: 'Atwood',
                formula: 'a = (m₁ − m₂)g/(m₁ + m₂)',
                substitution: `= (${params.m1.toFixed(2)} − ${params.m2.toFixed(2)}) × ${params.g.toFixed(2)} / ${(params.m1 + params.m2).toFixed(2)}`,
                result: at.a.toFixed(2),
                unit: 'm/s²',
              },
              {
                label: 'Tension',
                formula: 'T = 2m₁m₂g/(m₁ + m₂)',
                substitution: `= 2 × ${params.m1.toFixed(2)} × ${params.m2.toFixed(2)} × ${params.g.toFixed(2)} / ${(params.m1 + params.m2).toFixed(2)}`,
                result: at.tension.toFixed(2),
                unit: 'N',
              },
            ]}
          />
        ) : (
          <FormulaBar
            items={[
              {
                label: 'Static check',
                formula: 'mₕg ≤ μs·mₜg ?',
                substitution: `= ${params.mHanging.toFixed(2)} × ${params.g.toFixed(2)} ≤ ${params.muStatic.toFixed(2)} × ${params.mTable.toFixed(2)} × ${params.g.toFixed(2)}`,
                result: holds ? 'holds' : 'slides',
                unit: '',
              },
              {
                label: 'Slide',
                formula: 'a = (mₕg − μkN)/(mₕ + mₜ)',
                substitution: `= (${params.mHanging.toFixed(2)} × ${params.g.toFixed(2)} − ${params.muKinetic.toFixed(2)} × ${Ntable.toFixed(2)}) / ${(params.mHanging + params.mTable).toFixed(2)}`,
                result: aSlide.toFixed(2),
                unit: 'm/s²',
              },
              {
                label: 'Tension',
                formula: 'T = mₕ(g − a)',
                substitution: `= ${params.mHanging.toFixed(2)} × (${params.g.toFixed(2)} − ${aSlide.toFixed(2)})`,
                result: TSlide.toFixed(2),
                unit: 'N',
              },
            ]}
          />
        )
      }
    />
  );
}

/* ── the Atwood stage: two masses over a pulley, FBD arrows beside each ── */
function AtwoodStage({
  params,
  snap,
}: {
  params: PulleyParams;
  snap: Snapshot;
}) {
  const W = 600;
  const H = 330;
  const pulleyX = 300;
  const pulleyY = 54;
  const R = 16;
  const SCALE = 118; // px per metre
  const HANG = 1.1; // both masses start 1.1 m below the pulley [m]

  // rope displacement [m]: + → m1 down, − → m2 down
  const s = snap.positions.body1;
  const y1 = pulleyY + (HANG + s) * SCALE; // m1 (left)
  const y2 = pulleyY + (HANG - s) * SCALE; // m2 (right)
  const ropeLX = pulleyX - R;
  const ropeRX = pulleyX + R;

  // block side ∝ cbrt(mass) — same amount of stuff, spread over more volume
  const side1 = 14 + 9 * Math.cbrt(params.m1);
  const side2 = 14 + 9 * Math.cbrt(params.m2);

  // FBD arrow lengths (px, capped; ~zero values hide)
  const ARROW_MIN = 0.05;
  const PX_PER_N = 1.6;
  const capLen = (f: number) => Math.min(90, f * PX_PER_N);
  const T = snap.T;
  const w1 = params.m1 * params.g;
  const w2 = params.m2 * params.g;
  const tLen = capLen(T);
  const w1Len = capLen(w1);
  const w2Len = capLen(w2);
  const showT = T >= ARROW_MIN;

  // vertical ruler: index-based ticks every 0.5 m below the pulley (span ≥ 2.2 m)
  const rulerStep = 0.5;
  const rulerCount = 5; // 0 … 2.0 m — guaranteed span
  const ruler: number[] = [];
  for (let i = 0; i <= rulerCount; i++) ruler.push(i * rulerStep);

  // floor under m1: the descending mass lands after dropping HANG metres
  const floorY = pulleyY + 2 * HANG * SCALE;
  const hatch: Array<[number, number]> = [];
  for (let hx = ropeLX - 70; hx <= ropeLX + 70; hx += 14) {
    hatch.push([hx, hx + 7]);
  }

  return (
    <svg
      className={classes.stageSvg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Atwood machine: two masses over a pulley with tension and weight arrows"
    >
      <defs>
        <marker id="aTensionHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-tension)" />
        </marker>
        <marker id="aForceHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-force)" />
        </marker>
      </defs>

      {/* ceiling mount + hatch above the pulley */}
      <line className={classes.ground} x1={pulleyX - 40} y1={pulleyY - R - 8} x2={pulleyX + 40} y2={pulleyY - R - 8} />
      {[-38, -24, -10, 4, 18, 32].map((dx) => (
        <line key={dx} className={classes.hatch} x1={pulleyX + dx} y1={pulleyY - R - 8} x2={pulleyX + dx + 7} y2={pulleyY - R - 14} />
      ))}

      {/* the pulley wheel */}
      <circle className={classes.pulley} cx={pulleyX} cy={pulleyY} r={R} />
      <circle className={classes.pulleyAxle} cx={pulleyX} cy={pulleyY} r={3} />

      {/* the rope: ceiling → pulley → both masses */}
      <line className={classes.rope} x1={pulleyX} y1={pulleyY - R - 8} x2={pulleyX} y2={pulleyY - R} />
      <line className={classes.rope} x1={ropeLX} y1={pulleyY} x2={ropeLX} y2={y1} />
      <line className={classes.rope} x1={ropeRX} y1={pulleyY} x2={ropeRX} y2={y2} />

      {/* vertical ruler (left edge) */}
      {ruler.map((m) => (
        <g key={m}>
          <line className={classes.tick} x1={40} y1={pulleyY + m * SCALE} x2={48} y2={pulleyY + m * SCALE} />
          <text className={classes.tickLabel} x={36} y={pulleyY + m * SCALE + 3} textAnchor="end">
            {m.toFixed(1)}
          </text>
        </g>
      ))}
      <text className={classes.axisCaption} x={40} y={pulleyY - 12} textAnchor="start">
        drop (m)
      </text>

      {/* floor under m1 + hatch */}
      <line className={classes.ground} x1={ropeLX - 70} y1={floorY} x2={ropeLX + 70} y2={floorY} />
      {hatch.map(([x1, x2]) => (
        <line key={x1} className={classes.hatch} x1={x1} y1={floorY} x2={x2} y2={floorY + 6} />
      ))}

      {/* m1 (left) */}
      <rect className={classes.block} x={ropeLX - side1 / 2} y={y1 - side1 / 2} width={side1} height={side1} rx={3} />
      <text className={classes.massLabel} x={ropeLX} y={y1 + 4}>
        m₁
      </text>

      {/* m2 (right) */}
      <rect className={classes.block} x={ropeRX - side2 / 2} y={y2 - side2 / 2} width={side2} height={side2} rx={3} />
      <text className={classes.massLabel} x={ropeRX} y={y2 + 4}>
        m₂
      </text>

      {/* FBD beside m1: tension up, weight down */}
      {showT ? (
        <>
          <line
            className={classes.tensionArrow}
            x1={ropeLX - side1 / 2 - 12}
            y1={y1}
            x2={ropeLX - side1 / 2 - 12}
            y2={y1 - tLen}
            markerEnd="url(#aTensionHead)"
          />
          <text className={`${classes.mathLabel} ${classes.tensionLabel}`} x={ropeLX - side1 / 2 - 16} y={y1 - tLen - 4} textAnchor="end">
            T
          </text>
        </>
      ) : null}
      <line
        className={classes.forceArrow}
        x1={ropeLX + side1 / 2 + 12}
        y1={y1}
        x2={ropeLX + side1 / 2 + 12}
        y2={y1 + w1Len}
        markerEnd="url(#aForceHead)"
      />
      <text className={`${classes.mathLabel} ${classes.forceLabel}`} x={ropeLX + side1 / 2 + 16} y={y1 + w1Len + 12}>
        m₁g
      </text>

      {/* FBD beside m2: tension up, weight down */}
      {showT ? (
        <>
          <line
            className={classes.tensionArrow}
            x1={ropeRX + side2 / 2 + 12}
            y1={y2}
            x2={ropeRX + side2 / 2 + 12}
            y2={y2 - tLen}
            markerEnd="url(#aTensionHead)"
          />
          <text className={`${classes.mathLabel} ${classes.tensionLabel}`} x={ropeRX + side2 / 2 + 16} y={y2 - tLen - 4}>
            T
          </text>
        </>
      ) : null}
      <line
        className={classes.forceArrow}
        x1={ropeRX - side2 / 2 - 12}
        y1={y2}
        x2={ropeRX - side2 / 2 - 12}
        y2={y2 + w2Len}
        markerEnd="url(#aForceHead)"
      />
      <text className={`${classes.mathLabel} ${classes.forceLabel}`} x={ropeRX - side2 / 2 - 16} y={y2 + w2Len + 12} textAnchor="end">
        m₂g
      </text>

      {/* settings chip (top-left) */}
      <rect className={classes.stageChip} x={24} y={8} width={250} height={22} rx={7} />
      <text className={classes.stageChipText} x={34} y={23}>
        m₁ = {params.m1.toFixed(1)} kg · m₂ = {params.m2.toFixed(1)} kg · g = {params.g.toFixed(2)} m/s²
      </text>

      {/* status chip (top-right) */}
      <rect className={classes.stageChip} x={W - 190} y={8} width={166} height={22} rx={7} />
      <text className={classes.statusChipText} x={W - 107} y={23} textAnchor="middle">
        {snap.status}
      </text>
    </svg>
  );
}

/* ── the table-edge stage: block pulled toward the edge by a hanging mass ── */

function TableEdgeStage({
  params,
  snap,
}: {
  params: PulleyParams;
  snap: Snapshot;
}) {
  const W = 600;
  const H = 330;
  const tableTopY = 70;
  const tableLX = 70;
  const pulleyX = 470;
  const R = 14;
  const SCALE = 140; // px per metre
  const FLOOR = 1.5; // the floor is 1.5 m below the pulley [m]

  // rope displacement [m]: the hanging drop = the block slide (one rope)
  const x = snap.positions.body2; // hanging drop
  const slide = snap.positions.body1; // block slide toward the edge

  const blockSide = 14 + 9 * Math.cbrt(params.mTable);
  const blockX = 130 + slide * SCALE; // slides right toward the pulley
  const blockY = tableTopY - blockSide;

  const hangSide = 14 + 9 * Math.cbrt(params.mHanging);
  const ropeY = tableTopY - R; // rope runs at the pulley's centre height
  const hangY = ropeY + x * SCALE;

  // forces [N] → px
  const PX_PER_N = 1.4;
  const capLen = (f: number) => Math.min(80, f * PX_PER_N);
  const N = params.mTable * params.g;
  const wTable = N;
  const wHang = params.mHanging * params.g;
  const T = snap.T;
  const sliding = snap.status === 'sliding';
  const fric = sliding ? params.muKinetic * N : T; // static holds with f = T

  const floorY = ropeY + FLOOR * SCALE;
  const hatch: Array<[number, number]> = [];
  for (let hx = pulleyX - 60; hx <= pulleyX + 60; hx += 14) {
    hatch.push([hx, hx + 7]);
  }

  // vertical ruler (right of the hanging mass): index-based, 0 … 1.5 m
  const rulerStep = 0.5;
  const rulerCount = 3;
  const ruler: number[] = [];
  for (let i = 0; i <= rulerCount; i++) ruler.push(i * rulerStep);

  return (
    <svg
      className={classes.stageSvg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Block on a table pulled toward the edge by a hanging mass over a pulley"
    >
      <defs>
        <marker id="tTensionHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-tension)" />
        </marker>
        <marker id="tForceHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-force)" />
        </marker>
        <marker id="tFrictionHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-friction)" />
        </marker>
        <marker id="tStructHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-structural)" />
        </marker>
      </defs>

      {/* the table */}
      <rect className={classes.table} x={tableLX} y={tableTopY} width={pulleyX + R - tableLX} height={18} rx={2} />
      {[-40, -20, 0, 20].map((dx) => (
        <line key={dx} className={classes.hatch} x1={tableLX + 20 + dx} y1={tableTopY + 18} x2={tableLX + 27 + dx} y2={tableTopY + 24} />
      ))}

      {/* the pulley at the table edge */}
      <circle className={classes.pulley} cx={pulleyX} cy={ropeY} r={R} />
      <circle className={classes.pulleyAxle} cx={pulleyX} cy={ropeY} r={2.6} />

      {/* the rope: block → pulley → hanging mass */}
      <line className={classes.rope} x1={blockX + blockSide / 2} y1={ropeY} x2={pulleyX} y2={ropeY} />
      <line className={classes.rope} x1={pulleyX} y1={ropeY} x2={pulleyX} y2={hangY - hangSide / 2} />

      {/* the block on the table */}
      <rect className={classes.block} x={blockX - blockSide / 2} y={blockY} width={blockSide} height={blockSide} rx={3} />
      <text className={classes.massLabel} x={blockX} y={blockY + blockSide / 2 + 4}>
        mₜ
      </text>

      {/* the hanging mass */}
      <rect className={classes.block} x={pulleyX - hangSide / 2} y={hangY - hangSide / 2} width={hangSide} height={hangSide} rx={3} />
      <text className={classes.massLabel} x={pulleyX} y={hangY + 4}>
        mₕ
      </text>

      {/* FBD on the block: N up, mₜg down, T right, friction left */}
      <line
        className={classes.structArrow}
        x1={blockX}
        y1={blockY}
        x2={blockX}
        y2={blockY - capLen(N)}
        markerEnd="url(#tStructHead)"
      />
      <text className={`${classes.mathLabel} ${classes.structLabel}`} x={blockX + 6} y={blockY - capLen(N) + 4}>
        N
      </text>
      <line
        className={classes.forceArrow}
        x1={blockX - blockSide / 2 - 10}
        y1={blockY + blockSide / 2}
        x2={blockX - blockSide / 2 - 10}
        y2={blockY + blockSide / 2 + capLen(wTable)}
        markerEnd="url(#tForceHead)"
      />
      <text className={`${classes.mathLabel} ${classes.forceLabel}`} x={blockX - blockSide / 2 - 14} y={blockY + blockSide / 2 + capLen(wTable) + 12} textAnchor="end">
        mₜg
      </text>
      <line
        className={classes.tensionArrow}
        x1={blockX + blockSide / 2}
        y1={blockY + blockSide / 3}
        x2={blockX + blockSide / 2 + capLen(T)}
        y2={blockY + blockSide / 3}
        markerEnd="url(#tTensionHead)"
      />
      <text className={`${classes.mathLabel} ${classes.tensionLabel}`} x={blockX + blockSide / 2 + capLen(T) + 6} y={blockY + blockSide / 3 + 5}>
        T
      </text>
      <line
        className={classes.frictionArrow}
        x1={blockX - blockSide / 2}
        y1={blockY + 2 * (blockSide / 3)}
        x2={blockX - blockSide / 2 - capLen(fric)}
        y2={blockY + 2 * (blockSide / 3)}
        markerEnd="url(#tFrictionHead)"
      />
      <text className={`${classes.mathLabel} ${classes.frictionLabel}`} x={blockX - blockSide / 2 - capLen(fric) - 6} y={blockY + 2 * (blockSide / 3) + 5} textAnchor="end">
        f
      </text>

      {/* FBD on the hanging mass: T up, mₕg down */}
      <line
        className={classes.tensionArrow}
        x1={pulleyX + hangSide / 2 + 10}
        y1={hangY}
        x2={pulleyX + hangSide / 2 + 10}
        y2={hangY - capLen(T)}
        markerEnd="url(#tTensionHead)"
      />
      <text className={`${classes.mathLabel} ${classes.tensionLabel}`} x={pulleyX + hangSide / 2 + 14} y={hangY - capLen(T) - 4}>
        T
      </text>
      <line
        className={classes.forceArrow}
        x1={pulleyX - hangSide / 2 - 10}
        y1={hangY}
        x2={pulleyX - hangSide / 2 - 10}
        y2={hangY + capLen(wHang)}
        markerEnd="url(#tForceHead)"
      />
      <text className={`${classes.mathLabel} ${classes.forceLabel}`} x={pulleyX - hangSide / 2 - 14} y={hangY + capLen(wHang) + 12} textAnchor="end">
        mₕg
      </text>

      {/* floor under the hanging mass + hatch */}
      <line className={classes.ground} x1={pulleyX - 60} y1={floorY} x2={pulleyX + 60} y2={floorY} />
      {hatch.map(([x1, x2]) => (
        <line key={x1} className={classes.hatch} x1={x1} y1={floorY} x2={x2} y2={floorY + 6} />
      ))}

      {/* vertical ruler (right edge): hanging drop */}
      {ruler.map((m) => (
        <g key={m}>
          <line className={classes.tick} x1={W - 48} y1={ropeY + m * SCALE} x2={W - 40} y2={ropeY + m * SCALE} />
          <text className={classes.tickLabel} x={W - 36} y={ropeY + m * SCALE + 3}>
            {m.toFixed(1)}
          </text>
        </g>
      ))}
      <text className={classes.axisCaption} x={W - 40} y={ropeY - 10} textAnchor="end">
        drop (m)
      </text>

      {/* settings chip (top-left) */}
      <rect className={classes.stageChip} x={24} y={8} width={290} height={22} rx={7} />
      <text className={classes.stageChipText} x={34} y={23}>
        mₜ = {params.mTable.toFixed(1)} kg · mₕ = {params.mHanging.toFixed(1)} kg · μs = {params.muStatic.toFixed(2)} · μk = {params.muKinetic.toFixed(2)}
      </text>

      {/* status chip (top-right) */}
      <rect className={classes.stageChip} x={W - 190} y={8} width={166} height={22} rx={7} />
      <text className={classes.statusChipText} x={W - 107} y={23} textAnchor="middle">
        {snap.status}
      </text>
    </svg>
  );
}
