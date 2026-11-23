import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Brain, ChevronDown, ChevronUp, Leaf, Ban, Heart, X, Check, Plus } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Money } from './ui.jsx';
import { emotionCheck, avoidList } from '../lib/coach.js';
import { today } from '../lib/dates.js';
import { cls } from '../lib/format.js';

const TONE = {
  steady: { c: 'var(--green)', bg: 'rgba(74,222,128,.08)', label: 'Steady' },
  mixed: { c: '#e5b53a', bg: 'rgba(229,181,58,.08)', label: 'Watch it' },
  tilt: { c: 'var(--red)', bg: 'rgba(248,113,113,.10)', label: 'Tilt risk' },
  none: { c: '#8b8b95', bg: 'rgba(255,255,255,.03)', label: 'No data' },
};

/**
 * Always-on coach panel (bottom-right). Two tabs:
 *  - Last 5 trades: emotions handled, highlighted by state
 *  - Don't do next: data-backed list of what to avoid on the next trade
 * Plus a once-a-day "Before you trade" popup and a post-loss nudge.
 */
export default function CoachDock() {
  const { trades, breakEven, settings, updateUser, notify } = useApp();
  const nav = useNavigate();
  const lookback = settings.coach?.lookback || 5;
  const [open, setOpen] = useState(() => localStorage.getItem('tp.coach.open') !== '0');
  const [tab, setTab] = useState('emotions');
  const [brief, setBrief] = useState(false);
  const [nudge, setNudge] = useState(null);
  const [draft, setDraft] = useState('');

  const check = useMemo(() => emotionCheck(trades, lookback, breakEven), [trades, lookback, breakEven]);
  const avoid = useMemo(() => avoidList(trades, { be: breakEven, donts: settings.donts || [] }), [trades, breakEven, settings.donts]);
  const tone = TONE[check.state];

  // Daily "before you trade" briefing (once per day)
  useEffect(() => {
    if (avoid.length && localStorage.getItem('tp.brief') !== today()) { const t = setTimeout(() => setBrief(true), 900); return () => clearTimeout(t); }
  }, [avoid.length]);

  // Nudge right after a losing or emotional trade is logged
  const newest = check.last[0];
  useEffect(() => {
    if (!newest) return;
    const seen = sessionStorage.getItem('tp.nudged');
    if (seen === newest.id) return;
    const fresh = sessionStorage.getItem('tp.lastSeen');
    sessionStorage.setItem('tp.lastSeen', newest.id);
    if (!fresh || fresh === newest.id) return; // only for trades logged during this visit
    if (newest.pnl < 0 || newest.neg.length || !newest.followedPlan) {
      sessionStorage.setItem('tp.nudged', newest.id);
      setNudge(newest);
    }
  }, [newest]);

  const setOpenP = (v) => { setOpen(v); localStorage.setItem('tp.coach.open', v ? '1' : '0'); };
  const addDont = async (text) => {
    const v = text.trim(); if (!v) return;
    await updateUser({ settings: { donts: [...new Set([...(settings.donts || []), v])] } });
    setDraft(''); notify('Added to your rules');
  };
  const removeDont = (text) => updateUser({ settings: { donts: (settings.donts || []).filter((d) => d !== text) } });

  if (settings.coach?.enabled === false) return null;

  return (
    <>
      <motion.div
        className={cls('coach', check.state === 'tilt' && 'coach-tilt')}
        style={{ '--tone': tone.c, '--tone-bg': tone.bg }}
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      >
        <button className="coach-head" onClick={() => setOpenP(!open)}>
          <span className="coach-dot" />
          <Brain size={16} />
          <b>Coach</b>
          <span className="coach-state">{tone.label}</span>
          <span className="grow" />
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div className="coach-tabs">
                <button className={cls(tab === 'emotions' && 'on')} onClick={() => setTab('emotions')}><Heart size={13} /> Last {lookback} trades</button>
                <button className={cls(tab === 'avoid' && 'on')} onClick={() => setTab('avoid')}><Ban size={13} /> Don't do next{avoid.length ? ` (${avoid.length})` : ''}</button>
              </div>
              <div className="coach-body">
                {tab === 'emotions' ? (
                  <>
                    <p className="coach-headline">{check.headline}</p>
                    {check.last.length > 0 && (
                      <>
                        <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
                          {check.neg.map((e) => <span key={e.name} className="emo neg">{e.name} ×{e.n}</span>)}
                          {check.pos.map((e) => <span key={e.name} className="emo pos">{e.name} ×{e.n}</span>)}
                          {!check.neg.length && !check.pos.length && <span className="muted" style={{ fontSize: 12 }}>No emotions tagged. Tag them in Log Trade to get a better read.</span>}
                        </div>
                        <div className="col" style={{ gap: 6 }}>
                          {check.last.map((t) => (
                            <div key={t.id} className="coach-row">
                              <b style={{ width: 62, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.symbol || '—'}</b>
                              <span className="grow row wrap" style={{ gap: 4 }}>
                                {t.neg.map((e) => <i key={e} className="emo neg sm">{e}</i>)}
                                {t.pos.map((e) => <i key={e} className="emo pos sm">{e}</i>)}
                                {!t.followedPlan && <i className="emo neg sm">Off-plan</i>}
                                {!t.neg.length && !t.pos.length && t.followedPlan && <i className="dim" style={{ fontSize: 11 }}>—</i>}
                              </span>
                              <Money value={t.pnl} cents={false} className="mono" />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {avoid.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Log a few more trades and I'll list exactly what's costing you. Or add your own rule below.</p>}
                    <ol className="avoid">
                      {avoid.slice(0, 6).map((a) => (
                        <li key={a.text}>
                          <div className="row between" style={{ gap: 8 }}>
                            <b>{a.text}</b>
                            {a.source === 'mine' && <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => removeDont(a.text)} title="Remove"><X size={12} /></button>}
                          </div>
                          <span>{a.why}</span>
                        </li>
                      ))}
                    </ol>
                    <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); addDont(draft); }}>
                      <input className="input" style={{ padding: '8px 10px', fontSize: 13 }} placeholder="Add your own rule…" value={draft} onChange={(e) => setDraft(e.target.value)} />
                      <button className="icon-btn" type="submit"><Plus size={15} /></button>
                    </form>
                  </>
                )}
                <button className="btn sm" style={{ width: '100%', marginTop: 12 }} onClick={() => nav('/calm')}><Leaf size={14} /> Calm my mind</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Daily briefing */}
      <AnimatePresence>
        {brief && (
          <motion.div className="overlay center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="dialog" initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} style={{ borderColor: 'var(--loss-line)' }}>
              <div className="eyebrow" style={{ color: 'var(--red)' }}>Before you trade today</div>
              <h2 style={{ margin: '6px 0 4px', fontSize: 28, letterSpacing: '-.02em' }}>Don't do these.</h2>
              <p className="muted" style={{ marginTop: 0 }}>Pulled from your own journal. Each one has already cost you money.</p>
              <ol className="avoid big">
                {avoid.slice(0, 5).map((a) => <li key={a.text}><b>{a.text}</b><span>{a.why}</span></li>)}
              </ol>
              <div className="row" style={{ marginTop: 18 }}>
                <button className="btn" onClick={() => { setBrief(false); nav('/calm'); }}><Leaf size={15} /> Calm first</button>
                <button className="btn primary grow" onClick={() => { localStorage.setItem('tp.brief', today()); setBrief(false); }}><Check size={16} /> Got it, I'll follow these</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-trade nudge */}
      <AnimatePresence>
        {nudge && !brief && (
          <motion.div className="coach-nudge" initial={{ opacity: 0, y: 20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 20, x: '-50%' }}>
            <div className="row between"><b>{nudge.pnl < 0 ? 'Loss logged.' : 'Logged.'} Pause before the next one.</b><button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setNudge(null)}><X size={14} /></button></div>
            <p className="muted" style={{ margin: '6px 0 10px', fontSize: 13 }}>
              {nudge.neg.length ? `You tagged ${nudge.neg.join(', ').toLowerCase()}. ` : ''}{!nudge.followedPlan ? 'That one was off-plan. ' : ''}
              {avoid[0] ? `Top rule right now: ${avoid[0].text.toLowerCase()}.` : 'Breathe, re-read your plan, then decide.'}
            </p>
            <div className="row"><button className="btn sm" onClick={() => { setNudge(null); nav('/calm'); }}><Leaf size={14} /> 2-minute reset</button><button className="btn sm ghost" onClick={() => setNudge(null)}>I'm fine</button></div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
