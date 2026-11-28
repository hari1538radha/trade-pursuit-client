// Macro desk: turns the /markets/macro bundle into everything the Macro page shows.
//
// Every statistic is measured on past data with no look-ahead: a monthly figure is only used
// once it had been published (CPI ~45 days after the month, jobs ~38 days, and so on), and
// forward returns start from the close on the day the signal was known. Overlapping windows
// (e.g. 13-week returns measured every week) are not independent, so the counts overstate
// how much evidence there is; the page says so.

const DAY = 864e5, H = 36e5;
export const ASSETS = {
  XAUUSD: { key: 'XAUUSD', name: 'Gold', short: 'Gold', unit: '$', dp: 1 },
  NAS100: { key: 'NAS100', name: 'Nasdaq 100', short: 'Nasdaq', unit: 'pts', dp: 0 },
};

// ───────────────────────── small helpers ─────────────────────────
const t0 = (d) => Date.parse(d + 'T00:00:00Z');
export const ymd = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d, n) => ymd(t0(d) + n * DAY);
const addMonths = (d, n) => { const x = new Date(t0(d)); return ymd(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n + 1, 0)); }; // month end, n months later
export const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
export function stdev(xs) { if (xs.length < 2) return null; const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); }
export function median(xs) { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; }
export function corr(a, b) {
  const n = Math.min(a.length, b.length); if (n < 8) return null;
  const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : null;
}
const slope = (x, y) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0; x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; }); return sxx ? sxy / sxx : null; };
const clip = (x, a = 2.5) => Math.max(-a, Math.min(a, x));
const pct = (xs, f) => (xs.length ? (xs.filter(f).length / xs.length) * 100 : null);
/** last index with arr[i] <= key (arr sorted), -1 if none */
export function lastLE(arr, key) { let lo = 0, hi = arr.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= key) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; }
const firstGT = (arr, key) => { const i = lastLE(arr, key) + 1; return i < arr.length ? i : -1; };
const firstGE = (arr, key) => { const i = lastLE(arr, addDays(key, -1)) + 1; return i < arr.length ? i : -1; };

/** A data series that knows when each value became public */
export function series(points, lag = 0) {
  return { d: points.map((p) => (lag ? addDays(p[0], lag) : p[0])), v: points.map((p) => p[1]), obs: points.map((p) => p[0]) };
}
/** Value known on date d (optionally `back` observations earlier in the same series) */
export const valueAt = (s, d, back = 0) => { if (!s) return null; const i = lastLE(s.d, d); return i - back >= 0 ? s.v[i - back] : null; };
const obsAt = (s, d) => { if (!s) return null; const i = lastLE(s.d, d); return i >= 0 ? s.obs[i] : null; };

const prices = (daily) => ({ d: daily.map((r) => r[0]), o: daily.map((r) => r[1]), h: daily.map((r) => r[2]), l: daily.map((r) => r[3]), c: daily.map((r) => r[4]) });
const closeAt = (px, d) => { const i = lastLE(px.d, d); return i >= 0 ? px.c[i] : null; };

const change = (kind, a, b) => (a == null || b == null ? null : kind === 'bp' ? (a - b) * 100 : kind === 'pct' ? (b ? (a / b - 1) * 100 : null) : a - b);

export function fridays(from, to) {
  const out = []; let t = t0(from); while (new Date(t).getUTCDay() !== 5) t += DAY;
  for (; t <= t0(to); t += 7 * DAY) out.push(ymd(t));
  return out;
}
const monthEnds = (from, to) => { const out = []; let d = addMonths(from, 0); while (d <= to) { out.push(d); d = addMonths(d, 1); } return out; };

// ───────────────────────── drivers ─────────────────────────
export const DRIVERS = [
  { key: 'real', label: '10-year real yield', unit: '%', chg: 'bp', gold: -1, nq: -1, why: 'What you earn on bonds after inflation. Gold pays nothing, so higher real yields make it less attractive; they also cut what future tech profits are worth today.' },
  { key: 'y10', label: '10-year Treasury yield', unit: '%', chg: 'bp', gold: -1, nq: -1, why: 'The benchmark borrowing cost. Rising yields usually weigh on both gold and growth stocks.' },
  { key: 'y2', label: '2-year yield (Fed expectations)', unit: '%', chg: 'bp', gold: -1, nq: -1, why: 'Moves with what traders expect the Fed to do over the next two years.' },
  { key: 'be', label: 'Inflation expectations (10y breakeven)', unit: '%', chg: 'bp', gold: 1, nq: 0, why: 'Inflation the bond market expects. Higher expectations are a classic support for gold.' },
  { key: 'curve', label: 'Yield curve (10y minus 2y)', unit: '%', chg: 'bp', gold: 0, nq: 0, why: 'Negative = inverted, a historical recession warning. Re-steepening after an inversion often comes with Fed cuts.' },
  { key: 'usd', label: 'US dollar (broad index)', unit: '', chg: 'pct', gold: -1, nq: -1, why: 'Gold is priced in dollars, so a stronger dollar usually means lower gold. A strong dollar also tightens global conditions.' },
  { key: 'vix', label: 'VIX (stock market fear)', unit: '', chg: 'pts', gold: 1, nq: -1, why: 'Rises when stocks fall. Fear tends to help gold and hurt the Nasdaq.' },
  { key: 'hy', label: 'Junk-bond credit spread', unit: '%', chg: 'bp', gold: 0, nq: -1, why: 'Extra yield risky companies pay. Widening spreads mean stress and usually hurt stocks.' },
  { key: 'nfci', label: 'Financial conditions (+ = tighter)', unit: '', chg: 'pts', gold: 0, nq: -1, why: 'Chicago Fed index of credit, money-market and stock conditions. Tighter conditions are a headwind for stocks.' },
  { key: 'liq', label: 'Fed net liquidity', unit: '$bn', chg: 'pct', gold: 1, nq: 1, why: 'Fed balance sheet minus the Treasury’s cash account and reverse repo: cash in the system. Rising liquidity has lifted risk assets.' },
  { key: 'oil', label: 'WTI crude oil', unit: '$', chg: 'pct', gold: 1, nq: -1, why: 'Feeds inflation and geopolitics. Oil spikes help gold and pressure stocks.' },
  { key: 'fed', label: 'Fed funds rate (upper target)', unit: '%', chg: 'bp', gold: -1, nq: -1, why: 'The Fed’s policy rate. Cuts support gold and the Nasdaq; hikes weigh on them.' },
  { key: 'claims', label: 'Weekly jobless claims', unit: 'k', chg: 'pct', gold: 1, nq: -1, why: 'The quickest read on layoffs. Rising claims point to Fed cuts (good for gold) and slower growth (bad for stocks).' },
];

