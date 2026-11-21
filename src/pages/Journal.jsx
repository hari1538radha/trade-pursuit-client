import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, Plus, Search, LayoutGrid, List, Filter, X, Eye, EyeOff, FileDown } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Money, Reveal, Seg, Empty } from '../components/ui.jsx';
import TradeCard from '../components/TradeCard.jsx';
import { summary, byDay, tradeScore } from '../lib/stats.js';
import { longDate, weekStart, dayMonth, shortDate } from '../lib/dates.js';
import { cls, rr } from '../lib/format.js';
import { toCSV, download } from '../lib/csv.js';

export default function Journal() {
  const { trades, accounts, openModal, breakEven, hidePnl, toggleHide } = useApp();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState('Trades');
  const [layout, setLayout] = useState(() => localStorage.getItem('edgelog.layout') || 'grid');
  const [q, setQ] = useState('');
  const [showF, setShowF] = useState(false);
  const [f, setF] = useState({ result: '', session: '', account: '', from: '', to: '', grade: '' });
  const dateParam = params.get('date');

  const filtered = useMemo(() => trades.filter((t) => {
    if (dateParam && t.date !== dateParam) return false;
    if (q) { const s = q.toLowerCase(); if (![t.symbol, t.playbook, t.notes, t.session, ...(t.confluences || []), ...(t.targets || [])].some((x) => x && x.toLowerCase().includes(s))) return false; }
    if (f.result === 'win' && !(t.pnl > breakEven)) return false;
    if (f.result === 'loss' && !(t.pnl < -breakEven)) return false;
    if (f.session && t.session !== f.session) return false;
    if (f.account && !(t.accounts || []).includes(f.account)) return false;
    if (f.grade && t.grade !== f.grade) return false;
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    return true;
  }), [trades, q, f, dateParam, breakEven]);
  const s = summary(filtered, breakEven);
  const groups = useMemo(() => { const m = new Map(); for (const t of filtered) m.set(t.date, [...(m.get(t.date) || []), t]); return [...m.entries()]; }, [filtered]);
  const activeFilters = Object.values(f).filter(Boolean).length + (dateParam ? 1 : 0);

  return (
    <div className="page">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Trade Journal</h1><div className="muted">{trades.filter((t) => !t.noTrade).length} trades logged</div></div>
        <Seg options={['Trades', 'Daily', 'Weekly']} value={view} onChange={setView} />
        <div className="row"><button className="btn" onClick={() => openModal('quick')}><Zap size={16} /> Quick Log</button><button className="btn primary" onClick={() => openModal('log')}><Plus size={16} /> Log Trade</button></div>
      </div>

      <div className="row between" style={{ margin: '26px 0 12px' }}><span className="eyebrow">Performance</span><button className="btn sm" onClick={toggleHide}>{hidePnl ? <EyeOff size={14} /> : <Eye size={14} />} Hide P&amp;L</button></div>
      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr' }}>
        <Reveal className="card stat"><div className="label">Total P&amp;L</div><div className="val" style={{ fontSize: 46 }}><Money value={s.total} animated /></div><div className="foot">{s.wins}W / {s.losses}L</div></Reveal>
        <Reveal delay={0.04} className="card stat"><div className="label">Win Rate</div><div className="val">{s.winRate.toFixed(1)}%</div><div className="foot">{s.count} total trades</div></Reveal>
        <Reveal delay={0.08} className="card stat"><div className="label">Avg Win RR</div><div className="val">{s.avgWinRR != null ? `${s.avgWinRR.toFixed(2)}R` : '—'}</div><div className="foot">Profit Factor {Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'}</div></Reveal>
        <Reveal delay={0.12} className="card stat"><div className="label">Avg Win / Loss</div><div className="val"><Money value={s.avgWin} className="" /></div><div className="foot">Avg loss: <Money value={-s.avgLoss} /></div></Reveal>
      </div>

      <div className="card row wrap" style={{ marginTop: 14, padding: 10, gap: 8 }}>
        <button className={cls('btn sm', activeFilters && 'primary')} onClick={() => setShowF((x) => !x)}><Filter size={14} /> Filters{activeFilters ? ` (${activeFilters})` : ''}</button>
        {dateParam && <span className="tag">{shortDate(dateParam)} <button onClick={() => setParams({})}><X size={12} /></button></span>}
        <span className="grow" />
        <button className="btn sm" onClick={() => download('trades.csv', toCSV(filtered))}><FileDown size={14} /> CSV</button>
        <div className="row" className="search" style={{ width: 260 }}><Search size={14} className="muted" /><input className="input" style={{ background: 'none', padding: '8px' }} placeholder="Search symbol, setup…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className={cls('icon-btn', layout === 'grid' && 'on')} style={{ color: layout === 'grid' ? 'var(--blue)' : undefined }} onClick={() => { setLayout('grid'); localStorage.setItem('edgelog.layout', 'grid'); }}><LayoutGrid size={16} /></button>
        <button className="icon-btn" style={{ color: layout === 'list' ? 'var(--blue)' : undefined }} onClick={() => { setLayout('list'); localStorage.setItem('edgelog.layout', 'list'); }}><List size={16} /></button>
        <AnimatePresence>
          {showF && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ width: '100%', overflow: 'hidden' }}>
              <div className="row wrap" style={{ gap: 10, padding: '12px 4px 4px' }}>
                <select className="select" style={{ width: 140 }} value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}><option value="">Any result</option><option value="win">Wins</option><option value="loss">Losses</option></select>
                <select className="select" style={{ width: 150 }} value={f.session} onChange={(e) => setF({ ...f, session: e.target.value })}><option value="">Any session</option>{['Asia', 'London', 'NY AM', 'NY PM'].map((x) => <option key={x}>{x}</option>)}</select>
                <select className="select" style={{ width: 120 }} value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}><option value="">Any grade</option>{['A+', 'A', 'B', 'C', 'F'].map((x) => <option key={x}>{x}</option>)}</select>
                <select className="select" style={{ width: 200 }} value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                <input type="date" className="input" style={{ width: 160 }} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
                <input type="date" className="input" style={{ width: 160 }} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
                <button className="btn sm ghost" onClick={() => { setF({ result: '', session: '', account: '', from: '', to: '', grade: '' }); setParams({}); }}>Clear</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {filtered.length === 0 ? (
        <Empty icon={<Zap />} title={trades.length ? 'Nothing matches' : 'Your journal is empty'} action={!trades.length && <button className="btn primary" onClick={() => openModal('quick')}>Log your first trade</button>}>
          {trades.length ? 'Try clearing a filter.' : 'Every trade you log builds your stats, your calendar and your prop account progress.'}
        </Empty>
      ) : view === 'Trades' ? (
        layout === 'grid' ? (
          groups.map(([date, ts]) => (
            <div key={date}>
              <div className="day-h">{longDate(date)} <span className="dim" style={{ fontSize: 13 }}>{ts.length} {ts.length > 1 ? 'trades' : 'trade'}</span><span className="ln" /><Money value={ts.reduce((a, t) => a + (t.pnl || 0), 0)} /></div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(440px,1fr))' }}>
                <AnimatePresence>{ts.map((t, i) => <TradeCard key={t.id} t={t} i={i} />)}</AnimatePresence>
              </div>
            </div>
          ))
        ) : (
          <div className="card" style={{ marginTop: 18, padding: 6 }}>
            <table className="list">
              <thead><tr><th>Date</th><th>Symbol</th><th>Side</th><th>Session</th><th>Setup</th><th>Grade</th><th>R</th><th>Score</th><th style={{ textAlign: 'right' }}>P&amp;L</th></tr></thead>
              <tbody>{filtered.map((t) => <tr key={t.id} onClick={() => openModal('log', { trade: t })}><td>{dayMonth(t.date)}</td><td><b>{t.noTrade ? 'No trade' : t.symbol}</b></td><td>{t.noTrade ? '' : t.direction}</td><td>{t.session}</td><td>{t.playbook}</td><td>{t.grade}</td><td>{rr(t.realizedRR)}</td><td>{t.noTrade ? '' : tradeScore(t).score}</td><td style={{ textAlign: 'right' }}><Money value={t.pnl} /></td></tr>)}</tbody>
            </table>
          </div>
        )
      ) : (
        <Periods trades={filtered} weekly={view === 'Weekly'} onPick={(d) => { setParams({ date: d }); setView('Trades'); }} />
      )}
    </div>
  );
}

