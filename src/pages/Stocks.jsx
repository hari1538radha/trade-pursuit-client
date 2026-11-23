import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LineChart as LineIco, RefreshCw, Search, Star, StarOff, X, Trash2 } from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Reveal, Empty } from '../components/ui.jsx';
import { SETUPS } from '../lib/market/scanner.js';
import { cls } from '../lib/format.js';
import { lakh } from './Options.jsx';

const inr = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : `₹${v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })}`);
const pctf = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);
const SIDE_COLOR = { long: 'var(--green)', short: 'var(--red)', watch: '#e5b53a' };
const GROUPS = [
  ['52-week', ['52w-high-breakout', 'near-52w-high', 'near-52w-low', '52w-low-bounce']],
  ['Breakouts', ['breakout-20d', 'resistance-breakout', 'breakdown-20d', 'support-breakdown', 'gap-up', 'gap-down']],
  ['Support / resistance', ['near-support', 'near-resistance']],
  ['Momentum & volume', ['volume-spike', 'uptrend', 'golden-cross', 'rsi-oversold', 'rsi-overbought']],
  ['Consolidation', ['nr7', 'inside-day']],
];

export default function Stocks() {
  const { api, notify } = useApp();
  const [tab, setTab] = useState('scanner');
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState('');
  const [f, setF] = useState({ q: '', minPrice: 20, minTurnover: 1, sort: 'turnover' });
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(null);
  const [watch, setWatch] = useState([]);

  const loadStatus = () => api.stocks.status().then(setStatus).catch(() => {});
  useEffect(() => { loadStatus(); api.watchlist.list().then((r) => setWatch(r.items)).catch(() => {}); }, []); // eslint-disable-line
  // poll while the server is loading NSE files
  useEffect(() => {
    if (!status?.job?.running) return;
    const t = setInterval(loadStatus, 4000);
    return () => clearInterval(t);
  }, [status?.job?.running]); // eslint-disable-line
  useEffect(() => {
    const t = setTimeout(() => api.stocks.scan({ ...f, setup: setup || undefined, limit: 400 }).then(setRes).catch((e) => notify(e.message)), 200);
    return () => clearTimeout(t);
  }, [f, setup, status?.lastDate]); // eslint-disable-line

  const inWatch = useMemo(() => new Set(watch.map((w) => w.symbol)), [watch]);
  const addWatch = async (row, s = setup) => {
    const st = SETUPS[s] || (row.tags[0] && SETUPS[row.tags[0]]);
    const { item } = await api.watchlist.add({ symbol: row.symbol, setup: st?.label || '', side: st?.side || 'watch', entry: st?.side === 'long' ? row.high : st?.side === 'short' ? row.low : null, stop: row.stop, target: st?.side === 'long' ? row.resistance : st?.side === 'short' ? row.support : null, addedClose: row.close });
    setWatch((w) => [{ ...item, now: row }, ...w.filter((x) => x.symbol !== row.symbol)]);
    notify(`${row.symbol} added to My list`);
  };
  const removeWatch = async (sym) => { const w = watch.find((x) => x.symbol === sym); if (!w) return; await api.watchlist.remove(w.id); setWatch((x) => x.filter((y) => y.symbol !== sym)); };

  const running = status?.job?.running;
  return (
    <div className="page">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><LineIco size={22} /> Stocks</h1>
          <div className="muted">NSE end-of-day scan{status?.lastDate ? ` · data for ${new Date(status.lastDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}{status?.symbols ? ` · ${status.symbols.toLocaleString('en-IN')} stocks` : ''}{status?.demo && <span className="tag" style={{ marginLeft: 8, color: 'var(--gold)' }}>Sample data</span>}</div>
        </div>
        <div className="row">
          <Seg size="lg" options={[{ value: 'scanner', label: 'Scanner' }, { value: 'list', label: `My list${watch.length ? ` (${watch.length})` : ''}` }]} value={tab} onChange={setTab} />
          {!status?.demo && <button className="btn sm" disabled={running} onClick={async () => { await api.stocks.refresh(); loadStatus(); }}><RefreshCw size={14} className={running ? 'spin' : ''} /> {running ? 'Updating…' : 'Update'}</button>}
        </div>
      </div>

      {running && (
        <div className="banner" style={{ marginTop: 16 }}>
          <RefreshCw size={18} className="spin" />
          <div className="grow"><b>Loading NSE daily files ({status.job.done}/{status.job.total})</b><div className="muted">{status.job.current ? `Working on ${status.job.current}. ` : ''}The first load fetches about a year of history and takes a few minutes. Keep this page open.</div>
            <div className="bar" style={{ marginTop: 8, height: 5 }}><i style={{ width: `${(status.job.done / Math.max(1, status.job.total)) * 100}%`, background: 'var(--green)' }} /></div></div>
        </div>
      )}
      {status?.job?.error && <p className="neg">Last update failed: {status.job.error}</p>}

      {tab === 'scanner' ? (
        <>
          <div className="col" style={{ gap: 10, marginTop: 16 }}>
            {GROUPS.map(([g, ids]) => (
              <div key={g} className="row wrap" style={{ gap: 6 }}>
                <span className="eyebrow" style={{ width: 150 }}>{g}</span>
                {ids.map((id) => (
                  <button key={id} className={cls('chip', setup === id && 'on')} style={{ padding: '6px 11px', fontSize: 13 }} onClick={() => setSetup(setup === id ? '' : id)} title={SETUPS[id].desc}>
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: SIDE_COLOR[SETUPS[id].side], marginRight: 6 }} />
                    {SETUPS[id].label} <span className="muted">{res?.counts?.[id] || 0}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="card row wrap" style={{ marginTop: 14, padding: 10, gap: 10 }}>
            <div className="row" style={{ background: 'var(--panel2)', borderRadius: 10, padding: '0 10px', width: 230 }}><Search size={14} className="muted" /><input className="input" style={{ background: 'none', padding: 8 }} placeholder="Symbol or name" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
            <label className="row muted" style={{ gap: 6, fontSize: 13 }}>Min price ₹<input className="input" style={{ width: 80, padding: 8 }} value={f.minPrice} onChange={(e) => setF({ ...f, minPrice: +e.target.value || 0 })} /></label>
            <label className="row muted" style={{ gap: 6, fontSize: 13 }} title="Average daily traded value over 20 days">Min turnover ₹ Cr/day<select className="select" style={{ width: 90, padding: '8px 10px' }} value={f.minTurnover} onChange={(e) => setF({ ...f, minTurnover: +e.target.value })}>{[0, 1, 5, 10, 25, 100].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
            <span className="grow" />
            <select className="select" style={{ width: 190, padding: '8px 12px' }} value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}>
              <option value="turnover">Sort: most traded</option><option value="change">Sort: top gainers</option><option value="volume">Sort: volume vs average</option><option value="fromHigh">Sort: closest to 52w high</option><option value="fromLow">Sort: closest to 52w low</option><option value="rsi">Sort: lowest RSI</option>
            </select>
          </div>
          {setup && <p className="muted" style={{ margin: '12px 0 0' }}><b style={{ color: SIDE_COLOR[SETUPS[setup].side] }}>{SETUPS[setup].label}:</b> {SETUPS[setup].desc}</p>}
          {res && !res.universe && !running ? (
            <Empty icon={<LineIco />} title="No stock data yet">Click Update to load NSE end-of-day files. After the first load it updates itself each evening.</Empty>
          ) : (
            <div className="card" style={{ marginTop: 14, padding: 4, overflowX: 'auto' }}>
              <table className="list">
                <thead><tr><th>Symbol</th><th>Close</th><th>Chg</th><th>Vol × avg</th><th>Turnover</th><th>From 52w H / L</th><th>RSI</th><th>Support / Resistance</th><th>Setups</th><th /></tr></thead>
                <tbody>
                  {(res?.rows || []).map((r) => (
                    <tr key={r.symbol} onClick={() => setOpen(r.symbol)}>
                      <td><b>{r.symbol}</b><div className="dim" style={{ fontSize: 11.5, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div></td>
                      <td>{inr(r.close)}</td>
                      <td className={r.chgPct >= 0 ? 'pos' : 'neg'}>{pctf(r.chgPct)}</td>
                      <td className={r.volRatio >= 1.5 ? 'pos' : ''}>{r.volRatio?.toFixed(1)}×</td>
                      <td className="muted">₹{r.turnoverCr?.toFixed(1)} Cr</td>
                      <td><span className="neg">{pctf(r.fromHigh)}</span> / <span className="pos">{pctf(r.fromLow)}</span></td>
                      <td className={r.rsi < 30 ? 'pos' : r.rsi > 70 ? 'neg' : ''}>{r.rsi?.toFixed(0) ?? '—'}</td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{r.support ? inr(r.support, 0) : '—'} / {r.resistance ? inr(r.resistance, 0) : '—'}</td>
                      <td style={{ maxWidth: 280 }}><div className="row wrap" style={{ gap: 4 }}>{(setup ? [setup, ...r.tags.filter((t) => t !== setup)] : r.tags).slice(0, 2).map((t) => <span key={t} className="tag" style={{ fontSize: 11, whiteSpace: 'nowrap', color: SIDE_COLOR[SETUPS[t]?.side] }}>{SETUPS[t]?.label}</span>)}{r.tags.length > 2 && <span className="dim" style={{ fontSize: 11 }}>+{r.tags.length - 2}</span>}</div></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" title={inWatch.has(r.symbol) ? 'Remove from My list' : 'Add to My list'} onClick={() => (inWatch.has(r.symbol) ? removeWatch(r.symbol) : addWatch(r))}>{inWatch.has(r.symbol) ? <Star size={15} fill="#e5b53a" color="#e5b53a" /> : <Star size={15} />}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {res && <p className="dim" style={{ fontSize: 12.5, padding: '6px 10px' }}>Showing {Math.min(res.rows.length, res.total)} of {res.total} matches out of {res.universe} tradeable stocks.</p>}
            </div>
          )}
        </>
      ) : (
        <Watchlist items={watch} setItems={setWatch} onOpen={setOpen} />
      )}
      <p className="dim" style={{ fontSize: 12, marginTop: 16 }}>Scans run on NSE's public end-of-day files (equity series EQ/BE). Levels and setups are calculations, not investment advice. Splits and bonuses can distort history; suspicious jumps are excluded.</p>
      <StockDrawer symbol={open} onClose={() => setOpen(null)} inWatch={inWatch} onAdd={addWatch} onRemove={removeWatch} />
    </div>
  );
}

function Watchlist({ items, setItems, onOpen }) {
  const { api } = useApp();
  const save = async (w, patch) => { const { item } = await api.watchlist.update(w.id, patch); setItems((x) => x.map((y) => (y.id === w.id ? { ...y, ...item } : y))); };
  if (!items.length) return <Empty icon={<Star />} title="Your list is empty">Star stocks from the scanner. Each saves with its setup, a trigger, a stop based on support or volatility, and a target at the next resistance. Edit any of them.</Empty>;
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', marginTop: 16 }}>
      {items.map((w, i) => {
        const now = w.now;
        const move = now && w.addedClose ? (now.close / w.addedClose - 1) * 100 : null;
        const triggered = now && w.entry && (w.side === 'short' ? now.close <= w.entry : now.close >= w.entry);
        const stopped = now && w.stop && (w.side === 'short' ? now.close >= w.stop : now.close <= w.stop);
        return (
          <Reveal key={w.id} delay={Math.min(i, 8) * 0.03} className="card" style={{ borderTop: `3px solid ${SIDE_COLOR[w.side]}` }}>
            <div className="row between">
              <button onClick={() => onOpen(w.symbol)} style={{ textAlign: 'left' }}><b style={{ fontSize: 19 }}>{w.symbol}</b><div className="muted" style={{ fontSize: 12.5 }}>{w.setup || 'Watching'}</div></button>
              <div style={{ textAlign: 'right' }}><b>{now ? inr(now.close) : '—'}</b>{move != null && <div className={move >= 0 ? 'pos' : 'neg'} style={{ fontSize: 12.5 }}>{pctf(move)} since added</div>}</div>
            </div>
            {(triggered || stopped) && <div className={cls('tag', stopped ? 'neg' : 'pos')} style={{ marginTop: 10 }}>{stopped ? 'Closed past your stop' : 'Closed past your trigger'}</div>}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
              {[['Trigger', 'entry'], ['Stop', 'stop'], ['Target', 'target']].map(([l, k]) => (
                <label key={k} className="col" style={{ gap: 4 }}><span className="dim" style={{ fontSize: 11 }}>{l}</span>
                  <input className="input" style={{ padding: '7px 9px', fontSize: 13 }} defaultValue={w[k] ?? ''} onBlur={(e) => { const v = e.target.value === '' ? null : +e.target.value; if (v !== w[k]) save(w, { [k]: v }); }} /></label>
              ))}
            </div>
            {w.entry && w.stop && w.target && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Reward:risk {(Math.abs(w.target - w.entry) / Math.max(0.01, Math.abs(w.entry - w.stop))).toFixed(1)}</div>}
            <textarea className="textarea" style={{ minHeight: 50, marginTop: 10, fontSize: 13 }} placeholder="Plan for this stock…" defaultValue={w.note} onBlur={(e) => e.target.value !== w.note && save(w, { note: e.target.value })} />
            <div className="row between" style={{ marginTop: 8 }}>
              <Seg options={[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }, { value: 'watch', label: 'Watch' }]} value={w.side} onChange={(v) => save(w, { side: v })} />
              <button className="icon-btn" title="Remove" onClick={async () => { await api.watchlist.remove(w.id); setItems((x) => x.filter((y) => y.id !== w.id)); }}><Trash2 size={15} /></button>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

function StockDrawer({ symbol, onClose, inWatch, onAdd, onRemove }) {
  const { api } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); if (symbol) api.stocks.detail(symbol).then(setD).catch(() => {}); }, [symbol, api]);
  const a = d?.analysis;
  const data = useMemo(() => {
    if (!d) return [];
    const c = d.bars.map((b) => b.c);
    const sma = (n, i) => (i >= n - 1 ? c.slice(i - n + 1, i + 1).reduce((s, x) => s + x, 0) / n : null);
    return d.bars.map((b, i) => ({ d: b.d.slice(5), c: b.c, v: b.v, s50: sma(50, i), s20: sma(20, i) }));
  }, [d]);
  return (
    <AnimatePresence>
      {symbol && (
        <motion.div className="overlay" style={{ justifyContent: 'flex-end', alignItems: 'stretch' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 280, damping: 32 }} style={{ width: 'min(760px,100vw)', background: 'var(--panel)', borderLeft: '1px solid #222', padding: 26, overflowY: 'auto' }}>
            <div className="row between">
              <div><h2 style={{ margin: 0, fontSize: 30 }}>{symbol}</h2><div className="muted">{d?.name}</div></div>
              <div className="row">
                {a && <button className="btn sm" onClick={() => (inWatch.has(symbol) ? onRemove(symbol) : onAdd({ symbol, ...a }, a.tags[0]))}>{inWatch.has(symbol) ? <><StarOff size={14} /> Remove</> : <><Star size={14} /> Add to My list</>}</button>}
                <button className="close-x" onClick={onClose}><X size={18} /></button>
              </div>
            </div>
            {!a ? <p className="muted">Loading…</p> : (
              <>
                <div className="row" style={{ gap: 14, margin: '14px 0' }}><b style={{ fontSize: 28 }}>{inr(a.close)}</b><b className={a.chgPct >= 0 ? 'pos' : 'neg'}>{pctf(a.chgPct)}</b><span className="muted">{a.date}</span></div>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={data}>
                      <CartesianGrid strokeDasharray="3 4" vertical={false} />
                      <XAxis dataKey="d" tickLine={false} axisLine={false} minTickGap={40} />
                      <YAxis yAxisId="p" domain={['auto', 'auto']} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => v.toFixed(0)} />
                      <YAxis yAxisId="v" hide domain={[0, (m) => m * 4]} />
                      <Tooltip contentStyle={{ background: 'var(--panel2)', border: '1px solid var(--line2)', borderRadius: 10 }} formatter={(v, n) => [n === 'Volume' ? lakh(v) : v?.toFixed(2), n]} />
                      <Bar yAxisId="v" dataKey="v" name="Volume" fill="#ffffff22" />
                      <Line yAxisId="p" dataKey="c" name="Close" stroke="var(--text)" strokeWidth={2} dot={false} />
                      <Line yAxisId="p" dataKey="s20" name="SMA 20" stroke="#6aa8ff" strokeWidth={1.2} dot={false} />
                      <Line yAxisId="p" dataKey="s50" name="SMA 50" stroke="#e5b53a" strokeWidth={1.2} dot={false} />
                      {a.support && <ReferenceLine yAxisId="p" y={a.support} stroke="var(--green)" strokeDasharray="5 4" label={{ value: `Support ${a.support}`, fill: 'var(--green)', fontSize: 11, position: 'insideBottomLeft' }} />}
                      {a.resistance && <ReferenceLine yAxisId="p" y={a.resistance} stroke="var(--red)" strokeDasharray="5 4" label={{ value: `Resistance ${a.resistance}`, fill: 'var(--red)', fontSize: 11, position: 'insideTopLeft' }} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12 }}>
                  {[['52w high', inr(a.hi52), pctf(a.fromHigh)], ['52w low', inr(a.lo52), pctf(a.fromLow)], ['RSI 14', a.rsi?.toFixed(1)], ['ATR 14', inr(a.atr)], ['SMA 50', inr(a.sma50)], ['SMA 200', a.sma200 ? inr(a.sma200) : '—'], ['Volume × avg', `${a.volRatio}×`], ['Turnover/day', `₹${a.turnoverCr} Cr`]].map(([l, v, s]) => (
                    <div key={l} className="card" style={{ padding: 12 }}><div className="muted" style={{ fontSize: 11.5 }}>{l}</div><b>{v}</b>{s && <div className="dim" style={{ fontSize: 11.5 }}>{s}</div>}</div>
                  ))}
                </div>
                <h3 style={{ marginTop: 18 }}>Setups today</h3>
                <div className="col" style={{ gap: 8 }}>
                  {a.tags.length ? a.tags.map((t) => <div key={t} className="row" style={{ gap: 10 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: SIDE_COLOR[SETUPS[t].side] }} /><b>{SETUPS[t].label}</b><span className="muted" style={{ fontSize: 13 }}>{SETUPS[t].desc}</span></div>) : <span className="muted">No setup flagged today.</span>}
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>Suggested stop if long: <b>{inr(a.stop)}</b> ({a.support && a.stop < a.support ? 'just under support' : '1.5 × ATR below close'}). {a.adjusted ? 'History trimmed after a suspected split/bonus.' : ''}</p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
