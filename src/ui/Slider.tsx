import { useId, type CSSProperties } from 'react';
import classes from './Slider.module.css';

export interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  precision?: number;
  /** CSS color for the accent track/thumb (defaults to brand ultramarine) */
  color?: string;
  hint?: string;
}

export default function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit,
  precision = 1,
  color = 'var(--ultramarine)',
  hint,
}: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  const style = {
    '--accent': color,
    '--fill': `${pct}%`,
  } as CSSProperties;

  return (
    <div className={classes.slider}>
      <div className={classes.head}>
        <label htmlFor={id} className={classes.label}>
          {label}
        </label>
        <output htmlFor={id} className={classes.value}>
          <span className="tnum">{value.toFixed(precision)}</span>
          {unit ? <span className={classes.unit}>{unit}</span> : null}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={classes.range}
        style={style}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <p className={classes.hint}>{hint}</p> : null}
    </div>
  );
}
