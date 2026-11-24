import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, RefreshCw, Search, Zap, Info, KeyRound, Server, Pause, Play, Trash2, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ComposedChart, Line, Legend } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Reveal, Toggle } from '../components/ui.jsx';
import { spikes as findSpikes } from '../lib/market/options.js';
import { cls } from '../lib/format.js';
import Board from '../components/Board.jsx';

// Calls red, puts green everywhere on this page
const RED = '#f0616d', GREEN = '#2fbf8f', PURPLE = '#a78bfa';

export const lakh = (v, d = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e7) return `${s}${(a / 1e7).toFixed(d)} Cr`;
  if (a >= 1e5) return `${s}${(a / 1e5).toFixed(d)} L`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(1)} K`;
  return `${s}${Math.round(a)}`;
};
const num = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }));
const signed = (n, d = 2) => (n == null || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${lakh(Math.abs(n), d)}`);
const hm = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
const hms = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const ago = (iso) => { if (!iso) return 'never'; const s = Math.round((Date.now() - new Date(iso)) / 1000); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : hm(iso); };

const LIVE_MS = 3000;
const MAX_TICKS = 1200; // 1 hour of 3-second updates kept on screen
const UNDER = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];
const SESSION_KEY = 'tp.sb.session';
const ymdL = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function nextDays(weekday, n = 4) {
  const out = []; const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 0; out.length < n && i < 60; i++) { const x = new Date(d); x.setDate(d.getDate() + i); if (x.getDay() === weekday) out.push(ymdL(x)); }
  return out;
}

// Shared chart styling: bigger, higher-contrast text so every chart reads at a glance
const AX = { tickLine: false, axisLine: false, tick: { fontSize: 12, fill: 'var(--text2)' } };
const GRID = <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />;
const LEG = { wrapperStyle: { fontSize: 13, paddingTop: 6 }, iconType: 'circle' };
const yLabel = (value, side = 'left') => ({ value, angle: side === 'left' ? -90 : 90, position: side === 'left' ? 'insideLeft' : 'insideRight', style: { fontSize: 12, fill: 'var(--text2)', textAnchor: 'middle' } });

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt" style={{ fontSize: 13 }}>
      <div className="muted" style={{ marginBottom: 4 }}>{label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.dataKey === 'pcr' ? num(p.value) : /delta/i.test(p.name) ? num(p.value, 3) : /Δ|change/i.test(p.name) ? signed(p.value) : lakh(p.value)}</div>
      ))}
    </div>
  );
}

const Card = ({ title, sub, right, children, style }) => (
  <Reveal className="card" style={{ marginTop: 16, ...style }}>
    <div className="row between wrap" style={{ gap: 10, alignItems: 'flex-start' }}>
      <div><h3 style={{ margin: 0, fontSize: 17 }} className="row">{title}</h3>{sub && <div className="sub" style={{ marginTop: 4, fontSize: 13 }}>{sub}</div>}</div>
      {right}
    </div>
    {children}
  </Reveal>
);

