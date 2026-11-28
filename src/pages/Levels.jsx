import { useEffect, useMemo, useRef, useState } from 'react';
import { Sigma, RefreshCw, Clock3, Compass, Info, ChevronDown } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Field } from '../components/ui.jsx';
import Board from '../components/Board.jsx';
import { analyse, WINDOWS, STATE_TEXT } from '../lib/sdlevels.js';
import { cls } from '../lib/format.js';

const SYMBOLS = [{ value: 'XAUUSD', label: 'Gold' }, { value: 'NAS100', label: 'Nasdaq' }, { value: 'XAGUSD', label: 'Silver' }];
const DIGITS = { XAUUSD: 2, NAS100: 1, XAGUSD: 3 };
const LS = 'tp.levels';
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
const hm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayLabel = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const C = { p2: '#e11d48', p1: '#f97316', anchor: '#4f46e5', m1: '#0ea5e9', m2: '#059669' };

export default function Levels() {
  const { api } = useApp();
  const saved = load();
  const [symbol, setSymbol] = useState(saved.symbol || 'XAUUSD');
  const [lookback, setLookback] = useState(saved.lookback || 20);
  const [winId, setWinId] = useState(saved.win || 'tokyo');
  const [myClose, setMyClose] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const fetchBars = async () => {
    setBusy(true); setErr('');
    try { setData(await api.markets.bars(symbol)); } catch (e) { setErr(e.message); setData(null); }
    setBusy(false);
  };
  useEffect(() => { setMyClose(''); fetchBars(); }, [symbol]); // eslint-disable-line
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify({ symbol, lookback, win: winId })); } catch { /* ignore */ } }, [symbol, lookback, winId]);
  useEffect(() => { const t = setInterval(() => { setNow(Date.now()); }, 60e3); const r = setInterval(fetchBars, 5 * 60e3); return () => { clearInterval(t); clearInterval(r); }; }, [symbol]); // eslint-disable-line

  const win = WINDOWS.find((w) => w.id === winId) || WINDOWS[0];
  const res = useMemo(() => {
    if (!data?.bars?.length) return null;
    try {
      const anchorOverride = myClose !== '' && +myClose > 0 ? +myClose : undefined;
      return analyse(data.bars, { lookback, win, basis: data.basis || 0, now: data.asOf || now, anchorOverride });
    } catch (e) { return { error: e.message }; }
  }, [data, lookback, winId, now, myClose]); // eslint-disable-line
  const dg = DIGITS[symbol];
  const f = (v) => (v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: dg, maximumFractionDigits: dg }));
  const pts = (v) => (v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: symbol === 'XAGUSD' ? 3 : 1 }));
  const name = SYMBOLS.find((s) => s.value === symbol)?.label;

  return (
    <Board id="levels" className="page">
      <div data-fixed className="page-head row between wrap">
        <div>
          <h1 className="page-title row" style={{ gap: 10 }}><Sigma size={24} /> Daily levels</h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Standard-deviation levels, the opening move and the market state, worked out from hourly futures prices.</div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <Seg options={SYMBOLS} value={symbol} onChange={setSymbol} />
          <button className="btn sm" onClick={fetchBars} disabled={busy}><RefreshCw size={14} className={busy ? 'spin' : ''} /> Refresh</button>
        </div>
      </div>

      <div data-fixed className="card row wrap levels-settings" style={{ gap: 18, padding: '12px 16px' }}>
        <Field label="Standard deviation of the last"><Seg options={[10, 20, 30, 60].map((n) => ({ value: n, label: `${n} days` }))} value={lookback} onChange={setLookback} /></Field>
        <Field label="Asian session"><select className="select" value={winId} onChange={(e) => setWinId(e.target.value)}>{WINDOWS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></Field>
        <Field label="Your broker's previous close (optional)" hint="Re-centres the daily levels on your broker's price">
          <input className="input" inputMode="decimal" placeholder={res?.daily ? f(res.daily.anchor) : ''} value={myClose} onChange={(e) => setMyClose(e.target.value)} style={{ maxWidth: 180 }} />
        </Field>
        <div className="grow" />
        <div className="muted small" style={{ textAlign: 'right', maxWidth: 300 }}>
          {data ? <>{data.demo ? 'Sample data (preview)' : data.source}{data.stale ? ' · showing the last good data' : ''}<br />Updated {hm(data.updatedAt)}{res?.open === false ? ' · market closed' : ''}</> : busy ? 'Loading…' : ''}
        </div>
      </div>

      {err && <div data-fixed className="notice bad">{err}. Prices come from the server; try Refresh in a minute.</div>}
      {res?.error && <div data-fixed className="notice bad">{res.error}</div>}

      {res && !res.error && <>
        <LevelCard data-blk="daily" data-span={4} title="Daily levels" sub={`For ${dayLabel(res.date)} · 1SD of the last ${res.daily.lookback} daily moves`} lv={res.daily} price={res.price} f={f} pts={pts} anchorLabel={myClose ? 'Your close' : 'Previous close'} />
        {res.weekly ? <LevelCard data-blk="weekly" data-span={4} title="Weekly levels" sub={`Week of ${dayLabel(res.weekly.week)} · 1SD of the last ${res.weekly.weeks} weekly moves`} lv={res.weekly} price={res.price} f={f} pts={pts} anchorLabel="Last week's close" />
          : <div data-blk="weekly" data-span={4} className="card muted">Not enough weeks of data yet for weekly levels.</div>}
        <OpeningCard data-blk="opening" data-span={4} o={res.opening} sd={res.daily.sd} f={f} pts={pts} />

        <div data-blk="chart" data-span={8} className="card" style={{ padding: '14px 10px 8px' }}>
          <div className="row between" style={{ padding: '0 6px 6px' }}><b>{name} · hourly · last sessions</b><span className="muted small">Solid = daily levels · dashed = weekly · shaded = Asian session</span></div>
          <LevelsChart r={res} f={f} />
        </div>
        <StateCard data-blk="state" data-span={4} s={res.state} />

        <StatsCard data-blk="stats" data-span={6} st={res.stats} sd={res.daily.sd} pts={pts} />
        <HistoryCard data-blk="history" data-span={6} rows={res.history} pts={pts} />

        <Explainer data-blk="how" />
      </>}
    </Board>
  );
}