function buildSeries(B) {
  const F = (id) => (B.fred?.[id]?.points?.length ? series(B.fred[id].points, B.fred[id].lag || 0) : null);
  const S = {
    real: F('DFII10'), y10: F('DGS10'), y2: F('DGS2'), be: F('T10YIE'), usd: F('DTWEXBGS'), vix: F('VIXCLS'), hy: F('BAMLH0A0HYM2'),
    fed: F('DFEDTARU'), oil: F('DCOILWTICO'), rrp: F('RRPONTSYD'), walcl: F('WALCL'), tga: F('WTREGEN'), nfci: F('NFCI'), claimsRaw: F('ICSA'),
    cpi: F('CPIAUCSL'), core: F('CPILFESL'), pce: F('PCEPILFE'), un: F('UNRATE'), pay: F('PAYEMS'), sahm: F('SAHMREALTIME'), ff: F('FEDFUNDS'),
  };
  const get = {
    curve: (d) => { const a = valueAt(S.y10, d), b = valueAt(S.y2, d); return a == null || b == null ? null : a - b; },
    liq: (d) => { const w = valueAt(S.walcl, d), g = valueAt(S.tga, d), r = valueAt(S.rrp, d) ?? 0; return w == null || g == null ? null : w / 1000 - g - r; },
    claims: (d) => { const v = valueAt(S.claimsRaw, d); return v == null ? null : v / 1000; },
  };
  for (const k of ['real', 'y10', 'y2', 'be', 'usd', 'vix', 'hy', 'nfci', 'oil', 'fed']) get[k] = (d) => valueAt(S[k], d);
  return { S, get };
}

/** Fed stance from the monthly fed funds average: +1 cutting, -1 hiking, 0 on hold */
function fedStance(S, d) {
  const a = valueAt(S.ff, d), b = valueAt(S.ff, d, 6);
  if (a == null || b == null) return null;
  return a - b <= -0.25 ? 1 : a - b >= 0.25 ? -1 : 0;
}

// ───────────────────────── regimes ─────────────────────────
export const REGIMES = {
  goldilocks: { label: 'Goldilocks', text: 'Growth holding up, inflation cooling' },
  overheat: { label: 'Overheating', text: 'Growth holding up, inflation rising' },
  stagflation: { label: 'Stagflation', text: 'Growth slowing, inflation rising' },
  slowdown: { label: 'Slowdown', text: 'Growth slowing, inflation cooling' },
};
export function regimeAt(S, d) {
  const i = lastLE(S.core?.d || [], d), j = lastLE(S.un?.d || [], d);
  if (i < 12 || j < 11) return null;
  const cv = S.core.v, uv = S.un.v;
  const infl3 = ((cv[i] / cv[i - 3]) ** 4 - 1) * 100, infl12 = (cv[i] / cv[i - 12] - 1) * 100;
  const un3 = mean(uv.slice(j - 2, j + 1)), un12 = mean(uv.slice(j - 11, j + 1));
  const growth = un3 > un12 + 0.1 ? 'slowing' : 'steady';
  const inflation = infl3 > infl12 ? 'rising' : 'cooling';
  const key = growth === 'steady' ? (inflation === 'cooling' ? 'goldilocks' : 'overheat') : (inflation === 'rising' ? 'stagflation' : 'slowdown');
  const fed = fedStance(S, d);
  return { key, growth, inflation, infl3, infl12, un3, un12, fed, cpiMonth: S.core.obs[i], unMonth: S.un.obs[j] };
}
const FED_TEXT = { 1: 'cutting', 0: 'on hold', '-1': 'hiking' };
export const fedText = (f) => (f == null ? 'unknown' : FED_TEXT[f]);

function fwdStats(rows) {
  const out = {};
  for (const h of [1, 3, 6]) {
    const xs = rows.map((r) => r[`f${h}`]).filter((x) => x != null);
    out[h] = { n: xs.length, mean: mean(xs), median: median(xs), up: pct(xs, (x) => x > 0) };
  }
  return out;
}

function regimeStudy(S, px, last) {
  const rows = [];
  for (const d of monthEnds('2005-06-30', last)) {
    const r = regimeAt(S, d); const c = closeAt(px, d);
    if (!r || !c) continue;
    const row = { d, key: r.key, fed: r.fed };
    for (const h of [1, 3, 6]) { const e = addMonths(d, h); row[`f${h}`] = e <= last ? (closeAt(px, e) / c - 1) * 100 : null; }
    rows.push(row);
  }
  const by = (f) => Object.fromEntries(Object.entries(rows.reduce((m, r) => { const k = f(r); if (k != null) (m[k] ||= []).push(r); return m; }, {})).map(([k, v]) => [k, fwdStats(v)]));
  return { all: fwdStats(rows), regime: by((r) => r.key), fed: by((r) => r.fed), combo: by((r) => (r.fed == null ? null : `${r.key}|${r.fed}`)), months: rows.length, from: rows[0]?.d, history: rows.slice(-36).map((r) => ({ d: r.d, key: r.key, fed: r.fed })) };
}

