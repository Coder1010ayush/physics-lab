import { useCallback, useEffect, useRef, useState } from 'react';
import SimShell from '../ui/SimShell';
import Slider from '../ui/Slider';
import ReadoutGroup from '../ui/ReadoutGroup';
import GraphPanel from '../ui/GraphPanel';
import FormulaBar from '../ui/FormulaBar';
import { FixedStepClock } from '../engine/integrator.js';
import { G, willSlide, slideAcceleration } from '../engine/forces.js';
import {
  FrictionSim,
  type FrictionParams,
  type FrictionMode,
  type FrictionPhase,
} from '../sims/friction.js';
import classes from './FrictionPage.module.css';

const PUBLISH_HZ = 30;

interface Snapshot {
  phase: FrictionPhase;
  t: number;
  x: number;
  v: number;
  mode: FrictionMode;
  applied: number;
  friction: number;
  sliding: boolean;
  maxStatic: number;
  angleReposeDeg: number;
  xSeries: Array<[number, number]>;
  vSeries: Array<[number, number]>;
  appliedSeries: Array<[number, number]>;
  frictionSeries: Array<[number, number]>;
}

const EMPTY_SNAPSHOT: Snapshot = {
  phase: 'ready',
  t: 0,
  x: 0,
  v: 0,
  mode: 'horizontal',
  applied: 0,
  friction: 0,
  sliding: false,
  maxStatic: 0,
  angleReposeDeg: 0,
  xSeries: [],
  vSeries: [],
  appliedSeries: [],
  frictionSeries: [],
};

const MODES: Array<{ label: string; value: FrictionMode }> = [
  { label: 'Push on flat ground', value: 'horizontal' },
  { label: 'Slide down a ramp', value: 'incline' },
];

