import { useEffect, useMemo, useRef, useState } from 'react';
import { HeartPulse, ChevronLeft, ChevronRight, Flame, Plus, X, Salad, Target, Check } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, BarChart, Bar } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Reveal, Toggle, Field } from '../components/ui.jsx';
import { DEFAULT_LIFE, dayScores, habitStreak, ymdOf } from '../lib/personal.js';
import { cls } from '../lib/format.js';

const AX = { tickLine: false, axisLine: false, tick: { fontSize: 12, fill: 'var(--text2)' } };
const TT = { contentStyle: { background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 10, fontSize: 13 } };
const addDays = (ymd, n) => { const d = new Date(`${ymd}T00:00:00`); d.setDate(d.getDate() + n); return ymdOf(d); };
const short = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const scoreColor = (v) => (v == null ? 'var(--text2)' : v >= 75 ? 'var(--green)' : v >= 50 ? '#f5a524' : 'var(--red)');

const METRICS = [
  ['sleep', 'Sleep', 'h', 0.5], ['workout', 'Workout', 'min', 5], ['steps', 'Steps', '', 500], ['water', 'Water', 'L', 0.25],
  ['meditation', 'Meditation', 'min', 5], ['screen', 'Screen time', 'h', 0.5],
];

/** Admin only: habits, health, diet, weight and the scores that come out of them */
export default function Life() {
  const { api, notify, settings, updateUser, allTrades } = useApp();
  const life = useMemo(() => ({ ...DEFAULT_LIFE, ...(settings.life || {}), targets: { ...DEFAULT_LIFE.targets, ...(settings.life?.targets || {}) }, dietPlan: { ...DEFAULT_LIFE.dietPlan, ...(settings.life?.dietPlan || {}) } }), [settings.life]);
  const [days, setDays] = useState(null);
  const [date, setDate] = useState(ymdOf());
  const [draft, setDraft] = useState({});
  const [setup, setSetup] = useState(false);
  const timer = useRef(null);
  const pending = useRef({}); // changes not yet sent, merged so quick edits aren't lost
  const today = ymdOf();

  useEffect(() => { api.personal.days(addDays(today, -120)).then((r) => setDays(r.items)).catch((e) => notify(e.message)); }, []); // eslint-disable-line
  const byDate = useMemo(() => new Map((days || []).map((d) => [d.date, d])), [days]);
  useEffect(() => { if (!Object.keys(pending.current).length) setDraft(byDate.get(date) || { date, habits: {}, meals: {} }); }, [date, byDate]);

  // Save a change (debounced) and keep the local list in step
  const patch = (p) => {
    setDraft((d) => ({ ...d, ...p, habits: { ...(d.habits || {}), ...(p.habits || {}) }, meals: { ...(d.meals || {}), ...(p.meals || {}) } }));
    const q = pending.current;
    pending.current = { ...q, ...p, ...(p.habits && { habits: { ...(q.habits || {}), ...p.habits } }), ...(p.meals && { meals: { ...(q.meals || {}), ...p.meals } }) };
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const send = pending.current; pending.current = {};
      try {
        const { item } = await api.personal.saveDay(date, send);
        setDays((ds) => [...(ds || []).filter((d) => d.date !== date), item]);
      } catch (e) { notify(e.message); }
    }, 450);
  };
  const saveLife = (next) => updateUser({ settings: { life: { ...life, ...next } } });

  const tradesOn = (d) => allTrades.filter((t) => t.date === d);
  const s = dayScores(draft, life, tradesOn(date));
  const last = (n) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
  const series = last(30).map((d) => ({ d: short(d), ...dayScores(byDate.get(d), life, tradesOn(d)), weight: byDate.get(d)?.weight ?? null, sleep: byDate.get(d)?.sleep ?? null, steps: byDate.get(d)?.steps ?? null }));
  const avg7 = (k) => { const v = series.slice(-7).map((x) => x[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const weights = (days || []).filter((d) => d.weight).sort((a, b) => a.date.localeCompare(b.date));
  const wNow = weights.at(-1)?.weight, wStart = weights.find((d) => d.date >= addDays(today, -30))?.weight;

  if (!days) return <div className="page"><p className="muted">Loading…</p></div>;
  return (
    <div className="page wide-page">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><HeartPulse size={22} /> Lifestyle</h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Habits, health, diet and weight, scored every day. Only you (admin) can see this.</div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="row month-pick">
            <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft size={16} /></button>
            <b style={{ minWidth: 110, textAlign: 'center' }}>{date === today ? 'Today' : new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</b>
            <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day"><ChevronRight size={16} /></button>
          </div>
          <button className="btn sm" onClick={() => setSetup((v) => !v)}><Target size={14} /> Habits, targets & diet plan</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 16 }}>
        {[['Discipline', 'discipline', 'habits, diet and trading plan'], ['Lifestyle', 'lifestyle', 'all four areas'], ['Habits', 'habits', `${s.done}/${s.of} done`], ['Health', 'health', 'sleep, workout, steps, water'], ['Diet', 'diet', 'calories, protein, no junk'], ['Mind', 'mind', 'mood, energy, calm, screens']].map(([l, k, sub]) => (
          <Reveal key={k} className="card stat" style={{ padding: 16 }}>
            <div className="label">{l} score</div>
            <div className="val" style={{ fontSize: 28, marginTop: 8, color: scoreColor(s[k]) }}>{s[k] ?? '—'}</div>
            <div className="foot" style={{ fontSize: 12 }}>{sub} · 7-day avg {avg7(k) ?? '—'}</div>
          </Reveal>
        ))}
      </div>

      {setup && <Setup life={life} onSave={(n) => { saveLife(n); notify('Saved'); }} onClose={() => setSetup(false)} />}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))' }}>
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Habits</h3>
          <div className="col" style={{ gap: 8, marginTop: 12 }}>
            {life.habits.map((h) => {
              const on = !!draft.habits?.[h.id];
              const streak = habitStreak(days.map((d) => (d.date === date ? draft : d)), h.id, today);
              return (
                <button key={h.id} className={cls('habit-row', on && 'on')} onClick={() => patch({ habits: { [h.id]: !on } })}>
                  <span className="habit-check">{on && <Check size={15} />}</span>
                  <span className="grow" style={{ textAlign: 'left' }}>{h.name}</span>
                  {streak > 0 && <span className="row" style={{ gap: 3, color: '#f5a524', fontSize: 12.5, fontWeight: 700 }}><Flame size={14} />{streak}</span>}
                </button>
              );
            })}
            {!life.habits.length && <p className="muted">Add habits under “Habits, targets & diet plan”.</p>}
          </div>
          {tradesOn(date).length > 0 && <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Trading plan today: {s.trading}% of {tradesOn(date).filter((t) => !t.noTrade).length} trades on plan (counts toward discipline).</p>}
        </Reveal>

        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Body & mind</h3>
          <div className="life-metrics">
            {METRICS.map(([k, l, u, step]) => (
              <Field key={k} label={`${l}${u ? ` (${u})` : ''}`} hint={`target ${life.targets[k]}${u ? ` ${u}` : ''}`}>
                <input className="input" type="number" inputMode="decimal" step={step} min={0} value={draft[k] ?? ''} onChange={(e) => patch({ [k]: e.target.value === '' ? null : +e.target.value })} />
              </Field>
            ))}
            <Field label="Weight (kg)" hint={life.weightGoal ? `goal ${life.weightGoal} kg` : 'set a goal in targets'}>
              <input className="input" type="number" inputMode="decimal" step={0.1} min={0} value={draft.weight ?? ''} onChange={(e) => patch({ weight: e.target.value === '' ? null : +e.target.value })} />
            </Field>
          </div>
          {[['mood', 'Mood'], ['energy', 'Energy']].map(([k, l]) => (
            <div key={k} className="row between" style={{ marginTop: 10 }}>
              <span className="muted" style={{ fontSize: 13.5 }}>{l}</span>
              <div className="row" style={{ gap: 4 }}>{[1, 2, 3, 4, 5].map((v) => <button key={v} className={cls('chip', draft[k] === v && 'on')} style={{ padding: '6px 12px' }} onClick={() => patch({ [k]: draft[k] === v ? null : v })}>{v}</button>)}</div>
            </div>
          ))}
        </Reveal>

        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 className="row" style={{ margin: 0, fontSize: 17 }}><Salad size={17} /> Diet</h3>
          <div className="fgrid" style={{ marginTop: 10 }}>
            <Field label="Calories" hint={`target ${life.targets.calories}`}><input className="input" type="number" inputMode="numeric" value={draft.calories ?? ''} onChange={(e) => patch({ calories: e.target.value === '' ? null : +e.target.value })} /></Field>
            <Field label="Protein (g)" hint={`target ${life.targets.protein} g`}><input className="input" type="number" inputMode="numeric" value={draft.protein ?? ''} onChange={(e) => patch({ protein: e.target.value === '' ? null : +e.target.value })} /></Field>
          </div>
          {['breakfast', 'lunch', 'dinner', 'snacks'].map((meal) => (
            <Field key={meal} label={meal[0].toUpperCase() + meal.slice(1)} hint={life.dietPlan[meal] ? `plan: ${life.dietPlan[meal]}` : undefined}>
              <input className="input" value={draft.meals?.[meal] || ''} placeholder="What did you eat?" onChange={(e) => patch({ meals: { [meal]: e.target.value } })} />
            </Field>
          ))}
          <div className="row between" style={{ marginTop: 6 }}><span className="muted" style={{ fontSize: 13.5 }}>Ate junk food today</span><Toggle on={!!draft.junk} onChange={(v) => patch({ junk: v })} /></div>
          {life.dietPlan.rules && <p className="dim" style={{ fontSize: 12.5, marginBottom: 0 }}>Your rules: {life.dietPlan.rules}</p>}
        </Reveal>
      </div>

      <Reveal className="card" style={{ marginTop: 16 }}>
        <Field label="Note for the day"><textarea className="input" rows={2} value={draft.note || ''} onChange={(e) => patch({ note: e.target.value })} placeholder="How did today go?" /></Field>
      </Reveal>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))' }}>
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Scores, last 30 days</h3>
          <div style={{ height: 260, marginTop: 12 }}>
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="d" {...AX} minTickGap={24} />
                <YAxis {...AX} width={34} domain={[0, 100]} />
                <Tooltip {...TT} />
                <Legend wrapperStyle={{ fontSize: 12.5 }} iconType="circle" />
                <Line dataKey="discipline" name="Discipline" stroke="var(--blue)" strokeWidth={2.4} dot={false} connectNulls />
                <Line dataKey="lifestyle" name="Lifestyle" stroke="#2fbf8f" strokeWidth={2} dot={false} connectNulls />
                <Line dataKey="diet" name="Diet" stroke="#f5a524" strokeWidth={1.6} dot={false} connectNulls strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Weight</h3>
          <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>{wNow ? `${wNow} kg now${wStart && wStart !== wNow ? ` · ${(wNow - wStart > 0 ? '+' : '')}${(wNow - wStart).toFixed(1)} kg in 30 days` : ''}${life.weightGoal ? ` · ${Math.abs(wNow - life.weightGoal).toFixed(1)} kg to goal` : ''}` : 'Log your weight to see the trend'}</div>
          <div style={{ height: 240, marginTop: 10 }}>
            <ResponsiveContainer>
              <LineChart data={weights.slice(-90).map((d) => ({ d: short(d.date), w: d.weight }))}>
                <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="d" {...AX} minTickGap={24} />
                <YAxis {...AX} width={40} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip {...TT} formatter={(v) => [`${v} kg`, 'Weight']} />
                {life.weightGoal && <ReferenceLine y={life.weightGoal} stroke="#2fbf8f" strokeDasharray="5 4" label={{ value: `Goal ${life.weightGoal}`, fill: '#2fbf8f', fontSize: 12, position: 'insideTopRight' }} />}
                <Line dataKey="w" name="Weight" stroke="#a78bfa" strokeWidth={2.4} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))' }}>
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Habit calendar, last 4 weeks</h3>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="habit-grid">
              <thead><tr><th />{last(28).map((d) => <th key={d} title={d}>{new Date(`${d}T00:00:00`).getDate()}</th>)}</tr></thead>
              <tbody>{life.habits.map((h) => (
                <tr key={h.id}><td className="hg-name">{h.name}</td>{last(28).map((d) => { const v = (d === date ? draft : byDate.get(d))?.habits?.[h.id]; return <td key={d}><span className={cls('hg-cell', v === true && 'on', v === false && 'off')} title={`${h.name} · ${d}`} /></td>; })}</tr>
              ))}</tbody>
            </table>
          </div>
        </Reveal>
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Sleep and steps, last 30 days</h3>
          <div style={{ height: 240, marginTop: 12 }}>
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="d" {...AX} minTickGap={24} />
                <YAxis yAxisId="s" {...AX} width={30} />
                <YAxis yAxisId="t" orientation="right" {...AX} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip {...TT} />
                <Legend wrapperStyle={{ fontSize: 12.5 }} iconType="circle" />
                <ReferenceLine yAxisId="s" y={life.targets.sleep} stroke="var(--blue)" strokeDasharray="4 4" />
                <Bar yAxisId="s" dataKey="sleep" name="Sleep (h)" fill="var(--blue)" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="t" dataKey="steps" name="Steps" fill="#2fbf8f" fillOpacity={0.6} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
      </div>

      <Reveal className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>How the scores work</h3>
        <ul className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: '8px 0 0', paddingLeft: 18 }}>
          <li><b>Habits</b>: share of your habits ticked that day.</li>
          <li><b>Health</b>: sleep, workout, steps and water against your targets.</li>
          <li><b>Diet</b>: calories within ±10% of target, protein reached, and no junk food.</li>
          <li><b>Mind</b>: mood and energy (1–5), meditation against your target, screen time under target.</li>
          <li><b>Discipline</b>: habits 50% + diet 25% + share of that day's trades that followed your plan 25%.</li>
          <li><b>Lifestyle</b>: the average of habits, health, diet and mind. Parts you didn't log are left out, not counted as zero.</li>
        </ul>
      </Reveal>
    </div>
  );
}

