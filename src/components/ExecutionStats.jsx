import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Reveal, ease } from './ui.jsx';
import { real, outcome, groupBy } from '../lib/stats.js';
import { addDays, dayMonth, parseYmd, today, ymd } from '../lib/dates.js';

/** 33.23% → <b>33</b><small>.23%</small>, the way the big stat numbers are drawn. */
export function SplitPct({ value, digits = 2 }) {
  const [i, d] = (Number.isFinite(value) ? value : 0).toFixed(digits).split('.');
  return <span className="big-num">{i}<small>{d ? `.${d}` : ''}%</small></span>;
}

const kmoney = (n, hide) => {
  if (hide) return '$•••';
  const a = Math.abs(n);
  const s = a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `$${Math.round(a)}`;
  return `${n < 0 ? '-' : ''}${s}`;
};

/* ---------------- behavioral bias ---------------- */
export function BehavioralBias({ trades }) {
  const ts = real(trades);
  const longs = ts.filter((t) => t.direction !== 'short').length;
  const shorts = ts.length - longs;
  const bull = ts.length ? (longs / ts.length) * 100 : 50;
  const side = !ts.length || Math.abs(bull - 50) < 5 ? 'flat' : bull > 50 ? 'bull' : 'bear';
  const Icon = side === 'bull' ? TrendingUp : side === 'bear' ? TrendingDown : Minus;
  const lead = side === 'bear' ? { pct: 100 - bull, a: 'Bear', b: 'Short Bias' } : { pct: bull, a: 'Bull', b: 'Long Bias' };
  const other = side === 'bear' ? { pct: bull, a: 'Bull', b: 'Long Bias' } : { pct: 100 - bull, a: 'Bear', b: 'Short Bias' };
  return (
    <Reveal className="bias-card">
      <div className={`bias-art ${side}`}>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease }} style={{ color: '#fff', filter: 'drop-shadow(0 0 30px #ffffff55)', zIndex: 1 }}>
          <Icon size={120} strokeWidth={1.6} />
        </motion.div>
      </div>
      <div className="bias-body">
        <div className="row between wrap" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 14 }}>
            <span className="bias-big" style={{ color: side === 'bear' ? 'var(--red)' : side === 'bull' ? 'var(--blue)' : 'var(--text)' }}>{Math.round(lead.pct)}%</span>
            <span style={{ lineHeight: 1.3, fontSize: 16 }}><b>{lead.a}</b><br />{lead.b}</span>
          </div>
          <span className="dim" style={{ fontSize: 40, fontWeight: 200 }}>/</span>
          <div className="row" style={{ gap: 14 }}>
            <span className="muted" style={{ lineHeight: 1.3, fontSize: 16, textAlign: 'right' }}>{other.a}<br />{other.b}</span>
            <span className="bias-faint">{Math.round(other.pct)}%</span>
          </div>
        </div>
        <div className="split" style={{ marginTop: 26 }}>
          <motion.i initial={{ width: 0 }} whileInView={{ width: `${bull}%` }} viewport={{ once: true }} transition={{ duration: 1, ease }} style={{ background: 'var(--blue)' }} />
          <motion.i initial={{ width: 0 }} whileInView={{ width: `${100 - bull}%` }} viewport={{ once: true }} transition={{ duration: 1, ease }} style={{ background: 'var(--red)' }} />
        </div>
        <div className="row between" style={{ marginTop: 10, fontSize: 15 }}>
          <span><b>{longs}</b> <span className="muted">longs</span></span>
          <span><span className="muted">shorts</span> <b>{shorts}</b></span>
        </div>
      </div>
    </Reveal>
  );
}

