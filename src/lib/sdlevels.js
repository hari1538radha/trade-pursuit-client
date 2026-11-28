// Daily levels: standard-deviation levels, the opening move and the market state,
// all worked out from hourly futures candles [[t, o, h, l, c], ...] (t = bar start in ms, UTC).
//
//  • A session is one futures trading day: bars run without a gap until the daily break
//    (about 22:00 UTC). Its date is the day it trades into (a session that opens Sunday
//    23:00 UTC is Monday's).
//  • 1SD (daily)  = standard deviation of the last N daily % changes (close to close),
//                   turned into points at the previous close. Levels = previous close ± 1SD, ± 2SD.
//  • 1SD (weekly) = the same on weekly closes, anchored to last week's close.
//  • Opening move = Asian-session range ÷ daily 1SD. Under 1: the day still has room.
//                   Over 1: a normal day's move is already spent, so stand aside.
//  • Market state = ADX(14) plus the slope of the 50 EMA.

const H = 3600e3;
const DAY = 24 * H;
const utcDate = (t) => new Date(t).toISOString().slice(0, 10);
const hourOf = (t) => new Date(t).getUTCHours();

export function stdev(xs) {
  if (xs.length < 2) return null;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Split hourly bars into trading sessions at gaps longer than 90 minutes */
export function toSessions(bars) {
  const out = [];
  let cur = null;
  for (const b of bars) {
    if (!cur || b[0] - cur.bars.at(-1)[0] > 1.5 * H) {
      cur = { bars: [] };
      out.push(cur);
    }
    cur.bars.push(b);
  }
  return out.map((s) => {
    const b = s.bars;
    return {
      date: utcDate(b[0][0] + 3 * H), // the day this session trades into
      start: b[0][0], end: b.at(-1)[0] + H,
      open: b[0][1], high: Math.max(...b.map((x) => x[2])), low: Math.min(...b.map((x) => x[3])), close: b.at(-1)[4],
      bars: b,
    };
  });
}

/** Is the bar inside the Asian window of session date `date`? Window hours are UTC; start > end crosses midnight. */
export function inWindow(t, date, win) {
  const d = utcDate(t), h = hourOf(t);
  if (win.start < win.end) return d === date && h >= win.start && h < win.end;
  const prev = utcDate(Date.parse(date + 'T00:00:00Z') - DAY);
  return (d === prev && h >= win.start) || (d === date && h < win.end);
}

export function windowTimes(date, win) {
  const base = Date.parse(date + 'T00:00:00Z');
  return { from: base + (win.start < win.end ? win.start : win.start - 24) * H, to: base + win.end * H };
}

const weekKey = (date) => {
  const d = new Date(date + 'T00:00:00Z');
  const back = (d.getUTCDay() + 6) % 7; // Monday = 0
  return utcDate(d.getTime() - back * DAY);
};

/** SD levels around an anchor */
export function bands(anchor, sd) {
  return { anchor, sd, p2: anchor + 2 * sd, p1: anchor + sd, m1: anchor - sd, m2: anchor - 2 * sd };
}

// ───────────────────────── Market state ─────────────────────────
function ema(xs, n) {
  const k = 2 / (n + 1);
  let e = xs[0];
  return xs.map((x) => (e = e + (x - e) * k));
}

/** Wilder ADX(14) on [{h,l,c}] */
export function adx(c, n = 14) {
  if (c.length < n * 2 + 2) return null;
  let tr = 0, pdm = 0, mdm = 0, adxV = null;
  const dxs = [];
  for (let i = 1; i < c.length; i++) {
    const up = c[i].h - c[i - 1].h, dn = c[i - 1].l - c[i].l;
    const t = Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c));
    const p = up > dn && up > 0 ? up : 0, m = dn > up && dn > 0 ? dn : 0;
    if (i <= n) { tr += t; pdm += p; mdm += m; if (i < n) continue; }
    else { tr = tr - tr / n + t; pdm = pdm - pdm / n + p; mdm = mdm - mdm / n + m; }
    const pdi = tr ? (100 * pdm) / tr : 0, mdi = tr ? (100 * mdm) / tr : 0;
    const dx = pdi + mdi ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0;
    dxs.push(dx);
    if (dxs.length === n) adxV = dxs.reduce((s, x) => s + x, 0) / n;
    else if (dxs.length > n) adxV = (adxV * (n - 1) + dx) / n;
  }
  return adxV;
}

