import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, RefreshCw, Search, Zap, Info, KeyRound } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ComposedChart, Line, Legend } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Reveal, Toggle } from '../components/ui.jsx';
import { spikes as findSpikes } from '../lib/market/options.js';
import { cls } from '../lib/format.js';

const RED = '#f0616d', GREEN = '#2fbf8f', PURPLE = '#a78bfa';
/** Indian number units: 1.25 Cr, 46.90 L, 12.3 K */
export const lakh = (v, d = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e7) return `${s}${(a / 1e7).toFixed(d)} Cr`;
  if (a >= 1e5) return `${s}${(a / 1e5).toFixed(d)} L`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(1)} K`;
  return `${s}${Math.round(a)}`;
};
const num = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }));
const time = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

const COLS = {
  buildup: 'Buildup', oi: 'OI', prevOi: 'Prev OI', chgOi: 'Chg OI', volume: 'Volume', iv: 'IV', delta: 'Delta', theta: 'Theta', gamma: 'Gamma', vega: 'Vega', ltp: 'LTP', chg: 'Chg %',
};
const DEFAULT_COLS = ['buildup', 'prevOi', 'oi', 'chgOi', 'volume', 'iv', 'delta', 'ltp'];

function Tip({ active, payload, label, fmt = lakh }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div className="muted" style={{ marginBottom: 4 }}>{label}</div>
      {payload.map((p) => <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.dataKey === 'pcr' ? num(p.value) : fmt(p.value)}</div>)}
    </div>
  );
}

const UNDER = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];
const SESSION_KEY = 'tp.sb.session';
const ymdL = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Upcoming candidate expiries: next 4 of a weekday plus that month's last one */
function nextDays(weekday, n = 4) {
  const out = []; const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 0; out.length < n && i < 60; i++) { const x = new Date(d); x.setDate(d.getDate() + i); if (x.getDay() === weekday) out.push(ymdL(x)); }
  return out;
}

export default function Options() {
  const { api, notify } = useApp();
  const demo = api.demo;
  const [session, setSession] = useState(() => { try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; } });
  const [draft, setDraft] = useState('');
  const [showSession, setShowSession] = useState(false);
  const [underlying, setUnderlying] = useState(() => localStorage.getItem('tp.oc.under') || 'NIFTY');
  const [expiry, setExpiry] = useState(() => localStorage.getItem('tp.oc.expiry') || nextDays(2, 1)[0]);
  const [atmSel, setAtmSel] = useState('five');
  const [data, setData] = useState(null);
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [debug, setDebug] = useState(null);
  const [auto, setAuto] = useState(true);
  const [range, setRange] = useState(10);
  const [oiMode, setOiMode] = useState('change');
  const [timeMode, setTimeMode] = useState('oi');
  const [cols, setCols] = useState(() => { try { return JSON.parse(localStorage.getItem('tp.oc.cols')) || DEFAULT_COLS; } catch { return DEFAULT_COLS; } });
  const [threshold, setThreshold] = useState(() => Number(localStorage.getItem('tp.oc.spike')) || 1000000);
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const ready = demo || !!session;

  useEffect(() => { localStorage.setItem('tp.oc.under', underlying); localStorage.setItem('tp.oc.expiry', expiry); }, [underlying, expiry]);

  const load = useCallback(async (withHistory = true, wantDebug = false) => {
    if (!ready || !expiry) return;
    setLoading(true); setErr('');
    try {
      const [c, h] = await Promise.all([
        api.options.chain({ cookie: session || 'demo', underlying, expiry, atm: atmSel, debug: wantDebug }),
        withHistory ? api.options.history(underlying, expiry) : null,
      ]);
      setData(c); if (h) setSnaps(h.snaps); if (c.debug) setDebug(c.debug);
    } catch (e) {
      if (e.message === 'SENSIBULL_SESSION') { setErr('Your Sensibull session was rejected or has expired. Log in to Sensibull again and paste a fresh cookie.'); setShowSession(true); }
      else setErr(e.message);
    }
    setLoading(false);
  }, [api, session, underlying, expiry, atmSel, ready]);
  useEffect(() => { setData(null); setSnaps([]); load(); }, [underlying, expiry, atmSel, session]); // eslint-disable-line

  // Auto-refresh every 60s while the market is open
  const tick = useRef(0);
  useEffect(() => {
    if (!auto || !data?.marketOpen) return;
    const t = setInterval(() => { tick.current++; load(tick.current % 3 === 0); }, 60000);
    return () => clearInterval(t);
  }, [auto, data?.marketOpen, load]);

  useEffect(() => {
    if (q.length < 2) { setFound([]); return; }
    const t = setTimeout(() => api.stocks.search(q).then((r) => setFound(r.results)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, api]);

  const saveSession = () => {
    const v = draft.trim();
    if (v.length < 10) return notify('Paste the cookie string, or the whole copied curl');
    try { localStorage.setItem(SESSION_KEY, v); } catch { /* storage off: keep for this visit only */ }
    setSession(v); setDraft(''); setShowSession(false); notify('Session saved in this browser');
  };
  const clearSession = () => { try { localStorage.removeItem(SESSION_KEY); } catch { /* */ } setSession(''); setData(null); };

  const stats = data?.stats;
  const chain = data?.chain || [];
  const has = data?.has || {};
  const atmIdx = stats ? chain.findIndex((r) => r.strike === stats.atm) : -1;
  const near = useMemo(() => (atmIdx < 0 ? [] : range === 0 ? chain : chain.slice(Math.max(0, atmIdx - range), atmIdx + range + 1)), [chain, atmIdx, range]);
  const maxOi = Math.max(1, ...near.flatMap((r) => [r.ce.oi, r.pe.oi]));
  const spikeList = useMemo(() => findSpikes(near, threshold), [near, threshold]);
  const shownCols = cols.filter((c) => ['oi', 'chgOi', 'prevOi', 'chg', 'buildup'].includes(c) || has[c === 'chg' ? 'ltp' : c]);

  useEffect(() => {
    if (stats && atmIdx >= 0) setPicked((p) => (p.length && p.every((k) => chain.some((r) => r.strike === k)) ? p : [chain[atmIdx - 1]?.strike, stats.atm, chain[atmIdx + 1]?.strike].filter(Boolean)));
  }, [stats?.atm, expiry]); // eslint-disable-line

  const timeData = snaps.map((s) => ({ t: time(s.at), ce: timeMode === 'oi' ? s.ceOI : s.ceChg, pe: timeMode === 'oi' ? s.peOI : s.peChg, pcr: s.pcr }));
  const tuesdays = nextDays(2), thursdays = nextDays(4);

  return (
    <div className="page">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><Activity size={22} /> Option Chain</h1>
          <div className="muted">{underlying} · {expiry} · {data?.at ? `updated ${time(data.at)}` : ready ? 'loading…' : 'add your session to start'} {data && !data.marketOpen && <span className="tag" style={{ marginLeft: 6 }}>Market closed</span>}{demo && <span className="tag" style={{ marginLeft: 6, color: 'var(--gold)' }}>Sample data</span>}</div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="row muted" style={{ gap: 6, fontSize: 13 }}>Auto 60s <Toggle on={auto} onChange={setAuto} /></span>
          <button className="btn sm" onClick={() => load()} disabled={loading || !ready}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh</button>
          {!demo && <button className={cls('btn sm', !session && 'primary')} onClick={() => setShowSession((v) => !v)}><KeyRound size={14} /> Sensibull session{session ? ' ✓' : ''}</button>}
        </div>
      </div>

      {!demo && (showSession || !session) && (
        <Reveal className="card" style={{ marginTop: 16, borderColor: 'var(--line2)' }}>
          <h3 className="row"><KeyRound size={16} /> Your Sensibull session</h3>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: '6px 0 12px' }}>
            Log in at web.sensibull.com, open DevTools → Network, find the <b>oi_change_chart</b> request, and copy it as cURL (or just its Cookie header). Paste it below.
            It's saved <b>only in this browser</b>, sent with each refresh, and never stored on the server. Treat it like a password: anyone with it can use your Sensibull account.
          </p>
          <div className="row">
            <input className="input" type="password" autoComplete="off" spellCheck={false} placeholder={session ? 'A session is saved. Paste a new one to replace it' : 'Paste cookie string or the whole curl…'} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveSession()} />
            <button className="btn primary" onClick={saveSession}>Save</button>
            {session && <button className="btn danger" onClick={clearSession}>Clear</button>}
          </div>
          <p className="dim row" style={{ fontSize: 12.5, gap: 6, marginBottom: 0 }}><Info size={13} /> This uses Sensibull's internal endpoint, not a public API. It can change without notice, and automated use may be against Sensibull's terms. Refreshes are limited to one every 20 seconds.</p>
        </Reveal>
      )}

      <div className="card row wrap" style={{ marginTop: 16, padding: 10, gap: 10 }}>
        <Seg options={UNDER} value={UNDER.includes(underlying) ? underlying : ''} onChange={(u) => { setUnderlying(u); setQ(''); }} />
        <div style={{ position: 'relative' }}>
          <div className="row" style={{ background: 'var(--panel2)', borderRadius: 10, padding: '0 10px', width: 210 }}><Search size={14} className="muted" /><input className="input" style={{ background: 'none', padding: 8, textTransform: 'uppercase' }} placeholder="Stock: RELIANCE…" value={q || (UNDER.includes(underlying) ? '' : underlying)} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { setUnderlying(q.trim().toUpperCase()); setQ(''); setFound([]); } }} /></div>
          {found.length > 0 && (
            <div className="dropdown">
              {found.map((f) => <button key={f.symbol} onClick={() => { setUnderlying(f.symbol); setQ(''); setFound([]); }}><b>{f.symbol}</b><span className="muted">{f.name}</span></button>)}
            </div>
          )}
        </div>
        <span className="grow" />
        <input type="date" className="input" style={{ width: 160, padding: '8px 10px', colorScheme: 'dark' }} value={expiry} onChange={(e) => setExpiry(e.target.value)} title="Expiry date" />
        <select className="select" style={{ width: 128, padding: '8px 12px' }} value={atmSel} onChange={(e) => setAtmSel(e.target.value)} title="Strikes Sensibull returns around ATM">
          {['five', 'ten', 'fifteen', 'twenty', 'all'].map((v) => <option key={v} value={v}>ATM ± {v}</option>)}
        </select>
        <Seg options={[{ value: 5, label: '±5' }, { value: 10, label: '±10' }, { value: 0, label: 'All' }]} value={range} onChange={setRange} />
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
        <span className="dim" style={{ fontSize: 12 }}>Expiry quick picks:</span>
        {[...tuesdays.map((d) => [d, 'Tue']), ...thursdays.map((d) => [d, 'Thu'])].sort().map(([d, w]) => (
          <button key={d} className={cls('chip', expiry === d && 'on')} style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => setExpiry(d)}>{w} {d.slice(8)}/{d.slice(5, 7)}</button>
        ))}
        <span className="dim" style={{ fontSize: 12 }}>Pick the exchange's actual expiry for {underlying}; other dates return no strikes.</span>
      </div>
      {err && <p className="neg" style={{ marginTop: 12 }}>{err}</p>}
      {!demo && session && (
        <button className="btn sm ghost" style={{ marginTop: 6 }} onClick={() => load(false, true)}>Show raw response fields</button>
      )}
      {debug && (
        <div className="card" style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
          <b>Payload keys:</b> {debug.keys.join(', ') || '(none)'}{'\n'}<b>First strike:</b> {JSON.stringify(debug.sampleStrike)}
          {'\n\n'}<span className="muted" style={{ fontFamily: 'var(--font)' }}>Send this to whoever maintains the site to map more columns (LTP, IV, greeks). It contains no cookie.</span>
        </div>
      )}

      {stats && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 14 }}>
            {[
              stats.spot ? ['Spot', num(stats.spot)] : ['ATM strike', `${stats.atm}${stats.atmEstimated ? ' (est.)' : ''}`, stats.atmEstimated ? 'centre of the strikes returned' : ''],
              ['PCR (OI)', num(stats.pcr), stats.pcrChg != null ? `Chg PCR ${num(stats.pcrChg)}` : ''],
              ['Max pain', num(stats.maxPain, 0)],
              ...(has.iv ? [['ATM IV', `${num(stats.atmIv)}%`]] : []),
              ...(has.ltp && stats.straddle ? [['Expected move', `± ${num(stats.straddle)}`, stats.spot ? `ATM straddle · ${num((stats.straddle / stats.spot) * 100)}%` : 'ATM straddle']] : []),
              ['Call OI / Put OI', `${lakh(stats.ceOI)} / ${lakh(stats.peOI)}`, `Δ ${lakh(stats.ceChg)} / ${lakh(stats.peChg)}`],
            ].map(([l, v, sub], i) => (
              <Reveal key={l} delay={i * 0.03} className="card stat" style={{ padding: 16 }}><div className="label">{l}</div><div className="val" style={{ fontSize: l.startsWith('Call') ? 16 : 24, marginTop: 10 }}>{v}</div>{sub && <div className="foot" style={{ fontSize: 12 }}>{sub}</div>}</Reveal>
            ))}
          </div>
          <div className="card row wrap" style={{ marginTop: 14, gap: 18 }}>
            <span><span className="muted">Bias: </span><b className={/ullish/.test(stats.bias) ? 'pos' : /earish/.test(stats.bias) ? 'neg' : ''}>{stats.bias}</b></span>
            <span><span className="muted">Resistance (call OI): </span>{stats.resistance.map((x) => <span key={x.strike} className="tag" style={{ color: RED, marginLeft: 4 }}>{x.strike} · {lakh(x.value)}</span>)}</span>
            <span><span className="muted">Support (put OI): </span>{stats.support.map((x) => <span key={x.strike} className="tag" style={{ color: GREEN, marginLeft: 4 }}>{x.strike} · {lakh(x.value)}</span>)}</span>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))', marginTop: 14 }}>
            <Reveal className="card">
              <div className="row between"><h3>{oiMode === 'change' ? 'OI change by strike' : 'Open interest by strike'}</h3><Seg options={[{ value: 'change', label: 'Change' }, { value: 'oi', label: 'Total OI' }]} value={oiMode} onChange={setOiMode} /></div>
              <div className="sub">Call (red) vs put (green){oiMode === 'change' ? ' · since previous day close' : ''}</div>
              <div style={{ height: 320, marginTop: 10 }}>
                <ResponsiveContainer>
                  <BarChart data={near.map((r) => ({ k: r.strike, ce: oiMode === 'change' ? r.ce.chgOi : r.ce.oi, pe: oiMode === 'change' ? r.pe.chgOi : r.pe.oi }))} barGap={2}>
                    <CartesianGrid strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="k" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
                    <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={(v) => lakh(v, 1)} />
                    <Tooltip cursor={{ fill: '#ffffff08' }} content={<Tip />} />
                    <ReferenceLine x={stats.atm} stroke="#888" strokeDasharray="4 4" label={{ value: 'ATM', fill: '#999', fontSize: 11, position: 'top' }} />
                    <ReferenceLine y={0} stroke="#444" />
                    <Bar dataKey="ce" name="Call" fill={RED} radius={[4, 4, 0, 0]} animationDuration={700} />
                    <Bar dataKey="pe" name="Put" fill={GREEN} radius={[4, 4, 0, 0]} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Reveal>
            <Reveal delay={0.05} className="card">
              <div className="row between"><h3>OI vs PCR vs time</h3><Seg options={[{ value: 'oi', label: 'Total OI' }, { value: 'chg', label: 'OI change' }]} value={timeMode} onChange={setTimeMode} /></div>
              <div className="sub">Today, recorded every 3 minutes while you follow this chain</div>
              <div style={{ height: 320, marginTop: 10 }}>
                {timeData.length > 1 ? (
                  <ResponsiveContainer>
                    <ComposedChart data={timeData}>
                      <CartesianGrid strokeDasharray="3 4" vertical={false} />
                      <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={20} />
                      <YAxis yAxisId="oi" tickLine={false} axisLine={false} width={60} tickFormatter={(v) => lakh(v, 1)} />
                      <YAxis yAxisId="pcr" orientation="right" tickLine={false} axisLine={false} width={44} domain={[(m) => Math.max(0, +(m - 0.1).toFixed(2)), (m) => +(m + 0.1).toFixed(2)]} tickFormatter={(v) => v.toFixed(2)} />
                      <Tooltip content={<Tip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar yAxisId="oi" dataKey="ce" name="Call OI" fill={RED} radius={[3, 3, 0, 0]} />
                      <Bar yAxisId="oi" dataKey="pe" name="Put OI" fill={GREEN} radius={[3, 3, 0, 0]} />
                      <Line yAxisId="pcr" dataKey="pcr" name="PCR" stroke={PURPLE} strokeWidth={2} dot={{ r: 3, stroke: PURPLE, fill: 'var(--panel)' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <div className="empty" style={{ padding: 40 }}>Fills in during market hours. Keep this page open, or come back later: the server records every 3 minutes once you've opened this chain today.</div>}
              </div>
            </Reveal>
          </div>

          <StrikeCharts snaps={snaps} chain={chain} picked={picked} setPicked={setPicked} atm={stats.atm} />

          <Reveal className="card" style={{ marginTop: 14 }}>
            <div className="row between wrap" style={{ gap: 10 }}>
              <div><h3 className="row"><Zap size={16} /> OI spikes</h3><div className="sub">Strikes where OI changed by more than the threshold since yesterday</div></div>
              <select className="select" style={{ width: 160, padding: '8px 12px' }} value={threshold} onChange={(e) => { setThreshold(+e.target.value); localStorage.setItem('tp.oc.spike', e.target.value); }}>
                {[2e5, 5e5, 1e6, 2.5e6, 5e6, 1e7].map((v) => <option key={v} value={v}>≥ {lakh(v, 1)}</option>)}
              </select>
            </div>
            <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
              {spikeList.length ? spikeList.slice(0, 16).map((s) => (
                <span key={s.strike + s.side} className="tag" style={{ padding: '7px 11px', border: `1px solid ${s.side === 'CE' ? RED : GREEN}55` }}>
                  <b>{s.strike} {s.side}</b>&nbsp;<span className={s.chgOi > 0 ? 'pos' : 'neg'}>{s.chgOi > 0 ? '+' : ''}{lakh(s.chgOi)}</span>{s.buildup && <span className="muted">&nbsp;· {s.buildup}</span>}
                </span>
              )) : <span className="muted">No strike crossed {lakh(threshold, 1)} today.</span>}
            </div>
          </Reveal>

          <ChainTable near={near} stats={stats} maxOi={maxOi} cols={shownCols} has={has} setCols={(c) => { setCols(c); localStorage.setItem('tp.oc.cols', JSON.stringify(c)); }} />
          <p className="dim" style={{ fontSize: 12, marginTop: 14 }}>Data from your own Sensibull session. PCR, max pain, bias and support/resistance are calculations to help reading the chain, not trade recommendations.</p>
        </>
      )}
    </div>
  );
}

function StrikeCharts({ snaps, chain, picked, setPicked, atm }) {
  const strikes = chain.map((r) => r.strike);
  const i = strikes.indexOf(atm);
  const choices = strikes.slice(Math.max(0, i - 6), i + 7);
  return (
    <Reveal className="card" style={{ marginTop: 14 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div><h3>Strike OI over the day</h3><div className="sub">Call and put OI through the session, with OI added per interval</div></div>
        <div className="row wrap" style={{ gap: 6 }}>
          {choices.map((k) => (
            <button key={k} className={cls('chip', picked.includes(k) && 'on')} style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => setPicked(picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k].slice(-4))}>{k}{k === atm ? ' · ATM' : ''}</button>
          ))}
        </div>
      </div>
      {snaps.length < 2 ? <div className="empty" style={{ padding: 30 }}>Needs at least two snapshots from today.</div> : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,460px),1fr))', marginTop: 12 }}>
          {picked.slice().sort((a, b) => a - b).map((k) => {
            const pts = snaps.map((s) => ({ t: time(s.at), row: (s.strikes || []).find((x) => x[0] === k) })).filter((p) => p.row);
            const data = pts.map((p, j) => ({ t: p.t, ce: p.row[1], pe: p.row[2], dce: j ? p.row[1] - pts[j - 1].row[1] : 0, dpe: j ? p.row[2] - pts[j - 1].row[2] : 0 }));
            const lastRow = chain.find((r) => r.strike === k);
            if (!lastRow) return null;
            const bull = lastRow.pe.chgOi - lastRow.ce.chgOi > 0;
            return (
              <div key={k} style={{ background: 'var(--panel2)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontWeight: 700, color: bull ? GREEN : RED, fontSize: 14 }}>
                  Strike {k} | Call {lakh(lastRow.ce.oi)} | Put {lakh(lastRow.pe.oi)} | Total {lakh(lastRow.ce.oi + lastRow.pe.oi)} | Sentiment: {bull ? 'Bullish' : 'Bearish'}
                </div>
                <div style={{ height: 220, marginTop: 8 }}>
                  {data.length > 1 ? (
                    <ResponsiveContainer>
                      <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 4" vertical={false} />
                        <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={24} />
                        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => lakh(v, 1)} />
                        <Tooltip content={<Tip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="dce" name="Call OI Δ" fill={RED} fillOpacity={0.55} />
                        <Bar dataKey="dpe" name="Put OI Δ" fill="#6aa8ff" fillOpacity={0.55} />
                        <Line dataKey="ce" name="Call OI" stroke={RED} strokeWidth={2} dot={false} />
                        <Line dataKey="pe" name="Put OI" stroke="#6aa8ff" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <div className="empty" style={{ padding: 30 }}>Not recorded yet for this strike.</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Reveal>
  );
}

function ChainTable({ near, stats, maxOi, cols, setCols, has }) {
  const cell = (s, c) => {
    switch (c) {
      case 'buildup': return <span style={{ fontSize: 11.5, color: /Long buildup|Short covering/.test(s.buildup) ? GREEN : s.buildup ? RED : '#666' }}>{s.buildup || '—'}</span>;
      case 'oi': return lakh(s.oi);
      case 'prevOi': return <span className="muted">{lakh(s.prevOi)}</span>;
      case 'chgOi': return <span className={s.chgOi > 0 ? 'pos' : s.chgOi < 0 ? 'neg' : ''}>{lakh(s.chgOi)}</span>;
      case 'volume': return lakh(s.volume);
      case 'iv': return num(s.iv);
      case 'delta': return num(s.delta, 2);
      case 'theta': return num(s.theta, 2);
      case 'gamma': return num(s.gamma, 4);
      case 'vega': return num(s.vega, 2);
      case 'ltp': return <b>{num(s.ltp)}</b>;
      case 'chg': return <span className={s.ltp >= s.close ? 'pos' : 'neg'}>{s.close ? num(((s.ltp - s.close) / s.close) * 100) : '—'}</span>;
      default: return null;
    }
  };
  const ceCols = cols, peCols = cols.slice().reverse();
  return (
    <Reveal className="card" style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
      <div className="row between wrap" style={{ padding: '16px 18px 10px', gap: 10 }}>
        <h3 style={{ margin: 0 }}>Option chain</h3>
        <div className="row wrap" style={{ gap: 6 }}>
          {Object.entries(COLS).filter(([k]) => ['oi', 'chgOi', 'prevOi', 'buildup'].includes(k) || has[k === 'chg' ? 'ltp' : k]).map(([k, l]) => <button key={k} className={cls('chip', cols.includes(k) && 'on')} style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => setCols(cols.includes(k) ? cols.filter((x) => x !== k) : Object.keys(COLS).filter((x) => cols.includes(x) || x === k))}>{l}</button>)}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="oc">
          <thead>
            <tr><th colSpan={ceCols.length} style={{ color: RED }}>CALLS</th><th /><th colSpan={peCols.length} style={{ color: GREEN }}>PUTS</th></tr>
            <tr>{ceCols.map((c) => <th key={'c' + c}>{COLS[c]}</th>)}<th className="strike">Strike</th>{peCols.map((c) => <th key={'p' + c}>{COLS[c]}</th>)}</tr>
          </thead>
          <tbody>
            {near.map((r) => {
              const ref = stats.spot || stats.atm, atm = r.strike === stats.atm, ceItm = r.strike < ref, peItm = r.strike > ref;
              return (
                <motion.tr key={r.strike} layout className={cls(atm && 'atm')}>
                  {ceCols.map((c) => (
                    <td key={'c' + c} className={cls(ceItm && 'itm')} style={c === 'oi' ? { background: `linear-gradient(to left, ${RED}33 ${(r.ce.oi / maxOi) * 100}%, transparent 0)` } : undefined}>{cell(r.ce, c)}</td>
                  ))}
                  <td className="strike">{r.strike}{atm && <div className="atm-tag">ATM{stats.spot ? ` · ${num(stats.spot)}` : stats.atmEstimated ? ' (est.)' : ''}</div>}</td>
                  {peCols.map((c) => (
                    <td key={'p' + c} className={cls(peItm && 'itm')} style={c === 'oi' ? { background: `linear-gradient(to right, ${GREEN}33 ${(r.pe.oi / maxOi) * 100}%, transparent 0)` } : undefined}>{cell(r.pe, c)}</td>
                  ))}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}

