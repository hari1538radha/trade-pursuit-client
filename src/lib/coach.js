// Coach engine: turns the journal into concrete feedback.
// Everything here is pure (trades in, plain objects out) so it's shared by
// the floating coach panel, the Analytics "Coach" section and the PDF reports.
import { real, summary, groupBy, outcome, tradeScore } from './stats.js';
import { WEEKDAYS, parseYmd } from './dates.js';

const money = (n) => `${n < 0 ? '-' : '+'}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const sortKey = (t) => `${t.date} ${t.entryTime || '99:99'} ${t.createdAt || ''}`;

/** Real trades, newest first */
export const newestFirst = (trades) => real(trades).slice().sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

/**
 * Emotional state over the last N trades.
 * state: 'steady' | 'mixed' | 'tilt' | 'none'
 */
export function emotionCheck(trades, n = 5, be = 0) {
  const last = newestFirst(trades).slice(0, n);
  if (!last.length) return { state: 'none', last: [], pos: [], neg: [], headline: 'Log a trade to see your emotional read.' };
  const count = (key) => {
    const m = new Map();
    for (const t of last) for (const e of t[key] || []) m.set(e, (m.get(e) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
  };
  const pos = count('emotionsPos');
  const neg = count('emotionsNeg');
  const negTotal = neg.reduce((s, x) => s + x.n, 0);
  const posTotal = pos.reduce((s, x) => s + x.n, 0);
  const broke = last.filter((t) => t.followedPlan === false).length;
  const revenge = last.filter((t) => t.postLoss && t.postLoss !== 'No revenge trade' && /revenge/i.test(t.postLoss)).length;
  let lossStreak = 0;
  for (const t of last) { if (outcome(t, be) === 'loss') lossStreak++; else break; }
  const pnl = last.reduce((s, t) => s + (t.pnl || 0), 0);

  let state = 'steady';
  if (negTotal > posTotal || broke >= 2 || revenge >= 1 || lossStreak >= 3) state = 'tilt';
  else if (negTotal > 0 || broke === 1 || lossStreak === 2) state = 'mixed';

  const top = neg[0]?.name;
  const headline =
    state === 'tilt' ? `Tilt risk. ${top ? `"${top}" showed up ${neg[0].n}× ` : ''}${broke ? `${broke} plan break${broke > 1 ? 's' : ''} ` : ''}${lossStreak >= 3 ? `${lossStreak} losses in a row ` : ''}in your last ${last.length}. Slow down before the next entry.`
      : state === 'mixed' ? `Mostly steady, but ${top ? `"${top}" crept in` : lossStreak === 2 ? 'two losses in a row' : 'one plan break'}. Stay with your checklist.`
        : `Calm and on-plan across your last ${last.length} trades. Keep doing exactly this.`;

  return {
    state, headline, pnl, broke, revenge, lossStreak, pos, neg,
    last: last.map((t) => ({ id: t.id, date: t.date, symbol: t.symbol, pnl: t.pnl || 0, pos: t.emotionsPos || [], neg: t.emotionsNeg || [], followedPlan: t.followedPlan !== false, grade: t.grade })),
  };
}

/** Trades in the same day, chronological */
function byDayChrono(ts) {
  const m = new Map();
  for (const t of ts.slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b)))) m.set(t.date, [...(m.get(t.date) || []), t]);
  return m;
}

/**
 * Ranked "don't do this on your next trade" list, each backed by your own numbers.
 * Returns [{ text, why, cost, source }]
 */
export function avoidList(trades, { be = 0, donts = [] } = {}) {
  const ts = real(trades);
  const out = donts.filter(Boolean).map((d) => ({ text: d, why: 'Your own rule', cost: null, source: 'mine' }));
  if (ts.length < 3) return out;
  const push = (text, why, cost) => out.push({ text, why, cost, source: 'data' });

  // Negative emotions that cost money
  for (const g of groupBy(ts, (t) => (t.emotionsNeg || []).filter((e) => !/revenge/i.test(e)), be).filter((g) => g.count >= 2 && g.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 3)) {
    push(`Don't enter when you feel ${g.key.toLowerCase()}`, `${g.count} trades tagged “${g.key}” lost ${money(g.pnl)} (${g.winRate.toFixed(0)}% win rate).`, g.pnl);
  }
  // Plan breaks
  const broke = ts.filter((t) => t.followedPlan === false);
  const brokeP = broke.reduce((s, t) => s + (t.pnl || 0), 0);
  if (broke.length >= 2 && brokeP < 0) push("Don't take a trade that isn't in your plan", `${broke.length} off-plan trades cost ${money(brokeP)}.`, brokeP);
  // Revenge
  const rev = ts.filter((t) => (/revenge/i.test(t.postLoss || '') && !/no revenge/i.test(t.postLoss || '')) || (t.emotionsNeg || []).some((e) => /revenge/i.test(e)));
  const revP = rev.reduce((s, t) => s + (t.pnl || 0), 0);
  if (rev.length && revP < 0) push("Don't re-enter to win back a loss", `${rev.length} revenge trade${rev.length > 1 ? 's' : ''} lost ${money(revP)}.`, revP);
  // After two losses in a day
  let afterTwo = 0, afterTwoN = 0, overP = 0, overDays = 0;
  for (const [, day] of byDayChrono(ts)) {
    let losses = 0;
    day.forEach((t, i) => {
      if (losses >= 2) { afterTwo += t.pnl || 0; afterTwoN++; }
      if (outcome(t, be) === 'loss') losses++;
      if (i >= 2) overP += t.pnl || 0;
    });
    if (day.length >= 3) overDays++;
  }
  if (afterTwoN >= 2 && afterTwo < 0) push('Stop for the day after 2 losses', `Trades taken after two losing trades lost ${money(afterTwo)} over ${afterTwoN} trades.`, afterTwo);
  if (overDays >= 2 && overP < 0) push("Don't take a 3rd trade in a day", `Your 3rd+ trades of the day lost ${money(overP)} across ${overDays} days.`, overP);
  // Session / weekday / setup / symbol leaks
  const worst = (groups, min = 3) => groups.filter((g) => g.count >= min && g.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];
  const ws = worst(groupBy(ts, (t) => (t.session && t.session !== 'No session' ? t.session : null), be));
  if (ws) push(`Skip the ${ws.key} session`, `${ws.count} trades there lost ${money(ws.pnl)} (${ws.winRate.toFixed(0)}% win rate).`, ws.pnl);
  const wd = worst(groupBy(ts, (t) => WEEKDAYS[parseYmd(t.date).getDay()], be));
  if (wd) push(`Size down or sit out on ${wd.key}days`, `${wd.key}days have cost ${money(wd.pnl)} over ${wd.count} trades.`, wd.pnl);
  const wp = worst(groupBy(ts, (t) => t.playbook, be));
  if (wp) push(`Don't take “${wp.key}” setups until you review them`, `${wp.count} trades, ${money(wp.pnl)}, ${wp.winRate.toFixed(0)}% win rate.`, wp.pnl);
  const wsym = worst(groupBy(ts, (t) => t.symbol, be), 4);
  if (wsym) push(`Leave ${wsym.key} alone for now`, `${wsym.count} trades on ${wsym.key} lost ${money(wsym.pnl)}.`, wsym.pnl);
  // Low-quality trades
  const low = ts.filter((t) => t.grade === 'C' || t.grade === 'F');
  const lowP = low.reduce((s, t) => s + (t.pnl || 0), 0);
  if (low.length >= 2 && lowP < 0) push('Only take A or A+ setups', `Trades you graded C or F lost ${money(lowP)} over ${low.length} trades.`, lowP);
  // Cutting winners
  const cut = ts.filter((t) => t.pnl > 0 && Number.isFinite(t.plannedRR) && Number.isFinite(t.realizedRR) && t.realizedRR < t.plannedRR * 0.75);
  if (cut.length >= 3) {
    const lost = cut.reduce((s, t) => s + (t.pnl / Math.max(t.realizedRR, 0.1)) * (t.plannedRR - t.realizedRR), 0);
    push("Don't cut winners before your target", `${cut.length} winners closed well short of plan; roughly $${Math.abs(Math.round(lost)).toLocaleString('en-US')} left on the table.`, -lost);
  }
  // Sort data-driven items by cost (most expensive first), keep the trader's own rules on top
  const mine = out.filter((x) => x.source === 'mine');
  const data = out.filter((x) => x.source === 'data').sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
  return [...mine, ...data];
}

