import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Leaf, Play, Pause, Volume2, VolumeX, RotateCcw, Timer, Check } from 'lucide-react';
import { Seg, Reveal } from '../components/ui.jsx';
import { useApp } from '../store/AppContext.jsx';
import { emotionCheck } from '../lib/coach.js';
import { cls } from '../lib/format.js';

const PATTERNS = {
  'Box 4-4-4-4': { steps: [['Breathe in', 4, 1.25], ['Hold', 4, 1.25], ['Breathe out', 4, 0.8], ['Hold', 4, 0.8]], note: 'Used to steady nerves under pressure. Equal counts, slow and even.' },
  '4-7-8': { steps: [['Breathe in', 4, 1.25], ['Hold', 7, 1.25], ['Breathe out slowly', 8, 0.8]], note: 'A long exhale slows your heart rate. Good after a loss.' },
  'Double sigh': { steps: [['Breathe in', 2, 1.15], ['Top up, in again', 1, 1.28], ['Long sigh out', 6, 0.8]], note: 'Two inhales, one long exhale. The fastest way to come down from a spike.' },
};
const GROUND = ['Name 5 things you can see', 'Feel 4 things you can touch', 'Notice 3 sounds around you', 'Notice 2 things you can smell', 'Take 1 slow breath and relax your shoulders'];
const RESET = ['Close the chart for now', 'Stand up and drink water', 'Re-read your trading plan', 'Write one line about how you feel', 'Decide: is the next trade in the plan?'];
const LINES = [
  'The market will be here tomorrow. Your account needs to be too.',
  'One trade does not define you. Your process does.',
  'You don’t need to win it back today.',
  'Missing a trade costs nothing. Forcing one does.',
  'Protect the account first. Profits follow discipline.',
  'Calm traders see the setup. Rushed traders see the money.',
];

