import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, AreaChart, Area, ReferenceLine } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Money, Reveal, BigTitle, ChartTip, Seg, Empty } from '../components/ui.jsx';
import Calendar from '../components/Calendar.jsx';
import { summary, cumulative, groupBy, byWeekday, byHour, combos, streaks, insights, real } from '../lib/stats.js';
import { dayMonth, addDays, today } from '../lib/dates.js';
import { money, pct } from '../lib/format.js';
import { BarChart3 } from 'lucide-react';

const TABS = ['Overview', 'Performance', 'Time', 'Psychology', 'Insights', 'Risk'];
const G = 'var(--green)', R = 'var(--red)';

export default function Analytics() {
  const { trades: all, breakEven, hidePnl, toggleHide, accounts } = useApp();
  const [tab, setTab] = useState('Overview');
  const [range, setRange] = useState('All');
  const [acct, setAcct] = useState('');
  const trades = useMemo(() => {
    const days = { '30D': 30, '90D': 90, YTD: null }[range];
    let t = all;
    if (range === 'YTD') t = t.filter((x) => x.date >= `${today().slice(0, 4)}-01-01`);
    else if (days) t = t.filter((x) => x.date > addDays(today(), -days));
    if (acct) t = t.filter((x) => (x.accounts || []).includes(acct));
    return t;
  }, [all, range, acct]);
  const s = useMemo(() => summary(trades, breakEven), [trades, breakEven]);
  const go = (t) => { setTab(t); document.getElementById(`sec-${t}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  if (!real(all).length) return <div className="page"><Empty icon={<BarChart3 />} title="Nothing to analyse yet">Log a few trades and every chart here fills in. All analytics are free.</Empty></div>;

  return (
    <div className="page">
      <div className="row between wrap" style={{ gap: 12, position: 'sticky', top: -26, zIndex: 5, background: 'var(--bg2)', padding: '12px 0' }}>
        <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Analytics</h1><div className="muted">{s.count} trades analysed</div></div>
        <Seg options={TABS} value={tab} onChange={go} size="lg" />
        <div className="row">
          <select className="select" style={{ width: 150, padding: '8px 12px' }} value={acct} onChange={(e) => setAcct(e.target.value)}><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <Seg options={['30D', '90D', 'YTD', 'All']} value={range} onChange={setRange} />
          <button className="btn sm" onClick={toggleHide}>{hidePnl ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        </div>
      </div>

      <section id="sec-Overview" style={{ scrollMarginTop: 80 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 24 }}>
          {[['Total P&L', <Money key="t" value={s.total} cents={false} animated />], ['Win Rate', pct(s.winRate)], ['Avg Win RR', s.avgWinRR != null ? `${s.avgWinRR.toFixed(2)}R` : '—'], ['Profit Factor', Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'], ['Best Trade', <Money key="b" value={s.best} cents={false} />], ['Worst Trade', <Money key="w" value={s.worst} cents={false} />]].map(([l, v], i) => (
            <Reveal key={l} delay={i * 0.04} className="card stat"><div className="label">{l}</div><div className="val" style={{ fontSize: 30 }}>{v}</div></Reveal>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', marginTop: 14 }}>
          <Reveal className="card"><h3>Cumulative P&amp;L</h3><CumChart trades={trades} /></Reveal>
          <Reveal delay={0.05} className="card"><h3 style={{ marginBottom: 12 }}>P&amp;L Calendar</h3><Calendar trades={trades} /></Reveal>
        </div>
      </section>

      <section id="sec-Performance" style={{ scrollMarginTop: 80 }}>
        <BigTitle tagline="What you trade, and which setups pay.">Performance</BigTitle>
        <Performance trades={trades} be={breakEven} />
      </section>

      <section id="sec-Time" style={{ scrollMarginTop: 80 }}>
        <BigTitle tagline="When you trade best.">Time</BigTitle>
        <TimeSec trades={trades} be={breakEven} />
      </section>

      <section id="sec-Psychology" style={{ scrollMarginTop: 80 }}>
        <BigTitle tagline="How your head shows up in the numbers.">Psychology</BigTitle>
        <Psych trades={trades} be={breakEven} />
      </section>

      <section id="sec-Insights" style={{ scrollMarginTop: 80 }}>
        <BigTitle tagline="What the data is telling you.">Insights</BigTitle>
        <Reveal className="card col" style={{ gap: 14, position: 'relative', zIndex: 1 }}>
          {insights(trades, breakEven).map((x, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="row" style={{ alignItems: 'flex-start', gap: 12, fontSize: 16, lineHeight: 1.5 }}>
              <Lightbulb size={18} style={{ color: 'var(--gold)', flex: 'none', marginTop: 3 }} />{x}
            </motion.div>
          ))}
        </Reveal>
      </section>

      <section id="sec-Risk" style={{ scrollMarginTop: 80 }}>
        <BigTitle tagline="How much you give back, and how fast.">Risk</BigTitle>
        <Risk trades={trades} be={breakEven} />
      </section>
    </div>
  );
}

function CumChart({ trades, dd }) {
  const { hidePnl } = useApp();
  const data = cumulative(trades).map((d) => ({ ...d, label: dayMonth(d.date) }));
  return (
    <div style={{ height: 300, marginTop: 10 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs><linearGradient id={dd ? 'ddg' : 'cug'} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={dd ? R : G} stopOpacity=".3" /><stop offset="1" stopColor={dd ? R : G} stopOpacity="0" /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} />
          <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={(v) => (hidePnl ? '•' : `$${v}`)} />
          <Tooltip content={<ChartTip />} />
          <Area type="monotone" dataKey={dd ? 'dd' : 'cum'} name={dd ? 'Drawdown' : 'Cumulative'} stroke={dd ? R : G} strokeWidth={2} fill={`url(#${dd ? 'ddg' : 'cug'})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Bars({ data, dataKey = 'pnl', name = 'P&L', height = 260, fmt, layout }) {
  const { hidePnl } = useApp();
  const f = fmt || ((v) => (hidePnl ? '$•••' : money(v, { cents: false })));
  if (!data.length) return <div className="empty" style={{ padding: 40 }}>Not enough data</div>;
  const vertical = layout === 'vertical';
  return (
    <div style={{ height: vertical ? Math.max(160, data.length * 38) : height, marginTop: 10 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout={vertical ? 'vertical' : 'horizontal'} margin={{ left: vertical ? 20 : 0 }}>
          <CartesianGrid strokeDasharray="3 4" vertical={vertical} horizontal={!vertical} />
          {vertical ? <><XAxis type="number" tickLine={false} axisLine={false} tickFormatter={f} /><YAxis type="category" dataKey="key" tickLine={false} axisLine={false} width={150} /></> : <><XAxis dataKey="key" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={60} tickFormatter={f} /></>}
          <Tooltip cursor={{ fill: 'var(--hover)' }} content={<ChartTip fmt={f} />} />
          <ReferenceLine {...(vertical ? { x: 0 } : { y: 0 })} stroke="var(--line2)" />
          <Bar dataKey={dataKey} name={name} radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} animationDuration={900}>
            {data.map((d, i) => <Cell key={i} fill={(d.pnl ?? d[dataKey]) >= 0 ? G : R} fillOpacity={dataKey !== 'count' && d.count < 5 ? 0.45 : 1} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const grade = (wr, n) => (n < 3 ? '—' : wr >= 65 ? 'A' : wr >= 55 ? 'B' : wr >= 45 ? 'C' : wr >= 35 ? 'D' : 'F');

function Performance({ trades, be }) {
  const cmb = combos(trades, be).slice(0, 8);
  const strat = groupBy(trades, (t) => t.playbook, be).sort((a, b) => b.winRate - a.winRate);
  const sym = groupBy(trades, (t) => t.symbol, be).sort((a, b) => b.pnl - a.pnl);
  const dir = groupBy(trades, (t) => (t.direction === 'short' ? 'Short' : 'Long'), be);
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <Reveal className="card">
        <h3>Combos that pay</h3><div className="sub">Trades with all of these chips: your win rate and what each one makes. Faded: fewer than 5 trades.</div>
        <div className="col" style={{ gap: 8, marginTop: 16 }}>
          {cmb.length ? cmb.map((c, i) => (
            <motion.div key={c.key} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: c.count < 5 ? 0.5 : 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }} className="row" style={{ padding: '10px 14px', background: 'var(--panel2)', borderRadius: 12 }}>
              <span className="grow">{c.key.split(' + ').map((k) => <span key={k} className="tag" style={{ marginRight: 6 }}>{k}</span>)}</span>
              <span className="muted" style={{ width: 90 }}>{c.count} trades</span>
              <span style={{ width: 70 }}>{c.winRate.toFixed(0)}%</span>
              <b style={{ width: 100, textAlign: 'right' }}><Money value={c.pnl} cents={false} /></b>
            </motion.div>
          )) : <p className="muted">Tag confluences and confirmations on your trades to see which combinations pay.</p>}
        </div>
      </Reveal>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', marginTop: 14 }}>
        <Reveal className="card"><h3>Win rate by strategy</h3><div className="sub">The strategies you wrote down: bar = win rate, colour = money</div><Bars data={strat} dataKey="winRate" name="Win rate" fmt={(v) => `${Math.round(v)}%`} layout="vertical" /></Reveal>
        <Reveal delay={0.05} className="card">
          <h3>Playbook report card</h3><div className="sub">Each setup graded on its win rate</div>
          <div className="col" style={{ gap: 8, marginTop: 16 }}>
            {strat.length ? strat.map((p) => (
              <div key={p.key} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="grade-badge" style={{ width: 36, height: 36, fontSize: 16, background: { A: 'var(--green)', B: 'var(--blue)', C: 'var(--gold)', D: '#f97316', F: 'var(--red)' }[grade(p.winRate, p.count)] || 'var(--panel3)', color: grade(p.winRate, p.count) === '—' ? undefined : '#fff' }}>{grade(p.winRate, p.count)}</span>
                <b className="grow">{p.key}</b><span className="muted">{p.count} trades · {p.winRate.toFixed(0)}%</span><b style={{ width: 90, textAlign: 'right' }}><Money value={p.pnl} cents={false} /></b>
              </div>
            )) : <p className="muted">Pick a playbook when you log trades.</p>}
          </div>
        </Reveal>
        <Reveal className="card"><h3>P&amp;L by symbol</h3><Bars data={sym} layout="vertical" /></Reveal>
        <Reveal delay={0.05} className="card"><h3>Long vs short</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', marginTop: 16 }}>
            {['Long', 'Short'].map((k) => { const d = dir.find((x) => x.key === k) || { count: 0, pnl: 0, winRate: 0 }; return <div key={k} className="card" style={{ background: 'var(--panel2)' }}><div className="muted">{k}</div><div style={{ fontSize: 30, fontWeight: 700, margin: '8px 0' }}><Money value={d.pnl} cents={false} /></div><div className="muted">{d.count} trades · {d.winRate.toFixed(0)}% win</div></div>; })}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function TimeSec({ trades, be }) {
  const sess = ['Asia', 'London', 'NY AM', 'NY PM'].map((k) => groupBy(trades, (t) => t.session, be).find((g) => g.key === k) || { key: k, pnl: 0, count: 0, winRate: 0 });
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', position: 'relative', zIndex: 1 }}>
      <Reveal className="card"><h3>By weekday</h3><Bars data={byWeekday(trades, be)} /></Reveal>
      <Reveal delay={0.05} className="card"><h3>By session</h3><Bars data={sess} /></Reveal>
      <Reveal className="card" style={{ gridColumn: '1/-1' }}><h3>By entry hour</h3><div className="sub">Uses the entry time on each trade</div><Bars data={byHour(trades, be)} /></Reveal>
    </div>
  );
}

function Psych({ trades, be }) {
  const neg = groupBy(trades, (t) => t.emotionsNeg, be).sort((a, b) => a.pnl - b.pnl);
  const pos = groupBy(trades, (t) => t.emotionsPos, be).sort((a, b) => b.pnl - a.pnl);
  const plan = groupBy(trades, (t) => (t.followedPlan === false ? 'Broke my plan' : 'Followed my plan'), be);
  const rev = groupBy(trades, (t) => t.postLoss || 'No revenge trade', be);
  const gr = ['A+', 'A', 'B', 'C', 'F'].map((g) => groupBy(trades, (t) => t.grade, be).find((x) => x.key === g) || { key: g, pnl: 0, count: 0 });
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', position: 'relative', zIndex: 1 }}>
      <Reveal className="card"><h3>Negative emotions</h3><div className="sub">What each feeling has cost you</div><Bars data={neg} layout="vertical" /></Reveal>
      <Reveal delay={0.05} className="card"><h3>Positive emotions</h3><div className="sub">What discipline has paid</div><Bars data={pos} layout="vertical" /></Reveal>
      <Reveal className="card"><h3>Life and your trading</h3><div className="sub">Plan vs no plan, revenge vs clean</div>
        <div className="col" style={{ gap: 10, marginTop: 14 }}>
          {[...plan, ...rev].map((g) => <div key={g.key} className="row between" style={{ padding: '10px 14px', background: 'var(--panel2)', borderRadius: 12 }}><span>{g.key}</span><span className="muted">{g.count} · {g.winRate.toFixed(0)}% · avg <Money value={g.avg} cents={false} /></span><b><Money value={g.pnl} cents={false} /></b></div>)}
        </div>
      </Reveal>
      <Reveal delay={0.05} className="card"><h3>P&amp;L by grade</h3><div className="sub">Do your A+ trades actually pay more?</div><Bars data={gr} /></Reveal>
    </div>
  );
}

function Risk({ trades, be }) {
  const ts = real(trades);
  const cum = cumulative(trades);
  const maxDD = cum.length ? Math.min(...cum.map((d) => d.dd)) : 0;
  const st = streaks(trades, be);
  const days = cum.map((d) => d.pnl);
  const rBuckets = ['≤-1R', '-1–0R', '0–1R', '1–2R', '2–3R', '3R+'].map((k) => ({ key: k, count: 0 }));
  for (const t of ts) if (Number.isFinite(t.realizedRR)) { const r = t.realizedRR; rBuckets[r <= -1 ? 0 : r < 0 ? 1 : r < 1 ? 2 : r < 2 ? 3 : r < 3 ? 4 : 5].count++; }
  const avg = (k) => { const v = ts.map((t) => t[k]).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        {[['Max drawdown', <Money key="m" value={maxDD} cents={false} />], ['Worst day', <Money key="d" value={days.length ? Math.min(...days) : 0} cents={false} />], ['Best day', <Money key="b" value={days.length ? Math.max(...days) : 0} cents={false} />], ['Win / loss streak', `${st.maxWin} / ${st.maxLoss}`], ['Avg MAE / MFE', avg('mae') != null ? `$${avg('mae').toFixed(0)} / $${(avg('mfe') || 0).toFixed(0)}` : '—']].map(([l, v], i) => (
          <Reveal key={l} delay={i * 0.04} className="card stat"><div className="label">{l}</div><div className="val" style={{ fontSize: 26 }}>{v}</div></Reveal>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', marginTop: 14 }}>
        <Reveal className="card"><h3>Drawdown from peak</h3><CumChart trades={trades} dd /></Reveal>
        <Reveal delay={0.05} className="card"><h3>R distribution</h3><div className="sub">Realized R on each trade</div><Bars data={rBuckets.map((b, i) => ({ ...b, pnl: i < 2 ? -1 : 1 }))} dataKey="count" name="Trades" fmt={(v) => v} /></Reveal>
      </div>
    </div>
  );
}
