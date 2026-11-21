import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ImagePlus, Clipboard, X, Save, Share2, UserPlus, Check, Trash2, Users, Newspaper, TrendingUp, TrendingDown, Minus, CircleSlash, Link2, Eye, History, Sunrise } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Field, Dialog, Reveal, Empty, ease } from '../components/ui.jsx';
import { addDays, longDate, shortDate, today, relTime } from '../lib/dates.js';
import { compressImage } from '../lib/image.js';
import { ALL_SYMBOLS } from '../lib/assets.js';
import { cls, initials } from '../lib/format.js';

const BIASES = [['Bullish', TrendingUp], ['Bearish', TrendingDown], ['Neutral', Minus], ['No bias', CircleSlash]];
const SESSIONS = ['Asia', 'London', 'NY AM', 'NY PM'];
const MAX_IMAGES = 8;
const FIELDS = ['bias', 'keyLevels', 'ruleReminder', 'avoid', 'instruments', 'sessionFocus', 'narrative', 'bullCase', 'bearCase', 'newsToWatch', 'images'];
const blank = () => ({ bias: '', keyLevels: '', ruleReminder: '', avoid: '', instruments: [], sessionFocus: '', narrative: '', bullCase: '', bearCase: '', newsToWatch: '', images: [] });
const fromPlan = (p) => { const b = blank(); for (const k of FIELDS) if (p?.[k] != null) b[k] = p[k]; b.images = (b.images || []).map((x) => (typeof x === 'string' ? { src: x, caption: '' } : x)); return b; };
const localDay = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function PreMarket() {
  const { api, notify } = useApp();
  const [date, setDate] = useState(today());
  const [f, setF] = useState(blank());
  const [saved, setSaved] = useState(blank());
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [viewer, setViewer] = useState(null); // shared plan being viewed
  const [zoom, setZoom] = useState(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  const loadHistory = useCallback(() => api.plans.list?.().then((r) => setHistory(r.plans)).catch(() => {}), [api]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api.plans.get(date).then((r) => { if (!live) return; const v = fromPlan(r.plan); setPlan(r.plan); setF(v); setSaved(v); }).catch((e) => notify(e.message)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [api, date, notify]);

  const save = useCallback(async (quiet) => {
    setSaving(true);
    try {
      const r = await api.plans.put(date, f);
      const v = fromPlan(r.plan); setPlan(r.plan); setSaved(v); setF(v);
      if (!quiet) notify('Plan saved');
      loadHistory();
      return true;
    } catch (e) { notify(e.message); return false; }
    finally { setSaving(false); }
  }, [api, date, f, notify, loadHistory]);

  // Ctrl/Cmd+S saves
  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [save]);

  const go = async (d) => { if (!d || d === date) return; if (dirty && !(await save(true))) return; setDate(d); };
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));

  return (
    <div className="page">
      <div className="row between wrap" style={{ gap: 14 }}>
        <div>
          <div className="eyebrow row" style={{ gap: 6 }}><Sunrise size={13} /> Pre-market analysis</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, letterSpacing: '-.03em' }}>{longDate(date)}</h1>
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="pm-date">
            <button className="icon-btn" onClick={() => go(addDays(date, -1))} aria-label="Previous day"><ChevronLeft size={16} /></button>
            <input type="date" value={date} onChange={(e) => go(e.target.value)} />
            <button className="icon-btn" onClick={() => go(addDays(date, 1))} aria-label="Next day"><ChevronRight size={16} /></button>
          </div>
          {date !== today() && <button className="btn sm" onClick={() => go(today())}>Today</button>}
          <button className="btn primary" disabled={saving || !dirty} onClick={() => save()}><Save size={15} /> {saving ? 'Saving…' : dirty ? 'Save plan' : 'Saved'}</button>
        </div>
      </div>

      <div className="pm-grid" style={{ marginTop: 22, opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
        <div className="col" style={{ gap: 0 }}>
          <section className="log-section">
            <h4>Bias &amp; focus</h4>
            <Field label="Bias">
              <div className="row" style={{ gap: 10 }}>
                {BIASES.map(([b, I]) => <motion.button whileTap={{ scale: 0.96 }} key={b} className={cls('bias-opt', b.split(' ')[0], f.bias === b && 'on')} onClick={() => set('bias')(f.bias === b ? '' : b)}><I size={20} />{b}</motion.button>)}
              </div>
            </Field>
            <div className="fgrid" style={{ marginTop: 18 }}>
              <Field label="Session focus">
                <div className="row wrap" style={{ gap: 8 }}>{SESSIONS.map((s) => <button key={s} className={cls('chip', f.sessionFocus === s && 'on')} onClick={() => set('sessionFocus')(f.sessionFocus === s ? '' : s)}>{s}</button>)}</div>
              </Field>
              <Field label="Instruments on watch"><Instruments value={f.instruments} onChange={set('instruments')} /></Field>
            </div>
          </section>

          <section className="log-section">
            <h4>Chart screenshots <small>{f.images.length}/{MAX_IMAGES}</small></h4>
            <Charts images={f.images} onChange={set('images')} onZoom={setZoom} notify={notify} />
          </section>

          <section className="log-section">
            <h4>Narrative</h4>
            <Field label="Higher-timeframe story" hint="Where is price in the bigger picture? What is it drawing towards?">
              <textarea className="textarea" value={f.narrative} onChange={set('narrative')} placeholder="Daily is bullish, took the previous week low on Monday and displaced higher. Expecting a run on the 4H equal highs at 25,980." />
            </Field>
            <div className="fgrid" style={{ marginTop: 18 }}>
              <Field label={<span className="row blue" style={{ gap: 6 }}><TrendingUp size={13} /> Bull case</span>}><textarea className="textarea" value={f.bullCase} onChange={set('bullCase')} placeholder="Sweep of Asia low into the 1H FVG, then longs to the equal highs." /></Field>
              <Field label={<span className="row neg" style={{ gap: 6 }}><TrendingDown size={13} /> Bear case</span>}><textarea className="textarea" value={f.bearCase} onChange={set('bearCase')} placeholder="Acceptance below 25,900 flips me: shorts to the weekly open." /></Field>
            </div>
          </section>

          <section className="log-section">
            <h4>Levels &amp; news</h4>
            <Field label="Key levels"><textarea className="textarea" style={{ minHeight: 80 }} value={f.keyLevels} onChange={set('keyLevels')} placeholder="Asia high 25,954 · Asia low 25,916 · PDH 26,010 · Weekly open 25,880" /></Field>
            <div style={{ marginTop: 18 }}>
              <Field label="News to watch" right={<PullNews date={date} onAdd={(txt) => setF((x) => ({ ...x, newsToWatch: x.newsToWatch ? `${x.newsToWatch}\n${txt}` : txt }))} />}>
                <textarea className="textarea" style={{ minHeight: 80 }} value={f.newsToWatch} onChange={set('newsToWatch')} placeholder="08:30 USD CPI (high). No trades 5 minutes either side." />
              </Field>
            </div>
          </section>

          <section className="log-section">
            <h4>Discipline</h4>
            <div className="fgrid">
              <Field label="Rule reminder"><textarea className="textarea" style={{ minHeight: 80 }} value={f.ruleReminder} onChange={set('ruleReminder')} placeholder="Asia is for levels. The trade is in New York." /></Field>
              <Field label="Avoid"><textarea className="textarea" style={{ minHeight: 80 }} value={f.avoid} onChange={set('avoid')} placeholder="Trading the Asia chop because I am awake." /></Field>
            </div>
          </section>
        </div>

        <aside className="col" style={{ gap: 14, position: 'sticky', top: 0 }}>
          <ShareCard date={date} plan={plan} onShared={(p) => setPlan((x) => ({ ...(x || {}), sharedWith: p.sharedWith }))} dirty={dirty} save={save} />
          <SharedWithMe date={date} onOpen={setViewer} />
          <FriendsCard />
          <HistoryCard history={history} date={date} onPick={go} />
        </aside>
      </div>

      <Dialog open={!!viewer} onClose={() => setViewer(null)} wide>
        {viewer && <PlanView plan={viewer} onClose={() => setViewer(null)} onZoom={setZoom} />}
      </Dialog>
      <AnimatePresence>
        {zoom && (
          <motion.div className="overlay center" style={{ zIndex: 80 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)}>
            <motion.img src={zoom} alt="" className="lightbox" initial={{ scale: 0.94 }} animate={{ scale: 1 }} transition={{ duration: 0.25, ease }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Instruments({ value, onChange }) {
  const [draft, setDraft] = useState('');
  const add = (v) => { const s = v.trim().toUpperCase().slice(0, 20); if (s && !value.includes(s) && value.length < 12) onChange([...value, s]); setDraft(''); };
  return (
    <div>
      <div className="row wrap" style={{ gap: 6, marginBottom: value.length ? 8 : 0 }}>
        {value.map((s) => <span key={s} className="tag blue">{s}<button onClick={() => onChange(value.filter((x) => x !== s))} aria-label={`Remove ${s}`}><X size={12} /></button></span>)}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); add(draft); }}>
        <input className="input" list="pm-symbols" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add XAUUSD, NQ, EURUSD…" style={{ textTransform: 'uppercase' }} />
        <button className="btn" type="submit">Add</button>
      </form>
      <datalist id="pm-symbols">{ALL_SYMBOLS.map((x) => <option key={x.symbol} value={x.symbol}>{x.name}</option>)}</datalist>
    </div>
  );
}

function Charts({ images, onChange, onZoom, notify }) {
  const [over, setOver] = useState(false);
  const [link, setLink] = useState('');
  const fileRef = useRef(null);
  const latest = useRef(images);
  latest.current = images;
  const add = useCallback(async (files) => {
    const room = MAX_IMAGES - latest.current.length;
    const list = [...files].filter((x) => x.type.startsWith('image/'));
    if (!list.length) return;
    if (room <= 0) return notify(`Up to ${MAX_IMAGES} charts per day`);
    const out = [];
    for (const file of list.slice(0, room)) out.push({ src: await compressImage(file, 1600, 0.8), caption: '' });
    onChange([...latest.current, ...out]);
  }, [onChange, notify]);
  useEffect(() => {
    const p = (e) => { if (e.target.closest?.('input,textarea')) return; const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); add(fs); } };
    window.addEventListener('paste', p);
    return () => window.removeEventListener('paste', p);
  }, [add]);
  return (
    <>
      {images.length > 0 && (
        <div className="chart-grid" style={{ marginBottom: 14 }}>
          {images.map((im, i) => (
            <motion.div key={i} layout className="chart-tile" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="img" onClick={() => onZoom(im.src)}>
                <img src={im.src} alt={im.caption || `Chart ${i + 1}`} />
                <button className="x" onClick={(e) => { e.stopPropagation(); onChange(images.filter((_, k) => k !== i)); }} aria-label="Remove chart"><X size={14} /></button>
              </div>
              <input value={im.caption} maxLength={140} onChange={(e) => onChange(images.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x)))} placeholder="Caption, e.g. 4H · sweep of Asia high" />
            </motion.div>
          ))}
        </div>
      )}
      {images.length < MAX_IMAGES && (
        <div className={cls('drop sm', over && 'over')} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
          <ImagePlus size={26} />
          <div>Drop your HTF / LTF charts, or <button className="link" onClick={() => fileRef.current.click()}>choose files</button></div>
          <div className="dim row" style={{ gap: 6, fontSize: 13 }}><Clipboard size={13} /> Paste a screenshot with Cmd/Ctrl+V</div>
          <form className="row" style={{ marginTop: 10, width: 'min(460px,100%)' }} onSubmit={(e) => { e.preventDefault(); if (/^https?:\/\//.test(link)) { onChange([...images, { src: link.trim(), caption: '' }]); setLink(''); } else notify('Paste a full https:// image link'); }}>
            <div className="search grow"><Link2 size={14} className="muted" /><input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="or paste a TradingView snapshot link" /></div>
            <button className="btn sm" type="submit">Add</button>
          </form>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </div>
      )}
    </>
  );
}

function PullNews({ date, onAdd }) {
  const { api, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const pull = async () => {
    setBusy(true);
    try {
      const weeks = await Promise.all(['thisweek', 'nextweek'].map((w) => api.news(w).catch(() => ({ events: [] }))));
      const evs = weeks.flatMap((w) => w.events).filter((e) => localDay(e.date) === date && (e.impact === 'high' || e.impact === 'medium'));
      if (!evs.length) return notify('No high or medium impact events found for this day');
      onAdd(evs.map((e) => `${new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${e.currency} ${e.title} (${e.impact})${e.forecast ? ` · f ${e.forecast}` : ''}${e.previous ? ` · p ${e.previous}` : ''}`).join('\n'));
    } finally { setBusy(false); }
  };
  return <button className="row blue" style={{ textTransform: 'none', letterSpacing: 0, gap: 5 }} disabled={busy} onClick={pull}><Newspaper size={12} /> {busy ? 'Loading…' : 'Pull from news calendar'}</button>;
}

/* ---------------- sharing ---------------- */
function useFriends() {
  const { api } = useApp();
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] });
  const load = useCallback(() => api.friends?.list().then(setData).catch(() => {}), [api]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener('tp:friends', load);
    return () => { clearInterval(t); window.removeEventListener('tp:friends', load); };
  }, [load]);
  return [data, load];
}
const friendsChanged = () => window.dispatchEvent(new Event('tp:friends'));

