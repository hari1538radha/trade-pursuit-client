import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GraduationCap, Check, X, RotateCcw, ArrowRight, Trophy } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Reveal } from '../components/ui.jsx';
import { TOPICS, QUESTIONS, pick } from '../lib/quizBank.js';
import { cls } from '../lib/format.js';
import { relTime } from '../lib/dates.js';

export default function Quiz() {
  const { api, notify } = useApp();
  const [history, setHistory] = useState([]);
  const [run, setRun] = useState(null); // { topic, qs, i, picked, answers: [{id, ok}] }
  useEffect(() => { api.quiz.list().then((r) => setHistory(r.results)).catch(() => {}); }, [api]);

  // Questions most recently answered wrong (for "Review my mistakes")
  const missed = useMemo(() => {
    const wrong = new Set();
    for (const r of history.slice().reverse()) { // oldest first, so later answers win
      for (const id of r.asked || []) if (!(r.missed || []).includes(id)) wrong.delete(id);
      for (const id of r.missed || []) wrong.add(id);
    }
    return [...wrong].filter((id) => QUESTIONS.some((q) => q.id === id));
  }, [history]);
  const best = history.length ? Math.max(...history.map((r) => Math.round((r.score / r.total) * 100))) : null;
  const byTopic = useMemo(() => {
    const m = {};
    for (const r of history) { const k = r.topic || 'mixed'; m[k] = m[k] || { s: 0, t: 0 }; m[k].s += r.score; m[k].t += r.total; }
    return m;
  }, [history]);

  const start = (opts, topic = 'mixed') => setRun({ topic, qs: pick(opts), i: 0, picked: null, answers: [] });
  const finish = async (r) => {
    const score = r.answers.filter((a) => a.ok).length;
    try { const { result } = await api.quiz.save({ topic: r.topic, score, total: r.qs.length, missed: r.answers.filter((a) => !a.ok).map((a) => a.id), asked: r.answers.map((a) => a.id) }); setHistory((h) => [result, ...h]); }
    catch (e) { notify(e.message); }
  };

  if (run) return <Runner run={run} setRun={setRun} onFinish={finish} onExit={() => setRun(null)} />;

  return (
    <div className="page">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><GraduationCap size={24} /> Trading Quiz</h1><div className="muted">{QUESTIONS.length} questions on risk, psychology, prop rules, price action, options and Indian markets.</div></div>
        <button className="btn primary" onClick={() => start({ n: 10 })}><ArrowRight size={16} /> Quick 10</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', marginTop: 20 }}>
        {[['Quizzes taken', history.length], ['Best score', best != null ? `${best}%` : '—'], ['Questions to review', missed.length]].map(([l, v], i) => (
          <Reveal key={l} delay={i * 0.04} className="card stat"><div className="label">{l}</div><div className="val" style={{ fontSize: 30 }}>{v}</div></Reveal>
        ))}
      </div>

      {missed.length > 0 && (
        <Reveal className="banner" style={{ marginTop: 14 }}>
          <div className="grow"><b>Review your mistakes</b><div className="muted">{missed.length} question{missed.length > 1 ? 's' : ''} you got wrong last time. Get them right to clear them.</div></div>
          <button className="btn" onClick={() => start({ ids: missed, n: missed.length }, 'review')}><RotateCcw size={15} /> Review</button>
        </Reveal>
      )}

      <div className="eyebrow" style={{ margin: '26px 0 12px' }}>By topic</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>
        {Object.entries(TOPICS).map(([k, label], i) => {
          const n = QUESTIONS.filter((q) => q.t === k).length;
          const st = byTopic[k];
          const pctv = st ? Math.round((st.s / st.t) * 100) : null;
          return (
            <Reveal key={k} delay={i * 0.03}>
              <button className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => start({ topic: k, n }, k)}>
                <div className="row between"><b style={{ fontSize: 17 }}>{label}</b><span className="tag">{n} Qs</span></div>
                <div className="bar" style={{ marginTop: 14, height: 6 }}><motion.i initial={{ width: 0 }} animate={{ width: `${pctv || 0}%` }} style={{ background: pctv >= 80 ? 'var(--green)' : pctv >= 50 ? 'var(--gold)' : pctv != null ? 'var(--red)' : '#444' }} /></div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{pctv != null ? `${pctv}% correct so far` : 'Not attempted yet'}</div>
              </button>
            </Reveal>
          );
        })}
      </div>

      {history.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '26px 0 12px' }}>Recent results</div>
          <div className="card" style={{ padding: 6 }}>
            <table className="list"><tbody>
              {history.slice(0, 10).map((r) => (
                <tr key={r.id}><td>{TOPICS[r.topic] || (r.topic === 'review' ? 'Mistake review' : 'Mixed')}</td><td><b>{r.score}/{r.total}</b></td><td>{Math.round((r.score / r.total) * 100)}%</td><td className="muted" style={{ textAlign: 'right' }}>{relTime(r.createdAt)} ago</td></tr>
              ))}
            </tbody></table>
          </div>
        </>
      )}
    </div>
  );
}