// ───────────────────────── macro score ─────────────────────────
const COMPONENTS = {
  XAUUSD: [
    { key: 'real', label: 'Real yield, 13-week change', sign: -1, unit: 'bp', say: ['falling real yields', 'rising real yields'] },
    { key: 'usd', label: 'Dollar, 13-week change', sign: -1, unit: '%', say: ['a weaker dollar', 'a stronger dollar'] },
    { key: 'be', label: 'Inflation expectations, 13-week change', sign: 1, unit: 'bp', say: ['rising inflation expectations', 'falling inflation expectations'] },
    { key: 'trend', label: 'Trend: price vs 40-week average', sign: 1, unit: '%', say: ['the uptrend', 'the downtrend'] },
    { key: 'fed', label: 'Fed direction (cutting / hiking)', sign: 1, unit: '', say: ['Fed cuts', 'Fed hikes'] },
  ],
  NAS100: [
    { key: 'real', label: 'Real yield, 13-week change', sign: -1, unit: 'bp', say: ['falling real yields', 'rising real yields'] },
    { key: 'hy', label: 'Credit spread, 13-week change', sign: -1, unit: 'bp', say: ['narrowing credit spreads', 'widening credit spreads'] },
    { key: 'nfci', label: 'Financial conditions, 13-week change', sign: -1, unit: '', say: ['easier financial conditions', 'tighter financial conditions'] },
    { key: 'liq', label: 'Fed net liquidity, 13-week change', sign: 1, unit: '%', say: ['rising liquidity', 'falling liquidity'] },
    { key: 'trend', label: 'Trend: price vs 40-week average', sign: 1, unit: '%', say: ['the uptrend', 'the downtrend'] },
    { key: 'fed', label: 'Fed direction (cutting / hiking)', sign: 1, unit: '', say: ['Fed cuts', 'Fed hikes'] },
  ],
};
const CHG = { real: 'bp', usd: 'pct', be: 'bp', hy: 'bp', nfci: 'pts', liq: 'pct' };

function scoreStudy(asset, sr, px, weeks) {
  const comps = COMPONENTS[asset];
  // raw component values at each Friday
  const raw = weeks.map((F, i) => {
    const o = {};
    for (const c of comps) {
      if (c.key === 'trend') {
        if (i < 40) { o.trend = null; continue; }
        const sma = mean(weeks.slice(i - 39, i + 1).map((w) => closeAt(px, w)));
        o.trend = (closeAt(px, F) / sma - 1) * 100;
      } else if (c.key === 'fed') o.fed = fedStance(sr.S, F);
      else o[c.key] = change(CHG[c.key], sr.get[c.key](F), sr.get[c.key](addDays(F, -91)));
    }
    return o;
  });
  const rows = weeks.map((F, i) => {
    const parts = [];
    for (const c of comps) {
      const x = raw[i][c.key];
      if (x == null) continue;
      if (c.key === 'fed') { parts.push({ ...c, raw: x, z: x, contrib: c.sign * x }); continue; }
      const hist = raw.slice(Math.max(0, i - 156), i).map((r) => r[c.key]).filter((v) => v != null);
      if (hist.length < 52) continue;
      const s = stdev(hist); if (!s) continue;
      const z = (x - mean(hist)) / s;
      parts.push({ ...c, raw: x, z, contrib: c.sign * clip(z) });
    }
    const score = parts.length >= 3 ? mean(parts.map((p) => p.contrib)) : null;
    return { d: weeks[i], score, parts, c: closeAt(px, weeks[i]) };
  });
  const last = px.d.at(-1);
  rows.forEach((r) => {
    for (const w of [4, 13]) { const e = addDays(r.d, w * 7); r[`f${w}`] = e <= last && r.c ? (closeAt(px, e) / r.c - 1) * 100 : null; }
  });
  const valid = rows.filter((r) => r.score != null);
  const bucket = (s) => (s >= 0.5 ? 'bull' : s <= -0.5 ? 'bear' : 'neutral');
  const stats = {};
  for (const w of [4, 13]) {
    const all = valid.filter((r) => r[`f${w}`] != null);
    const g = (k) => { const xs = all.filter((r) => bucket(r.score) === k).map((r) => r[`f${w}`]); return { n: xs.length, mean: mean(xs), up: pct(xs, (x) => x > 0) }; };
    const xs = all.map((r) => r[`f${w}`]);
    stats[w] = { all: { n: xs.length, mean: mean(xs), up: pct(xs, (x) => x > 0) }, bull: g('bull'), neutral: g('neutral'), bear: g('bear'), corr: corr(all.map((r) => r.score), xs) };
  }
  return { rows: valid, stats, bucket, from: valid[0]?.d };
}

// ───────────────────────── events ─────────────────────────
function eventStudy(px, events, sr, typeList = ['CPI', 'NFP', 'FOMC']) {
  const since = '2015-01-01';
  const first = lastLE(px.d, since) + 1;
  const reactionDays = new Set();
  const out = {};
  const win = (e) => {
    const i0 = lastLE(px.d, addDays(e.date, -1));
    const i1 = e.type === 'FOMC' ? firstGT(px.d, e.date) : firstGE(px.d, e.date);
    return i0 >= 0 && i1 > i0 && i1 - i0 <= 4 ? [i0, i1] : null;
  };
  const past = events.filter((e) => e.date >= since && e.date <= px.d.at(-1));
  for (const e of past) { const w = win(e); if (w) for (let i = w[0] + 1; i <= w[1]; i++) reactionDays.add(px.d[i]); }
  // a "normal" 1-day and 2-day move, ignoring event days
  const norm1 = [], norm2 = [];
  for (let i = Math.max(first, 2); i < px.c.length; i++) {
    if (!reactionDays.has(px.d[i])) norm1.push(Math.abs(px.c[i] / px.c[i - 1] - 1) * 100);
    if (!reactionDays.has(px.d[i]) && !reactionDays.has(px.d[i - 1])) norm2.push(Math.abs(px.c[i] / px.c[i - 2] - 1) * 100);
  }
  const base1 = mean(norm1), base2 = mean(norm2);
  for (const type of typeList) {
    const rows = [];
    for (const e of past.filter((x) => x.type === type)) {
      const w = win(e); if (!w) continue;
      const [i0, i1] = w;
      const r = (px.c[i1] / px.c[i0] - 1) * 100;
      const f = (k) => (i1 + k < px.c.length ? (px.c[i1 + k] / px.c[i1] - 1) * 100 : null);
      const range = (Math.max(...px.h.slice(i0 + 1, i1 + 1)) - Math.min(...px.l.slice(i0 + 1, i1 + 1))) / px.c[i0] * 100;
      let decision = null;
      if (type === 'FOMC' && sr.S.fed) {
        const b = valueAt(sr.S.fed, addDays(e.date, -1)), a = valueAt(sr.S.fed, addDays(e.date, 7));
        if (a != null && b != null) decision = a > b + 0.01 ? 'hike' : a < b - 0.01 ? 'cut' : 'hold';
      }
      rows.push({ date: e.date, r, f5: f(5), f20: f(20), range, decision });
    }
    const base = type === 'FOMC' ? base2 : base1;
    const summarise = (rs) => {
      const with5 = rs.filter((x) => x.f5 != null), with20 = rs.filter((x) => x.f20 != null);
      const signed = (x, k) => Math.sign(x.r) * x[k];
      return {
        n: rs.length, avgAbs: mean(rs.map((x) => Math.abs(x.r))), up: pct(rs, (x) => x.r > 0), avgRange: mean(rs.map((x) => x.range)),
        cont5: pct(with5, (x) => signed(x, 'f5') > 0), cont20: pct(with20, (x) => signed(x, 'f20') > 0),
        signed5: mean(with5.map((x) => signed(x, 'f5'))), signed20: mean(with20.map((x) => signed(x, 'f20'))),
      };
    };
    const s = summarise(rows);
    const big = rows.filter((x) => base && Math.abs(x.r) >= 1.5 * base);
    const decisions = type === 'FOMC' ? Object.fromEntries(['hike', 'hold', 'cut'].map((k) => [k, summarise(rows.filter((x) => x.decision === k))])) : null;
    out[type] = { ...s, base, multiple: s.avgAbs && base ? s.avgAbs / base : null, big: summarise(big), decisions, recent: rows.slice(-8).reverse(), window: type === 'FOMC' ? '2 days (decision day + next day)' : 'release day' };
  }
  return { types: out, base1, base2 };
}

