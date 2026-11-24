import { useEffect, useState } from 'react';
import { Plus, Trash2, X, RotateCcw } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Dialog, Field, Seg } from '../components/ui.jsx';
import { FIRMS, blankFirm, findFirm, mergeFirms } from '../lib/firms.js';
import { cls } from '../lib/format.js';

const COLORS = ['#2f4bd8', '#1e2a78', '#0f766e', '#7c3aed', '#be123c', '#c2410c', '#15803d', '#0369a1', '#334155', '#a16207'];
const num = (v) => (v === '' || v == null ? null : +v);

/** Add a new prop firm, or edit one (built-in firms are saved as your own edited copy) */
export default function FirmEditor({ open, onClose, firmId }) {
  const { settings, updateUser, notify, confirmAsk } = useApp();
  const custom = settings.customFirms || [];
  const [f, setF] = useState(null);
  const [pi, setPi] = useState(0);
  const [vi, setVi] = useState(0);
  useEffect(() => {
    if (!open) return;
    const existing = firmId ? findFirm(firmId, mergeFirms(custom)) : null;
    setF(existing ? JSON.parse(JSON.stringify(existing)) : blankFirm());
    setPi(0); setVi(0);
  }, [open, firmId]); // eslint-disable-line
  if (!open || !f) return <Dialog open={false} onClose={onClose} />;
  const builtIn = FIRMS.some((b) => b.id === f.id);
  const prog = f.programs[pi] || f.programs[0];
  const variant = prog.variants[vi] || prog.variants[0];
  const upd = (fn) => setF((x) => { const n = JSON.parse(JSON.stringify(x)); fn(n, n.programs[pi], n.programs[pi].variants[vi]); return n; });

  const save = async () => {
    if (!f.name.trim()) return notify('Give the firm a name');
    const clean = { ...f, short: f.short || f.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase() };
    delete clean.edited; delete clean.custom;
    if (!builtIn && !firmId) clean.id = `my-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36).slice(-4)}`;
    const next = [...custom.filter((x) => x.id !== clean.id), clean];
    await updateUser({ settings: { customFirms: next } });
    notify(builtIn ? `Saved your version of ${clean.name}` : `${clean.name} saved`);
    onClose();
  };
  const remove = async () => {
    if (!(await confirmAsk(builtIn ? `Go back to the default ${f.name} rules and prices?` : `Delete ${f.name}? Accounts you already added stay.`))) return;
    await updateUser({ settings: { customFirms: custom.filter((x) => x.id !== f.id) } });
    onClose();
  };
  const isMine = custom.some((x) => x.id === f.id);
  const pct = variant.unit === 'pct';

  return (
    <Dialog open={open} onClose={onClose} wide>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 26 }}>{firmId ? `Edit ${f.name}` : 'Add a prop firm'}</h2>
        <button className="close-x" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="fgrid">
        <Field label="Firm name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. FundedNext" autoFocus={!firmId} /></Field>
        <Field label="Short label"><input className="input" value={f.short} maxLength={3} onChange={(e) => setF({ ...f, short: e.target.value.toUpperCase() })} placeholder="FN" /></Field>
        <Field label="Type"><Seg options={['CFD', 'Futures']} value={f.type} onChange={(t) => setF({ ...f, type: t })} /></Field>
        <Field label="Colour"><div className="row wrap" style={{ gap: 6 }}>{COLORS.map((c) => <button key={c} type="button" aria-label={c} className={cls('swatch', f.color === c && 'on')} style={{ background: c }} onClick={() => setF({ ...f, color: c })} />)}</div></Field>
      </div>

      <div className="divider" />
      <div className="row between wrap" style={{ gap: 8 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          {f.programs.map((p, i) => <button key={p.id + i} className={cls('chip', i === pi && 'on')} onClick={() => { setPi(i); setVi(0); }}>{p.name || 'Program'}</button>)}
          <button className="chip" onClick={() => { const b = blankFirm().programs[0]; setF({ ...f, programs: [...f.programs, { ...b, id: `p${Date.now().toString(36)}`, name: 'New program' }] }); setPi(f.programs.length); setVi(0); }}><Plus size={13} /> Program</button>
        </div>
        {f.programs.length > 1 && <button className="btn sm danger" onClick={() => { setF({ ...f, programs: f.programs.filter((_, i) => i !== pi) }); setPi(0); }}><Trash2 size={13} /> Remove program</button>}
      </div>
      <div className="fgrid" style={{ marginTop: 10 }}>
        <Field label="Program name"><input className="input" value={prog.name} onChange={(e) => upd((n, p) => { p.name = e.target.value; })} placeholder="2 Step" /></Field>
        {prog.variants.length > 1 && <Field label="Variant"><select className="select" value={vi} onChange={(e) => setVi(+e.target.value)}>{prog.variants.map((v, i) => <option key={v.id} value={i}>{v.name}</option>)}</select></Field>}
      </div>

      {pct ? (
        <>
          <div className="row between" style={{ marginTop: 12 }}>
            <b>Rules by phase <span className="muted" style={{ fontWeight: 400 }}>(% of account size)</span></b>
            <div className="row" style={{ gap: 6 }}>
              {variant.phases.length < 3 && <button className="btn sm" onClick={() => upd((n, p, v) => { v.phases.push({ ...v.phases.at(-1), name: `Phase ${v.phases.length + 1}` }); })}><Plus size={13} /> Phase</button>}
              {variant.phases.length > 1 && <button className="btn sm" onClick={() => upd((n, p, v) => { v.phases.pop(); })}>Remove last phase</button>}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl edit-tbl">
              <thead><tr><th>Phase</th><th>Profit target %</th><th>Max loss %</th><th>Max loss type</th><th>Daily loss %</th><th>Min days</th><th>Min trades</th></tr></thead>
              <tbody>
                {[...variant.phases.map((ph, i) => ({ ph, i })), { ph: variant.funded, i: 'f' }].map(({ ph, i }) => {
                  const set = (k, v) => upd((n, p, vv) => { (i === 'f' ? vv.funded : vv.phases[i])[k] = v; });
                  return (
                    <tr key={i}>
                      <td><b>{i === 'f' ? 'Funded' : ph.name}</b></td>
                      <td>{i === 'f' ? <span className="dim">—</span> : <input className="input sm" type="number" value={ph.target ?? ''} onChange={(e) => set('target', num(e.target.value))} />}</td>
                      <td><input className="input sm" type="number" value={ph.maxLoss ?? ''} onChange={(e) => set('maxLoss', num(e.target.value))} /></td>
                      <td><select className="select sm" value={ph.maxLossType || 'Static'} onChange={(e) => set('maxLossType', e.target.value)}>{['Static', 'EOD trailing', 'Intraday trailing'].map((x) => <option key={x}>{x}</option>)}</select></td>
                      <td><input className="input sm" type="number" value={ph.daily ?? ''} onChange={(e) => set('daily', num(e.target.value))} /></td>
                      <td><input className="input sm" type="number" value={ph.minDays ?? 0} onChange={(e) => set('minDays', num(e.target.value) || 0)} /></td>
                      <td><input className="input sm" type="number" value={ph.minTrades ?? 0} onChange={(e) => set('minTrades', num(e.target.value) || 0)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : <p className="muted" style={{ fontSize: 13.5 }}>This program sets its rules per account size (in dollars) below.</p>}

      <b style={{ display: 'block', marginTop: 14 }}>Account sizes and prices</b>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl edit-tbl">
          <thead><tr><th>Size ($)</th><th>Price ($)</th>{!pct && <><th>Target ($)</th><th>Max loss ($)</th><th>Daily ($)</th><th>Min days</th></>}<th /></tr></thead>
          <tbody>
            {variant.sizes.map((s, i) => {
              const set = (k, v) => upd((n, p, vv) => { vv.sizes[i][k] = v; });
              return (
                <tr key={i}>
                  <td><input className="input sm" type="number" value={s.size ?? ''} onChange={(e) => set('size', num(e.target.value))} /></td>
                  <td><input className="input sm" type="number" value={s.price ?? ''} onChange={(e) => set('price', num(e.target.value))} /></td>
                  {!pct && <>
                    <td><input className="input sm" type="number" value={s.target ?? ''} onChange={(e) => set('target', num(e.target.value))} /></td>
                    <td><input className="input sm" type="number" value={s.maxLoss ?? ''} onChange={(e) => set('maxLoss', num(e.target.value))} /></td>
                    <td><input className="input sm" type="number" value={s.daily ?? ''} onChange={(e) => set('daily', num(e.target.value))} /></td>
                    <td><input className="input sm" type="number" value={s.minDays ?? 0} onChange={(e) => set('minDays', num(e.target.value) || 0)} /></td>
                  </>}
                  <td>{variant.sizes.length > 1 && <button className="icon-btn" aria-label="Remove size" onClick={() => upd((n, p, vv) => { vv.sizes.splice(i, 1); })}><Trash2 size={14} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button className="btn sm" style={{ marginTop: 8 }} onClick={() => upd((n, p, v) => { v.sizes.push({ ...v.sizes.at(-1), size: (v.sizes.at(-1)?.size || 10000) * 2, price: null }); })}><Plus size={13} /> Size</button>

      <div className="row" style={{ marginTop: 20, gap: 8 }}>
        {isMine && <button className="btn danger" onClick={remove}>{builtIn ? <><RotateCcw size={14} /> Reset to default</> : <><Trash2 size={14} /> Delete firm</>}</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save firm</button>
      </div>
      <p className="dim" style={{ fontSize: 12.5, marginBottom: 0 }}>Changes apply to accounts you add from now on. To change an account you already have, open it on the Propfirm page.</p>
    </Dialog>
  );
}
