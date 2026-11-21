// Fetch the Forex Factory weekly calendar straight from the browser.
// Used when the API server can't reach the feed (e.g. its shared IP is rate limited).
const IMPACT = { High: 'high', Medium: 'medium', Low: 'low', Holiday: 'holiday' };

export async function fetchNewsDirect(week = 'thisweek') {
  const r = await fetch(`https://nfs.faireconomy.media/ff_calendar_${week}.json`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const rows = await r.json();
  const events = rows
    .filter((e) => e?.title && !Number.isNaN(Date.parse(e.date)))
    .map((e) => ({ id: `${e.country}-${e.date}-${e.title}`, title: e.title, currency: String(e.country || '').toUpperCase(), date: new Date(e.date).toISOString(), impact: IMPACT[e.impact] || 'none', forecast: e.forecast || '', previous: e.previous || '', actual: e.actual || '' }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const out = { events, updatedAt: new Date().toISOString(), direct: true };
  try { localStorage.setItem(`tp.news.${week}`, JSON.stringify(out)); } catch { /* storage full */ }
  return out;
}

/** Last calendar this browser loaded, so a failed refresh can still show something. */
export function lastNews(week) {
  try { const v = JSON.parse(localStorage.getItem(`tp.news.${week}`)); return v ? { ...v, stale: true } : null; } catch { return null; }
}
