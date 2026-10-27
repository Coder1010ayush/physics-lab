/**
 * Pure graph-axis math shared by GraphPanel — no React, no DOM.
 *
 * Nice tick steps: 1/2/5 × 10^k, so axes never show ugly numbers.
 * Exported for unit tests (see __tests__/graphTicks.test.ts).
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const first = Math.ceil(min / step) * step;
  // Regression guard: when the range is narrower than the floating-point
  // resolution at this magnitude (e.g. min and max 1 ulp apart), t += step
  // never changes t and the loop below would push forever until the array
  // hit its length cap (RangeError: Invalid array length — crashed the app
  // on launch at exactly 45°, where vx0 and vy0 differ by 1 ulp).
  if (!(step > 0) || first === first + step) return [min];
  const ticks: number[] = [];
  for (let t = first; t <= max + step * 1e-6; t += step) {
    ticks.push(Number(t.toPrecision(12)));
    if (ticks.length >= 1000) break; // absolute safety net
  }
  return ticks;
}
