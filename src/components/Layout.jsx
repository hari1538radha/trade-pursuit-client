import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, BookOpen, Target, BarChart3, Building2, Users, ChevronsLeft, ChevronsRight, ChevronDown, Settings, Plus, Pencil, ArrowUpRight, ArrowDownRight, ShieldAlert, LogOut, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Logo, Seg, Toggle, Money, Dialog, Field, Toast, SymbolIcon, ease } from './ui.jsx';
import { cls, initials, money, usd, kfmt } from '../lib/format.js';
import { today, dayMonth, shortDate } from '../lib/dates.js';
import { accountMetrics } from '../lib/firms.js';
import Modals from '../features/Modals.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/strategy', label: 'Strategy', icon: Target },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/propfirm', label: 'Propfirm', icon: Building2 },
  { to: '/community', label: 'Community', icon: Users },
];

export default function Layout() {
  const { user, mode, setMode, openModal, api } = useApp();
  const loc = useLocation();
  const [deskOpen, setDesk] = useState(true);
  const [railOpen, setRail] = useState(true);
  const mainRef = useRef(null);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [loc.pathname]);

  // Global shortcuts: Q = quick log, N = log trade
  useEffect(() => {
    const k = (e) => {
      if (e.target.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey) return;
      if (document.querySelector('.overlay')) return;
      if (e.key === 'q') { e.preventDefault(); openModal('quick'); }
      if (e.key === 'n') { e.preventDefault(); openModal('log'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [openModal]);

  return (
    <div className="shell">
      <header className="topnav">
        <Logo />
        <span className="brand">Trade Pursuit</span>
        {api.demo && <span className="chip-top" style={{ background: '#2b1d6b', borderColor: '#4b35b5', color: '#cfc4ff' }}>Preview</span>}
        <nav className="navlinks">
          {NAV.map(({ to, label, icon: I, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cls('navlink', isActive && 'active')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="navpill" className="pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <I size={16} /> <span className="lbl">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button className="btn sm" onClick={() => openModal('quick')} title="Quick log (Q)"><Plus size={15} /> Quick log</button>
        <button className="icon-btn" onClick={() => openModal('settings')} title="Settings"><Settings size={18} /></button>
        <button className="row" onClick={() => openModal('settings')} style={{ gap: 10 }}>
          <span style={{ fontWeight: 600 }}>{user.displayName}</span>
          <span className="avatar">{initials(user.displayName)}</span>
        </button>
      </header>

      <div className="body">
        <Desk open={deskOpen} toggle={() => setDesk((o) => !o)} />
        <main className="main">
          <div className="main-card" ref={mainRef}>
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}>
              <Outlet />
            </motion.div>
          </div>
        </main>
        <Rail open={railOpen} toggle={() => setRail((o) => !o)} />
      </div>

      <footer className="footer">
        <Seg options={[{ value: 'live', label: 'Live money' }, { value: 'paper', label: 'Paper money' }]} value={mode} onChange={setMode} />
        <span className="dim">Press <b className="muted">Q</b> quick log · <b className="muted">N</b> full log</span>
        <span className="row" style={{ gap: 16 }}>
          {api.demo ? <span>Preview mode · data stays in this browser</span> : <span>{user.username}</span>}
        </span>
      </footer>
      <Modals />
      <Toast />
    </div>
  );
}

function Desk({ open, toggle }) {
  const { accounts, allTrades, openModal, user, trades, updateUser } = useApp();
  const nav = useNavigate();
  const g = user.settings?.guardrails || {};
  const rulesOn = [g.dailyLossLimit > 0, g.maxTradesPerDay > 0].filter(Boolean).length;
  const active = accounts.filter((a) => a.status === 'active');
  const td = trades.filter((t) => t.date === today() && !t.noTrade);
  const dayPnl = td.reduce((s, t) => s + (t.pnl || 0), 0);
  if (!open) return <aside className="desk collapsed"><button className="icon-btn" style={{ margin: '14px 5px' }} onClick={toggle}><ChevronsRight size={16} /></button></aside>;
  return (
    <aside className="desk">
      <div className="desk-inner">
        <div className="row between"><span className="eyebrow">Desk</span><button className="icon-btn" onClick={toggle}><ChevronsLeft size={16} /></button></div>
        <div className="row between" style={{ margin: '18px 0 12px' }}>
          <span className="eyebrow">Accounts</span>
          <button className="row muted" style={{ fontSize: 12, gap: 4 }} onClick={() => openModal('addAccount')}>{active.length} · Open <Plus size={13} /></button>
        </div>
        {active.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', lineHeight: 1.6 }}>No accounts yet. <button style={{ textDecoration: 'underline' }} onClick={() => nav('/propfirm')}>Pick a firm</button> to add one.</p>
        ) : (
          <AnimatePresence initial={false}>
            {active.map((a) => {
              const m = accountMetrics(a, allTrades);
              return (
                <motion.div layout key={a.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="acct" onClick={() => openModal('account', { id: a.id })}>
                  <div className="row between">
                    <b style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.02em' }}>{a.name}</b>
                    <Money value={m.pnl} cents={false} className="mono" />
                  </div>
                  {m.progress != null && <div className="bar" style={{ margin: '9px 0 6px' }}><motion.i initial={{ width: 0 }} animate={{ width: `${m.progress * 100}%` }} transition={{ duration: 0.8, ease }} /></div>}
                  <div className="row between dim" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', marginTop: m.progress == null ? 8 : 0 }}>
                    <span>{a.kind === 'funded' ? 'Funded' : a.phase}</span>
                    <span>{m.breached ? <span className="neg">Breached</span> : m.hit ? <span className="pos">Target hit</span> : m.targetBal ? `${money(m.targetBal - m.balance, { sign: false, cents: false })} left` : m.buffer != null ? `${usd(m.buffer)} buffer` : usd(m.balance)}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
      <div style={{ padding: 16, borderTop: '1px solid #141418' }}>
        <div className="row between">
          <button className="eyebrow row" style={{ gap: 6 }} onClick={() => openModal('settings', { tab: 'Guardrails' })}>Guardrails <SlidersHorizontal size={12} /></button>
          <span className="muted mono" style={{ fontSize: 12 }}>{rulesOn}/2</span>
        </div>
        <div className="row" style={{ gap: 4, margin: '10px 0' }}>
          {[0, 1].map((i) => <div key={i} className="bar grow"><i style={{ width: i < rulesOn ? '100%' : 0, background: g.enabled ? 'var(--green)' : '#555' }} /></div>)}
        </div>
        <div className="row between">
          <span className="muted" style={{ fontSize: 13 }}>
            {g.enabled ? (g.dailyLossLimit ? `Today ${money(dayPnl, { cents: false })} of -$${g.dailyLossLimit}` : 'On. Set your limits.') : 'Off. Losses never lock the app.'}
          </span>
          <Toggle on={!!g.enabled} onChange={(v) => updateUser({ settings: { guardrails: { ...g, enabled: v } } })} />
        </div>
        {g.enabled && td.length > 0 && ((g.dailyLossLimit && dayPnl <= -g.dailyLossLimit) || (g.maxTradesPerDay && td.length >= g.maxTradesPerDay)) && (
          <div className="row neg" style={{ marginTop: 10, fontSize: 13, gap: 6 }}><ShieldAlert size={15} /> Limit reached. Walk away for today.</div>
        )}
      </div>
    </aside>
  );
}

function Rail({ open, toggle }) {
  const { trades, user, api, openModal, settings } = useApp();
  const nav = useNavigate();
  const [plan, setPlan] = useState(null);
  const [editing, setEditing] = useState(false);
  const [openSec, setOpenSec] = useState({ plan: true, check: true, session: true, recent: true });
  const date = today();
  useEffect(() => { api.plans.get(date).then((r) => setPlan(r.plan)).catch(() => {}); }, [api, date]);
  const checklist = settings.checklist || [];
  const checks = plan?.checks || [];
  const setCheck = async (i) => {
    const next = checklist.map((_, k) => (k === i ? !checks[k] : !!checks[k]));
    setPlan((p) => ({ ...(p || {}), checks: next }));
    await api.plans.put(date, { checks: next });
  };
  const td = trades.filter((t) => t.date === date && !t.noTrade);
  const pnl = td.reduce((s, t) => s + (t.pnl || 0), 0);
  const w = td.filter((t) => t.pnl > 0).length, l = td.filter((t) => t.pnl < 0).length;
  const kept = td.every((t) => t.followedPlan !== false);
  const recent = useMemo(() => trades.filter((t) => !t.noTrade).slice(0, 6), [trades]);
  const Sec = ({ k, title, right, children }) => (
    <div style={{ borderBottom: '1px solid #18181c', padding: '14px 0' }}>
      <div className="row between">
        <button className="eyebrow row" style={{ gap: 6 }} onClick={() => setOpenSec((s) => ({ ...s, [k]: !s[k] }))}>
          <motion.span animate={{ rotate: openSec[k] ? 0 : -90 }}><ChevronDown size={13} /></motion.span>{title}
        </button>{right}
      </div>
      <AnimatePresence initial={false}>
        {openSec[k] && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}><div style={{ paddingTop: 12 }}>{children}</div></motion.div>}
      </AnimatePresence>
    </div>
  );
  if (!open) return <aside className="rail collapsed"><button className="icon-btn" style={{ margin: '14px 5px' }} onClick={toggle}><ChevronsLeft size={16} /></button></aside>;
  const hasPlan = plan && (plan.bias || plan.keyLevels || plan.ruleReminder || plan.avoid);
  return (
    <aside className="rail">
      <div className="rail-inner">
        <div className="row between"><button className="icon-btn" onClick={toggle}><ChevronsRight size={16} /></button><span className="mono muted">{dayMonth(date)}</span></div>
        <Sec k="plan" title="The plan" right={<button style={{ fontSize: 13 }} onClick={() => setEditing(true)}>Write</button>}>
          {hasPlan ? (
            <div className="col" style={{ gap: 10, fontSize: 13 }}>
              {plan.bias && <div className="row between"><span className="muted">Bias</span><b>{plan.bias}</b></div>}
              {[['Key levels', 'keyLevels'], ['Rule reminder', 'ruleReminder'], ['Avoid', 'avoid']].map(([l, k]) => plan[k] && <div key={k}><div className="eyebrow" style={{ fontSize: 10, marginBottom: 3 }}>{l}</div><div style={{ color: '#c9c9d0', lineHeight: 1.45 }}>{plan[k]}</div></div>)}
            </div>
          ) : (
            <button onClick={() => setEditing(true)} style={{ width: '100%', border: '1px dashed #2a2a30', borderRadius: 12, padding: 16, color: 'var(--muted)', fontSize: 13 }}>No pre-market plan yet</button>
          )}
        </Sec>
        <Sec k="check" title="Checklist" right={<button className="row muted mono" style={{ fontSize: 12, gap: 6 }} onClick={() => openModal('settings', { tab: 'Checklist' })}>{checklist.filter((_, i) => checks[i]).length}/{checklist.length} <Pencil size={12} /></button>}>
          <div className="col" style={{ gap: 10 }}>
            {checklist.map((c, i) => (
              <button key={i} className="row" style={{ alignItems: 'flex-start', gap: 10, textAlign: 'left', fontSize: 13.5, color: checks[i] ? 'var(--muted)' : '#d6d6dc' }} onClick={() => setCheck(i)}>
                <motion.span animate={{ background: checks[i] ? '#4ade80' : 'rgba(0,0,0,0)', borderColor: checks[i] ? '#4ade80' : '#55555e' }} style={{ width: 17, height: 17, borderRadius: '50%', border: '1.5px solid', flex: 'none', marginTop: 1, display: 'grid', placeItems: 'center', color: '#052', fontSize: 11 }}>{checks[i] ? '✓' : ''}</motion.span>
                <span style={{ textDecoration: checks[i] ? 'line-through' : 'none' }}>{c}</span>
              </button>
            ))}
          </div>
        </Sec>
        <Sec k="session" title="Session" right={<span className="mono muted" style={{ fontSize: 12 }}>{w}W / {l}L</span>}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.03em' }}><Money value={pnl} animated /></div>
          <div className="row between muted" style={{ fontSize: 13, marginTop: 6 }}><span>{td.length ? (kept ? 'Rules kept' : <span className="neg">Rule broken</span>) : 'No trades today'}</span><span>{td.length} trades</span></div>
        </Sec>
        <Sec k="recent" title="Recent trades" right={<button style={{ fontSize: 13 }} onClick={() => nav('/journal')}>All</button>}>
          {recent.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Nothing logged yet.</p>}
          <div className="col" style={{ gap: 14 }}>
            {recent.map((t) => (
              <button key={t.id} className="row between" style={{ textAlign: 'left' }} onClick={() => openModal('log', { trade: t })}>
                <span className="row" style={{ gap: 8 }}>
                  {t.direction === 'short' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  <span><b>{t.symbol || '—'}</b><div className="dim" style={{ fontSize: 12 }}>{t.playbook || t.session || ''} {Number.isFinite(t.realizedRR) ? `· ${t.realizedRR > 0 ? '+' : ''}${t.realizedRR}R` : ''}</div></span>
                </span>
                <span style={{ textAlign: 'right' }}><Money value={t.pnl} className="mono" /><div className="dim" style={{ fontSize: 12 }}>{t.date === date ? 'Today' : shortDate(t.date).replace(/, \d{4}/, '')}</div></span>
              </button>
            ))}
          </div>
        </Sec>
      </div>
      <PlanDialog open={editing} onClose={() => setEditing(false)} plan={plan} onSave={async (b) => { const r = await api.plans.put(date, b); setPlan(r.plan); setEditing(false); }} />
    </aside>
  );
}

function PlanDialog({ open, onClose, plan, onSave }) {
  const [f, setF] = useState({});
  useEffect(() => { if (open) setF({ bias: plan?.bias || '', keyLevels: plan?.keyLevels || '', ruleReminder: plan?.ruleReminder || '', avoid: plan?.avoid || '' }); }, [open, plan]);
  return (
    <Dialog open={open} onClose={onClose} title="Pre-market plan">
      <div className="col" style={{ gap: 16 }}>
        <Field label="Bias"><Seg options={['Bullish', 'Bearish', 'Neutral', 'No bias']} value={f.bias} onChange={(bias) => setF({ ...f, bias })} /></Field>
        <Field label="Key levels"><textarea className="textarea" style={{ minHeight: 70 }} value={f.keyLevels} onChange={(e) => setF({ ...f, keyLevels: e.target.value })} placeholder="Asia high 25,954 · Asia low 25,916" /></Field>
        <Field label="Rule reminder"><textarea className="textarea" style={{ minHeight: 60 }} value={f.ruleReminder} onChange={(e) => setF({ ...f, ruleReminder: e.target.value })} placeholder="Asia is for levels. The trade is in New York." /></Field>
        <Field label="Avoid"><textarea className="textarea" style={{ minHeight: 60 }} value={f.avoid} onChange={(e) => setF({ ...f, avoid: e.target.value })} placeholder="Trading the Asia chop because I am awake." /></Field>
        <button className="btn primary" onClick={() => onSave(f)}>Save plan</button>
      </div>
    </Dialog>
  );
}
