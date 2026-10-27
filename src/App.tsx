import { HashRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PlaygroundPage from './pages/PlaygroundPage';
import classes from './App.module.css';

export default function App() {
  return (
    <HashRouter>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className={classes.topbar}>
        <nav className={`${classes.nav} container`} aria-label="Primary">
          <NavLink to="/" className={classes.brand} aria-label="PhysicsLab home">
            <LogoMark />
            <span>
              Physics<em>Lab</em>
            </span>
          </NavLink>
          <div className={classes.links}>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? classes.active : undefined)}
            >
              Home
            </NavLink>
            <NavLink
              to="/playground"
              className={({ isActive }) => (isActive ? classes.active : undefined)}
            >
              Playground
            </NavLink>
          </div>
        </nav>
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className={classes.footer}>
        <div className="container">
          <p className={classes.footerNote}>
            PhysicsLab — built for Class 12 physics. Every number on screen is traceable to the textbook.
          </p>
        </div>
      </footer>
    </HashRouter>
  );
}

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="13" cy="13" r="3.2" className={classes.logoNucleus} />
      <ellipse
        cx="13"
        cy="13"
        rx="11"
        ry="4.6"
        transform="rotate(-24 13 13)"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.55"
      />
      <ellipse
        cx="13"
        cy="13"
        rx="11"
        ry="4.6"
        transform="rotate(56 13 13)"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.55"
      />
    </svg>
  );
}