function intradayStudy(windows, events) {
  const out = {};
  for (const type of ['CPI', 'NFP', 'FOMC']) {
    const rows = [];
    for (const e of events.filter((x) => x.type === type)) {
      const bars = windows?.[`${type}:${e.date}`];
      if (!bars) continue;
      const k = bars.findIndex((b) => b[0] <= e.at && e.at < b[0] + H);
      if (k < 0) continue;
      const pre = bars[k][1];
      const first = bars[k][4] - pre;
      const lastK = bars.reduce((acc, b, i) => (b[0] + H <= e.at + 6 * H ? i : acc), -1);
      if (lastK <= k) continue;
      const move6 = bars[lastK][4] - pre;
      const hi = Math.max(...bars.slice(k, lastK + 1).map((b) => b[2])), lo = Math.min(...bars.slice(k, lastK + 1).map((b) => b[3]));
      rows.push({ date: e.date, pre, first, firstRange: bars[k][2] - bars[k][3], move6, range6: hi - lo });
    }
    const moved = rows.filter((r) => r.first !== 0);
    out[type] = {
      n: rows.length,
      firstAbs: mean(rows.map((r) => Math.abs(r.first))), firstRange: mean(rows.map((r) => r.firstRange)), range6: mean(rows.map((r) => r.range6)),
      reversed: pct(moved, (r) => Math.sign(r.move6) !== Math.sign(r.first)),
      extended: pct(moved, (r) => Math.sign(r.move6) === Math.sign(r.first) && Math.abs(r.move6) > Math.abs(r.first)),
      recent: rows.slice(-6).reverse(),
    };
  }
  return out;
}

// ───────────────────────── ranges, seasonality, positioning ─────────────────────────
function volatility(px) {
  const start = Math.max(1, lastLE(px.d, '2015-01-01'));
  const r = []; for (let i = start; i < px.c.length; i++) r.push(Math.log(px.c[i] / px.c[i - 1]));
  let v = stdev(r.slice(0, 60)) ** 2;
  for (const x of r.slice(60)) v = 0.94 * v + 0.06 * x * x;
  return { ewma: Math.sqrt(v), year: stdev(r.slice(-252)), long: stdev(r) };
}

function ranges(price, sigma) {
  return [['1 day', 1], ['1 week', 5], ['1 month', 21], ['3 months', 63]].map(([label, n]) => {
    const s = sigma * Math.sqrt(n);
    return { label, days: n, sd: s * 100, lo1: price * Math.exp(-s), hi1: price * Math.exp(s), lo2: price * Math.exp(-2 * s), hi2: price * Math.exp(2 * s), pts: price * (Math.exp(s) - 1) };
  });
}

function seasonality(px) {
  const ends = monthEnds(addMonths(px.d[0], 0), px.d.at(-1));
  const byM = Array.from({ length: 12 }, () => []);
  for (let i = 1; i < ends.length; i++) {
    const a = closeAt(px, ends[i - 1]), b = closeAt(px, ends[i]);
    if (a && b && ends[i] <= px.d.at(-1)) byM[new Date(t0(ends[i])).getUTCMonth()].push((b / a - 1) * 100);
  }
  return byM.map((xs, m) => ({ m, n: xs.length, mean: mean(xs), median: median(xs), up: pct(xs, (x) => x > 0) }));
}

function positioning(asset, cot, px) {
  if (!cot?.rows?.length) return null;
  const f = cot.fields;
  const ix = (name) => f.indexOf(name) + 1;
  const oiK = ix('open_interest_all');
  const groups = asset === 'XAUUSD'
    ? [{ key: 'mm', label: 'Hedge funds (managed money)', L: ix('m_money_positions_long_all'), S: ix('m_money_positions_short_all') }]
    : [{ key: 'lev', label: 'Hedge funds (leveraged funds)', L: ix('lev_money_positions_long'), S: ix('lev_money_positions_short') },
      { key: 'am', label: 'Asset managers (pensions, funds)', L: ix('asset_mgr_positions_long'), S: ix('asset_mgr_positions_short') }];
  const last = px.d.at(-1);
  return groups.map((g) => {
    const hist = cot.rows.map((r) => ({ d: r[0], net: r[g.L] - r[g.S], pctOi: ((r[g.L] - r[g.S]) / r[oiK]) * 100 }));
    hist.forEach((h, i) => {
      const w = hist.slice(Math.max(0, i - 156), i + 1).map((x) => x.pctOi);
      h.rank = w.length >= 52 ? (w.filter((x) => x < h.pctOi).length / (w.length - 1)) * 100 : null;
      const known = addDays(h.d, 3); // Tuesday data, published Friday
      const c = closeAt(px, known), e = addDays(known, 91);
      h.f13 = c && e <= last ? (closeAt(px, e) / c - 1) * 100 : null;
    });
    const valid = hist.filter((h) => h.rank != null && h.f13 != null);
    const grp = (f) => { const xs = valid.filter(f).map((h) => h.f13); return { n: xs.length, mean: mean(xs), up: pct(xs, (x) => x > 0) }; };
    const now = hist.at(-1), prev = hist.at(-2), m1 = hist.at(-5);
    return {
      ...g, now, chg1w: prev ? now.net - prev.net : null, chg4w: m1 ? now.net - m1.net : null,
      history: hist.slice(-156), crowdedLong: grp((h) => h.rank >= 90), crowdedShort: grp((h) => h.rank <= 10), middle: grp((h) => h.rank > 10 && h.rank < 90), all: grp(() => true),
    };
  });
}

