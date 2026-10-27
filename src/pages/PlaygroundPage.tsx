import { useEffect, useRef, useState } from 'react';
import SimShell from '../ui/SimShell';
import Slider from '../ui/Slider';
import ReadoutGroup from '../ui/ReadoutGroup';
import GraphPanel from '../ui/GraphPanel';
import FormulaBar from '../ui/FormulaBar';
import classes from './PlaygroundPage.module.css';

const WINDOW_SEC = 8; // seconds of history kept on the graphs
const SAMPLE_HZ = 30; // sample rate pushed into the graphs
const PUBLISH_HZ = 30; // React re-render rate driven by the animation loop

type Pt = [number, number];

interface Snapshot {
  t: number;
  x: number;
  v: number;
  xs: Pt[];
  vs: Pt[];
}

const EMPTY_SNAPSHOT: Snapshot = { t: 0, x: 0, v: 0, xs: [], vs: [] };

/**
 * Phase 0 preview: a live oscillator driving the real UI kit.
 * The motion here is evaluated analytically (x = A sin ωt) just to demo the
 * layout — actual simulations in Phase 1 run on src/engine with fixed timesteps.
 *
 * The animation loop owns the mutable sim state (refs) and publishes immutable
 * snapshots into React state; rendering never reads a ref.
 */
export default function PlaygroundPage() {
  const [amplitude, setAmplitude] = useState(4); // metres
  const [frequency, setFrequency] = useState(0.5); // hertz
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);

  // Latest-params mirror for the rAF loop, synced in an effect (never in render).
  const paramsRef = useRef({ amplitude, frequency, speed, running });
  useEffect(() => {
    paramsRef.current = { amplitude, frequency, speed, running };
  }, [amplitude, frequency, speed, running]);

  const tRef = useRef(0);
  const xSamples = useRef<Pt[]>([]);
  const vSamples = useRef<Pt[]>([]);
  const lastSampleRef = useRef(0);
  const lastPublishRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const p = paramsRef.current;
      if (p.running) tRef.current += dt * p.speed;

      const t = tRef.current;
      const w = 2 * Math.PI * p.frequency;
      const x = p.amplitude * Math.sin(w * t);
      const v = p.amplitude * w * Math.cos(w * t);

      if (p.running && t - lastSampleRef.current >= 1 / SAMPLE_HZ) {
        lastSampleRef.current = t;
        xSamples.current.push([t, x]);
        vSamples.current.push([t, v]);
        const cutoff = t - WINDOW_SEC;
        while (xSamples.current.length > 0 && xSamples.current[0][0] < cutoff)
          xSamples.current.shift();
        while (vSamples.current.length > 0 && vSamples.current[0][0] < cutoff)
          vSamples.current.shift();
      }

      if (now - lastPublishRef.current >= 1000 / PUBLISH_HZ) {
        lastPublishRef.current = now;
        setSnap({
          t,
          x,
          v,
          xs: xSamples.current.slice(),
          vs: vSamples.current.slice(),
        });
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { t, x, v } = snap;
  const omega = 2 * Math.PI * frequency;

  const handleReset = () => {
    tRef.current = 0;
    lastSampleRef.current = 0;
    xSamples.current = [];
    vSamples.current = [];
    setSnap(EMPTY_SNAPSHOT);
  };

  return (
    <SimShell
      title="Component Playground"
      subtitle="The design system proven live — an oscillator running in the exact layout every simulation will use."
      badge="Phase 0 preview"
      running={running}
      onToggleRun={() => setRunning((r) => !r)}
      onReset={handleReset}
      speed={speed}
      onSpeedChange={setSpeed}
      time={t}
      stage={<OscillatorStage x={x} amplitude={amplitude} velocity={v} />}
      controls={
        <>
          <Slider
            label="Amplitude A"
            value={amplitude}
            onChange={setAmplitude}
            min={1}
            max={10}
            step={0.1}
            unit="m"
            precision={1}
          />
          <Slider
            label="Frequency f"
            value={frequency}
            onChange={setFrequency}
            min={0.1}
            max={2}
            step={0.05}
            unit="Hz"
            precision={2}
            hint="ω = 2πf rad/s"
          />
          <ReadoutGroup
            items={[
              { label: 'time', value: t, unit: 's', precision: 2 },
              { label: 'position x', value: x, unit: 'm', precision: 2 },
              {
                label: 'velocity v',
                value: v,
                unit: 'm/s',
                color: 'var(--vec-velocity)',
                precision: 2,
              },
            ]}
          />
        </>
      }
      graphs={
        <>
          <GraphPanel
            title="Position"
            series={[{ label: 'x (m)', color: 'var(--ink)', data: snap.xs }]}
            xLabel="t (s)"
            yLabel="x (m)"
          />
          <GraphPanel
            title="Velocity"
            series={[
              {
                label: 'v (m/s)',
                color: 'var(--vec-velocity)',
                data: snap.vs,
              },
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
              label: 'Position',
              formula: 'x = A sin(2πft)',
              substitution: `= ${amplitude.toFixed(1)} × sin(2π × ${frequency.toFixed(2)} × ${t.toFixed(2)})`,
              result: x.toFixed(2),
              unit: 'm',
            },
            {
              label: 'Velocity',
              formula: 'v = 2πfA cos(2πft)',
              substitution: `= ${(omega * amplitude).toFixed(2)} × cos(2π × ${frequency.toFixed(2)} × ${t.toFixed(2)})`,
              result: v.toFixed(2),
              unit: 'm/s',
            },
          ]}
        />
      }
    />
  );
}

