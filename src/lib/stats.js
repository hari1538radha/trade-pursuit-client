import { WEEKDAYS, parseYmd } from './dates.js';

export const real = (trades) => trades.filter((t) => !t.noTrade);

export function outcome(t, be = 0) {
  if (t.pnl > be) return 'win';
  if (t.pnl < -be) return 'loss';
  return 'be';
}

export function summary(trades, be = 0) {
  const ts = real(trades);
  const wins = ts.filter((t) => outcome(t, be) === 'win');
  const losses = ts.filter((t) => outcome(t, be) === 'loss');
  const gross = (a) => a.reduce((s, t) => s + (t.pnl || 0), 0);
  const gw = gross(wins), gl = Math.abs(gross(losses));
  const rrs = wins.map((t) => t.realizedRR).filter((n) => Number.isFinite(n));
  const decided = wins.length + losses.length;
  const pnls = ts.map((t) => t.pnl || 0);
  return {
    count: ts.length,
    wins: wins.length,
    losses: losses.length,
    be: ts.length - decided,
    total: gross(ts),
    winRate: decided ? (wins.length / decided) * 100 : 0,
    avgWin: wins.length ? gw / wins.length : 0,
    avgLoss: losses.length ? gl / losses.length : 0,
    profitFactor: gl ? gw / gl : gw > 0 ? Infinity : 0,
    avgWinRR: rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : null,
    best: pnls.length ? Math.max(...pnls) : 0,
    worst: pnls.length ? Math.min(...pnls) : 0,
    expectancy: ts.length ? gross(ts) / ts.length : 0,
  };
}

export function byDay(trades) {
  const m = new Map();
  for (const t of real(trades)) {
    const d = m.get(t.date) || { date: t.date, pnl: 0, count: 0, wins: 0 };
    d.pnl += t.pnl || 0; d.count++; if (t.pnl > 0) d.wins++;
    m.set(t.date, d);
  }
  return m;
}

export function cumulative(trades) {
  const days = [...byDay(trades).values()].sort((a, b) => a.date.localeCompare(b.date));
  let run = 0, peak = 0, maxDD = 0;
  return days.map((d) => {
    run += d.pnl; peak = Math.max(peak, run); maxDD = Math.min(maxDD, run - peak);
    return { date: d.date, pnl: d.pnl, cum: +run.toFixed(2), dd: +(run - peak).toFixed(2), maxDD };
  });
}

/** Group by a key function -> [{key, count, pnl, winRate}] */
export function groupBy(trades, keyFn, be = 0) {
  const m = new Map();
  for (const t of real(trades)) {
    const keys = [].concat(keyFn(t) ?? []).filter((k) => k !== '' && k != null);
    for (const k of keys) {
      const g = m.get(k) || { key: k, count: 0, pnl: 0, wins: 0, losses: 0 };
      g.count++; g.pnl += t.pnl || 0;
      const o = outcome(t, be); if (o === 'win') g.wins++; if (o === 'loss') g.losses++;
      m.set(k, g);
    }
  }
  return [...m.values()].map((g) => ({ ...g, pnl: +g.pnl.toFixed(2), winRate: g.wins + g.losses ? (g.wins / (g.wins + g.losses)) * 100 : 0, avg: g.pnl / g.count }));
}

export const byWeekday = (t, be) => {
  const g = groupBy(t, (x) => WEEKDAYS[parseYmd(x.date).getDay()], be);
  return WEEKDAYS.slice(1, 6).map((d) => g.find((x) => x.key === d) || { key: d, count: 0, pnl: 0, winRate: 0 });
};
export const byHour = (t, be) =>
  groupBy(t, (x) => (x.entryTime ? `${x.entryTime.slice(0, 2)}:00` : null), be).sort((a, b) => a.key.localeCompare(b.key));

/** Pairs of confluence/confirmation chips that appear together */
export function combos(trades, be = 0) {
  return groupBy(
    trades,
    (t) => {
      const chips = [...new Set([...(t.confluences || []), ...(t.confirmations || []), ...(t.bonus || [])])].sort();
      const out = [];
      for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) out.push(`${chips[i]} + ${chips[j]}`);
      return out;
    },
    be
  ).sort((a, b) => b.pnl - a.pnl);
}

