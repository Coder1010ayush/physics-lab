import { useCallback, useEffect, useRef, useState } from 'react';
import SimShell from '../ui/SimShell';
import Slider from '../ui/Slider';
import ReadoutGroup from '../ui/ReadoutGroup';
import GraphPanel from '../ui/GraphPanel';
import FormulaBar from '../ui/FormulaBar';
import { FixedStepClock } from '../engine/integrator.js';
import {
  KinematicsSim,
  type KinematicsParams,
  type KinematicsPhase,
  type KinematicsTurningPoint,
} from '../sims/kinematics.js';
import classes from './KinematicsPage.module.css';

const PUBLISH_HZ = 30;

interface Snapshot {
  phase: KinematicsPhase;
  t: number;
  x: number;
  v: number;
  travelled: number;
  maxSpeed: number;
  xSeries: Array<[number, number]>;
  vSeries: Array<[number, number]>;
  turningPoints: KinematicsTurningPoint[];
}

const EMPTY_SNAPSHOT: Snapshot = {
  phase: 'ready',
  t: 0,
  x: 0,
  v: 0,
  travelled: 0,
  maxSpeed: 0,
  xSeries: [],
  vSeries: [],
  turningPoints: [],
};

export default function KinematicsPage() {
  const [params, setParams] = useState<KinematicsParams>({ u: 3, a: 1.5 });
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);

  const [sim] = useState(() => new KinematicsSim(params));
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

  const publish = useCallback((sim: KinematicsSim) => {
    const s = sim.getSnapshot();
    setSnap({
      phase: s.phase,
      t: s.t,
      x: s.x,
      v: s.v,
      travelled: s.travelled,
      maxSpeed: s.maxSpeed,
      xSeries: s.xSamples,
      vSeries: s.vSamples,
      turningPoints: s.turningPoints,
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

  const updateParam = (patch: Partial<KinematicsParams>) => {
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

  const lastTurn =
    snap.turningPoints.length > 0
      ? snap.turningPoints[snap.turningPoints.length - 1]
      : null;

  return (
    <SimShell
      title="Kinematics — Equations of Motion"
      subtitle="Set u and a, watch the car ride the track, and read position and velocity straight off the live graphs — braking to a stop marks the turning point where v = 0."
      badge="1D Motion"
      running={running}
      onToggleRun={handleToggleRun}
      onReset={handleReset}
      speed={speed}
      onSpeedChange={setSpeed}
      time={snap.t}
      stage={<KinematicsStage params={params} snap={snap} />}
      controls={
        <>
          <Slider
            label="Initial speed u"
            value={params.u}
            onChange={(v) => updateParam({ u: v })}
            min={0}
            max={30}
            step={0.5}
            unit="m/s"
            precision={1}
            hint="the speed the car starts with"
          />
          <Slider
            label="Acceleration a"
            value={params.a}
            onChange={(v) => updateParam({ a: v })}
            min={-5}
            max={5}
            step={0.1}
            unit="m/s²"
            precision={1}
            color="var(--vec-acceleration)"
            hint="a < 0 brakes the car — it turns around when v crosses 0"
          />
          <ReadoutGroup
            items={[
              { label: 'time', value: snap.t, unit: 's', precision: 2 },
              { label: 'position x', value: snap.x, unit: 'm', precision: 1 },
              {
                label: 'velocity v',
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
                label: 'max |v|',
                value: snap.maxSpeed,
                unit: 'm/s',
                color: 'var(--vec-velocity)',
                precision: 1,
              },
              { label: 'travelled', value: snap.travelled, unit: 'm', precision: 1 },
              {
                label: 'turning point',
                value: lastTurn ? `At rest: t = ${lastTurn.t.toFixed(2)}` : '—',
                unit: lastTurn ? 's' : undefined,
              },
            ]}
          />
        </>
      }
      graphs={
        <>
          <GraphPanel
            title="Position vs time"
            series={[{ label: 'x (m)', color: 'var(--ultramarine)', data: snap.xSeries }]}
            xLabel="t (s)"
            yLabel="x (m)"
          />
          <GraphPanel
            title="Velocity vs time"
            series={[{ label: 'v (m/s)', color: 'var(--vec-velocity)', data: snap.vSeries }]}
            xLabel="t (s)"
            yLabel="v (m/s)"
          />
        </>
      }
      formulas={
        <FormulaBar
          items={[
            {
              label: 'Velocity',
              formula: 'v = u + at',
              substitution: `= ${params.u.toFixed(2)} + ${params.a.toFixed(2)} × ${snap.t.toFixed(2)}`,
              result: snap.v.toFixed(2),
              unit: 'm/s',
            },
            {
              label: 'Displacement',
              formula: 's = ut + ½at²',
              substitution: `= ${params.u.toFixed(2)} × ${snap.t.toFixed(2)} + 0.5 × ${params.a.toFixed(2)} × ${snap.t.toFixed(2)}²`,
              result: snap.x.toFixed(2),
              unit: 'm',
            },
            {
              label: 'No-time equation',
              formula: 'v² = u² + 2as',
              substitution: `= ${params.u.toFixed(2)}² + 2 × ${params.a.toFixed(2)} × ${snap.x.toFixed(2)}`,
              result: (snap.v * snap.v).toFixed(2),
              unit: 'm²/s²',
            },
          ]}
        />
      }
    />
  );
}

/* ── the stage: track, car, velocity & acceleration arrows ── */

function KinematicsStage({
  params,
  snap,
}: {
  params: KinematicsParams;
  snap: Snapshot;
}) {
  const W = 600;
  const H = 330;
  const padL = 30;
  const padR = 30;
  const groundY = 220;
  const plotW = W - padL - padR;

  // auto-zoom: fit everything seen so far (origin, car, turning points)
  let lo = Math.min(0, snap.x);
  let hi = Math.max(0, snap.x);
  for (const tp of snap.turningPoints) {
    lo = Math.min(lo, tp.x);
    hi = Math.max(hi, tp.x);
  }
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
  // round outward to a nice step (1/2/5 × 10^k) so the view jumps cleanly
  const tickStep = niceStep((hi - lo) / 5);
  lo = Math.floor(lo / tickStep) * tickStep;
  hi = Math.ceil(hi / tickStep) * tickStep;

  const sx = (x: number) => padL + ((x - lo) / (hi - lo)) * plotW;

  // distance ticks (index-based: no floating-point drift along the loop)
  const i0 = Math.ceil(lo / tickStep - 1e-9);
  const i1 = Math.floor(hi / tickStep + 1e-9);
  const ticks: number[] = [];
  for (let i = i0; i <= i1; i++) ticks.push(i * tickStep);

  // the car
  const carX = sx(snap.x);
  const bodyW = 36;
  const bodyH = 15;
  const wheelR = 4.5;
  const bodyY = groundY - wheelR - bodyH;

  // arrow geometry (px, capped; ~zero values hide)
  const ARROW_MIN = 0.05;
  const vLen = Math.min(96, Math.abs(snap.v) * 5);
  const aLen = Math.min(80, Math.abs(params.a) * 13);
  const showV = Math.abs(snap.v) >= ARROW_MIN;
  const showA = Math.abs(params.a) >= ARROW_MIN;
  const velY = groundY - 52;
  const accY = groundY + 34;

  const turn =
    snap.turningPoints.length > 0
      ? snap.turningPoints[snap.turningPoints.length - 1]
      : null;

  return (
    <svg
      className={classes.stageSvg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Car on a straight track with velocity and acceleration arrows"
    >
      <defs>
        <marker id="velHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-velocity)" />
        </marker>
        <marker id="accHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-acceleration)" />
        </marker>
      </defs>

      {/* ground + distance ticks */}
      <line className={classes.ground} x1={padL - 12} y1={groundY} x2={W - padR + 12} y2={groundY} />
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

      {/* turning point: the rest moment (v = 0) */}
      {turn ? (
        <>
          <line className={classes.turnLine} x1={sx(turn.x)} y1={groundY - 64} x2={sx(turn.x)} y2={groundY} />
          <text className={classes.turnLabel} x={sx(turn.x)} y={groundY - 70} textAnchor="middle">
            v = 0
          </text>
        </>
      ) : null}

      {/* the car */}
      <rect className={classes.carBody} x={carX - bodyW / 2} y={bodyY} width={bodyW} height={bodyH} rx={5} />
      <circle className={classes.carWheel} cx={carX - 11} cy={groundY - wheelR} r={wheelR} />
      <circle className={classes.carWheel} cx={carX + 11} cy={groundY - wheelR} r={wheelR} />

      {/* velocity arrow (above the car) */}
      {showV ? (
        <>
          <line
            className={classes.velArrow}
            x1={carX}
            y1={velY}
            x2={carX + (snap.v >= 0 ? vLen : -vLen)}
            y2={velY}
            markerEnd="url(#velHead)"
          />
          <text
            className={`${classes.mathLabel} ${classes.velLabel}`}
            x={carX + (snap.v >= 0 ? vLen + 6 : -vLen - 6)}
            y={velY + 4}
            textAnchor={snap.v >= 0 ? 'start' : 'end'}
          >
            v
          </text>
        </>
      ) : null}

      {/* acceleration arrow (below the car) */}
      {showA ? (
        <>
          <line
            className={classes.accArrow}
            x1={carX}
            y1={accY}
            x2={carX + (params.a >= 0 ? aLen : -aLen)}
            y2={accY}
            markerEnd="url(#accHead)"
          />
          <text
            className={`${classes.mathLabel} ${classes.accLabel}`}
            x={carX + (params.a >= 0 ? aLen + 6 : -aLen - 6)}
            y={accY + 4}
            textAnchor={params.a >= 0 ? 'start' : 'end'}
          >
            a
          </text>
        </>
      ) : null}

      {/* settings chip (top-left) */}
      <rect className={classes.stageChip} x={padL} y={8} width={186} height={22} rx={7} />
      <text className={classes.stageChipText} x={padL + 10} y={23}>
        u = {params.u.toFixed(1)} m/s · a = {params.a.toFixed(1)} m/s²
      </text>
    </svg>
  );
}

/** nice tick step: 1/2/5 × 10^k */
function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
}
