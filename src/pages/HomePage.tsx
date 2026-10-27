import { Link } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import classes from './HomePage.module.css';

interface Topic {
  id: string;
  title: string;
  desc: string;
  status: 'live' | 'now' | 'soon';
  icon: ReactNode;
}

const TOPICS: Topic[] = [
  {
    id: 'kinematics',
    title: 'Kinematics',
    desc: 'Watch a car ride the track with the three equations of motion updating live — then take it into the air in the projectile lab.',
    status: 'live',
    icon: <IconKinematics />,
  },
  {
    id: 'friction',
    desc: 'Static vs kinetic friction on flat ground and on ramps — including the famous staircase graph and the angle of repose.',
    title: 'Friction',
    status: 'now',
    icon: <IconFriction />,
  },
  {
    id: 'pulley',
    title: 'Force & Pulley',
    desc: 'Atwood machines and table-edge systems with live tension and free-body diagrams on every mass.',
    status: 'now',
    icon: <IconPulley />,
  },
  {
    id: 'vectors-2d',
    title: '2D Motion & Vectors',
    desc: 'Add and resolve vectors; watch components drive a real projectile — now with air drag and Moon gravity.',
    status: 'live',
    icon: <IconVectors />,
  },
  {
    id: 'circular',
    title: 'Circular Motion',
    desc: 'Uniform circular motion, centripetal force and banking.',
    status: 'soon',
    icon: <IconCircular />,
  },
  {
    id: 'torque',
    title: 'Torque',
    desc: 'Rotational balance, levers and couples.',
    status: 'soon',
    icon: <IconTorque />,
  },
  {
    id: 'rotational',
    title: 'Rotational Motion',
    desc: 'Moment of inertia and angular dynamics.',
    status: 'soon',
    icon: <IconRotational />,
  },
  {
    id: 'work-energy',
    title: 'Work & Energy',
    desc: 'Energy conservation along real tracks.',
    status: 'soon',
    icon: <IconEnergy />,
  },
  {
    id: 'momentum',
    title: 'Momentum & Collisions',
    desc: 'Elastic and inelastic — see exactly what is conserved.',
    status: 'soon',
    icon: <IconMomentum />,
  },
  {
    id: 'oscillations',
    title: 'Oscillations',
    desc: 'Springs and pendulums in simple harmonic motion.',
    status: 'soon',
    icon: <IconOscillation />,
  },
  {
    id: 'fluids',
    title: 'Fluids',
    desc: 'Buoyancy, Bernoulli and continuity.',
    status: 'soon',
    icon: <IconFluid />,
  },
];

function chipFor(status: Topic['status']): [string, string] {
  if (status === 'live') return ['chip chipLive', 'Available now'];
  if (status === 'now') return ['chip chipBrand', 'Building now'];
  return ['chip chipMuted', 'Coming soon'];
}