/* ---------------- trading week performance ---------------- */
function TradingWeek({ trades }) {
  const { hidePnl } = useApp();
  const [offset, setOffset] = useState(0);
  const mon = useMemo(() => { const d = parseYmd(today()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7); return ymd(d); }, [offset]);
  const days = useMemo(() => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label, i) => {
    const date = addDays(mon, i);
    const ts = real(trades).filter((t) => t.date === date);
    const won = ts.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
    const lost = -ts.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0);
    return { label, date, won, lost, net: won - lost, count: ts.length };
  }), [trades, mon]);
  const max = Math.max(1, ...days.flatMap((d) => [d.won, d.lost]));
  const total = days.reduce((s, d) => s + d.net, 0);
  return (
    <Reveal className="card" style={{ padding: 28 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="eyebrow">Trading week performance</div>
          <div className="row" style={{ gap: 4, marginTop: 8 }}>
            <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setOffset((o) => o - 1)} aria-label="Previous week"><ChevronLeft size={15} /></button>
            <span className="muted" style={{ fontSize: 13, minWidth: 110, textAlign: 'center' }}>{offset === 0 ? 'This week' : `${dayMonth(mon)} – ${dayMonth(addDays(mon, 4))}`}</span>
            <button className="icon-btn" style={{ width: 28, height: 28 }} disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))} aria-label="Next week"><ChevronRight size={15} /></button>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="muted" style={{ fontSize: 13 }}>Total {offset === 0 ? 'this week' : 'that week'}</div>
          <div className={total > 0 ? 'pos' : total < 0 ? 'neg' : ''} style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.03em' }}>{kmoney(total, hidePnl)}</div>
        </div>
      </div>
      <div className="wk-bars">
        {days.map((d, i) => (
          <div key={d.date} className="wk-col" title={`${d.count} trades · won ${kmoney(d.won, hidePnl)} · lost ${kmoney(-d.lost, hidePnl)}`}>
            <div className="wk-pair">
              <motion.i initial={{ height: 0 }} whileInView={{ height: `${(d.won / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.05, ease }} style={{ background: 'var(--navy)' }} />
              <motion.i initial={{ height: 0 }} whileInView={{ height: `${(d.lost / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.05 + 0.05, ease }} style={{ background: 'var(--red)', opacity: 0.55 }} />
            </div>
            <b style={{ marginTop: 12, fontSize: 15 }} className={d.net > 0 ? 'pos' : d.net < 0 ? 'neg' : 'dim'}>{d.count ? kmoney(d.net, hidePnl) : '—'}</b>
            <span className="muted" style={{ fontSize: 14 }}>{d.label}</span>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 16, marginTop: 14, fontSize: 12 }}>
        <span className="row muted" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--navy)' }} /> Won</span>
        <span className="row muted" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--red)', opacity: 0.55 }} /> Lost</span>
      </div>
    </Reveal>
  );
}

