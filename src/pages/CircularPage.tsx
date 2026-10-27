import { useCallback, useEffect, useRef, useState } from 'react';
import SimShell from '../ui/SimShell';
import Slider from '../ui/Slider';
import ReadoutGroup, { type ReadoutItem } from '../ui/ReadoutGroup';
import GraphPanel from '../ui/GraphPanel';
import FormulaBar, { type FormulaItem } from '../ui/FormulaBar';
import { FixedStepClock } from '../engine/integrator.js';
import {
  ucmSpeed,
  centripetalAccel,
  centripetalForce,
  period,
  loopSpeedSquared,
  loopNormalForce,
  minTopSpeed,
  minLaunchSpeed,
  bankedOptimumSpeed,
  bankedNormal,
} from '../engine/circular.js';
import {
  CircularSim,
  DEFAULT_CIRCULAR_PARAMS,
  type CircularParams,
  type CircularMode,
  type CircularSnapshot,
  type UniformParams,
  type LoopParams,
  type BankedParams,
} from '../sims/circular.js';
import classes from './CircularPage.module.css';

const PUBLISH_HZ = 30;

interface Snapshot extends CircularSnapshot {
  vxSeries: Array<[number, number]>;
  vySeries: Array<[number, number]>;
  vSeries: Array<[number, number]>;
  nSeries: Array<[number, number]>;
  requiredSeries: Array<[number, number]>;
  availableSeries: Array<[number, number]>;
}

const EMPTY_SNAPSHOT: Snapshot = {
  phase: 'ready',
  t: 0,
  mode: 'uniform',
  status: 'ω = 2.0 rad/s · revolving',
  phi: 0,
  x: 0,
  y: 0,
  v: 0,
  vx: 0,
  vy: 0,
  aC: 0,
  fC: 0,
  revolutions: 0,
  theta: 0,
  height: 0,
  N: 0,
  onTrack: true,
  leave: null,
  angle: 0,
  vOpt: 0,
  required: 0,
  available: 0,
  delta: 0,
  perfect: false,
  vxSamples: [],
  vySamples: [],
  vSamples: [],
  nSamples: [],
  requiredSamples: [],
  availableSamples: [],
  vxSeries: [],
  vySeries: [],
  vSeries: [],
  nSeries: [],
  requiredSeries: [],
  availableSeries: [],
};

const MODES: Array<{ label: string; value: CircularMode }> = [
  { label: 'Ball on a string', value: 'uniform' },
  { label: 'Loop-the-loop', value: 'loop' },
  { label: 'Banked curve', value: 'banked' },
];

const GRAVITIES = [
  { label: 'Earth', value: 9.8 },
  { label: 'Moon', value: 1.62 },
];

