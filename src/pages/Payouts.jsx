import { useEffect, useMemo, useState } from 'react';
import { HandCoins, Plus, Upload, Trash2, Search, Lightbulb, Pencil } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, BarChart, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, Cell } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Reveal, Dialog, Field } from '../components/ui.jsx';
import { propAnalysis, fmtUsd, ymdOf } from '../lib/personal.js';
import { SEED_PURCHASES, SEED_PAYOUTS, SEED_SOURCE } from '../lib/payoutSeed.js';

const AX = { tickLine: false, axisLine: false, tick: { fontSize: 12, fill: 'var(--text2)' } };
const TT = { contentStyle: { background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 10, fontSize: 13 } };
const RED = '#f0616d', GREEN = '#2fbf8f', BLUE = 'var(--blue)';
const STATUSES = ['', 'active', 'step 1 passed', 'passed', 'funded', 'breached', 'failed'];

/** Admin only: what the funded-account journey has cost and paid */
export default function Payouts() {
  const { api, notify } = useApp();
  const [buys, setBuys] = useState(null);
  const [pays, setPays] = useState([]);
  const [tab, setTab] = useState('purchases');
  const [edit, setEdit] = useState(null); // { kind, item }
  const [q, setQ] = useState('');
  const [firm, setFirm] = useState('All');
  const load = () => Promise.all([api.personal.list('props/purchases'), api.personal.list('props/payouts')])
    .then(([a, b]) => { setBuys(a.items); setPays(b.items); }).catch((e) => notify(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const a = useMemo(() => propAnalysis(buys || [], pays), [buys, pays]);
  const firms = ['All', ...new Set([...(buys || []), ...pays].map((x) => x.firm))];

  const importSeed = async () => {
    const r = await api.personal.importProps({ purchases: SEED_PURCHASES.map((p) => ({ ...p, inr: p.inr ?? null, src: SEED_SOURCE })), payouts: SEED_PAYOUTS.map((p) => ({ ...p, src: SEED_SOURCE })) });
    notify(`Imported ${r.purchases} purchases and ${r.payouts} payouts${r.skipped ? ` (${r.skipped} already there)` : ''}`);
    load();
  };
  const save = async (kind, item) => {
    try {
      if (item.id) await api.personal.update(kind, item.id, strip(item)); else await api.personal.create(kind, strip(item));
      setEdit(null); load();
    } catch (e) { notify(e.message); }
  };
  const remove = async (kind, id) => { await api.personal.remove(kind, id); setEdit(null); load(); };

  if (!buys) return <div className="page"><p className="muted">Loading…</p></div>;
  const empty = !buys.length && !pays.length;
  const rows = (tab === 'purchases' ? buys : pays).filter((x) => (firm === 'All' || x.firm === firm) && (!q || `${x.firm} ${x.note || ''} ${x.program || ''} ${x.status || ''} ${x.ref || ''}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="page wide-page">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><HandCoins size={22} /> Payouts vs purchases</h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Everything spent on prop-firm accounts against what they've paid out. Only you (admin) can see this.</div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn sm" onClick={importSeed} title="Adds the purchases and payouts from your Oct 2026 review; rows already here are skipped"><Upload size={14} /> Import Oct 2026 review</button>
          <button className="btn sm" onClick={() => setEdit({ kind: 'props/purchases', item: { date: ymdOf(), firm: '', fee: '', status: 'active' } })}><Plus size={14} /> Purchase</button>
          <button className="btn sm primary" onClick={() => setEdit({ kind: 'props/payouts', item: { date: ymdOf(), firm: '', gross: '', fee: 0, net: '' } })}><Plus size={14} /> Payout</button>
        </div>
      </div>

      {empty ? (
        <Reveal className="card" style={{ marginTop: 16, padding: 28, textAlign: 'center' }}>
          <h3 style={{ marginTop: 0 }}>Nothing tracked yet</h3>
          <p className="muted">Import the 72 purchases and 4 payouts from your October 2026 review, or add them one by one.</p>
          <button className="btn primary" onClick={importSeed}><Upload size={15} /> Import Oct 2026 review</button>
        </Reveal>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', marginTop: 16 }}>
            {[
              ['Spent on accounts', fmtUsd(a.spent), `${a.count} accounts`],
              ['Net payouts', fmtUsd(a.net), `${a.payoutCount} payouts · gross ${fmtUsd(a.gross)}`, GREEN],
              ['Net position', fmtUsd(a.position, true), a.position < 0 ? 'to break even' : 'in profit', a.position < 0 ? RED : GREEN],
              ['Payout ÷ purchase', `${a.ratio.toFixed(1)}%`, `$${(a.ratio / 100).toFixed(2)} back per $1 spent`],
              ['Avg net payout', fmtUsd(a.avgNetPayout), `last 3: ${fmtUsd(a.avgRecent)}`],
              ['Withdrawal fees', fmtUsd(a.fees), a.gross ? `${((a.fees / a.gross) * 100).toFixed(1)}% of gross` : ''],
            ].map(([l, v, sub, c]) => (
              <Reveal key={l} className="card stat" style={{ padding: 16 }}><div className="label">{l}</div><div className="val" style={{ fontSize: 24, marginTop: 10, color: c }}>{v}</div>{sub && <div className="foot" style={{ fontSize: 12.5 }}>{sub}</div>}</Reveal>
            ))}
          </div>

          <Reveal className="card" style={{ marginTop: 16 }}>
            <h3 className="row" style={{ margin: 0, fontSize: 17 }}><Lightbulb size={17} /> What the numbers say</h3>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.65, fontSize: 14 }}>{a.insights.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="dim" style={{ fontSize: 12, marginBottom: 0 }}>Analysis of your own records, not financial advice.</p>
          </Reveal>

          <Reveal className="card" style={{ marginTop: 16 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>Spend, payouts and running cash position by month</h3>
            <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>Bars: money spent (red) and received (green) each month. Line: cumulative net position.</div>
            <div style={{ height: 340, marginTop: 12 }}>
              <ResponsiveContainer>
                <ComposedChart data={a.monthly}>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="label" {...AX} minTickGap={8} />
                  <YAxis yAxisId="m" {...AX} width={62} tickFormatter={(v) => `$${Math.round(v)}`} />
                  <YAxis yAxisId="c" orientation="right" {...AX} width={66} tickFormatter={(v) => `$${Math.round(v)}`} />
                  <Tooltip {...TT} formatter={(v, n) => [fmtUsd(v, n === 'Cumulative net'), n]} />
                  <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />
                  <ReferenceLine yAxisId="c" y={0} stroke="var(--line2)" />
                  <Bar yAxisId="m" dataKey="spend" name="Spent" fill={RED} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="m" dataKey="payouts" name="Payouts (net)" fill={GREEN} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="c" dataKey="cum" name="Cumulative net" stroke={BLUE} strokeWidth={2.4} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Reveal>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))' }}>
            <Reveal className="card" style={{ marginTop: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Spent vs received by firm</h3>
              <div style={{ height: 300, marginTop: 12 }}>
                <ResponsiveContainer>
                  <BarChart data={a.byFirm} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 4" horizontal={false} stroke="var(--line)" />
                    <XAxis type="number" {...AX} tickFormatter={(v) => `$${Math.round(v)}`} />
                    <YAxis type="category" dataKey="firm" {...AX} width={96} />
                    <Tooltip {...TT} formatter={(v, n) => [fmtUsd(v), n]} />
                    <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />
                    <Bar dataKey="spent" name="Spent" fill={RED} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="received" name="Received" fill={GREEN} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Reveal>
            <Reveal className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px 6px' }}><h3 style={{ margin: 0, fontSize: 17 }}>Firm scorecard</h3></div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl tr-tbl">
                  <thead><tr><th>Firm</th><th className="r">Accounts</th><th className="r">Spent</th><th className="r">Share</th><th className="r">Received</th><th className="r">Net</th><th className="r">Recovered</th></tr></thead>
                  <tbody>
                    {a.byFirm.map((f) => (
                      <tr key={f.firm}><td><b>{f.firm}</b></td><td className="r mono">{f.count}</td><td className="r mono">{fmtUsd(f.spent)}</td><td className="r mono">{f.share.toFixed(1)}%</td><td className="r mono">{fmtUsd(f.received)}</td><td className={`r mono ${f.pnl >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600 }}>{fmtUsd(f.pnl, true)}</td><td className="r mono">{f.recovered.toFixed(1)}%</td></tr>
                    ))}
                    <tr><td><b>Total</b></td><td className="r mono">{a.count}</td><td className="r mono">{fmtUsd(a.spent)}</td><td className="r mono">100%</td><td className="r mono">{fmtUsd(a.net)}</td><td className={`r mono ${a.position >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 700 }}>{fmtUsd(a.position, true)}</td><td className="r mono">{a.ratio.toFixed(1)}%</td></tr>
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))' }}>
            <Reveal className="card" style={{ marginTop: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Accounts bought per month</h3>
              <div style={{ height: 240, marginTop: 12 }}>
                <ResponsiveContainer>
                  <BarChart data={a.monthly}>
                    <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="label" {...AX} minTickGap={8} />
                    <YAxis {...AX} width={34} allowDecimals={false} />
                    <Tooltip {...TT} />
                    <Bar dataKey="count" name="Accounts bought" radius={[4, 4, 0, 0]}>{a.monthly.map((m) => <Cell key={m.m} fill={m.count >= 10 ? RED : 'var(--blue)'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="dim" style={{ fontSize: 12, margin: 0 }}>Red bars: 10+ accounts in a month.</p>
            </Reveal>
            <Reveal className="card" style={{ marginTop: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Break-even outlook (next 3 months)</h3>
              <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>Payouts needed = current deficit + 3 × monthly purchases, at your recent average net payout ({fmtUsd(a.avgRecent)}).</div>
              {a.position >= 0 ? <p className="pos" style={{ fontWeight: 600 }}>You're already past break-even.</p> : (
                <table className="tbl tr-tbl" style={{ marginTop: 10 }}>
                  <thead><tr><th>If you buy each month…</th><th className="r">Net payouts needed</th><th className="r">≈ payouts</th></tr></thead>
                  <tbody>{a.scenarios.map((s) => <tr key={s.buy}><td>{fmtUsd(s.buy)}{s.buy === Math.round(a.avgMonthlySpend) ? ' (your average month)' : ''}</td><td className="r mono">{fmtUsd(s.need)}</td><td className="r mono">{s.payouts ? s.payouts.toFixed(1) : '—'}</td></tr>)}</tbody>
                </table>
              )}
              <p className="dim" style={{ fontSize: 12, marginBottom: 0 }}>A scenario, not a forecast: assumes no new breaches and the same payout size.</p>
            </Reveal>
          </div>

          <Reveal className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
            <div className="row between wrap" style={{ padding: '16px 18px 8px', gap: 10 }}>
              <Seg options={[{ value: 'purchases', label: `Purchases (${buys.length})` }, { value: 'payouts', label: `Payouts (${pays.length})` }]} value={tab} onChange={setTab} />
              <div className="row wrap" style={{ gap: 8 }}>
                <select className="select" style={{ width: 150, padding: '8px 12px' }} value={firm} onChange={(e) => setFirm(e.target.value)}>{firms.map((f) => <option key={f}>{f}</option>)}</select>
                <div className="row" style={{ background: 'var(--panel2)', borderRadius: 10, padding: '0 10px', width: 200 }}><Search size={14} className="muted" /><input className="input" style={{ background: 'none', padding: 8 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl tr-tbl">
                {tab === 'purchases' ? (
                  <>
                    <thead><tr><th>Date</th><th>Firm</th><th>Program</th><th className="r">Fee</th><th className="r">Debited ₹</th><th>Status</th><th>Note</th><th /></tr></thead>
                    <tbody>{rows.map((p) => (
                      <tr key={p.id} className="click" onClick={() => setEdit({ kind: 'props/purchases', item: p })}>
                        <td className="mono">{p.date}</td><td><b>{p.firm}</b></td><td className="muted">{p.program || '—'}</td><td className="r mono">{fmtUsd(p.fee)}</td><td className="r mono">{p.inr ? `₹${p.inr.toLocaleString('en-IN')}` : '—'}</td>
                        <td>{p.status ? <span className="tag" style={{ color: /breach|fail/.test(p.status) ? RED : /fund|pass/.test(p.status) ? GREEN : undefined }}>{p.status}</span> : '—'}</td>
                        <td className="muted" style={{ whiteSpace: 'normal', minWidth: 200 }}>{p.note || ''}</td><td><Pencil size={13} className="muted" /></td>
                      </tr>
                    ))}</tbody>
                  </>
                ) : (
                  <>
                    <thead><tr><th>Date</th><th>Firm</th><th className="r">Gross</th><th className="r">Fee</th><th className="r">Net</th><th>Account</th><th>Ref</th><th>Note</th><th /></tr></thead>
                    <tbody>{rows.map((p) => (
                      <tr key={p.id} className="click" onClick={() => setEdit({ kind: 'props/payouts', item: p })}>
                        <td className="mono">{p.date}</td><td><b>{p.firm}</b></td><td className="r mono">{fmtUsd(p.gross)}</td><td className="r mono">{fmtUsd(p.fee)}</td><td className="r mono pos" style={{ fontWeight: 600 }}>{fmtUsd(p.net)}</td><td className="muted">{p.account || '—'}</td><td className="mono muted">{p.ref || '—'}</td><td className="muted" style={{ whiteSpace: 'normal', minWidth: 200 }}>{p.note || ''}</td><td><Pencil size={13} className="muted" /></td>
                      </tr>
                    ))}</tbody>
                  </>
                )}
              </table>
            </div>
          </Reveal>
        </>
      )}
      <EditDialog edit={edit} onClose={() => setEdit(null)} onSave={save} onDelete={remove} firms={firms.filter((f) => f !== 'All')} />
    </div>
  );
}

const strip = ({ id, user, createdAt, updatedAt, ...rest }) => {
  const out = { ...rest };
  for (const k of ['fee', 'gross', 'net', 'inr', 'size']) if (k in out) out[k] = out[k] === '' || out[k] == null ? (k === 'inr' || k === 'size' ? null : 0) : Number(out[k]);
  return out;
};

function EditDialog({ edit, onClose, onSave, onDelete, firms }) {
  const [f, setF] = useState(null);
  useEffect(() => { setF(edit ? { ...edit.item } : null); }, [edit]);
  if (!edit || !f) return null;
  const isBuy = edit.kind === 'props/purchases';
  const set = (k) => (e) => setF((x) => {
    const n = { ...x, [k]: e.target.value };
    if (!isBuy && (k === 'gross' || k === 'fee') && n.gross !== '') n.net = Math.max(0, Number(n.gross || 0) - Number(n.fee || 0));
    return n;
  });
  const ok = f.date && f.firm && (isBuy ? f.fee !== '' : f.gross !== '' && f.net !== '');
  return (
    <Dialog open onClose={onClose}>
      <h2 style={{ marginTop: 0, fontSize: 21 }}>{f.id ? 'Edit' : 'Add'} {isBuy ? 'purchase' : 'payout'}</h2>
      <datalist id="firm-list">{firms.map((x) => <option key={x} value={x} />)}</datalist>
      <div className="fgrid">
        <Field label="Date"><input className="input" type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Firm"><input className="input" list="firm-list" value={f.firm} onChange={set('firm')} placeholder="FundingPips" /></Field>
        {isBuy ? (
          <>
            <Field label="Fee (USD)"><input className="input" type="number" inputMode="decimal" value={f.fee} onChange={set('fee')} /></Field>
            <Field label="Debited (₹, optional)"><input className="input" type="number" inputMode="decimal" value={f.inr ?? ''} onChange={set('inr')} /></Field>
            <Field label="Program / size"><input className="input" value={f.program || ''} onChange={set('program')} placeholder="10K 2-Step Pro" /></Field>
            <Field label="Status"><select className="select" value={f.status || ''} onChange={set('status')}>{STATUSES.map((s) => <option key={s} value={s}>{s || '—'}</option>)}</select></Field>
          </>
        ) : (
          <>
            <Field label="Gross (USD)"><input className="input" type="number" inputMode="decimal" value={f.gross} onChange={set('gross')} /></Field>
            <Field label="Withdrawal fee (USD)"><input className="input" type="number" inputMode="decimal" value={f.fee} onChange={set('fee')} /></Field>
            <Field label="Net received (USD)"><input className="input" type="number" inputMode="decimal" value={f.net} onChange={set('net')} /></Field>
            <Field label="Account"><input className="input" value={f.account || ''} onChange={set('account')} placeholder="Rise 20996789" /></Field>
            <Field label="Reference"><input className="input" value={f.ref || ''} onChange={set('ref')} /></Field>
          </>
        )}
      </div>
      <Field label="Note"><input className="input" value={f.note || ''} onChange={set('note')} /></Field>
      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        {f.id && <button className="btn danger" onClick={() => onDelete(edit.kind, f.id)}><Trash2 size={14} /> Delete</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={() => onSave(edit.kind, f)}>Save</button>
      </div>
    </Dialog>
  );
}
