import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Search, Check, ArrowRight, X, RotateCcw, Minus, Plus } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Dialog, Seg, Field, ease } from '../components/ui.jsx';
import { FIRMS, FIRM_NOTE, phaseNames, rulesFor, findFirm } from '../lib/firms.js';
import { cls, usd, kfmt } from '../lib/format.js';

/** Step 1: choose firm. Step 2: choose plan + log eval/funded. */
export default function AddAccount({ open, onClose, firmId }) {
  const [firm, setFirm] = useState(null);
  const [sel, setSel] = useState(null);
  const [type, setType] = useState('CFD');
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState(false);
  useEffect(() => {
    if (!open) return;
    const f = firmId && findFirm(firmId);
    setFirm(f || null); setSel(f || null); setType(f?.type || 'CFD'); setQ(''); setCustom(false);
  }, [open, firmId]);
  const list = FIRMS.filter((f) => f.type === type && f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Dialog open={open} onClose={onClose} wide>
      <AnimatePresence mode="wait">
        {custom ? (
          <motion.div key="custom" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}><CustomAccount onBack={() => setCustom(false)} onDone={onClose} /></motion.div>
        ) : firm ? (
          <motion.div key="plan" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease }}>
            <PlanPicker firm={firm} onBack={() => setFirm(null)} onClose={onClose} />
          </motion.div>
        ) : (
          <motion.div key="firm" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease }}>
            <div className="row between" style={{ marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 36, letterSpacing: '-.03em' }}>Add account</h2>
              <button className="close-x" onClick={onClose}><X size={18} /></button>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '220px 1fr', gap: 18 }}>
              <div className="card" style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
                {['Firm', 'Plan', 'Log', 'Done'].map((s, i) => <div key={s} className="row" style={{ gap: 10, padding: '10px 0', color: i === 0 ? 'var(--text)' : 'var(--muted)' }}><span style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${i === 0 ? '#fff' : '#444'}` }} />{s}</div>)}
                <p className="dim" style={{ marginTop: 'auto', fontSize: 12.5, lineHeight: 1.5 }}>{FIRM_NOTE}</p>
              </div>
              <div className="card" style={{ background: 'var(--panel2)' }}>
                <div className="row between" style={{ marginBottom: 14 }}>
                  <b>Choose a firm</b>
                  <Seg options={['CFD', 'Futures']} value={type} onChange={(t) => { setType(t); setSel(null); }} />
                </div>
                <div className="row" style={{ background: 'var(--panel3)', borderRadius: 12, padding: '0 14px', marginBottom: 16 }}>
                  <Search size={16} className="muted" />
                  <input className="input" style={{ background: 'none' }} placeholder="Search firms" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                </div>
                <motion.div layout className="firm-grid" style={{ maxHeight: 440, overflowY: 'auto', padding: 4 }}>
                  {list.map((f) => (
                    <motion.button layout key={f.id} className={cls('firm-card', sel?.id === f.id && 'sel')} style={{ background: `linear-gradient(160deg, ${f.color}, #121216)`, minHeight: 150 }} onClick={() => setSel(f)} onDoubleClick={() => setFirm(f)} whileTap={{ scale: 0.97 }}>
                      {sel?.id === f.id && <span style={{ position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: '50%', background: '#fff', color: '#000', display: 'grid', placeItems: 'center' }}><Check size={15} /></span>}
                      <div className="firm-logo">{f.short}</div>
                      <b style={{ fontSize: 19 }}>{f.name}</b>
                      <span className="muted" style={{ fontSize: 13 }}>{f.programs.reduce((n, p) => n + p.variants.reduce((m, v) => m + v.sizes.length, 0), 0)} plans · ${kfmt(Math.min(...f.programs.flatMap((p) => p.variants.flatMap((v) => v.sizes.map((s) => s.size))))) } to ${kfmt(Math.max(...f.programs.flatMap((p) => p.variants.flatMap((v) => v.sizes.map((s) => s.size)))))}</span>
                    </motion.button>
                  ))}
                  <button className="firm-card blank" style={{ minHeight: 150 }} onClick={() => setCustom(true)}>
                    <div className="firm-logo"><Plus size={20} /></div><b style={{ fontSize: 19 }}>Other firm / personal</b><span className="muted" style={{ fontSize: 13 }}>Enter your own rules</span>
                  </button>
                </motion.div>
                <AnimatePresence>
                  {sel && (
                    <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="row between" style={{ marginTop: 14, padding: 12, borderRadius: 18, background: `linear-gradient(90deg, ${sel.color}, var(--panel2))` }}>
                      <button className="btn" onClick={() => setSel(null)}>Pick another</button>
                      <div style={{ textAlign: 'center' }}><b style={{ fontSize: 20 }}>{sel.name}</b></div>
                      <button className="btn primary" onClick={() => setFirm(sel)}>Continue <ArrowRight size={16} /></button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

function PlanPicker({ firm, onBack, onClose }) {
  const { addAccounts, notify } = useApp();
  const [unit, setUnit] = useState('$');
  const [progId, setProg] = useState(firm.programs[0].id);
  const prog = firm.programs.find((p) => p.id === progId);
  const [varId, setVar] = useState(prog.variants[0].id);
  useEffect(() => setVar(prog.variants[0].id), [progId]); // eslint-disable-line
  const variant = prog.variants.find((v) => v.id === varId) || prog.variants[0];
  const phases = phaseNames(variant);
  const [phaseBySize, setPhaseBySize] = useState({});
  const [logging, setLogging] = useState(null); // {size, phase, kind}
  const mid = Math.min(2, variant.sizes.length - 1);

  return (
    <div style={{ position: 'relative' }}>
      <div className="row between">
        <div className="row" style={{ gap: 10 }}>
          <button className="icon-btn" onClick={onBack}><ArrowLeft size={18} /></button>
          <Seg options={['$', '%']} value={unit} onChange={setUnit} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="row" style={{ gap: 10, justifyContent: 'center' }}><span className="firm-logo" style={{ width: 34, height: 34, fontSize: 12, borderRadius: 10, margin: 0, background: firm.color }}>{firm.short}</span><b style={{ fontSize: 30, letterSpacing: '-.02em' }}>{firm.name}</b></div>
          <div className="muted">{firm.type} · pick the account you bought</div>
        </div>
        <button className="close-x" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 18 }}>
        {firm.programs.map((p) => (
          <motion.button whileTap={{ scale: 0.96 }} key={p.id} onClick={() => setProg(p.id)} style={{ padding: '10px 22px', borderRadius: 18, border: '1px solid', borderColor: p.id === progId ? 'var(--blue)' : 'var(--line2)', background: p.id === progId ? 'linear-gradient(180deg,#1e2a78,#141a44)' : '#151518', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{p.name}</div><div className="muted" style={{ fontSize: 13 }}>{p.tagline}</div>
          </motion.button>
        ))}
      </div>
      {prog.variants.length > 1 && <div className="row" style={{ justifyContent: 'center', marginTop: 14, gap: 10 }}><span className="muted">{prog.name}</span><Seg options={prog.variants.map((v) => ({ value: v.id, label: v.name }))} value={variant.id} onChange={setVar} /></div>}

      <div className="plan-scroll" ref={(el) => el && !el.dataset.s && (el.dataset.s = 1, el.scrollLeft = mid * 380 - 300)}>
        {variant.sizes.map((s, i) => {
          const phase = phaseBySize[s.size] || phases[0];
          const r = rulesFor(variant, s, phase);
          const fail = r.maxLoss ? s.size - r.maxLoss : null;
          const tgt = r.profitTarget ? s.size + r.profitTarget : null;
          const val = (d, p, suffix = '') => (d == null ? 'None' : unit === '$' ? usd(d) : `${p}%`) + suffix;
          return (
            <motion.div key={s.size} className="plan-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease }} whileHover={{ y: -4 }}>
              <div className="row between"><span className="eyebrow" style={{ color: '#c4c8e8' }}>Account size</span><span className="tag" style={{ background: '#ffffff14' }}>{phase}</span></div>
              <div className="big" style={{ marginTop: 8 }}>{kfmt(s.size)}</div>
              <div style={{ color: '#9ea3cc', marginTop: 6 }}>{firm.name} {prog.name}</div>
              {fail != null && (
                <>
                  <div style={{ marginTop: 22, height: 7, borderRadius: 7, background: '#3a3a44', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: `${(r.maxLoss / ((r.profitTarget || 0) + r.maxLoss)) * 100}%`, right: 0, top: 0, bottom: 0, background: 'linear-gradient(90deg,#2337c6,#3b55ff)' }} />
                  </div>
                  <div className="prog-legend">
                    <b>{unit === '$' ? usd(fail) : `-${r.pct.maxLoss}%`}<small>Fail below</small></b>
                    <b style={{ textAlign: 'center' }}>{unit === '$' ? usd(s.size) : '0%'}<small>Start</small></b>
                    <b style={{ textAlign: 'right' }}>{tgt ? (unit === '$' ? usd(tgt) : `+${r.pct.target}%`) : '—'}<small>Target</small></b>
                  </div>
                </>
              )}
              {phases.length > 1 && (
                <div style={{ marginTop: 18 }}>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Phase</div>
                  <Seg options={phases} value={phase} onChange={(p) => setPhaseBySize((x) => ({ ...x, [s.size]: p }))} />
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                {r.profitTarget != null && <div className="plan-row"><span>Profit target</span><b>{val(r.profitTarget, r.pct.target)}</b></div>}
                <div className="plan-row"><span>Max loss</span><b>{val(r.maxLoss, r.pct.maxLoss)} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{r.maxLossType}</span></b></div>
                <div className="plan-row"><span>Daily loss</span><b>{val(r.dailyLoss, r.pct.daily)}</b></div>
                <div className="plan-row"><span>Min days</span><b>{r.minDays || 'None'}</b></div>
                <div className="plan-row"><span>Consistency</span><b>{r.consistency || 'None'}</b></div>
                <div className="plan-row"><span>List price</span><b>{s.price ? usd(s.price) : 'Not listed'}</b></div>
              </div>
              <div className="row" style={{ marginTop: 14, gap: 8 }}>
                {phases.length > 1 && <button className="btn sm" style={{ flexDirection: 'column', gap: 2, flex: 'none', padding: '6px 9px' }} onClick={() => setPhaseBySize((x) => ({ ...x, [s.size]: phase === 'Funded' ? phases[0] : 'Funded' }))}><RotateCcw size={14} />{phase === 'Funded' ? 'Eval details' : 'Funded details'}</button>}
                <div className="row grow" style={{ background: 'var(--panel2)', borderRadius: 12, padding: 4, minWidth: 0, gap: 2 }}>
                  <button className="btn ghost grow" style={{ color: 'var(--text)', padding: '10px 6px' }} onClick={() => setLogging({ size: s, phase: phase === 'Funded' ? phases[0] : phase, kind: 'eval' })}>Log eval</button>
                  <span className="dim">or</span>
                  <button className="btn ghost grow" style={{ color: 'var(--text)', padding: '10px 6px' }} onClick={() => setLogging({ size: s, phase: 'Funded', kind: 'funded' })}>Log funded</button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="dim" style={{ textAlign: 'center', fontSize: 12.5, margin: '6px 0 0' }}>{FIRM_NOTE}</p>

      <AnimatePresence>
        {logging && (
          <LogEvalPopover firm={firm} prog={prog} variant={variant} {...logging} onClose={() => setLogging(null)} onSave={async (body) => {
            await addAccounts(body); notify(`Added ${body.count} account${body.count > 1 ? 's' : ''}`); onClose();
          }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function LogEvalPopover({ firm, prog, variant, size, phase, kind, onClose, onSave }) {
  const [count, setCount] = useState(1);
  const [paid, setPaid] = useState(kind === 'funded' ? '' : size.price ?? '');
  const [bal, setBal] = useState('');
  const [name, setName] = useState(`${firm.name} ${kfmt(size.size)}${kind === 'funded' ? ' Funded' : ''}`);
  const r = rulesFor(variant, size, phase);
  const save = () => onSave({
    count, name, firmId: firm.id, firmName: firm.name, firmType: firm.type, program: prog.name, variant: variant.name, size: size.size,
    phase, kind, paid: parseFloat(paid) || 0, startBalance: parseFloat(bal) || size.size,
    rules: { profitTarget: r.profitTarget, maxLoss: r.maxLoss, maxLossType: r.maxLossType, dailyLoss: r.dailyLoss, minDays: r.minDays, consistency: r.consistency },
  });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: -26, background: '#000a', borderRadius: 26, display: 'grid', placeItems: 'center', zIndex: 5 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: 40, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="dialog" style={{ background: 'linear-gradient(180deg,var(--blue-soft),transparent 45%), var(--panel)', borderColor: 'var(--blue)', width: 460 }}>
        <div className="row between"><span className="eyebrow">{kind === 'funded' ? 'Log funded' : 'Log evaluations'}</span><button className="close-x" onClick={onClose}><X size={16} /></button></div>
        <h3 style={{ fontSize: 26, margin: '6px 0 18px', letterSpacing: '-.02em' }}>{firm.name} {prog.name} {kfmt(size.size)}</h3>
        <div className="col" style={{ gap: 16 }}>
          <Field label="How many">
            <div className="stepper"><button onClick={() => setCount((c) => Math.max(1, c - 1))}><Minus size={18} style={{ margin: 'auto' }} /></button><b className="mono">{count}</b><button onClick={() => setCount((c) => Math.min(50, c + 1))}><Plus size={18} style={{ margin: 'auto' }} /></button></div>
          </Field>
          <Field label="What you paid"><input className="input" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="$ 0" /></Field>
          <Field label="Balance today (optional)" hint="Already trading it? Type the balance your firm shows today."><input className="input" inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} placeholder={`$ ${size.size}`} /></Field>
          <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="muted" style={{ fontSize: 13 }}>It will be named: {count > 1 ? `${name} 1 … ${name} ${count}` : name}</div>
          <motion.button whileTap={{ scale: 0.98 }} className="btn primary" style={{ height: 52 }} onClick={save}>Add {count} {kind === 'funded' ? 'funded account' : 'evaluation'}{count > 1 ? 's' : ''}</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CustomAccount({ onBack, onDone }) {
  const { addAccounts, notify } = useApp();
  const [f, setF] = useState({ name: '', firmName: '', size: '', kind: 'eval', phase: 'Phase 1', profitTarget: '', maxLoss: '', maxLossType: 'Static', dailyLoss: '', minDays: '', paid: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const n = (v) => (v === '' ? null : parseFloat(v));
  const save = async () => {
    if (!f.name || !n(f.size)) return notify('Name and size are required');
    await addAccounts({ name: f.name, firmName: f.firmName || 'Personal', firmId: 'custom', size: n(f.size), kind: f.kind, phase: f.kind === 'funded' ? 'Funded' : f.phase, paid: n(f.paid) || 0, rules: { profitTarget: n(f.profitTarget), maxLoss: n(f.maxLoss), maxLossType: f.maxLossType, dailyLoss: n(f.dailyLoss), minDays: n(f.minDays) || 0 } });
    notify('Account added'); onDone();
  };
  return (
    <div>
      <div className="row" style={{ gap: 10, marginBottom: 18 }}><button className="icon-btn" onClick={onBack}><ArrowLeft size={18} /></button><h2 style={{ margin: 0 }}>Custom account</h2></div>
      <div className="fgrid">
        <Field label="Account name"><input className="input" value={f.name} onChange={set('name')} placeholder="My 100K" /></Field>
        <Field label="Firm / broker"><input className="input" value={f.firmName} onChange={set('firmName')} placeholder="Personal" /></Field>
        <Field label="Size ($)"><input className="input" value={f.size} onChange={set('size')} placeholder="100000" /></Field>
        <Field label="Type"><Seg options={[{ value: 'eval', label: 'Evaluation' }, { value: 'funded', label: 'Funded' }, { value: 'personal', label: 'Personal' }]} value={f.kind} onChange={set('kind')} /></Field>
        <Field label="Profit target ($)"><input className="input" value={f.profitTarget} onChange={set('profitTarget')} /></Field>
        <Field label="Max loss ($)"><input className="input" value={f.maxLoss} onChange={set('maxLoss')} /></Field>
        <Field label="Max loss type"><Seg options={['Static', 'EOD trailing', 'Intraday trailing']} value={f.maxLossType} onChange={set('maxLossType')} /></Field>
        <Field label="Daily loss ($)"><input className="input" value={f.dailyLoss} onChange={set('dailyLoss')} /></Field>
        <Field label="Min days"><input className="input" value={f.minDays} onChange={set('minDays')} /></Field>
        <Field label="What you paid"><input className="input" value={f.paid} onChange={set('paid')} /></Field>
      </div>
      <button className="btn primary" style={{ width: '100%', marginTop: 20, height: 50 }} onClick={save}>Add account</button>
    </div>
  );
}