export default function Calm() {
  const { trades, breakEven } = useApp();
  const check = emotionCheck(trades, 5, breakEven);
  const [pattern, setPattern] = useState('Box 4-4-4-4');
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [left, setLeft] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [sound, setSound] = useState(false);
  const [ground, setGround] = useState([]);
  const [reset, setReset] = useState([]);
  const [line, setLine] = useState(0);
  const [cool, setCool] = useState(() => { try { return Number(localStorage.getItem('tp.cooldown')) || 0; } catch { return 0; } });
  const [, tick] = useState(0);
  const audio = useRef(null);

  const steps = PATTERNS[pattern].steps;
  // Breathing loop
  useEffect(() => {
    if (!running) return;
    setLeft(steps[step][1]);
    const t = setInterval(() => setLeft((l) => {
      if (l > 1) return l - 1;
      setStep((s) => { const n = (s + 1) % steps.length; if (n === 0) setCycles((c) => c + 1); return n; });
      return 0;
    }), 1000);
    return () => clearInterval(t);
  }, [running, step, pattern]); // eslint-disable-line
  useEffect(() => { setStep(0); setCycles(0); setRunning(false); }, [pattern]);
  useEffect(() => { const t = setInterval(() => setLine((l) => (l + 1) % LINES.length), 9000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);

  // Soft brown-noise "ocean" made in the browser (no files, no network)
  const toggleSound = () => {
    if (sound) { audio.current?.ctx.close(); audio.current = null; setSound(false); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const gain = ctx.createGain(); gain.gain.value = 0.25;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.12;
      lfo.connect(lg).connect(gain.gain); src.connect(gain).connect(ctx.destination); src.start(); lfo.start();
      audio.current = { ctx }; setSound(true);
    } catch { /* audio not allowed */ }
  };
  useEffect(() => () => audio.current?.ctx.close(), []);

  const [label, , scale] = steps[step];
  const coolLeft = Math.max(0, Math.ceil((cool - Date.now()) / 1000));
  const startCool = (min) => { const until = Date.now() + min * 60000; setCool(until); try { localStorage.setItem('tp.cooldown', String(until)); } catch { /* */ } };

  return (
    <div className="page calm-page">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><Leaf size={22} style={{ color: 'var(--green)' }} /> Mind Calm</h1><div className="muted">Reset before the next decision. Two minutes is enough.</div></div>
        <button className={cls('btn', sound && 'primary')} onClick={toggleSound}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />} Calm sound {sound ? 'on' : 'off'}</button>
      </div>

      {check.state === 'tilt' && (
        <Reveal className="banner" style={{ marginTop: 18, borderColor: '#5a2a2e', background: 'rgba(248,113,113,.06)' }}>
          <div className="grow"><b className="neg">Your last trades show tilt risk.</b><div className="muted">{check.headline}</div></div>
          <button className="btn" onClick={() => startCool(15)}><Timer size={15} /> Start 15-min cooldown</button>
        </Reveal>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))', marginTop: 20 }}>
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <Seg options={Object.keys(PATTERNS)} value={pattern} onChange={setPattern} />
          <div className="breath-wrap">
            <motion.div className="breath-ring" animate={{ scale: running ? scale : 1 }} transition={{ duration: running ? steps[step][1] : 0.6, ease: 'easeInOut' }} />
            <motion.div className="breath-core" animate={{ scale: running ? scale * 0.92 : 0.95 }} transition={{ duration: running ? steps[step][1] : 0.6, ease: 'easeInOut' }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{running ? label : 'Ready'}</div>
              {running && <div style={{ fontSize: 44, fontWeight: 700 }}>{left || steps[step][1]}</div>}
            </motion.div>
          </div>
          <p className="muted" style={{ minHeight: 40 }}>{PATTERNS[pattern].note}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => setRunning((r) => !r)}>{running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Start</>}</button>
            <button className="btn" onClick={() => { setRunning(false); setStep(0); setCycles(0); }}><RotateCcw size={15} /> Reset</button>
          </div>
          <div className="muted" style={{ marginTop: 12 }}>{cycles} round{cycles === 1 ? '' : 's'} done · aim for 5</div>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div className="card">
            <h3>Tilt cooldown</h3>
            <div className="sub" style={{ marginBottom: 12 }}>Lock yourself out mentally. No new trades until the timer ends.</div>
            {coolLeft > 0 ? (
              <div className="row between"><div style={{ fontSize: 40, fontWeight: 700 }} className="mono">{String(Math.floor(coolLeft / 60)).padStart(2, '0')}:{String(coolLeft % 60).padStart(2, '0')}</div><button className="btn sm ghost" onClick={() => startCool(0)}>End early</button></div>
            ) : (
              <div className="row wrap">{[5, 15, 30, 60].map((m) => <button key={m} className="btn sm" onClick={() => startCool(m)}>{m} min</button>)}</div>
            )}
          </div>
          <div className="card">
            <h3>Reset checklist</h3>
            <div className="col" style={{ gap: 8, marginTop: 10 }}>
              {RESET.map((r) => <Tick key={r} on={reset.includes(r)} onClick={() => setReset((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))}>{r}</Tick>)}
            </div>
            {reset.length === RESET.length && <p className="pos" style={{ marginBottom: 0 }}>Reset complete. Trade only what's in your plan.</p>}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))', marginTop: 14 }}>
        <div className="card">
          <h3>5-4-3-2-1 grounding</h3>
          <div className="sub" style={{ marginBottom: 10 }}>Pulls your attention out of the P&amp;L and back into the room.</div>
          <div className="col" style={{ gap: 8 }}>{GROUND.map((g) => <Tick key={g} on={ground.includes(g)} onClick={() => setGround((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))}>{g}</Tick>)}</div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 200 }}>
          <div className="eyebrow">Remember</div>
          <AnimatePresence mode="wait">
            <motion.p key={line} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ fontSize: 24, lineHeight: 1.35, letterSpacing: '-.01em', margin: '12px 0 0' }}>{LINES[line]}</motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Tick({ on, onClick, children }) {
  return (
    <button className="row" style={{ gap: 10, textAlign: 'left', color: on ? 'var(--muted)' : '#dcdce2' }} onClick={onClick}>
      <motion.span animate={{ background: on ? '#4ade80' : 'rgba(0,0,0,0)', borderColor: on ? '#4ade80' : '#55555e' }} style={{ width: 18, height: 18, borderRadius: 6, border: '1.5px solid', display: 'grid', placeItems: 'center', color: '#052', flex: 'none' }}>{on && <Check size={12} />}</motion.span>
      <span style={{ textDecoration: on ? 'line-through' : 'none' }}>{children}</span>
    </button>
  );
}