export function streaks(trades, be = 0) {
  const ts = real(trades).slice().sort((a, b) => (a.date + (a.entryTime || '')).localeCompare(b.date + (b.entryTime || '')));
  let w = 0, l = 0, mw = 0, ml = 0;
  for (const t of ts) {
    const o = outcome(t, be);
    if (o === 'win') { w++; l = 0; } else if (o === 'loss') { l++; w = 0; } else { w = 0; l = 0; }
    mw = Math.max(mw, w); ml = Math.max(ml, l);
  }
  return { maxWin: mw, maxLoss: ml, current: w ? `${w}W` : l ? `${l}L` : '—' };
}

const GRADE_PTS = { 'A+': 25, A: 20, B: 10, C: 0, F: -20, '': 0 };
export function tradeScore(t) {
  let s = 50 + (GRADE_PTS[t.grade || ''] ?? 0);
  s += t.followedPlan === false ? -15 : 10;
  if (t.notes && t.notes.length > 20) s += 5;
  if ((t.confluences || []).length + (t.confirmations || []).length >= 2) s += 5;
  if (Number.isFinite(t.realizedRR) && Number.isFinite(t.plannedRR) && t.realizedRR >= t.plannedRR) s += 5;
  s -= Math.min(15, (t.emotionsNeg || []).length * 5);
  if (t.postLoss && t.postLoss !== 'No revenge trade') s -= 10;
  s = Math.max(0, Math.min(100, Math.round(s)));
  const label = s >= 90 ? 'Elite' : s >= 75 ? 'Strong' : s >= 60 ? 'Solid' : s >= 40 ? 'Mixed' : 'Weak';
  return { score: s, label };
}

/** Plain-language insights from the data */
export function insights(trades, be = 0) {
  const out = [];
  const ts = real(trades);
  if (ts.length < 3) return ['Log a few more trades and patterns will show up here.'];
  const s = summary(ts, be);
  const plan = groupBy(ts, (t) => (t.followedPlan === false ? 'Broke plan' : 'Followed plan'), be);
  const fp = plan.find((g) => g.key === 'Followed plan'), bp = plan.find((g) => g.key === 'Broke plan');
  if (fp && bp) out.push(`When you follow your plan you average ${fmt(fp.avg)} a trade; when you break it, ${fmt(bp.avg)}.`);
  const wd = byWeekday(ts, be).filter((d) => d.count);
  if (wd.length > 1) {
    const best = wd.reduce((a, b) => (b.pnl > a.pnl ? b : a)), worst = wd.reduce((a, b) => (b.pnl < a.pnl ? b : a));
    out.push(`${best.key} is your best day (${fmt(best.pnl)}); ${worst.key} is your weakest (${fmt(worst.pnl)}).`);
  }
  const sess = groupBy(ts, (t) => t.session, be).filter((g) => g.count >= 2).sort((a, b) => b.pnl - a.pnl);
  if (sess.length) out.push(`${sess[0].key} is your most profitable session at ${sess[0].winRate.toFixed(0)}% win rate.`);
  const neg = groupBy(ts, (t) => t.emotionsNeg, be).sort((a, b) => a.pnl - b.pnl);
  if (neg[0] && neg[0].pnl < 0) out.push(`Trades tagged “${neg[0].key}” have cost you ${fmt(neg[0].pnl)} across ${neg[0].count} trades.`);
  const sym = groupBy(ts, (t) => t.symbol, be).sort((a, b) => b.pnl - a.pnl);
  if (sym.length > 1) out.push(`${sym[0].key} pays you the most; ${sym.at(-1).key} the least.`);
  const st = streaks(ts, be);
  out.push(`Longest win streak ${st.maxWin}, longest losing streak ${st.maxLoss}. Expectancy is ${fmt(s.expectancy)} per trade.`);
  return out;
}
const fmt = (n) => `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(0)}`;