/** Trending up / trending down / sideways / mixed, from ADX and the 50 EMA */
export function marketState(c) {
  if (c.length < 60) return null;
  const closes = c.map((x) => x.c);
  const e = ema(closes, 50);
  const a = adx(c);
  const trs = c.slice(-14).map((x, i, arr) => (i ? Math.max(x.h - x.l, Math.abs(x.h - arr[i - 1].c), Math.abs(x.l - arr[i - 1].c)) : x.h - x.l));
  const atr = trs.reduce((s, x) => s + x, 0) / trs.length;
  const slope = atr ? (e.at(-1) - e.at(-11)) / atr : 0; // EMA move over 10 bars, in ATRs
  const last = closes.at(-1);
  let state = 'mixed';
  if (a != null && a >= 25 && slope > 0.5 && last > e.at(-1)) state = 'up';
  else if (a != null && a >= 25 && slope < -0.5 && last < e.at(-1)) state = 'down';
  else if (a != null && a < 20) state = 'sideways';
  return { state, adx: a, slope, ema: e.at(-1), last };
}

export const STATE_TEXT = {
  up: { label: 'Trending up', tip: 'Pullbacks are shallow and get bought. Buy pullbacks to support; avoid fading the highs.' },
  down: { label: 'Trending down', tip: 'Rallies get sold. Sell pullbacks to resistance; avoid buying the lows.' },
  sideways: { label: 'Sideways', tip: 'Extremes hold. Fade the ±1SD / ±2SD bands with absorption; don’t chase breakouts.' },
  mixed: { label: 'Mixed', tip: 'No clear trend and not a clean range. Trade smaller, or wait until it settles.' },
};

// ───────────────────────── Everything for the page ─────────────────────────
/**
 * @param bars    hourly futures candles
 * @param opts    { lookback = 20, weeks = 20, win = { start: 0, end: 6 }, basis = 0, now = Date.now(), anchorOverride }
 */
