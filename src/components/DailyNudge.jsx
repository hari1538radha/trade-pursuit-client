import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, X, Plus, CalendarOff, Clock } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { today } from '../lib/dates.js';

const KEY = 'tp.nudge';
const SNOOZE = 2 * 60 * 60 * 1000;
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const write = (v) => localStorage.setItem(KEY, JSON.stringify(v));

/**
 * Once a day (Mon–Fri): if nothing is logged for today, ask the trader to log
 * their trades or mark a No Trade Day. Dismiss hides it until tomorrow;
 * "Later" snoozes it for 2 hours.
 */
export default function DailyNudge() {
  const { allTrades, openModal, modal } = useApp();
  const [show, setShow] = useState(false);
  const [tick, setTick] = useState(0);
  const d = today();
  const logged = allTrades.some((t) => t.date === d);

  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const wd = new Date().getDay();
    const s = read();
    const blocked = logged || wd === 0 || wd === 6 || s.dismissed === d || (s.snoozeUntil && Date.now() < s.snoozeUntil);
    if (blocked) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), 3500); // let the page settle first
    return () => clearTimeout(t);
  }, [logged, d, tick]);

  const close = (patch) => { write({ ...read(), ...patch }); setShow(false); };
  const visible = show && !modal; // never on top of an open sheet

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="nudge" role="dialog" aria-live="polite" initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.97 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <motion.span className="bell" animate={{ rotate: [0, -14, 12, -8, 6, 0] }} transition={{ duration: 0.9, delay: 0.3, repeat: 2, repeatDelay: 2.5 }}><BellRing size={19} /></motion.span>
            <div className="grow">
              <b style={{ fontSize: 15.5 }}>Nothing logged for today</b>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.45 }}>Traded? Log it while it's fresh. Sat out? Log a <b className="text2">No Trade Day</b> so your streaks and discipline stats count it.</p>
            </div>
            <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Dismiss until tomorrow" title="Don't remind me today" onClick={() => close({ dismissed: d })}><X size={15} /></button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <button className="btn sm primary grow" onClick={() => { close({ snoozeUntil: Date.now() + SNOOZE }); openModal('log', { tab: 'No Trade Day' }); }}><CalendarOff size={14} /> No trade day</button>
            <button className="btn sm grow" onClick={() => { close({ snoozeUntil: Date.now() + SNOOZE }); openModal('quick'); }}><Plus size={14} /> Log trade</button>
            <button className="btn sm ghost" title="Remind me in 2 hours" onClick={() => close({ snoozeUntil: Date.now() + SNOOZE })}><Clock size={14} /> Later</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
