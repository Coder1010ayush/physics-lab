import { useCallback, useEffect, useRef, useState } from 'react';
import SimShell from '../ui/SimShell';
import Slider from '../ui/Slider';
import ReadoutGroup from '../ui/ReadoutGroup';
import GraphPanel from '../ui/GraphPanel';
import FormulaBar from '../ui/FormulaBar';
import { FixedStepClock } from '../engine/integrator.js';
import {
  ProjectileSim,
  idealPredictions,
  type ProjectileParams,
  type ProjectilePhase,
} from '../sims/projectile.js';
import classes from './ProjectilePage.module.css';

const PUBLISH_HZ = 30;

interface Snapshot {
  phase: ProjectilePhase;
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  trail: Array<[number, number]>;
  range: number;
  maxHeight: number;
  flightTime: number;
  heightSeries: Array<[number, number]>;
  vxSeries: Array<[number, number]>;
  vySeries: Array<[number, number]>;
}

const EMPTY_SNAPSHOT: Snapshot = {
  phase: 'aim',
  t: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  speed: 0,
  trail: [],
  range: 0,
  maxHeight: 0,
  flightTime: 0,
  heightSeries: [],
  vxSeries: [],
  vySeries: [],
};

const GRAVITIES = [
  { label: 'Earth', value: 9.8 },
  { label: 'Moon', value: 1.62 },
];

