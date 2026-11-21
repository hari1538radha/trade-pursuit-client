// Same rules as the server's range check, for manual entry when live data isn't available.
export const RANGE_DEFAULTS = ['XAUUSD', 'XAGUSD'];
export const RANGE_SUPPORTED = { XAUUSD: 'Gold', XAGUSD: 'Silver', NQ: 'Nasdaq 100 futures', ES: 'S&P 500 futures', YM: 'Dow futures', CL: 'Crude oil', EURUSD: 'Euro / US Dollar', GBPUSD: 'Pound / US Dollar', USDJPY: 'Dollar / Yen', BTCUSD: 'Bitcoin' };
export const THRESHOLDS = { caution: 60, stand: 85 }; // % of the average range already used

export function verdictFor(pct) {
  if (pct == null) return { key: 'closed', label: 'Market closed' };
  if (pct < THRESHOLDS.caution) return { key: 'trade', label: 'Value to trade' };
  if (pct < THRESHOLDS.stand) return { key: 'caution', label: 'Room is thin, be selective' };
  return { key: 'stand', label: 'Stand aside' };
}

const r2 = (n) => (n == null || !Number.isFinite(n) ? null : +n.toFixed(Math.abs(n) >= 100 ? 2 : 5));
export const fmtNum = (n) => (n == null ? '—' : Math.abs(n) >= 100 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : Math.abs(n) >= 1 ? (+n.toFixed(2)).toString() : (+n.toFixed(5)).toString());

/** ranges: up to 10 numbers (or a single average), plus today's high/low and yesterday's high/low. */
export function manualCheck({ symbol, ranges, todayHigh, todayLow, pdh, pdl }) {
  const rs = ranges.filter(Number.isFinite).slice(-10);
  if (!rs.length) throw new Error('Add at least one daily range (or the average)');
  const adr = rs.reduce((a, b) => a + b, 0) / rs.length;
  const has = Number.isFinite(todayHigh) && Number.isFinite(todayLow) && todayHigh >= todayLow;
  const todayRange = has ? todayHigh - todayLow : null;
  const pct = has && adr > 0 ? +((todayRange / adr) * 100).toFixed(1) : null;
  const v = verdictFor(pct);
  const left = has ? r2(Math.max(0, adr - todayRange)) : null;
  const out = { symbol, adr: r2(adr), days: rs.length, ranges: rs.map((range) => ({ range: r2(range) })), minRange: r2(Math.min(...rs)), maxRange: r2(Math.max(...rs)), pdh: r2(pdh), pdl: r2(pdl), todayHigh: r2(todayHigh), todayLow: r2(todayLow), todayRange: r2(todayRange), pct, left, verdict: v.key, verdictLabel: v.label, source: 'Manual' };
  const lv = Number.isFinite(pdh) || Number.isFinite(pdl) ? ` · PDH ${fmtNum(out.pdh)} / PDL ${fmtNum(out.pdl)}` : '';
  out.line = pct == null
    ? `${symbol} · ${rs.length}-day avg range ${fmtNum(out.adr)} · no range today yet${lv}`
    : `${symbol} · ${rs.length}-day avg range ${fmtNum(out.adr)} · today ${fmtNum(out.todayRange)} (${pct}%) · ~${fmtNum(left)} left${lv} → ${v.label}`;
  return out;
}
