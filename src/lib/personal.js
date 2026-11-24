// Calculations for the admin's personal pages: prop-firm payouts, money, lifestyle.
// Pure functions so they're easy to test and reuse.

export const monthKey = (ymd) => ymd.slice(0, 7);
export const monthLabel = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
export const ymdOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const ymOf = (d = new Date()) => ymdOf(d).slice(0, 7);
export const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return ymOf(d); };
/** Every month from a to b inclusive (YYYY-MM) */
export function monthsBetween(a, b) { const out = []; for (let m = a; m <= b && out.length < 600; m = addMonths(m, 1)) out.push(m); return out; }

const sum = (xs, f) => xs.reduce((s, x) => s + (f(x) || 0), 0);
const r2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- Prop firms
/**
 * Purchases (USD fee) vs payouts (gross / fee / net): totals, firm scorecard, monthly cash and insights.
 */
export function propAnalysis(purchases, payouts) {
  const spent = r2(sum(purchases, (p) => p.fee));
  const net = r2(sum(payouts, (p) => p.net));
  const gross = r2(sum(payouts, (p) => p.gross));
  const fees = r2(sum(payouts, (p) => p.fee));
  const position = r2(net - spent);
  const ratio = spent ? (net / spent) * 100 : 0;

  // Firm scorecard
  const firms = new Map();
  for (const p of purchases) { const f = firms.get(p.firm) || { firm: p.firm, count: 0, spent: 0, received: 0, payouts: 0 }; f.count++; f.spent += p.fee; firms.set(p.firm, f); }
  for (const p of payouts) { const f = firms.get(p.firm) || { firm: p.firm, count: 0, spent: 0, received: 0, payouts: 0 }; f.received += p.net; f.payouts++; firms.set(p.firm, f); }
  const byFirm = [...firms.values()].map((f) => ({ ...f, spent: r2(f.spent), received: r2(f.received), pnl: r2(f.received - f.spent), share: spent ? (f.spent / spent) * 100 : 0, recovered: f.spent ? (f.received / f.spent) * 100 : 0 }))
    .sort((a, b) => b.spent - a.spent);

  // Monthly cash
  const all = [...purchases.map((p) => p.date), ...payouts.map((p) => p.date)].sort();
  const monthly = [];
  if (all.length) {
    let cum = 0;
    for (const m of monthsBetween(monthKey(all[0]), monthKey(all.at(-1)))) {
      const buys = purchases.filter((p) => monthKey(p.date) === m);
      const pays = payouts.filter((p) => monthKey(p.date) === m);
      const s = r2(sum(buys, (p) => p.fee)), pin = r2(sum(pays, (p) => p.net));
      cum = r2(cum + pin - s);
      monthly.push({ m, label: monthLabel(m), spend: s, count: buys.length, payouts: pin, payoutCount: pays.length, net: r2(pin - s), cum });
    }
  }
  const low = monthly.reduce((a, x) => (x.cum < (a?.cum ?? Infinity) ? x : a), null);
  const avgNetPayout = payouts.length ? net / payouts.length : 0;
  const recentPayouts = payouts.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-3);
  const avgRecent = recentPayouts.length ? sum(recentPayouts, (p) => p.net) / recentPayouts.length : avgNetPayout;
  const spendMonths = monthly.filter((x) => x.spend > 0);
  const avgMonthlySpend = spendMonths.length ? sum(spendMonths, (x) => x.spend) / spendMonths.length : 0;

  // Break-even scenarios over the next 3 months
  const deficit = Math.max(0, -position);
  const scenarios = [0, 250, Math.round(avgMonthlySpend)].filter((v, i, a) => a.indexOf(v) === i).map((buy) => {
    const need = deficit + 3 * buy;
    return { buy, need: r2(need), payouts: avgRecent ? need / avgRecent : null };
  });

  // Plain-language insights
  const insights = [];
  if (spent) insights.push(`You've got back $${(net / spent).toFixed(2)} for every $1 spent on accounts (${ratio.toFixed(1)}%).`);
  const best = byFirm.filter((f) => f.spent > 0).sort((a, b) => b.recovered - a.recovered)[0];
  if (best && best.recovered >= 100) insights.push(`${best.firm} has paid for itself: ${best.recovered.toFixed(1)}% recovered (${fmtUsd(best.pnl, true)}).`);
  const worst = byFirm.filter((f) => f.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];
  if (worst && position < 0) insights.push(`${worst.firm} is the biggest drag: ${worst.share.toFixed(1)}% of spend, ${worst.recovered.toFixed(1)}% recovered; its ${fmtUsd(worst.pnl, true)} is ${Math.min(100, (-worst.pnl / -position) * 100).toFixed(0)}% of the deficit.`);
  const zero = byFirm.filter((f) => f.received === 0 && f.spent > 0);
  if (zero.length) insights.push(`No payout yet from ${zero.map((f) => f.firm).join(', ')}: ${fmtUsd(sum(zero, (f) => f.spent))} (${((sum(zero, (f) => f.spent) / spent) * 100).toFixed(1)}% of spend).`);
  if (low && low.cum < 0) insights.push(`The deficit peaked at ${fmtUsd(low.cum, true)} in ${low.label}${position > low.cum ? ` and has since narrowed by ${fmtUsd(position - low.cum)}` : ''}.`);
  const peak = monthly.reduce((a, x) => (x.spend > (a?.spend ?? 0) ? x : a), null);
  if (peak && peak.spend > avgMonthlySpend * 1.6) insights.push(`${peak.label} was the heaviest buying month: ${peak.count} accounts for ${fmtUsd(peak.spend)}.`);
  if (gross && fees) insights.push(`Withdrawal fees took ${fmtUsd(fees)} (${((fees / gross) * 100).toFixed(1)}% of gross payouts).`);
  const last30 = payouts.filter((p) => p.date >= ymdOf(new Date(Date.now() - 30 * 864e5)));
  const spend30 = purchases.filter((p) => p.date >= ymdOf(new Date(Date.now() - 30 * 864e5)));
  if (last30.length || spend30.length) insights.push(`Last 30 days: ${fmtUsd(sum(spend30, (p) => p.fee))} spent on ${spend30.length} account${spend30.length === 1 ? '' : 's'}, ${fmtUsd(sum(last30, (p) => p.net))} received from ${last30.length} payout${last30.length === 1 ? '' : 's'}.`);

  return { spent, net, gross, fees, position, ratio, count: purchases.length, payoutCount: payouts.length, byFirm, monthly, low, avgNetPayout, avgRecent, avgMonthlySpend, scenarios, insights };
}