export default function ProjectilePage() {
  const [params, setParams] = useState<ProjectileParams>({
    v0: 20,
    angleDeg: 45,
    k: 0,
    g: 9.8,
  });
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);

  const [sim] = useState(() => new ProjectileSim(params));
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

  const publish = useCallback((sim: ProjectileSim) => {
    const s = sim.getState();
    setSnap({
      phase: s.phase,
      t: s.t,
      x: s.x,
      y: s.y,
      vx: s.vx,
      vy: s.vy,
      speed: Math.hypot(s.vx, s.vy),
      trail: s.trail,
      range: s.range,
      maxHeight: s.maxHeight,
      flightTime: s.flightTime,
      heightSeries: sim.samples.height.slice(),
      vxSeries: sim.samples.vx.slice(),
      vySeries: sim.samples.vy.slice(),
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

      if (runningRef.current && sim.getPhase() === 'flying') {
        const steps = clock.advance(dt * speedRef.current);
        for (const stepDt of steps) sim.step(stepDt);
        if (sim.getPhase() === 'landed') {
          setRun(false); // auto-pause on landing
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

  const updateParam = (patch: Partial<ProjectileParams>) => {
    const next = { ...paramsRef.current, ...patch };
    paramsRef.current = next;
    setParams(next);
    sim.update(next); // re-aims with the new launch settings
    clock.reset();
    setRun(false);
    publish(sim);
  };

  const handleToggleRun = () => {
    if (sim.getPhase() === 'aim') {
      sim.launch();
      clock.reset();
      setRun(true);
    } else if (sim.getPhase() === 'flying') {
      setRun(!runningRef.current);
    } else {
      // landed → replay the same launch
      sim.resetToAim();
      sim.launch();
      clock.reset();
      setRun(true);
    }
    publish(sim);
  };

  const handleReset = () => {
    sim.resetToAim();
    clock.reset();
    setRun(false);
    publish(sim);
  };

  const pred = idealPredictions(params);
  const dragNote = params.k > 0 ? ' (no drag)' : '';
  const gName = params.g === 1.62 ? 'Moon' : 'Earth';

  return (
    <SimShell
      title="Projectile Motion"
      subtitle="2D motion in action — set the launch, watch the velocity split into vx and vy, and compare the ideal path against air drag."
      badge="2D Motion"
      running={running}
      onToggleRun={handleToggleRun}
      onReset={handleReset}
      speed={speed}
      onSpeedChange={setSpeed}
      time={snap.t}
      stage={<ProjectileStage params={params} snap={snap} gName={gName} />}
      controls={
        <>
          <Slider
            label="Launch speed v₀"
            value={params.v0}
            onChange={(v) => updateParam({ v0: v })}
            min={1}
            max={50}
            step={0.5}
            unit="m/s"
            precision={1}
          />
          <Slider
            label="Launch angle θ"
            value={params.angleDeg}
            onChange={(v) => updateParam({ angleDeg: v })}
            min={5}
            max={85}
            step={1}
            unit="°"
            precision={0}
            color="var(--ultramarine)"
          />
          <Slider
            label="Air drag k"
            value={params.k}
            onChange={(v) => updateParam({ k: v })}
            min={0}
            max={0.05}
            step={0.002}
            unit="kg/m"
            precision={3}
            color="var(--vec-friction)"
            hint="k = 0 → ideal path, no air resistance"
          />
          <div className={classes.gravityRow}>
            <span className="caption">Gravity</span>
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
              { label: 'x', value: snap.x, unit: 'm', precision: 1 },
              { label: 'y', value: snap.y, unit: 'm', precision: 1 },
              {
                label: 'speed',
                value: snap.speed,
                unit: 'm/s',
                color: 'var(--vec-velocity)',
                precision: 1,
              },
            ]}
          />
          <ReadoutGroup
            items={[
              {
                label: 'range R',
                value: snap.phase === 'landed' ? snap.range : '—',
                unit: 'm',
                color: 'var(--ultramarine)',
                precision: 1,
              },
              { label: 'max height H', value: snap.maxHeight, unit: 'm', precision: 1 },
              {
                label: 'flight time T',
                value: snap.phase === 'landed' ? snap.flightTime : snap.t,
                unit: 's',
                precision: 2,
              },
            ]}
          />
        </>
      }
      graphs={
        <>
          <GraphPanel
            title="Height vs time"
            series={[{ label: 'y (m)', color: 'var(--ink)', data: snap.heightSeries }]}
            xLabel="t (s)"
            yLabel="y (m)"
          />
          <GraphPanel
            title="Velocity components"
            series={[
              { label: 'vx (m/s)', color: 'var(--vec-velocity)', data: snap.vxSeries },
              { label: 'vy (m/s)', color: 'var(--vec-friction)', data: snap.vySeries },
            ]}
            xLabel="t (s)"
            yLabel="v (m/s)"
          />
        </>
      }
      formulas={
        <FormulaBar
          items={[
            {
              label: `Range${dragNote}`,
              formula: 'R = v₀²·sin 2θ / g',
              substitution: `= ${params.v0.toFixed(1)}² × sin(2 × ${params.angleDeg}°) / ${params.g}`,
              result: pred.range.toFixed(1),
              unit: 'm',
            },
            {
              label: `Max height${dragNote}`,
              formula: 'H = v₀²·sin²θ / 2g',
              substitution: `= ${params.v0.toFixed(1)}² × sin²(${params.angleDeg}°) / ${2 * params.g}`,
              result: pred.height.toFixed(1),
              unit: 'm',
            },
            {
              label: `Flight time${dragNote}`,
              formula: 'T = 2v₀·sin θ / g',
              substitution: `= 2 × ${params.v0.toFixed(1)} × sin(${params.angleDeg}°) / ${params.g}`,
              result: pred.time.toFixed(2),
              unit: 's',
            },
          ]}
        />
      }
    />
  );
}

/* ── the stage: launch, trajectory, components, landing ── */

function ProjectileStage({
  params,
  snap,
  gName,
}: {
  params: ProjectileParams;
  snap: Snapshot;
  gName: string;
}) {
  const W = 600;
  const H = 360;
  const padL = 18;
  const padR = 18;
  const padT = 34;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const pred = idealPredictions(params);
  const th = (params.angleDeg * Math.PI) / 180;

  // auto-zoom: fit the predicted/actual trajectory comfortably
  const worldW = Math.max(pred.range, snap.range) * 1.08;
  const worldH = Math.max(pred.height, snap.maxHeight, 0.5) * 1.35;
  const scale = Math.min(plotW / worldW, plotH / worldH);
  const groundY = padT + plotH;
  const sx = (x: number) => padL + x * scale;
  const sy = (y: number) => groundY - y * scale;

  const vx0 = params.v0 * Math.cos(th);
  const vy0 = params.v0 * Math.sin(th);

  // ideal (no-drag) ghost path, sampled from the closed form
  const ghostPts: string[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = (pred.time * i) / N;
    const x = vx0 * t;
    const y = vy0 * t - 0.5 * params.g * t * t;
    ghostPts.push(`${sx(x).toFixed(1)},${sy(y).toFixed(1)}`);
  }

  // measured trail
  const trailPts = snap.trail.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ');

  // ground distance ticks
  const tickStep = niceStep(worldW / 5);
  const ticks: number[] = [];
  for (let x = tickStep; x <= worldW; x += tickStep) ticks.push(x);

  const showGhost = params.k > 0 || snap.phase === 'aim';
  const ballX = sx(snap.x);
  const ballY = sy(snap.y);

  // velocity arrow geometry (px, capped)
  const vScale = 1.7;
  const vLen = Math.min(100, snap.speed * vScale);
  const vAng = Math.atan2(snap.vy, snap.vx);
  const vEndX = ballX + Math.cos(vAng) * vLen;
  const vEndY = ballY - Math.sin(vAng) * vLen;
  const compLen = Math.min(85, Math.abs(snap.vx) * vScale);
  const compLenY = Math.min(85, Math.abs(snap.vy) * vScale);

  // aim arrow geometry
  const aimLen = Math.min(100, params.v0 * vScale);
  const aimEndX = padL + Math.cos(th) * aimLen;
  const aimEndY = groundY - Math.sin(th) * aimLen;

  const landingNearEdge = snap.phase === 'landed' && sx(snap.range) > W - 80;

  return (
    <svg
      className={classes.stageSvg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Projectile trajectory with velocity components"
    >
      <defs>
        <marker id="velHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-velocity)" />
        </marker>
        <marker id="aimHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--ultramarine)" />
        </marker>
      </defs>

      {/* ground + distance ticks */}
      <line className={classes.ground} x1={padL - 10} y1={groundY} x2={W - padR + 10} y2={groundY} />
      {ticks.map((x) => (
        <g key={x}>
          <line className={classes.tick} x1={sx(x)} y1={groundY} x2={sx(x)} y2={groundY + 5} />
          <text className={classes.tickLabel} x={sx(x)} y={groundY + 16} textAnchor="middle">
            {x >= 10 ? x.toFixed(0) : x.toFixed(1)}
          </text>
        </g>
      ))}
      <text className={classes.axisCaption} x={W - padR} y={groundY + 27} textAnchor="end">
        x (m)
      </text>

      {/* ideal ghost path */}
      {showGhost ? (
        <polyline className={classes.ghost} points={ghostPts.join(' ')} />
      ) : null}

      {/* measured trail */}
      {snap.trail.length > 1 ? (
        <polyline className={classes.trail} points={trailPts} />
      ) : null}

      {/* origin */}
      <circle className={classes.originDot} cx={padL} cy={groundY} r={3.4} />

      {/* aim state: launch vector + angle arc */}
      {snap.phase === 'aim' ? (
        <>
          <line
            className={classes.aimArrow}
            x1={padL}
            y1={groundY}
            x2={aimEndX}
            y2={aimEndY}
            markerEnd="url(#aimHead)"
          />
          <path
            className={classes.arc}
            d={`M ${padL + 24} ${groundY} A 24 24 0 0 0 ${(padL + 24 * Math.cos(th)).toFixed(1)} ${(groundY - 24 * Math.sin(th)).toFixed(1)}`}
          />
          <text
            className={classes.mathLabel}
            x={padL + 34 * Math.cos(th / 2)}
            y={groundY - 34 * Math.sin(th / 2) - 2}
            textAnchor="middle"
          >
            θ
          </text>
          <text className={classes.velLabel} x={aimEndX + 8} y={aimEndY - 4}>
            v₀ = {params.v0.toFixed(1)} m/s
          </text>
        </>
      ) : (
        <>
          {/* projectile + velocity vector + components */}
          <circle className={classes.ball} cx={ballX} cy={ballY} r={6} />
          {snap.phase === 'flying' && snap.speed > 0.5 ? (
            <>
              <line className={classes.velArrow} x1={ballX} y1={ballY} x2={vEndX} y2={vEndY} markerEnd="url(#velHead)" />
              <line
                className={classes.compArrow}
                x1={ballX}
                y1={ballY}
                x2={ballX + (snap.vx >= 0 ? compLen : -compLen)}
                y2={ballY}
                markerEnd="url(#velHead)"
              />
              <line
                className={classes.compArrow}
                x1={ballX}
                y1={ballY}
                x2={ballX}
                y2={ballY + (snap.vy >= 0 ? -compLenY : compLenY)}
                markerEnd="url(#velHead)"
              />
              <text className={`${classes.mathLabel} ${classes.velLabel}`} x={vEndX + 6} y={vEndY - 6}>
                v
              </text>
              <text className={`${classes.mathLabel} ${classes.velLabel}`} x={ballX + (snap.vx >= 0 ? compLen + 6 : -compLen - 6)} y={ballY + 4} textAnchor={snap.vx >= 0 ? 'start' : 'end'}>
                vx
              </text>
              <text className={`${classes.mathLabel} ${classes.velLabel}`} x={ballX + 6} y={ballY + (snap.vy >= 0 ? -compLenY - 8 : compLenY + 14)}>
                vy
              </text>
            </>
          ) : null}
        </>
      )}

      {/* landing marker */}
      {snap.phase === 'landed' ? (
        <>
          <line className={classes.landingTick} x1={sx(snap.range)} y1={groundY} x2={sx(snap.range)} y2={groundY - 12} />
          <text
            className={classes.rangeLabel}
            x={landingNearEdge ? sx(snap.range) - 8 : sx(snap.range)}
            y={groundY - 16}
            textAnchor={landingNearEdge ? 'end' : 'middle'}
          >
            R = {snap.range.toFixed(1)} m
          </text>
        </>
      ) : null}

      {/* gravity chip (top-left) */}
      <rect className={classes.stageChip} x={padL} y={8} width={128} height={22} rx={7} />
      <text className={classes.stageChipText} x={padL + 10} y={23}>
        {gName} · g = {params.g} m/s²
      </text>

      {/* ghost legend (top-right) when comparing with drag */}
      {params.k > 0 ? (
        <>
          <rect className={classes.stageChip} x={W - 168} y={8} width={150} height={22} rx={7} />
          <line className={classes.legendDash} x1={W - 158} y1={19} x2={W - 138} y2={19} />
          <text className={classes.stageChipText} x={W - 132} y={23}>
            ideal path (no drag)
          </text>
        </>
      ) : null}
    </svg>
  );
}

/** nice tick step: 1/2/5 × 10^k */
function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
}