function LevelCard({ title, sub, lv, price, f, pts, anchorLabel }) {
  const rows = [
    { k: 'p2', label: '+2SD', v: lv.p2 }, { k: 'p1', label: '+1SD', v: lv.p1 }, { k: 'anchor', label: anchorLabel, v: lv.anchor },
    { k: 'm1', label: '−1SD', v: lv.m1 }, { k: 'm2', label: '−2SD', v: lv.m2 },
  ];
  // insert "Now" where price sits
  const at = rows.findIndex((r) => price >= r.v);
  const list = [...rows];
  list.splice(at < 0 ? rows.length : at, 0, { k: 'now', label: 'Now', v: price });
  return (
    <div className="card">
      <div className="row between"><b>{title}</b><span className="tag blue">1SD ±{pts(lv.sd)} · {(lv.sdPct * 100).toFixed(2)}%</span></div>
      <div className="muted small" style={{ margin: '4px 0 10px' }}>{sub}</div>
      <div className="lvl-list">
        {list.map((r) => r.k === 'now' ? (
          <div key="now" className="lvl-row now"><span>Now</span><b className="mono">{f(r.v)}</b><span className="muted small">{price >= lv.anchor ? '+' : ''}{((price - lv.anchor) / lv.sd).toFixed(2)} SD</span></div>
        ) : (
          <div key={r.k} className="lvl-row"><span><i style={{ background: C[r.k] }} />{r.label}</span><b className="mono">{f(r.v)}</b><span className="muted small mono">{r.v > price ? '+' : '−'}{pts(Math.abs(r.v - price))}</span></div>
        ))}
      </div>
    </div>
  );
}

