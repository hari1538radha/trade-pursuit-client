import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Trophy, XCircle, Archive, RotateCcw } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Dialog, Field, Seg, Money, ease } from '../components/ui.jsx';
import { accountMetrics } from '../lib/firms.js';
import { usd, money } from '../lib/format.js';
import { today } from '../lib/dates.js';

export default function AccountDialog({ open, onClose, id }) {
  const { accounts, allTrades, updateAccount, removeAccount, notify, confirmAsk } = useApp();
  const a = accounts.find((x) => x.id === id);
  const [edit, setEdit] = useState(null);
  const [payout, setPayout] = useState('');
  useEffect(() => { if (a) setEdit({ name: a.name, phase: a.phase, ...a.rules }); }, [id, open]); // eslint-disable-line
  if (!a || !edit) return <Dialog open={open} onClose={onClose} />;
  const m = accountMetrics(a, allTrades);
  const n = (v) => (v === '' || v == null ? null : parseFloat(v));
  const saveRules = async () => {
    await updateAccount(a.id, { name: edit.name, phase: edit.phase, rules: { profitTarget: n(edit.profitTarget), maxLoss: n(edit.maxLoss), maxLossType: edit.maxLossType, dailyLoss: n(edit.dailyLoss), minDays: n(edit.minDays) || 0, consistency: edit.consistency || null } });
    notify('Saved');
  };
  const range = m.failBelow != null && m.targetBal ? (m.balance - m.failBelow) / (m.targetBal - m.failBelow) : null;
  return (
    <Dialog open={open} onClose={onClose} title={a.name}>
      <div className="muted" style={{ marginTop: -12, marginBottom: 18 }}>{a.firmName} · {a.program} {a.variant} · {usd(a.size)} · {a.kind === 'funded' ? 'Funded' : a.phase}</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="card" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>Balance</div><b style={{ fontSize: 22 }}>{usd(m.balance)}</b></div>
        <div className="card" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>P&amp;L</div><b style={{ fontSize: 22 }}><Money value={m.pnl} /></b></div>
        <div className="card" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>Days / trades</div><b style={{ fontSize: 22 }}>{m.days} / {m.trades}</b></div>
      </div>
      {range != null && (
        <div style={{ margin: '22px 0 6px' }}>
          <div style={{ height: 8, borderRadius: 8, background: 'var(--panel3)', position: 'relative' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, range)) * 100}%` }} transition={{ duration: 0.9, ease }} style={{ height: '100%', borderRadius: 8, background: m.breached ? 'var(--red)' : 'linear-gradient(90deg,#2337c6,#4ade80)' }} />
          </div>
          <div className="prog-legend"><b>{usd(m.failBelow)}<small>Fail below</small></b><b style={{ textAlign: 'center' }}>{usd(m.balance)}<small>Now</small></b><b style={{ textAlign: 'right' }}>{usd(m.targetBal)}<small>Target</small></b></div>
        </div>
      )}
      {m.breached && <p className="neg">{m.dailyBreach ? 'A day crossed the daily loss limit.' : 'Balance is at or below the max loss line.'} Mark it failed if the firm closed it.</p>}
      {m.hit && <p className="pos">Target reached with {m.days} trading days. Mark it passed when the firm confirms.</p>}
      {m.buffer != null && !m.breached && <p className="muted">Room before max loss: <b style={{ color: 'var(--text)' }}>{usd(m.buffer)}</b>{a.rules?.dailyLoss ? <> · Daily limit {usd(a.rules.dailyLoss)}</> : null}</p>}

      <div className="divider" />
      <div className="fgrid">
        <Field label="Name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
        <Field label="Phase"><input className="input" value={edit.phase} onChange={(e) => setEdit({ ...edit, phase: e.target.value })} /></Field>
        <Field label="Profit target ($)"><input className="input" value={edit.profitTarget ?? ''} onChange={(e) => setEdit({ ...edit, profitTarget: e.target.value })} /></Field>
        <Field label="Max loss ($)"><input className="input" value={edit.maxLoss ?? ''} onChange={(e) => setEdit({ ...edit, maxLoss: e.target.value })} /></Field>
        <Field label="Daily loss ($)"><input className="input" value={edit.dailyLoss ?? ''} onChange={(e) => setEdit({ ...edit, dailyLoss: e.target.value })} /></Field>
        <Field label="Min days"><input className="input" value={edit.minDays ?? ''} onChange={(e) => setEdit({ ...edit, minDays: e.target.value })} /></Field>
      </div>
      <div style={{ marginTop: 14 }}><Seg options={['Static', 'EOD trailing', 'Intraday trailing']} value={edit.maxLossType || 'Static'} onChange={(v) => setEdit({ ...edit, maxLossType: v })} /></div>
      <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={saveRules}>Save rules</button>

      {a.kind === 'funded' && (
        <>
          <div className="divider" />
          <b>Payouts</b> <span className="muted">· {money((a.payouts || []).reduce((s, p) => s + p.amount, 0))} total</span>
          <form className="row" style={{ marginTop: 10 }} onSubmit={async (e) => { e.preventDefault(); const v = parseFloat(payout); if (!v) return; await updateAccount(a.id, { payouts: [...(a.payouts || []), { amount: v, date: today() }] }); setPayout(''); notify('Payout logged'); }}>
            <input className="input" placeholder="Amount received" value={payout} onChange={(e) => setPayout(e.target.value)} /><button className="btn">Log payout</button>
          </form>
        </>
      )}
      <div className="divider" />
      <div className="row wrap" style={{ gap: 8 }}>
        {a.status === 'active' ? (
          <>
            <button className="btn sm" onClick={async () => { await updateAccount(a.id, { status: 'passed' }); notify('Marked passed 🎉'); onClose(); }}><Trophy size={14} /> Passed</button>
            <button className="btn sm" onClick={async () => { await updateAccount(a.id, { status: 'failed' }); notify('Marked failed'); onClose(); }}><XCircle size={14} /> Failed</button>
            <button className="btn sm" onClick={async () => { await updateAccount(a.id, { status: 'archived' }); onClose(); }}><Archive size={14} /> Archive</button>
          </>
        ) : <button className="btn sm" onClick={() => updateAccount(a.id, { status: 'active' })}><RotateCcw size={14} /> Reopen</button>}
        <span className="grow" />
        <button className="btn sm danger" onClick={async () => { if (await confirmAsk('Delete this account? Trades stay in your journal.')) { await removeAccount(a.id); onClose(); } }}><Trash2 size={14} /> Delete</button>
      </div>
    </Dialog>
  );
}