/* ── the stage: a mass on a spring, drawn as SVG each frame ── */

function OscillatorStage({
  x,
  amplitude,
  velocity,
}: {
  x: number;
  amplitude: number;
  velocity: number;
}) {
  const scale = 18; // px per metre
  const eq = 300; // equilibrium x in the 600-wide viewBox
  const cx = eq + x * scale;
  const blockY = 180;
  const blockW = 46;
  const blockH = 52;
  const left = cx - blockW / 2;
  const vLen = Math.max(-80, Math.min(80, velocity * 6));
  const ampPx = amplitude * scale;

  return (
    <svg
      className={classes.stageSvg}
      viewBox="0 0 600 360"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="A mass on a spring oscillating horizontally"
    >
      <defs>
        <marker
          id="velHead"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-velocity)" />
        </marker>
      </defs>

      {/* wall */}
      <rect className={classes.wall} x="42" y="130" width="10" height="100" rx="2" />

      {/* amplitude guides */}
      {ampPx > 12 ? (
        <>
          <line className={classes.ampLine} x1={eq - ampPx} y1="96" x2={eq - ampPx} y2="264" />
          <line className={classes.ampLine} x1={eq + ampPx} y1="96" x2={eq + ampPx} y2="264" />
          <text className={classes.stageLabel} x={eq - ampPx} y="88" textAnchor="middle">
            −A
          </text>
          <text className={classes.stageLabel} x={eq + ampPx} y="88" textAnchor="middle">
            +A
          </text>
        </>
      ) : null}

      {/* equilibrium */}
      <line className={classes.equilibrium} x1={eq} y1="66" x2={eq} y2="294" />
      <text className={classes.stageLabel} x={eq} y="56" textAnchor="middle">
        x = 0
      </text>

      {/* spring */}
      <path className={classes.spring} d={springPath(58, left, blockY, 9)} />

      {/* block */}
      <rect
        className={classes.block}
        x={left}
        y={blockY - blockH / 2}
        width={blockW}
        height={blockH}
        rx="7"
      />
      <text className={classes.blockLabel} x={cx} y={blockY + 7} textAnchor="middle">
        m
      </text>

      {/* velocity vector */}
      {Math.abs(vLen) > 4 ? (
        <>
          <line
            className={classes.velArrow}
            x1={cx}
            y1={blockY - blockH / 2 - 30}
            x2={cx + vLen}
            y2={blockY - blockH / 2 - 30}
            markerEnd="url(#velHead)"
          />
          <text
            className={classes.velLabel}
            x={cx + vLen + (vLen >= 0 ? 10 : -10)}
            y={blockY - blockH / 2 - 25}
            textAnchor={vLen >= 0 ? 'start' : 'end'}
          >
            v
          </text>
        </>
      ) : null}
    </svg>
  );
}

/** zigzag polyline from x1 to x2 at height y */
function springPath(x1: number, x2: number, y: number, coils: number): string {
  if (x2 - x1 < 14) return `M ${x1} ${y} L ${x2} ${y}`;
  const lead = 8;
  const start = x1 + lead;
  const end = Math.max(start + 2, x2 - lead);
  const n = coils * 2;
  const step = (end - start) / n;
  let d = `M ${x1} ${y} L ${start.toFixed(1)} ${y}`;
  for (let i = 1; i <= n; i++) {
    const px = start + step * i;
    if (i === n) d += ` L ${px.toFixed(1)} ${y}`;
    else d += ` L ${px.toFixed(1)} ${(y + (i % 2 === 1 ? -17 : 17)).toFixed(1)}`;
  }
  d += ` L ${x2.toFixed(1)} ${y}`;
  return d;
}
