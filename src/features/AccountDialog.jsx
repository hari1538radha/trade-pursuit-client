import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Trophy, XCircle, Archive, RotateCcw, ArrowRight } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Dialog, Field, Seg, Money, ease } from '../components/ui.jsx';
import { accountMetrics, mergeFirms, nextAccountBody } from '../lib/firms.js';
import { usd, money } from '../lib/format.js';
import { today } from '../lib/dates.js';

const n = (v) => (v === '' || v == null ? null : parseFloat(v));

export default function AccountDialog({ open, onClose, id }) {
  const { accounts, allTrades, updateAccount, addAccounts, removeAccount, notify, confirmAsk, settings, openModal } = useApp();
  const a = accounts.find((x) => x.id === id);
  const [edit, setEdit] = useState(null);
  const [pay, setPay] = useState({ amount: '', date: today() });
  useEffect(() => {
    if (a) setEdit({ name: a.name, firmName: a.firmName || '', size: a.size, phase: a.phase, kind: a.kind, paid: a.paid ?? 0, purchasedAt: a.purchasedAt || (a.createdAt || '').slice(0, 10), ...a.rules });
    setPay({ amount: '', date: today() });
  }, [id, open]); // eslint-disable-line
  if (!a || !edit) return <Dialog open={open} onClose={onClose} />;
  const m = accountMetrics(a, allTrades);
  const set = (k) => (e) => setEdit({ ...edit, [k]: e?.target ? e.target.value : e });
  const prev = a.prevAccount && accounts.find((x) => x.id === a.prevAccount);
  const next = accounts.find((x) => x.prevAccount === a.id);

  const save = async () => {
    if (!edit.name.trim() || !n(edit.size)) return notify('Name and size are required');
    await updateAccount(a.id, {
      name: edit.name, firmName: edit.firmName, size: n(edit.size), phase: edit.kind === 'funded' ? 'Funded' : edit.phase, kind: edit.kind,
      paid: n(edit.paid) || 0, purchasedAt: edit.purchasedAt || undefined,
      rules: { profitTarget: n(edit.profitTarget), maxLoss: n(edit.maxLoss), maxLossType: edit.maxLossType, dailyLoss: n(edit.dailyLoss), minDays: n(edit.minDays) || 0, minTrades: n(edit.minTrades) || 0, consistency: edit.consistency || null },
    });
    notify('Account saved');
  };
  const markPassed = async () => {
    await updateAccount(a.id, { status: 'passed', passedAt: today() });
    if (a.kind === 'eval' && !next) {
      const body = nextAccountBody(a, mergeFirms(settings.customFirms), today());
      await addAccounts(body);
      notify(`Passed 🎉 ${body.phase} account added`);
    } else notify('Marked passed 🎉');
    onClose();
  };
  const payouts = a.payouts || [];
  const savePayouts = (list) => updateAccount(a.id, { payouts: list });
  const range = m.failBelow != null && m.targetBal ? (m.balance - m.failBelow) / (m.targetBal - m.failBelow) : null;
  const needTrades = a.rules?.minTrades || 0;

  return (
    <Dialog open={open} onClose={onClose} title={a.name} wide>
      <div className="muted" style={{ marginTop: -12, marginBottom: 18 }}>
        {a.firmName} · {a.program} {a.variant} · {usd(a.size)} · {a.kind === 'funded' ? 'Funded' : a.phase}
        {a.purchasedAt && <> · bought {a.purchasedAt}</>}
      </div>
      {(prev || next) && (
        <div className="row wrap chain" style={{ gap: 6, marginBottom: 14 }}>
          {prev && <button className="chip" onClick={() => openModal('account', { id: prev.id })}>{prev.phase} · {prev.status}</button>}
          {prev && <ArrowRight size={14} className="muted" />}
          <span className="chip on">{a.phase}</span>
          {next && <ArrowRight size={14} className="muted" />}
          {next && <button className="chip" onClick={() => openModal('account', { id: next.id })}>{next.phase} · {next.status}</button>}
        </div>
      )}
      <div className="grid rg-1" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="card mini"><div className="muted">Balance</div><b>{usd(m.balance)}</b></div>
        <div className="card mini"><div className="muted">P&amp;L</div><b><Money value={m.pnl} /></b></div>
        <div className="card mini"><div className="muted">Days{a.rules?.minDays ? ` (min ${a.rules.minDays})` : ''}</div><b>{m.days}</b></div>
        <div className="card mini"><div className="muted">Trades{needTrades ? ` (min ${needTrades})` : ''}</div><b>{m.trades}</b></div>
      </div>
      {range != null && (
        <div style={{ margin: '22px 0 6px' }}>
          <div className="track"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, range)) * 100}%` }} transition={{ duration: 0.9, ease }} className={m.breached ? 'fill bad' : 'fill'} /></div>
          <div className="prog-legend"><b>{usd(m.failBelow)}<small>Fail below</small></b><b style={{ textAlign: 'center' }}>{usd(m.balance)}<small>Now</small></b><b style={{ textAlign: 'right' }}>{usd(m.targetBal)}<small>Target</small></b></div>
        </div>
      )}
      {m.breached && a.status === 'active' && (
        <div className="notice bad row between wrap">
          <span>{m.dailyBreach ? 'A day crossed the daily loss limit.' : 'Balance is at or below the max loss line.'} Mark it failed if the firm closed it.</span>
          <button className="btn sm danger" onClick={async () => { await updateAccount(a.id, { status: 'failed', failedAt: today() }); notify('Marked failed'); onClose(); }}><XCircle size={14} /> Mark failed</button>
        </div>
      )}
      {a.status === 'active' && a.kind === 'eval' && !m.breached && m.targetBal != null && !m.hit && (
        <p className="muted">Passes automatically once balance reaches {usd(m.targetBal)} with {a.rules?.minDays || 0}+ trading days{needTrades ? ` and ${needTrades}+ trades` : ''}.</p>
      )}
      {m.buffer != null && !m.breached && <p className="muted">Room before max loss: <b style={{ color: 'var(--text)' }}>{usd(m.buffer)}</b>{a.rules?.dailyLoss ? <> · Daily limit {usd(a.rules.dailyLoss)}</> : null}</p>}

      <div className="divider" />
      <b>Account details</b>
      <div className="fgrid" style={{ marginTop: 10 }}>
        <Field label="Name"><input className="input" value={edit.name} onChange={set('name')} /></Field>
        <Field label="Firm"><input className="input" value={edit.firmName} onChange={set('firmName')} /></Field>
        <Field label="Size ($)"><input className="input" inputMode="decimal" value={edit.size ?? ''} onChange={set('size')} /></Field>
        <Field label="Type"><Seg options={[{ value: 'eval', label: 'Evaluation' }, { value: 'funded', label: 'Funded' }, { value: 'personal', label: 'Personal' }]} value={edit.kind} onChange={set('kind')} /></Field>
        {edit.kind === 'eval' && <Field label="Phase"><Seg options={['Phase 1', 'Phase 2', 'Phase 3']} value={edit.phase} onChange={set('phase')} /></Field>}
        <Field label="Fee paid ($)"><input className="input" inputMode="decimal" value={edit.paid ?? ''} onChange={set('paid')} /></Field>
        <Field label="Bought on"><input className="input" type="date" value={edit.purchasedAt || ''} onChange={set('purchasedAt')} /></Field>
      </div>
      <b style={{ display: 'block', marginTop: 16 }}>Rules</b>
      <div className="fgrid" style={{ marginTop: 10 }}>
        <Field label="Profit target ($)"><input className="input" value={edit.profitTarget ?? ''} onChange={set('profitTarget')} /></Field>
        <Field label="Max loss ($)"><input className="input" value={edit.maxLoss ?? ''} onChange={set('maxLoss')} /></Field>
        <Field label="Daily loss ($)"><input className="input" value={edit.dailyLoss ?? ''} onChange={set('dailyLoss')} /></Field>
        <Field label="Min trading days"><input className="input" value={edit.minDays ?? ''} onChange={set('minDays')} /></Field>
        <Field label="Min trades"><input className="input" value={edit.minTrades ?? ''} onChange={set('minTrades')} /></Field>
        <Field label="Max loss type"><Seg options={['Static', 'EOD trailing', 'Intraday trailing']} value={edit.maxLossType || 'Static'} onChange={set('maxLossType')} /></Field>
      </div>
      <button className="btn primary" style={{ width: '100%', marginTop: 14 }} onClick={save}>Save changes</button>

      {a.kind === 'funded' && (
        <>
          <div className="divider" />
          <div className="row between"><b>Payouts</b><span className="muted">{money(payouts.reduce((s, p) => s + p.amount, 0))} total</span></div>
          {payouts.length > 0 && (
            <div className="col" style={{ gap: 6, marginTop: 10 }}>
              {payouts.map((p, i) => (
                <div key={i} className="row list-row">
                  <input className="input sm" type="date" value={p.date} onChange={(e) => savePayouts(payouts.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
                  <input className="input sm grow" inputMode="decimal" defaultValue={p.amount} onBlur={(e) => { const v = n(e.target.value); if (v && v !== p.amount) savePayouts(payouts.map((x, j) => (j === i ? { ...x, amount: v } : x))); }} />
                  <button className="icon-btn" aria-label="Delete payout" onClick={async () => { if (await confirmAsk(`Delete the ${usd(p.amount)} payout from ${p.date}?`)) savePayouts(payouts.filter((_, j) => j !== i)); }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <form className="row" style={{ marginTop: 10 }} onSubmit={async (e) => { e.preventDefault(); const v = n(pay.amount); if (!v) return; await savePayouts([...payouts, { amount: v, date: pay.date || today() }]); setPay({ amount: '', date: today() }); notify('Payout logged'); }}>
            <input className="input" type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} style={{ maxWidth: 170 }} />
            <input className="input grow" placeholder="Amount received ($)" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            <button className="btn">Log payout</button>
          </form>
        </>
      )}
      <div className="divider" />
      <div className="row wrap" style={{ gap: 8 }}>
        {a.status === 'active' ? (
          <>
            <button className="btn sm" onClick={markPassed}><Trophy size={14} /> Passed{a.kind === 'eval' && !next ? ' → next phase' : ''}</button>
            <button className="btn sm" onClick={async () => { await updateAccount(a.id, { status: 'failed', failedAt: today() }); notify('Marked failed'); onClose(); }}><XCircle size={14} /> Failed</button>
            <button className="btn sm" onClick={async () => { await updateAccount(a.id, { status: 'archived' }); onClose(); }}><Archive size={14} /> Archive</button>
          </>
        ) : <button className="btn sm" onClick={() => updateAccount(a.id, { status: 'active', passedAt: null, failedAt: null })}><RotateCcw size={14} /> Reopen</button>}
        <span className="grow" />
        <button className="btn sm danger" onClick={async () => { if (await confirmAsk('Delete this account? Trades stay in your journal.')) { await removeAccount(a.id); onClose(); } }}><Trash2 size={14} /> Delete</button>
      </div>
    </Dialog>
  );
}