/* ---------------- session win rates ---------------- */
const SESSION_GROUPS = [['New York', ['NY AM', 'NY PM']], ['London', ['London']], ['Asia', ['Asia']]];
function SessionWinRates({ trades, be }) {
  const rows = SESSION_GROUPS.map(([label, keys]) => {
    const ts = real(trades).filter((t) => keys.includes(t.session));
    const w = ts.filter((t) => outcome(t, be) === 'win').length, l = ts.filter((t) => outcome(t, be) === 'loss').length;
    return { label, count: ts.length, wr: w + l ? (w / (w + l)) * 100 : 0 };
  });
  const untagged = real(trades).filter((t) => !t.session || t.session === 'No session').length;
  return (
    <Reveal delay={0.05} className="card" style={{ padding: 28 }}>
      <div className="eyebrow">Session win rates</div>
      {rows.map((r, i) => (
        <div key={r.label} className="sess-row">
          <div className="row between"><span>{r.label} <span className="dim" style={{ fontSize: 12 }}>{r.count} trades</span></span><SplitPct value={r.wr} digits={1} /></div>
          <div className="sess-track"><motion.i initial={{ width: 0 }} whileInView={{ width: `${r.wr}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: i * 0.08, ease }} /></div>
        </div>
      ))}
      {untagged > 0 && <p className="dim" style={{ fontSize: 12, margin: '16px 0 0' }}>{untagged} trades have no session and are left out.</p>}
    </Reveal>
  );
}

/* ---------------- profitability ---------------- */
function Profitability({ trades, be }) {
  const ts = real(trades);
  const w = ts.filter((t) => outcome(t, be) === 'win').length, l = ts.filter((t) => outcome(t, be) === 'loss').length;
  const wp = w + l ? (w / (w + l)) * 100 : 0;
  return (
    <Reveal className="card col" style={{ padding: 28, justifyContent: 'space-between', minHeight: 300 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="eyebrow">Profitability</div>
        <div style={{ textAlign: 'right' }}><div className="muted" style={{ fontSize: 15 }}>Total Trades</div><div style={{ fontSize: 30, fontWeight: 600 }}>{ts.length}</div></div>
      </div>
      <div>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div><div className="muted">Won</div><span className="blue"><SplitPct value={wp} /></span></div>
          <div style={{ textAlign: 'right' }}><div className="muted">Lost</div><span className="neg"><SplitPct value={w + l ? 100 - wp : 0} /></span></div>
        </div>
        <div className="split" style={{ marginTop: 14 }}>
          <motion.i initial={{ width: 0 }} whileInView={{ width: `${wp}%` }} viewport={{ once: true }} transition={{ duration: 1, ease }} style={{ background: 'var(--navy)' }} />
          <motion.i initial={{ width: 0 }} whileInView={{ width: `${w + l ? 100 - wp : 0}%` }} viewport={{ once: true }} transition={{ duration: 1, ease }} style={{ background: 'var(--red)', opacity: 0.55 }} />
        </div>
        <div className="row between muted" style={{ marginTop: 10, fontSize: 14 }}><span>{w} trades</span>{ts.length - w - l > 0 && <span>{ts.length - w - l} break-even</span>}<span>{l} trades</span></div>
      </div>
    </Reveal>
  );
}

/* ---------------- most traded instruments ---------------- */
function WinRing({ value, size = 150 }) {
  const r = size / 2 - 10, c = 2 * Math.PI * r;
  return (
    <div className="ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--panel3)" strokeWidth="9" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r - 14} stroke="var(--line)" strokeWidth="1" fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke="var(--navy)" strokeWidth="9" fill="none" strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - value / 100) }} viewport={{ once: true }} transition={{ duration: 1.2, ease }} />
      </svg>
      <span className="ring-label"><SplitPct value={value} /></span>
    </div>
  );
}

function MostTraded({ trades, be }) {
  const top = groupBy(trades, (t) => t.symbol, be).sort((a, b) => b.count - a.count).slice(0, 3);
  return (
    <Reveal delay={0.05} className="card" style={{ padding: 28 }}>
      <div className="eyebrow">Most traded instruments</div>
      {top.length === 0 ? <p className="muted">Log trades with a symbol to see them here.</p> : (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${top.length},1fr)`, marginTop: 20, textAlign: 'center' }}>
          {top.map((s) => (
            <div key={s.key} className="col" style={{ alignItems: 'center', gap: 4 }} title="Ring = win rate on this instrument">
              <WinRing value={s.winRate} size={128} />
              <b className="blue" style={{ fontSize: 17, marginTop: 10 }}>{s.key}</b>
              <span className="muted">{s.count} trades</span>
            </div>
          ))}
        </div>
      )}
    </Reveal>
  );
}

export default function ExecutionStats({ trades, be = 0 }) {
  return (
    <>
      <div className="eyebrow" style={{ margin: '34px 0 14px' }}>Behavioral bias</div>
      <BehavioralBias trades={trades} />
      <div className="eyebrow" style={{ margin: '34px 0 14px' }}>Execution stats</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))' }}>
        <TradingWeek trades={trades} />
        <SessionWinRates trades={trades} be={be} />
        <Profitability trades={trades} be={be} />
        <MostTraded trades={trades} be={be} />
      </div>
    </>
  );
}
