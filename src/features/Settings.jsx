import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { User, ListChecks, Tags, ShieldAlert, Scale, Database, Lock, LogOut, X, Plus, Palette, Check, Upload, Ban } from 'lucide-react';
import { compressImage } from '../lib/image.js';
import { Seg } from '../components/ui.jsx';
import { useApp } from '../store/AppContext.jsx';
import { Field, Toggle, ease } from '../components/ui.jsx';
import { cls, initials } from '../lib/format.js';
import { toCSV, download } from '../lib/csv.js';

const TABS = [['Profile', User], ['Appearance', Palette], ['Checklist', ListChecks], ['Tags', Tags], ['Guardrails', ShieldAlert], ['Break-even', Scale], ['Data', Database], ['Security', Lock]];

export default function Settings({ open, onClose, tab: initial }) {
  const [tab, setTab] = useState(initial || 'Profile');
  const { user, signOut } = useApp();
  useEffect(() => { if (open) setTab(initial || 'Profile'); }, [open, initial]);
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35, ease }}
            style={{ width: 'min(1100px,96vw)', height: 'min(820px,92vh)', background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 30, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 150, background: 'linear-gradient(180deg,var(--blue) 0%,var(--navy) 55%,var(--panel) 100%)', position: 'relative', flex: 'none' }}>
              <svg viewBox="0 0 1100 150" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}><path d="M0 110 L140 60 L260 95 L420 35 L560 90 L720 50 L880 100 L1100 40 L1100 150 L0 150Z" fill="var(--panel)" opacity=".92" /><path d="M0 130 L180 95 L330 125 L500 80 L700 120 L900 85 L1100 115 L1100 150 L0 150Z" fill="var(--panel)" /></svg>
              <button className="close-x" onClick={onClose} style={{ position: 'absolute', top: 18, right: 18 }}><X size={18} /></button>
              <div className="row" style={{ position: 'absolute', left: 30, bottom: -10, gap: 16 }}>
                <span className="avatar lg">{initials(user.displayName)}</span>
                <div><b style={{ fontSize: 26 }}>{user.displayName}</b><div className="muted">@{user.username} · Free forever</div></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', flex: 1, minHeight: 0, marginTop: 20 }}>
              <nav style={{ padding: '10px 14px', overflowY: 'auto' }}>
                {TABS.map(([t, I]) => (
                  <button key={t} onClick={() => setTab(t)} className="row" style={{ width: '100%', gap: 12, padding: '11px 12px', borderRadius: 12, position: 'relative', color: tab === t ? 'var(--text)' : 'var(--text2)', fontSize: 15 }}>
                    {tab === t && <motion.span layoutId="settab" style={{ position: 'absolute', inset: 0, background: 'var(--panel3)', borderRadius: 12, zIndex: 0 }} />}
                    <I size={17} style={{ zIndex: 1 }} /><span style={{ zIndex: 1 }}>{t}</span>
                  </button>
                ))}
                <button onClick={signOut} className="row" style={{ width: '100%', gap: 12, padding: '11px 12px', color: 'var(--red)', marginTop: 12 }}><LogOut size={17} /> Sign out</button>
              </nav>
              <div style={{ padding: '10px 30px 30px', overflowY: 'auto' }}>
                <AnimatePresence mode="wait">
                  <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                    <h2 style={{ marginTop: 0 }}>{tab}</h2>
                    {tab === 'Profile' && <Profile />}
                    {tab === 'Appearance' && <Appearance />}
                    {tab === 'Checklist' && <Checklist />}
                    {tab === 'Tags' && <TagsTab />}
                    {tab === 'Guardrails' && <Guardrails />}
                    {tab === 'Break-even' && <BreakEven />}
                    {tab === 'Data' && <Data onClose={onClose} />}
                    {tab === 'Security' && <Security />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Profile() {
  const { user, updateUser, notify } = useApp();
  const [f, setF] = useState({ displayName: user.displayName, bio: user.bio || '' });
  return (
    <div className="col" style={{ gap: 16, maxWidth: 520 }}>
      <Field label="Display name"><input className="input" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
      <Field label="Username" hint="Friends use this to find you. It can't be changed."><input className="input" value={'@' + user.username} disabled /></Field>
      <Field label="Bio"><textarea className="textarea" value={f.bio} maxLength={200} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="NQ scalper. NY AM only." /></Field>
      <button className="btn primary" onClick={async () => { await updateUser(f); notify('Profile saved'); }}>Save</button>
      <p className="dim" style={{ fontSize: 13 }}>Every journal number is self-reported and private to you.</p>
    </div>
  );
}

function ListEditor({ items, onSave, placeholder }) {
  const [list, setList] = useState(items);
  const [draft, setDraft] = useState('');
  return (
    <div className="col" style={{ gap: 8, maxWidth: 560 }}>
      {list.map((c, i) => (
        <motion.div layout key={c + i} className="row">
          <input className="input" value={c} onChange={(e) => setList(list.map((x, k) => (k === i ? e.target.value : x)))} />
          <button className="icon-btn" onClick={() => setList(list.filter((_, k) => k !== i))}><X size={15} /></button>
        </motion.div>
      ))}
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setList([...list, draft.trim()]); setDraft(''); } }}>
        <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} /><button className="btn"><Plus size={15} /></button>
      </form>
      <button className="btn primary" style={{ marginTop: 8 }} onClick={() => onSave(list.filter((x) => x.trim()))}>Save</button>
    </div>
  );
}

function Checklist() {
  const { settings, updateUser, notify } = useApp();
  return <><p className="muted">The questions in your right rail. Tick them before every session.</p><ListEditor items={settings.checklist || []} placeholder="Add a question…" onSave={async (checklist) => { await updateUser({ settings: { checklist } }); notify('Checklist saved'); }} /></>;
}