/** What's working (keep doing it) */
export function strengths(trades, be = 0) {
  const ts = real(trades);
  const out = [];
  if (ts.length < 3) return out;
  const best = (groups, min = 3) => groups.filter((g) => g.count >= min && g.pnl > 0).sort((a, b) => b.pnl - a.pnl)[0];
  const p = best(groupBy(ts, (t) => t.playbook, be));
  if (p) out.push({ text: `“${p.key}” is your edge`, why: `${p.count} trades, ${money(p.pnl)}, ${p.winRate.toFixed(0)}% win rate.` });
  const s = best(groupBy(ts, (t) => (t.session && t.session !== 'No session' ? t.session : null), be));
  if (s) out.push({ text: `${s.key} is your session`, why: `${money(s.pnl)} from ${s.count} trades.` });
  const e = best(groupBy(ts, (t) => t.emotionsPos, be), 2);
  if (e) out.push({ text: `When you're ${e.key.toLowerCase()}, you make money`, why: `${e.count} trades, ${money(e.pnl)}.` });
  const plan = ts.filter((t) => t.followedPlan !== false);
  const planP = plan.reduce((a, t) => a + (t.pnl || 0), 0);
  if (plan.length >= 3 && planP > 0) out.push({ text: 'Your plan works when you follow it', why: `On-plan trades made ${money(planP)} (${money(planP / plan.length)} per trade).` });
  return out;
}