function OpeningCard({ o, sd, f, pts }) {
  const pct = o.ratio != null ? Math.min(1, o.ratio / 1.5) * 100 : 0;
  return (
    <div className="card">
      <div className="row between"><b className="row" style={{ gap: 6 }}><Clock3 size={16} /> Opening move</b><span className="muted small">Asia {hm(o.from)}–{hm(o.to)} your time</span></div>
      {o.ratio == null ? (
        <div style={{ marginTop: 14 }}>
          <div className="stat"><div className="val sm">Waiting</div></div>
          <p className="muted" style={{ margin: '6px 0 0' }}>The Asian session for {dayLabel(o.date)} starts at {hm(o.from)} your time. Check back after {hm(o.to)} before London opens.</p>
        </div>
      ) : (
        <>
          <div className="row" style={{ alignItems: 'baseline', gap: 10, marginTop: 10 }}>
            <span className={cls('big-num', o.spent ? 'neg' : 'pos')}>{o.ratio.toFixed(2)}<small> σ</small></span>
            <span className={cls('tag', o.spent ? 'red' : 'green')}>{o.status === 'forming' ? 'Still forming' : o.spent ? 'Range spent' : 'Room left'}</span>
          </div>
          <div className="gauge" title="Asian range as a multiple of 1SD; the line is the 1.00 cut-off">
            <i style={{ width: `${pct}%`, background: o.spent ? 'var(--red)' : o.ratio > 0.7 ? 'var(--gold)' : 'var(--green)' }} />
            <b style={{ left: `${(1 / 1.5) * 100}%` }} />
          </div>
          <div className="kv">
            <span>Asian high / low</span><b className="mono">{f(o.high)} / {f(o.low)}</b>
            <span>Asian range</span><b className="mono">{pts(o.range)} of {pts(sd)}</b>
            <span>{o.spent ? 'Over by' : 'Room to 1SD'}</span><b className="mono">{o.spent ? pts(o.range - sd) : pts(o.left)}</b>
          </div>
          <p className="small" style={{ margin: '10px 0 0' }}>
            {o.spent ? 'Over 1SD: a normal day’s move is already used up. Stand aside, or only fade extremes with clear absorption.' : o.ratio > 0.7 ? 'Under 1SD but most of it used. Be selective: there may not be room left for a full target.' : 'Under 1SD: the day still has room. Normal setups are worth taking.'}
            {o.status === 'forming' && ' The session is still open, so this can change.'}
          </p>
        </>
      )}
    </div>
  );
}

function StateCard({ s }) {
  const row = (label, x) => {
    if (!x) return <div className="muted small">{label}: not enough data</div>;
    const t = STATE_TEXT[x.state];
    return (
      <div className="state-row">
        <div className="row between"><span className="muted small">{label}</span><span className={cls('tag', x.state === 'up' ? 'green' : x.state === 'down' ? 'red' : x.state === 'sideways' ? 'blue' : '')}>{t.label}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>ADX {x.adx?.toFixed(0) ?? '—'} · 50 EMA slope {x.slope >= 0 ? '+' : ''}{x.slope.toFixed(2)} ATR</div>
        <div className="small" style={{ marginTop: 4 }}>{t.tip}</div>
      </div>
    );
  };
  return (
    <div className="card">
      <b className="row" style={{ gap: 6 }}><Compass size={16} /> Market state</b>
      <div className="col" style={{ gap: 12, marginTop: 10 }}>{row('1-hour', s.h1)}{row('Daily', s.d1)}</div>
      <div className="muted small" style={{ marginTop: 10 }}>Trending: ADX 25+ with the 50 EMA sloping. Sideways: ADX under 20.</div>
    </div>
  );
}

function verdict(q, s) {
  if (s.n < 8) return `Only ${s.n} “spent” sessions so far, too few to judge the stand-aside rule yet. `;
  const d = q.avgExt - s.avgExt, x = `(${q.avgExt.toFixed(2)} SD after a quiet Asia vs ${s.avgExt.toFixed(2)} SD after a spent one)`;
  if (d >= 0.1) return `On this data the stand-aside rule holds: price travelled further after a quiet Asia ${x}. `;
  if (d <= -0.1) return `On this data the stand-aside rule doesn’t hold: price travelled further after a spent Asia ${x}. `;
  return `On this data the stand-aside rule makes little difference: price travelled about as far either way ${x}. `;
}

