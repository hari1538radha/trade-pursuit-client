import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, Plus } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Money, Reveal, Empty } from '../components/ui.jsx';
import { groupBy, summary } from '../lib/stats.js';

export default function Strategy() {
  const { trades, settings, breakEven, openModal } = useApp();
  const books = settings.tags?.playbooks || [];
  const stats = useMemo(() => groupBy(trades, (t) => t.playbook, breakEven), [trades, breakEven]);
  const untagged = trades.filter((t) => !t.noTrade && !t.playbook).length;
  return (
    <div className="page">
      <div className="row between">
        <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Strategy</h1><div className="muted">Your playbooks and how each one performs</div></div>
        <button className="btn" onClick={() => openModal('settings', { tab: 'Tags' })}><Plus size={15} /> Edit playbooks</button>
      </div>
      {books.length === 0 ? <Empty icon={<Target />} title="No playbooks yet">Add the setups you trade, then tag each trade with one.</Empty> : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', marginTop: 24 }}>
          {books.map((b, i) => {
            const st = stats.find((s) => s.key === b) || { count: 0, pnl: 0, winRate: 0, avg: 0 };
            const ts = trades.filter((t) => t.playbook === b);
            const s = summary(ts, breakEven);
            return (
              <Reveal key={b} delay={i * 0.05} className="card">
                <div className="row between"><b style={{ fontSize: 22 }}>{b}</b><span className="tag">{st.count} trades</span></div>
                <div style={{ fontSize: 36, fontWeight: 700, margin: '14px 0' }}><Money value={st.pnl} cents={false} /></div>
                <div className="bar" style={{ height: 6 }}><motion.i initial={{ width: 0 }} whileInView={{ width: `${st.winRate}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} style={{ background: st.pnl >= 0 ? 'var(--green)' : 'var(--red)' }} /></div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 14, gap: 8 }}>
                  {[['Win rate', `${st.winRate.toFixed(0)}%`], ['Avg trade', <Money key="a" value={st.avg || 0} cents={false} />], ['Avg win R', s.avgWinRR != null ? `${s.avgWinRR.toFixed(1)}R` : '—']].map(([l, v]) => <div key={l}><div className="muted" style={{ fontSize: 12 }}>{l}</div><b>{v}</b></div>)}
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
      {untagged > 0 && <p className="muted" style={{ marginTop: 20 }}>{untagged} trades have no playbook. Open them in the Journal to tag them.</p>}
    </div>
  );
}
