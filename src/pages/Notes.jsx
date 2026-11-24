import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NotebookPen, Plus, Search, Pin, PinOff, Trash2, Ban, Save, X } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Empty, Seg } from '../components/ui.jsx';
import { cls } from '../lib/format.js';
import { shortDate } from '../lib/dates.js';
import Board from '../components/Board.jsx';

const KINDS = { lesson: 'Lesson', rule: 'Rule', mistake: 'Mistake', idea: 'Idea', review: 'Review' };
const KIND_COLOR = { lesson: '#7c9cff', rule: 'var(--green)', mistake: 'var(--red)', idea: '#e5b53a', review: '#c4b5fd' };
const TEMPLATES = {
  lesson: 'What happened:\n\nWhat I learned:\n\nWhat I will do next time:\n',
  mistake: 'The mistake:\n\nWhy I made it (feeling / trigger):\n\nWhat it cost:\n\nThe rule that prevents it:\n',
  review: 'Week of:\n\nBest trade and why:\n\nWorst trade and why:\n\nRule I broke most:\n\nOne focus for next week:\n',
  rule: 'Rule:\n\nWhy it exists:\n',
  idea: '',
};

/** Tiny formatter: **bold**, - bullets, blank-line paragraphs. Escapes everything else. */
function Rendered({ text }) {
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const html = text.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(esc).join('<br/>')}</p>`;
  }).join('');
  return <div className="note-render" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function Notes() {
  const { api, notify, settings, updateUser, trades, confirmAsk } = useApp();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [edit, setEdit] = useState(null); // note being edited (or new)
  useEffect(() => { api.notes.list().then((r) => { setNotes(r.notes); setLoading(false); }).catch(() => setLoading(false)); }, [api]);

  const shown = useMemo(() => notes.filter((n) => (kind === 'all' || n.kind === kind) && (!q || `${n.title} ${n.body} ${(n.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [notes, q, kind]);

  const save = async (n) => {
    const body = { title: n.title.trim(), body: n.body, kind: n.kind, pinned: !!n.pinned, tags: n.tagsText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean), trade: n.trade || null };
    if (!body.title) return notify('Give the note a title');
    if (n.id) { const { note } = await api.notes.update(n.id, body); setNotes((x) => x.map((y) => (y.id === n.id ? note : y))); }
    else { const { note } = await api.notes.create(body); setNotes((x) => [note, ...x]); }
    setEdit(null); notify('Note saved');
  };
  const togglePin = async (n) => { const { note } = await api.notes.update(n.id, { pinned: !n.pinned }); setNotes((x) => x.map((y) => (y.id === n.id ? note : y)).sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt || '').localeCompare(a.updatedAt || ''))); };
  const remove = async (n) => { if (await confirmAsk(`Delete “${n.title}”?`)) { await api.notes.remove(n.id); setNotes((x) => x.filter((y) => y.id !== n.id)); } };
  const toRule = async (n) => {
    const line = n.title.trim();
    await updateUser({ settings: { donts: [...new Set([...(settings.donts || []), line])] } });
    notify('Added to your Coach “Don’t do next” list');
  };
  const open = (n) => setEdit(n ? { ...n, tagsText: (n.tags || []).join(', ') } : { title: '', body: TEMPLATES.lesson, kind: 'lesson', tagsText: '', pinned: false });

  return (
    <Board id="notes" className="page">
      <div data-fixed className="page-head row between wrap" style={{ gap: 12 }}>
        <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><NotebookPen size={22} /> Learning Notes</h1><div className="muted">Lessons, rules and mistakes in your own words. {notes.length} notes.</div></div>
        <button className="btn primary" onClick={() => open(null)}><Plus size={16} /> New note</button>
      </div>
      <div className="card row wrap" style={{ marginTop: 18, padding: 10, gap: 10 }}>
        <Seg options={[{ value: 'all', label: 'All' }, ...Object.entries(KINDS).map(([value, label]) => ({ value, label }))]} value={kind} onChange={setKind} />
        <span className="grow" />
        <div className="row" style={{ background: 'var(--panel2)', borderRadius: 10, padding: '0 10px', width: 260 }}><Search size={14} className="muted" /><input className="input" style={{ background: 'none', padding: 8 }} placeholder="Search notes, #tags" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {!loading && shown.length === 0 ? (
        <Empty icon={<NotebookPen />} title={notes.length ? 'Nothing matches' : 'Write your first lesson'} action={!notes.length && <button className="btn primary" onClick={() => open(null)}>New note</button>}>
          {notes.length ? 'Try another search or type.' : 'The traders who improve fastest write down what they learn. Use the templates for lessons, mistakes and weekly reviews.'}
        </Empty>
      ) : (
        <motion.div layout className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))', marginTop: 18 }}>
          <AnimatePresence>
            {shown.map((n, i) => (
              <motion.div layout key={n.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="card note-card" style={{ borderTop: `3px solid ${KIND_COLOR[n.kind]}` }} onClick={() => open(n)}>
                <div className="row between">
                  <span className="tag" style={{ color: KIND_COLOR[n.kind] }}>{KINDS[n.kind]}</span>
                  <span className="row" style={{ gap: 2 }} onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" style={{ width: 28, height: 28 }} title={n.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(n)}>{n.pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
                    {(n.kind === 'rule' || n.kind === 'mistake') && <button className="icon-btn" style={{ width: 28, height: 28 }} title="Add title to Coach don'ts" onClick={() => toRule(n)}><Ban size={14} /></button>}
                    <button className="icon-btn" style={{ width: 28, height: 28 }} title="Delete" onClick={() => remove(n)}><Trash2 size={14} /></button>
                  </span>
                </div>
                <h3 style={{ fontSize: 18, margin: '10px 0 6px' }}>{n.pinned && '📌 '}{n.title}</h3>
                <div className="note-preview"><Rendered text={n.body || ''} /></div>
                <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                  {(n.tags || []).map((t) => <span key={t} className="tag" style={{ fontSize: 11.5 }}>#{t}</span>)}
                  <span className="grow" /><span className="dim" style={{ fontSize: 12 }}>{n.updatedAt ? shortDate(n.updatedAt.slice(0, 10)) : ''}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence data-free>
        {edit && (
          <motion.div className="overlay center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && setEdit(null)}>
            <motion.div className="dialog" style={{ width: 'min(760px,96vw)' }} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}>
              <div className="row between" style={{ marginBottom: 14 }}><b style={{ fontSize: 20 }}>{edit.id ? 'Edit note' : 'New note'}</b><button className="close-x" onClick={() => setEdit(null)}><X size={18} /></button></div>
              <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
                {Object.entries(KINDS).map(([k, l]) => (
                  <button key={k} className={cls('chip', edit.kind === k && 'on')} onClick={() => setEdit({ ...edit, kind: k, body: !edit.body || Object.values(TEMPLATES).includes(edit.body) ? TEMPLATES[k] : edit.body })}>{l}</button>
                ))}
              </div>
              <input className="input" style={{ fontSize: 20, fontWeight: 600 }} placeholder={edit.kind === 'rule' || edit.kind === 'mistake' ? 'e.g. Never trade before 9:30' : 'Title'} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} autoFocus />
              <textarea className="textarea" style={{ minHeight: 260, marginTop: 10, fontFamily: 'var(--font)' }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} placeholder="Write it in your own words. **bold** and - bullet lists work." />
              <div className="fgrid" style={{ marginTop: 10 }}>
                <input className="input" placeholder="Tags, comma separated (e.g. fomo, nq)" value={edit.tagsText} onChange={(e) => setEdit({ ...edit, tagsText: e.target.value })} />
                <select className="select" value={edit.trade || ''} onChange={(e) => setEdit({ ...edit, trade: e.target.value })}>
                  <option value="">Link to a trade (optional)</option>
                  {trades.filter((t) => !t.noTrade).slice(0, 60).map((t) => <option key={t.id} value={t.id}>{t.date} · {t.symbol} · {t.pnl >= 0 ? '+' : ''}{t.pnl}</option>)}
                </select>
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <label className="row muted" style={{ gap: 8 }}><input type="checkbox" checked={!!edit.pinned} onChange={(e) => setEdit({ ...edit, pinned: e.target.checked })} /> Pin to top</label>
                <span className="grow" />
                <button className="btn" onClick={() => setEdit(null)}>Cancel</button>
                <button className="btn primary" onClick={() => save(edit)}><Save size={15} /> Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Board>
  );
}