function StatsCard({ st, sd, pts }) {
  const p = (v) => (v == null ? '—' : `${Math.round(v)}%`);
  const q = st.quiet, s = st.spent;
  return (
    <div className="card">
      <b>What the last {st.n} sessions say</b>
      <div className="muted small" style={{ marginTop: 2 }}>{st.from && `${dayLabel(st.from)} to ${dayLabel(st.to)}`} · each session measured against the SD it had that morning</div>
      <div className="stat-row compact" style={{ marginTop: 12 }}>
        <div className="mini-stat"><div className="label">Touched ±1SD</div><div className="val">{p(st.touch1)}</div></div>
        <div className="mini-stat"><div className="label">Touched ±2SD</div><div className="val">{p(st.touch2)}</div></div>
        <div className="mini-stat"><div className="label">Closed inside ±1SD</div><div className="val">{p(st.in1)}</div></div>
      </div>
      <table className="tbl" style={{ marginTop: 12 }}>
        <thead><tr><th>After the Asian session…</th><th>Days</th><th>Moved further (avg)</th><th>Moved ≥ 0.5SD</th></tr></thead>
        <tbody>
          <tr><td>Asia under 1SD (room left)</td><td>{q.n}</td><td className="mono">{q.avgExt == null ? '—' : `${q.avgExt.toFixed(2)} SD ≈ ${pts(q.avgExt * sd)}`}</td><td>{p(q.half)}</td></tr>
          <tr><td>Asia over 1SD (spent)</td><td>{s.n}</td><td className="mono">{s.avgExt == null ? '—' : `${s.avgExt.toFixed(2)} SD ≈ ${pts(s.avgExt * sd)}`}</td><td>{p(s.half)}</td></tr>
        </tbody>
      </table>
      <p className="small" style={{ margin: '10px 0 0' }}>
        {verdict(q, s)}
        “Moved further” is how far price went beyond the Asian high or low after the Asian session ended. Today 0.5SD ≈ {pts(0.5 * sd)} points.
      </p>
    </div>
  );
}

function HistoryCard({ rows, pts }) {
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <b>Last 10 sessions</b>
      <table className="tbl" style={{ marginTop: 10 }}>
        <thead><tr><th>Session</th><th>Asian range</th><th>Opening move</th><th>Moved after Asia</th><th>Hit ±1SD</th><th>Close vs prev.</th></tr></thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.date}>
              <td style={{ whiteSpace: 'nowrap' }}>{dayLabel(h.date)}</td>
              <td className="mono">{pts(h.asia)}</td>
              <td><span className={cls('tag', h.ratio >= 1 ? 'red' : 'green')}>{h.ratio.toFixed(2)} σ</span></td>
              <td className="mono">{pts(h.ext)} <span className="muted">({h.extSd.toFixed(2)} SD)</span></td>
              <td>{h.touch2 ? '±2SD' : h.touch1 ? 'Yes' : 'No'}</td>
              <td className={cls('mono', h.move >= 0 ? 'pos' : 'neg')}>{h.move >= 0 ? '+' : ''}{h.move.toFixed(2)} SD</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Explainer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button className="row between" style={{ width: '100%' }} onClick={() => setOpen((v) => !v)}><b className="row" style={{ gap: 6 }}><Info size={16} /> How these numbers are worked out</b><ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s' }} /></button>
      {open && (
        <ul className="small" style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
          <li><b>Sessions:</b> one futures trading day, from the reopen (about 23:00 UTC) to the daily break (about 22:00 UTC). A session that opens Sunday night is Monday’s.</li>
          <li><b>Daily 1SD:</b> the standard deviation of the last 10/20/30/60 daily % changes (close to close), turned into points at the previous close. Levels are the previous close ± 1SD and ± 2SD.</li>
          <li><b>Weekly 1SD:</b> the same on weekly closes, centred on last week’s close.</li>
          <li><b>Opening move:</b> the Asian-session range divided by today’s daily 1SD. Under 1.00 the day still has room; over 1.00 a normal day’s move is already spent.</li>
          <li><b>Market state:</b> ADX(14) and the slope of the 50 EMA (measured in ATRs over the last 10 bars), on hourly bars and on daily sessions.</li>
          <li><b>Prices:</b> gold and silver come from COMEX futures shifted onto spot by today’s futures–spot gap; Nasdaq uses NQ futures. If your broker’s prices differ, type its previous close above.</li>
          <li>These are statistics, not signals: price reacting at a level still needs your own trigger, such as absorption in the order flow.</li>
        </ul>
      )}
    </div>
  );
}

