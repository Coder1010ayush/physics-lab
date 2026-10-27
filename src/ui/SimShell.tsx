import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import classes from './SimShell.module.css';

export interface SimShellProps {
  title: string;
  subtitle?: string;
  badge?: string;
  running: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  speeds?: number[];
  time: number;
  stage: ReactNode;
  controls: ReactNode;
  graphs?: ReactNode;
  formulas?: ReactNode;
}

export default function SimShell({
  title,
  subtitle,
  badge,
  running,
  onToggleRun,
  onReset,
  speed,
  onSpeedChange,
  speeds = [0.25, 0.5, 1],
  time,
  stage,
  controls,
  graphs,
  formulas,
}: SimShellProps) {
  return (
    <div className="container containerWide">
      <header className={classes.head}>
        <Link to="/" className={classes.back}>
          ← Library
        </Link>
        <div>
          {badge ? <span className="chip chipBrand">{badge}</span> : null}
          <h1 className={classes.title}>{title}</h1>
          {subtitle ? <p className={classes.subtitle}>{subtitle}</p> : null}
        </div>
      </header>

      <div className={classes.body}>
        <section className={classes.stageCard} aria-label="Simulation stage">
          <div className={classes.stage}>{stage}</div>
          <div className={classes.toolbar}>
            <button
              type="button"
              className={`btn btnPrimary ${classes.play}`}
              onClick={onToggleRun}
              aria-pressed={running}
            >
              {running ? <PauseIcon /> : <PlayIcon />}
              {running ? 'Pause' : 'Start'}
            </button>
            <button type="button" className="btn btnGhost" onClick={onReset}>
              <ResetIcon />
              Reset
            </button>
            <span className={`${classes.time} tnum`} aria-hidden="true">
              t = {time.toFixed(2)} s
            </span>
            <span className={classes.spacer} />
            <div className={classes.speeds} role="group" aria-label="Simulation speed">
              {speeds.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={s === speed ? classes.speedActive : classes.speedBtn}
                  aria-pressed={s === speed}
                  onClick={() => onSpeedChange(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className={classes.controlsCard} aria-label="Simulation controls">
          <h2 className="caption">Controls</h2>
          <div className={classes.controls}>{controls}</div>
        </aside>
      </div>

      {graphs ? (
        <section className={classes.graphs} aria-label="Live graphs">
          {graphs}
        </section>
      ) : null}
      {formulas ? (
        <section className={classes.formulas} aria-label="Live formulas">
          {formulas}
        </section>
      ) : null}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M3.5 2.2 L11.8 7 L3.5 11.8 Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="2.8" y="2.2" width="3.2" height="9.6" rx="1" />
      <rect x="8" y="2.2" width="3.2" height="9.6" rx="1" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2.5 7a4.5 4.5 0 1 0 1.3-3.2" />
      <path d="M2.2 1.6 L2.2 4.2 L4.8 4.2" />
    </svg>
  );
}
