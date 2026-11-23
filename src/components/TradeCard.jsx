import { motion } from 'framer-motion';
import { Clock, ArrowUpRight, ArrowDownRight, Copy, Trash2 } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Money, SymbolIcon } from './ui.jsx';
import { tradeScore } from '../lib/stats.js';
import { dayMonth } from '../lib/dates.js';
import { rr } from '../lib/format.js';

export default function TradeCard({ t, i = 0 }) {
  const { openModal, accounts, saveTrade, deleteTrade, notify, api, confirmAsk } = useApp();
  const sc = tradeScore(t);
  const accs = (t.accounts || []).map((id) => accounts.find((a) => a.id === id)).filter(Boolean);
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  if (t.noTrade) {
    return (
      <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} className="trade-card" onClick={() => openModal('log', { trade: t })}>
        <div className="row between"><b style={{ fontSize: 18 }}>✓ No Trade</b><Money value={0} /></div>
        <p className="muted" style={{ marginBottom: 0 }}>{t.notes || 'Sat out. That counts.'}</p>
      </motion.div>
    );
  }
  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: Math.min(i, 8) * 0.04 }} className="trade-card" onClick={() => openModal('log', { trade: t })}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 10 }}>
          <SymbolIcon symbol={t.symbol} />
          {t.grade && <span className="grade-badge">{t.grade}</span>}
          <b style={{ fontSize: 20 }}>{t.symbol || '—'}</b>
          <span className="tag" style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '.08em' }}>{t.direction}</span>
          {accs.length > 0 && <span className="tag">{accs[0].name}{accs.length > 1 ? ` +${accs.length - 1}` : ''}</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <b style={{ fontSize: 20 }}><Money value={t.pnl} /></b>
          {Number.isFinite(t.realizedRR) && <div style={{ fontWeight: 600 }}>{rr(t.realizedRR)}</div>}
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 14 }}>
        {t.tradeType && <span className="tag"><span className="dot" />{t.tradeType}</span>}
        {t.session && t.session !== 'No session' && <span className="tag"><Clock size={12} />{t.session}</span>}
        {t.playbook && <span className="tag">{t.playbook}</span>}
        {[...(t.confluences || []), ...(t.targets || [])].slice(0, 4).map((c) => <span key={c} className="tag" style={{ background: '#1f1f24' }}>{c}</span>)}
      </div>
      <div className="nochart">{t.images?.[0] ? <img src={t.images[0]} alt="chart" /> : 'NO CHART'}</div>
      {t.notes && <p style={{ color: '#c4c4cb', fontSize: 13.5, lineHeight: 1.55, margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.notes}</p>}
      {(t.emotionsPos?.length > 0 || t.emotionsNeg?.length > 0) && (
        <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
          {t.emotionsPos?.map((e) => <span key={e} className="tag" style={{ color: '#86efac' }}>{e}</span>)}
          {t.emotionsNeg?.map((e) => <span key={e} className="tag" style={{ color: '#fca5a5' }}>{e}</span>)}
        </div>
      )}
      <div className="row" style={{ gap: 12, fontSize: 13 }}>
        <span className="muted" style={{ whiteSpace: 'nowrap' }}>{dayMonth(t.date)}</span>
        <span className="muted">{t.assetClass}</span>
        {t.entryTime && <span className="muted row" style={{ gap: 4 }}><Clock size={12} />{t.entryTime.slice(0, 5)}</span>}
        <div className="score"><motion.i initial={{ width: 0 }} animate={{ width: `${sc.score}%` }} transition={{ duration: 0.8 }} /></div>
        <b style={{ whiteSpace: 'nowrap' }}>{sc.score} · {sc.label}</b>
        <span className="row" style={{ gap: 2 }}>{t.pnl > 0 ? <ArrowUpRight size={14} /> : t.pnl < 0 ? <ArrowDownRight size={14} /> : null}{t.pnl > 0 ? 'Win' : t.pnl < 0 ? 'Loss' : 'BE'}</span>
        <button className="icon-btn" style={{ width: 26, height: 26 }} title="Duplicate" onClick={stop(async () => { const { id, createdAt, updatedAt, user, ...rest } = t; await saveTrade(rest); notify('Duplicated'); })}><Copy size={13} /></button>
        <button className="icon-btn" style={{ width: 26, height: 26 }} title="Delete" onClick={stop(async () => { if (await confirmAsk('Delete this trade?')) { await deleteTrade(t.id); notify('Deleted'); } })}><Trash2 size={13} /></button>
      </div>
    </motion.div>
  );
}