// ───────────────────────── calendar & headlines ─────────────────────────
export const CAL_RULES = [
  [/Core CPI|CPI|Consumer Price/i, 'CPI', 'Hotter than forecast: yields and the dollar jump, gold and Nasdaq usually drop. Cooler: the reverse. Core (ex food and energy) matters most.'],
  [/ADP/i, 'ADP', 'Private payrolls estimate two days before the official jobs report. Smaller moves, and a weak guide to the real number.'],
  [/Non-Farm|NFP|Employment Change|Payrolls/i, 'NFP', 'Strong jobs: yields up, fewer Fed cuts priced, gold and Nasdaq often dip. Weak jobs: gold usually rallies; Nasdaq depends on whether it reads as “cuts” or “recession”.'],
  [/FOMC|Federal Funds Rate|Fed Chair|Press Conference|Monetary Policy Statement/i, 'FOMC', 'Hawkish (fewer cuts, higher dots): gold and Nasdaq fall. Dovish: both rally. The press conference 30 minutes later often reverses the first move.'],
  [/Core PCE|PCE/i, 'PCE', 'The Fed’s preferred inflation gauge. Same direction as CPI, usually a smaller move because CPI already hinted at it.'],
  [/PPI|Producer Price/i, 'PPI', 'Pipeline inflation. Hot PPI nudges yields up and gold and Nasdaq down; smaller than CPI.'],
  [/Unemployment Rate/i, 'UNRATE', 'A rising rate points to Fed cuts: supportive for gold. Nasdaq likes cuts but not recession fears.'],
  [/Unemployment Claims|Jobless/i, 'CLAIMS', 'Weekly layoffs. A jump in claims supports gold; matters more when the jobs market is the Fed’s focus.'],
  [/JOLTS|Job Openings/i, 'JOLTS', 'Job openings. Fewer openings = cooling labour market = supportive for gold.'],
  [/GDP/i, 'GDP', 'Strong growth lifts yields: slight headwind for gold, mixed for Nasdaq (earnings vs rates).'],
  [/Retail Sales/i, 'RETAIL', 'Consumer strength. Strong sales lift yields and the dollar; gold usually dips.'],
  [/ISM|PMI/i, 'PMI', 'Business surveys; watch the prices-paid parts. Strong = yields up; weak = growth fears.'],
  [/Consumer Sentiment|Consumer Confidence|Inflation Expectations/i, 'SENTIMENT', 'Mostly watched for inflation expectations. A jump in expected inflation supports gold.'],
  [/Bond Auction|Treasury/i, 'AUCTION', 'Weak auction demand pushes yields up: a headwind for gold and Nasdaq.'],
  [/FOMC Member|Fed .* Speaks|Speaks/i, 'SPEECH', 'Fed speakers can shift rate expectations; hawkish remarks weigh on gold and Nasdaq.'],
];

export function classifyEvent(title) { for (const [re, type, text] of CAL_RULES) if (re.test(title)) return { type, text }; return { type: 'OTHER', text: '' }; }