function Runner({ run, setRun, onFinish, onExit }) {
  const q = run.qs[run.i];
  const done = run.i >= run.qs.length;
  const score = run.answers.filter((a) => a.ok).length;
  const choose = (k) => {
    if (run.picked != null) return;
    setRun({ ...run, picked: k, answers: [...run.answers, { id: q.id, ok: k === q.a }] });
  };
  const next = () => {
    const nr = { ...run, i: run.i + 1, picked: null };
    setRun(nr);
    if (nr.i >= nr.qs.length) onFinish(nr);
  };
  useEffect(() => {
    const k = (e) => {
      if (done) return;
      if (run.picked == null && /^[1-4]$/.test(e.key)) choose(+e.key - 1);
      else if (run.picked != null && e.key === 'Enter') next();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  if (done) {
    const pctv = Math.round((score / run.qs.length) * 100);
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Reveal className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Trophy size={40} style={{ color: pctv >= 80 ? 'var(--gold)' : 'var(--muted)' }} />
          <h1 style={{ fontSize: 56, margin: '10px 0 0', letterSpacing: '-.03em' }}>{score}/{run.qs.length}</h1>
          <p className="muted" style={{ fontSize: 17 }}>{pctv >= 90 ? 'Excellent. You know this cold.' : pctv >= 70 ? 'Solid. Review the misses and you’re there.' : 'Worth another round. The explanations are where the learning is.'}</p>
          <div className="col" style={{ gap: 8, textAlign: 'left', marginTop: 20 }}>
            {run.qs.map((qq, i) => (
              <div key={qq.id} className="row" style={{ gap: 10, alignItems: 'flex-start', fontSize: 14 }}>
                {run.answers[i]?.ok ? <Check size={16} className="pos" /> : <X size={16} className="neg" />}
                <span><span style={{ color: '#ddd' }}>{qq.q}</span>{!run.answers[i]?.ok && <div className="muted" style={{ fontSize: 13 }}>Answer: {qq.o[qq.a]}</div>}</span>
              </div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
            <button className="btn" onClick={onExit}>Back to quizzes</button>
            <button className="btn primary" onClick={() => setRun({ ...run, qs: pick({ n: run.qs.length, topic: run.topic in TOPICS ? run.topic : undefined }), i: 0, picked: null, answers: [] })}><RotateCcw size={15} /> Try again</button>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <div className="row between">
        <button className="btn sm ghost" onClick={onExit}><X size={14} /> Quit</button>
        <span className="muted mono">{run.i + 1} / {run.qs.length} · {score} correct</span>
      </div>
      <div className="bar" style={{ margin: '14px 0 24px', height: 5 }}><motion.i animate={{ width: `${(run.i / run.qs.length) * 100}%` }} /></div>
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          <div className="eyebrow">{TOPICS[q.t]}</div>
          <h2 style={{ fontSize: 26, lineHeight: 1.3, letterSpacing: '-.02em', margin: '8px 0 22px' }}>{q.q}</h2>
          <div className="col" style={{ gap: 10 }}>
            {q.o.map((opt, k) => {
              const state = run.picked == null ? '' : k === q.a ? 'right' : k === run.picked ? 'wrong' : 'dim';
              return (
                <motion.button key={k} whileTap={{ scale: 0.99 }} className={cls('quiz-opt', state)} onClick={() => choose(k)}>
                  <span className="quiz-key">{k + 1}</span><span className="grow">{opt}</span>
                  {state === 'right' && <Check size={18} />}{state === 'wrong' && <X size={18} />}
                </motion.button>
              );
            })}
          </div>
          <AnimatePresence>
            {run.picked != null && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ marginTop: 18, borderColor: run.picked === q.a ? '#1e4a30' : '#4a2228' }}>
                <b className={run.picked === q.a ? 'pos' : 'neg'}>{run.picked === q.a ? 'Correct.' : 'Not quite.'}</b>
                <p style={{ margin: '6px 0 14px', lineHeight: 1.55, color: '#d0d0d6' }}>{q.e}</p>
                <button className="btn primary" onClick={next}>{run.i + 1 === run.qs.length ? 'See results' : 'Next question'} <ArrowRight size={15} /></button>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="dim" style={{ fontSize: 12.5, marginTop: 16 }}>Keys: 1–4 to answer, Enter for next.</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
