import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Timer, RefreshCw, PenLine, BookmarkPlus, Plus, X, Check, Wifi } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Reveal, ease } from './ui.jsx';
import { RANGE_DEFAULTS, RANGE_SUPPORTED, THRESHOLDS, manualCheck, fmtNum } from '../lib/range.js';
import { today } from '../lib/dates.js';
import { cls } from '../lib/format.js';

const SYM_KEY = 'tp.range.symbols';
const loadSyms = () => { try { const v = JSON.parse(localStorage.getItem(SYM_KEY)); return Array.isArray(v) && v.length ? v : RANGE_DEFAULTS; } catch { return RANGE_DEFAULTS; } };

/**
 * The 10-second check before looking for a setup: how much of a normal day's range
 * (average of the last 10 daily candles) has today already covered?
 */
export default function RangeCheck({ compact }) {
  const { api, notify } = useApp();
  const [symbols, setSymbols] = useState(loadSyms);
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [logged, setLogged] = useState([]);
  const [adding, setAdding] = useState(false);
  const date = today();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.markets.range(symbols);
      setData((d) => ({ ...d, ...Object.fromEntries(r.results.map((x) => [x.symbol, x])) }));
      setErrors(Object.fromEntries(r.errors.map((e) => [e.symbol, e.reason ? `${e.error} (${e.reason})` : e.error])));
    } catch (e) {
      setErrors(Object.fromEntries(symbols.map((s) => [s, e.message])));
    }
    setLoading(false);
  }, [api, symbols]);

  useEffect(() => { load(); const t = setInterval(load, 5 * 60_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { localStorage.setItem(SYM_KEY, JSON.stringify(symbols)); }, [symbols]);
  useEffect(() => { api.plans.get(date).then((r) => setLogged(r.plan?.rangeChecks || [])).catch(() => {}); }, [api, date]);

  const log = async (c) => {
    const entry = { symbol: c.symbol, adr: c.adr, todayRange: c.todayRange, pct: c.pct, left: c.left, pdh: c.pdh, pdl: c.pdl, verdict: c.verdict, line: c.line, at: new Date().toISOString() };
    try {
      const cur = (await api.plans.get(date)).plan?.rangeChecks || [];
      const next = [...cur, entry].slice(-30);
      const r = await api.plans.put(date, { rangeChecks: next });
      setLogged(r.plan?.rangeChecks || next);
      notify(`${c.symbol} range check logged to today's plan`);
    } catch (e) { notify(e.message); }
  };

  return (
    <Reveal className="card" style={{ padding: compact ? 20 : 26 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div>
          <h3 className="row" style={{ gap: 8, fontSize: 17 }}><Timer size={17} className="blue" /> 10-second range check</h3>
          <div className="sub">Do this before you look for a single setup. Average of the last 10 daily candles vs. today so far.</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" onClick={() => setAdding((a) => !a)}><Plus size={14} /> Symbol</button>
          <button className="btn sm" onClick={load} disabled={loading} title="Refresh prices"><motion.span animate={{ rotate: loading ? 360 : 0 }} transition={{ repeat: loading ? Infinity : 0, duration: 1, ease: 'linear' }} style={{ display: 'grid' }}><RefreshCw size={14} /></motion.span></button>
        </div>
      </div>
      <AnimatePresence>
        {adding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div className="row wrap" style={{ gap: 6, marginTop: 14 }}>
              {Object.entries(RANGE_SUPPORTED).map(([s, n]) => {
                const on = symbols.includes(s);
                return <button key={s} title={n} className={cls('chip', on && 'on')} style={{ padding: '6px 11px', fontSize: 13 }} onClick={() => setSymbols(on ? symbols.filter((x) => x !== s) : [...symbols, s].slice(0, 6))}>{s}</button>;
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="col" style={{ gap: 12, marginTop: 16 }}>
        {symbols.map((s) => <SymbolCheck key={s} symbol={s} live={data[s]} error={errors[s]} loading={loading && !data[s]} onLog={log} onRemove={symbols.length > 1 ? () => setSymbols(symbols.filter((x) => x !== s)) : null} />)}
      </div>
      {logged.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Logged today</div>
          {logged.slice(-4).reverse().map((l, i) => (
            <div key={i} className="row" style={{ gap: 8, fontSize: 12.5, padding: '4px 0' }}>
              <span className={cls('verdict', l.verdict)} style={{ padding: '2px 7px', fontSize: 11 }}>{new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="mono text2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.line}</span>
            </div>
          ))}
        </div>
      )}
    </Reveal>
  );
}

function SymbolCheck({ symbol, live, error, loading, onLog, onRemove }) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(`tp.range.manual.${symbol}`)) || {}; } catch { return {}; } })();
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ ranges: saved.ranges || '', todayHigh: '', todayLow: '', pdh: '', pdl: '' });
  const useManual = manual || (!live && error);
  let check = live, merr = '';
  if (useManual) {
    try {
      const num = (v) => (v === '' ? NaN : parseFloat(String(v).replace(/,/g, '')));
      check = manualCheck({ symbol, ranges: String(m.ranges).split(/[\s,;]+/).map(num), todayHigh: num(m.todayHigh), todayLow: num(m.todayLow), pdh: num(m.pdh), pdl: num(m.pdl) });
    } catch (e) { check = null; merr = e.message; }
  }
  const setField = (k) => (e) => {
    const v = e.target.value;
    setM((x) => ({ ...x, [k]: v }));
    if (k === 'ranges') localStorage.setItem(`tp.range.manual.${symbol}`, JSON.stringify({ ranges: v }));
  };
  const fill = check?.pct == null ? 0 : Math.min(150, check.pct);
  const color = { trade: 'var(--blue)', caution: 'var(--gold)', stand: 'var(--red)' }[check?.verdict] || 'var(--dim)';
  const bars = check?.ranges || [];
  const maxBar = Math.max(1e-9, ...bars.map((b) => b.range || 0), check?.todayRange || 0);

  return (
    <motion.div layout className="rc-row">
      <div className="row between wrap" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <b style={{ fontSize: 17 }}>{symbol}</b>
          <span className="muted" style={{ fontSize: 13 }}>{live?.name || RANGE_SUPPORTED[symbol]}</span>
          {live && !useManual && <span className="dim row" style={{ gap: 4, fontSize: 11.5 }}><Wifi size={11} /> {live.source}{live.stale ? ' · older copy' : ''}</span>}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {check && <motion.span key={check.verdict} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cls('verdict', check.verdict)}>{check.verdict === 'trade' && <Check size={13} />}{check.verdictLabel}</motion.span>}
          <button className="icon-btn" style={{ width: 30, height: 30 }} title={useManual ? 'Use live data' : 'Enter numbers manually'} onClick={() => setManual((x) => !x)} disabled={!live && !!error}><PenLine size={14} /></button>
          {onRemove && <button className="icon-btn" style={{ width: 30, height: 30 }} title="Remove" onClick={onRemove}><X size={14} /></button>}
        </div>
      </div>

      {loading && <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>Loading daily candles…</div>}
      {!live && error && <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Live data unavailable: {error}. Read the numbers off your daily chart below.</div>}

      {useManual && (
        <div className="grid rg-2s" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          <input className="input" style={{ padding: '9px 11px' }} value={m.ranges} onChange={setField('ranges')} placeholder="Last 10 daily ranges, e.g. 41 38 52 …, or one average" />
          <input className="input" style={{ padding: '9px 11px' }} inputMode="decimal" value={m.todayHigh} onChange={setField('todayHigh')} placeholder="Today high" />
          <input className="input" style={{ padding: '9px 11px' }} inputMode="decimal" value={m.todayLow} onChange={setField('todayLow')} placeholder="Today low" />
          <input className="input" style={{ padding: '9px 11px' }} inputMode="decimal" value={m.pdh} onChange={setField('pdh')} placeholder="Prev. day high" />
          <input className="input" style={{ padding: '9px 11px' }} inputMode="decimal" value={m.pdl} onChange={setField('pdl')} placeholder="Prev. day low" />
        </div>
      )}

      {check && (
        <>
          <div className="row" style={{ gap: 16, alignItems: 'flex-end', marginTop: 14 }}>
            <div className="grow">
              <div className="row between" style={{ fontSize: 12.5 }}><span className="muted">Today has used</span><b style={{ color }}>{check.pct == null ? '—' : `${check.pct}%`} <span className="muted" style={{ fontWeight: 400 }}>of a normal day</span></b></div>
              <div className="rc-gauge">
                <motion.i initial={{ width: 0 }} animate={{ width: `${(fill / 150) * 100}%` }} transition={{ duration: 0.9, ease }} style={{ background: color }} />
                {[[THRESHOLDS.caution, `${THRESHOLDS.caution}%`], [THRESHOLDS.stand, `${THRESHOLDS.stand}%`], [100, '100%']].map(([v, l]) => <span key={v} className="mk" style={{ left: `${(v / 150) * 100}%` }}><span>{l}</span></span>)}
              </div>
            </div>
            {bars.length > 0 && (
              <div style={{ width: 150 }} title="Last daily ranges, today in blue">
                <div className="rc-bars">
                  {bars.map((b, i) => <motion.i key={i} initial={{ height: 0 }} animate={{ height: `${((b.range || 0) / maxBar) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.03, ease }} />)}
                  {check.todayRange != null && <motion.i className="today" initial={{ height: 0 }} animate={{ height: `${(check.todayRange / maxBar) * 100}%` }} transition={{ duration: 0.6, delay: 0.35, ease }} />}
                </div>
              </div>
            )}
          </div>
          <div className="rc-stats">
            <div>Avg range ({check.days}d)<b>{fmtNum(check.adr)}</b></div>
            <div>Today so far<b>{fmtNum(check.todayRange)}</b></div>
            <div>Left in a normal day<b style={{ color }}>{check.left == null ? '—' : `~${fmtNum(check.left)}`}</b></div>
            <div>Prev. day high<b>{fmtNum(check.pdh)}</b></div>
            <div>Prev. day low<b>{fmtNum(check.pdl)}</b></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="rc-line grow">{check.line}</div>
            <button className="btn sm" style={{ marginTop: 12 }} title="Log this line to today's pre-market plan" onClick={() => onLog(check)}><BookmarkPlus size={14} /> Log</button>
          </div>
        </>
      )}
      {useManual && !check && merr && <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>{merr}</div>}
    </motion.div>
  );
}
