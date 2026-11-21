import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Eye, EyeOff, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Money, CountUp, Reveal, ChartTip, Field } from '../components/ui.jsx';
import Calendar from '../components/Calendar.jsx';
import ExecutionStats from '../components/ExecutionStats.jsx';
import RangeCheck from '../components/RangeCheck.jsx';
import { summary, cumulative, real } from '../lib/stats.js';
import { longDate, today, weekStart, dayMonth, addDays } from '../lib/dates.js';
import { money } from '../lib/format.js';
import { useState } from 'react';

export default function Dashboard() {
  const { trades, breakEven, openModal, hidePnl, toggleHide, user, updateUser, notify } = useApp();
  const nav = useNavigate();
  const s = useMemo(() => summary(trades, breakEven), [trades, breakEven]);
  const cum = useMemo(() => cumulative(trades), [trades]);
  const ws = weekStart();
  const week = useMemo(() => summary(trades.filter((t) => t.date >= ws), breakEven), [trades, ws, breakEven]);
  const last7 = real(trades).filter((t) => t.date > addDays(today(), -7)).reduce((a, t) => a + (t.pnl || 0), 0);
  const thin = s.count < 10;

  return (
    <div className="page">
      <div className="row between">
        <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Dashboard</h1><div className="muted">{longDate(today())}</div></div>
        <div className="row"><button className="btn sm" onClick={() => openModal('quick')}><Plus size={14} /> Quick log</button><button className="btn sm primary" onClick={() => openModal('log')}><Plus size={14} /> Log trade</button></div>
      </div>

      {s.count === 0 && (
        <Reveal className="banner" style={{ marginTop: 22 }}>
          <div className="grow"><b style={{ fontSize: 18 }}>Log your first trade</b><div className="muted">Quick Log takes 5 seconds: symbol, direction, P&amp;L, grade. Press Q anywhere.</div></div>
          <button className="btn primary" onClick={() => openModal('quick')}>Quick log</button>
          <button className="btn" onClick={() => nav('/propfirm')}>Add a prop account</button>
        </Reveal>
      )}

      <div style={{ marginTop: 22 }}><RangeCheck /></div>

      <div className="hero glass" style={{ textAlign: 'center', margin: '40px 0 50px' }}>
        <div className="eyebrow">Total P&amp;L</div>
        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8 }} style={{ fontSize: 'clamp(60px,9vw,120px)', fontWeight: 800, letterSpacing: '-.05em', textShadow: '0 0 60px var(--glow)' }}>
          {hidePnl ? '$•••' : <CountUp value={s.total} format={(n) => money(n, { cents: false })} />}
        </motion.div>
        <div className="row" style={{ justifyContent: 'center', gap: 18, fontSize: 16 }}>
          <span><ArrowUpRight size={14} /> <Money value={last7} cents={false} /> <span className="muted">in 7 days</span></span>
          <b>{s.wins}W / <span className="muted">{s.losses}L</span></b>
        </div>
      </div>

      <div className="row between" style={{ margin: '0 0 14px' }}>
        <span className="eyebrow">Performance</span>
        <div className="row"><button className="btn sm ghost" onClick={() => nav('/analytics')}>Full analytics →</button><button className="btn sm" onClick={toggleHide}>{hidePnl ? <EyeOff size={14} /> : <Eye size={14} />} {hidePnl ? 'Show' : 'Hide'} P&amp;L</button></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1.3fr 1fr' }}>
        <Reveal className="card stat"><div className="label">Avg Win RR</div><div className="val">{s.avgWinRR != null ? `${s.avgWinRR.toFixed(2)}R` : '—'}</div><div className="foot">Profit factor {Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'}</div></Reveal>
        <Reveal delay={0.05} className="card row" style={{ gap: 24 }}>
          <Ring value={s.winRate} />
          <div className="stat grow"><div className="label">Win Rate</div><div className="val" style={{ marginTop: 6, fontSize: 28 }}>{s.wins}W / <span className="dim">{s.losses}L</span></div><div className="foot">{s.count} real trades{s.be ? ` · ${s.be} BE` : ''}</div></div>
          {thin && <span className="muted" style={{ fontSize: 13, textAlign: 'right' }}>Not enough<br />history yet</span>}
        </Reveal>
        <Reveal delay={0.1} className="card stat"><div className="label">Avg Win / Loss</div><div className="val"><Money value={s.avgWin} cents={false} className="" /></div><div className="foot">Avg loss <Money value={-s.avgLoss} cents={false} /></div></Reveal>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', marginTop: 14 }}>
        <Reveal className="card">
          <div className="row between"><span className="eyebrow">Cumulative P&amp;L <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>All time</span></span><b><Money value={s.total} cents={false} /></b></div>
          <div style={{ height: 280, marginTop: 12 }}>
            {cum.length ? (
              <ResponsiveContainer>
                <AreaChart data={cum.map((d) => ({ ...d, label: dayMonth(d.date) }))}>
                  <defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--blue)" stopOpacity=".35" /><stop offset="1" stopColor="var(--blue)" stopOpacity="0" /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={(v) => (hidePnl ? '•' : `$${v}`)} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="cum" name="Cumulative" stroke="var(--blue)" strokeWidth={2.5} fill="url(#cg)" animationDuration={1200} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="empty">No trades yet</div>}
          </div>
        </Reveal>
        <Reveal delay={0.05} className="card">
          <div className="row between"><span className="eyebrow">This week</span><span className="dim">{dayMonth(ws)} to today</span></div>
          <div style={{ fontSize: 44, fontWeight: 700, margin: '16px 0', letterSpacing: '-.03em' }}><Money value={week.total} cents={false} animated /></div>
          {[['Trades', week.count], ['Win rate', `${week.winRate.toFixed(0)}%`], ['Best trade', <Money key="b" value={week.best} cents={false} />], ['Worst trade', <Money key="w" value={week.worst} cents={false} />]].map(([k, v]) => (
            <div key={k} className="row between" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}><span className="muted">{k}</span><b>{v}</b></div>
          ))}
        </Reveal>
      </div>

      {s.count > 0 && <ExecutionStats trades={trades} be={breakEven} />}

      <Goals user={user} updateUser={updateUser} notify={notify} />

      <Reveal className="card" style={{ marginTop: 14 }}>
        <h3>P&amp;L calendar</h3>
        <div className="sub" style={{ marginBottom: 14 }}>Click a day to see its trades</div>
        <Calendar trades={trades} onDay={(d) => nav(`/journal?date=${d}`)} />
      </Reveal>
    </div>
  );
}