export const fmtUsd = (n, signed = false) => (n == null || !Number.isFinite(n) ? '—' : `${signed ? (n < 0 ? '−' : n > 0 ? '+' : '') : n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const fmtInr = (n, signed = false) => (n == null || !Number.isFinite(n) ? '—' : `${signed ? (n < 0 ? '−' : n > 0 ? '+' : '') : n < 0 ? '−' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`);

// ---------------------------------------------------------------- Money
export const EXPENSE_CATS = ['Food', 'Groceries', 'Petrol', 'Card bill', 'Rent', 'Bills', 'Shopping', 'Health', 'Travel', 'Family', 'Entertainment', 'Education', 'Other'];
export const INCOME_CATS = ['Salary', 'Trading payout', 'Freelance', 'Business', 'Interest', 'Gift', 'Other'];
export const PAY_METHODS = ['UPI', 'Credit card – Card', 'Credit card – UPI', 'Debit card', 'Cash', 'Bank', 'Wallet'];
export const isCredit = (m) => /^credit card/i.test(m || '');

// ---------------------------------------------------------------- Investments and loans
const monthsDiff = (from, to) => {
  const [y1, m1, d1] = from.split('-').map(Number); const [y2, m2, d2] = to.split('-').map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) + (d2 - d1) / 30.44);
};
const PER_YEAR = { yearly: 1, quarterly: 4, monthly: 12 };
/** Amount after `months` at `rate` % a year, simple or compounded */
export function grow(principal, rate, months, compounding = 'simple') {
  const t = months / 12, r = rate / 100;
  if (compounding === 'simple' || !PER_YEAR[compounding]) return principal * (1 + r * t);
  const n = PER_YEAR[compounding];
  return principal * (1 + r / n) ** (n * t);
}
/** Monthly instalment for a loan of `principal` at `rate` % a year over `months` */
export function emiFor(principal, rate, months) {
  const i = rate / 1200;
  if (!months) return null;
  if (!i) return principal / months;
  return (principal * i * (1 + i) ** months) / ((1 + i) ** months - 1);
}
/**
 * Where an investment or loan stands today.
 * Investment: value now, gain so far, and value at maturity if it has a term.
 * Loan with a term: EMI, interest paid so far, interest over the whole loan, amount still owed.
 * Loan without a term: interest that has built up on it so far.
 */
export function holdingNow(h, asOf = ymdOf()) {
  const elapsed = Math.min(monthsDiff(h.start, asOf), h.months || Infinity);
  const comp = h.compounding || 'simple';
  if (h.kind === 'investment') {
    const value = grow(h.principal, h.rate, elapsed, comp);
    const maturity = h.months ? grow(h.principal, h.rate, h.months, comp) : null;
    return { elapsed, value: r2(value), gain: r2(value - h.principal), maturity: maturity && r2(maturity), maturityGain: maturity && r2(maturity - h.principal), done: h.months ? elapsed >= h.months : false };
  }
  if (h.months) {
    const emi = emiFor(h.principal, h.rate, h.months);
    const k = Math.min(Math.floor(elapsed), h.months), i = h.rate / 1200;
    const owed = i ? h.principal * (1 + i) ** k - emi * (((1 + i) ** k - 1) / i) : h.principal - emi * k;
    const paid = emi * k;
    const interestPaid = paid - (h.principal - owed);
    return { elapsed, emi: r2(emi), paidMonths: k, owed: r2(Math.max(0, owed)), interestPaid: r2(interestPaid), totalInterest: r2(emi * h.months - h.principal), totalPay: r2(emi * h.months), done: k >= h.months };
  }
  const owed = grow(h.principal, h.rate, elapsed, comp);
  return { elapsed, owed: r2(owed), interestPaid: 0, accrued: r2(owed - h.principal), totalInterest: null, done: false };
}
/** Totals across all open holdings */
export function holdingsSummary(list, asOf = ymdOf()) {
  const open = list.filter((h) => !h.closed);
  const inv = open.filter((h) => h.kind === 'investment').map((h) => ({ h, n: holdingNow(h, asOf) }));
  const loans = open.filter((h) => h.kind === 'loan').map((h) => ({ h, n: holdingNow(h, asOf) }));
  const invested = sum(inv, (x) => x.h.principal), value = sum(inv, (x) => x.n.value);
  const owed = sum(loans, (x) => x.n.owed), interestPaid = sum(loans, (x) => x.n.interestPaid + (x.n.accrued || 0));
  const monthlyEmi = sum(loans, (x) => (x.n.done ? 0 : x.n.emi));
  // Interest earned each year vs paid each year, at today's balances
  const earnYear = sum(inv, (x) => x.n.value * (x.h.rate / 100));
  const payYear = sum(loans, (x) => x.n.owed * (x.h.rate / 100));
  return { invested: r2(invested), value: r2(value), gain: r2(value - invested), owed: r2(owed), interestPaid: r2(interestPaid), monthlyEmi: r2(monthlyEmi), earnYear: r2(earnYear), payYear: r2(payYear), netWorth: r2(value - owed), inv, loans };
}

/** EMI status for a given month */
export function emiStatus(e, ym = ymOf()) {
  const end = addMonths(e.start, e.months - 1);
  const active = ym >= e.start && ym <= end;
  const paidCount = (e.paid || []).length;
  const left = Math.max(0, e.months - paidCount);
  return { end, active, paidThisMonth: (e.paid || []).includes(ym), paidCount, left, remainingAmount: left * e.amount, progress: e.months ? (paidCount / e.months) * 100 : 0 };
}

/** One month of money: income, expenses by category, EMIs due, eval spend (₹) */
export function moneyMonth({ entries, emis, purchases, ym, usdInr }) {
  const inM = (x) => monthKey(x.date) === ym;
  const exp = entries.filter((e) => e.kind === 'expense' && inM(e));
  const inc = entries.filter((e) => e.kind === 'income' && inM(e));
  const evals = purchases.filter(inM);
  const evalInr = sum(evals, (p) => p.inr || p.fee * usdInr);
  const emiDue = emis.filter((e) => emiStatus(e, ym).active);
  const emiTotal = sum(emiDue, (e) => e.amount);
  const cats = new Map();
  for (const e of exp) cats.set(e.category, (cats.get(e.category) || 0) + e.amount);
  if (emiTotal) cats.set('EMIs', emiTotal);
  if (evalInr) cats.set('Prop-firm evals', evalInr);
  const expenses = sum(exp, (e) => e.amount);
  const income = sum(inc, (e) => e.amount);
  const outgo = expenses + emiTotal + evalInr;
  return {
    ym, income, expenses, emiTotal, evalInr, evalCount: evals.length, outgo, saved: income - outgo,
    savingsRate: income ? ((income - outgo) / income) * 100 : null,
    byCategory: [...cats.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v),
    emiDue, entries: [...exp, ...inc],
  };
}

// ---------------------------------------------------------------- Lifestyle
export const DEFAULT_LIFE = {
  habits: [{ id: 'wake', name: 'Wake up on time' }, { id: 'gym', name: 'Workout' }, { id: 'read', name: 'Read 20 min' }, { id: 'journal', name: 'Journal every trade' }, { id: 'nojunk', name: 'No junk food' }],
  targets: { sleep: 7.5, workout: 45, steps: 8000, water: 3, meditation: 10, calories: 2200, protein: 120, screen: 3 },
  weightGoal: null,
  dietPlan: { breakfast: '', lunch: '', dinner: '', snacks: '', rules: '' },
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const avg = (xs) => { const v = xs.filter((x) => x != null && Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const pct = (x) => (x == null ? null : Math.round(x * 100));

/**
 * Scores for one day (0–100; null when nothing was logged for that part).
 *  habits     = share of your habits ticked
 *  health     = sleep, workout, steps and water against your targets
 *  diet       = calories near target, protein reached, no junk food
 *  mind       = mood and energy (1–5), meditation, screen time under target
 *  trading    = share of that day's trades that followed the plan (if you traded)
 *  discipline = habits 50% + diet 25% + trading plan 25% (re-weighted when a part is missing)
 *  lifestyle  = average of habits, health, diet and mind
 */
export function dayScores(d, life = DEFAULT_LIFE, dayTrades = []) {
  const t = { ...DEFAULT_LIFE.targets, ...(life.targets || {}) };
  const habitIds = (life.habits || []).map((h) => h.id);
  const done = habitIds.filter((h) => d?.habits?.[h]).length;
  const anyHabit = habitIds.some((h) => d?.habits?.[h] !== undefined);
  const habits = habitIds.length && anyHabit ? done / habitIds.length : null;
  const health = avg([d?.sleep != null ? clamp01(d.sleep / t.sleep) : null, d?.workout != null ? clamp01(d.workout / t.workout) : null, d?.steps != null ? clamp01(d.steps / t.steps) : null, d?.water != null ? clamp01(d.water / t.water) : null]);
  const cal = d?.calories != null && t.calories ? clamp01(1 - Math.max(0, Math.abs(d.calories - t.calories) / t.calories - 0.1) * 2) : null;
  const prot = d?.protein != null && t.protein ? clamp01(d.protein / t.protein) : null;
  let diet = avg([cal, prot, d?.junk === true ? 0 : d?.junk === false ? 1 : null]);
  const mind = avg([d?.mood != null ? clamp01((d.mood - 1) / 4) : null, d?.energy != null ? clamp01((d.energy - 1) / 4) : null, d?.meditation != null ? clamp01(d.meditation / (t.meditation || 10)) : null, d?.screen != null && t.screen ? clamp01(1 - Math.max(0, d.screen - t.screen) / t.screen) : null]);
  const real = dayTrades.filter((x) => !x.noTrade);
  const trading = real.length ? real.filter((x) => x.followedPlan !== false).length / real.length : null;
  const parts = [[habits, 0.5], [diet, 0.25], [trading, 0.25]].filter(([v]) => v != null);
  const w = parts.reduce((s, [, k]) => s + k, 0);
  const discipline = w ? parts.reduce((s, [v, k]) => s + v * k, 0) / w : null;
  const lifestyle = avg([habits, health, diet, mind]);
  if (diet != null) diet = Math.max(0, diet);
  return { habits: pct(habits), health: pct(health), diet: pct(diet), mind: pct(mind), trading: pct(trading), discipline: pct(discipline), lifestyle: pct(lifestyle), done, of: habitIds.length };
}

/** Current streak of days where a habit was done (counting back from yesterday, or today if done) */
export function habitStreak(days, habitId, todayYmd = ymdOf()) {
  const by = new Map(days.map((d) => [d.date, d]));
  let n = 0;
  const cur = new Date(`${todayYmd}T00:00:00`);
  if (!by.get(todayYmd)?.habits?.[habitId]) cur.setDate(cur.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    if (by.get(ymdOf(cur))?.habits?.[habitId]) { n++; cur.setDate(cur.getDate() - 1); } else break;
  }
  return n;
}