const THEMES = [
  ['Fed', /\bfed\b|fomc|federal reserve|powell|rate cut|rate hike|interest rate|monetary policy|fed chair/i],
  ['Inflation', /inflation|\bcpi\b|\bpce\b|\bppi\b|price pressures/i],
  ['Jobs', /\bjobs?\b|payroll|unemployment|jobless|labor market|labour market|hiring|layoff/i],
  ['Geopolitics', /\bwar\b|missile|attack|iran|israel|russia|ukraine|taiwan|sanction|hormuz|conflict|tensions?|military|strike[sd]? on|drone|ceasefire|truce/i],
  ['Trade', /tariff|trade war|trade deal|export control|import dut/i],
  ['Dollar & yields', /dollar|treasur|yields?|bond market|bonds\b/i],
  ['Tech & AI', /nvidia|apple|microsoft|alphabet|google|amazon|meta\b|tesla|\bai\b|artificial intelligence|chip|semiconductor|nasdaq|tech stocks/i],
  ['Gold', /\bgold\b|bullion|precious metal|silver/i],
  ['Risk', /recession|crash|sell-?off|turmoil|panic|default|bank failure|crisis|slump/i],
  ['Growth', /\bgdp\b|growth|retail sales|consumer spending|\bpmi\b|\bism\b|manufacturing/i],
];
const TILTS = [
  // [pattern, gold, nasdaq, reading]
  [/hawkish|rate hikes?|hike rates|hot(ter)? inflation|inflation (rises|jumps|accelerates|heats)|yields? (rise|rises|jump|jumps|surge|surges|climb|climbs|spike)|strong(er)? (jobs|payrolls|hiring)|dollar (rises|gains|jumps|firms|strengthens|rallies)|fewer (rate )?cuts/i, -1, -1, 'Hawkish / higher yields'],
  [/dovish|rate cuts?|cut rates|cooling inflation|inflation (eases|slows|cools|falls)|yields? (fall|falls|drop|drops|slide|slides|slip|slips|dip|dips|ease|eases|retreat|retreats|tumble)|weak(er)? (jobs|payrolls|hiring)|dollar (falls|slips|weakens|drops|slides)|more (rate )?cuts/i, 1, 1, 'Dovish / lower yields'],
  [/missile|attack|escalat|war\b|strikes? on|drone|hormuz|sanction|military|invasion|tensions (rise|flare|mount)/i, 1, -1, 'Geopolitical risk up'],
  [/ceasefire|truce|peace (deal|talks)|easing tensions|de-escalat/i, -1, 1, 'Geopolitical risk down'],
  [/recession|sell-?off|turmoil|panic|crash|crisis|bank failure|default/i, 1, -1, 'Risk-off'],
  [/(earnings|profit|revenue|results)[^.]{0,30}beat|beats? (on )?(earnings|profit|revenue)/i, 0, 1, 'Earnings beat'],
  [/(retail sales|gdp|pmi|ism|consumer spending|economy)[^.]{0,30}(beats?|tops?|stronger|strong|holds up|accelerat)/i, -1, 0, 'Strong US data'],
  [/(jobless claims|unemployment|layoffs?)[^.]{0,25}(rises?|jumps?|climbs?|highest|surges?)/i, 1, 0, 'Weaker jobs'],
  [/central banks? (buy|bought|add|purchas)|pboc.*gold|gold reserves/i, 1, 0, 'Central-bank gold buying'],
  [/tariff/i, 1, -1, 'Trade tension'],
];
export function tagHeadline(title) {
  const themes = THEMES.filter(([, re]) => re.test(title)).map(([k]) => k);
  let gold = 0, nq = 0; const reads = [];
  for (const [re, g, n, label] of TILTS) if (re.test(title)) { gold += g; nq += n; reads.push(label); }
  // Stocks up or down: the first verb after the stock word decides (so "stocks slide as yields surge" reads as down)
  const sm = title.match(/\b(stocks?|nasdaq|s&p|tech|shares|equities|wall street)\b/i);
  if (sm) {
    const rest = title.slice(sm.index, sm.index + 50);
    const u = rest.search(/\b(record|all-time high|rall(y|ies|ied)|surges?|soars?|jumps?|climbs?|gains?|rises?)\b/i);
    const d = rest.search(/\b(slides?|falls?|drops?|tumbles?|sinks?|slumps?|plunges?|sell-?off|slips?|retreats?)\b/i);
    if (u >= 0 && (d < 0 || u < d)) { nq += 1; reads.push('Stocks up'); } else if (d >= 0) { nq -= 1; reads.push('Stocks down'); }
  }
  // "Gold rises / falls" headlines are about gold itself
  if (/\bgold\b[^.]*\b(rises|gains|jumps|climbs|rall|record|surges)/i.test(title)) gold = Math.max(gold, 1);
  if (/\bgold\b[^.]*\b(falls|drops|slips|slides|tumbles|retreats)/i.test(title)) gold = Math.min(gold, -1);
  return { themes, gold: Math.sign(gold), nq: Math.sign(nq), reads };
}

function headlineStudy(list, now) {
  const items = (list || []).map((h) => ({ ...h, ...tagHeadline(h.title) })).filter((h) => h.themes.length || h.source === 'Federal Reserve');
  const recent = items.filter((h) => now - h.at <= 48 * H);
  const counts = {};
  for (const h of recent) for (const t of h.themes) counts[t] = (counts[t] || 0) + 1;
  const tilt = (k) => { const xs = recent.filter((h) => h[k]); return { up: xs.filter((h) => h[k] > 0).length, down: xs.filter((h) => h[k] < 0).length }; };
  return { items, recent: recent.length, counts: Object.entries(counts).sort((a, b) => b[1] - a[1]), gold: tilt('gold'), nq: tilt('nq') };
}

// ───────────────────────── economy table ─────────────────────────
function economy(S, today) {
  const rows = [];
  const yoy = (s, back = 0) => { const a = valueAt(s, today, back), b = valueAt(s, today, back + 12); return a && b ? (a / b - 1) * 100 : null; };
  const ann3 = (s, back = 0) => { const a = valueAt(s, today, back), b = valueAt(s, today, back + 3); return a && b ? ((a / b) ** 4 - 1) * 100 : null; };
  const push = (key, label, v, prev, unit, month, why, good) => { if (v != null) rows.push({ key, label, v, prev, unit, month, why, good }); };
  push('cpi', 'Headline CPI, year on year', yoy(S.cpi), yoy(S.cpi, 1), '%', obsAt(S.cpi, today), 'All consumer prices. The Fed targets 2% (on PCE).', 'down');
  push('core', 'Core CPI, year on year', yoy(S.core), yoy(S.core, 1), '%', obsAt(S.core, today), 'Without food and energy: the trend the Fed watches.', 'down');
  push('core3', 'Core CPI, last 3 months (annualised)', ann3(S.core), ann3(S.core, 1), '%', obsAt(S.core, today), 'The latest direction. Above the yearly rate = inflation speeding up.', 'down');
  push('pce', 'Core PCE, year on year', yoy(S.pce), yoy(S.pce, 1), '%', obsAt(S.pce, today), 'The Fed’s own target measure.', 'down');
  const un = valueAt(S.un, today), un1 = valueAt(S.un, today, 1);
  push('un', 'Unemployment rate', un, un1, '%', obsAt(S.un, today), 'Rising unemployment pushes the Fed to cut.', 'down');
  const p = (b) => { const a = valueAt(S.pay, today, b), c = valueAt(S.pay, today, b + 3); return a && c ? (a - c) / 3 : null; };
  push('pay', 'Payrolls, 3-month average gain', p(0), p(1), 'k', obsAt(S.pay, today), 'Jobs added per month. Under ~100k is soft; over ~200k is strong.', 'up');
  push('sahm', 'Sahm recession indicator', valueAt(S.sahm, today), valueAt(S.sahm, today, 1), 'pts', obsAt(S.sahm, today), '0.50 or more has marked the start of every US recession since 1970.', 'down');
  push('fed', 'Fed funds rate (upper target)', valueAt(S.fed, today), valueAt(S.fed, addDays(today, -90)), '%', obsAt(S.fed, today), 'The policy rate. Compare with core inflation: the gap is how tight policy is.', null);
  return rows;
}