export default function CircularPage() {
  const [params, setParams] = useState<CircularParams>({
    ...DEFAULT_CIRCULAR_PARAMS,
  });
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);

  const [sim] = useState(() => new CircularSim(params));
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
    (sim: CircularSim) => {
      const s = sim.getSnapshot();
      setSnap({
        ...s,
        vxSeries: s.vxSamples,
        vySeries: s.vySamples,
        vSeries: s.vSamples,
        nSeries: s.nSamples,
        requiredSeries: s.requiredSamples,
        availableSeries: s.availableSamples,
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

  const updateParam = (patch: Partial<CircularParams>) => {
    const next = { ...paramsRef.current, ...patch };
    paramsRef.current = next;
    setParams(next);
    sim.update(next); // re-arms with the new starting conditions
    clock.reset();
    setRun(false);
    publish(sim);
  };

  const updateUniform = (patch: Partial<UniformParams>) =>
    updateParam({ uniform: { ...paramsRef.current.uniform, ...patch } });
  const updateLoop = (patch: Partial<LoopParams>) =>
    updateParam({ loop: { ...paramsRef.current.loop, ...patch } });
  const updateBanked = (patch: Partial<BankedParams>) =>
    updateParam({ banked: { ...paramsRef.current.banked, ...patch } });

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
  const uniformMode = params.mode === 'uniform';
  const loopMode = params.mode === 'loop';
  const u = params.uniform;
  const lp = params.loop;
  const b = params.banked;
  const vU = ucmSpeed(u.omega, u.r);
  const aCU = centripetalAccel(u.omega, u.r);
  const fCU = centripetalForce(u.m, u.omega, u.r);
  const periodU = period(u.omega);
  const thetaDeg = (snap.theta * 180) / Math.PI;
  const vTopMin = minTopSpeed(lp.r, params.g);
  const v0Min = minLaunchSpeed(lp.r, params.g);
  const loopV2 = loopSpeedSquared(lp.v0, snap.theta, lp.r, params.g);
  const loopN = loopNormalForce(lp.m, loopV2, snap.theta, lp.r, params.g);
  const thetaBankRad = (b.thetaBankDeg * Math.PI) / 180;
  const tanBank = Math.tan(thetaBankRad);
  const vOpt = bankedOptimumSpeed(b.r, params.g, thetaBankRad);

  // readouts, per mode
  const readoutsA: ReadoutItem[] = uniformMode
    ? [
        { label: 'time', value: snap.t, unit: 's', precision: 2 },
        { label: 'revolutions', value: snap.revolutions, precision: 2 },
        { label: 'speed v', value: snap.v, unit: 'm/s', color: 'var(--vec-velocity)', precision: 2 },
        { label: 'accel a_c', value: snap.aC, unit: 'm/s²', color: 'var(--vec-acceleration)', precision: 2 },
      ]
    : loopMode
      ? [
          { label: 'time', value: snap.t, unit: 's', precision: 2 },
          { label: 'angle θ', value: thetaDeg, unit: '°', precision: 1 },
          { label: 'height h', value: snap.height, unit: 'm', precision: 2 },
          { label: 'speed v', value: snap.v, unit: 'm/s', color: 'var(--vec-velocity)', precision: 2 },
        ]
      : [
          { label: 'time', value: snap.t, unit: 's', precision: 2 },
          { label: 'speed v', value: snap.v, unit: 'm/s', color: 'var(--vec-velocity)', precision: 2 },
          { label: 'required F_c', value: snap.required, unit: 'N', color: 'var(--vec-force)', precision: 2 },
          { label: 'available m·g·tanθ', value: snap.available, unit: 'N', color: 'var(--vec-tension)', precision: 2 },
        ];

  const readoutsB: ReadoutItem[] = uniformMode
    ? [
        { label: 'force F_c', value: snap.fC, unit: 'N', color: 'var(--vec-force)', precision: 2 },
        { label: 'period P', value: periodU, unit: 's', precision: 2 },
        { label: 'status', value: snap.status, color: 'var(--vec-tension)' },
      ]
    : loopMode
      ? [
          { label: 'normal N', value: snap.N, unit: 'N', color: 'var(--vec-tension)', precision: 2 },
          { label: 'v_top,min √(gr)', value: vTopMin, unit: 'm/s', precision: 2 },
          { label: 'v₀,min √(5gr)', value: v0Min, unit: 'm/s', precision: 2 },
          { label: 'status', value: snap.status, color: 'var(--vec-tension)' },
        ]
      : [
          { label: 'Δ = req − avail', value: snap.delta, unit: 'N', color: 'var(--vec-friction)', precision: 2 },
          { label: 'v_opt', value: snap.vOpt, unit: 'm/s', color: 'var(--vec-velocity)', precision: 2 },
          { label: 'status', value: snap.status, color: 'var(--vec-tension)' },
        ];

  // formula bar, per mode (live 2-decimal substitutions)
  const formulas: FormulaItem[] = uniformMode
    ? [
        {
          label: 'Speed',
          formula: 'v = ω·r',
          substitution: `= ${u.omega.toFixed(2)} × ${u.r.toFixed(2)}`,
          result: vU.toFixed(2),
          unit: 'm/s',
        },
        {
          label: 'Centripetal',
          formula: 'a_c = v²/r',
          substitution: `= ${vU.toFixed(2)}² / ${u.r.toFixed(2)}`,
          result: aCU.toFixed(2),
          unit: 'm/s²',
        },
        {
          label: 'Force',
          formula: 'F_c = m·a_c',
          substitution: `= ${u.m.toFixed(2)} × ${aCU.toFixed(2)}`,
          result: fCU.toFixed(2),
          unit: 'N',
        },
      ]
    : loopMode
      ? [
          {
            label: 'Energy',
            formula: 'v² = v₀² − 2gh',
            substitution: `= ${lp.v0.toFixed(2)}² − 2 × ${params.g.toFixed(2)} × ${snap.height.toFixed(2)}`,
            result: loopV2.toFixed(2),
            unit: 'm²/s²',
          },
          {
            label: 'Normal',
            formula: 'N = m(v²/r + g·cosθ)',
            substitution: `= ${lp.m.toFixed(2)} × (${loopV2.toFixed(2)} / ${lp.r.toFixed(2)} + ${params.g.toFixed(2)} × cos(${thetaDeg.toFixed(1)}°))`,
            result: loopN.toFixed(2),
            unit: 'N',
          },
        ]
      : [
          {
            label: 'Bank check',
            formula: 'tan θ = v²/(r·g)',
            substitution: `= ${tanBank.toFixed(2)} = ${((b.v * b.v) / (b.r * params.g)).toFixed(2)}`,
            result: snap.perfect ? 'matched' : 'mismatch',
            unit: '',
          },
          {
            label: 'Optimum',
            formula: 'v_opt = √(r·g·tanθ)',
            substitution: `= √(${b.r.toFixed(2)} × ${params.g.toFixed(2)} × ${tanBank.toFixed(2)})`,
            result: vOpt.toFixed(2),
            unit: 'm/s',
          },
        ];

  return (
    <SimShell
      title="Circular Motion — Three Ways to Turn"
      subtitle="A ball on a string, a loop-the-loop and a banked curve: one inward acceleration, three different suppliers. Watch the centripetal demand and see what tension, the track or the road can actually provide."
      badge="CIRCULAR"
      running={running}
      onToggleRun={handleToggleRun}
      onReset={handleReset}
      speed={speed}
      onSpeedChange={setSpeed}
      time={snap.t}
      stage={
        uniformMode ? (
          <UniformStage params={params} snap={snap} />
        ) : loopMode ? (
          <LoopStage params={params} snap={snap} />
        ) : (
          <BankedStage params={params} snap={snap} />
        )
      }
      controls={
        <>
          <div className={classes.modeRow}>
            <span className={classes.modeLabel}>Mode</span>
            <div className={classes.seg} role="group" aria-label="Circular motion mode">
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
          {uniformMode ? (
            <>
              <Slider
                label="Radius r"
                value={u.r}
                onChange={(v) => updateUniform({ r: v })}
                min={0.5}
                max={3}
                step={0.1}
                unit="m"
                precision={1}
                hint="the string's length — v = ω·r, so a bigger circle means a faster ball at the same ω"
              />
              <Slider
                label="Angular speed ω"
                value={u.omega}
                onChange={(v) => updateUniform({ omega: v })}
                min={0.5}
                max={6}
                step={0.1}
                unit="rad/s"
                precision={1}
                hint="faster ω → bigger a_c = ω²r → the string must pull harder"
              />
              <Slider
                label="Mass m"
                value={u.m}
                onChange={(v) => updateUniform({ m: v })}
                min={0.5}
                max={5}
                step={0.1}
                unit="kg"
                precision={1}
                hint="heavier ball → bigger F_c = m·a_c at the same ω and r"
              />
            </>
          ) : loopMode ? (
            <>
              <Slider
                label="Radius r"
                value={lp.r}
                onChange={(v) => updateLoop({ r: v })}
                min={0.5}
                max={2}
                step={0.1}
                unit="m"
                precision={1}
                hint="a bigger loop needs more speed: v₀,min = √(5gr) grows with r"
              />
              <Slider
                label="Launch speed v₀"
                value={lp.v0}
                onChange={(v) => updateLoop({ v0: v })}
                min={0}
                max={15}
                step={0.1}
                unit="m/s"
                precision={1}
                color="var(--vec-velocity)"
                hint="complete the loop needs v₀ ≥ √(5gr); below √(2gr) it rolls back"
              />
              <Slider
                label="Mass m"
                value={lp.m}
                onChange={(v) => updateLoop({ m: v })}
                min={0.5}
                max={5}
                step={0.1}
                unit="kg"
                precision={1}
                hint="mass cancels in the motion — but the track still feels N = m(v²/r + g·cosθ)"
              />
            </>
          ) : (
            <>
              <Slider
                label="Radius r"
                value={b.r}
                onChange={(v) => updateBanked({ r: v })}
                min={10}
                max={100}
                step={1}
                unit="m"
                precision={0}
                hint="wider turn → smaller required force m·v²/r at the same speed"
              />
              <Slider
                label="Bank angle θ"
                value={b.thetaBankDeg}
                onChange={(v) => updateBanked({ thetaBankDeg: v })}
                min={5}
                max={45}
                step={1}
                unit="°"
                precision={0}
                hint="steeper bank supplies more inward force: m·g·tanθ"
              />
              <Slider
                label="Speed v"
                value={b.v}
                onChange={(v) => updateBanked({ v: v })}
                min={0}
                max={30}
                step={0.5}
                unit="m/s"
                precision={1}
                color="var(--vec-velocity)"
                hint="at v_opt = √(r·g·tanθ) the road alone turns the car — no friction needed"
              />
              <Slider
                label="Mass m"
                value={b.m}
                onChange={(v) => updateBanked({ m: v })}
                min={0.5}
                max={5}
                step={0.1}
                unit="kg"
                precision={1}
                hint="both the demand and the supply scale with m — the balance does not"
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
          <ReadoutGroup items={readoutsA} />
          <ReadoutGroup items={readoutsB} />
        </>
      }
      graphs={
        uniformMode ? (
          <GraphPanel
            title="Velocity components vs time"
            series={[
              { label: 'vx (m/s)', color: 'var(--vec-velocity)', data: snap.vxSeries },
              { label: 'vy (m/s)', color: 'var(--vec-velocity)', data: snap.vySeries, dashed: true },
            ]}
            xLabel="t (s)"
            yLabel="v (m/s)"
          />
        ) : loopMode ? (
          <>
            <GraphPanel
              title="Speed vs time"
              series={[{ label: 'v (m/s)', color: 'var(--vec-velocity)', data: snap.vSeries }]}
              xLabel="t (s)"
              yLabel="v (m/s)"
            />
            <GraphPanel
              title="Normal force vs time"
              series={[{ label: 'N (N)', color: 'var(--vec-tension)', data: snap.nSeries }]}
              xLabel="t (s)"
              yLabel="N (N)"
            />
          </>
        ) : (
          <GraphPanel
            title="Required vs available centripetal force"
            series={[
              { label: 'required (N)', color: 'var(--vec-force)', data: snap.requiredSeries },
              { label: 'available (N)', color: 'var(--vec-tension)', data: snap.availableSeries, dashed: true },
            ]}
            xLabel="t (s)"
            yLabel="F (N)"
          />
        )
      }
      formulas={<FormulaBar items={formulas} />}
    />
  );
}

/* ── the uniform stage: ball on a string (plan view), v and F_c arrows ── */

function UniformStage({
  params,
  snap,
}: {
  params: CircularParams;
  snap: Snapshot;
}) {
  const W = 600;
  const H = 330;
  const cx = 300;
  const cy = 168;
  const SCALE = 48; // px per metre (r ≤ 3 m → 144 px radius)
  const u = params.uniform;
  const rPx = u.r * SCALE;
  const bx = cx + snap.x * SCALE;
  const by = cy - snap.y * SCALE;
  const ballR = 8 + 4 * Math.cbrt(u.m);

  // FBD arrow scaling (px, capped) — same convention as the sibling stages
  const PX_PER_N = 1.6;
  const capLen = (f: number) => Math.min(90, f * PX_PER_N);
  const vLen = Math.min(70, 6 * snap.v);
  const fLen = capLen(snap.fC);

  // SVG directions (y is down): tangent (cos φ, sin φ), inward radial (−sin φ, cos φ)
  const c = Math.cos(snap.phi);
  const s = Math.sin(snap.phi);
  const vX = c;
  const vY = s;
  const inX = -s;
  const inY = c;

  // faint traced arc from the top (φ = 0) to the ball — clockwise in SVG space
  const phiMod = snap.phi % (2 * Math.PI);
  const largeArc = phiMod > Math.PI ? 1 : 0;
  const showTrace = phiMod > 0.02;

  // the F_c arrow is drawn beside the string (offset behind the motion)
  const fStartX = bx - vX * 16 + inX * ballR;
  const fStartY = by - vY * 16 + inY * ballR;
  const fEndX = bx - vX * 16 + inX * (ballR + fLen);
  const fEndY = by - vY * 16 + inY * (ballR + fLen);

  // the velocity arrow starts at the ball's edge, along the tangent
  const vStartX = bx + vX * (ballR + 3);
  const vStartY = by + vY * (ballR + 3);
  const vEndX = vStartX + vX * vLen;
  const vEndY = vStartY + vY * vLen;

  return (
    <svg
      className={classes.stageSvg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Ball on a string revolving in a circle with velocity and centripetal force arrows"
    >
      <defs>
        <marker id="uVelocityHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-velocity)" />
        </marker>
        <marker id="uForceHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-force)" />
        </marker>
      </defs>

      {/* the guide circle + the traced path so far */}
      <circle className={classes.dashedCircle} cx={cx} cy={cy} r={rPx} fill="none" />
      {showTrace ? (
        <path
          className={classes.tracedPath}
          fill="none"
          d={`M ${cx} ${cy - rPx} A ${rPx} ${rPx} 0 ${largeArc} 1 ${bx} ${by}`}
        />
      ) : null}

      {/* the pin, the string and the r label */}
      <line className={classes.rope} x1={cx} y1={cy} x2={bx} y2={by} />
      <circle className={classes.pin} cx={cx} cy={cy} r={6} />
      <circle className={classes.pinAxle} cx={cx} cy={cy} r={2} />
      <text className={classes.mathLabel} x={(cx + bx) / 2 + vX * 14} y={(cy + by) / 2 + vY * 14}>
        r
      </text>

      {/* the ball */}
      <circle className={classes.ball} cx={bx} cy={by} r={ballR} />

      {/* velocity (tangent) + centripetal force (radially inward) */}
      <line
        className={classes.velocityArrow}
        x1={vStartX}
        y1={vStartY}
        x2={vEndX}
        y2={vEndY}
        markerEnd="url(#uVelocityHead)"
      />
      <text className={`${classes.mathLabel} ${classes.velocityLabel}`} x={vEndX + vX * 8} y={vEndY + vY * 8 + 4}>
        v
      </text>
      <line
        className={classes.forceArrow}
        x1={fStartX}
        y1={fStartY}
        x2={fEndX}
        y2={fEndY}
        markerEnd="url(#uForceHead)"
      />
      <text className={`${classes.mathLabel} ${classes.forceLabel}`} x={fEndX + inX * 8} y={fEndY + inY * 8 + 4}>
        F_c
      </text>

      {/* settings chip (top-left) */}
      <rect className={classes.stageChip} x={24} y={8} width={330} height={22} rx={7} />
      <text className={classes.stageChipText} x={34} y={23}>
        r = {u.r.toFixed(1)} m · ω = {u.omega.toFixed(1)} rad/s · m = {u.m.toFixed(1)} kg · g = {params.g.toFixed(2)} m/s²
      </text>

      {/* status chip (top-right) */}
      <rect className={classes.stageChip} x={W - 186} y={8} width={170} height={22} rx={7} />
      <text className={classes.statusChipText} x={W - 101} y={23} textAnchor="middle">
        {snap.status}
      </text>
    </svg>
  );
}

/* ── the loop stage: ball inside a vertical loop with N and mg arrows ── */

function LoopStage({
  params,
  snap,
}: {
  params: CircularParams;
  snap: Snapshot;
}) {
  const W = 600;
  const H = 330;
  const groundY = 285;
  const cx = 330;
  const SCALE = 56; // px per metre (r ≤ 2 m → 112 px radius)
  const lp = params.loop;
  const rPx = lp.r * SCALE;
  const cy = groundY - rPx; // loop centre
  const bx = cx + snap.x * SCALE;
  const by = groundY - snap.y * SCALE;
  const ballR = 8 + 4 * Math.cbrt(lp.m);

  const PX_PER_N = 1.4;
  const capLen = (f: number) => Math.min(80, f * PX_PER_N);
  const mg = lp.m * params.g;
  const nLen = capLen(snap.N);
  const wLen = capLen(mg);
  const showN = snap.N >= 0.05;

  // inward radial unit vector (from the ball toward the loop centre)
  const dx = cx - bx;
  const dy = cy - by;
  const dist = Math.hypot(dx, dy) || 1;
  const inX = dx / dist;
  const inY = dy / dist;

  // height ruler: index-based ticks every r/2 from 0 to 2r (guaranteed span)
  const tickStep = lp.r / 2;
  const ticks: number[] = [];
  for (let i = 0; i <= 4; i++) ticks.push(i * tickStep);
  const tickDec = tickStep < 0.3 ? 2 : 1;

  // ground hatch (index-based, like the sibling stages)
  const hatch: Array<[number, number]> = [];
  for (let hx = 60; hx <= 560; hx += 14) hatch.push([hx, hx + 7]);

  // free-fall trajectory after losing contact — analytic parabola from the
  // leave state, sampled from the leave instant to now
  let flightPts = '';
  if (!snap.onTrack && snap.leave) {
    const tau = snap.t - snap.leave.t;
    const pts: string[] = [];
    const SEG = 24;
    for (let i = 0; i <= SEG; i++) {
      const tt = (tau * i) / SEG;
      const px = cx + (snap.leave.x + snap.leave.vx * tt) * SCALE;
      const py =
        groundY -
        (snap.leave.y + snap.leave.vy * tt - 0.5 * params.g * tt * tt) * SCALE;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    flightPts = pts.join(' ');
  }

  return (
    <svg
      className={classes.stageSvg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Ball riding the inside of a vertical loop with normal force and weight arrows"
    >
      <defs>
        <marker id="lTensionHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-tension)" />
        </marker>
        <marker id="lForceHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-force)" />
        </marker>
      </defs>

      {/* ground + hatch */}
      <line className={classes.ground} x1={60} y1={groundY} x2={560} y2={groundY} />
      {hatch.map(([x1, x2]) => (
        <line key={x1} className={classes.hatch} x1={x1} y1={groundY} x2={x2} y2={groundY + 6} />
      ))}

      {/* the loop track ring */}
      <circle className={classes.trackRing} cx={cx} cy={cy} r={rPx} fill="none" />

      {/* free-fall trajectory after losing contact */}
      {flightPts ? (
        <polyline className={classes.freeFallPath} points={flightPts} fill="none" />
      ) : null}

      {/* height ruler (left edge) */}
      {ticks.map((h) => (
        <g key={h}>
          <line className={classes.tick} x1={40} y1={groundY - h * SCALE} x2={48} y2={groundY - h * SCALE} />
          <text className={classes.tickLabel} x={36} y={groundY - h * SCALE + 3} textAnchor="end">
            {h.toFixed(tickDec)}
          </text>
        </g>
      ))}
      <text className={classes.axisCaption} x={40} y={cy - rPx - 10} textAnchor="start">
        height (m)
      </text>

      {/* weight beside the ball */}
      <line
        className={classes.forceArrow}
        x1={bx - ballR - 10}
        y1={by}
        x2={bx - ballR - 10}
        y2={by + wLen}
        markerEnd="url(#lForceHead)"
      />
      <text className={`${classes.mathLabel} ${classes.forceLabel}`} x={bx - ballR - 14} y={by + wLen + 12} textAnchor="end">
        mg
      </text>

      {/* the ball */}
      <circle className={classes.ball} cx={bx} cy={by} r={ballR} />

      {/* normal force — radially inward, hidden once contact is lost */}
      {showN ? (
        <>
          <line
            className={classes.tensionArrow}
            x1={bx + inX * ballR}
            y1={by + inY * ballR}
            x2={bx + inX * (ballR + nLen)}
            y2={by + inY * (ballR + nLen)}
            markerEnd="url(#lTensionHead)"
          />
          <text className={`${classes.mathLabel} ${classes.tensionLabel}`} x={bx + inX * (ballR + nLen + 7)} y={by + inY * (ballR + nLen + 7) + 4}>
            N
          </text>
        </>
      ) : null}

      {/* settings chip (top-left) */}
      <rect className={classes.stageChip} x={24} y={8} width={330} height={22} rx={7} />
      <text className={classes.stageChipText} x={34} y={23}>
        r = {lp.r.toFixed(1)} m · v₀ = {lp.v0.toFixed(1)} m/s · m = {lp.m.toFixed(1)} kg · g = {params.g.toFixed(2)} m/s²
      </text>

      {/* status chip (top-right) */}
      <rect className={classes.stageChip} x={W - 216} y={8} width={200} height={22} rx={7} />
      <text className={classes.statusChipText} x={W - 116} y={23} textAnchor="middle">
        {snap.status}
      </text>
    </svg>
  );
}

/* ── the banked stage: road cross-section + plan-view ring ── */

function BankedStage({
  params,
  snap,
}: {
  params: CircularParams;
  snap: Snapshot;
}) {
  const W = 600;
  const H = 330;
  const b = params.banked;
  const thetaRad = (b.thetaBankDeg * Math.PI) / 180;
  const cosT = Math.cos(thetaRad);
  const sinT = Math.sin(thetaRad);

  // cross-section: a road of fixed display length tilted by θ, rising to the
  // left — the turn centre is to the left
  const roadLen = 230;
  const midX = 200;
  const midY = 200;
  const half = roadLen / 2;
  const lx = midX - half * cosT;
  const ly = midY - half * sinT;
  const rx = midX + half * cosT;
  const ry = midY + half * sinT;

  // the car sits on the road's midpoint
  const carW = 30;
  const carH = 14;
  const nx = sinT; // surface normal (away from the road): (sin θ, −cos θ)
  const ny = -cosT;
  const carCx = midX + nx * (carH / 2 + 4);
  const carCy = midY + ny * (carH / 2 + 4);

  const PX_PER_N = 1.4;
  const capLen = (f: number) => Math.min(80, f * PX_PER_N);
  const nMag = bankedNormal(b.m, params.g, thetaRad); // N = m·g/cos θ
  const mg = b.m * params.g;
  const nLen = capLen(nMag);
  const wLen = capLen(mg);
  const reqLen = capLen(snap.required);

  // plan-view ring (schematic): the car circulates at the ring angle
  const pcx = 487;
  const pcy = 150;
  const pr = 66;
  const dotX = pcx + pr * Math.sin(snap.angle);
  const dotY = pcy - pr * Math.cos(snap.angle);
  const angMod = snap.angle % (2 * Math.PI);
  const pLarge = angMod > Math.PI ? 1 : 0;
  const showPArc = angMod > 0.02;

  return (
    <svg
      className={classes.stageSvg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Car on a banked curve with normal force, weight and the horizontal centripetal requirement"
    >
      <defs>
        <marker id="bTensionHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-tension)" />
        </marker>
        <marker id="bForceHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-force)" />
        </marker>
      </defs>

      {/* the banked road + angle caption */}
      <line className={classes.roadSurface} x1={lx} y1={ly} x2={rx} y2={ry} />
      <text className={classes.tickLabel} x={lx - 10} y={ly + 4} textAnchor="end">
        θ = {b.thetaBankDeg.toFixed(0)}°
      </text>

      {/* the car on the road */}
      <rect
        className={classes.car}
        x={carCx - carW / 2}
        y={carCy - carH / 2}
        width={carW}
        height={carH}
        rx={3}
        transform={`rotate(${b.thetaBankDeg} ${carCx} ${carCy})`}
      />

      {/* N — perpendicular to the road, away from its surface */}
      <line
        className={classes.tensionArrow}
        x1={carCx + nx * (carH / 2 + 2)}
        y1={carCy + ny * (carH / 2 + 2)}
        x2={carCx + nx * (carH / 2 + 2 + nLen)}
        y2={carCy + ny * (carH / 2 + 2 + nLen)}
        markerEnd="url(#bTensionHead)"
      />
      <text className={`${classes.mathLabel} ${classes.tensionLabel}`} x={carCx + nx * (carH / 2 + 10 + nLen)} y={carCy + ny * (carH / 2 + 10 + nLen)}>
        N
      </text>

      {/* mg — straight down */}
      <line
        className={classes.forceArrow}
        x1={carCx - 22}
        y1={carCy}
        x2={carCx - 22}
        y2={carCy + wLen}
        markerEnd="url(#bForceHead)"
      />
      <text className={`${classes.mathLabel} ${classes.forceLabel}`} x={carCx - 26} y={carCy + wLen + 12} textAnchor="end">
        mg
      </text>

      {/* the horizontal centripetal requirement, toward the turn centre */}
      <line
        className={classes.forceArrow}
        x1={carCx}
        y1={carCy + 2}
        x2={carCx - reqLen}
        y2={carCy + 2}
        markerEnd="url(#bForceHead)"
      />
      <text className={`${classes.mathLabel} ${classes.forceLabel}`} x={carCx - reqLen - 6} y={carCy - 6} textAnchor="end">
        F_c = m·v²/r
      </text>

      {/* plan-view ring so the motion is visible */}
      <circle className={classes.dashedCircle} cx={pcx} cy={pcy} r={pr} fill="none" />
      {showPArc ? (
        <path
          className={classes.tracedPath}
          fill="none"
          d={`M ${pcx} ${pcy - pr} A ${pr} ${pr} 0 ${pLarge} 1 ${dotX} ${dotY}`}
        />
      ) : null}
      <line className={classes.rope} x1={pcx} y1={pcy} x2={dotX} y2={dotY} />
      <circle className={classes.ball} cx={dotX} cy={dotY} r={7} />
      <text className={classes.tickLabel} x={pcx} y={pcy + pr + 18} textAnchor="middle">
        plan view
      </text>

      {/* settings chip (top-left) */}
      <rect className={classes.stageChip} x={24} y={8} width={240} height={22} rx={7} />
      <text className={classes.stageChipText} x={34} y={23}>
        r = {b.r.toFixed(0)} m · θ = {b.thetaBankDeg.toFixed(0)}° · v = {b.v.toFixed(2)} m/s
      </text>

      {/* v_opt chip (under the settings chip) */}
      <rect className={classes.stageChip} x={24} y={36} width={250} height={22} rx={7} />
      <text className={classes.stageChipText} x={34} y={51}>
        v_opt = √(r·g·tanθ) = {snap.vOpt.toFixed(2)} m/s
      </text>

      {/* status chip (top-right) */}
      <rect className={classes.stageChip} x={W - 216} y={8} width={200} height={22} rx={7} />
      <text className={classes.statusChipText} x={W - 116} y={23} textAnchor="middle">
        {snap.status}
      </text>
    </svg>
  );
}
