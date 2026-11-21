import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Zap, ArrowRight } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Sheet } from '../components/ui.jsx';
import { cls } from '../lib/format.js';
import { today, shortDate } from '../lib/dates.js';
import { ALL_SYMBOLS, categoryOf } from '../lib/assets.js';

const GRADES = ['A+', 'A', 'B', 'C', 'F'];
const gcls = { 'A+': '', A: 'g-a', B: '', C: 'g-c', F: 'g-f' };

export default function QuickLog({ open, onClose }) {
  const { saveTrade, notify, settings, openModal, trades } = useApp();
  const [f, setF] = useState(null);
  const symRef = useRef(null);
  useEffect(() => {
    if (open) {
      setF({ symbol: '', date: today(), direction: 'long', pnl: '', grade: '', playbook: '' });
      setTimeout(() => symRef.current?.focus(), 350);
    }
  }, [open]);
  const lastSym = trades.find((t) => t.symbol)?.symbol || 'MNQ';

  const submit = async () => {
    if (!f) return;
    const pnl = parseFloat(String(f.pnl).replace(/[$,]/g, ''));
    if (!Number.isFinite(pnl)) return notify('Enter a P&L');
    const symbol = (f.symbol || lastSym).toUpperCase();
    await saveTrade({ symbol, ...(categoryOf(symbol) && { assetClass: categoryOf(symbol) }), date: f.date, direction: f.direction, pnl, grade: f.grade, playbook: f.playbook || undefined });
    notify('Trade logged');
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const k = (e) => {
      const inSym = e.target === symRef.current;
      const typing = e.target.closest('input') && !inSym;
      if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
      if (inSym || typing) return;
      if (e.key === 'l' || e.key === 'L') setF((x) => ({ ...x, direction: 'long' }));
      if (e.key === 's' || e.key === 'S') setF((x) => ({ ...x, direction: 'short' }));
      if (/^[1-5]$/.test(e.key)) setF((x) => ({ ...x, grade: GRADES[+e.key - 1] }));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  if (!f) return <Sheet open={open} onClose={onClose} eyebrow="Journal" title="Quick Log" />;
  return (
    <Sheet open={open} onClose={onClose} eyebrow="Journal" title="Quick Log">
      <div className="ql">
        <p className="muted" style={{ textAlign: 'center', fontSize: 16, margin: '0 0 22px' }}>L / S = direction · 1—5 = grade · Enter = submit</p>
        <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', gap: 18 }}>
          <div className="ql-box"><div className="eyebrow">Symbol</div><input ref={symRef} list="ql-symbols" className="ql-sym" placeholder={lastSym} value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })} onKeyDown={(e) => e.key === 'Tab' && !f.symbol && setF({ ...f, symbol: lastSym })} /><datalist id="ql-symbols">{ALL_SYMBOLS.map((x) => <option key={x.symbol} value={x.symbol}>{x.name} · {x.category}</option>)}</datalist></div>
          <div className="ql-box"><div className="eyebrow">Date</div><input type="date" className="input" style={{ background: 'none', fontSize: 22, padding: '10px 0' }} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /><div className="dim" style={{ fontSize: 12 }}>{shortDate(f.date)}</div></div>
        </div>
        <div className="row" style={{ gap: 18, marginTop: 18 }}>
          {[['long', 'Long', TrendingUp, 'L'], ['short', 'Short', TrendingDown, 'S']].map(([v, l, I, k]) => (
            <motion.button whileTap={{ scale: 0.97 }} key={v} className={cls('ql-dir', v, f.direction === v && 'on')} onClick={() => setF({ ...f, direction: v })}>
              <I size={34} /> {l.toUpperCase()} <small>PRESS {k}</small>
            </motion.button>
          ))}
        </div>
        <div className="ql-box" style={{ marginTop: 18, padding: '26px 32px' }}>
          <div className="eyebrow">P&amp;L</div>
          <div className="row" style={{ fontSize: 56, fontWeight: 700, gap: 6 }}>
            <span className="dim">$</span>
            <input inputMode="decimal" className="ql-sym" style={{ fontSize: 56, color: parseFloat(f.pnl) < 0 ? 'var(--red)' : parseFloat(f.pnl) > 0 ? 'var(--green)' : undefined }} placeholder="0" value={f.pnl} onChange={(e) => setF({ ...f, pnl: e.target.value.replace(/[^0-9.\-]/g, '') })} />
          </div>
        </div>
        <div className="ql-box" style={{ marginTop: 18 }}>
          <div className="row" style={{ marginBottom: 14 }}><span className="eyebrow">Grade</span><span className="dim" style={{ fontSize: 13 }}>press 1—5</span></div>
          <div className="grade-row">{GRADES.map((g) => <motion.button whileTap={{ scale: 0.95 }} key={g} className={cls('grade-btn', gcls[g], f.grade === g && 'on')} onClick={() => setF({ ...f, grade: f.grade === g ? '' : g })}>{g}</motion.button>)}</div>
        </div>
        <div className="ql-box" style={{ marginTop: 18 }}>
          <div className="row" style={{ marginBottom: 10 }}><span className="eyebrow">Strategy</span><span className="dim" style={{ fontSize: 13 }}>optional</span></div>
          <div className="row wrap" style={{ gap: 8 }}>
            {(settings.tags?.playbooks || []).map((p) => <button key={p} className={cls('chip', f.playbook === p && 'on')} onClick={() => setF({ ...f, playbook: f.playbook === p ? '' : p })}>{p}</button>)}
            <button className="muted row" style={{ gap: 4 }} onClick={() => openModal('settings', { tab: 'Tags' })}>Add one <ArrowRight size={14} /></button>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.98 }} className="btn primary" style={{ width: '100%', marginTop: 18, height: 64, fontSize: 18, borderRadius: 18 }} onClick={submit}><Zap size={18} /> Log Trade</motion.button>
        <p className="dim" style={{ textAlign: 'center' }}>Add chart, notes &amp; confluences when you open the trade</p>
      </div>
    </Sheet>
  );
}
