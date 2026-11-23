import catalog from '@shared/firms.json';

export const FIRM_NOTE = catalog.note;
export const FIRMS = catalog.firms;
export const findFirm = (id) => FIRMS.find((f) => f.id === id);

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
  const hit = targetBal != null && bal >= targetBal && days.size >= (r.minDays || 0);
  return {
    trades: mine.length, balance: bal, pnl, days: days.size, failBelow, targetBal, peak,
    progress: r.profitTarget ? Math.max(0, Math.min(1, pnl / r.profitTarget)) : null,
    buffer: failBelow != null ? bal - failBelow : null,
    dailyBreach, breached, hit,
  };
}