export default function HomePage() {
  return (
    <div className="container">
      <section className={`${classes.hero} enter`}>
        <div style={{ '--i': 0 } as CSSProperties}>
          <span className="chip chipBrand">Class 12 · Interactive physics</span>
          <h1 className={classes.headline}>
            See physics <em className={classes.accent}>happen</em>.
          </h1>
          <p className={classes.lede}>
            Live simulations for every mechanics topic — drag the sliders, watch the
            vectors move, and read the formulas as they update in real time.
          </p>
          <div className={classes.ctaRow}>
            <Link to="/sim/projectile" className="btn btnPrimary">
              Launch the Projectile Lab
            </Link>
            <a href="#topics" className="btn btnGhost">
              Browse topics
            </a>
          </div>
        </div>
        <div className={`${classes.heroCard} graph-paper`} style={{ '--i': 1 } as CSSProperties}>
          <HeroFigure />
        </div>
      </section>

      <ul className={classes.trust}>
        <li>
          <BoltIcon /> Runs offline — no internet needed in class
        </li>
        <li>
          <ScreenIcon /> Light, high-contrast design made for projectors
        </li>
        <li>
          <SigmaIcon /> Every number traceable to the textbook
        </li>
      </ul>

      <section id="topics" className={classes.library}>
        <h2>The simulation library</h2>
        <p className={classes.libraryNote}>
          The Kinematics and Projectile labs are live — friction and pulley follow next.
          Open any card for definitions, concepts and formulas.
        </p>
        <div className={classes.grid}>
          {TOPICS.map((topic) => {
            const [chipClass, chipText] = chipFor(topic.status);
            return (
              <Link
                key={topic.id}
                to={`/topic/${topic.id}`}
                className={topic.status === 'soon' ? classes.cardSoon : classes.cardNow}
                aria-label={`${topic.title} — concepts, formulas and details`}
              >
                <div className={topic.status === 'soon' ? classes.iconSoon : classes.iconNow}>
                  {topic.icon}
                </div>
                <h3>{topic.title}</h3>
                <p>{topic.desc}</p>
                <span className={chipClass}>{chipText}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ── Hero illustration: a textbook projectile figure, drawn in the brand language ── */
function HeroFigure() {
  return (
    <svg
      viewBox="0 0 480 300"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="A projectile launched at an angle, with its velocity vector and components shown"
    >
      <line x1="30" y1="250" x2="450" y2="250" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M50 250 Q240 42 430 250"
        fill="none"
        stroke="var(--ink-soft)"
        strokeWidth="2"
        strokeDasharray="6 6"
      />
      <line x1="240" y1="146" x2="240" y2="250" stroke="var(--ink-line)" strokeDasharray="4 5" />
      <text x="240" y="264" textAnchor="middle" className={classes.figureLabel}>
        h
      </text>
      <path d="M50 250 A 46 46 0 0 0 82 222" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5" />
      <text x="70" y="240" className={classes.figureLabel}>
        θ
      </text>
      <circle cx="240" cy="146" r="7" fill="var(--ultramarine)" />
      <line x1="240" y1="146" x2="308" y2="146" stroke="var(--vec-velocity)" strokeWidth="2.4" markerEnd="url(#heroVel)" />
      <text x="315" y="150" className={classes.figureLabel} fill="var(--vec-velocity)">
        v
      </text>
      <defs>
        <marker id="heroVel" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--vec-velocity)" />
        </marker>
      </defs>
      <line x1="50" y1="266" x2="430" y2="266" stroke="var(--ink-line)" strokeWidth="1.2" />
      <line x1="50" y1="260" x2="50" y2="272" stroke="var(--ink-line)" strokeWidth="1.2" />
      <line x1="430" y1="260" x2="430" y2="272" stroke="var(--ink-line)" strokeWidth="1.2" />
      <text x="240" y="284" textAnchor="middle" className={classes.figureLabel}>
        R = v₀² sin 2θ / g
      </text>
    </svg>
  );
}

/* ── topic icons: small physics glyphs, currentColor + ultramarine accents ── */
function iconProps() {
  return {
    width: 26,
    height: 26,
    viewBox: '0 0 32 32',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

function IconKinematics() {
  return (
    <svg {...iconProps()}>
      <line x1="4" y1="25" x2="28" y2="25" />
      <line x1="6" y1="25" x2="6" y2="8" strokeDasharray="2 3" opacity="0.5" />
      <circle cx="15" cy="25" r="3" stroke="none" className={classes.accentFill} />
      <path d="M22 18 h6" />
      <path d="M25 15 l3 3 l-3 3" />
    </svg>
  );
}

function IconFriction() {
  return (
    <svg {...iconProps()}>
      <path d="M4 26 L28 26 L28 11 Z" />
      <rect x="21" y="10.5" width="7" height="7" rx="1" />
      <path d="M19 20 l-5 5" strokeDasharray="2 2" />
    </svg>
  );
}

function IconPulley() {
  return (
    <svg {...iconProps()}>
      <circle cx="16" cy="8" r="4" />
      <line x1="12" y1="11" x2="12" y2="22" />
      <line x1="20" y1="11" x2="20" y2="19" />
      <rect x="9" y="22" width="6" height="5" rx="1" stroke="none" className={classes.accentFill} />
      <rect x="17" y="19" width="6" height="5" rx="1" />
    </svg>
  );
}

function IconVectors() {
  return (
    <svg {...iconProps()}>
      <path d="M6 26 L26 26" />
      <path d="M23 23 l3 3 l-3 3" />
      <path d="M6 26 L14 8" />
      <path d="M11 11 l3 -3 l1 4" />
      <path d="M26 26 L14 8" strokeDasharray="2 3" opacity="0.5" />
    </svg>
  );
}

function IconCircular() {
  return (
    <svg {...iconProps()}>
      <circle cx="16" cy="16" r="10" />
      <line x1="16" y1="16" x2="25" y2="16" />
      <circle cx="25" cy="16" r="2.6" stroke="none" className={classes.accentFill} />
    </svg>
  );
}

function IconTorque() {
  return (
    <svg {...iconProps()}>
      <path d="M22 16 a6 6 0 1 1 -6 -6" />
      <path d="M13 7 l3 3 l-4 2" />
      <line x1="9" y1="23" x2="23" y2="9" />
      <circle cx="16" cy="16" r="2.2" stroke="none" className={classes.accentFill} />
    </svg>
  );
}

function IconRotational() {
  return (
    <svg {...iconProps()}>
      <circle cx="16" cy="16" r="10" />
      <line x1="16" y1="6" x2="16" y2="26" />
      <line x1="6" y1="16" x2="26" y2="16" />
      <circle cx="16" cy="16" r="2.4" stroke="none" className={classes.accentFill} />
    </svg>
  );
}

function IconEnergy() {
  return (
    <svg {...iconProps()}>
      <path d="M4 26 Q16 2 28 26" />
      <circle cx="12" cy="20.5" r="2.6" stroke="none" className={classes.accentFill} />
    </svg>
  );
}

function IconMomentum() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="16" r="4" />
      <circle cx="24" cy="16" r="4" />
      <path d="M14 12 l4 4 l-4 4" />
      <path d="M18 12 l-4 4 l4 4" opacity="0.4" />
    </svg>
  );
}

function IconOscillation() {
  return (
    <svg {...iconProps()}>
      <path d="M4 16 h2 l2 -6 l4 12 l4 -12 l4 12 l2 -6 h2" />
      <rect x="24" y="11" width="6" height="10" rx="1" />
    </svg>
  );
}

function IconFluid() {
  return (
    <svg {...iconProps()}>
      <path d="M5 11 v15 h22 v-15" />
      <path d="M5 20 q3 -4 5.5 0 t5.5 0 t5.5 0" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 L5 14 h5 l-1 8 8 -12 h-5 z" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16 v4 M8 20 h8" />
    </svg>
  );
}

function SigmaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 5 H7 l6 7 -6 7 h11" />
    </svg>
  );
}