/** Discipline score (avg trade score), consistency and a 3-point improvement plan */
export function improvementPlan(trades, opts = {}) {
  const be = opts.be || 0;
  const ts = real(trades);
  const s = summary(ts, be);
  const avoid = avoidList(ts, { be }).filter((x) => x.source === 'data');
  const discipline = ts.length ? Math.round(ts.reduce((a, t) => a + tradeScore(t).score, 0) / ts.length) : 0;
  const planRate = ts.length ? (ts.filter((t) => t.followedPlan !== false).length / ts.length) * 100 : 0;
  const journaled = ts.length ? (ts.filter((t) => (t.notes || '').length > 20).length / ts.length) * 100 : 0;
  const focus = [];
  for (const a of avoid.slice(0, 3)) focus.push({ title: a.text, detail: a.why });
  if (focus.length < 3 && planRate < 90) focus.push({ title: 'Follow your plan on every trade', detail: `Only ${planRate.toFixed(0)}% of trades were on-plan. Target 90%+.` });
  if (focus.length < 3 && journaled < 70) focus.push({ title: 'Write a note on every trade', detail: `${journaled.toFixed(0)}% of trades have a real note. Your review depends on it.` });
  if (focus.length < 3 && s.avgLoss > s.avgWin && s.count >= 5) focus.push({ title: 'Make winners bigger than losers', detail: `Average loss (${money(-s.avgLoss)}) is larger than average win (${money(s.avgWin)}).` });
  if (focus.length < 3) focus.push({ title: 'Keep risk per trade fixed', detail: 'Same risk every trade makes your stats trustworthy and your evals survivable.' });
  return { summary: s, discipline, planRate, journaled, focus: focus.slice(0, 3), strengths: strengths(ts, be) };
}