export function analyse(bars, opts = {}) {
  const { lookback = 20, weeks = 20, win = { start: 0, end: 6 }, basis = 0, now = Date.now() } = opts;
  const all = toSessions(bars);
  const lastBar = bars.at(-1)[0];
  const open = now - lastBar <= 75 * 60e3;
  const live = open ? all.at(-1) : null;               // the session trading right now (may be 1 bar old)
  const done = (open ? all.slice(0, -1) : all).filter((s) => s.bars.length >= 3); // drop odd fragments
  const sessions = live ? [...done, live] : done;
  if (done.length < lookback + 2) throw new Error('Not enough history yet');
  const sh = (v) => (v == null ? null : v - basis); // futures → spot/CFD prices

  // The session the levels are for: the live one, or the next one when the market is shut
  let date = live?.date;
  if (!date) {
    let t = Math.max(Date.parse(done.at(-1).date + 'T00:00:00Z') + DAY, Date.parse(utcDate(now + 3 * H) + 'T00:00:00Z'));
    while ([0, 6].includes(new Date(t).getUTCDay())) t += DAY; // no sessions trade into Sat/Sun
    date = utcDate(t);
  }

  // Daily SD
  const closes = done.map((s) => s.close);
  const rets = closes.slice(1).map((c, i) => c / closes[i] - 1);
  const sdPct = stdev(rets.slice(-lookback));
  const prevClose = closes.at(-1);
  const anchor = opts.anchorOverride ?? sh(prevClose);
  const sd = sdPct * prevClose;
  const daily = { ...bands(anchor, sd), sdPct, lookback, prevSession: done.at(-1).date };

  // Weekly SD (only weeks that have finished)
  const curWeek = weekKey(date);
  const wk = new Map();
  for (const s of done) if (weekKey(s.date) !== curWeek) wk.set(weekKey(s.date), s.close);
  const wCloses = [...wk.values()];
  const wRets = wCloses.slice(1).map((c, i) => c / wCloses[i] - 1);
  const wSdPct = stdev(wRets.slice(-weeks));
  const wAnchorF = wCloses.at(-1);
  const weekly = wSdPct == null ? null : { ...bands(opts.weekAnchorOverride ?? sh(wAnchorF), wSdPct * wAnchorF), sdPct: wSdPct, weeks: Math.min(weeks, wRets.length), weekOf: [...wk.keys()].at(-1), week: curWeek };

  // Opening move for that session
  const { from, to } = windowTimes(date, win);
  const asiaBars = (live?.bars || []).filter((b) => inWindow(b[0], date, win));
  const status = now < from ? 'waiting' : now < to && open ? 'forming' : asiaBars.length ? 'done' : 'waiting';
  let opening = { status, from, to, date };
  if (asiaBars.length) {
    const hi = Math.max(...asiaBars.map((b) => b[2])), lo = Math.min(...asiaBars.map((b) => b[3]));
    const ratio = (hi - lo) / sd;
    opening = { ...opening, high: sh(hi), low: sh(lo), range: hi - lo, ratio, left: Math.max(0, sd - (hi - lo)), spent: ratio >= 1, bars: asiaBars.length };
  }

  // Market state: hourly (last ~10 days) and daily (sessions)
  const hc = bars.slice(-240).map((b) => ({ h: b[2], l: b[3], c: b[4] }));
  const dc = sessions.slice(-80).map((s) => ({ h: s.high, l: s.low, c: s.close }));
  const state = { h1: marketState(hc), d1: marketState(dc) };

  // Every past session: was Tradrook-style logic right?
  const history = [];
  for (let k = lookback + 1; k < done.length; k++) {
    const s = done[k], p = done[k - 1];
    const r = closes.slice(k - lookback, k).map((c, i) => c / closes[k - lookback - 1 + i] - 1);
    const sdk = stdev(r) * p.close;
    const a = s.bars.filter((b) => inWindow(b[0], s.date, win));
    if (!sdk || a.length < 2) continue;
    const { to: wEnd } = windowTimes(s.date, win);
    const rest = s.bars.filter((b) => b[0] >= wEnd);
    const ah = Math.max(...a.map((b) => b[2])), al = Math.min(...a.map((b) => b[3]));
    const rh = rest.length ? Math.max(...rest.map((b) => b[2])) : ah, rl = rest.length ? Math.min(...rest.map((b) => b[3])) : al;
    const ext = Math.max(rh - ah, al - rl, 0);
    history.push({
      date: s.date, sd: sdk, asia: ah - al, ratio: (ah - al) / sdk, ext, extSd: ext / sdk,
      touch1: s.high >= p.close + sdk || s.low <= p.close - sdk,
      touch2: s.high >= p.close + 2 * sdk || s.low <= p.close - 2 * sdk,
      in1: Math.abs(s.close - p.close) <= sdk, move: (s.close - p.close) / sdk,
    });
  }
  const pct = (xs, f) => (xs.length ? (xs.filter(f).length / xs.length) * 100 : null);
  const avg = (xs, f) => (xs.length ? xs.reduce((sum, x) => sum + f(x), 0) / xs.length : null);
  const quiet = history.filter((h) => h.ratio < 1), spent = history.filter((h) => h.ratio >= 1);
  const group = (xs) => ({ n: xs.length, avgExt: avg(xs, (h) => h.extSd), half: pct(xs, (h) => h.extSd >= 0.5), touch1: pct(xs, (h) => h.touch1) });
  const stats = {
    n: history.length, from: history[0]?.date, to: history.at(-1)?.date,
    touch1: pct(history, (h) => h.touch1), touch2: pct(history, (h) => h.touch2), in1: pct(history, (h) => h.in1),
    quiet: group(quiet), spent: group(spent),
  };

  // Chart: the last three sessions (plus the live one)
  const chartFrom = (live ? sessions.slice(-4) : sessions.slice(-3))[0].start;
  const chart = bars.filter((b) => b[0] >= chartFrom).map((b) => ({ t: b[0], o: sh(b[1]), h: sh(b[2]), l: sh(b[3]), c: sh(b[4]) }));

  return {
    date, open, lastBar, price: sh(bars.at(-1)[4]), daily, weekly, opening, state,
    history: history.slice(-10).reverse(), stats, chart, sessions: sessions.length,
  };
}

export const WINDOWS = [
  { id: 'tokyo', label: 'Tokyo · 00:00–06:00 UTC', start: 0, end: 6 },
  { id: 'asia', label: 'Full Asia · 23:00–07:00 UTC', start: 23, end: 7 },
  { id: 'sydney', label: 'Sydney + Tokyo · 22:00–06:00 UTC', start: 22, end: 6 },
];
