import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { byDay } from '../lib/stats.js';
import { ymd } from '../lib/dates.js';
import { cls, money } from '../lib/format.js';
import { useApp } from '../store/AppContext.jsx';

export default function Calendar({ trades, onDay }) {
  const { hidePnl } = useApp();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const days = useMemo(() => byDay(trades), [trades]);
  const start = new Date(cursor); start.setDate(1 - start.getDay());
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => { const x = new Date(start); x.setDate(start.getDate() + w * 7 + d); return x; }))
    .filter((wk) => wk.some((d) => d.getMonth() === cursor.getMonth()));
  const monthTotal = [...days.values()].filter((d) => d.date.startsWith(ymd(cursor).slice(0, 7))).reduce((s, d) => s + d.pnl, 0);
  const shift = (n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const m = (n) => (hidePnl ? '$•••' : money(n, { cents: false }));
  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
          <b style={{ minWidth: 140, textAlign: 'center' }}>{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
          <button className="icon-btn" onClick={() => shift(1)}><ChevronRight size={16} /></button>
        </div>
        <span>Month: <b className={monthTotal > 0 ? 'pos' : monthTotal < 0 ? 'neg' : ''}>{m(monthTotal)}</b></span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={ymd(cursor)} className="cal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Week'].map((h) => <div key={h} className="h">{h}</div>)}
          {weeks.map((wk, wi) => {
            const wsum = wk.reduce((s, d) => s + (days.get(ymd(d))?.pnl || 0), 0);
            const wcount = wk.reduce((s, d) => s + (days.get(ymd(d))?.count || 0), 0);
            return [
              ...wk.map((d) => {
                const k = ymd(d), v = days.get(k);
                return (
                  <div key={k} className={cls('d', d.getMonth() !== cursor.getMonth() && 'out', v && 'has', v && (v.pnl > 0 ? 'win' : v.pnl < 0 ? 'loss' : ''))} onClick={() => v && onDay?.(k)}>
                    <span className="dim">{d.getDate()}</span>
                    {v && <span><b className={v.pnl > 0 ? 'pos' : v.pnl < 0 ? 'neg' : ''}>{m(v.pnl)}</b><div className="dim">{v.count} trade{v.count > 1 ? 's' : ''}</div></span>}
                  </div>
                );
              }),
              <div key={'w' + wi} className="wk"><span className="dim">Week {wi + 1}</span><b className={wsum > 0 ? 'pos' : wsum < 0 ? 'neg' : ''}>{m(wsum)}</b><span className="dim">{wcount} trades</span></div>,
            ];
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
