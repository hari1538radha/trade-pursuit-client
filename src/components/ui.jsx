import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, animate, useInView } from 'framer-motion';
import { X } from 'lucide-react';
import { cls, money } from '../lib/format.js';
import { useApp } from '../store/AppContext.jsx';

export const ease = [0.22, 1, 0.36, 1];

export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="Trade Pursuit">
      <rect width="32" height="32" rx="10" fill="#f4f4f5" />
      <path d="M8 21.5l5.2-6.2 4.2 3.2L24 10" stroke="#09090b" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="10" r="2.2" fill="#09090b" />
    </svg>
  );
}

/** Segmented control with a sliding highlight */
export function Seg({ options, value, onChange, size }) {
  const id = useId();
  return (
    <div className="seg" style={size === 'lg' ? { padding: 5, borderRadius: 16 } : undefined}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return (
          <button key={v} className={cls(v === value && 'on')} onClick={() => onChange(v)} style={size === 'lg' ? { padding: '10px 22px', fontSize: 16, borderRadius: 12 } : undefined}>
            {v === value && <motion.i layoutId={id} className="seg-bg" transition={{ type: 'spring', stiffness: 500, damping: 38 }} style={size === 'lg' ? { borderRadius: 12 } : undefined} />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange }) {
  return <button className={cls('toggle', on && 'on')} onClick={() => onChange(!on)} aria-pressed={on}><i /></button>;
}

export function ChipGroup({ options, value = [], onChange, multi = true, tone, onAdd, addLabel = 'Add your own…' }) {
  const [draft, setDraft] = useState('');
  const sel = multi ? value : [value];
  const toggle = (o) => (multi ? onChange(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]) : onChange(o === value ? '' : o));
  const all = [...new Set([...options, ...sel.filter(Boolean)])];
  return (
    <div>
      <div className="row wrap" style={{ gap: 8 }}>
        {all.map((o) => (
          <motion.button whileTap={{ scale: 0.94 }} key={o} type="button" className={cls('chip', sel.includes(o) && 'on', sel.includes(o) && tone)} onClick={() => toggle(o)}>{o}</motion.button>
        ))}
      </div>
      {onAdd && (
        <form className="row" style={{ marginTop: 14, borderBottom: '1px solid #2a2a30' }} onSubmit={(e) => { e.preventDefault(); const v = draft.trim(); if (!v) return; onAdd(v); toggle(v); setDraft(''); }}>
          <input className="grow" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={addLabel} style={{ background: 'none', border: 0, outline: 'none', padding: '8px 2px' }} />
          <button className="muted" type="submit">Add</button>
        </form>
      )}
    </div>
  );
}

export function Field({ label, children, hint, right }) {
  return (
    <div className="field">
      {label && <label className="row between"><span>{label}</span>{right}</label>}
      {children}
      {hint && <span className="dim" style={{ fontSize: 12 }}>{hint}</span>}
    </div>
  );
}

/** Bottom sheet (Log Trade, Quick Log) */
export function Sheet({ open, onClose, eyebrow, title, actions, children }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div className="sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 32 }}>
            <div className="grab" />
            <div className="sheet-head">
              <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>
              <div className="row" style={{ gap: 10 }}>{actions}<button className="close-x" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Dialog({ open, onClose, children, wide, title }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div className={cls('dialog', wide && 'wide')} initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }} transition={{ duration: 0.35, ease }}>
            {title && (
              <div className="row between" style={{ marginBottom: 18 }}>
                <h2 style={{ margin: 0, fontSize: 28, letterSpacing: '-.03em' }}>{title}</h2>
                <button className="close-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Animated number */
export function CountUp({ value, format = (n) => n.toFixed(0) }) {
  const ref = useRef(null);
  const prev = useRef(0);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !Number.isFinite(value)) { if (ref.current) ref.current.textContent = format(value); return; }
    const c = animate(prev.current, value, { duration: 1.1, ease, onUpdate: (v) => { if (ref.current) ref.current.textContent = format(v); } });
    prev.current = value;
    return () => c.stop();
  }, [value, inView]); // eslint-disable-line
  return <span ref={ref}>{format(0)}</span>;
}

export function Money({ value, cents = true, animated, className }) {
  const { hidePnl } = useApp();
  if (hidePnl) return <span className={className}>$•••</span>;
  const cn = cls(className, value > 0 ? 'pos' : value < 0 ? 'neg' : '');
  if (animated) return <span className={cn}><CountUp value={value} format={(n) => money(n, { cents })} /></span>;
  return <span className={cn}>{money(value, { cents })}</span>;
}

export function BigTitle({ children, tagline }) {
  return (
    <>
      {tagline && <p className="tagline">{tagline}</p>}
      <motion.div className="bigtitle" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8, ease }}>
        {children}
      </motion.div>
    </>
  );
}

export function Reveal({ children, delay = 0, className, style }) {
  return (
    <motion.div className={className} style={style} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.55, delay, ease }}>
      {children}
    </motion.div>
  );
}

export function Empty({ icon, title, children, action }) {
  return (
    <div className="empty">
      {icon && <div className="ico">{icon}</div>}
      {title && <h2>{title}</h2>}
      {children && <p style={{ maxWidth: 460, lineHeight: 1.6, fontSize: 16, margin: 0 }}>{children}</p>}
      {action}
    </div>
  );
}

export function Toast() {
  const { toast } = useApp();
  return (
    <AnimatePresence>
      {toast && <motion.div className="toast" initial={{ opacity: 0, y: 20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 10, x: '-50%' }}>{toast}</motion.div>}
    </AnimatePresence>
  );
}

export function SymbolIcon({ symbol }) {
  return <div className="sym-ico" style={{ background: `var(--c)`, '--c': symColorSafe(symbol) }}>{(symbol || '?').slice(0, 3)}</div>;
}
import { symColor } from '../lib/format.js';
const symColorSafe = (s) => symColor(s || '');

export function ChartTip({ active, payload, label, fmt = (v) => money(v) }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div className="muted" style={{ marginBottom: 4 }}>{label}</div>
      {payload.map((p) => <div key={p.dataKey} style={{ fontWeight: 600 }}>{p.name}: {fmt(p.value)}</div>)}
    </div>
  );
}
