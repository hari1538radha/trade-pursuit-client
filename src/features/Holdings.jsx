import { useEffect, useMemo, useState } from 'react';
import { PiggyBank, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Reveal, Dialog, Field, Seg } from '../components/ui.jsx';
import { fmtInr, ymdOf, holdingNow, holdingsSummary, emiFor, grow } from '../lib/personal.js';
import { cls } from '../lib/format.js';

const COMP = [{ value: 'simple', label: 'Simple' }, { value: 'yearly', label: 'Yearly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'monthly', label: 'Monthly' }];
const term = (m) => (!m ? 'No fixed term' : m % 12 ? `${m} months` : `${m / 12} year${m === 12 ? '' : 's'}`);

/** Money invested and loans taken: value and gains, EMI and interest (₹) */
export default function Holdings() {
  const { api, notify } = useApp();
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const load = () => api.personal.list('money/holdings').then((r) => setItems(r.items)).catch((e) => notify(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line
  const sum = useMemo(() => holdingsSummary(items || []), [items]);
  if (!items) return null;

  const save = async (f) => {
    try {
      const { id, user, createdAt, updatedAt, ...b } = f;
      Object.assign(b, { principal: Number(b.principal), rate: Number(b.rate) || 0, months: b.months === '' || b.months == null ? null : Math.round(Number(b.months)) });
      if (id) await api.personal.update('money/holdings', id, b); else await api.personal.create('money/holdings', b);
      setEdit(null); load();
    } catch (e) { notify(e.message); }
  };
  const list = items.filter((h) => showClosed || !h.closed);

  return (
    <Reveal className="card" style={{ marginTop: 16 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div>
          <h3 className="row" style={{ margin: 0, fontSize: 17 }}><PiggyBank size={17} /> Investments and loans</h3>
          <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>What you've put to work and what you've borrowed, with the interest on each.</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" onClick={() => setEdit({ kind: 'loan', name: '', where: '', principal: '', rate: '', compounding: 'simple', start: ymdOf(), months: 12, note: '' })}><Plus size={14} /> Loan</button>
          <button className="btn sm primary" onClick={() => setEdit({ kind: 'investment', name: '', where: '', principal: '', rate: '', compounding: 'yearly', start: ymdOf(), months: '', note: '' })}><Plus size={14} /> Investment</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="stat-row compact" style={{ marginTop: 14 }}>
          {[
            ['Invested', fmtInr(sum.invested), `worth ${fmtInr(sum.value)} today`],
            ['Gains so far', <span key="g" className={sum.gain >= 0 ? 'pos' : 'neg'}>{fmtInr(sum.gain, true)}</span>, `≈ ${fmtInr(sum.earnYear)} a year`],
            ['Loans owed', fmtInr(sum.owed), sum.monthlyEmi ? `${fmtInr(sum.monthlyEmi)} EMI a month` : ''],
            ['Interest paid so far', <span key="i" className="neg">{fmtInr(sum.interestPaid)}</span>, `≈ ${fmtInr(sum.payYear)} a year now`],
            ['Net (invested − owed)', <span key="n" className={sum.netWorth >= 0 ? 'pos' : 'neg'}>{fmtInr(sum.netWorth, true)}</span>, sum.earnYear || sum.payYear ? `interest: ${fmtInr(sum.earnYear - sum.payYear, true)} a year` : ''],
          ].map(([l, v, sub]) => <div key={l} className="stat mini-stat"><div className="label">{l}</div><div className="val">{v}</div>{sub && <div className="sub">{sub}</div>}</div>)}
        </div>
      )}

      <div className="holding-grid" style={{ marginTop: 14 }}>
        {list.map((h) => {
          const n = holdingNow(h);
          const inv = h.kind === 'investment';
          const pct = h.months ? Math.min(100, (n.elapsed / h.months) * 100) : null;
          return (
            <button key={h.id} className={cls('holding', inv ? 'inv' : 'loan', h.closed && 'closed')} onClick={() => setEdit(h)}>
              <div className="row between">
                <span className="row" style={{ gap: 6 }}>{inv ? <TrendingUp size={15} /> : <TrendingDown size={15} />}<b>{h.name}</b></span>
                <span className="tag">{h.closed ? 'Closed' : `${h.rate}% · ${!inv && h.months ? 'EMI' : COMP.find((c) => c.value === (h.compounding || 'simple'))?.label}`}</span>
              </div>
              <div className="muted small" style={{ marginTop: 2 }}>{h.where || (inv ? 'Investment' : 'Loan')} · from {h.start} · {term(h.months)}</div>
              {inv ? (
                <div className="kv">
                  <span>Put in</span><b>{fmtInr(h.principal)}</b>
                  <span>Worth now</span><b>{fmtInr(n.value)}</b>
                  <span>Gain</span><b className="pos">{fmtInr(n.gain, true)}</b>
                  {n.maturity != null && <><span>At maturity</span><b>{fmtInr(n.maturity)} <span className="muted">({fmtInr(n.maturityGain, true)})</span></b></>}
                </div>
              ) : (
                <div className="kv">
                  <span>Borrowed</span><b>{fmtInr(h.principal)}</b>
                  {n.emi != null && <><span>EMI</span><b>{fmtInr(n.emi)}/month</b></>}
                  <span>Still owed</span><b>{fmtInr(n.owed)}</b>
                  {n.emi != null ? <><span>Interest paid</span><b className="neg">{fmtInr(n.interestPaid)} <span className="muted">of {fmtInr(n.totalInterest)}</span></b></> : <><span>Interest built up</span><b className="neg">{fmtInr(n.accrued)}</b></>}
                </div>
              )}
              {pct != null && <div className="emi-bar"><i style={{ width: `${pct}%` }} /></div>}
            </button>
          );
        })}
        {!items.length && <p className="muted" style={{ margin: 0 }}>Add an FD, SIP, gold or a loan to see gains and interest here.</p>}
      </div>
      {items.some((h) => h.closed) && <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setShowClosed((v) => !v)}>{showClosed ? 'Hide' : 'Show'} closed ({items.filter((h) => h.closed).length})</button>}
      <p className="dim" style={{ fontSize: 12, margin: '10px 0 0' }}>Loans with a term use a standard EMI (reducing balance). Market-linked investments (stocks, mutual funds) use the rate you expect, so treat their value as an estimate.</p>
      {edit && <HoldingDialog item={edit} onClose={() => setEdit(null)} onSave={save} onDelete={async (id) => { await api.personal.remove('money/holdings', id); setEdit(null); load(); }} />}
    </Reveal>
  );
}

function HoldingDialog({ item, onClose, onSave, onDelete }) {
  const [f, setF] = useState(item);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const inv = f.kind === 'investment';
  const P = +f.principal || 0, r = +f.rate || 0, N = +f.months || 0;
  const preview = P > 0 ? (inv
    ? (N ? `After ${term(N)}: ${fmtInr(grow(P, r, N, f.compounding))} (${fmtInr(grow(P, r, N, f.compounding) - P, true)})` : `After 1 year: ${fmtInr(grow(P, r, 12, f.compounding))}`)
    : (N ? `EMI ${fmtInr(emiFor(P, r, N))}/month · total interest ${fmtInr(emiFor(P, r, N) * N - P)}` : `Interest after 1 year: ${fmtInr(grow(P, r, 12, f.compounding) - P)}`)) : '';
  return (
    <Dialog open onClose={onClose}>
      <h2 style={{ marginTop: 0, fontSize: 21 }}>{f.id ? 'Edit' : 'Add'} {inv ? 'investment' : 'loan'}</h2>
      <Seg options={[{ value: 'investment', label: 'Investment' }, { value: 'loan', label: 'Loan taken' }]} value={f.kind} onChange={set('kind')} />
      <div className="fgrid" style={{ marginTop: 14 }}>
        <Field label="Name"><input className="input" autoFocus value={f.name} onChange={set('name')} placeholder={inv ? 'FD, SIP, gold…' : 'Personal loan, from a friend…'} /></Field>
        <Field label={inv ? 'Where' : 'Lender'}><input className="input" value={f.where || ''} onChange={set('where')} placeholder={inv ? 'Bank / app' : 'Bank / person'} /></Field>
        <Field label={inv ? 'Amount invested (₹)' : 'Amount borrowed (₹)'}><input className="input" type="number" inputMode="decimal" value={f.principal} onChange={set('principal')} /></Field>
        <Field label="Interest rate (% a year)"><input className="input" type="number" inputMode="decimal" step="0.01" value={f.rate} onChange={set('rate')} /></Field>
        <Field label="Start date"><input className="input" type="date" value={f.start} onChange={set('start')} /></Field>
        <Field label="Term (months)" hint={inv ? 'Leave empty if open-ended' : 'Leave empty for a loan with no EMI'}><input className="input" type="number" min={1} value={f.months ?? ''} onChange={set('months')} /></Field>
      </div>
      {!(f.kind === 'loan' && N) && <Field label="Interest is"><Seg options={COMP} value={f.compounding || 'simple'} onChange={set('compounding')} /></Field>}
      {preview && <div className="notice" style={{ marginTop: 10 }}>{preview}</div>}
      <Field label="Note"><input className="input" value={f.note || ''} onChange={set('note')} /></Field>
      {f.id && <label className="row small" style={{ gap: 6, marginTop: 10 }}><input type="checkbox" checked={!!f.closed} onChange={set('closed')} /> Closed (withdrawn or fully repaid)</label>}
      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        {f.id && <button className="btn danger" onClick={() => onDelete(f.id)}><Trash2 size={14} /> Delete</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!f.name || !(P > 0) || !f.start || r < 0 || r > 100} onClick={() => onSave(f)}>Save</button>
      </div>
    </Dialog>
  );
}
