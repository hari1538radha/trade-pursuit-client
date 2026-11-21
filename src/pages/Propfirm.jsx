import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Plus, Search, Trophy } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Money, Reveal, Empty, ease } from '../components/ui.jsx';
import { FIRMS, FIRM_NOTE, accountMetrics } from '../lib/firms.js';
import { usd, kfmt, money } from '../lib/format.js';

export default function Propfirm() {
  const { accounts, allTrades, openModal } = useApp();
  const [tab, setTab] = useState('Accounts');
  const [type, setType] = useState('All');
  const [q, setQ] = useState('');
  const firms = FIRMS.filter((f) => (type === 'All' || f.type === type) && f.name.toLowerCase().includes(q.toLowerCase()));
  const stats = useMemo(() => {
    const spent = accounts.reduce((s, a) => s + (a.paid || 0), 0);
    const payouts = accounts.reduce((s, a) => s + (a.payouts || []).reduce((x, p) => x + p.amount, 0), 0);
    return { spent, payouts, passed: accounts.filter((a) => a.status === 'passed').length, failed: accounts.filter((a) => a.status === 'failed').length, active: accounts.filter((a) => a.status === 'active').length };
  }, [accounts]);
  const history = accounts.filter((a) => a.status !== 'active');

  return (
    <div className="page">
      <div className="row between">
        <Seg size="lg" options={['Accounts', 'History']} value={tab} onChange={setTab} />
        <button className="btn primary" onClick={() => openModal('addAccount')}><Plus size={16} /> Add account</button>
      </div>

      {accounts.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginTop: 22 }}>
          {[['Active', stats.active], ['Passed', stats.passed], ['Failed', stats.failed], ['Spent on evals', usd(stats.spent)], ['Payouts', <span key="p" className="pos">{usd(stats.payouts)}</span>]].map(([l, v], i) => (
            <Reveal key={l} delay={i * 0.04} className="card stat"><div className="label">{l}</div><div className="val" style={{ fontSize: 28 }}>{v}</div></Reveal>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {tab === 'Accounts' ? (
          <motion.div key="acc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {stats.active > 0 && (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', marginTop: 18 }}>
                {accounts.filter((a) => a.status === 'active').map((a, i) => <AccountTile key={a.id} a={a} m={accountMetrics(a, allTrades)} i={i} onClick={() => openModal('account', { id: a.id })} />)}
              </div>
            )}
            {stats.active === 0 && (
              <div style={{ textAlign: 'center', margin: '50px 0 30px' }}>
                <div className="empty" style={{ padding: 0 }}><div className="ico"><Building2 /></div></div>
                <h2 style={{ fontSize: 30, margin: '18px 0 6px', letterSpacing: '-.02em' }}>Track your prop firm challenges</h2>
                <p className="muted" style={{ fontSize: 17 }}>Pick a firm below to add your first account and track it against the firm's rules.</p>
              </div>
            )}
            <div className="row between" style={{ margin: '34px 0 14px' }}>
              <span className="eyebrow">Firms</span>
              <div className="row">
                <div className="row" className="search" style={{ width: 220 }}><Search size={14} className="muted" /><input className="input" style={{ background: 'none', padding: 8 }} placeholder="Search firms" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <Seg options={['All', 'CFD', 'Futures']} value={type} onChange={setType} />
              </div>
            </div>
            <motion.div layout className="firm-grid">
              <AnimatePresence>
                {firms.map((f, i) => (
                  <motion.div layout key={f.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.025, ease }}
                    className="firm-card" style={{ background: `linear-gradient(160deg, ${f.color} 0%, #121216 90%)`, cursor: 'default' }}>
                    <div className="row between" style={{ marginBottom: 'auto' }}><div className="firm-logo" style={{ margin: 0 }}>{f.short}</div><span className="tag" style={{ background: '#0006' }}>{f.type}</span></div>
                    <b style={{ fontSize: 21, marginTop: 16 }}>{f.name}</b>
                    <span className="muted" style={{ fontSize: 13 }}>{f.programs.map((p) => p.name).join(' · ')}</span>
                    <span className="muted" style={{ fontSize: 13 }}>${kfmt(Math.min(...f.programs.flatMap((p) => p.variants.flatMap((v) => v.sizes.map((s) => s.size)))))} to ${kfmt(Math.max(...f.programs.flatMap((p) => p.variants.flatMap((v) => v.sizes.map((s) => s.size)))))}</span>
                    <motion.button whileTap={{ scale: 0.97 }} className="btn" style={{ marginTop: 12, background: '#ffffff14', borderColor: '#ffffff20' }} onClick={() => openModal('addAccount', { firmId: f.id })}><Plus size={15} /> Log your eval</motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
            <p className="dim" style={{ fontSize: 12.5, marginTop: 16 }}>{FIRM_NOTE} Firm not listed? Use “Add account → Other firm”.</p>
          </motion.div>
        ) : (
          <motion.div key="hist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {history.length === 0 ? <Empty icon={<Trophy />} title="No closed accounts yet">Passed, failed and archived accounts land here with what each one cost and paid.</Empty> : (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', marginTop: 18 }}>
                {history.map((a, i) => <AccountTile key={a.id} a={a} m={accountMetrics(a, allTrades)} i={i} onClick={() => openModal('account', { id: a.id })} />)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountTile({ a, m, i, onClick }) {
  const statusColor = { passed: 'var(--green)', failed: 'var(--red)', archived: 'var(--muted)', active: 'var(--blue)' }[a.status];
  return (
    <motion.button layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -3 }} className="card" style={{ textAlign: 'left', background: 'linear-gradient(180deg,var(--blue-soft),transparent 60%), var(--panel)' }} onClick={onClick}>
      <div className="row between"><span className="eyebrow">{a.firmName}</span><span className="tag" style={{ color: statusColor }}>{a.status === 'active' ? (a.kind === 'funded' ? 'Funded' : a.phase) : a.status}</span></div>
      <div style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 2px' }}>{a.name}</div>
      <div className="muted" style={{ fontSize: 13 }}>{usd(a.size)} · {a.program} {a.variant}</div>
      <div className="row between" style={{ marginTop: 18 }}><span className="muted">Balance</span><b>{usd(m.balance)}</b></div>
      <div className="row between" style={{ marginTop: 6 }}><span className="muted">P&amp;L</span><b><Money value={m.pnl} cents={false} /></b></div>
      {m.progress != null && (
        <>
          <div className="bar" style={{ marginTop: 14, height: 6 }}><motion.i initial={{ width: 0 }} animate={{ width: `${m.progress * 100}%` }} transition={{ duration: 0.9, ease }} style={{ background: m.hit ? 'var(--green)' : 'var(--blue)' }} /></div>
          <div className="row between muted" style={{ fontSize: 12, marginTop: 6 }}><span>{Math.round(m.progress * 100)}% to target</span><span>{money(Math.max(0, m.targetBal - m.balance), { sign: false, cents: false })} left</span></div>
        </>
      )}
      <div className="row between muted" style={{ fontSize: 12, marginTop: 10 }}>
        <span>{m.days} days · {m.trades} trades</span>
        <span>{m.breached ? <span className="neg">Rule breached</span> : m.buffer != null ? `${usd(m.buffer)} to max loss` : ''}</span>
      </div>
    </motion.button>
  );
}