export default function Options() {
  const { api, notify } = useApp();
  const demo = api.demo;
  const [session, setSession] = useState(() => { try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; } });
  const [draft, setDraft] = useState('');
  const [showSession, setShowSession] = useState(false);
  const [underlying, setUnderlying] = useState(() => localStorage.getItem('tp.oc.under') || 'NIFTY');
  const [expiry, setExpiry] = useState(() => localStorage.getItem('tp.oc.expiry') || nextDays(2, 1)[0]);
  const [atmSel, setAtmSel] = useState(() => localStorage.getItem('tp.oc.atm') || 'ten');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [debug, setDebug] = useState(null);
  const [auto, setAuto] = useState(true);
  const [ticks, setTicks] = useState([]);
  const [day, setDay] = useState([]); // whole day, per minute
  const [recs, setRecs] = useState([]);
  const [range, setRange] = useState(10);
  const [oiMode, setOiMode] = useState('change');
  const [threshold, setThreshold] = useState(() => Number(localStorage.getItem('tp.oc.spike')) || 1000000);
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);

  const rec = recs.find((r) => r.underlying === underlying);
  const serverOn = !!rec && rec.enabled && rec.expiry === expiry && rec.status !== 'expired';
  const ready = demo || !!session || serverOn;

  useEffect(() => { localStorage.setItem('tp.oc.under', underlying); localStorage.setItem('tp.oc.expiry', expiry); localStorage.setItem('tp.oc.atm', atmSel); }, [underlying, expiry, atmSel]);

  const loadRecs = useCallback(() => api.options.recorders().then((r) => setRecs(r.recorders)).catch(() => {}), [api]);
  useEffect(() => { loadRecs(); const t = setInterval(loadRecs, 30000); return () => clearInterval(t); }, [loadRecs]);
  // In demo mode, follow the selected chain on the "server" automatically so the page shows everything
  useEffect(() => { if (demo && !recs.some((r) => r.underlying === underlying && r.expiry === expiry)) api.options.saveRecorder({ underlying, expiry, atm: atmSel }).then(loadRecs); }, [demo, underlying, expiry]); // eslint-disable-line

  const pushTick = (t) => { if (t) setTicks((all) => (all.at(-1)?.at === t.at ? all : [...all, t].slice(-MAX_TICKS))); };

  // One update: from the database when the server records this chain, otherwise a pull through this page
  const load = useCallback(async ({ quiet = false, wantDebug = false } = {}) => {
    if (!ready || !expiry) return;
    if (!quiet) setLoading(true);
    try {
      const c = serverOn && !wantDebug
        ? await api.options.live(underlying, expiry)
        : await api.options.chain({ cookie: session || 'demo', underlying, expiry, atm: atmSel, debug: wantDebug });
      if (c.chain?.length) { setData(c); setErr(''); }
      else if (serverOn) setErr(c.marketOpen ? 'The server has not recorded this chain yet. The first pull arrives within a few seconds of market hours.' : 'Nothing recorded for this chain yet. Recording starts at 9:15 IST.');
      if (c.debug) setDebug(c.debug);
      pushTick(c.tick);
    } catch (e) {
      if (e.status === 429) { /* previous pull still running */ }
      else if (e.message === 'SENSIBULL_SESSION') { setErr('Your Sensibull session was rejected or has expired. Log in to Sensibull again and paste a fresh one.'); setShowSession(true); }
      else setErr(e.message);
    }
    setLoading(false);
  }, [api, session, underlying, expiry, atmSel, ready, serverOn]);

  const loadDay = useCallback(() => {
    if (!ready || !expiry) return;
    const start = new Date(); start.setHours(9, 0, 0, 0);
    api.options.ticks(underlying, expiry, start.toISOString(), '1m').then((r) => setDay(r.ticks)).catch(() => {});
  }, [api, underlying, expiry, ready]);

  useEffect(() => {
    setData(null); setTicks([]); setDay([]); setDebug(null); load();
    if (ready && expiry) {
      api.options.ticks(underlying, expiry, new Date(Date.now() - 3600000).toISOString()).then((r) => setTicks((t) => [...r.ticks, ...t].slice(-MAX_TICKS))).catch(() => {});
      loadDay();
    }
  }, [underlying, expiry, atmSel, session, serverOn]); // eslint-disable-line

  // Live: every 3 seconds while the market is open (each update waits for the previous one)
  const loadRef = useRef(load); loadRef.current = load;
  const dayRef = useRef(loadDay); dayRef.current = loadDay;
  useEffect(() => {
    if (!auto || !data?.marketOpen) return;
    let stop = false, timer, n = 0;
    const run = async () => {
      if (stop) return;
      if (document.visibilityState === 'visible') { await loadRef.current({ quiet: true }); if (++n % 20 === 0) dayRef.current(); }
      if (!stop) timer = setTimeout(run, LIVE_MS);
    };
    timer = setTimeout(run, LIVE_MS);
    return () => { stop = true; clearTimeout(timer); };
  }, [auto, data?.marketOpen, underlying, expiry, atmSel, session, serverOn]);

  useEffect(() => {
    if (q.length < 2) { setFound([]); return; }
    const t = setTimeout(() => api.stocks.search(q).then((r) => setFound(r.results)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, api]);

  const saveSession = async () => {
    const v = draft.trim();
    if (v.length < 10) return notify('Paste the cookie string, or the whole copied curl');
    try { localStorage.setItem(SESSION_KEY, v); } catch { /* storage off */ }
    setSession(v); setDraft('');
    // A fresh session also refreshes the one the server uses, if server recording is on
    if (recs.length) { await api.options.saveRecorder({ underlying: recs[0].underlying, expiry: recs[0].expiry, cookie: v }).catch(() => {}); loadRecs(); }
    notify('Session saved');
  };
  const clearSession = () => { try { localStorage.removeItem(SESSION_KEY); } catch { /* */ } setSession(''); };

  const startServer = async () => {
    if (!session && !rec && !demo) return notify('Paste your Sensibull session first');
    try {
      await api.options.saveRecorder({ underlying, expiry, atm: atmSel, enabled: true, ...(session && { cookie: session }) });
      notify(`Server is recording ${underlying} ${expiry}`); loadRecs();
    } catch (e) { notify(e.message); }
  };
  const toggleRec = async (r) => { await api.options.saveRecorder({ underlying: r.underlying, expiry: r.expiry, enabled: !r.enabled }); loadRecs(); };
  const removeRec = async (r) => { await api.options.removeRecorder(r.underlying); loadRecs(); };
  const removeAll = async () => { await api.options.removeAllRecorders(); loadRecs(); notify('Session removed from the server; server recording stopped'); };

  const stats = data?.stats;
  const chain = data?.chain || [];
  const has = data?.has || {};
  const atmIdx = stats ? chain.findIndex((r) => r.strike === stats.atm) : -1;
  const near = useMemo(() => (atmIdx < 0 ? [] : range === 0 ? chain : chain.slice(Math.max(0, atmIdx - range), atmIdx + range + 1)), [chain, atmIdx, range]);
  const spikeList = useMemo(() => findSpikes(near, threshold), [near, threshold]);

  // Per-strike change over the last update and the last 5 minutes, from the recorded updates
  const strikeMoves = useMemo(() => {
    const last = new Map(), five = new Map();
    const from = Date.now() - 5 * 60000;
    for (const t of ticks) {
      if (new Date(t.at) < from) continue;
      for (const [k, c, p] of t.d || []) { const v = five.get(k) || [0, 0]; five.set(k, [v[0] + c, v[1] + p]); }
    }
    for (const [k, c, p] of ticks.at(-1)?.d || []) last.set(k, [c, p]);
    return { last, five };
  }, [ticks]);

  useEffect(() => {
    if (stats && atmIdx >= 0) setPicked((p) => (p.length && p.every((k) => chain.some((r) => r.strike === k)) ? p : [chain[atmIdx - 1]?.strike, stats.atm, chain[atmIdx + 1]?.strike].filter(Boolean)));
  }, [stats?.atm, expiry]); // eslint-disable-line

  const tuesdays = nextDays(2), thursdays = nextDays(4);
  const source = demo ? 'Sample data' : serverOn ? 'Server recording' : session ? 'This page (Sensibull)' : 'No source';

  return (
    <Board id="options" className="page wide-page">
      <div data-fixed className="page-head row between wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><Activity size={22} /> Option Chain</h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            <b>{underlying}</b> · expiry {expiry} · {data?.at ? `updated ${hms(data.at)}` : ready ? 'loading…' : 'add your Sensibull session to start'}
            <span className="tag" style={{ marginLeft: 8 }}>{serverOn ? <Server size={12} /> : null} {source}</span>
            {data && !data.marketOpen && <span className="tag" style={{ marginLeft: 6 }}>Market closed</span>}
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="row muted" style={{ gap: 6, fontSize: 13 }}>{auto && data?.marketOpen && <span className="live-dot" />}Live every 3s <Toggle on={auto} onChange={setAuto} /></span>
          <button className="btn sm" onClick={() => { load(); loadDay(); }} disabled={loading || !ready}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh</button>
          <button className={cls('btn sm', !ready && 'primary')} onClick={() => setShowSession((v) => !v)}><KeyRound size={14} /> Session & recording{session || recs.length ? ' ✓' : ''}</button>
        </div>
      </div>

      {(showSession || !ready) && (
        <Reveal className="card" style={{ marginTop: 16 }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 24 }}>
            {!demo && (
              <div>
                <h3 className="row"><KeyRound size={16} /> Your Sensibull session</h3>
                <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: '6px 0 12px' }}>
                  Log in at web.sensibull.com, open DevTools → Network, find the <b>oi_change_chart</b> request and copy it as cURL (or just its Cookie header). Paste it here.
                  Treat it like a password: anyone with it can use your Sensibull account.
                </p>
                <div className="row">
                  <input className="input" type="password" autoComplete="off" spellCheck={false} placeholder={session ? 'A session is saved. Paste a new one to replace it' : 'Paste cookie string or the whole curl…'} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveSession()} />
                  <button className="btn primary" onClick={saveSession}>Save</button>
                  {session && <button className="btn danger" onClick={clearSession}>Clear</button>}
                </div>
                <p className="dim row" style={{ fontSize: 12.5, gap: 6, marginBottom: 0, alignItems: 'flex-start' }}><Info size={13} style={{ marginTop: 2 }} /> Saved in this browser. It goes to the server only if you turn on server recording. This uses Sensibull's internal endpoint, which can change without notice; pulling every 3 seconds may be against Sensibull's terms and can get the session blocked.</p>
              </div>
            )}
            <div>
              <h3 className="row"><Server size={16} /> Record on the server, even when this site is closed</h3>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: '6px 0 12px' }}>
                The server pulls the chain every 3 seconds from 9:15 to 15:30 IST and stores every update, so the charts are complete when you come back. Your session is stored <b>encrypted</b> on the server for this; remove it any time. After expiry it moves to the next expiry on its own.
              </p>
              {recs.length > 0 && (
                <div className="col" style={{ gap: 8, marginBottom: 12 }}>
                  {recs.map((r) => (
                    <div key={r.underlying} className="row between" style={{ background: 'var(--panel2)', borderRadius: 12, padding: '10px 12px', gap: 10 }}>
                      <div style={{ fontSize: 13.5 }}>
                        <b>{r.underlying}</b> · {r.expiry}{' '}
                        <span className="tag" style={{ color: r.status === 'recording' ? 'var(--green)' : r.status === 'expired' || r.status === 'error' ? 'var(--red)' : 'var(--text2)' }}>{r.enabled ? r.status : 'paused'}</span>
                        <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>{r.lastError || `last pull ${ago(r.lastAt)}`}</div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="icon-btn" title={r.enabled ? 'Pause' : 'Resume'} onClick={() => toggleRec(r)}>{r.enabled ? <Pause size={15} /> : <Play size={15} />}</button>
                        <button className="icon-btn" title="Stop recording this chain" onClick={() => removeRec(r)}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="row wrap" style={{ gap: 8 }}>
                <button className="btn primary" onClick={startServer} disabled={serverOn}><Server size={14} /> {serverOn ? `Recording ${underlying} on the server` : rec ? `Record ${underlying} ${expiry} instead` : `Record ${underlying} ${expiry} on the server`}</button>
                {recs.length > 0 && <button className="btn danger" onClick={removeAll}>Remove my session from the server</button>}
              </div>
              <p className="dim" style={{ fontSize: 12.5, marginBottom: 0 }}>Up to 3 chains. The server must be awake to record: on Render's free plan it sleeps after 15 minutes without visits, so use a paid instance or an uptime pinger on <code>/api/health</code>.</p>
            </div>
          </div>
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
        <label className="row muted" style={{ gap: 6, fontSize: 13 }}>Expiry <input type="date" className="input" style={{ width: 160, padding: '8px 10px' }} value={expiry} onChange={(e) => setExpiry(e.target.value)} /></label>
        <label className="row muted" style={{ gap: 6, fontSize: 13 }}>Fetch <select className="select" style={{ width: 132, padding: '8px 12px' }} value={atmSel} onChange={(e) => setAtmSel(e.target.value)} title="Strikes Sensibull returns around ATM">
          {[['five', 'ATM ± 5'], ['ten', 'ATM ± 10'], ['fifteen', 'ATM ± 15'], ['twenty', 'ATM ± 20'], ['all', 'All strikes']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select></label>
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
        <span className="dim" style={{ fontSize: 12 }}>Expiry quick picks:</span>
        {[...tuesdays.map((d) => [d, 'Tue']), ...thursdays.map((d) => [d, 'Thu'])].sort().map(([d, w]) => (
          <button key={d} className={cls('chip', expiry === d && 'on')} style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => setExpiry(d)}>{w} {d.slice(8)}/{d.slice(5, 7)}</button>
        ))}
        <span className="dim" style={{ fontSize: 12 }}>Use the exchange's real expiry for {underlying}; other dates return no strikes.</span>
      </div>
      {err && <p className="neg" style={{ marginTop: 12 }}>{err}</p>}
      {!demo && session && <button className="btn sm ghost" style={{ marginTop: 6 }} onClick={() => load({ wantDebug: true })}>Show raw response fields</button>}
      {debug && (
        <div className="card" style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
          <b>Payload keys:</b> {debug.keys.join(', ') || '(none)'}{'\n'}<b>First strike:</b> {JSON.stringify(debug.sampleStrike)}
          {'\n\n'}<span className="muted" style={{ fontFamily: 'var(--font)' }}>Send this to whoever maintains the site to map more fields. It contains no cookie.</span>
        </div>
      )}

      {stats && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', marginTop: 16 }}>
            {[
              stats.spot ? ['Spot', num(stats.spot)] : ['ATM strike', `${stats.atm}`, stats.atmEstimated ? 'estimated: centre of strikes' : ''],
              ['PCR (OI)', num(stats.pcr), stats.pcr > 1 ? 'More puts written: support below' : 'More calls written: cap above'],
              ['Call OI', lakh(stats.ceOI), `${signed(stats.ceChg)} today`, RED],
              ['Put OI', lakh(stats.peOI), `${signed(stats.peChg)} today`, GREEN],
              ['Max pain', num(stats.maxPain, 0)],
              ['Last update', ticks.at(-1) ? hms(ticks.at(-1).at) : '—', ticks.at(-1) ? `CE ${signed(ticks.at(-1).dCe)} · PE ${signed(ticks.at(-1).dPe)}` : 'waiting for the 2nd update'],
            ].map(([l, v, sub, color], i) => (
              <Reveal key={l} delay={i * 0.03} className="card stat" style={{ padding: 16 }}>
                <div className="label">{l}</div>
                <div className="val" style={{ fontSize: 24, marginTop: 10, color }}>{v}</div>
                {sub && <div className="foot" style={{ fontSize: 12.5 }}>{sub}</div>}
              </Reveal>
            ))}
          </div>
          <div className="card row wrap" style={{ marginTop: 14, gap: 18, fontSize: 14 }}>
            <span><span className="muted">Bias: </span><b className={/ullish/.test(stats.bias) ? 'pos' : /earish/.test(stats.bias) ? 'neg' : ''}>{stats.bias}</b></span>
            <span><span className="muted">Resistance (most call OI): </span>{stats.resistance.map((x) => <span key={x.strike} className="tag" style={{ color: RED, marginLeft: 4 }}>{x.strike} · {lakh(x.value)}</span>)}</span>
            <span><span className="muted">Support (most put OI): </span>{stats.support.map((x) => <span key={x.strike} className="tag" style={{ color: GREEN, marginLeft: 4 }}>{x.strike} · {lakh(x.value)}</span>)}</span>
          </div>

          <UpdateChart ticks={ticks} day={day} live={auto && data?.marketOpen} marketOpen={data?.marketOpen} underlying={underlying} expiry={expiry} />

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,640px),1fr))' }}>
            <Card title={oiMode === 'change' ? 'OI change by strike (since yesterday)' : 'Open interest by strike'} sub="Red = calls, green = puts. Dashed line = ATM."
              right={<Seg options={[{ value: 'change', label: 'Change' }, { value: 'oi', label: 'Total OI' }]} value={oiMode} onChange={setOiMode} />}>
              <div style={{ height: 360, marginTop: 12 }}>
                <ResponsiveContainer>
                  <BarChart data={near.map((r) => ({ k: r.strike, ce: oiMode === 'change' ? r.ce.chgOi : r.ce.oi, pe: oiMode === 'change' ? r.pe.chgOi : r.pe.oi }))} barGap={2}>
                    {GRID}
                    <XAxis dataKey="k" {...AX} interval="preserveStartEnd" minTickGap={10} />
                    <YAxis {...AX} width={70} tickFormatter={(v) => lakh(v, 1)} label={yLabel('Contracts')} />
                    <Tooltip cursor={{ fill: 'var(--line)' }} content={<Tip />} />
                    <Legend {...LEG} />
                    <ReferenceLine x={stats.atm} stroke="var(--text2)" strokeDasharray="4 4" label={{ value: 'ATM', fill: 'var(--text2)', fontSize: 12, position: 'top' }} />
                    <ReferenceLine y={0} stroke="var(--line2)" />
                    <Bar dataKey="ce" name={oiMode === 'change' ? 'Call OI change' : 'Call OI'} fill={RED} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pe" name={oiMode === 'change' ? 'Put OI change' : 'Put OI'} fill={GREEN} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Call OI vs put OI vs PCR, through the day" sub="One point per minute from every recorded update. PCR on the right axis.">
              <div style={{ height: 360, marginTop: 12 }}>
                {day.length > 1 ? (
                  <ResponsiveContainer>
                    <ComposedChart data={day.map((b) => ({ t: hm(b.at), ce: b.ceOI, pe: b.peOI, pcr: b.pcr }))}>
                      {GRID}
                      <XAxis dataKey="t" {...AX} minTickGap={30} />
                      <YAxis yAxisId="oi" {...AX} width={70} tickFormatter={(v) => lakh(v, 1)} domain={['auto', 'auto']} label={yLabel('Total OI')} />
                      <YAxis yAxisId="pcr" orientation="right" {...AX} width={52} domain={[(m) => Math.max(0, +(m - 0.05).toFixed(2)), (m) => +(m + 0.05).toFixed(2)]} tickFormatter={(v) => v.toFixed(2)} label={yLabel('PCR', 'right')} />
                      <Tooltip content={<Tip />} />
                      <Legend {...LEG} />
                      <Line yAxisId="oi" dataKey="ce" name="Call OI" stroke={RED} strokeWidth={2.2} dot={false} />
                      <Line yAxisId="oi" dataKey="pe" name="Put OI" stroke={GREEN} strokeWidth={2.2} dot={false} />
                      <Line yAxisId="pcr" dataKey="pcr" name="PCR" stroke={PURPLE} strokeWidth={2} strokeDasharray="5 3" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <div className="empty" style={{ padding: 40 }}>Fills in during market hours as updates are recorded.</div>}
              </div>
            </Card>
          </div>

          <StrikeCharts api={api} underlying={underlying} expiry={expiry} chain={chain} picked={picked} setPicked={setPicked} atm={stats.atm} live={auto && data?.marketOpen} />

          <ChainTable near={near} stats={stats} moves={strikeMoves} has={has} range={range} setRange={setRange} total={chain.length} />

          <Card title={<><Zap size={16} /> OI spikes</>} sub="Strikes whose OI changed more than the threshold since yesterday"
            right={<select className="select" style={{ width: 160, padding: '8px 12px' }} value={threshold} onChange={(e) => { setThreshold(+e.target.value); localStorage.setItem('tp.oc.spike', e.target.value); }}>{[2e5, 5e5, 1e6, 2.5e6, 5e6, 1e7].map((v) => <option key={v} value={v}>≥ {lakh(v, 1)}</option>)}</select>}>
            <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
              {spikeList.length ? spikeList.slice(0, 16).map((s) => (
                <span key={s.strike + s.side} className="tag" style={{ padding: '7px 11px', fontSize: 13, border: `1px solid ${s.side === 'CE' ? RED : GREEN}55` }}>
                  <b>{s.strike} {s.side}</b>&nbsp;<span className={s.chgOi > 0 ? 'pos' : 'neg'}>{signed(s.chgOi)}</span>
                </span>
              )) : <span className="muted">No strike crossed {lakh(threshold, 1)} today.</span>}
            </div>
          </Card>
          <p className="dim" style={{ fontSize: 12, marginTop: 14 }}>Data from your own Sensibull session. PCR, max pain, bias and support/resistance are calculations to help read the chain, not trade recommendations.</p>
        </>
      )}
    </Board>
  );
}

/** OI change at every 3-second update: totals, a full-width chart, strikes that moved, CSV */
function UpdateChart({ ticks, day, live, marketOpen, underlying, expiry }) {
  const [win, setWin] = useState(100);
  const last = ticks.at(-1);
  const sumSince = (ms) => { const from = Date.now() - ms; return ticks.filter((t) => new Date(t.at) >= from).reduce((a, t) => ({ ce: a.ce + t.dCe, pe: a.pe + t.dPe }), { ce: 0, pe: 0 }); };
  const today = day.reduce((a, b) => ({ ce: a.ce + b.dCe, pe: a.pe + b.dPe }), { ce: 0, pe: 0 });
  const isDay = win === 'day';
  const rows = isDay ? day.map((b) => ({ t: hm(b.at), ce: b.dCe, pe: b.dPe })) : ticks.slice(-win).map((t) => ({ t: hms(t.at), ce: t.dCe, pe: t.dPe }));
  let cc = 0, cp = 0;
  const data = rows.map((r) => ({ ...r, cce: (cc += r.ce), cpe: (cp += r.pe) }));
  const moves = (last?.d || []).slice().sort((a, b) => Math.abs(b[1]) + Math.abs(b[2]) - Math.abs(a[1]) - Math.abs(a[2])).slice(0, 10);
  const csv = () => {
    const out = [['time', 'spot', 'atm', 'pcr', 'call_oi', 'put_oi', 'call_oi_change', 'put_oi_change', 'strikes_changed (strike:call:put)']]
      .concat(ticks.map((t) => [new Date(t.at).toISOString(), t.spot || '', t.atm, t.pcr?.toFixed(3), t.ceOI, t.peOI, t.dCe, t.dPe, (t.d || []).map((x) => x.join(':')).join(' ')]));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
    a.download = `oi-updates-${underlying}-${expiry}.csv`; a.click();
  };
  return (
    <Card
      title={<>{live && <span className="live-dot" />} OI change at every update (3 seconds)</>}
      sub={!marketOpen ? 'Market closed. Showing what was recorded.' : !ticks.length ? 'Waiting for the second update…' : `${ticks.length} updates on screen · last ${hms(last.at)}${last.d?.length ? '' : ' · no change in the last update'}`}
      right={<div className="row" style={{ gap: 8 }}>
        <Seg options={[{ value: 40, label: '2 min' }, { value: 100, label: '5 min' }, { value: 300, label: '15 min' }, { value: 1200, label: '1 hour' }, { value: 'day', label: 'Today' }]} value={win} onChange={setWin} />
        <button className="btn sm" onClick={csv} disabled={!ticks.length}><Download size={14} /> CSV</button>
      </div>}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 14 }}>
        {[['Last update', last ? { ce: last.dCe, pe: last.dPe } : null], ['Last 1 min', sumSince(60000)], ['Last 5 min', sumSince(300000)], ['Last 15 min', sumSince(900000)], ['Today', day.length ? today : null]].map(([l, v]) => (
          <div key={l} style={{ background: 'var(--panel2)', borderRadius: 14, padding: 14 }}>
            <div className="eyebrow" style={{ fontSize: 11 }}>{l}</div>
            {v ? (
              <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.7 }}>
                <div className="row between"><span className="muted">Calls</span><b className="mono" style={{ color: RED }}>{signed(v.ce)}</b></div>
                <div className="row between"><span className="muted">Puts</span><b className="mono" style={{ color: GREEN }}>{signed(v.pe)}</b></div>
              </div>
            ) : <div className="dim" style={{ marginTop: 8 }}>—</div>}
          </div>
        ))}
      </div>
      <div style={{ height: 380, marginTop: 16 }}>
        {data.length > 1 ? (
          <ResponsiveContainer>
            <ComposedChart data={data} barGap={0}>
              {GRID}
              <XAxis dataKey="t" {...AX} minTickGap={50} />
              <YAxis yAxisId="d" {...AX} width={70} tickFormatter={(v) => lakh(v, 1)} label={yLabel(isDay ? 'Change per minute' : 'Change per update')} />
              <YAxis yAxisId="c" orientation="right" {...AX} width={70} tickFormatter={(v) => lakh(v, 1)} label={yLabel('Running total', 'right')} />
              <Tooltip content={<Tip />} />
              <Legend {...LEG} />
              <ReferenceLine yAxisId="d" y={0} stroke="var(--line2)" />
              <Bar yAxisId="d" dataKey="ce" name="Call OI Δ" fill={RED} fillOpacity={0.75} isAnimationActive={false} />
              <Bar yAxisId="d" dataKey="pe" name="Put OI Δ" fill={GREEN} fillOpacity={0.75} isAnimationActive={false} />
              <Line yAxisId="c" dataKey="cce" name="Call OI change (running)" stroke={RED} strokeWidth={2.2} dot={false} isAnimationActive={false} />
              <Line yAxisId="c" dataKey="cpe" name="Put OI change (running)" stroke={GREEN} strokeWidth={2.2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <div className="empty" style={{ padding: 40 }}>Updates appear here as they come in.</div>}
      </div>
      {moves.length > 0 && (
        <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>Moved in the last update:</span>
          {moves.map(([k, c, p]) => (
            <span key={k} className="tag mono" style={{ fontSize: 12.5 }}><b>{k}</b>{c ? <span style={{ color: RED, marginLeft: 6 }}>CE {signed(c)}</span> : null}{p ? <span style={{ color: GREEN, marginLeft: 6 }}>PE {signed(p)}</span> : null}</span>
          ))}
        </div>
      )}
      <p className="dim" style={{ fontSize: 12, margin: '10px 0 0' }}>Bars: OI added (+) or cut (−) at each update. Lines: the running total across the window. Sensibull may refresh OI less often than every 3 seconds, so some updates read zero.</p>
    </Card>
  );
}

