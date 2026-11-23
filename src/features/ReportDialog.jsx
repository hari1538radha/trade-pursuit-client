import { useEffect, useMemo, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Dialog, Seg, Money } from '../components/ui.jsx';
import { periodsFor, buildReport } from '../lib/report.js';
import { summary, real } from '../lib/stats.js';

export default function ReportDialog({ open, onClose, kind: initialKind }) {
  const { trades, user, breakEven, mode, notify } = useApp();
  const [kind, setKind] = useState(initialKind || 'week');
  useEffect(() => { if (open) { setKind(initialKind || 'week'); setIdx(0); } }, [open, initialKind]); // eslint-disable-line
  const periods = useMemo(() => periodsFor(kind, kind === 'week' ? 12 : 12), [kind]);
  const [idx, setIdx] = useState(0);
  const p = periods[Math.min(idx, periods.length - 1)];
  const s = summary(real(trades).filter((t) => t.date >= p.from && t.date <= p.to), breakEven);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const doc = buildReport({ trades, period: p, user, be: breakEven, mode });
      doc.save(`trade-pursuit-${kind === 'week' ? 'weekly' : 'monthly'}-${p.from}.pdf`);
      notify('Report downloaded');
    } catch (e) { notify(`Couldn't build the report: ${e.message}`); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onClose={onClose} title="Performance report">
      <p className="muted" style={{ marginTop: -8 }}>A PDF with your stats, equity curve, daily P&amp;L, breakdowns by setup, session, weekday and emotion, what to improve, and every trade in the period.</p>
      <div className="row between wrap" style={{ gap: 10, margin: '16px 0' }}>
        <Seg size="lg" options={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} value={kind} onChange={(k) => { setKind(k); setIdx(0); }} />
        <select className="select" style={{ width: 240 }} value={idx} onChange={(e) => setIdx(+e.target.value)}>
          {periods.map((x, i) => <option key={x.from} value={i}>{i === 0 ? `This ${kind}: ` : ''}{x.label}</option>)}
        </select>
      </div>
      <div className="grid rg-1" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="card" style={{ padding: 14 }}><div className="muted" style={{ fontSize: 12 }}>Net P&amp;L</div><b style={{ fontSize: 20 }}><Money value={s.total} cents={false} /></b></div>
        <div className="card" style={{ padding: 14 }}><div className="muted" style={{ fontSize: 12 }}>Trades</div><b style={{ fontSize: 20 }}>{s.count}</b></div>
        <div className="card" style={{ padding: 14 }}><div className="muted" style={{ fontSize: 12 }}>Win rate</div><b style={{ fontSize: 20 }}>{s.winRate.toFixed(0)}%</b></div>
      </div>
      <button className="btn primary" style={{ width: '100%', height: 50, marginTop: 18 }} disabled={busy} onClick={download}><FileDown size={17} /> Download PDF</button>
      <p className="dim" style={{ fontSize: 12.5, marginBottom: 0 }}>Uses your {mode === 'paper' ? 'paper' : 'live'} money journal.</p>
    </Dialog>
  );
}
