import { useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, ChevronLeft, ChevronRight, Trash2, Check, Landmark, Search, Download, CreditCard } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, PieChart, Pie } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Reveal, Dialog, Field } from '../components/ui.jsx';
import { moneyMonth, emiStatus, fmtInr, ymOf, ymdOf, addMonths, monthLabel, EXPENSE_CATS, INCOME_CATS, PAY_METHODS, isCredit } from '../lib/personal.js';
import { downloadEntries } from '../lib/moneyExport.js';
import Holdings from '../features/Holdings.jsx';
import { cls } from '../lib/format.js';
import Board from '../components/Board.jsx';

const AX = { tickLine: false, axisLine: false, tick: { fontSize: 12, fill: 'var(--text2)' } };
const TT = { contentStyle: { background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 10, fontSize: 13 }, formatter: (v, n) => [fmtInr(v), n] };
const PALETTE = ['#4f8cff', '#f0616d', '#2fbf8f', '#f5a524', '#a78bfa', '#14b8a6', '#ec4899', '#94a3b8', '#eab308', '#22d3ee', '#f97316', '#84cc16', '#e879f9', '#64748b', '#ef4444'];
const kInr = (v) => (Math.abs(v) >= 1e5 ? `₹${(v / 1e5).toFixed(1)}L` : Math.abs(v) >= 1e3 ? `₹${(v / 1e3).toFixed(0)}k` : `₹${Math.round(v)}`);

