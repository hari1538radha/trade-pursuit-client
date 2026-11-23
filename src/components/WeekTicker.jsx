import { useMemo } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { weekWorst } from '../lib/coach.js';

const money = (n) => `${n < 0 ? '-' : '+'}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

/**
 * Always-on strip under the top bar: the worst things you did last week and what to do instead.
 * Click it for the full card (the coach also shows that card once a day).
 */
export default function WeekTicker() {
  const { trades, breakEven, settings } = useApp();
  const week = useMemo(() => weekWorst(trades, { be: breakEven, donts: settings.donts || [] }), [trades, breakEven, settings.donts]);
  const setOpen = () => window.dispatchEvent(new Event('tp-brief')); // the coach opens the full card

  if (!week.items.length) return <div className="wk-ticker empty-tick"><ShieldCheck size={14} /> No costly habits found last week. Keep it that way.</div>;
  const label = week.fromAllTime ? 'No trades last week · from all your trades, avoid:' : `Last week (${week.count} trades, ${money(week.pnl)}) · avoid:`;
  const strip = week.items.map((x, i) => (
    <span key={i} className="wk-item">
      <b>{x.avoid}</b>{!x.mine && <span className="wk-why"> ← {x.what}</span>}
    </span>
  ));
  return (
    <>
      <button className="wk-ticker" onClick={setOpen} title="Open last week's review">
        <span className="wk-label"><AlertTriangle size={14} /> <span className="wk-label-text">{label}</span></span>
        <span className="wk-track"><span className="wk-run" style={{ animationDuration: `${Math.max(30, week.items.length * 12)}s` }}>{strip}{strip}</span></span>
      </button>
    </>
  );
}