function Periods({ trades, weekly, onPick }) {
  const { breakEven } = useApp();
  const rows = useMemo(() => {
    const days = [...byDay(trades).values()];
    if (!weekly) return days.sort((a, b) => b.date.localeCompare(a.date)).map((d) => ({ key: d.date, label: longDate(d.date), ...d, wr: d.count ? (d.wins / d.count) * 100 : 0 }));
    const m = new Map();
    for (const d of days) { const k = weekStart(d.date); const w = m.get(k) || { key: k, pnl: 0, count: 0, wins: 0, days: 0 }; w.pnl += d.pnl; w.count += d.count; w.wins += d.wins; w.days++; m.set(k, w); }
    return [...m.values()].sort((a, b) => b.key.localeCompare(a.key)).map((w) => ({ ...w, label: `Week of ${dayMonth(w.key)}`, wr: (w.wins / w.count) * 100 }));
  }, [trades, weekly]);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)));
  return (
    <div className="col" style={{ gap: 8, marginTop: 18 }}>
      {rows.map((r, i) => (
        <motion.button key={r.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }} className="card row" style={{ padding: 16, textAlign: 'left' }} onClick={() => !weekly && onPick(r.key)}>
          <div style={{ width: 260 }}><b>{r.label}</b><div className="muted" style={{ fontSize: 13 }}>{r.count} trades · {r.wr.toFixed(0)}% win{weekly ? ` · ${r.days} days` : ''}</div></div>
          <div className="grow" style={{ height: 8, background: 'var(--panel3)', borderRadius: 8, position: 'relative' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${(Math.abs(r.pnl) / max) * 50}%` }} style={{ position: 'absolute', height: '100%', borderRadius: 8, left: r.pnl >= 0 ? '50%' : undefined, right: r.pnl < 0 ? '50%' : undefined, background: r.pnl >= 0 ? 'var(--green)' : 'var(--red)' }} />
          </div>
          <b style={{ width: 120, textAlign: 'right' }}><Money value={r.pnl} /></b>
        </motion.button>
      ))}
    </div>
  );
}