/** Admin only: monthly expenses, income, EMIs and eval spend in one place (₹) */
export default function Money() {
  const { api, notify, settings, updateUser } = useApp();
  const fin = settings.finance || {};
  const usdInr = fin.usdInr || 94.4;
  const budget = fin.budget || null;
  const [entries, setEntries] = useState(null);
  const [emis, setEmis] = useState([]);
  const [buys, setBuys] = useState([]);
  const [ym, setYm] = useState(ymOf());
  const [edit, setEdit] = useState(null);
  const [emiEdit, setEmiEdit] = useState(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [dl, setDl] = useState(false);
  const load = () => Promise.all([api.personal.list('money/entries'), api.personal.list('money/emis'), api.personal.list('props/purchases')])
    .then(([a, b, c]) => { setEntries(a.items); setEmis(b.items); setBuys(c.items); }).catch((e) => notify(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const m = useMemo(() => (entries ? moneyMonth({ entries, emis, purchases: buys, ym, usdInr }) : null), [entries, emis, buys, ym, usdInr]);
  const trend = useMemo(() => (entries ? Array.from({ length: 6 }, (_, i) => addMonths(ym, i - 5)).map((k) => { const x = moneyMonth({ entries, emis, purchases: buys, ym: k, usdInr }); return { m: monthLabel(k), Income: Math.round(x.income), Expenses: Math.round(x.expenses), EMIs: Math.round(x.emiTotal), Evals: Math.round(x.evalInr), Saved: Math.round(x.saved) }; }) : []), [entries, emis, buys, ym, usdInr]);

  const save = async (item) => {
    try {
      const { id, user, createdAt, updatedAt, ...b } = item;
      b.amount = Number(b.amount);
      if (id) await api.personal.update('money/entries', id, b); else await api.personal.create('money/entries', b);
      setEdit(null); load();
    } catch (e) { notify(e.message); }
  };
  const saveEmi = async (item) => {
    try {
      const { id, user, createdAt, updatedAt, ...b } = item;
      Object.assign(b, { amount: Number(b.amount), months: Number(b.months), dueDay: Number(b.dueDay) || 1 });
      if (id) await api.personal.update('money/emis', id, b); else await api.personal.create('money/emis', b);
      setEmiEdit(null); load();
    } catch (e) { notify(e.message); }
  };
  const togglePaid = async (e) => {
    const paid = (e.paid || []).includes(ym) ? e.paid.filter((x) => x !== ym) : [...(e.paid || []), ym];
    await api.personal.update('money/emis', e.id, { paid }); load();
  };

  if (!m) return <div className="page"><p className="muted">Loading…</p></div>;
  const list = m.entries.filter((e) => (kind === 'all' || e.kind === kind) && (!q || `${e.category} ${e.note} ${e.method}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
  const overBudget = budget && m.outgo > budget;
  const onCredit = m.entries.filter((e) => e.kind === 'expense' && isCredit(e.method)).reduce((s, e) => s + e.amount, 0);

  return (
    <Board id="money" className="page wide-page">
      <div data-fixed className="page-head row between wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><Wallet size={22} /> Money</h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Expenses, income, EMIs and eval spend, month by month. Only you (admin) can see this.</div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="row month-pick">
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <b style={{ minWidth: 92, textAlign: 'center' }}>{new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b>
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, 1))} aria-label="Next month" disabled={ym >= ymOf()}><ChevronRight size={16} /></button>
          </div>
          <div className="dl-wrap">
            <button className="btn sm" onClick={() => setDl((v) => !v)} aria-expanded={dl}><Download size={14} /> Download</button>
            {dl && (
              <div className="menu" onMouseLeave={() => setDl(false)}>
                {[['month', 'csv', `${monthLabel(ym)} · CSV (Excel)`], ['month', 'pdf', `${monthLabel(ym)} · PDF`], ['all', 'csv', 'All months · CSV (Excel)'], ['all', 'pdf', 'All months · PDF']].map(([scope, fmt, label]) => (
                  <button key={label} onClick={() => { setDl(false); downloadEntries({ entries, ym: scope === 'month' ? ym : null, kind, fmt }); }}>{label}</button>
                ))}
                <div className="dim small" style={{ padding: '6px 10px 2px' }}>Uses the {kind === 'all' ? 'All' : kind === 'expense' ? 'Expenses' : 'Income'} filter below.</div>
              </div>
            )}
          </div>
          <button className="btn sm" onClick={() => setEdit({ kind: 'income', date: ymdOf(), amount: '', category: 'Salary', method: 'Bank', note: '' })}><Plus size={14} /> Income</button>
          <button className="btn sm primary" onClick={() => setEdit({ kind: 'expense', date: ymdOf(), amount: '', category: 'Food', method: 'UPI', note: '' })}><Plus size={14} /> Expense</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', marginTop: 16 }}>
        {[
          ['Income', fmtInr(m.income), `${m.entries.filter((e) => e.kind === 'income').length} entries`, 'var(--green)'],
          ['Expenses', fmtInr(m.expenses), `${m.entries.filter((e) => e.kind === 'expense').length} entries${onCredit ? ` · ${fmtInr(onCredit)} on credit cards` : ''}`],
          ['EMIs due', fmtInr(m.emiTotal), `${m.emiDue.length} active · ${m.emiDue.filter((e) => (e.paid || []).includes(ym)).length} paid`],
          ['Spent on evals', fmtInr(m.evalInr), `${m.evalCount} account${m.evalCount === 1 ? '' : 's'} · ₹${usdInr}/$`],
          ['Total out', fmtInr(m.outgo), budget ? `${Math.round((m.outgo / budget) * 100)}% of ${fmtInr(budget)} budget` : 'Set a budget below', overBudget ? 'var(--red)' : undefined],
          ['Saved', fmtInr(m.saved, true), m.savingsRate != null ? `${m.savingsRate.toFixed(0)}% of income` : 'No income logged', m.saved >= 0 ? 'var(--green)' : 'var(--red)'],
        ].map(([l, v, sub, c]) => (
          <Reveal key={l} className="card stat" style={{ padding: 16 }}><div className="label">{l}</div><div className="val" style={{ fontSize: 24, marginTop: 10, color: c }}>{v}</div><div className="foot" style={{ fontSize: 12.5 }}>{sub}</div></Reveal>
        ))}
      </div>

      <>
        <Reveal data-span={6} className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Where the money went</h3>
          <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>{monthLabel(ym)} · expenses, EMIs and evals</div>
          {m.byCategory.length ? (
            <div className="money-split">
              <div style={{ height: 230 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={m.byCategory} dataKey="v" nameKey="k" innerRadius="55%" outerRadius="90%" paddingAngle={2} stroke="none">{m.byCategory.map((c, i) => <Cell key={c.k} fill={PALETTE[i % PALETTE.length]} />)}</Pie>
                    <Tooltip {...TT} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="col" style={{ gap: 6, fontSize: 13.5 }}>
                {m.byCategory.map((c, i) => (
                  <div key={c.k} className="row between"><span className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length] }} />{c.k}</span><span className="mono">{fmtInr(c.v)} <span className="dim">{m.outgo ? `${Math.round((c.v / m.outgo) * 100)}%` : ''}</span></span></div>
                ))}
              </div>
            </div>
          ) : <div className="empty" style={{ padding: 40 }}>Nothing spent this month yet.</div>}
        </Reveal>
        <Reveal data-span={6} className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Last 6 months</h3>
          <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>Income vs what went out (stacked), and what was saved</div>
          <div style={{ height: 260, marginTop: 10 }}>
            <ResponsiveContainer>
              <ComposedChart data={trend}>
                <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="m" {...AX} />
                <YAxis {...AX} width={56} tickFormatter={kInr} />
                <Tooltip {...TT} />
                <Legend wrapperStyle={{ fontSize: 12.5 }} iconType="circle" />
                <Bar dataKey="Expenses" stackId="o" fill="#f0616d" />
                <Bar dataKey="EMIs" stackId="o" fill="#f5a524" />
                <Bar dataKey="Evals" stackId="o" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                <Line dataKey="Income" stroke="#2fbf8f" strokeWidth={2.4} dot={{ r: 3 }} />
                <Line dataKey="Saved" stroke="var(--blue)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
      </>

      <Reveal className="card" style={{ marginTop: 16 }}>
        <div className="row between wrap" style={{ gap: 10 }}>
          <div><h3 className="row" style={{ margin: 0, fontSize: 17 }}><Landmark size={17} /> EMIs and loans</h3><div className="sub" style={{ fontSize: 13, marginTop: 4 }}>Tick an EMI once it's paid for {monthLabel(ym)}.</div></div>
          <button className="btn sm" onClick={() => setEmiEdit({ name: '', lender: '', amount: '', dueDay: 5, start: ym, months: 12, paid: [], note: '' })}><Plus size={14} /> EMI</button>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))', marginTop: 12 }}>
          {emis.length ? emis.map((e) => {
            const s = emiStatus(e, ym);
            return (
              <div key={e.id} className="emi-card">
                <div className="row between">
                  <button className="row" style={{ gap: 6, textAlign: 'left' }} onClick={() => setEmiEdit(e)}><b>{e.name}</b><span className="muted" style={{ fontSize: 12.5 }}>{e.lender}</span></button>
                  {s.active ? (
                    <button className={cls('btn sm', s.paidThisMonth ? 'primary' : '')} onClick={() => togglePaid(e)}>{s.paidThisMonth ? <><Check size={14} /> Paid</> : `Mark paid (due ${e.dueDay})`}</button>
                  ) : <span className="tag">{ym < e.start ? 'Not started' : 'Finished'}</span>}
                </div>
                <div className="row between" style={{ marginTop: 8, fontSize: 13.5 }}><span className="mono" style={{ fontWeight: 600 }}>{fmtInr(e.amount)}/month</span><span className="muted">{s.paidCount}/{e.months} paid · ends {monthLabel(s.end)}</span></div>
                <div className="emi-bar"><i style={{ width: `${s.progress}%` }} /></div>
                <div className="dim" style={{ fontSize: 12.5, marginTop: 6 }}>{fmtInr(s.remainingAmount)} left over {s.left} month{s.left === 1 ? '' : 's'}</div>
              </div>
            );
          }) : <p className="muted">No EMIs added.</p>}
        </div>
        {emis.length > 0 && <p className="muted" style={{ fontSize: 13.5, marginBottom: 0 }}>All EMIs: {fmtInr(emis.reduce((s, e) => s + (emiStatus(e, ym).active ? e.amount : 0), 0))} a month · {fmtInr(emis.reduce((s, e) => s + emiStatus(e, ym).remainingAmount, 0))} still to pay.</p>}
      </Reveal>

      <Holdings />

      <Reveal className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
        <div className="row between wrap" style={{ padding: '16px 18px 8px', gap: 10 }}>
          <Seg options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]} value={kind} onChange={setKind} />
          <div className="row" style={{ background: 'var(--panel2)', borderRadius: 10, padding: '0 10px', width: 220 }}><Search size={14} className="muted" /><input className="input" style={{ background: 'none', padding: 8 }} placeholder="Search entries" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl tr-tbl">
            <thead><tr><th>Date</th><th>Category</th><th>Paid by</th><th>Note</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="click" onClick={() => setEdit(e)}>
                  <td className="mono">{e.date}</td><td><b>{e.category}</b></td><td className="muted">{isCredit(e.method) && <CreditCard size={13} style={{ verticalAlign: -2, marginRight: 4 }} />}{e.method || '—'}</td><td className="muted" style={{ whiteSpace: 'normal' }}>{e.note || ''}</td>
                  <td className={cls('r mono', e.kind === 'income' ? 'pos' : '')} style={{ fontWeight: 600 }}>{e.kind === 'income' ? '+' : '−'}{fmtInr(e.amount)}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={5} className="muted" style={{ padding: 22 }}>Nothing logged for {monthLabel(ym)}.</td></tr>}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal className="card row wrap" style={{ marginTop: 16, gap: 14, fontSize: 14 }}>
        <span className="muted">Settings:</span>
        <label className="row" style={{ gap: 6 }}>₹ per $ for eval fees <input className="input mono" style={{ width: 90, padding: '7px 10px' }} type="number" defaultValue={usdInr} onBlur={(e) => +e.target.value > 0 && updateUser({ settings: { finance: { ...fin, usdInr: +e.target.value } } })} /></label>
        <label className="row" style={{ gap: 6 }}>Monthly budget (₹) <input className="input mono" style={{ width: 120, padding: '7px 10px' }} type="number" defaultValue={budget || ''} placeholder="none" onBlur={(e) => updateUser({ settings: { finance: { ...fin, budget: +e.target.value || null } } })} /></label>
        <span className="dim" style={{ fontSize: 12.5 }}>Eval fees use the ₹ actually debited when you entered it on the Payouts page, otherwise this rate.</span>
      </Reveal>

      {edit && <EntryDialog data-free item={edit} onClose={() => setEdit(null)} onSave={save} onDelete={async (id) => { await api.personal.remove('money/entries', id); setEdit(null); load(); }} />}
      {emiEdit && <EmiDialog data-free item={emiEdit} onClose={() => setEmiEdit(null)} onSave={saveEmi} onDelete={async (id) => { await api.personal.remove('money/emis', id); setEmiEdit(null); load(); }} />}
    </Board>
  );
}

function EntryDialog({ item, onClose, onSave, onDelete }) {
  const baseCats = (k) => (k === 'income' ? INCOME_CATS : EXPENSE_CATS);
  // A category that isn't in the list was typed under "Other"
  const custom = item.category && !baseCats(item.kind).includes(item.category);
  const [f, setF] = useState({ ...item, category: custom ? 'Other' : item.category });
  const [other, setOther] = useState(custom ? item.category : '');
  const cats = baseCats(f.kind);
  const methods = f.method && !PAY_METHODS.includes(f.method) ? [f.method, ...PAY_METHODS] : PAY_METHODS;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isOther = f.category === 'Other';
  const out = () => ({ ...f, category: isOther && other.trim() ? other.trim().slice(0, 40) : f.category });
  return (
    <Dialog open onClose={onClose}>
      <h2 style={{ marginTop: 0, fontSize: 21 }}>{f.id ? 'Edit' : 'Add'} {f.kind}</h2>
      <Seg options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} value={f.kind} onChange={(k) => setF({ ...f, kind: k, category: k === 'income' ? 'Salary' : 'Food' })} />
      <div className="fgrid" style={{ marginTop: 14 }}>
        <Field label="Amount (₹)"><input className="input" type="number" inputMode="decimal" autoFocus value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Date"><input className="input" type="date" value={f.date} onChange={set('date')} /></Field>
      </div>
      <Field label="Category">
        <div className="row wrap" style={{ gap: 6 }}>{cats.map((c) => <button key={c} type="button" className={cls('chip', f.category === c && 'on')} onClick={() => setF({ ...f, category: c })}>{c}</button>)}</div>
      </Field>
      {isOther && (
        <Field label={`Name this ${f.kind}`} hint="Saved as the category, so it shows by name in charts and downloads">
          <input className="input" autoFocus value={other} maxLength={40} onChange={(e) => setOther(e.target.value)} placeholder={f.kind === 'income' ? 'e.g. Rent received' : 'e.g. Gym membership'} />
        </Field>
      )}
      <div className="fgrid">
        <Field label={f.kind === 'income' ? 'Received into' : 'Paid by'}>
          <select className="select" value={f.method || ''} onChange={set('method')}>{methods.map((x) => <option key={x} value={x}>{x}</option>)}<option value="">—</option></select>
        </Field>
        <Field label="Note"><input className="input" value={f.note} onChange={set('note')} placeholder="Optional" /></Field>
      </div>
      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        {f.id && <button className="btn danger" onClick={() => onDelete(f.id)}><Trash2 size={14} /> Delete</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!(+f.amount > 0) || !f.date || (isOther && !other.trim())} onClick={() => onSave(out())}>Save</button>
      </div>
    </Dialog>
  );
}

function EmiDialog({ item, onClose, onSave, onDelete }) {
  const [f, setF] = useState(item);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open onClose={onClose}>
      <h2 style={{ marginTop: 0, fontSize: 21 }}>{f.id ? 'Edit' : 'Add'} EMI</h2>
      <div className="fgrid">
        <Field label="Name"><input className="input" value={f.name} onChange={set('name')} placeholder="Bike loan" /></Field>
        <Field label="Lender"><input className="input" value={f.lender} onChange={set('lender')} placeholder="Bank / card" /></Field>
        <Field label="Monthly amount (₹)"><input className="input" type="number" inputMode="decimal" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Due day of month"><input className="input" type="number" min={1} max={31} value={f.dueDay} onChange={set('dueDay')} /></Field>
        <Field label="First EMI month"><input className="input" type="month" value={f.start} onChange={set('start')} /></Field>
        <Field label="Number of months"><input className="input" type="number" min={1} value={f.months} onChange={set('months')} /></Field>
      </div>
      <Field label="Note"><input className="input" value={f.note || ''} onChange={set('note')} /></Field>
      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        {f.id && <button className="btn danger" onClick={() => onDelete(f.id)}><Trash2 size={14} /> Delete</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!f.name || !(+f.amount > 0) || !f.start || !(+f.months > 0)} onClick={() => onSave(f)}>Save</button>
      </div>
    </Dialog>
  );
}