function TagsTab() {
  const { settings, updateUser, notify } = useApp();
  const [group, setGroup] = useState('playbooks');
  const groups = { playbooks: 'Playbooks', targets: 'Liquidity targets', confluences: 'Confluences', confirmations: 'Confirmations', bonus: 'Bonus', exitReasons: 'Exit reasons' };
  const tags = settings.tags || {};
  return (
    <>
      <p className="muted">These chips appear in Log Trade. Rename or remove them; old trades keep their tags.</p>
      <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>{Object.entries(groups).map(([k, l]) => <button key={k} className={cls('chip', group === k && 'on')} onClick={() => setGroup(k)}>{l}</button>)}</div>
      <ListEditor key={group} items={tags[group] || []} placeholder={`Add to ${groups[group].toLowerCase()}…`} onSave={async (list) => { await updateUser({ settings: { tags: { ...tags, [group]: list } } }); notify('Tags saved'); }} />
    </>
  );
}

function Guardrails() {
  const { settings, updateUser, notify } = useApp();
  const [g, setG] = useState({ enabled: false, dailyLossLimit: 0, maxTradesPerDay: 0, ...(settings.guardrails || {}) });
  return (
    <div className="col" style={{ gap: 18, maxWidth: 520 }}>
      <p className="muted" style={{ margin: 0 }}>Guardrails warn you in the Desk when a limit is hit. They never lock the app.</p>
      <div className="row between card"><span>Guardrails on</span><Toggle on={g.enabled} onChange={(enabled) => setG({ ...g, enabled })} /></div>
      <Field label="Daily loss limit ($)" hint="0 = off"><input className="input" inputMode="decimal" value={g.dailyLossLimit} onChange={(e) => setG({ ...g, dailyLossLimit: +e.target.value || 0 })} /></Field>
      <Field label="Max trades per day" hint="0 = off"><input className="input" inputMode="numeric" value={g.maxTradesPerDay} onChange={(e) => setG({ ...g, maxTradesPerDay: +e.target.value || 0 })} /></Field>
      <button className="btn primary" onClick={async () => { await updateUser({ settings: { guardrails: g } }); notify('Guardrails saved'); }}>Save</button>
    </div>
  );
}

function BreakEven() {
  const { settings, updateUser, notify } = useApp();
  const [v, setV] = useState(settings.breakEven || 0);
  return (
    <div className="col" style={{ gap: 16, maxWidth: 520 }}>
      <p className="muted" style={{ margin: 0 }}>Trades within ±this amount count as break-even, not wins or losses. Win rate ignores them.</p>
      <Field label="Break-even range ($)"><input className="input" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} /></Field>
      <button className="btn primary" onClick={async () => { await updateUser({ settings: { breakEven: Math.abs(parseFloat(v) || 0) } }); notify('Saved'); }}>Save</button>
    </div>
  );
}

function Data({ onClose }) {
  const { allTrades, api, loadData, notify, confirmAsk } = useApp();
  return (
    <div className="col" style={{ gap: 14, maxWidth: 560 }}>
      <div className="card row between"><div><b>Export trades</b><div className="muted" style={{ fontSize: 13 }}>{allTrades.length} entries as CSV</div></div><button className="btn" onClick={() => download('edgelog-trades.csv', toCSV(allTrades))}>Download CSV</button></div>
      <div className="card row between"><div><b>Import trades</b><div className="muted" style={{ fontSize: 13 }}>Use “Import CSV” in Log Trade. Needs Date and P&amp;L columns.</div></div></div>
      <div className="card row between" style={{ borderColor: 'var(--loss-line)' }}>
        <div><b className="neg">Delete history</b><div className="muted" style={{ fontSize: 13 }}>Removes all trades, plans and accounts. Your login stays.</div></div>
        <button className="btn danger" onClick={async () => { if (await confirmAsk('Type DELETE to wipe your journal. This cannot be undone.', 'DELETE')) { await api.auth.deleteHistory(); await loadData(); notify('History deleted'); onClose(); } }}>Delete</button>
      </div>
    </div>
  );
}

function Security() {
  const { api, notify, signOut } = useApp();
  const [f, setF] = useState({ current: '', next: '' });
  const [del, setDel] = useState('');
  return (
    <div className="col" style={{ gap: 16, maxWidth: 520 }}>
      <Field label="Current password"><input type="password" className="input" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoComplete="current-password" /></Field>
      <Field label="New password" hint="At least 6 characters"><input type="password" className="input" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} autoComplete="new-password" /></Field>
      <button className="btn primary" onClick={async () => { try { await api.auth.password(f); setF({ current: '', next: '' }); notify('Password changed'); } catch (e) { notify(e.message); } }}>Change password</button>
      <div className="divider" />
      <b className="neg">Delete account</b>
      <p className="muted" style={{ margin: 0 }}>Permanently deletes your login, trades, accounts, notes and watchlist.</p>
      <div className="row"><input type="password" className="input" placeholder="Password to confirm" value={del} onChange={(e) => setDel(e.target.value)} /><button className="btn danger" onClick={async () => { try { await api.auth.deleteAccount({ password: del }); signOut(); } catch (e) { notify(e.message); } }}>Delete</button></div>
    </div>
  );
}

function Appearance() {
  const { theme, setTheme } = useApp();
  return (
    <div className="col" style={{ gap: 26, maxWidth: 720 }}>
      <Field label="Theme" hint="Also on the sun/moon button in the top bar."><div><Seg options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} value={theme} onChange={setTheme} /></div></Field>
    </div>
  );
}
