/**
 * Interaction smoke test — clicks the real UI in real Chrome.
 * Run: node .kiwi/click-test.mjs   (dev server must be running on :5173)
 * Verifies that Start/Pause actually move the simulations.
 */
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readState(page) {
  return page.evaluate(() => {
    const text = document.body.textContent;
    const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
    const tm = text.match(/t = ([\d.]+) s/);
    const rMatch = text.match(/R = ([\d.]+) m/);
    const polylines = [...document.querySelectorAll('svg polyline')].map(
      (p) => p.getAttribute('points')?.split(' ').length ?? 0,
    );
    return {
      t: tm ? parseFloat(tm[1]) : null,
      buttons,
      rangeLabel: rMatch ? rMatch[1] : null,
      polylinePoints: polylines,
    };
  });
}

const clickButton = (page, label) =>
  page.evaluate((lbl) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(lbl));
    if (!btn) throw new Error(`button ${lbl} not found`);
    btn.click();
    return true;
  }, label);

const results = [];
const report = (name, pass, detail) => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
};

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'shell',
  args: ['--no-sandbox', '--disable-gpu'],
});

// Surface any stray async teardown noise instead of dying silently.
process.on('uncaughtException', (e) => console.log('UNCAUGHT:', e.message));

try {
  /* ── Projectile page ── */
  {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    await page.goto(`${BASE}/#/sim/projectile`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.textContent.includes('Launch speed'));

    const before = await readState(page);
    report(
      'projectile loads with Start button',
      before.buttons.some((b) => b.includes('Start')),
      `t = ${before.t}`,
    );

    await clickButton(page, 'Start');
    await sleep(1300);
    const flying = await readState(page);
    report(
      'click Start → simulation runs (t advances)',
      flying.t !== null && before.t !== null && flying.t > before.t + 0.3,
      `t: ${before.t} → ${flying.t}`,
    );
    report(
      'trajectory trail drawn',
      Math.max(0, ...flying.polylinePoints) > 5,
      `polyline point counts: ${JSON.stringify(flying.polylinePoints)}`,
    );
    report(
      'button became Pause while flying',
      flying.buttons.some((b) => b.includes('Pause')),
      'playbar state = Pause',
    );

    // pause freezes time
    await clickButton(page, 'Pause');
    await sleep(400);
    const p1 = await readState(page);
    await sleep(500);
    const p2 = await readState(page);
    report('Pause freezes time', p1.t !== null && p1.t === p2.t, `t: ${p1.t} vs ${p2.t}`);

    // resume and wait for landing: the measured R label appears
    await clickButton(page, 'Start');
    const landedOk = await page
      .waitForFunction(() => /R = [\d.]+ m/.test(document.body.textContent), { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    const landed = await readState(page);
    report(
      'flight lands, auto-pauses, shows measured R',
      landedOk && landed.rangeLabel !== null && parseFloat(landed.rangeLabel) > 30,
      `R = ${landed.rangeLabel} (ideal 40.8 m), t = ${landed.t}`,
    );
    report(
      'no console/page errors',
      logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]')).length === 0,
      logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]')).join(' ; ') || 'clean',
    );
    await page.close();
  }

  /* ── Kinematics page — braking scenario verifies the turning-point physics ── */
  {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    await page.goto(`${BASE}/#/sim/kinematics`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.textContent.includes('Initial speed'));

    const before = await readState(page);
    report(
      'kinematics loads with Start button',
      before.buttons.some((b) => b.includes('Start')),
      `t = ${before.t}`,
    );

    // Brake the car: u = 5 m/s, a = −1 m/s² via the real sliders → it must
    // come to rest at exactly t* = u/|a| = 5 s (turning point recorded).
    await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input[type="range"]')];
      const setVal = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, String(v));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setVal(inputs[0], 5);
      setVal(inputs[1], -1);
    });
    await sleep(200);
    await clickButton(page, 'Start');
    const rested = await page
      .waitForFunction(() => /At rest: t = 5\.\d/.test(document.body.textContent), { timeout: 9000 })
      .then(() => true)
      .catch(() => false);
    const after = await readState(page);
    report(
      'braking car reaches the turning point at t ≈ 5 s',
      rested && after.t !== null && after.t > 5,
      `sim ran to t = ${after.t} s, readout shows 'At rest: t = 5.00 s'`,
    );
    report(
      'kinematics no console/page errors',
      logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]')).length === 0,
      logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]')).join(' ; ') || 'clean',
    );
    await page.close();
  }

  /* ── Friction page — stick/slide threshold physics ── */
  {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    await page.goto(`${BASE}/#/sim/friction`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.textContent.includes('Push on flat ground'));

    const loaded = await readState(page);
    report(
      'friction loads with Start button',
      loaded.buttons.some((b) => b.includes('Start')),
      `t = ${loaded.t}`,
    );

    // HORIZONTAL: defaults m = 5 kg, μs = 0.5 → limit μs·N = 24.5 N.
    // Ramp 3 N/s must hold the block stuck until t ≈ 8.17 s, then it breaks loose.
    await clickButton(page, 'Start');
    const stickEarly = await page.evaluate(() => /status\s*sticking/.test(document.body.textContent));
    const sliding = await page
      .waitForFunction(() => /status\s*sliding/.test(document.body.textContent), { timeout: 13000 })
      .then(() => true)
      .catch(() => false);
    report(
      'block sticks, then breaks loose past μs·N = 24.5 N (~8.2 s)',
      stickEarly && sliding,
      `stuck at start: ${stickEarly}; sliding appeared: ${sliding}`,
    );

    // INCLINE below repose: θ = 20° < repose atan(0.5) ≈ 26.57° → stays at rest.
    await clickButton(page, 'Slide down a ramp');
    await sleep(250);
    await clickButton(page, 'Start');
    await sleep(3000);
    const stuckX = await page.evaluate(() => {
      const m = /position x\s*(-?[\d.]+)\s*m/.exec(document.body.textContent);
      return m ? parseFloat(m[1]) : NaN;
    });
    report(
      'incline below repose (20° < 26.6°) — block stays at rest',
      Number.isFinite(stuckX) && Math.abs(stuckX) < 0.01,
      `position x = ${stuckX} m after 3 s`,
    );

    // INCLINE past repose: θ = 35° > 26.57° → the block lets go (a ≈ 3.2 m/s²).
    await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input[type="range"]')];
      const theta = inputs[3];
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(theta, '35');
      theta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await sleep(250);
    await clickButton(page, 'Start');
    const slid = await page
      .waitForFunction(
        () => {
          const m = /position x\s*(-?[\d.]+)\s*m/.exec(document.body.textContent);
          return m ? parseFloat(m[1]) > 1 : false;
        },
        { timeout: 8000 },
      )
      .then(() => true)
      .catch(() => false);
    report('incline past repose (35° > 26.6°) — block lets go', slid, 'position readout grew past 1 m');

    const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
    report(
      'friction no console/page errors',
      errs.length === 0,
      errs.join(' ; ') || 'clean',
    );
    await page.close();
  }

  /* ── Playground page ── */
  {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    await page.goto(`${BASE}/#/playground`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.textContent.includes('Frequency'));
    // The playground auto-runs on mount — wait for the playbar clock to
    // appear before reading the "before" value (avoids racing first paint).
    await page.waitForFunction(() => /t = [\d.]+ s/.test(document.body.textContent));

    const before = await readState(page);
    if (before.buttons.some((b) => b.includes('Start'))) {
      await clickButton(page, 'Start');
    }
    await sleep(1400);
    const after = await readState(page);
    report(
      'playground runs (t advances)',
      after.t !== null && before.t !== null && after.t > before.t + 0.3,
      `t: ${before.t} → ${after.t}`,
    );
    report(
      'playground no console errors',
      logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]')).length === 0,
      logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]')).join(' ; ') || 'clean',
    );
    await page.close();
  }
} catch (e) {
  console.log('SCRIPT ERROR:', e && e.message ? e.message : String(e));
  process.exitCode = 1;
} finally {
  try {
    await browser.close();
  } catch {
    /* teardown races are noise once the checks have run */
  }
  const failed = results.filter((r) => !r).length;
  console.log(
    `${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'} (${results.length} checks)`,
  );
  if (process.exitCode !== 1) process.exitCode = failed === 0 ? 0 : 1;
  // Force exit: puppeteer's CDP connection can keep the event loop alive
  // (and its teardown races can throw) after the verdict is printed.
  process.exit(process.exitCode === 1 ? 1 : 0);
}
