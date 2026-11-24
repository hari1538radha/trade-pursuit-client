import catalog from '@shared/firms.json';

export const FIRM_NOTE = catalog.note;
export const FIRMS = catalog.firms;
export const findFirm = (id, list = FIRMS) => list.find((f) => f.id === id);

/** Built-in firms plus the ones you added or edited (same id = your edited copy wins) */
export function mergeFirms(custom = []) {
  const mine = new Map((custom || []).map((f) => [f.id, f]));
  const out = FIRMS.map((f) => (mine.has(f.id) ? { ...mine.get(f.id), edited: true } : f));
  for (const f of custom || []) if (!FIRMS.some((b) => b.id === f.id)) out.push({ ...f, custom: true });
  return out;
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
/** Empty firm for the editor: one 2-step program with typical % rules */
export function blankFirm(name = '') {
  return {
    id: `my-${slug(name) || Date.now().toString(36)}`, name, short: '', type: 'CFD', color: '#2f4bd8',
    programs: [{ id: '2step', name: '2 Step', tagline: '', variants: [{ id: 'standard', name: 'Standard', unit: 'pct',
      phases: [{ name: 'Phase 1', target: 8, maxLoss: 10, maxLossType: 'Static', daily: 5, minDays: 3, minTrades: 0, consistency: null }, { name: 'Phase 2', target: 5, maxLoss: 10, maxLossType: 'Static', daily: 5, minDays: 3, minTrades: 0, consistency: null }],
      funded: { target: null, maxLoss: 10, maxLossType: 'Static', daily: 5, minDays: 0, minTrades: 0, consistency: null },
      sizes: [{ size: 10000, price: 70 }, { size: 25000, price: 150 }, { size: 50000, price: 280 }, { size: 100000, price: 500 }] }] }],
  };
}

/** Find the catalog program/variant an account was bought from */
export function variantOf(account, firms) {
  const firm = findFirm(account.firmId, firms);
  if (!firm) return null;
  const prog = firm.programs.find((p) => p.id === account.programId) || firm.programs.find((p) => p.name === account.program) || null;
  if (!prog) return null;
  const variant = prog.variants.find((v) => v.id === account.variantId) || prog.variants.find((v) => v.name === account.variant) || prog.variants[0];
  return { firm, prog, variant };
}

/**
 * What comes after this account when it passes: the next phase (Phase 2…) or Funded.
 * Uses the firm's rules when the account came from the catalog, otherwise keeps your rules
 * (with no profit target once funded).
 */
export function nextPhaseOf(account, firms) {
  const v = variantOf(account, firms);
  const r = account.rules || {};
  if (v) {
    const names = phaseNames(v.variant);
    const i = names.indexOf(account.phase);
    const next = names[i + 1] || 'Funded';
    const sizeEntry = v.variant.sizes.find((s) => s.size === account.size) || { size: account.size, ...(v.variant.unit !== 'pct' ? { maxLoss: r.maxLoss, daily: r.dailyLoss, minDays: 0 } : {}) };
    const nr = rulesFor(v.variant, sizeEntry, next);
    const ph = v.variant.unit === 'pct' ? (next === 'Funded' ? v.variant.funded : v.variant.phases.find((x) => x.name === next)) : null;
    return { phase: next, kind: next === 'Funded' ? 'funded' : 'eval', rules: { profitTarget: nr.profitTarget, maxLoss: nr.maxLoss, maxLossType: nr.maxLossType, dailyLoss: nr.dailyLoss, minDays: nr.minDays, minTrades: ph?.minTrades || 0, consistency: nr.consistency } };
  }
  // Not from the catalog: Phase 1 → Phase 2 only if the name says it's a 2-step, otherwise straight to Funded
  const twoStep = /2|two/i.test(`${account.program || ''} ${account.variant || ''}`) && account.phase === 'Phase 1';
  return twoStep
    ? { phase: 'Phase 2', kind: 'eval', rules: { ...r } }
    : { phase: 'Funded', kind: 'funded', rules: { ...r, profitTarget: null, minDays: 0, minTrades: 0 } };
}

/** The new account to create when `account` passes (linked back with prevAccount) */
export function nextAccountBody(account, firms, date) {
  const next = nextPhaseOf(account, firms);
  const baseName = account.name.replace(/\s*·\s*(Phase \d|Funded)$/i, '');
  return {
    name: `${baseName} · ${next.phase}`, firmId: account.firmId, firmName: account.firmName, firmType: account.firmType,
    program: account.program, variant: account.variant, programId: account.programId, variantId: account.variantId,
    size: account.size, phase: next.phase, kind: next.kind, paid: 0, startBalance: account.size,
    purchasedAt: date, prevAccount: account.id, rules: next.rules,
  };
}

/** Active evaluation that met target, min days and min trades without breaking a rule */
export function readyToPass(account, trades) {
  if (account.status !== 'active' || account.kind !== 'eval' || !account.rules?.profitTarget) return null;
  const m = accountMetrics(account, trades);
  return m.hit && !m.breached ? m : null;
}

/**
 * Pass rates and other numbers across all your prop accounts.
 * A "challenge" is a chain Phase 1 → (Phase 2) → Funded, linked by prevAccount.
 */
export function propStats(accounts, trades) {
  const evals = accounts.filter((a) => a.kind === 'eval');
  const closed = evals.filter((a) => a.status === 'passed' || a.status === 'failed');
  const passed = evals.filter((a) => a.status === 'passed');
  const byPhase = new Map();
  for (const a of evals) {
    const k = a.phase || 'Phase 1';
    const x = byPhase.get(k) || { phase: k, total: 0, passed: 0, failed: 0, active: 0 };
    x.total++; if (a.status === 'passed') x.passed++; else if (a.status === 'failed') x.failed++; else if (a.status === 'active') x.active++;
    byPhase.set(k, x);
  }
  const phases = [...byPhase.values()].map((x) => ({ ...x, rate: x.passed + x.failed ? (x.passed / (x.passed + x.failed)) * 100 : null })).sort((a, b) => a.phase.localeCompare(b.phase));
  const funded = accounts.filter((a) => a.kind === 'funded');
  const paidOut = funded.filter((a) => (a.payouts || []).length);
  const starts = evals.filter((a) => !a.prevAccount); // challenges bought (first phase)
  const startsClosed = starts.filter((a) => a.status !== 'active');
  const fundedFromChain = funded.filter((a) => a.prevAccount).length;
  const metricsOfPassed = passed.map((a) => accountMetrics(a, trades));
  const avg = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
  const spent = accounts.reduce((s, a) => s + (a.paid || 0), 0);
  const payouts = accounts.reduce((s, a) => s + (a.payouts || []).reduce((x, p) => x + (p.amount || 0), 0), 0);
  const firms = new Map();
  for (const a of accounts) {
    const f = firms.get(a.firmName || 'Other') || { firm: a.firmName || 'Other', accounts: 0, evalsClosed: 0, evalsPassed: 0, funded: 0, spent: 0, payouts: 0 };
    f.accounts++; f.spent += a.paid || 0; f.payouts += (a.payouts || []).reduce((x, p) => x + (p.amount || 0), 0);
    if (a.kind === 'eval' && (a.status === 'passed' || a.status === 'failed')) { f.evalsClosed++; if (a.status === 'passed') f.evalsPassed++; }
    if (a.kind === 'funded') f.funded++;
    firms.set(f.firm, f);
  }
  return {
    accounts: accounts.length, challenges: starts.length, active: accounts.filter((a) => a.status === 'active').length,
    passRate: closed.length ? (passed.length / closed.length) * 100 : null, passed: passed.length, failed: closed.length - passed.length,
    fundedRate: startsClosed.length ? (fundedFromChain / startsClosed.length) * 100 : null,
    funded: funded.length, payoutRate: funded.length ? (paidOut.length / funded.length) * 100 : null,
    avgDaysToPass: avg(metricsOfPassed.map((m) => m.days)), avgTradesToPass: avg(metricsOfPassed.map((m) => m.trades)),
    spent, payouts, net: payouts - spent, roi: spent ? ((payouts - spent) / spent) * 100 : null,
    costPerFunded: funded.length ? spent / funded.length : null,
    phases, byFirm: [...firms.values()].map((f) => ({ ...f, passRate: f.evalsClosed ? (f.evalsPassed / f.evalsClosed) * 100 : null, net: f.payouts - f.spent })).sort((a, b) => b.spent - a.spent),
  };
}

/** Phases available for a variant: names + 'Funded' */
export function phaseNames(variant) {
  const ph = variant.unit === 'pct' ? variant.phases.map((p) => p.name) : variant.phases;
  return [...ph, 'Funded'];
}

/** Dollar rules for one size + phase (phase name or 'Funded') */
export function rulesFor(variant, sizeEntry, phase) {
  const size = sizeEntry.size;
  if (variant.unit === 'pct') {
    const p = phase === 'Funded' ? variant.funded : variant.phases.find((x) => x.name === phase) || variant.funded;
    const $ = (v) => (v == null ? null : Math.round((size * v) / 100));
    return {
      profitTarget: phase === 'Funded' ? null : $(p.target),
      maxLoss: $(p.maxLoss), maxLossType: p.maxLossType || 'Static', dailyLoss: $(p.daily),
      minDays: p.minDays || 0, consistency: p.consistency || null,
      pct: { target: phase === 'Funded' ? null : p.target, maxLoss: p.maxLoss, daily: p.daily },
    };
  }
  return {
    profitTarget: phase === 'Funded' ? null : sizeEntry.target,
    maxLoss: sizeEntry.maxLoss, maxLossType: sizeEntry.maxLossType || 'Static', dailyLoss: sizeEntry.daily || null,
    minDays: sizeEntry.minDays || 0, consistency: sizeEntry.consistency || null,
    pct: { target: sizeEntry.target ? +((sizeEntry.target / size) * 100).toFixed(1) : null, maxLoss: +((sizeEntry.maxLoss / size) * 100).toFixed(1), daily: sizeEntry.daily ? +((sizeEntry.daily / size) * 100).toFixed(1) : null },
  };
}

/** Live account metrics from its trades */
export function accountMetrics(account, trades) {
  const mine = trades.filter((t) => !t.noTrade && (t.accounts || []).includes(account.id)).sort((a, b) => a.date.localeCompare(b.date));
  const start = account.startBalance ?? account.size;
  const r = account.rules || {};
  let bal = start, peak = start;
  const days = new Map();
  for (const t of mine) { bal += t.pnl || 0; peak = Math.max(peak, bal); days.set(t.date, (days.get(t.date) || 0) + (t.pnl || 0)); }
  const trailing = /trail/i.test(r.maxLossType || '');
  const failBelow = r.maxLoss ? (trailing ? Math.min(peak - r.maxLoss, account.size) : account.size - r.maxLoss) : null;
  const targetBal = r.profitTarget ? account.size + r.profitTarget : null;
  const pnl = bal - account.size;
  const worstDay = days.size ? Math.min(...days.values()) : 0;
  const dailyBreach = r.dailyLoss ? worstDay <= -r.dailyLoss : false;
  const breached = (failBelow != null && bal <= failBelow) || dailyBreach;
  const hit = targetBal != null && bal >= targetBal && days.size >= (r.minDays || 0) && mine.length >= (r.minTrades || 0);
  return {
    trades: mine.length, balance: bal, pnl, days: days.size, failBelow, targetBal, peak,
    progress: r.profitTarget ? Math.max(0, Math.min(1, pnl / r.profitTarget)) : null,
    buffer: failBelow != null ? bal - failBelow : null,
    dailyBreach, breached, hit,
  };
}
