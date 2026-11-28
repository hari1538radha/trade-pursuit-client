import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe2, RefreshCw, ArrowUp, ArrowDown, Minus, ExternalLink, Info, ChevronDown, CalendarClock, Gauge, Landmark, Compass, Users, Newspaper, Activity } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar, Cell } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Seg } from '../components/ui.jsx';
import Board from '../components/Board.jsx';
import { analyseMacro, driverChart, ASSETS, REGIMES, LEAN_TEXT, fedText, ordinal } from '../lib/macro.js';
import { cls } from '../lib/format.js';

const TABS = [
  { value: 'outlook', label: 'Outlook' }, { value: 'events', label: 'Events' }, { value: 'drivers', label: 'Drivers' },
  { value: 'regimes', label: 'Regimes' }, { value: 'positioning', label: 'Positioning' }, { value: 'news', label: 'News' },
];
const TT = { contentStyle: { background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 10, fontSize: 12.5 } };
const LS = 'tp.macro';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// formatting
const sp = (x, dp = 1) => (x == null || !Number.isFinite(x) ? '—' : `${x > 0 ? '+' : ''}${x.toFixed(dp)}%`);
const pc = (x) => (x == null ? '—' : `${Math.round(x)}%`);
const num = (x, dp = 2) => (x == null || !Number.isFinite(x) ? '—' : x.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
const px = (a, v) => (v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: a.dp, minimumFractionDigits: a.dp }));
const tone = (x, good = 1) => (x == null || Math.abs(x) < 1e-9 ? '' : x * good > 0 ? 'pos' : 'neg');
const when = (t) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dayName = (t) => new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
const ago = (t, now) => { const m = Math.round((now - t) / 60e3); return m < 60 ? `${m}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
const until = (t, now) => { const m = Math.max(0, Math.round((t - now) / 60e3)); const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `in ${d}d ${h}h` : h ? `in ${h}h ${m % 60}m` : `in ${m}m`; };
const mY = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
const rng = (v) => Math.round(v).toLocaleString('en-US');
const shortD = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });

function Dir({ v, size = 14 }) {
  if (!v) return <Minus size={size} className="muted" />;
  return v > 0 ? <ArrowUp size={size} className="pos" /> : <ArrowDown size={size} className="neg" />;
}
function LeanTag({ lean }) {
  const c = { up: 'green', 'slight-up': 'green', down: 'red', 'slight-down': 'red', neutral: 'blue' }[lean];
  return <span className={cls('tag', c)}>{LEAN_TEXT[lean]}</span>;
}

export default function Macro() {
  const { api } = useApp();
  const prefs = loadPrefs();
  const [tab, setTab] = useState(prefs.tab || 'outlook');
  const [asset, setAsset] = useState(prefs.asset || 'XAUUSD');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    setBusy(true); setErr('');
    try { setData(await api.markets.macro()); setNow(Date.now()); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  useEffect(() => { load(); const t = setInterval(() => setNow(Date.now()), 60e3); return () => clearInterval(t); }, []); // eslint-disable-line
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify({ tab, asset })); } catch { /* ignore */ } }, [tab, asset]);

  const M = useMemo(() => { if (!data) return null; try { return analyseMacro(data, { now: Date.now() }); } catch (e) { console.error(e); return { error: e.message }; } }, [data]);
  const A = M?.assets?.[asset];
  const failed = data ? Object.entries(data.status || {}).filter(([, s]) => !s.ok || s.stale) : [];
  const NAMES = { fred: 'Macro data (FRED)', prices: 'Prices', intraday: 'Hourly event data', cot: 'Positioning (CFTC)', calendar: 'Calendar', headlines: 'Headlines' };

  const head = [
    <div key="head" data-fixed className="page-head row between wrap">
      <div>
        <h1 className="page-title row" style={{ gap: 10 }}><Globe2 size={24} /> Macro desk</h1>
        <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>The economy, the Fed, the news and the money flows behind gold and the Nasdaq, and what they have meant for the days, weeks and months that followed.</div>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <Seg options={[{ value: 'XAUUSD', label: 'Gold' }, { value: 'NAS100', label: 'Nasdaq' }]} value={asset} onChange={setAsset} />
        <button className="btn sm" onClick={load} disabled={busy}><RefreshCw size={14} className={busy ? 'spin' : ''} /> Refresh</button>
      </div>
    </div>,
    <div key="tabs" data-fixed className="row between wrap" style={{ gap: 10 }}>
      <Seg options={TABS} value={tab} onChange={setTab} />
      <span className="muted small">{data ? <>{data.demo ? 'Sample data (preview)' : 'FRED, CME futures via Yahoo, CFTC, BLS, Federal Reserve'} · updated {new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</> : busy ? 'Loading 20 years of data…' : ''}</span>
    </div>,
    err && <div key="err" data-fixed className="notice bad">{err}. Try Refresh in a minute.</div>,
    M?.error && <div key="merr" data-fixed className="notice bad">Couldn’t analyse the data: {M.error}</div>,
    failed.length > 0 && <div key="failed" data-fixed className="notice">{failed.map(([k, s]) => `${NAMES[k] || k}: ${s.stale ? 'showing the last good copy' : 'unavailable right now'}`).join(' · ')}{M?.missing?.length ? ` · missing series: ${M.missing.join(', ')}` : ''}</div>,
    !M && !err && <div key="loading" data-fixed className="card muted" style={{ padding: 40, textAlign: 'center' }}>{busy ? 'Loading macro data, prices and 20 years of history… the first load can take a few seconds.' : ''}</div>,
  ].filter(Boolean);
  const id = `macro-${tab}`;
  if (!A) return <Board key={id} id={id} className="page">{head}</Board>;
  const P = { M, A, now, asset, head, id };
  if (tab === 'events') return <Events key={id} {...P} />;
  if (tab === 'drivers') return <Drivers key={id} {...P} />;
  if (tab === 'regimes') return <Regimes key={id} {...P} />;
  if (tab === 'positioning') return <Positioning key={id} {...P} />;
  if (tab === 'news') return <News key={id} {...P} />;
  return <Outlook key={id} {...P} />;
}

// ───────────────────────── Outlook ─────────────────────────
function Outlook({ M, A, now, head, id }) {
  const s = A.score.now;
  return <Board id={id} className="page">{head}
    <div data-blk="read" data-span={12} className="card">
      <div className="row between wrap" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
          <b style={{ fontSize: 18 }}>{A.name}</b>
          <span className="big-num" style={{ fontSize: 26 }}>{px(A, A.price)}</span>
          <span className="muted small">futures close {shortD(A.date)}</span>
        </div>
        <span className="muted small">Statistics from past data, not a forecast or financial advice.</span>
      </div>
      <div className="macro-read">
        {A.playbook.map((p) => (
          <div key={p.horizon} className="read-col">
            <div className="row between" style={{ gap: 8 }}><b>{p.horizon}</b>{!p.noLean && <LeanTag lean={p.lean} />}</div>
            <ul>{p.points.map((t, i) => <li key={i}>{t.includes('Daily levels') ? <>Use the <Link to="/levels">Daily levels</Link> page for today’s ±1SD/±2SD levels and the Asian opening move.</> : t}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>

    <div data-blk="score" data-span={5} className="card">
      <div className="row between"><b className="row" style={{ gap: 6 }}><Gauge size={16} /> Macro score</b>{s && <span className={cls('tag', s.score >= 0.5 ? 'green' : s.score <= -0.5 ? 'red' : 'blue')}>{s.score >= 0.5 ? 'Tailwinds' : s.score <= -0.5 ? 'Headwinds' : 'Mixed'}</span>}</div>
      {s ? <>
        <ScoreGauge v={s.score} />
        <table className="tbl" style={{ marginTop: 6 }}>
          <thead><tr><th>Driver</th><th>Now</th><th>vs normal</th><th>Effect</th></tr></thead>
          <tbody>{s.parts.map((p) => (
            <tr key={p.key}>
              <td>{p.label}</td>
              <td className="mono" style={{ whiteSpace: 'nowrap' }}>{p.key === 'fed' ? fedText(p.raw) : `${p.raw > 0 ? '+' : ''}${p.raw.toFixed(p.unit === 'bp' ? 0 : 1)}${p.unit === 'bp' ? 'bp' : p.unit}`}</td>
              <td className="mono">{p.key === 'fed' ? '' : `${p.z > 0 ? '+' : ''}${p.z.toFixed(1)}σ`}</td>
              <td><ZBar v={p.contrib} /></td>
            </tr>
          ))}</tbody>
        </table>
        <div className="muted small" style={{ marginTop: 8 }}>Each driver’s 13-week change compared with its own last 3 years, signed by how it usually affects {A.short}, then averaged. +0.5 or more = tailwinds.</div>
      </> : <div className="muted" style={{ marginTop: 10 }}>Not enough macro data to score yet.</div>}
    </div>

    <div data-blk="track" data-span={3} className="card">
      <b>Has the score worked?</b>
      <div className="muted small" style={{ margin: '2px 0 10px' }}>Every week since {A.score.from?.slice(0, 4)}: what {A.short} did next</div>
      {[4, 13].map((w) => { const st = A.score.stats[w]; return (
        <div key={w} style={{ marginBottom: 10 }}>
          <div className="muted small" style={{ fontWeight: 600 }}>Next {w} weeks</div>
          <div className="kv" style={{ marginTop: 4 }}>
            <span>Score ≥ +0.5</span><b>{sp(st.bull.mean)} · up {pc(st.bull.up)}</b>
            <span>In between</span><b>{sp(st.neutral.mean)} · up {pc(st.neutral.up)}</b>
            <span>Score ≤ −0.5</span><b>{sp(st.bear.mean)} · up {pc(st.bear.up)}</b>
            <span>All weeks</span><b>{sp(st.all.mean)} · up {pc(st.all.up)}</b>
          </div>
        </div>
      ); })}
      <div className="muted small">{(() => { const st = A.score.stats[13]; const e = st.bull.mean - st.bear.mean; return e > 1 ? `Edge: weeks with tailwinds beat weeks with headwinds by ${e.toFixed(1)} points over 13 weeks.` : e < -1 ? 'On this data the score has worked backwards: treat it as context, not a signal.' : 'Little difference between high and low scores: use it as context, not a signal.'; })()} Weekly windows overlap, so the real sample is smaller than it looks.</div>
    </div>

    <div data-blk="ranges" data-span={4} className="card">
      <b className="row" style={{ gap: 6 }}><Activity size={16} /> How far it could move</b>
      <div className="muted small" style={{ margin: '2px 0 8px' }}>From current volatility ({(A.vol.ewma * 100).toFixed(2)}% a day; 1-year average {(A.vol.year * 100).toFixed(2)}%)</div>
      <table className="tbl">
        <thead><tr><th></th><th>±1 SD</th><th>2 in 3 chance inside</th><th>19 in 20</th></tr></thead>
        <tbody>{A.ranges.map((r) => (
          <tr key={r.label}><td style={{ whiteSpace: 'nowrap' }}>{r.label}</td><td className="mono">±{px(A, r.pts)}</td><td className="mono small" style={{ whiteSpace: 'nowrap' }}>{rng(r.lo1)}–{rng(r.hi1)}</td><td className="mono small" style={{ whiteSpace: 'nowrap' }}>{rng(r.lo2)}–{rng(r.hi2)}</td></tr>
        ))}</tbody>
      </table>
      {A.weekAhead && <div className="notice" style={{ marginTop: 10 }}>Next 7 days include {A.weekAhead.events.join(', ')}: the 1-week range widens about {Math.round((A.weekAhead.factor - 1) * 100)}% to ±{px(A, A.weekAhead.pts)}.</div>}
      <div className="muted small" style={{ marginTop: 8 }}>Ranges are centred on today’s price: they say how far, not which way.</div>
    </div>

    <NextEvents data-blk="next" data-span={4} M={M} A={A} now={now} />
    <RegimeCard data-blk="regime" data-span={4} M={M} A={A} />
    <EconomyCard data-blk="economy" data-span={4} M={M} />
    <Method data-blk="method" />
  </Board>;
}

function ScoreGauge({ v }) {
  const x = Math.max(-2, Math.min(2, v));
  return (
    <div style={{ margin: '14px 0 4px' }}>
      <div className="score-bar"><b style={{ left: `${((x + 2) / 4) * 100}%` }} /></div>
      <div className="row between muted small"><span>−2 headwinds</span><b style={{ color: 'var(--text)', fontSize: 15 }}>{v > 0 ? '+' : ''}{v.toFixed(2)}</b><span>tailwinds +2</span></div>
    </div>
  );
}
function ZBar({ v }) {
  const w = Math.min(50, (Math.abs(v) / 2.5) * 50);
  return <div className="zbar"><i style={{ left: v >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: v >= 0 ? 'var(--green)' : 'var(--red)' }} /></div>;
}

function NextEvents({ M, A, now }) {
  const seen = new Set();
  const list = M.upcoming.filter((e) => (seen.has(e.type) ? false : seen.add(e.type)));
  return (
    <div className="card">
      <b className="row" style={{ gap: 6 }}><CalendarClock size={16} /> Next big releases</b>
      <div className="col" style={{ gap: 10, marginTop: 10 }}>
        {list.map((e) => { const s = A.events.types[e.type]; return (
          <div key={e.type} className="next-ev">
            <div className="row between"><b>{e.label}</b><span className="tag blue">{until(e.at, now)}</span></div>
            <div className="muted small">{when(e.at)} your time</div>
            {s?.avgAbs != null && <div className="small" style={{ marginTop: 4 }}>{A.short} usually moves {s.avgAbs.toFixed(2)}% (≈ {px(A, (s.avgAbs / 100) * A.price)} {A.unit === '$' ? 'dollars' : 'points'} today), {s.multiple?.toFixed(1)}× a normal {e.type === 'FOMC' ? '2 days' : 'day'}.</div>}
          </div>
        ); })}
      </div>
    </div>
  );
}

function RegimeCard({ M, A }) {
  const r = M.regime;
  if (!r) return <div className="card muted">Not enough inflation and jobs data for the regime yet.</div>;
  return (
    <div className="card">
      <b className="row" style={{ gap: 6 }}><Compass size={16} /> Economic regime</b>
      <div className="row" style={{ gap: 8, marginTop: 10, alignItems: 'baseline' }}><span className="big-num" style={{ fontSize: 24 }}>{REGIMES[r.key].label}</span><span className="tag blue">Fed {fedText(r.fed)}</span></div>
      <div className="muted small">{REGIMES[r.key].text}</div>
      <div className="kv">
        <span>Core inflation, last 3 months</span><b>{r.infl3.toFixed(1)}% a year</b>
        <span>Core inflation, last 12 months</span><b>{r.infl12.toFixed(1)}%</b>
        <span>Unemployment, 3-month avg</span><b>{r.un3.toFixed(2)}%</b>
        <span>Unemployment, 12-month avg</span><b>{r.un12.toFixed(2)}%</b>
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>Inflation “rising” when the last 3 months run hotter than the last 12. Growth “slowing” when unemployment’s 3-month average is 0.1 pt above its 12-month average. Latest data: CPI {r.cpiMonth.slice(0, 7)}, jobs {r.unMonth.slice(0, 7)}. More in the Regimes tab.</div>
    </div>
  );
}

function EconomyCard({ M }) {
  return (
    <div className="card">
      <b className="row" style={{ gap: 6 }}><Landmark size={16} /> US economy</b>
      <table className="tbl" style={{ marginTop: 8 }}>
        <tbody>{M.economy.map((r) => {
          const d = r.prev == null ? null : r.v - r.prev;
          return (
            <tr key={r.key} title={r.why}>
              <td>{r.label}<div className="muted small">{r.month?.slice(0, 7)}</div></td>
              <td className="mono" style={{ textAlign: 'right' }}><b>{r.unit === 'k' ? `${Math.round(r.v)}k` : `${r.v.toFixed(2)}${r.unit === '%' ? '%' : ''}`}</b>
                {d != null && Math.abs(d) > 1e-6 && <div className={cls('small', r.good ? tone(d, r.good === 'up' ? 1 : -1) : 'muted')}>{d > 0 ? '▲' : '▼'} {r.unit === 'k' ? Math.round(Math.abs(d)) + 'k' : Math.abs(d).toFixed(2)}</div>}
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function Method() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button className="row between" style={{ width: '100%' }} onClick={() => setOpen((v) => !v)}><b className="row" style={{ gap: 6 }}><Info size={16} /> How this page works and where the data comes from</b><ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s' }} /></button>
      {open && (
        <ul className="small" style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.65 }}>
          <li><b>Data:</b> yields, inflation, jobs, the dollar, VIX, credit spreads and the Fed balance sheet from FRED (St. Louis Fed); gold (GC) and Nasdaq (NQ) futures from Yahoo; positioning from the CFTC Commitments of Traders report; release dates from the BLS and the Federal Reserve; this week’s calendar from Forex Factory; headlines from the Fed, Investing.com, FXStreet and MarketWatch feeds.</li>
          <li><b>No look-ahead:</b> each number is used only from the day it was public (CPI about 45 days after the month, jobs about 38, positioning 3 days after the Tuesday it describes). Revised figures are used where FRED only keeps the latest version, so old readings are slightly cleaner than what traders saw at the time.</li>
          <li><b>Macro score:</b> the 13-week change of each driver, compared with its own last 3 years (a z-score), signed by its usual effect, capped at ±2.5 and averaged, plus the trend and the Fed’s direction.</li>
          <li><b>Regimes:</b> growth from unemployment trends, inflation from core CPI momentum, the Fed from the 6-month change in its rate. Returns after each month are measured from the month-end close.</li>
          <li><b>Events:</b> CPI and jobs: move from the previous close to the release-day close. Fed: previous close to the close the day after, because gold futures settle before the 2 pm statement. Intraday figures use hourly futures bars from the last 2 years.</li>
          <li><b>Ranges:</b> exponentially weighted volatility of daily returns (94% decay), scaled by the square root of time.</li>
          <li><b>Headlines:</b> tagged by keywords, not read by a person or an AI. Treat the arrows as a quick sort, not a verdict.</li>
          <li>Averages hide wide spreads, and overlapping windows make samples look bigger than they are. Nothing here is a forecast or financial advice.</li>
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── Events ─────────────────────────
function Events({ M, now, head, id }) {
  const G = M.assets.XAUUSD, N = M.assets.NAS100;
  const days = {};
  for (const e of M.calendar) (days[new Date(e.at).toDateString()] ||= []).push(e);
  const TYPES = [['CPI', 'CPI (inflation)'], ['NFP', 'Jobs report'], ['FOMC', 'Fed decision']];
  return <Board id={id} className="page">{head}
    <div data-blk="cal" data-span={7} className="card">
      <b className="row" style={{ gap: 6 }}><CalendarClock size={16} /> US releases this week and next</b>
      <div className="muted small" style={{ margin: '2px 0 10px' }}>Your time · high and medium impact · tap a row for what it usually does</div>
      {!M.calendar.length && <div className="muted">The calendar feed is unavailable right now.</div>}
      {Object.entries(days).map(([d, list]) => (
        <div key={d} style={{ marginBottom: 12 }}>
          <div className={cls('cal-day', new Date(d).toDateString() === new Date(now).toDateString() && 'today')}>{dayName(list[0].at)}</div>
          {list.map((e) => <CalRow key={e.id} e={e} G={G} N={N} past={e.at < now} />)}
        </div>
      ))}
    </div>

    <div data-blk="avg" data-span={5} className="card">
      <b>How the big three move gold and the Nasdaq</b>
      <div className="muted small" style={{ margin: '2px 0 10px' }}>Every release since 2015, futures closes</div>
      <table className="tbl">
        <thead><tr><th></th><th>Average move</th><th>× normal</th><th>Up</th><th>Kept going 5d</th><th>20d</th></tr></thead>
        <tbody>{TYPES.flatMap(([t, label]) => [G, N].map((a, k) => { const s = a.events.types[t]; return (
          <tr key={t + a.key}>
            <td>{k === 0 ? <b>{label}</b> : null}<div className="muted small">{a.short}</div></td>
            <td className="mono">{s.avgAbs?.toFixed(2)}%<div className="muted small">≈ {px(a, (s.avgAbs / 100) * a.price)}</div></td>
            <td className="mono">{s.multiple?.toFixed(1)}×</td><td>{pc(s.up)}</td><td>{pc(s.cont5)}</td><td>{pc(s.cont20)}</td>
          </tr>
        ); }))}</tbody>
      </table>
      <div className="muted small" style={{ marginTop: 8 }}>“Kept going” = the next 5 or 20 trading days moved the same way as the release-day move. Around 50% means the first move told you nothing about the following weeks. Fed rows cover two days.</div>
    </div>

    <div data-blk="intra" data-span={7} className="card">
      <b>The first hour: fade it or follow it?</b>
      <div className="muted small" style={{ margin: '2px 0 10px' }}>Hourly futures bars, last 2 years. “Reversed” = 6 hours later price was on the other side of the pre-release price.</div>
      <table className="tbl">
        <thead><tr><th></th><th>Releases</th><th>First-hour move</th><th>First-hour range</th><th>Reversed</th><th>Extended</th><th>6-hour range</th></tr></thead>
        <tbody>{TYPES.flatMap(([t, label]) => [G, N].map((a, k) => { const s = a.intraday[t]; return (
          <tr key={t + a.key}>
            <td>{k === 0 ? <b>{label}</b> : null}<div className="muted small">{a.short}</div></td>
            <td>{s.n}</td>
            <td className="mono">{s.n ? `±${px(a, s.firstAbs)}` : '—'}</td><td className="mono">{s.n ? px(a, s.firstRange) : '—'}</td>
            <td><span className={cls('tag', s.reversed >= 55 ? 'red' : s.reversed <= 40 ? 'green' : 'blue')}>{pc(s.reversed)}</span></td>
            <td>{pc(s.extended)}</td><td className="mono">{s.n ? px(a, s.range6) : '—'}</td>
          </tr>
        ); }))}</tbody>
      </table>
      <div className="small" style={{ marginTop: 10 }}>For your setups: a high “reversed” rate means the first spike often runs into a zone and comes back, so wait for it to reach your supply or demand and show absorption before fading it. A high “extended” rate means the first direction tends to continue, so buy or sell the first pullback instead. Your 10–15 point stop is small next to these ranges: on release hours, size down or stand aside.</div>
    </div>

    <div data-blk="fomc" data-span={5} className="card">
      <b>Fed decisions by outcome</b>
      <div className="muted small" style={{ margin: '2px 0 10px' }}>Since 2015, decision day + next day</div>
      <table className="tbl">
        <thead><tr><th>Decision</th><th>Times</th><th>Gold</th><th>Nasdaq</th></tr></thead>
        <tbody>{['cut', 'hold', 'hike'].map((k) => { const g = G.events.types.FOMC.decisions?.[k], n = N.events.types.FOMC.decisions?.[k]; return (
          <tr key={k}><td style={{ textTransform: 'capitalize' }}>{k}</td><td>{g?.n ?? 0}</td>
            <td className="mono">{g?.n ? `±${g.avgAbs.toFixed(2)}% · up ${pc(g.up)}` : '—'}</td>
            <td className="mono">{n?.n ? `±${n.avgAbs.toFixed(2)}% · up ${pc(n.up)}` : '—'}</td></tr>
        ); })}</tbody>
      </table>
      <div className="muted small" style={{ marginTop: 8 }}>Markets usually know the decision in advance; the surprise is in the statement, the projections and the press conference. That’s why “hold” days can move as much as cuts.</div>
    </div>

    <div data-blk="recent" data-span={12} className="card" style={{ overflowX: 'auto' }}>
      <b>Recent releases</b>
      <table className="tbl" style={{ marginTop: 10 }}>
        <thead><tr><th>Release</th><th>Date</th><th>Gold that day</th><th>Gold next 5 days</th><th>Nasdaq that day</th><th>Nasdaq next 5 days</th></tr></thead>
        <tbody>{TYPES.flatMap(([t, label]) => G.events.types[t].recent.slice(0, 4).map((r) => {
          const n = N.events.types[t].recent.find((x) => x.date === r.date);
          return (
            <tr key={t + r.date}><td>{label}</td><td>{shortD(r.date)}</td>
              <td className={cls('mono', tone(r.r))}>{sp(r.r, 2)}</td><td className={cls('mono', tone(r.f5))}>{sp(r.f5, 2)}</td>
              <td className={cls('mono', tone(n?.r))}>{sp(n?.r, 2)}</td><td className={cls('mono', tone(n?.f5))}>{sp(n?.f5, 2)}</td></tr>
          );
        }))}</tbody>
      </table>
    </div>
  </Board>;
}

function CalRow({ e, G, N, past }) {
  const [open, setOpen] = useState(false);
  const s = ['CPI', 'NFP', 'FOMC'].includes(e.type) ? [G.events.types[e.type], N.events.types[e.type]] : null;
  return (
    <div className={cls('cal-row', past && 'past')} onClick={() => setOpen((v) => !v)}>
      <div className="row" style={{ gap: 10 }}>
        <span className="mono small muted" style={{ width: 44, flex: 'none' }}>{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        <i className={cls('imp', e.impact)} />
        <span className="grow">{e.title}</span>
        <span className="mono small muted">{e.actual ? <b className="pos">{e.actual}</b> : null}{e.forecast ? ` f ${e.forecast}` : ''}{e.previous ? ` · p ${e.previous}` : ''}</span>
      </div>
      {open && <div className="small cal-more">
        {e.text || 'No typical reaction on file for this one.'}
        {s && <div style={{ marginTop: 4 }}>Since 2015: gold ±{s[0].avgAbs?.toFixed(2)}% ({s[0].multiple?.toFixed(1)}× normal), Nasdaq ±{s[1].avgAbs?.toFixed(2)}% ({s[1].multiple?.toFixed(1)}× normal).</div>}
      </div>}
    </div>
  );
}

// ───────────────────────── Drivers ─────────────────────────
function Drivers({ M, asset, head, id }) {
  const [sel, setSel] = useState('real');
  const [years, setYears] = useState(3);
  const [invert, setInvert] = useState(true);
  const A = M.assets[asset];
  const dv = M.drivers.find((d) => d.key === sel) || M.drivers[0];
  const data = useMemo(() => driverChart(M, asset, dv.key, years), [M, asset, dv.key, years]);
  const effect = (d, k) => { const s = d[k === 'XAUUSD' ? 'gold' : 'nq']; return s && d.c3m ? Math.sign(s * d.c3m) : 0; };
  const rollNow = dv.roll[asset].filter((x) => x != null);
  return <Board id={id} className="page">{head}
    <div data-blk="table" data-span={12} className="card" style={{ overflowX: 'auto' }}>
      <b>What moves gold and the Nasdaq, right now</b>
      <div className="muted small" style={{ margin: '2px 0 10px' }}>Click a row to chart it. “Pressure” = how the last 3 months’ change usually affects each market. Correlation = weekly moves together (−1 to +1), last year and last 5 years.</div>
      <table className="tbl">
        <thead><tr><th>Driver</th><th>Latest</th><th>1 week</th><th>1 month</th><th>3 months</th><th>3m vs normal</th><th>Pressure on gold</th><th>on Nasdaq</th><th>Corr. gold 1y / 5y</th><th>Corr. Nasdaq 1y / 5y</th></tr></thead>
        <tbody>{M.drivers.map((d) => (
          <tr key={d.key} className={cls('click', d.key === dv.key && 'sel')} onClick={() => setSel(d.key)} title={d.why}>
            <td><b>{d.label}</b></td>
            <td className="mono">{d.key === 'liq' ? `$${Math.round(d.v).toLocaleString()}bn` : d.key === 'claims' ? `${Math.round(d.v)}k` : num(d.v)}{d.unit === '%' ? '%' : ''}</td>
            {[d.c1w, d.c1m, d.c3m].map((c, i) => <td key={i} className="mono">{c == null ? '—' : `${c > 0 ? '+' : ''}${c.toFixed(d.chgUnit === 'bp' ? 0 : 1)}${d.chgUnit}`}</td>)}
            <td>{d.z == null ? '—' : <ZBar v={clipZ(d.z)} />}</td>
            <td><Dir v={effect(d, 'XAUUSD')} /></td><td><Dir v={effect(d, 'NAS100')} /></td>
            <td className="mono small">{cc(d.link.XAUUSD.c1)} / {cc(d.link.XAUUSD.c5)}</td>
            <td className="mono small">{cc(d.link.NAS100.c1)} / {cc(d.link.NAS100.c5)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>

    <div data-blk="chart" data-span={8} className="card">
      <div className="row between wrap" style={{ gap: 8 }}>
        <b>{A.short} vs {dv.label.toLowerCase()}</b>
        <div className="row" style={{ gap: 8 }}>
          <label className="row small muted" style={{ gap: 6 }}><input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> Flip the driver</label>
          <Seg options={[1, 3, 10].map((y) => ({ value: y, label: `${y}y` }))} value={years} onChange={setYears} />
        </div>
      </div>
      <div style={{ height: 300, marginTop: 10 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: 4, right: 4, top: 6, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="d" tickFormatter={(d) => (years > 3 ? d.slice(0, 4) : mY(d))} minTickGap={40} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
            <YAxis yAxisId="p" domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={58} tickFormatter={(v) => v.toLocaleString()} />
            <YAxis yAxisId="d" orientation="right" reversed={invert} domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={48} tickFormatter={(v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(1))} />
            <Tooltip {...TT} labelFormatter={(d) => shortD(d)} formatter={(v, n) => [n === 'price' ? px(A, v) : num(v), n === 'price' ? A.short : dv.label]} />
            <Line yAxisId="p" dataKey="price" stroke="var(--gold)" strokeWidth={2} dot={false} />
            <Line yAxisId="d" dataKey="driver" stroke="var(--blue)" strokeWidth={1.6} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="small" style={{ marginTop: 6 }}><span style={{ color: 'var(--gold)', fontWeight: 600 }}>— {A.short}</span> (left) · <span style={{ color: 'var(--blue)', fontWeight: 600 }}>— {dv.label}</span> (right{invert ? ', upside down' : ''})</div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>{dv.why}</p>
    </div>

    <div data-blk="roll" data-span={4} className="card">
      <b>Is the link still working?</b>
      <div className="muted small" style={{ margin: '2px 0 8px' }}>26-week correlation of weekly moves, {A.short} vs {dv.label.toLowerCase()}</div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: 0, right: 4, top: 6, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="d" tickFormatter={(d) => (years > 3 ? d.slice(0, 4) : mY(d))} minTickGap={40} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
            <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={32} />
            <ReferenceLine y={0} stroke="var(--dim)" />
            <Tooltip {...TT} labelFormatter={(d) => shortD(d)} formatter={(v) => [v?.toFixed(2), 'Correlation']} />
            <Line dataKey="corr" stroke="var(--violet)" strokeWidth={1.8} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="small" style={{ margin: '8px 0 0' }}>{linkText(rollNow.at(-1), dv.link[asset].c5, A.short, dv)}</p>
    </div>
  </Board>;
}
const clipZ = (z) => Math.max(-2.5, Math.min(2.5, z));
const cc = (x) => (x == null ? '—' : `${x > 0 ? '+' : ''}${x.toFixed(2)}`);
function linkText(now, long, name, dv) {
  if (now == null || long == null) return 'Not enough data to judge the link.';
  const strong = (x) => Math.abs(x) >= 0.4 ? 'strong' : Math.abs(x) >= 0.2 ? 'moderate' : 'weak';
  const flip = Math.sign(now) !== Math.sign(long) && Math.abs(now) > 0.15 && Math.abs(long) > 0.15;
  return `Right now the link is ${strong(now)} (${cc(now)}) against ${cc(long)} over 5 years.${flip ? ` It has flipped sign: ${name} is currently moving against its usual relationship with ${dv.label.toLowerCase()}, which often happens when another force (central-bank buying, a crisis) takes over.` : Math.abs(now) < Math.abs(long) - 0.2 ? ' Weaker than usual: this driver matters less at the moment.' : Math.abs(now) > Math.abs(long) + 0.2 ? ' Stronger than usual: this driver is in charge right now.' : ''}`;
}

// ───────────────────────── Regimes ─────────────────────────
function Regimes({ M, A, head, id }) {
  const G = M.assets.XAUUSD, N = M.assets.NAS100;
  const cur = M.regime;
  const [h, setH] = useState(3);
  const score = A.score.history.map((r) => ({ d: r.d, score: r.score, price: r.c }));
  const month = new Date().getUTCMonth();
  const RCOL = { goldilocks: '#10b981', overheat: '#f59e0b', stagflation: '#ef4444', slowdown: '#6366f1' };
  return <Board id={id} className="page">{head}
    <div data-blk="quad" data-span={7} className="card">
      <div className="row between wrap" style={{ gap: 8 }}>
        <b className="row" style={{ gap: 6 }}><Compass size={16} /> What happened next in each regime</b>
        <Seg options={[1, 3, 6].map((x) => ({ value: x, label: `${x} month${x > 1 ? 's' : ''}` }))} value={h} onChange={setH} />
      </div>
      <div className="muted small" style={{ margin: '2px 0 10px' }}>Average return over the next {h} month{h > 1 ? 's' : ''} from every month-end since {G.regimes.from?.slice(0, 4)} ({G.regimes.months} months)</div>
      <div className="quad">
        <div className="quad-axis top">Inflation rising ↑</div>
        {['overheat', 'stagflation', 'goldilocks', 'slowdown'].map((k) => {
          const g = G.regimes.regime[k]?.[h], n = N.regimes.regime[k]?.[h];
          return (
            <div key={k} className={cls('quad-cell', cur?.key === k && 'now')} style={{ '--rc': RCOL[k] }}>
              <div className="row between"><b>{REGIMES[k].label}</b>{cur?.key === k && <span className="tag green">Now</span>}</div>
              <div className="muted small">{REGIMES[k].text} · {g?.n ?? 0} months</div>
              <div className="quad-nums">
                <div><span className="muted small">Gold</span><b className={tone(g?.mean)}>{sp(g?.mean)}</b><span className="muted small">up {pc(g?.up)}</span></div>
                <div><span className="muted small">Nasdaq</span><b className={tone(n?.mean)}>{sp(n?.mean)}</b><span className="muted small">up {pc(n?.up)}</span></div>
              </div>
            </div>
          );
        })}
        <div className="quad-axis bottom">← Growth holding up · Growth slowing →</div>
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>All months: gold {sp(G.regimes.all[h].mean)} (up {pc(G.regimes.all[h].up)}), Nasdaq {sp(N.regimes.all[h].mean)} (up {pc(N.regimes.all[h].up)}). Gold rose strongly over this period and the Nasdaq more, so most cells are positive: compare each cell with the all-months figure, not with zero.</div>
    </div>

    <div data-blk="fed" data-span={5} className="card">
      <b className="row" style={{ gap: 6 }}><Landmark size={16} /> Fed cutting, holding or hiking</b>
      <div className="muted small" style={{ margin: '2px 0 10px' }}>Next {h} month{h > 1 ? 's' : ''} after each month-end · now: <b>{fedText(cur?.fed)}</b></div>
      <table className="tbl">
        <thead><tr><th>Fed</th><th>Months</th><th>Gold</th><th>Nasdaq</th></tr></thead>
        <tbody>{[1, 0, -1].map((f) => { const g = G.regimes.fed[f]?.[h], n = N.regimes.fed[f]?.[h]; return (
          <tr key={f} className={cls(cur?.fed === f && 'sel')}><td style={{ textTransform: 'capitalize' }}>{fedText(f)}</td><td>{g?.n ?? 0}</td>
            <td className={cls('mono', tone(g?.mean))}>{sp(g?.mean)} <span className="muted">· up {pc(g?.up)}</span></td>
            <td className={cls('mono', tone(n?.mean))}>{sp(n?.mean)} <span className="muted">· up {pc(n?.up)}</span></td></tr>
        ); })}</tbody>
      </table>
      <div className="muted small" style={{ marginTop: 10 }}>Regime, last 3 years</div>
      <div className="strip">{G.regimes.history.map((r) => <i key={r.d} title={`${r.d.slice(0, 7)}: ${REGIMES[r.key].label}, Fed ${fedText(r.fed)}`} style={{ background: RCOL[r.key] }} />)}</div>
      <div className="row wrap small muted" style={{ gap: 10, marginTop: 6 }}>{Object.keys(REGIMES).map((k) => <span key={k} className="row" style={{ gap: 4 }}><i className="dot" style={{ background: RCOL[k] }} />{REGIMES[k].label}</span>)}</div>
    </div>

    <div data-blk="scorehist" data-span={8} className="card">
      <b>{A.short} macro score, last 3 years</b>
      <div style={{ height: 260, marginTop: 10 }}>
        <ResponsiveContainer>
          <LineChart data={score} margin={{ left: 4, right: 4, top: 6, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="d" tickFormatter={mY} minTickGap={40} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
            <YAxis yAxisId="s" domain={[-2, 2]} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={30} />
            <YAxis yAxisId="p" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={58} tickFormatter={(v) => v.toLocaleString()} />
            <ReferenceLine yAxisId="s" y={0.5} stroke="var(--green)" strokeDasharray="4 4" />
            <ReferenceLine yAxisId="s" y={-0.5} stroke="var(--red)" strokeDasharray="4 4" />
            <Tooltip {...TT} labelFormatter={(d) => shortD(d)} formatter={(v, n) => [n === 'price' ? px(A, v) : v.toFixed(2), n === 'price' ? A.short : 'Score']} />
            <Line yAxisId="s" dataKey="score" stroke="var(--blue)" strokeWidth={1.8} dot={false} />
            <Line yAxisId="p" dataKey="price" stroke="var(--gold)" strokeWidth={1.4} dot={false} opacity={0.7} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="small muted">Blue: score (left). Gold line: {A.short} (right). Dashed lines: ±0.5.</div>
    </div>

    <div data-blk="season" data-span={4} className="card">
      <b>{A.short} by calendar month</b>
      <div className="muted small" style={{ margin: '2px 0 8px' }}>Average monthly return since 2005; this month highlighted</div>
      <div style={{ height: 190 }}>
        <ResponsiveContainer>
          <BarChart data={A.seasonality.map((s) => ({ ...s, name: MONTHS[s.m] }))} margin={{ left: 0, right: 4, top: 6, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} interval={0} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={32} tickFormatter={(v) => `${v}%`} />
            <ReferenceLine y={0} stroke="var(--dim)" />
            <Tooltip {...TT} formatter={(v, n, p) => [`${sp(v)} avg · up ${pc(p.payload.up)} of ${p.payload.n}`, MONTHS[p.payload.m]]} />
            <Bar dataKey="mean" radius={[4, 4, 0, 0]}>{A.seasonality.map((s) => <Cell key={s.m} fill={s.m === month ? 'var(--blue)' : s.mean >= 0 ? 'var(--green)' : 'var(--red)'} opacity={s.m === month ? 1 : 0.55} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {(() => { const s = A.seasonality[month], n = A.seasonality[(month + 1) % 12]; return <div className="small" style={{ marginTop: 6 }}>{MONTHS[month]}: {sp(s.mean)} on average, higher in {pc(s.up)} of {s.n} years. {MONTHS[(month + 1) % 12]}: {sp(n.mean)}, higher in {pc(n.up)}. About 20 years per month, so treat it as a mild tilt.</div>; })()}
    </div>
  </Board>;
}

// ───────────────────────── Positioning ─────────────────────────
function Positioning({ M, head, id }) {
  const groups = [...(M.assets.XAUUSD.cot || []).map((g) => ({ ...g, a: M.assets.XAUUSD })), ...(M.assets.NAS100.cot || []).map((g) => ({ ...g, a: M.assets.NAS100 }))];
  if (!groups.length) return <Board id={id} className="page">{head}<div data-blk="none" className="card muted">Positioning data (CFTC) is unavailable right now.</div></Board>;
  return <Board id={id} className="page">{head}
    {groups.map((g) => (
      <div key={g.a.key + g.key} data-blk={g.a.key + g.key} data-span={groups.length === 3 ? 4 : 6} className="card">
        <div className="row between"><b className="row" style={{ gap: 6 }}><Users size={16} /> {g.a.short}: {g.label}</b><span className="muted small">{shortD(g.now.d)}</span></div>
        <div className="row" style={{ gap: 14, alignItems: 'baseline', marginTop: 10 }}>
          <span className="big-num" style={{ fontSize: 24 }}>{g.now.pctOi > 0 ? '+' : ''}{g.now.pctOi.toFixed(1)}%</span>
          <span className="muted small">net {g.now.net > 0 ? 'long' : 'short'} {Math.abs(g.now.net).toLocaleString()} contracts, of all open contracts</span>
        </div>
        {g.now.rank != null && <>
          <div className="pctl"><i style={{ left: `${g.now.rank}%` }} /><span style={{ left: '10%' }} /><span style={{ left: '90%' }} /></div>
          <div className="row between muted small"><span>Most short (3y)</span><b style={{ color: 'var(--text)' }}>{ordinal(Math.round(g.now.rank))} percentile</b><span>Most long</span></div>
        </>}
        <div className="kv"><span>Change, 1 week</span><b className={tone(g.chg1w)}>{g.chg1w > 0 ? '+' : ''}{g.chg1w?.toLocaleString()}</b><span>Change, 4 weeks</span><b className={tone(g.chg4w)}>{g.chg4w > 0 ? '+' : ''}{g.chg4w?.toLocaleString()}</b></div>
        <div style={{ height: 150, marginTop: 10 }}>
          <ResponsiveContainer>
            <LineChart data={g.history} margin={{ left: 0, right: 4, top: 6, bottom: 0 }}>
              <XAxis dataKey="d" tickFormatter={mY} minTickGap={40} tick={{ fontSize: 10.5, fill: 'var(--muted)' }} />
              <YAxis tick={{ fontSize: 10.5, fill: 'var(--muted)' }} width={42} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <ReferenceLine y={0} stroke="var(--dim)" />
              <Tooltip {...TT} labelFormatter={(d) => shortD(d)} formatter={(v) => [`${v.toFixed(1)}% of open interest`, 'Net']} />
              <Line dataKey="pctOi" stroke="var(--violet)" strokeWidth={1.8} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <table className="tbl" style={{ marginTop: 8 }}>
          <thead><tr><th>{g.a.short} next 13 weeks when…</th><th>Weeks</th><th>Average</th><th>Up</th></tr></thead>
          <tbody>{[['Crowded long (top 10%)', g.crowdedLong], ['In the middle', g.middle], ['Crowded short (bottom 10%)', g.crowdedShort], ['All weeks', g.all]].map(([l, s]) => (
            <tr key={l}><td>{l}</td><td>{s.n}</td><td className={cls('mono', tone(s.mean))}>{sp(s.mean)}</td><td>{pc(s.up)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    ))}
    <div data-blk="cotnote" data-span={12} className="card small">
      <b>Reading positioning.</b> The CFTC publishes every Friday what big traders held on Tuesday. Hedge funds chase trends, so extreme net longs mean most buyers are already in: when news turns, they all sell together (and the reverse for extreme shorts). Asset managers move slowly and mostly show the long-term trend. Extremes are a warning about crowding, not a timing signal on their own.
    </div>
  </Board>;
}

// ───────────────────────── News ─────────────────────────
function News({ M, now, head, id }) {
  const H = M.headlines;
  const [theme, setTheme] = useState('All');
  const items = H.items.filter((h) => theme === 'All' || h.themes.includes(theme) || (theme === 'Fed releases' && h.source === 'Federal Reserve'));
  const themes = ['All', ...H.counts.map(([k]) => k), 'Fed releases'];
  return <Board id={id} className="page">{head}
    <div data-blk="tilt" data-span={4} className="card">
      <b className="row" style={{ gap: 6 }}><Newspaper size={16} /> Last 48 hours</b>
      <div className="muted small" style={{ margin: '2px 0 10px' }}>{H.recent} relevant headlines, sorted by keywords</div>
      {[['Gold', H.gold], ['Nasdaq', H.nq]].map(([n, t]) => (
        <div key={n} style={{ marginBottom: 12 }}>
          <div className="row between"><b>{n}</b><span className="small"><span className="pos">▲ {t.up} supportive</span> · <span className="neg">▼ {t.down} negative</span></span></div>
          <div className="tilt"><i className="up" style={{ flex: t.up || 0.001 }} /><i className="down" style={{ flex: t.down || 0.001 }} /></div>
        </div>
      ))}
      <div className="muted small" style={{ fontWeight: 600, marginTop: 6 }}>Themes</div>
      <div className="col" style={{ gap: 4, marginTop: 6 }}>{H.counts.map(([k, n]) => <div key={k} className="row between small"><span>{k}</span><b>{n}</b></div>)}</div>
      <div className="muted small" style={{ marginTop: 10 }}>Keyword sorting can misread a headline. It shows what the news flow is about, not a trading signal.</div>
    </div>
    <div data-blk="list" data-span={8} className="card">
      <div className="row wrap" style={{ gap: 6 }}>{themes.map((t) => <button key={t} className={cls('chip', theme === t && 'on')} onClick={() => setTheme(t)}>{t}</button>)}</div>
      <div className="col" style={{ marginTop: 12 }}>
        {!items.length && <div className="muted">No headlines for this theme in the last 7 days.</div>}
        {items.slice(0, 80).map((h) => (
          <div key={h.title + h.at} className="hl">
            <div className="hl-meta"><span>{ago(h.at, now)}</span><span>{h.source}</span></div>
            <div className="grow">
              {h.link ? <a href={h.link} target="_blank" rel="noopener noreferrer" className="hl-title">{h.title} <ExternalLink size={12} /></a> : <span className="hl-title">{h.title}</span>}
              <div className="row wrap" style={{ gap: 4, marginTop: 4 }}>{h.themes.map((t) => <span key={t} className="tag">{t}</span>)}{h.reads.map((r) => <span key={r} className="tag blue">{r}</span>)}</div>
            </div>
            <div className="hl-dir" title="Keyword read for gold / Nasdaq"><span>G <Dir v={h.gold} size={13} /></span><span>N <Dir v={h.nq} size={13} /></span></div>
          </div>
        ))}
      </div>
    </div>
  </Board>;
}