export default function FrictionPage() {
  const [params, setParams] = useState<FrictionParams>({
    mode: 'horizontal',
    mass: 5,
    muS: 0.5,
    muK: 0.3,
    inclineAngleDeg: 20,
  });
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);

  const [sim] = useState(() => new FrictionSim(params));
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

  const publish = useCallback((sim: FrictionSim) => {
    const s = sim.getSnapshot();
    setSnap({
      phase: s.phase,
      t: s.t,
      x: s.x,
      v: s.v,
      mode: s.mode,
      applied: s.applied,
      friction: s.friction,
      sliding: s.sliding,
      maxStatic: s.maxStatic,
      angleReposeDeg: s.angleReposeDeg,
      xSeries: s.xSamples,
      vSeries: s.vSamples,
      appliedSeries: s.appliedSamples,
      frictionSeries: s.frictionSamples,
    });
  }, [sim]);

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

  const updateParam = (patch: Partial<FrictionParams>) => {
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

  const theta = (params.inclineAngleDeg * Math.PI) / 180;
  const N =
    params.mode === 'horizontal'
      ? params.mass * G
      : params.mass * G * Math.cos(theta);
  const fsMax = params.muS * N;
  const fk = params.muK * N;
  const reposeDeg = snap.angleReposeDeg;
  const aSlope = willSlide(theta, params.muS)
    ? slideAcceleration(theta, params.muK)
    : 0;

  return (
    <SimShell
      title="Friction — Sticking and Sliding"
      subtitle="Push a block harder and harder until static friction lets go, or tilt a ramp past the angle of repose and watch it slide — the live force graph shows the friction staircase."
      badge="FRICTION"
      running={running}
      onToggleRun={handleToggleRun}
      onReset={handleReset}
      speed={speed}
      onSpeedChange={setSpeed}
      time={snap.t}
      stage={
        snap.mode === 'horizontal' ? (
          <HorizontalStage params={params} snap={snap} />
        ) : (
          <InclineStage params={params} snap={snap} />
        )
      }
      controls={
        <>
          <div className={classes.modeRow}>
            <span className={classes.modeLabel}>Mode</span>
            <div className={classes.seg} role="group" aria-label="Friction mode">
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
          <Slider
            label="Mass"
            value={params.mass}
            onChange={(v) => updateParam({ mass: v })}
            min={0.5}
            max={20}
            step={0.5}
            unit="kg"
            precision={1}
            hint="heavier block → larger N = mg → larger friction forces"
          />
          <Slider
            label="Static μs"
            value={params.muS}
            onChange={(v) => updateParam({ muS: v })}
            min={0}
            max={1.5}
            step={0.05}
            precision={2}
            color="var(--vec-friction)"
            hint="friction matches the push up to μs·N — then the block breaks loose"
          />
          <Slider
            label="Kinetic μk"
            value={params.muK}
            onChange={(v) => updateParam({ muK: v })}
            min={0}
            max={1.5}
            step={0.05}
            precision={2}
            color="var(--vec-friction)"
            hint="while sliding: f = μk·N, smaller than the static limit"
          />
          {params.mode === 'incline' ? (
            <Slider
              label="Ramp angle θ"
              value={params.inclineAngleDeg}
              onChange={(v) => updateParam({ inclineAngleDeg: v })}
              min={0}
              max={60}
              step={0.5}
              unit="°"
              precision={1}
              color="var(--vec-force)"
              hint="tan θ vs μs decides stick or slide — past θ* = atan μs it lets go"
            />
          ) : null}
          <ReadoutGroup
            items={[
              { label: 'time', value: snap.t, unit: 's', precision: 2 },
              { label: 'position x', value: snap.x, unit: 'm', precision: 2 },
              {
                label: 'velocity v',
                value: snap.v,
                unit: 'm/s',
                color: 'var(--vec-velocity)',
                precision: 2,
              },
            ]}
          />
          {snap.mode === 'horizontal' ? (
            <ReadoutGroup
              items={[
                {
                  label: 'applied F',
                  value: snap.applied,
                  unit: 'N',
                  color: 'var(--vec-force)',
                  precision: 2,
                },
                {
                  label: 'friction f',
                  value: snap.friction,
                  unit: 'N',
                  color: 'var(--vec-friction)',
                  precision: 2,
                },
                {
                  label: 'μs·N limit',
                  value: snap.maxStatic,
                  unit: 'N',
                  precision: 2,
                },
                {
                  label: 'status',
                  value: snap.sliding ? 'sliding' : 'sticking',
                  color: snap.sliding
                    ? 'var(--vec-friction)'
                    : 'var(--vec-structural)',
                },
              ]}
            />
          ) : (
            <ReadoutGroup
              items={[
                {
                  label: 'ramp θ',
                  value: params.inclineAngleDeg,
                  unit: '°',
                  precision: 1,
                },
                {
                  label: 'repose θ*',
                  value: reposeDeg,
                  unit: '°',
                  color: 'var(--vec-friction)',
                  precision: 2,
                },
                {
                  label: 'a down-slope',
                  value: aSlope,
                  unit: 'm/s²',
                  color: 'var(--vec-acceleration)',
                  precision: 2,
                },
                {
                  label: 'friction f',
                  value: snap.friction,
                  unit: 'N',
                  color: 'var(--vec-friction)',
                  precision: 2,
                },
              ]}
            />
          )}
        </>
      }
      graphs={
        snap.mode === 'horizontal' ? (
          <>
            <GraphPanel
              title="Forces vs time"
              series={[
                {
                  label: 'F applied',
                  color: 'var(--vec-force)',
                  data: snap.appliedSeries,
                },
                {
                  label: 'f friction',
                  color: 'var(--vec-friction)',
                  data: snap.frictionSeries,
                },
              ]}
              xLabel="t (s)"
              yLabel="F (N)"
            />
            <GraphPanel
              title="Velocity vs time"
              series={[
                { label: 'v (m/s)', color: 'var(--vec-velocity)', data: snap.vSeries },
              ]}
              xLabel="t (s)"
              yLabel="v (m/s)"
            />
          </>
        ) : (
          <>
            <GraphPanel
              title="Speed vs time"
              series={[
                { label: 'v (m/s)', color: 'var(--vec-velocity)', data: snap.vSeries },
              ]}
              xLabel="t (s)"
              yLabel="v (m/s)"
            />
            <GraphPanel
              title="Position along slope"
              series={[
                { label: 'x (m)', color: 'var(--ultramarine)', data: snap.xSeries },
              ]}
              xLabel="t (s)"
              yLabel="x (m)"
            />
          </>
        )
      }
      formulas={
        snap.mode === 'horizontal' ? (
          <FormulaBar
            items={[
              {
                label: 'Static limit',
                formula: 'fs ≤ μs·N',
                substitution: `= ${params.muS.toFixed(2)} × ${N.toFixed(1)}`,
                result: fsMax.toFixed(1),
                unit: 'N',
              },
              {
                label: 'Kinetic',
                formula: 'fk = μk·N',
                substitution: `= ${params.muK.toFixed(2)} × ${N.toFixed(1)}`,
                result: fk.toFixed(1),
                unit: 'N',
              },
              {
                label: 'Sliding',
                formula: 'a = (F − fk)/m',
                substitution: `= (${snap.applied.toFixed(1)} − ${fk.toFixed(1)}) / ${params.mass.toFixed(1)}`,
                result: snap.sliding
                  ? ((snap.applied - fk) / params.mass).toFixed(2)
                  : '0.00',
                unit: 'm/s²',
              },
            ]}
          />
        ) : (
          <FormulaBar
            items={[
              {
                label: 'Repose',
                formula: 'tan θ* = μs',
                substitution: `= tan ${reposeDeg.toFixed(2)}°`,
                result: params.muS.toFixed(2),
                unit: '',
              },
              {
                label: 'Down-slope',
                formula: 'a = g(sin θ − μk cos θ)',
                substitution: `= 9.8 × (sin ${params.inclineAngleDeg.toFixed(1)}° − ${params.muK.toFixed(2)} × cos ${params.inclineAngleDeg.toFixed(1)}°)`,
                result: aSlope.toFixed(2),
                unit: 'm/s²',
              },
              {
                label: 'Normal',
                formula: 'N = mg cos θ',
                substitution: `= ${params.mass.toFixed(1)} × 9.8 × cos ${params.inclineAngleDeg.toFixed(1)}°`,
                result: N.toFixed(1),
                unit: 'N',
              },
            ]}
          />
        )
      }
    />
  );
}