function Setup({ life, onSave, onClose }) {
  const [f, setF] = useState(life);
  const [name, setName] = useState('');
  const t = f.targets;
  const setT = (k) => (e) => setF({ ...f, targets: { ...t, [k]: +e.target.value || 0 } });
  const setD = (k) => (e) => setF({ ...f, dietPlan: { ...f.dietPlan, [k]: e.target.value } });
  const addHabit = () => { const n = name.trim(); if (!n) return; setF({ ...f, habits: [...f.habits, { id: `h${Date.now().toString(36)}`, name: n }] }); setName(''); };
  return (
    <Reveal className="card" style={{ marginTop: 16, borderColor: 'var(--blue)' }}>
      <div className="row between"><h3 style={{ margin: 0, fontSize: 17 }}>Habits, targets & diet plan</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', marginTop: 12, gap: 22 }}>
        <div>
          <div className="eyebrow">Habits</div>
          <div className="col" style={{ gap: 6, marginTop: 8 }}>
            {f.habits.map((h) => (
              <div key={h.id} className="row" style={{ gap: 6 }}>
                <input className="input" value={h.name} onChange={(e) => setF({ ...f, habits: f.habits.map((x) => (x.id === h.id ? { ...x, name: e.target.value } : x)) })} />
                <button className="icon-btn" onClick={() => setF({ ...f, habits: f.habits.filter((x) => x.id !== h.id) })} aria-label={`Remove ${h.name}`}><X size={15} /></button>
              </div>
            ))}
            <div className="row" style={{ gap: 6 }}><input className="input" value={name} placeholder="New habit, e.g. No phone after 11 PM" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addHabit()} /><button className="btn" onClick={addHabit}><Plus size={15} /></button></div>
          </div>
        </div>
        <div>
          <div className="eyebrow">Daily targets</div>
          <div className="fgrid" style={{ marginTop: 8 }}>
            {[['sleep', 'Sleep (h)'], ['workout', 'Workout (min)'], ['steps', 'Steps'], ['water', 'Water (L)'], ['meditation', 'Meditation (min)'], ['calories', 'Calories'], ['protein', 'Protein (g)'], ['screen', 'Max screen time (h)']].map(([k, l]) => (
              <Field key={k} label={l}><input className="input" type="number" inputMode="decimal" value={t[k]} onChange={setT(k)} /></Field>
            ))}
            <Field label="Goal weight (kg)"><input className="input" type="number" inputMode="decimal" value={f.weightGoal ?? ''} onChange={(e) => setF({ ...f, weightGoal: +e.target.value || null })} /></Field>
          </div>
        </div>
        <div>
          <div className="eyebrow">Diet plan</div>
          {['breakfast', 'lunch', 'dinner', 'snacks'].map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input className="input" value={f.dietPlan[k]} onChange={setD(k)} /></Field>)}
          <Field label="Rules"><input className="input" value={f.dietPlan.rules} onChange={setD('rules')} placeholder="No sugar drinks. Last meal by 9 PM." /></Field>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => { onSave(f); onClose(); }}>Save</button></div>
    </Reveal>
  );
}