function Ring({ value }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" style={{ flex: 'none' }}>
      <circle cx="65" cy="65" r={r} stroke="var(--panel3)" strokeWidth="10" fill="none" />
      <motion.circle cx="65" cy="65" r={r} stroke="var(--blue)" strokeWidth="10" fill="none" strokeLinecap="round" transform="rotate(-90 65 65)" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
      <text x="65" y="72" textAnchor="middle" fill="var(--text)" fontSize="22" fontWeight="700">{value.toFixed(1)}%</text>
    </svg>
  );
}

function Goals({ user, updateUser, notify }) {
  const [edit, setEdit] = useState(false);
  const [g, setG] = useState(user.goals || {});
  const has = Object.values(user.goals || {}).some(Boolean);
  return (
    <Reveal className="card" style={{ marginTop: 14, padding: 28 }}>
      <h2 style={{ margin: 0, fontSize: 30, letterSpacing: '-.03em' }}>What are you trading for?</h2>
      {!edit && !has && <><p className="muted" style={{ maxWidth: 620, fontSize: 16, lineHeight: 1.5 }}>Set a goal for this week, this month, this year and your life, and the reason behind it.</p><button className="btn" onClick={() => setEdit(true)}>Set your goals</button></>}
      {!edit && has && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', marginTop: 18 }}>
          {['week', 'month', 'year', 'life', 'why'].filter((k) => user.goals[k]).map((k) => <div key={k} className="card" style={{ background: 'var(--panel2)' }}><div className="eyebrow">{k === 'why' ? 'My why' : `This ${k}`}</div><p style={{ marginBottom: 0, lineHeight: 1.5 }}>{user.goals[k]}</p></div>)}
          <button className="btn ghost" onClick={() => setEdit(true)}>Edit goals</button>
        </div>
      )}
      {edit && (
        <div className="fgrid" style={{ marginTop: 18 }}>
          {['week', 'month', 'year', 'life'].map((k) => <Field key={k} label={k === 'life' ? 'Life' : `This ${k}`}><input className="input" value={g[k] || ''} onChange={(e) => setG({ ...g, [k]: e.target.value })} /></Field>)}
          <div style={{ gridColumn: '1/-1' }}><Field label="Why"><textarea className="textarea" value={g.why || ''} onChange={(e) => setG({ ...g, why: e.target.value })} /></Field></div>
          <button className="btn primary" onClick={async () => { await updateUser({ goals: g }); setEdit(false); notify('Goals saved'); }}>Save goals</button>
        </div>
      )}
    </Reveal>
  );
}
