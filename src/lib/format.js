export const money = (n, { sign = true, cents = true } = {}) => {
  if (n == null || Number.isNaN(n)) return '—';
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  return `${n < 0 ? '-' : sign && n > 0 ? '+' : ''}$${s}`;
};
export const usd = (n) => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
export const kfmt = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(n % 1000 ? 1 : 0)}K` : String(n));
export const pct = (n, d = 1) => (n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(d)}%`);
export const rr = (n) => (n == null || !Number.isFinite(n) ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}R`);
export const cls = (...a) => a.filter(Boolean).join(' ');
export const pnlClass = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
export const initials = (name = '') => name.split(/[\s_.]+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('') || '?';

const SYM_COLORS = { XAU: '#d9a62c', GOLD: '#d9a62c', MNQ: '#6aa8ff', NQ: '#6aa8ff', ES: '#9b8cff', MES: '#9b8cff', BTC: '#f7931a', EUR: '#6fe0b0', GBP: '#ff8fa3' };
export const symColor = (s = '') => {
  const k = Object.keys(SYM_COLORS).find((k) => s.toUpperCase().startsWith(k));
  if (k) return SYM_COLORS[k];
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 70%)`;
};
