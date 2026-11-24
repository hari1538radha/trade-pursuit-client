import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Quote, X, BellOff } from 'lucide-react';

// Discipline lines written for this app, plus short public-domain quotes (with the translation named)
const QUOTES = [
  ['Your edge only works if you let it play out. Follow the plan.'],
  ['No setup, no trade. Waiting is a position too.'],
  ['Protect the account first. Profits come from what you keep.'],
  ['One trade does not make you. One trade should never break you.'],
  ['Revenge is not a strategy. Close the chart and reset.'],
  ['Cut the loss at your stop, not at your hope.'],
  ['Size small enough that you can think clearly.'],
  ['The market will be open tomorrow. Make sure you are still in the game.'],
  ['Discipline is doing the boring thing every single time.'],
  ['You are paid for patience, not for activity.'],
  ['Journal the trade while it still stings. That is where the lesson is.'],
  ['Hit your daily limit? You are done. That rule exists for days like this.'],
  ['A missed trade costs nothing. A forced trade costs plenty.'],
  ['Be the trader who follows rules on the bad days too.'],
  ['Process over P&L. Grade the decision, not the outcome.'],
  ['Calm mind, clear levels, small risk.'],
  ['Every rule you break today is a habit you are building.'],
  ['Funded traders are not the boldest. They are the most consistent.'],
  ['Stop looking for the perfect entry and start honouring the stop.'],
  ['Win the morning: plan, levels, risk. Then let the trade come to you.'],
  ['He who overcomes others is strong; he who overcomes himself is mighty.', 'Lao Tzu, Tao Te Ching (tr. James Legge)'],
  ['No longer talk at all about the kind of man that a good man ought to be, but be such.', 'Marcus Aurelius, Meditations (tr. George Long)'],
  ['Nothing, Lucilius, is ours, except time.', 'Seneca, Letters (tr. R. M. Gummere)'],
  ['No man is free who is not master of himself.', 'Epictetus'],
  ['First say to yourself what you would be; and then do what you have to do.', 'Epictetus, Discourses'],
  ['Well done is better than well said.', 'Benjamin Franklin'],
  ['The superior man is modest in his speech, but exceeds in his actions.', 'Confucius, Analects (tr. James Legge)'],
  ['It never was my thinking that made the big money for me. It always was my sitting.', 'Reminiscences of a Stock Operator (1923)'],
  ['There is nothing new in Wall Street. There can\'t be because speculation is as old as the hills.', 'Reminiscences of a Stock Operator (1923)'],
];

const KEY = 'tp.quotes';
const todayStr = () => new Date().toISOString().slice(0, 10);
const paused = () => { try { return localStorage.getItem(KEY) === todayStr() || localStorage.getItem(KEY) === 'off'; } catch { return false; } };
const rand = (a, b) => a + Math.random() * (b - a);
const MIN = 60 * 1000;

/**
 * A short discipline quote in the middle of the screen at random times
 * (first after 2–5 minutes, then every 8–20 minutes). Skips when a dialog is open
 * or the tab is hidden, closes itself after 14 seconds, and can be paused for the day.
 */
export default function QuotePop() {
  const [q, setQ] = useState(null);
  const last = useRef(-1);
  useEffect(() => {
    let t;
    const schedule = (ms) => { t = setTimeout(show, ms); };
    const show = () => {
      if (paused()) return schedule(rand(20, 40) * MIN);
      if (document.hidden || document.querySelector('.overlay')) return schedule(rand(1, 3) * MIN);
      let i; do { i = Math.floor(Math.random() * QUOTES.length); } while (i === last.current && QUOTES.length > 1);
      last.current = i;
      setQ(QUOTES[i]);
      schedule(rand(8, 20) * MIN);
    };
    schedule(rand(2, 5) * MIN);
    const now = () => show();
    window.addEventListener('tp-quote', now); // for trying it out: window.dispatchEvent(new Event('tp-quote'))
    return () => { clearTimeout(t); window.removeEventListener('tp-quote', now); };
  }, []);
  useEffect(() => {
    if (!q) return;
    const t = setTimeout(() => setQ(null), 14000);
    const k = (e) => e.key === 'Escape' && setQ(null);
    window.addEventListener('keydown', k);
    return () => { clearTimeout(t); window.removeEventListener('keydown', k); };
  }, [q]);

  return (
    <AnimatePresence>
      {q && (
        <motion.div className="quote-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQ(null)}>
          <motion.div className="quote-card" role="status" aria-live="polite" initial={{ scale: 0.9, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }} onClick={(e) => e.stopPropagation()}>
            <button className="close-x sm" aria-label="Close" onClick={() => setQ(null)}><X size={15} /></button>
            <div className="quote-ico"><Quote size={20} /></div>
            <p className="quote-text">{q[0]}</p>
            <div className="quote-by">{q[1] ? `— ${q[1]}` : 'Trade Pursuit · stay disciplined'}</div>
            <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 18 }}>
              <button className="btn sm ghost" onClick={() => { try { localStorage.setItem(KEY, todayStr()); } catch { /* ignore */ } setQ(null); }}><BellOff size={13} /> Pause for today</button>
              <button className="btn sm primary" onClick={() => setQ(null)}>Got it</button>
            </div>
            <motion.i className="quote-timer" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 14, ease: 'linear' }} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
