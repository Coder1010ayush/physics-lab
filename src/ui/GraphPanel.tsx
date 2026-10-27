import { useEffect, useRef, useState } from 'react';
import classes from './GraphPanel.module.css';

export interface GraphSeries {
  label: string;
  color: string;
  data: Array<[number, number]>;
  dashed?: boolean;
}

export interface GraphPanelProps {
  title: string;
  series: GraphSeries[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
}

/** Nice tick steps: 1/2/5 × 10^k, so axes never show ugly numbers. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-6; t += step) {
    ticks.push(Number(t.toPrecision(12)));
  }
  return ticks;
}

function fmt(t: number): string {
  const abs = Math.abs(t);
  if (abs >= 100) return t.toFixed(0);
  if (abs >= 10) return t.toFixed(1);
  if (abs >= 1) return t.toFixed(2);
  if (abs >= 0.01) return t.toFixed(2);
  return t.toFixed(3);
}

export default function GraphPanel({
  title,
  series,
  xLabel,
  yLabel,
  height = 190,
}: GraphPanelProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasData = series.some((s) => s.data.length > 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const pad = { l: 46, r: 14, t: 12, b: 30 };
    const plotW = Math.max(10, width - pad.l - pad.r);
    const plotH = Math.max(10, height - pad.t - pad.b);

    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    if (hasData) {
      for (const s of series) {
        for (const [x, y] of s.data) {
          if (x < xmin) xmin = x;
          if (x > xmax) xmax = x;
          if (y < ymin) ymin = y;
          if (y > ymax) ymax = y;
        }
      }
    } else {
      xmin = 0;
      xmax = 1;
      ymin = -1;
      ymax = 1;
    }
    if (xmax === xmin) xmax = xmin + 1;
    if (ymax === ymin) ymax = ymin + 1;
    const yPad = (ymax - ymin) * 0.1;
    ymin -= yPad;
    ymax += yPad;

    const sx = (x: number) => pad.l + ((x - xmin) / (xmax - xmin)) * plotW;
    const sy = (y: number) => pad.t + plotH - ((y - ymin) / (ymax - ymin)) * plotH;

    const css = getComputedStyle(document.documentElement);
    const inkSoft = css.getPropertyValue('--ink-soft').trim() || '#57544B';
    const gridLine = css.getPropertyValue('--grid-line').trim() || 'rgba(26,25,21,0.055)';
    const axisLine = css.getPropertyValue('--ink-line').trim() || 'rgba(26,25,21,0.22)';

    ctx.font = '10.5px "IBM Plex Mono", monospace';

    // horizontal gridlines + y ticks
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const t of niceTicks(ymin, ymax)) {
      const y = sy(t);
      if (y < pad.t - 1 || y > pad.t + plotH + 1) continue;
      ctx.strokeStyle = gridLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + plotW, y);
      ctx.stroke();
      ctx.fillStyle = inkSoft;
      ctx.fillText(fmt(t), pad.l - 8, y);
    }

    // vertical gridlines + x ticks (thinned on narrow panels)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xt = niceTicks(xmin, xmax, 5);
    const every = Math.max(1, Math.ceil(xt.length / 6));
    xt.forEach((t, i) => {
      if (i % every !== 0 && i !== xt.length - 1) return;
      const x = sx(t);
      if (x < pad.l - 1 || x > pad.l + plotW + 1) return;
      ctx.strokeStyle = gridLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + plotH);
      ctx.stroke();
      ctx.fillStyle = inkSoft;
      ctx.fillText(fmt(t), x, pad.t + plotH + 6);
    });

    // frame
    ctx.strokeStyle = axisLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.l, pad.t, plotW, plotH);

    // series
    for (const s of series) {
      if (s.data.length === 0) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(s.dashed ? [6, 4] : []);
      ctx.beginPath();
      s.data.forEach(([x, y], i) => {
        const px = sx(x);
        const py = sy(y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // latest value marker
      const [lx, ly] = s.data[s.data.length - 1];
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(sx(lx), sy(ly), 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // axis labels
    ctx.fillStyle = inkSoft;
    ctx.font = '10px Archivo, sans-serif';
    if (xLabel) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(xLabel, pad.l + plotW, height - 2);
    }
    if (yLabel) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(yLabel, 4, 2);
    }

    // designed empty state
    if (!hasData) {
      ctx.fillStyle = inkSoft;
      ctx.font = '13px Archivo, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Waiting for data…', pad.l + plotW / 2, pad.t + plotH / 2);
    }
  }, [series, width, height, hasData, xLabel, yLabel]);

  return (
    <figure className={classes.card}>
      <figcaption className={classes.head}>
        <h3 className={classes.title}>{title}</h3>
        <div className={classes.legend}>
          {series.map((s) => (
            <span key={s.label} className={classes.legendItem}>
              <span
                className={s.dashed ? classes.dashSwatch : classes.dotSwatch}
                style={{
                  borderColor: s.color,
                  background: s.dashed ? 'transparent' : s.color,
                }}
                aria-hidden="true"
              />
              {s.label}
            </span>
          ))}
        </div>
      </figcaption>
      <div ref={wrapRef} className={classes.plot}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height }}
          role="img"
          aria-label={`${title} graph`}
        />
      </div>
    </figure>
  );
}
