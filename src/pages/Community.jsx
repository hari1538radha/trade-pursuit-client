import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Trash2, RefreshCw, Hash, Users } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Money, Empty } from '../components/ui.jsx';
import { initials, cls, rr } from '../lib/format.js';
import { relTime, weekStart, dayMonth } from '../lib/dates.js';
import { summary, byDay } from '../lib/stats.js';

export default function Community() {
  const { api, user, notify, trades, breakEven } = useApp();
  const [posts, setPosts] = useState([]);
  const [next, setNext] = useState(null);
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async (more) => {
    setLoading(true);
    const r = await api.posts.list({ before: more ? next : undefined, tag: tag || undefined });
    setPosts((p) => (more ? [...p, ...r.posts] : r.posts)); setNext(r.next); setLoading(false);
  };
  useEffect(() => { load(false); }, [tag]); // eslint-disable-line
  const post = async (extra) => {
    const t = (extra?.text ?? text).trim(); if (!t) return;
    const r = await api.posts.create({ text: t, trade: extra?.trade });
    setPosts((p) => [r.post, ...p]); setText('');
  };
  const shareWeek = () => {
    const ws = weekStart();
    const wt = trades.filter((t) => t.date >= ws);
    const s = summary(wt, breakEven);
    if (!s.count) return notify('No trades this week yet');
    const days = [...byDay(wt).values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ date: d.date, pnl: d.pnl }));
    post({ text: text || `Week of ${dayMonth(ws)} #weekly`, trade: { kind: 'week', week: ws, total: s.total, trades: s.count, winRate: s.winRate, days } });
  };
  const visible = tag ? posts : posts;
  return (
    <div className="page" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,680px) 300px', gap: 30, justifyContent: 'center' }}>
      <div>
        <div className="row between"><h1 style={{ margin: 0, fontSize: 28 }}>Home</h1><button className="icon-btn" onClick={() => load(false)}><RefreshCw size={16} /></button></div>
        {tag && <div className="row" style={{ marginTop: 12 }}><span className="tag"><Hash size={12} />{tag.replace('#', '')}</span><button className="muted" onClick={() => setTag('')}>clear</button></div>}
        <div className="row" style={{ alignItems: 'flex-start', gap: 14, padding: '22px 0', borderBottom: '1px solid var(--line)' }}>
          <span className="avatar" style={{ width: 44, height: 44 }}>{initials(user.displayName)}</span>
          <div className="grow">
            <textarea className="textarea" style={{ minHeight: 70, background: 'none', padding: '8px 0', fontSize: 17 }} maxLength={1000} placeholder="Share a trade, a lesson, a theme… use #tags and $tickers" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="row between"><button className="btn sm" onClick={shareWeek}>Share my week</button><button className="btn primary sm" disabled={!text.trim()} onClick={() => post()}>Post</button></div>
          </div>
        </div>
        {!loading && visible.length === 0 && <Empty icon={<Users />} title="Quiet in here">Invite your friends: they sign up with a username and password, and everyone's posts show up here.</Empty>}
        <AnimatePresence initial={false}>
          {visible.map((p) => <Post key={p.id} p={p} onTag={setTag} onLike={async () => { const r = await api.posts.like(p.id); setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, liked: r.liked, likes: r.likes } : x))); }} onDelete={async () => { await api.posts.remove(p.id); setPosts((ps) => ps.filter((x) => x.id !== p.id)); }} />)}
        </AnimatePresence>
        {next && <button className="btn" style={{ width: '100%', marginTop: 16 }} onClick={() => load(true)}>Load more</button>}
      </div>
      <aside>
        <div className="card">
          <h3 style={{ fontSize: 22 }}>Trade with friends</h3>
          <p className="muted" style={{ lineHeight: 1.5 }}>Share this site with friends. Each person gets their own private journal; only what you post here is public.</p>
          <p className="muted" style={{ fontSize: 13 }}>Your handle: <b style={{ color: 'var(--text)' }}>@{user.username}</b></p>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <h3>Trending tags</h3>
          <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
            {[...new Set(posts.flatMap((p) => p.tags || []))].slice(0, 12).map((t) => <button key={t} className="tag" onClick={() => setTag(t)}>{t}</button>)}
            {!posts.length && <span className="muted">None yet</span>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Post({ p, onLike, onDelete, onTag }) {
  const parts = p.text.split(/([#$][a-z0-9_]+)/gi);
  const t = p.trade;
  return (
    <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="post">
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <span className="avatar" style={{ width: 44, height: 44 }}>{initials(p.author?.displayName)}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}><b>{p.author?.displayName}</b><span className="muted">@{p.author?.username} · {relTime(p.createdAt)}</span></div>
          <p style={{ fontSize: 16, lineHeight: 1.5, margin: '6px 0', whiteSpace: 'pre-wrap' }}>
            {parts.map((x, i) => (/^[#$]/.test(x) ? <button key={i} style={{ color: 'var(--blue)' }} onClick={() => onTag(x.toLowerCase())}>{x}</button> : x))}
          </p>
          {t?.kind === 'week' && (
            <div className="weekcard">
              <div className="eyebrow">Weekly</div><b style={{ fontSize: 20 }}>Week of {dayMonth(t.week)}</b>
              <div className="row between" style={{ alignItems: 'flex-end', marginTop: 10 }}>
                <div><div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-.03em' }}><Money value={t.total} /></div><div className="muted">{t.trades} trades · {Math.round(t.winRate)}% win rate</div></div>
                <div className="col" style={{ gap: 4, fontSize: 14 }}>{t.days.map((d) => <div key={d.date} className="row between" style={{ gap: 18 }}><span className="muted">{dayMonth(d.date)}</span><b><Money value={d.pnl} /></b></div>)}</div>
              </div>
            </div>
          )}
          {t && t.kind !== 'week' && (
            <div className="weekcard row between">
              <div><b style={{ fontSize: 20 }}>{t.symbol}</b> <span className="tag">{t.direction}</span>{t.grade && <span className="tag" style={{ marginLeft: 6 }}>{t.grade}</span>}<div className="muted" style={{ marginTop: 4 }}>{t.playbook} · {dayMonth(t.date)}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: 28, fontWeight: 700 }}><Money value={t.pnl} /></div>{Number.isFinite(t.rr) && <b>{rr(t.rr)}</b>}</div>
            </div>
          )}
          <div className="row" style={{ gap: 20, marginTop: 10 }}>
            <motion.button whileTap={{ scale: 1.3 }} className={cls('row', p.liked && 'neg')} style={{ gap: 6 }} onClick={onLike}><Heart size={17} fill={p.liked ? 'currentColor' : 'none'} /> {p.likes}</motion.button>
            {p.mine && <button className="muted row" style={{ gap: 6 }} onClick={onDelete}><Trash2 size={15} /> Delete</button>}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