/** Full chart per strike: call and put OI at every recorded update */
function StrikeCharts({ api, underlying, expiry, chain, picked, setPicked, atm, live }) {
  const [series, setSeries] = useState([]);
  const strikes = chain.map((r) => r.strike);
  const i = strikes.indexOf(atm);
  const choices = strikes.slice(Math.max(0, i - 7), i + 8);
  const key = picked.slice().sort((a, b) => a - b).join(',');
  useEffect(() => {
    if (!picked.length) return;
    const start = new Date(); start.setHours(9, 0, 0, 0);
    const get = () => api.options.strikeSeries(underlying, expiry, picked, start.toISOString()).then((r) => setSeries(r.points)).catch(() => {});
    get();
    if (!live) return;
    const t = setInterval(get, 15000);
    return () => clearInterval(t);
  }, [api, underlying, expiry, key, live]); // eslint-disable-line
  return (
    <Card title="Each strike through the day" sub="Call and put OI at every recorded update, with the OI added or cut at each step. Pick up to 4 strikes."
      right={<div className="row wrap" style={{ gap: 6, maxWidth: 760, justifyContent: 'flex-end' }}>
        {choices.map((k) => (
          <button key={k} className={cls('chip', picked.includes(k) && 'on')} style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => setPicked(picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k].slice(-4))}>{k}{k === atm ? ' · ATM' : ''}</button>
        ))}
      </div>}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,600px),1fr))', marginTop: 14 }}>
        {picked.slice().sort((a, b) => a - b).map((k) => {
          const pts = series.map((p) => ({ at: p.at, row: p.s.find((x) => x[0] === k) })).filter((p) => p.row);
          const data = pts.map((p, j) => ({ t: hms(p.at), ce: p.row[1], pe: p.row[2], dce: j ? p.row[1] - pts[j - 1].row[1] : 0, dpe: j ? p.row[2] - pts[j - 1].row[2] : 0 }));
          const row = chain.find((r) => r.strike === k);
          if (!row) return null;
          const net = row.pe.chgOi - row.ce.chgOi;
          return (
            <div key={k} style={{ background: 'var(--panel2)', borderRadius: 16, padding: 16 }}>
              <div className="row between wrap" style={{ gap: 8 }}>
                <b style={{ fontSize: 16 }}>Strike {k}{k === atm ? ' (ATM)' : ''}</b>
                <span className="tag" style={{ color: net > 0 ? GREEN : RED, fontWeight: 700 }}>{net > 0 ? 'Bullish: puts added more' : 'Bearish: calls added more'}</span>
              </div>
              <div className="row wrap" style={{ gap: 16, marginTop: 8, fontSize: 13.5 }}>
                <span>Call OI <b style={{ color: RED }}>{lakh(row.ce.oi)}</b> <span className="muted">({signed(row.ce.chgOi)} today)</span></span>
                <span>Put OI <b style={{ color: GREEN }}>{lakh(row.pe.oi)}</b> <span className="muted">({signed(row.pe.chgOi)} today)</span></span>
              </div>
              <div style={{ height: 280, marginTop: 10 }}>
                {data.length > 1 ? (
                  <ResponsiveContainer>
                    <ComposedChart data={data}>
                      {GRID}
                      <XAxis dataKey="t" {...AX} minTickGap={60} />
                      <YAxis yAxisId="oi" {...AX} width={64} tickFormatter={(v) => lakh(v, 1)} domain={['auto', 'auto']} />
                      <YAxis yAxisId="d" orientation="right" {...AX} width={58} tickFormatter={(v) => lakh(v, 1)} />
                      <Tooltip content={<Tip />} />
                      <Legend {...LEG} />
                      <Bar yAxisId="d" dataKey="dce" name="Call Δ per update" fill={RED} fillOpacity={0.35} isAnimationActive={false} />
                      <Bar yAxisId="d" dataKey="dpe" name="Put Δ per update" fill={GREEN} fillOpacity={0.35} isAnimationActive={false} />
                      <Line yAxisId="oi" dataKey="ce" name="Call OI" stroke={RED} strokeWidth={2.2} dot={false} isAnimationActive={false} />
                      <Line yAxisId="oi" dataKey="pe" name="Put OI" stroke={GREEN} strokeWidth={2.2} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <div className="empty" style={{ padding: 30 }}>Not recorded yet today for this strike.</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Chain: per strike only the OI, today's change, the last 5 minutes and the last update */
function ChainTable({ near, stats, moves, has, range, setRange, total }) {
  const maxOi = Math.max(1, ...near.flatMap((r) => [r.ce.oi, r.pe.oi]));
  const chg = (v) => <span className={v > 0 ? 'pos' : v < 0 ? 'neg' : 'dim'}>{v ? signed(v) : '0'}</span>;
  const withGreek = has.delta;
  const sideCols = withGreek ? 5 : 4;
  return (
    <Card title="Option chain: OI and OI change per strike"
      sub={`OI = open interest now · Today = change since yesterday's close · 5 min / Last = change over the last 5 minutes and at the last 3-second update${withGreek ? ' · Delta = option delta' : ''}`}
      right={<div className="row" style={{ gap: 8 }}><span className="muted" style={{ fontSize: 13 }}>Strikes</span><Seg options={[{ value: 5, label: 'ATM ± 5' }, { value: 10, label: '± 10' }, { value: 15, label: '± 15' }, { value: 0, label: `All (${total})` }]} value={range} onChange={setRange} /></div>}
      style={{ paddingBottom: 6 }}>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table className="oc oc-big">
          <thead>
            <tr><th colSpan={sideCols} style={{ color: RED }}>CALLS</th><th /><th colSpan={sideCols} style={{ color: GREEN }}>PUTS</th></tr>
            <tr>
              {withGreek && <th>Delta</th>}<th>Last</th><th>5 min</th><th>Today</th><th>OI</th>
              <th className="strike">Strike</th>
              <th>OI</th><th>Today</th><th>5 min</th><th>Last</th>{withGreek && <th>Delta</th>}
            </tr>
          </thead>
          <tbody>
            {near.map((r) => {
              const ref = stats.spot || stats.atm, atm = r.strike === stats.atm, ceItm = r.strike < ref, peItm = r.strike > ref;
              const last = moves.last.get(r.strike) || [0, 0], five = moves.five.get(r.strike) || [0, 0];
              return (
                <tr key={r.strike} className={cls(atm && 'atm')}>
                  {withGreek && <td className={cls(ceItm && 'itm')}>{num(r.ce.delta, 2)}</td>}
                  <td className={cls(ceItm && 'itm')}>{chg(last[0])}</td>
                  <td className={cls(ceItm && 'itm')}>{chg(five[0])}</td>
                  <td className={cls(ceItm && 'itm')}>{chg(r.ce.chgOi)}</td>
                  <td className={cls(ceItm && 'itm')} style={{ background: `linear-gradient(to left, ${RED}33 ${(r.ce.oi / maxOi) * 100}%, transparent 0)`, fontWeight: 600 }}>{lakh(r.ce.oi)}</td>
                  <td className="strike">{r.strike}{atm && <div className="atm-tag">ATM{stats.spot ? ` · ${num(stats.spot)}` : ''}</div>}</td>
                  <td className={cls(peItm && 'itm')} style={{ background: `linear-gradient(to right, ${GREEN}33 ${(r.pe.oi / maxOi) * 100}%, transparent 0)`, fontWeight: 600 }}>{lakh(r.pe.oi)}</td>
                  <td className={cls(peItm && 'itm')}>{chg(r.pe.chgOi)}</td>
                  <td className={cls(peItm && 'itm')}>{chg(five[1])}</td>
                  <td className={cls(peItm && 'itm')}>{chg(last[1])}</td>
                  {withGreek && <td className={cls(peItm && 'itm')}>{num(r.pe.delta, 2)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