function ShareCard({ date, plan, onShared, dirty, save }) {
  const { api, notify } = useApp();
  const [{ friends }] = useFriends();
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  const current = useMemo(() => (plan?.sharedWith || []).map(String), [plan]);
  useEffect(() => setSel(current), [current, date]);
  const changed = JSON.stringify([...sel].sort()) !== JSON.stringify([...current].sort());
  const apply = async () => {
    setBusy(true);
    try {
      if (dirty && !(await save(true))) return;
      const r = await api.plans.share(date, sel);
      onShared(r.plan);
      notify(sel.length ? `Shared with ${sel.length} friend${sel.length > 1 ? 's' : ''}` : 'Stopped sharing');
    } catch (e) { notify(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="card">
      <div className="row between"><h3 className="row" style={{ gap: 8 }}><Share2 size={15} className="blue" /> Share this plan</h3>{current.length > 0 && <span className="tag blue">{current.length} shared</span>}</div>
      <div className="sub">Friends see it under “Shared with you” for {shortDate(date)}.</div>
      {friends.length === 0 ? <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Add a friend below to share your analysis.</p> : (
        <>
          <div className="col" style={{ marginTop: 10 }}>
            {friends.map(({ user: u }) => {
              const on = sel.includes(u.id);
              return (
                <button key={u.id} className="friend-row" style={{ textAlign: 'left' }} onClick={() => setSel((s) => (on ? s.filter((x) => x !== u.id) : [...s, u.id]))}>
                  <span className="avatar">{initials(u.displayName)}</span>
                  <span className="grow"><b>{u.displayName}</b><div className="dim" style={{ fontSize: 12 }}>@{u.username}</div></span>
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid', borderColor: on ? 'var(--blue)' : 'var(--dim)', background: on ? 'var(--blue)' : 'transparent', display: 'grid', placeItems: 'center', color: '#fff' }}>{on && <Check size={13} />}</span>
                </button>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button className="btn sm" onClick={() => setSel(sel.length === friends.length ? [] : friends.map((x) => x.user.id))}>{sel.length === friends.length ? 'None' : 'All'}</button>
            <button className="btn sm primary grow" disabled={busy || !changed} onClick={apply}>{busy ? 'Sharing…' : 'Update sharing'}</button>
          </div>
        </>
      )}
    </div>
  );
}

function SharedWithMe({ date, onOpen }) {
  const { api } = useApp();
  const [plans, setPlans] = useState([]);
  useEffect(() => {
    let live = true;
    const load = () => api.plans.shared?.(date).then((r) => live && setPlans(r.plans)).catch(() => {});
    load();
    window.addEventListener('tp:friends', load);
    return () => { live = false; window.removeEventListener('tp:friends', load); };
  }, [api, date]);
  return (
    <div className="card">
      <h3 className="row" style={{ gap: 8 }}><Users size={15} className="blue" /> Shared with you</h3>
      <div className="sub">Friends' analysis for {shortDate(date)}</div>
      {plans.length === 0 ? <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Nothing shared for this day yet.</p> : (
        <div className="col" style={{ marginTop: 10 }}>
          {plans.map((p) => (
            <button key={p.id} className="friend-row" style={{ textAlign: 'left' }} onClick={() => onOpen(p)}>
              <span className="avatar">{initials(p.author?.displayName)}</span>
              <span className="grow" style={{ minWidth: 0 }}>
                <b>{p.author?.displayName}</b>
                <div className="dim" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[p.bias, (p.instruments || []).join(' '), p.images?.length ? `${p.images.length} charts` : ''].filter(Boolean).join(' · ') || 'Open plan'}</div>
              </span>
              <Eye size={15} className="muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FriendsCard() {
  const { api, notify, user } = useApp();
  const [{ friends, incoming, outgoing }, reload] = useFriends();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (fn, msg) => { try { await fn(); if (msg) notify(msg); reload(); friendsChanged(); } catch (e) { notify(e.message); } };
  const send = async (e) => {
    e.preventDefault(); const u = name.trim(); if (!u) return;
    setBusy(true);
    await act(async () => { const r = await api.friends.request(u); notify(r.status === 'accepted' ? `You and @${r.user.username} are now friends` : `Request sent to @${r.user.username}`); setName(''); });
    setBusy(false);
  };
  return (
    <div className="card">
      <div className="row between"><h3 className="row" style={{ gap: 8 }}><UserPlus size={15} className="blue" /> Friends</h3>{incoming.length > 0 && <span className="badge">{incoming.length}</span>}</div>
      <div className="sub">Your handle is <b className="text2">@{user.username}</b></div>
      <form className="row" style={{ marginTop: 12 }} onSubmit={send}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="@username" style={{ padding: '9px 12px' }} />
        <button className="btn sm primary" disabled={busy || !name.trim()} type="submit">Send</button>
      </form>
      {incoming.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 4px' }}>Requests</div>
          {incoming.map((r) => (
            <div key={r.id} className="friend-row">
              <span className="avatar">{initials(r.user.displayName)}</span>
              <span className="grow"><b>{r.user.displayName}</b><div className="dim" style={{ fontSize: 12 }}>@{r.user.username} · {relTime(r.createdAt)}</div></span>
              <button className="icon-btn" style={{ color: 'var(--blue)' }} title="Accept" onClick={() => act(() => api.friends.accept(r.id), `You and @${r.user.username} are now friends`)}><Check size={16} /></button>
              <button className="icon-btn" style={{ color: 'var(--red)' }} title="Decline" onClick={() => act(() => api.friends.remove(r.id))}><X size={16} /></button>
            </div>
          ))}
        </>
      )}
      {outgoing.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 4px' }}>Sent</div>
          {outgoing.map((r) => (
            <div key={r.id} className="friend-row">
              <span className="avatar">{initials(r.user.displayName)}</span>
              <span className="grow"><b>@{r.user.username}</b><div className="dim" style={{ fontSize: 12 }}>Waiting for them to accept</div></span>
              <button className="btn sm ghost" onClick={() => act(() => api.friends.remove(r.id), 'Request cancelled')}>Cancel</button>
            </div>
          ))}
        </>
      )}
      <div className="eyebrow" style={{ margin: '16px 0 4px' }}>Friends · {friends.length}</div>
      {friends.length === 0 ? <p className="muted" style={{ fontSize: 13, margin: 0 }}>None yet. Send a request by username.</p> : friends.map((r) => (
        <div key={r.id} className="friend-row">
          <span className="avatar">{initials(r.user.displayName)}</span>
          <span className="grow"><b>{r.user.displayName}</b><div className="dim" style={{ fontSize: 12 }}>@{r.user.username}</div></span>
          <button className="icon-btn" title="Remove friend" onClick={() => act(() => api.friends.remove(r.id), `Removed @${r.user.username}`)}><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function HistoryCard({ history, date, onPick }) {
  if (!history.length) return null;
  return (
    <div className="card">
      <h3 className="row" style={{ gap: 8 }}><History size={15} className="blue" /> Past plans</h3>
      <div className="col" style={{ marginTop: 8, maxHeight: 300, overflowY: 'auto' }}>
        {history.slice(0, 40).map((p) => (
          <button key={p.id} className={cls('hist-item', p.date === date && 'on')} onClick={() => onPick(p.date)}>
            <span><b>{shortDate(p.date)}</b><div className="dim" style={{ fontSize: 12 }}>{[p.bias, (p.instruments || []).slice(0, 3).join(' ')].filter(Boolean).join(' · ') || 'Plan'}</div></span>
            {(p.sharedWith || []).length > 0 && <Share2 size={13} className="blue" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Read-only view of a plan (used for friends' shared plans). */
export function PlanView({ plan: p, onClose, onZoom }) {
  const tone = p.bias === 'Bullish' ? 'blue' : p.bias === 'Bearish' ? 'red' : '';
  const rows = [['Session', p.sessionFocus], ['Key levels', p.keyLevels], ['News', p.newsToWatch], ['Rule', p.ruleReminder], ['Avoid', p.avoid]].filter(([, v]) => v);
  return (
    <div>
      <div className="row between" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="avatar" style={{ width: 44, height: 44 }}>{initials(p.author?.displayName)}</span>
          <div><div className="eyebrow">{p.author ? `@${p.author.username}` : 'Plan'} · {shortDate(p.date)}</div><h2 style={{ margin: '2px 0 0', fontSize: 26, letterSpacing: '-.02em' }}>{p.author?.displayName || 'Pre-market plan'}</h2></div>
        </div>
        <button className="close-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="row wrap" style={{ gap: 6, marginBottom: 16 }}>
        {p.bias && <span className={cls('tag', tone)} style={{ fontWeight: 600 }}>{p.bias}</span>}
        {(p.instruments || []).map((s) => <span key={s} className="tag">{s}</span>)}
      </div>
      {(p.images || []).length > 0 && (
        <div className="chart-grid" style={{ marginBottom: 18 }}>
          {p.images.map((im, i) => (
            <div key={i} className="chart-tile">
              <div className="img" onClick={() => onZoom(im.src)}><img src={im.src} alt={im.caption || ''} /></div>
              {im.caption && <div style={{ padding: '10px 12px', fontSize: 13, borderTop: '1px solid var(--line)' }}>{im.caption}</div>}
            </div>
          ))}
        </div>
      )}
      {p.narrative && <Reveal className="card soft" style={{ marginBottom: 14 }}><div className="eyebrow" style={{ marginBottom: 6 }}>Narrative</div><p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.narrative}</p></Reveal>}
      {(p.bullCase || p.bearCase) && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', marginBottom: 14 }}>
          {p.bullCase && <div className="card soft" style={{ borderColor: 'var(--blue)' }}><div className="eyebrow blue" style={{ marginBottom: 6 }}>Bull case</div><p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.bullCase}</p></div>}
          {p.bearCase && <div className="card soft" style={{ borderColor: 'var(--red)' }}><div className="eyebrow neg" style={{ marginBottom: 6 }}>Bear case</div><p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.bearCase}</p></div>}
        </div>
      )}
      {rows.length > 0 && <div className="kv">{rows.map(([k, v]) => [<span key={k}>{k}</span>, <span key={k + 'v'} style={{ whiteSpace: 'pre-wrap' }}>{v}</span>])}</div>}
      {!rows.length && !p.narrative && !(p.images || []).length && !p.bullCase && !p.bearCase && <Empty title="Empty plan">They shared the day but haven't written anything yet.</Empty>}
    </div>
  );
}
