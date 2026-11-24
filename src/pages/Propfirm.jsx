import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Pencil, Plus, Search, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Money, Reveal, Empty, ease } from '../components/ui.jsx';
import { FIRM_NOTE, accountMetrics, mergeFirms, propStats } from '../lib/firms.js';
import { usd, kfmt, money } from '../lib/format.js';
import Board from '../components/Board.jsx';

const pct = (v) => (v == null ? '—' : `${Math.round(v)}%`);
const days = (v) => (v == null ? '—' : `${Math.round(v * 10) / 10}`);

export default function Propfirm() {
  const { accounts, allTrades, openModal, settings } = useApp();
  const [tab, setTab] = useState('Accounts');
  const [type, setType] = useState('All');
  const [q, setQ] = useState('');
  const allFirms = useMemo(() => mergeFirms(settings.customFirms), [settings.customFirms]);
  const firms = allFirms.filter((f) => (type === 'All' || f.type === type) && f.name.toLowerCase().includes(q.toLowerCase()));
  const st = useMemo(() => propStats(accounts, allTrades), [accounts, allTrades]);
  const active = accounts.filter((a) => a.status === 'active');
  const history = accounts.filter((a) => a.status !== 'active').sort((a, b) => (b.passedAt || b.failedAt || b.updatedAt || '').localeCompare(a.passedAt || a.failedAt || a.updatedAt || ''));

  return (
    <Board id="propfirm" className="page">
      <div data-fixed className="page-head row between wrap" style={{ gap: 10 }}>
        <Seg size="lg" options={['Accounts', 'Analysis', 'History']} value={tab} onChange={setTab} />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => openModal('firm')}><Building2 size={16} /> Add firm</button>
          <button className="btn primary" onClick={() => openModal('addAccount')}><Plus size={16} /> Add account</button>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="stat-row" style={{ marginTop: 20 }}>
          {[
            ['Active', st.active],
            ['Pass rate', pct(st.passRate), `${st.passed} passed · ${st.failed} failed`],
            ['Funded', st.funded, st.fundedRate != null ? `${pct(st.fundedRate)} of finished challenges got here` : ''],
            ['Spent', usd(st.spent)],
            ['Payouts', <span key="p" className="pos">{usd(st.payouts)}</span>, st.roi != null ? `ROI ${pct(st.roi)}` : ''],
          ].map(([l, v, sub], i) => (
            <Reveal key={l} delay={i * 0.04} className="card stat"><div className="label">{l}</div><div className="val">{v}</div>{sub && <div className="sub">{sub}</div>}</Reveal>
          ))}
        </div>
      )}

      <AnimatePresence mode="popLayout" initial={false}>
        {tab === 'Accounts' && (
          <motion.div key="acc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {active.length > 0 ? (
              <div className="tile-grid" style={{ marginTop: 18 }}>
                {active.map((a, i) => <AccountTile key={a.id} a={a} m={accountMetrics(a, allTrades)} i={i} onClick={() => openModal('account', { id: a.id })} />)}
              </div>
            ) : (
              <div style={{ textAlign: 'center', margin: '44px 0 26px' }}>
                <div className="empty" style={{ padding: 0 }}><div className="ico"><Building2 /></div></div>
                <h2 style={{ fontSize: 28, margin: '16px 0 6px' }}>Track your prop firm challenges</h2>
                <p className="muted" style={{ fontSize: 16 }}>Pick a firm below. Passing accounts move to the next phase on their own.</p>
              </div>
            )}
            <div className="row between wrap" style={{ margin: '32px 0 14px', gap: 10 }}>
              <span className="eyebrow">Firms</span>
              <div className="row wrap" style={{ gap: 8 }}>
                <label className="search" style={{ width: 220 }}><Search size={14} className="muted" /><input placeholder="Search firms" value={q} onChange={(e) => setQ(e.target.value)} /></label>
                <Seg options={['All', 'CFD', 'Futures']} value={type} onChange={setType} />
              </div>
            </div>
            <div className="firm-grid">
              {firms.map((f, i) => {
                const sizes = f.programs.flatMap((p) => p.variants.flatMap((v) => v.sizes.map((s) => s.size))).filter(Boolean);
                return (
                  <motion.div key={f.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.02, ease }} className="firm-card" style={{ '--firm': f.color }}>
                    <div className="row between">
                      <div className="firm-logo">{f.short}</div>
                      <div className="row" style={{ gap: 6 }}>
                        {(f.custom || f.edited) && <span className="tag">{f.custom ? 'Yours' : 'Edited'}</span>}
                        <span className="tag">{f.type}</span>
                        <button className="icon-btn sm" aria-label={`Edit ${f.name}`} title="Edit firm" onClick={() => openModal('firm', { firmId: f.id })}><Pencil size={13} /></button>
                      </div>
                    </div>
                    <b className="firm-name">{f.name}</b>
                    <span className="muted small">{f.programs.map((p) => p.name).join(' · ')}</span>
                    {sizes.length > 0 && <span className="muted small">${kfmt(Math.min(...sizes))} to ${kfmt(Math.max(...sizes))}</span>}
                    <button className="btn sm" style={{ marginTop: 12 }} onClick={() => openModal('addAccount', { firmId: f.id })}><Plus size={14} /> Log account</button>
                  </motion.div>
                );
              })}
              <button className="firm-card add" onClick={() => openModal('firm')}><Plus size={22} /><b>Add a prop firm</b><span className="muted small">Programs, rules and prices</span></button>
            </div>
            <p className="dim small" style={{ marginTop: 16 }}>{FIRM_NOTE}</p>
          </motion.div>
        )}

        {tab === 'Analysis' && (
          <motion.div key="an" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {accounts.length === 0 ? <Empty icon={<Trophy />} title="No accounts yet">Add your prop accounts to see pass rates, cost per funded account and returns.</Empty> : <Analysis st={st} />}
          </motion.div>
        )}

        {tab === 'History' && (
          <motion.div key="hist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {history.length === 0 ? <Empty icon={<Trophy />} title="No closed accounts yet">Passed, failed and archived accounts land here with what each one cost and paid.</Empty> : (
              <div className="tile-grid" style={{ marginTop: 18 }}>
                {history.map((a, i) => <AccountTile key={a.id} a={a} m={accountMetrics(a, allTrades)} i={i} onClick={() => openModal('account', { id: a.id })} />)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Board>
  );
}

function Analysis({ st }) {
  const phaseData = st.phases.filter((p) => p.passed + p.failed > 0).map((p) => ({ name: p.phase, rate: Math.round(p.rate) }));
  return (
    <div className="col" style={{ gap: 16, marginTop: 18 }}>
      <div className="stat-row">
        {[
          ['Challenges bought', st.challenges],
          ['Avg days to pass', days(st.avgDaysToPass)],
          ['Avg trades to pass', days(st.avgTradesToPass)],
          ['Cost per funded', st.costPerFunded != null ? usd(st.costPerFunded) : '—'],
          ['Funded that paid out', pct(st.payoutRate)],
          ['Net', <Money key="n" value={st.net} cents={false} />],
        ].map(([l, v]) => <div key={l} className="card stat"><div className="label">{l}</div><div className="val sm">{v}</div></div>)}
      </div>
      <div className="grid rg-1" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 16 }}>
        <div className="card">
          <b>Pass rate by phase</b>
          {phaseData.length === 0 ? <p className="muted">Shows once an evaluation has passed or failed.</p> : (
            <div style={{ height: 220, marginTop: 10 }}>
              <ResponsiveContainer>
                <BarChart data={phaseData} margin={{ left: -18, right: 6 }}>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip formatter={(v) => `${v}%`} cursor={{ fill: 'var(--hover)' }} />
                  <Bar dataKey="rate" radius={[8, 8, 0, 0]}>{phaseData.map((d) => <Cell key={d.name} fill={d.rate >= 50 ? 'var(--green)' : 'var(--blue)'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <table className="tbl" style={{ marginTop: 8 }}>
            <thead><tr><th>Phase</th><th>Total</th><th>Passed</th><th>Failed</th><th>Active</th><th>Rate</th></tr></thead>
            <tbody>{st.phases.map((p) => <tr key={p.phase}><td>{p.phase}</td><td>{p.total}</td><td className="pos">{p.passed}</td><td className="neg">{p.failed}</td><td>{p.active}</td><td><b>{pct(p.rate)}</b></td></tr>)}</tbody>
          </table>
        </div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <b>By firm</b>
          <table className="tbl" style={{ marginTop: 10 }}>
            <thead><tr><th>Firm</th><th>Accounts</th><th>Pass rate</th><th>Funded</th><th>Spent</th><th>Payouts</th><th>Net</th></tr></thead>
            <tbody>
              {st.byFirm.map((f) => (
                <tr key={f.firm}><td><b>{f.firm}</b></td><td>{f.accounts}</td><td>{pct(f.passRate)}</td><td>{f.funded}</td><td>{usd(f.spent)}</td><td className="pos">{usd(f.payouts)}</td><td><Money value={f.net} cents={false} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AccountTile({ a, m, i, onClick }) {
  const label = a.status === 'active' ? (a.kind === 'funded' ? 'Funded' : a.phase) : a.status;
  return (
    <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.035 }} whileHover={{ y: -2 }} className={`card acct-tile s-${a.status}`} onClick={onClick}>
      <div className="row between"><span className="eyebrow">{a.firmName}</span><span className={`tag st-${a.status}`}>{label}</span></div>
      <div className="acct-name">{a.name}</div>
      <div className="muted small">{usd(a.size)} · {a.program} {a.variant}</div>
      <div className="row between" style={{ marginTop: 16 }}><span className="muted">Balance</span><b>{usd(m.balance)}</b></div>
      <div className="row between" style={{ marginTop: 6 }}><span className="muted">P&amp;L</span><b><Money value={m.pnl} cents={false} /></b></div>
      {m.progress != null && (
        <>
          <div className="bar" style={{ marginTop: 14 }}><motion.i initial={{ width: 0 }} animate={{ width: `${m.progress * 100}%` }} transition={{ duration: 0.9, ease }} style={{ background: m.hit ? 'var(--green)' : 'var(--blue)' }} /></div>
          <div className="row between muted small" style={{ marginTop: 6 }}><span>{Math.round(m.progress * 100)}% to target</span><span>{money(Math.max(0, m.targetBal - m.balance), { sign: false, cents: false })} left</span></div>
        </>
      )}
      <div className="row between muted small" style={{ marginTop: 10 }}>
        <span>{m.days}{a.rules?.minDays ? `/${a.rules.minDays}` : ''} days · {m.trades}{a.rules?.minTrades ? `/${a.rules.minTrades}` : ''} trades</span>
        <span>{m.breached ? <span className="neg">Rule breached</span> : m.buffer != null ? `${usd(m.buffer)} to max loss` : ''}</span>
      </div>
    </motion.button>
  );
}