/* ── the horizontal stage: block on flat ground, push vs friction ── */

function HorizontalStage({
  params,
  snap,
}: {
  params: FrictionParams;
  snap: Snapshot;
}) {
  const W = 600;
  const H = 330;
  const padL = 30;
  const padR = 30;
  const groundY = 240;
  const plotW = W - padL - padR;

  // auto-zoom along the ground (min span 10 m), niceStep + index ticks
  let lo = Math.min(0, snap.x);
  let hi = Math.max(0, snap.x);
  if (lo < 0) lo *= 1.25;
  if (hi > 0) hi *= 1.25;
  if (hi - lo < 10) {
    if (lo >= 0) hi = lo + 10;
    else if (hi <= 0) lo = hi - 10;
    else {
      const mid = (hi + lo) / 2;
      lo = mid - 5;
      hi = mid + 5;
    }
  }
  const tickStep = niceStep((hi - lo) / 5);
  lo = Math.floor(lo / tickStep) * tickStep;
  hi = Math.ceil(hi / tickStep) * tickStep;

  const sx = (x: number) => padL + ((x - lo) / (hi - lo)) * plotW;

  const i0 = Math.ceil(lo / tickStep - 1e-9);
  const i1 = Math.floor(hi / tickStep + 1e-9);
  const ticks: number[] = [];
  for (let i = i0; i <= i1; i++) ticks.push(i * tickStep);

  // the block
  const bx = sx(snap.x);
  const blockW = 40;
  const blockH = 24;
  const blockTop = groundY - blockH;

  // force arrows (px, capped; ~zero values hide)
  const ARROW_MIN = 0.05;
  const FORCE_PX_PER_N = 1.4;
  const fLen = Math.min(96, snap.applied * FORCE_PX_PER_N);
  const frLen = Math.min(96, snap.friction * FORCE_PX_PER_N);
  const showF = snap.applied >= ARROW_MIN;
  const showFr = snap.friction >= ARROW_MIN;
  const midY = groundY - blockH / 2;
  const frY = groundY - 6;

  const N = params.mass * 9.8;
  const nLen = Math.min(70, N * 0.9);
  const mgLen = Math.min(70, N * 0.9);

  // ground hatch marks
  const hatch: Array<[number, number]> = [];
  for (let hx = padL - 12; hx <= W - padR + 12; hx += 14) {
    hatch.push([hx, hx + 7]);
  }

  return (
    <svg
      className={classes.stageSvg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Block on flat ground with applied force and friction arrows"
    >
      <defs>
        <marker id="forceHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-force)" />
        </marker>
        <marker id="frictionHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-friction)" />
        </marker>
        <marker id="structHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-structural)" />
        </marker>
        <marker id="weightHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--ink-soft)" />
        </marker>
      </defs>

      {/* ground + hatch + distance ticks */}
      <line className={classes.ground} x1={padL - 12} y1={groundY} x2={W - padR + 12} y2={groundY} />
      {hatch.map(([x1, x2]) => (
        <line key={x1} className={classes.hatch} x1={x1} y1={groundY} x2={x2} y2={groundY + 6} />
      ))}
      {ticks.map((x) => (
        <g key={x}>
          <line className={classes.tick} x1={sx(x)} y1={groundY} x2={sx(x)} y2={groundY + 5} />
          <text className={classes.tickLabel} x={sx(x)} y={groundY + 16} textAnchor="middle">
            {Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(1)}
          </text>
        </g>
      ))}
      <text className={classes.axisCaption} x={W - padR} y={groundY + 28} textAnchor="end">
        x (m)
      </text>

      {/* origin */}
      <circle className={classes.originDot} cx={sx(0)} cy={groundY} r={3.4} />

      {/* the block */}
      <rect className={classes.block} x={bx - blockW / 2} y={blockTop} width={blockW} height={blockH} rx={3} />

      {/* normal force N (up, thin structural) */}
      <line
        className={classes.structArrow}
        x1={bx}
        y1={blockTop}
        x2={bx}
        y2={blockTop - nLen}
        markerEnd="url(#structHead)"
      />
      <text className={`${classes.mathLabel} ${classes.structLabel}`} x={bx + 6} y={blockTop - nLen + 4}>
        N
      </text>

      {/* weight mg (down, thin ink) */}
      <line
        className={classes.weightArrow}
        x1={bx}
        y1={blockTop + blockH / 2}
        x2={bx}
        y2={blockTop + blockH / 2 + mgLen}
        markerEnd="url(#weightHead)"
      />
      <text className={`${classes.mathLabel} ${classes.weightLabel}`} x={bx + 6} y={blockTop + blockH / 2 + mgLen}>
        mg
      </text>

      {/* applied force F (red, pushing right) */}
      {showF ? (
        <>
          <line
            className={classes.forceArrow}
            x1={bx}
            y1={midY}
            x2={bx + fLen}
            y2={midY}
            markerEnd="url(#forceHead)"
          />
          <text className={`${classes.mathLabel} ${classes.forceLabel}`} x={bx + fLen + 6} y={midY + 5}>
            F = {snap.applied.toFixed(1)} N
          </text>
        </>
      ) : null}

      {/* friction f (purple, opposing — pointing left) */}
      {showFr ? (
        <>
          <line
            className={classes.frictionArrow}
            x1={bx}
            y1={frY}
            x2={bx - frLen}
            y2={frY}
            markerEnd="url(#frictionHead)"
          />
          <text className={`${classes.mathLabel} ${classes.frictionLabel}`} x={bx - frLen - 6} y={frY + 4} textAnchor="end">
            f = {snap.friction.toFixed(1)} N
          </text>
        </>
      ) : null}

      {/* settings chip (top-left) */}
      <rect className={classes.stageChip} x={padL} y={8} width={230} height={22} rx={7} />
      <text className={classes.stageChipText} x={padL + 10} y={23}>
        m = {params.mass.toFixed(1)} kg · μs = {params.muS.toFixed(2)} · μk = {params.muK.toFixed(2)}
      </text>
    </svg>
  );
}

/* ── the incline stage: block on a ramp, angle of repose marker ── */

function InclineStage({
  params,
  snap,
}: {
  params: FrictionParams;
  snap: Snapshot;
}) {
  const W = 600;
  const H = 330;
  const theta = (params.inclineAngleDeg * Math.PI) / 180;
  const reposeRad = Math.atan(params.muS);

  // ramp geometry: base pivot bottom-right, slope rising to the left
  const L = 330; // ramp length [px] — the full TRACK_LEN of 12 m
  const scale = L / 12; // px per metre along the slope
  const Px = W - 90;
  const Py = 280;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const topX = Px - L * c;
  const topY = Py - L * s;

  // block position: x metres down-slope from the top
  const dPx = snap.x * scale;
  const bx = topX + dPx * c;
  const by = topY + dPx * s;

  // screen-space directions
  const uSlope = { x: c, y: s }; // down-slope (screen y is down)
  const nOut = { x: s, y: -c }; // outward normal (away from the ramp)

  const blockW = 34;
  const blockH = 20;
  const cx = bx - (blockH / 2) * nOut.x;
  const cy = by - (blockH / 2) * nOut.y;

  // forces [N] → px
  const PX_PER_N = 1.1;
  const capLen = (f: number) => Math.min(80, f * PX_PER_N);
  const mg = params.mass * 9.8;
  const mgAlong = mg * Math.sin(theta); // down-slope component
  const mgInto = mg * Math.cos(theta); // into-surface component
  const N = mg * Math.cos(theta);

  const ARROW_MIN = 0.05;
  const showFr = snap.friction >= ARROW_MIN;

  // θ arc at the base: from the ground (pointing left) up to the hypotenuse
  const arcR = 34;
  const arc = describeArc(Px, Py, arcR, Math.PI, Math.PI - theta);

  // angle-of-repose marker ray from the base pivot
  const reposeLen = L * 0.55;
  const reposeX2 = Px - reposeLen * Math.cos(reposeRad);
  const reposeY2 = Py - reposeLen * Math.sin(reposeRad);

  return (
    <svg
      className={classes.stageSvg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Block on a ramp with weight, normal and friction arrows"
    >
      <defs>
        <marker id="iForceHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-friction)" />
        </marker>
        <marker id="iStructHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-structural)" />
        </marker>
        <marker id="iWeightHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--ink-soft)" />
        </marker>
        <marker id="iCompHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--ink-soft)" />
        </marker>
      </defs>

      {/* the ramp triangle: hypotenuse top→base, ground, vertical back */}
      <polygon
        className={classes.ramp}
        points={`${topX},${topY} ${Px},${Py} ${topX},${Py}`}
      />

      {/* ground line under the base */}
      <line className={classes.ground} x1={topX - 24} y1={Py} x2={Px + 24} y2={Py} />

      {/* θ arc + label at the base */}
      <path className={classes.angleArc} d={arc} />
      <text
        className={classes.angleLabel}
        x={Px - arcR - 22}
        y={Py - 10}
        textAnchor="end"
      >
        θ = {params.inclineAngleDeg.toFixed(1)}°
      </text>

      {/* dashed vertical + label at the base corner */}
      <line className={classes.reposeRay} x1={Px} y1={Py} x2={Px} y2={Py - 46} opacity={0} />

      {/* angle-of-repose marker ray */}
      <line
        className={classes.reposeRay}
        x1={Px}
        y1={Py}
        x2={reposeX2}
        y2={reposeY2}
      />
      <text
        className={classes.reposeLabel}
        x={reposeX2 - 8}
        y={reposeY2 - 6}
        textAnchor="end"
      >
        repose: atan μs ≈ {(reposeRad * 180 / Math.PI).toFixed(1)}°
      </text>

      {/* the block (rotated to sit on the slope) */}
      <g transform={`translate(${cx} ${cy}) rotate(${(-params.inclineAngleDeg).toFixed(2)})`}>
        <rect className={classes.block} x={-blockW / 2} y={-blockH / 2} width={blockW} height={blockH} rx={3} />
      </g>

      {/* weight mg (down, thin ink) */}
      <line
        className={classes.weightArrow}
        x1={bx}
        y1={by}
        x2={bx}
        y2={by + capLen(mg)}
        markerEnd="url(#iWeightHead)"
      />
      <text className={`${classes.mathLabel} ${classes.weightLabel}`} x={bx + 6} y={by + capLen(mg) + 4}>
        mg
      </text>

      {/* weight components (thin dashed): mg sin θ down-slope, mg cos θ into the slope */}
      <line
        className={classes.componentArrow}
        x1={bx}
        y1={by}
        x2={bx + capLen(mgAlong) * uSlope.x}
        y2={by + capLen(mgAlong) * uSlope.y}
        markerEnd="url(#iCompHead)"
      />
      <text
        className={`${classes.mathLabel} ${classes.weightLabel}`}
        x={bx + capLen(mgAlong) * uSlope.x + 4}
        y={by + capLen(mgAlong) * uSlope.y + 10}
      >
        mg·sinθ
      </text>
      <line
        className={classes.componentArrow}
        x1={bx}
        y1={by}
        x2={bx - capLen(mgInto) * nOut.x}
        y2={by - capLen(mgInto) * nOut.y}
        markerEnd="url(#iCompHead)"
      />
      <text
        className={`${classes.mathLabel} ${classes.weightLabel}`}
        x={bx - capLen(mgInto) * nOut.x - 4}
        y={by - capLen(mgInto) * nOut.y - 4}
        textAnchor="end"
      >
        mg·cosθ
      </text>

      {/* normal force N (perpendicular out of the surface) */}
      <line
        className={classes.structArrow}
        x1={bx}
        y1={by}
        x2={bx + capLen(N) * nOut.x}
        y2={by + capLen(N) * nOut.y}
        markerEnd="url(#iStructHead)"
      />
      <text
        className={`${classes.mathLabel} ${classes.structLabel}`}
        x={bx + capLen(N) * nOut.x + 5}
        y={by + capLen(N) * nOut.y - 2}
      >
        N
      </text>

      {/* friction f (along the slope, opposing motion/rest — up-slope) */}
      {showFr ? (
        <>
          <line
            className={classes.frictionArrow}
            x1={bx}
            y1={by}
            x2={bx - capLen(snap.friction) * uSlope.x}
            y2={by - capLen(snap.friction) * uSlope.y}
            markerEnd="url(#iForceHead)"
          />
          <text
            className={`${classes.mathLabel} ${classes.frictionLabel}`}
            x={bx - capLen(snap.friction) * uSlope.x - 6}
            y={by - capLen(snap.friction) * uSlope.y - 8}
            textAnchor="end"
          >
            f = {snap.friction.toFixed(1)} N
          </text>
        </>
      ) : null}

      {/* settings chip (top-left) */}
      <rect className={classes.stageChip} x={24} y={8} width={250} height={22} rx={7} />
      <text className={classes.stageChipText} x={34} y={23}>
        m = {params.mass.toFixed(1)} kg · μs = {params.muS.toFixed(2)} · μk = {params.muK.toFixed(2)} · θ = {params.inclineAngleDeg.toFixed(1)}°
      </text>
    </svg>
  );
}

/** SVG arc path from angle a0 to a1 [rad] around (cx, cy), screen coords. */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy - r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy - r * Math.sin(a1);
  const largeArc = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** nice tick step: 1/2/5 × 10^k */
function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
}