/** Hourly candles with daily (solid) and weekly (dashed) levels and the Asian session shaded */
function LevelsChart({ r, f }) {
  const wrap = useRef(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, e.contentRect.width)));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const H = 380, padR = 118, padL = 6, padT = 10, padB = 22;
  const c = r.chart;
  const d = r.daily, wk = r.weekly;
  const lines = [
    ...['p2', 'p1', 'anchor', 'm1', 'm2'].map((k) => ({ k, v: d[k], label: k === 'anchor' ? 'Prev close' : { p2: '+2SD', p1: '+1SD', m1: '−1SD', m2: '−2SD' }[k], dash: false })),
    ...(wk ? ['p1', 'm1', 'p2', 'm2'].map((k) => ({ k, v: wk[k], label: `W ${{ p2: '+2SD', p1: '+1SD', m1: '−1SD', m2: '−2SD' }[k]}`, dash: true })) : []),
  ];
  const lo = Math.min(...c.map((x) => x.l)), hi = Math.max(...c.map((x) => x.h));
  // show the daily ±2SD and whatever price did; weekly lines only if they're near
  const y0 = Math.min(lo, d.m2) - d.sd * 0.15, y1 = Math.max(hi, d.p2) + d.sd * 0.15;
  const Y = (v) => padT + (1 - (v - y0) / (y1 - y0)) * (H - padT - padB);
  const cw = (w - padR - padL) / Math.max(1, c.length);
  const X = (i) => padL + i * cw + cw / 2;
  const idxAt = (t) => c.findIndex((x) => x.t >= t);
  const o = r.opening;
  const ai = idxAt(o.from), bi = o.to > c.at(-1).t ? c.length : idxAt(o.to);
  let lastY = -99;
  const labels = lines.filter((l) => l.v >= y0 && l.v <= y1).sort((a, b) => b.v - a.v).map((l) => { let y = Y(l.v); if (y - lastY < 13) y = lastY + 13; lastY = y; return { ...l, ly: y }; });
  const days = c.map((x, i) => ({ i, d: new Date(x.t + 3 * 3600e3).toISOString().slice(0, 10) })).filter((x, i, arr) => i === 0 || x.d !== arr[i - 1].d);
  return (
    <div ref={wrap} style={{ width: '100%' }}>
      <svg width={w} height={H} role="img" aria-label="Hourly price with SD levels">
        {ai >= 0 && <rect x={padL + ai * cw} width={Math.max(0, (bi - ai) * cw)} y={padT} height={H - padT - padB} fill="#f59e0b" opacity={0.08} />}
        {days.map((x) => <g key={x.i}><line x1={padL + x.i * cw} x2={padL + x.i * cw} y1={padT} y2={H - padB} stroke="var(--line)" /><text x={padL + x.i * cw + 4} y={H - 6} fontSize="10.5" fill="var(--muted)">{new Date(x.d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</text></g>)}
        {lines.filter((l) => l.v >= y0 && l.v <= y1).map((l) => <line key={l.label} x1={padL} x2={w - padR} y1={Y(l.v)} y2={Y(l.v)} stroke={C[l.k]} strokeWidth={l.k === 'anchor' ? 1.6 : 1.2} strokeDasharray={l.dash ? '6 5' : undefined} opacity={l.dash ? 0.6 : 0.9} />)}
        {c.map((x, i) => {
          const col = x.c >= x.o ? '#10b981' : '#f43f5e';
          return <g key={x.t}><line x1={X(i)} x2={X(i)} y1={Y(x.h)} y2={Y(x.l)} stroke={col} /><rect x={X(i) - Math.max(1, cw * 0.32)} width={Math.max(1.5, cw * 0.64)} y={Y(Math.max(x.o, x.c))} height={Math.max(1, Math.abs(Y(x.o) - Y(x.c)))} fill={col} /></g>;
        })}
        {labels.map((l) => <text key={l.label} x={w - padR + 6} y={l.ly + 4} fontSize="11" fill={C[l.k]} opacity={l.dash ? 0.75 : 1}>{l.label} {f(l.v)}</text>)}
      </svg>
    </div>
  );
}