// ───────────────────────── playbook ─────────────────────────
export const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
function scoreWhy(s) {
  const help = s.parts.filter((p) => p.contrib >= 0.5).map((p) => p.say[0]), hurt = s.parts.filter((p) => p.contrib <= -0.5).map((p) => p.say[1]);
  const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);
  if (!help.length && !hurt.length) return 'No single driver stands out.';
  return [help.length && `Helping: ${list(help)}.`, hurt.length && `Hurting: ${list(hurt)}.`].filter(Boolean).join(' ');
}
const sgn = (x, dp = 1) => (x == null ? '—' : `${x > 0 ? '+' : ''}${x.toFixed(dp)}`);
function lean(votes) {
  const s = votes.reduce((a, v) => a + v, 0);
  return s >= 2 ? 'up' : s <= -2 ? 'down' : s === 1 ? 'slight-up' : s === -1 ? 'slight-down' : 'neutral';
}
export const LEAN_TEXT = { up: 'Tailwind', 'slight-up': 'Slight tailwind', neutral: 'No clear edge', 'slight-down': 'Slight headwind', down: 'Headwind' };

function playbook(asset, a, ctx) {
  const A = ASSETS[asset];
  const out = [];
  // Months: regime + Fed + trend
  {
    const reg = ctx.regime, rs = a.regimes;
    const cur = reg && rs.regime[reg.key]?.[3], base = rs.all[3];
    const combo = reg && reg.fed != null ? rs.combo[`${reg.key}|${reg.fed}`]?.[3] : null;
    const votes = [];
    const pts = [];
    if (cur && cur.n >= 6) {
      votes.push(cur.mean > base.mean + 0.5 ? 1 : cur.mean < base.mean - 0.5 ? -1 : 0);
      pts.push(`Backdrop: ${REGIMES[reg.key].label.toLowerCase()} (${REGIMES[reg.key].text.toLowerCase()}), Fed ${fedText(reg.fed)}. In the ${cur.n} past months like this, ${A.short} moved ${sgn(cur.mean)}% on average over the next 3 months and was higher ${Math.round(cur.up)}% of the time, against ${sgn(base.mean)}% and ${Math.round(base.up)}% for all months.`);
      if (combo && combo.n >= 6) pts.push(`With the Fed also ${fedText(reg.fed)}: ${sgn(combo.mean)}% on average (${combo.n} months, higher ${Math.round(combo.up)}% of the time).`);
    }
    const s = a.score.now;
    if (s) { votes.push(s.score >= 0.5 ? 1 : s.score <= -0.5 ? -1 : 0); pts.push(`Macro score ${sgn(s.score, 2)} (${s.score >= 0.5 ? 'tailwinds' : s.score <= -0.5 ? 'headwinds' : 'mixed'}). ${scoreWhy(s)}`); }
    const tr = s?.parts.find((p) => p.key === 'trend');
    if (tr) { votes.push(tr.raw > 0 ? 1 : -1); pts.push(`Long-term trend is ${tr.raw > 0 ? 'up' : 'down'}: price is ${sgn(tr.raw)}% ${tr.raw > 0 ? 'above' : 'below'} its 40-week average. Trends tend to persist over months more often than not.`); }
    out.push({ horizon: 'Next 1–6 months', lean: lean(votes), votes, points: pts });
  }
  // Weeks: score track record, positioning, events in the next 2 weeks
  {
    const pts = [], votes = [];
    const s = a.score.now, st = a.score.stats[4];
    if (s && st) {
      const b = a.score.bucket(s.score), g = st[b];
      votes.push(b === 'bull' ? 1 : b === 'bear' ? -1 : 0);
      if (g?.n) pts.push(`When the macro score was ${b === 'bull' ? '+0.5 or higher' : b === 'bear' ? '−0.5 or lower' : 'between −0.5 and +0.5'}, the next 4 weeks averaged ${sgn(g.mean)}% (higher ${Math.round(g.up)}% of ${g.n} weeks) vs ${sgn(st.all.mean)}% for all weeks.`);
    }
    for (const p of a.cot || []) {
      if (p.now.rank == null) continue;
      if (p.now.rank >= 90) { votes.push(-1); pts.push(`${p.label} are crowded long (net position higher than ${Math.round(p.now.rank)}% of the last 3 years). Crowded longs leave room for sharp shake-outs.`); }
      else if (p.now.rank <= 10) { votes.push(1); pts.push(`${p.label} are unusually short (lower than ${Math.round(100 - p.now.rank)}% of the last 3 years): fuel for short-covering rallies.`); }
      else pts.push(`${p.label}: net position is in the middle of its 3-year range (${ordinal(Math.round(p.now.rank))} percentile), so no crowding signal.`);
    }
    const soon = ctx.upcoming.filter((e) => e.at - ctx.now <= 14 * DAY && ['CPI', 'NFP', 'FOMC'].includes(e.type));
    if (soon.length) {
      const m = mean(soon.map((e) => a.events.types[e.type]?.multiple || 1));
      pts.push(`Next two weeks: ${soon.map((e) => `${e.type} ${new Date(e.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`).join(', ')}. ${A.short} usually moves ${m.toFixed(1)}× a normal day on these, so expect wider swings around them.`);
    }
    out.push({ horizon: 'Next 1–4 weeks', lean: lean(votes), votes, points: pts });
  }
  // Days: ranges and event behaviour
  {
    const pts = [];
    const d1 = a.ranges[0];
    pts.push(`Typical daily move right now: ±${d1.pts.toFixed(A.dp)} ${A.unit === '$' ? 'dollars' : 'points'} (1 standard deviation, ${d1.sd.toFixed(2)}%). About 2 days in 3 stay inside that.`);
    const next = ctx.upcoming.find((e) => ['CPI', 'NFP', 'FOMC'].includes(e.type));
    if (next) {
      const ev = a.events.types[next.type], iv = a.intraday[next.type];
      pts.push(`Next big release: ${next.label}, ${new Date(next.at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} your time. Since 2015 ${A.short} moved ${ev?.avgAbs?.toFixed(2) ?? '—'}% on average (${ev?.multiple ? ev.multiple.toFixed(1) + '×' : '—'} a normal day).`);
      if (iv?.n >= 5) pts.push(`In the last 2 years the first hour after ${next.type} had reversed 6 hours later ${Math.round(iv.reversed)}% of the time and extended ${Math.round(iv.extended)}% of the time (${iv.n} releases). ${iv.reversed >= 55 ? 'The first spike has usually faded: don’t chase it; let it run into your supply or demand zone and look for the reversal there.' : iv.reversed >= 45 ? 'Chasing the first spike has been a coin flip: wait for the first hourly candle to close and trade the retest of your zone.' : 'The first move has tended to stick: a pullback into your zone in the direction of the first move has been the better trade.'}`);
    }
    pts.push('Use the Daily levels page for today’s ±1SD/±2SD levels and the Asian opening move.');
    out.push({ horizon: 'Today and the next few days', lean: 'neutral', votes: [], points: pts, noLean: true });
  }
  return out;
}

// ───────────────────────── everything ─────────────────────────
export function analyseMacro(B, { now = Date.now() } = {}) {
  const today = ymd(now);
  const sr = buildSeries(B);
  const events = (B.events || []).slice().sort((a, b) => a.at - b.at);
  const upcoming = events.filter((e) => e.at > now).slice(0, 12);
  const regime = regimeAt(sr.S, today);
  const out = { today, regime, upcoming, economy: economy(sr.S, today), assets: {}, missing: B.fredMissing || [], status: B.status || {} };

  // drivers: latest value, changes, z of the 13-week change, link to each asset
  const lastPx = Object.values(B.prices).map((p) => p.daily.at(-1)[0]).sort().at(-1);
  const weeks = fridays('2006-01-06', lastPx);
  const pxs = Object.fromEntries(Object.entries(B.prices).map(([k, p]) => [k, prices(p.daily)]));
  const wret = Object.fromEntries(Object.entries(pxs).map(([k, px]) => [k, weeks.map((w, i) => (i ? Math.log(closeAt(px, w) / closeAt(px, weeks[i - 1])) * 100 : null))]));
  out.drivers = DRIVERS.map((dv) => {
    const g = sr.get[dv.key]; if (!g) return null;
    const v = g(today); if (v == null) return null;
    const chg = (days) => change(dv.chg, v, g(addDays(today, -days)));
    const hist = weeks.slice(-156).map((w) => change(dv.chg, g(w), g(addDays(w, -91)))).filter((x) => x != null);
    const c13 = chg(91);
    const z = c13 != null && hist.length > 30 ? (c13 - mean(hist)) / (stdev(hist) || 1) : null;
    const wchg = weeks.map((w, i) => (i ? change(dv.chg, g(w), g(weeks[i - 1])) : null));
    const link = {};
    for (const k of Object.keys(pxs)) {
      const pairs = (n) => { const a = [], b = []; for (let i = Math.max(1, weeks.length - n); i < weeks.length; i++) if (wchg[i] != null && wret[k][i] != null && Number.isFinite(wret[k][i])) { a.push(wchg[i]); b.push(wret[k][i]); } return [a, b]; };
      const [a1, b1] = pairs(52), [a5, b5] = pairs(260);
      link[k] = { c1: corr(a1, b1), c5: corr(a5, b5), beta: slope(a1, b1) };
    }
    // rolling 26-week correlation with each asset (for the chart)
    const roll = {};
    for (const k of Object.keys(pxs)) roll[k] = weeks.map((w, i) => { if (i < 27) return null; const a = [], b = []; for (let j = i - 25; j <= i; j++) if (wchg[j] != null && Number.isFinite(wret[k][j])) { a.push(wchg[j]); b.push(wret[k][j]); } return corr(a, b); });
    return { ...dv, v, date: obsAt(sr.S[{ curve: 'y10', liq: 'walcl', claims: 'claimsRaw' }[dv.key] || dv.key], today), c1w: chg(7), c1m: chg(28), c3m: c13, z, link, roll, chgUnit: dv.chg === 'bp' ? 'bp' : dv.chg === 'pct' ? '%' : '' };
  }).filter(Boolean);

  for (const [k, px] of Object.entries(pxs)) {
    const price = px.c.at(-1);
    const vol = volatility(px);
    const a = { key: k, ...ASSETS[k], price, date: px.d.at(-1), vol };
    a.ranges = ranges(price, vol.ewma);
    a.events = eventStudy(px, events, sr);
    a.intraday = intradayStudy(B.intraday?.[k], events);
    a.regimes = regimeStudy(sr.S, px, px.d.at(-1));
    const sc = scoreStudy(k, sr, px, weeks.filter((w) => w >= '2007-01-01'));
    a.score = { ...sc, now: sc.rows.at(-1) || null, history: sc.rows.slice(-156) };
    a.seasonality = seasonality(px);
    a.cot = positioning(k, B.cot?.[k], px);
    // week ahead: widen the 1-week range for big releases in the next 7 days
    const wk = upcoming.filter((e) => e.at - now <= 7 * DAY && a.events.types[e.type]?.multiple);
    if (wk.length) {
      const extra = wk.reduce((s, e) => s + (a.events.types[e.type].multiple ** 2 - 1), 0);
      const s = vol.ewma * Math.sqrt(5 + extra);
      a.weekAhead = { events: wk.map((e) => e.type), factor: Math.sqrt((5 + extra) / 5), lo1: price * Math.exp(-s), hi1: price * Math.exp(s), pts: price * (Math.exp(s) - 1) };
    }
    a.series = { d: px.d, c: px.c };
    a.weeks = weeks;
    a.wret = wret[k];
    out.assets[k] = a;
  }
  out.calendar = (B.calendar || []).filter((e) => e.currency === 'USD' && ['high', 'medium'].includes(e.impact)).map((e) => ({ ...e, at: Date.parse(e.date), ...classifyEvent(e.title) }));
  out.headlines = headlineStudy(B.headlines, now);
  for (const k of Object.keys(out.assets)) out.assets[k].playbook = playbook(k, out.assets[k], { regime, upcoming, now });
  out.weeks = weeks;
  out.sr = sr;
  return out;
}

/** Weekly chart data: asset close vs a driver over the last `years` */
export function driverChart(M, assetKey, driverKey, years = 3) {
  const a = M.assets[assetKey], g = M.sr.get[driverKey];
  const from = addDays(M.today, -Math.round(years * 365.25));
  const dv = M.drivers.find((d) => d.key === driverKey);
  return M.weeks.map((w, i) => ({ d: w, price: closeAt({ d: a.series.d, c: a.series.c }, w), driver: g(w), corr: dv?.roll?.[assetKey]?.[i] ?? null })).filter((r) => r.d >= from && r.price != null && r.driver != null);
}
