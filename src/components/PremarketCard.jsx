import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sunrise, Check, Pencil } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Reveal } from './ui.jsx';
import { today } from '../lib/dates.js';

/** Today's pre-market plan + checklist, edited in place on the Dashboard. */
export default function PremarketCard() {
  const { api, settings, notify } = useApp();
  const [plan, setPlan] = useState(null);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ bias: '', keyLevels: '', ruleReminder: '', avoid: '' });
  const date = today();
  useEffect(() => { api.plans.get(date).then((r) => { setPlan(r.plan); if (!r.plan?.bias && !r.plan?.keyLevels) setEdit(true); }).catch(() => {}); }, [api, date]);
  useEffect(() => { const h = (e) => setPlan(e.detail); window.addEventListener('tp-plan-rail', h); return () => window.removeEventListener('tp-plan-rail', h); }, []);
  useEffect(() => { if (plan) setF({ bias: plan.bias || '', keyLevels: plan.keyLevels || '', ruleReminder: plan.ruleReminder || '', avoid: plan.avoid || '' }); }, [plan]);
  const checklist = settings.checklist || [];
  const checks = plan?.checks || [];
  const done = checklist.filter((_, i) => checks[i]).length;
  const save = async (patch) => { const r = await api.plans.put(date, patch); setPlan(r.plan); window.dispatchEvent(new CustomEvent('tp-plan', { detail: r.plan })); return r.plan; };
  const toggle = (i) => save({ checks: checklist.map((_, k) => (k === i ? !checks[k] : !!checks[k])) });
  const ready = (plan?.bias || plan?.keyLevels) && done === checklist.length && checklist.length;

  return (
    <Reveal className="card" style={{ marginTop: 22, borderColor: ready ? 'var(--win-line)' : undefined }}>
      <div className="row between">
        <h3 className="row" style={{ fontSize: 18 }}><Sunrise size={18} style={{ color: 'var(--gold)' }} /> Pre-market plan</h3>
        <span className="row" style={{ gap: 10 }}>
          <span className={ready ? 'pos' : 'muted'} style={{ fontSize: 13 }}>{ready ? 'Ready to trade' : `${done}/${checklist.length} checks`}</span>
          {!edit && <button className="btn sm" onClick={() => setEdit(true)}><Pencil size={13} /> Edit</button>}
        </span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', marginTop: 14 }}>
        <div>
          {edit ? (
            <div className="col" style={{ gap: 10 }}>
              <Seg options={['Bullish', 'Bearish', 'Neutral', 'No bias']} value={f.bias} onChange={(bias) => setF({ ...f, bias })} />
              <input className="input" placeholder="Key levels: PDH 26,010 · Asia low 25,916" value={f.keyLevels} onChange={(e) => setF({ ...f, keyLevels: e.target.value })} />
              <input className="input" placeholder="Rule reminder: wait for the sweep, then MSS" value={f.ruleReminder} onChange={(e) => setF({ ...f, ruleReminder: e.target.value })} />
              <input className="input" placeholder="Avoid today: trading before 9:30, news at 6 PM" value={f.avoid} onChange={(e) => setF({ ...f, avoid: e.target.value })} />
              <button className="btn primary" onClick={async () => { await save(f); setEdit(false); notify('Plan saved'); }}><Check size={15} /> Save plan</button>
            </div>
          ) : (
            <div className="col" style={{ gap: 10, fontSize: 14 }}>
              {[['Bias', plan?.bias], ['Key levels', plan?.keyLevels], ['Rule reminder', plan?.ruleReminder], ['Avoid', plan?.avoid]].map(([l, v]) => v && <div key={l}><div className="eyebrow" style={{ fontSize: 10 }}>{l}</div><div style={{ color: l === 'Avoid' ? '#fca5a5' : 'var(--text)', marginTop: 2 }}>{v}</div></div>)}
            </div>
          )}
        </div>
        <div className="col" style={{ gap: 9 }}>
          <div className="eyebrow" style={{ fontSize: 10 }}>Checklist</div>
          {checklist.map((c, i) => (
            <button key={i} className="row" style={{ alignItems: 'flex-start', gap: 10, textAlign: 'left', fontSize: 14, color: checks[i] ? 'var(--muted)' : 'var(--text)' }} onClick={() => toggle(i)}>
              <motion.span animate={{ background: checks[i] ? 'var(--green)' : 'rgba(0,0,0,0)', borderColor: checks[i] ? 'var(--green)' : 'var(--line2)' }} style={{ width: 18, height: 18, borderRadius: 6, border: '1.5px solid', flex: 'none', display: 'grid', placeItems: 'center', color: '#052', marginTop: 1 }}>{checks[i] && <Check size={12} />}</motion.span>
              <span style={{ textDecoration: checks[i] ? 'line-through' : 'none' }}>{c}</span>
            </button>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
