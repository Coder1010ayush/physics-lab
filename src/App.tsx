import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PlaygroundPage from './pages/PlaygroundPage';
import ProjectilePage from './pages/ProjectilePage';
import KinematicsPage from './pages/KinematicsPage';
import FrictionPage from './pages/FrictionPage';
import TopicDetailPage from './pages/TopicDetailPage';
import classes from './App.module.css';

const PROJECTOR_STORAGE_KEY = 'physicslab_ui_projector';
const THEME_STORAGE_KEY = 'physicslab_ui_theme';

export default function App() {
  const [projectorMode, setProjectorMode] = useState(() => {
    try {
      return window.localStorage.getItem(PROJECTOR_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Theme preference (manual toggle). Projector mode forces light, but we keep
  // the user's preference for when projector mode is turned off.
  const [darkPref, setDarkPref] = useState(() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const darkEffective = darkPref && !projectorMode;


  useEffect(() => {
    if (projectorMode) document.documentElement.dataset.ui = 'projector';
    else delete document.documentElement.dataset.ui;
    try {
      window.localStorage.setItem(PROJECTOR_STORAGE_KEY, projectorMode ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }, [projectorMode]);

  useEffect(() => {
    if (darkEffective) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, darkPref ? 'dark' : 'light');
    } catch {
      // ignore storage failures
    }
  }, [darkEffective, darkPref]);


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
          <div className={classes.right}>
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
            <button
              type="button"
              className={projectorMode ? classes.projectorActive : classes.projectorBtn}
              aria-pressed={projectorMode}
              onClick={() => setProjectorMode((v) => !v)}
              title="Toggle projector mode"
            >
              <ProjectorIcon />
              Projector
            </button>
            <button
              type="button"
              className={darkEffective ? classes.themeActive : classes.themeBtn}
              aria-pressed={darkEffective}
              onClick={() => setDarkPref((v) => !v)}
              disabled={projectorMode}
              title={
                projectorMode
                  ? 'Dark theme is disabled in projector mode'
                  : 'Toggle dark theme'
              }
            >
              <MoonIcon />
              Dark
            </button>
          </div>
        </nav>
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/sim/projectile" element={<ProjectilePage />} />
          <Route path="/sim/kinematics" element={<KinematicsPage />} />
          <Route path="/sim/friction" element={<FrictionPage />} />
          <Route path="/topic/:topicId" element={<TopicDetailPage />} />
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

function ProjectorIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.2 5.4h9.6" />
      <rect x="2.4" y="5.4" width="9.2" height="4.4" rx="1.2" />
      <path d="M7 9.8v1.6" />
      <path d="M5.2 12h3.6" />
      <circle cx="4.6" cy="7.6" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="9.4" cy="7.6" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}


function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.7 9.5c-3.2 0-5.7-2.6-5.7-5.7 0-0.9 0.2-1.7 0.6-2.5C3.1 2.2 2.2 3.8 2.2 5.6c0 3.3 2.7 6 6 6 1.8 0 3.4-0.9 4.3-2.4-0.8 0.4-1.7 0.3-2.8 0.3Z" />
    </svg>
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
