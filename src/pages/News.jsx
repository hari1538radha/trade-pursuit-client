import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Search, RefreshCw, CalendarPlus, Newspaper, Clock, AlertTriangle, Plus } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Empty, Reveal } from '../components/ui.jsx';
import { cls } from '../lib/format.js';

const FLAGS = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', CNY: '🇨🇳', INR: '🇮🇳', KRW: '🇰🇷', ILS: '🇮🇱', ALL: '🌐' };
const IMPACTS = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['none', 'No impact']];
const impactKey = (i) => (i === 'holiday' ? 'none' : i);
const pad = (n) => String(n).padStart(2, '0');
const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const store = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };

function until(ms) {
  if (ms <= 0) return 'now';
  const m = Math.round(ms / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60}m`;
  return `in ${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Download a single event as an .ics file the user's calendar app can open. */
function addToCalendar(e) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(e.date), end = new Date(start.getTime() + 15 * 60000);
  const esc = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trade Pursuit//News//EN', 'BEGIN:VEVENT', `UID:${e.id}@tradepursuit`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(`${e.currency} ${e.title}`)}`, `DESCRIPTION:${esc(`Impact: ${e.impact}. Forecast: ${e.forecast || '-'}. Previous: ${e.previous || '-'}`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `${e.currency}-${e.title}.ics`.replace(/[^\w.-]+/g, '-');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function News() {
  const { api } = useApp();
  const [week, setWeek] = useState('thisweek');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [curs, setCurs] = useState(() => store('tp.news.cur', ['USD']));
  const [imps, setImps] = useState(() => store('tp.news.imp', ['high', 'medium', 'low']));
  const [days, setDays] = useState([]); // [] = whole week
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    setLoading(true); setErr('');
    try { setData(await api.news(week)); } catch (e) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { setDays([]); load(); const t = setInterval(load, 5 * 60_000); return () => clearInterval(t); }, [week]); // eslint-disable-line
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => localStorage.setItem('tp.news.cur', JSON.stringify(curs)), [curs]);
  useEffect(() => localStorage.setItem('tp.news.imp', JSON.stringify(imps)), [imps]);

  const events = data?.events || [];
  const allCurs = useMemo(() => {
    const seen = [...new Set(events.map((e) => e.currency))];
    const order = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'];
    return [...new Set([...order.filter((c) => seen.includes(c)), ...seen.sort(), ...curs])];
  }, [events, curs]);
  const weekDays = useMemo(() => [...new Set(events.map((e) => localDay(new Date(e.date))))].sort(), [events]);
  const todayKey = localDay(new Date());

  const shown = useMemo(() => events.filter((e) => (!curs.length || curs.includes(e.currency)) && imps.includes(impactKey(e.impact)) && (!days.length || days.includes(localDay(new Date(e.date))))), [events, curs, imps, days]);
  const grouped = useMemo(() => {
    const m = new Map();
    for (const e of shown) { const k = localDay(new Date(e.date)); if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
    return [...m.entries()];
  }, [shown]);
  const nextEv = shown.find((e) => new Date(e.date).getTime() > now);
  const nextHigh = events.find((e) => e.impact === 'high' && new Date(e.date).getTime() > now && (!curs.length || curs.includes(e.currency)));
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const dayLabel = (k) => new Date(`${k}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="page">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Economic Calendar</h1>
          <div className="muted">Times in your time zone ({tz}){data?.updatedAt && ` · updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Seg options={[{ value: 'thisweek', label: 'This week' }, { value: 'nextweek', label: 'Next week' }]} value={week} onChange={setWeek} />
          <button className="btn sm" onClick={load} disabled={loading}><motion.span animate={{ rotate: loading ? 360 : 0 }} transition={{ repeat: loading ? Infinity : 0, duration: 1, ease: 'linear' }} style={{ display: 'grid' }}><RefreshCw size={14} /></motion.span> Refresh</button>
        </div>
      </div>

      {nextHigh && (
        <Reveal className="banner" style={{ marginTop: 20, borderColor: 'var(--red)', background: 'linear-gradient(90deg,var(--red-soft),transparent 70%), var(--panel)' }}>
          <AlertTriangle size={20} className="neg" />
          <div className="grow"><b>Next high-impact: {FLAGS[nextHigh.currency] || ''} {nextHigh.currency} {nextHigh.title}</b><div className="muted">{new Date(nextHigh.date).toLocaleString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</div></div>
          <span className="tag red" style={{ fontSize: 15, fontWeight: 700 }}><Clock size={14} /> {until(new Date(nextHigh.date).getTime() - now)}</span>
        </Reveal>
      )}
      {data?.sample && (
        <div className="banner" style={{ marginTop: 14, borderColor: 'var(--gold)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--gold)' }} />
          <span className="muted">Preview mode can't reach the live calendar, so these are <b className="text2">sample events</b>. With the API connected this page shows the real week.</span>
        </div>
      )}

      <div className="card" style={{ marginTop: 18, padding: 0 }}>
        <div style={{ padding: 18, borderBottom: '1px solid var(--line)' }} className="col">
          <div className="news-filters">
            <span className="muted" style={{ marginRight: 4 }}>Filters</span>
            <CurrencyPicker all={allCurs} value={curs} onChange={setCurs} />
            <button className={cls('day-chip', !days.length && 'on')} onClick={() => setDays([])}>All week</button>
            {weekDays.map((d) => (
              <button key={d} className={cls('day-chip', days.includes(d) && 'on')} onClick={() => toggle(days, setDays, d)}>
                {d === todayKey ? <>Today <span style={{ opacity: 0.7 }}>{new Date(`${d}T12:00:00`).getDate()}</span></> : dayLabel(d)}
              </button>
            ))}
          </div>
          <div className="row wrap" style={{ gap: 10, marginTop: 14 }}>
            {IMPACTS.map(([k, l]) => (
              <button key={k} className={cls('imp-btn', `imp-${k}`, imps.includes(k) && 'on')} onClick={() => toggle(imps, setImps, k)}>
                <span className="imp-dot" style={{ background: 'currentColor', opacity: imps.includes(k) ? 1 : 0.35 }} />
                <span style={{ color: imps.includes(k) ? 'var(--text)' : 'var(--muted)' }}>{imps.includes(k) ? <Check size={13} style={{ verticalAlign: -2 }} /> : <Plus size={13} style={{ verticalAlign: -2 }} />} {l}</span>
              </button>
            ))}
          </div>
        </div>

        {err ? (
          <Empty icon={<AlertTriangle />} title="Couldn't load the calendar" action={<button className="btn primary" onClick={load}>Try again</button>}>{err}</Empty>
        ) : !data && loading ? (
          <div className="empty">Loading the calendar…</div>
        ) : shown.length === 0 ? (
          <Empty icon={<Newspaper />} title="No events match">Try more currencies, another impact level or the whole week.</Empty>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="news-table">
              <thead><tr><th style={{ width: 110 }}>Time</th><th style={{ width: 110 }}>Currency</th><th>Event</th><th>Actual</th><th>Forecast</th><th>Previous</th><th style={{ textAlign: 'right' }}>Add to calendar</th></tr></thead>
              <tbody>
                {grouped.map(([day, evs]) => (
                  <DayRows key={day} day={day} evs={evs} now={now} next={nextEv} isToday={day === todayKey} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>Source: Forex Factory weekly calendar export. Check your broker or the official release before trading the number.</p>
    </div>
  );
}

function DayRows({ day, evs, now, next, isToday }) {
  return (
    <>
      <tr className="day"><td colSpan={7}>{new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}{isToday && <span className="tag blue" style={{ marginLeft: 10 }}>Today</span>}</td></tr>
      {evs.map((e) => {
        const t = new Date(e.date).getTime();
        const past = t <= now;
        const allDay = e.impact === 'holiday' || (new Date(e.date).getHours() === 0 && new Date(e.date).getMinutes() === 0 && e.impact === 'none');
        return (
          <tr key={e.id} className={cls(past && 'past', next?.id === e.id && 'next')}>
            <td className="mono" style={{ whiteSpace: 'nowrap' }}><span className={`imp-dot imp-${impactKey(e.impact)}`} style={{ background: 'currentColor', marginRight: 10 }} />{allDay ? 'All day' : new Date(e.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
            <td style={{ whiteSpace: 'nowrap' }}><span style={{ marginRight: 8 }}>{FLAGS[e.currency] || '🏳️'}</span>{e.currency}</td>
            <td><b style={{ fontWeight: 500 }}>{e.title}</b>{e.impact === 'high' && <span className="tag red" style={{ marginLeft: 8, padding: '2px 7px', fontSize: 11 }}>High</span>}</td>
            <td className="mono">{e.actual || '—'}</td>
            <td className="mono">{e.forecast || '—'}</td>
            <td className="mono muted">{e.previous || '—'}</td>
            <td className="keep" style={{ textAlign: 'right' }}>
              {past ? <span className="status-pill">Event ended</span> : (
                <span className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                  <span className="status-pill soon">{until(t - now)}</span>
                  <button className="icon-btn" title="Add to calendar (.ics)" onClick={() => addToCalendar(e)}><CalendarPlus size={16} /></button>
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function CurrencyPicker({ all, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener('mousedown', off);
    return () => window.removeEventListener('mousedown', off);
  }, [open]);
  const list = all.filter((c) => c.includes(q.trim().toUpperCase()));
  const label = !value.length ? 'All currencies' : value.length <= 3 ? value.join(', ') : `${value.slice(0, 2).join(', ')} +${value.length - 2}`;
  return (
    <div className="cur-pick" ref={ref}>
      <button className="cur-btn" onClick={() => setOpen((o) => !o)}><span>{label}</span><motion.span animate={{ rotate: open ? 180 : 0 }} style={{ display: 'grid' }}><ChevronDown size={15} /></motion.span></button>
      <AnimatePresence>
        {open && (
          <motion.div className="cur-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
            <div className="search" style={{ marginBottom: 6 }}><Search size={14} className="muted" /><input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search currency…" /></div>
            <button className="cur-opt" style={{ background: 'var(--panel2)', marginBottom: 4 }} onClick={() => onChange([])}>{value.length ? 'Clear all (show every currency)' : 'Showing every currency'}</button>
            <div className="opts">
              {list.map((c) => {
                const on = value.includes(c);
                return <button key={c} className={cls('cur-opt', on && 'on')} onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}><span>{FLAGS[c] || '🏳️'} {c}</span>{on && <Check size={15} />}</button>;
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
