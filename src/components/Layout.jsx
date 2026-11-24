import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, BookOpen, Target, BarChart3, Building2, NotebookPen, GraduationCap, Leaf, FileDown, Activity, LineChart, Newspaper, Gem, Users, HandCoins, Wallet, HeartPulse, Sun, Moon, ChevronsLeft, ChevronsRight, ChevronDown, Settings, Plus, Pencil, ArrowUpRight, ArrowDownRight, ShieldAlert, LogOut, SlidersHorizontal, LayoutDashboard, Check, RotateCcw } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Logo, Seg, Toggle, Money, Dialog, Field, Toast, SymbolIcon, ease } from './ui.jsx';
import { cls, initials, money, usd, kfmt } from '../lib/format.js';
import { today, dayMonth, shortDate } from '../lib/dates.js';
import { accountMetrics } from '../lib/firms.js';
import Modals from '../features/Modals.jsx';
import DailyNudge from './DailyNudge.jsx';
import CoachDock from './CoachDock.jsx';
import WeekTicker from './WeekTicker.jsx';
import AutoPass from './AutoPass.jsx';
import QuotePop from './QuotePop.jsx';
import { LayoutEdit, useResetLayout } from './Board.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/strategy', label: 'Strategy', icon: Target },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/propfirm', label: 'Propfirm', icon: Building2 },
  { to: '/options', label: 'Options', icon: Activity, admin: true },
  { to: '/stocks', label: 'Stocks', icon: LineChart, admin: true },
  { to: '/goldbach', label: 'Goldbach', icon: Gem, admin: true },
  { to: '/notes', label: 'Notes', icon: NotebookPen, admin: true },
  { to: '/quiz', label: 'Quiz', icon: GraduationCap, admin: true },
  { to: '/payouts', label: 'Payouts', icon: HandCoins, admin: true },
  { to: '/money', label: 'Money', icon: Wallet, admin: true },
  { to: '/lifestyle', label: 'Lifestyle', icon: HeartPulse, admin: true },
  { to: '/traders', label: 'Traders', icon: Users, admin: true },
];

export function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  const light = theme === 'light';
  return (
    <button className="theme-btn" onClick={toggleTheme} title={light ? 'Switch to dark mode' : 'Switch to light mode'} aria-label="Toggle light and dark mode">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={theme} initial={{ y: -14, opacity: 0, rotate: -60 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 14, opacity: 0, rotate: 60 }} transition={{ duration: 0.2 }} style={{ display: 'grid' }}>
          {light ? <Moon size={16} /> : <Sun size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

const useMedia = (q) => {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
};
const ADMIN_PATHS = /^\/(options|stocks|goldbach|notes|quiz|calm|payouts|money|lifestyle|traders)(\/|$)/;
export const boardIdFor = (path) => (path.split('/')[1] || 'dashboard');

export default function Layout() {
  const { user, mode, setMode, openModal, api, settings, isAdmin, notify } = useApp();
  const loc = useLocation();
  const big = useMedia('(min-width:1025px)');
  // Admin-only pages keep the desktop layout on phones and tablets (scroll sideways)
  const forceDesktop = !big && ADMIN_PATHS.test(loc.pathname);
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!big) setEditing(false); }, [big]);
  const resetLayout = useResetLayout();
  const edit = useMemo(() => ({ editing: editing && big, setEditing, desktop: big || forceDesktop }), [editing, big, forceDesktop]);
  const [deskOpen, setDesk] = useState(true);
  const [railOpen, setRail] = useState(true);
  const mainRef = useRef(null);
  // Data-heavy pages use the whole screen: no desk on the left, no rail on the right
  const wide = /^\/(options|stocks|goldbach|traders|payouts|money|lifestyle)(\/|$)/.test(loc.pathname);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); window.scrollTo(0, 0); }, [loc.pathname]);

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
    <LayoutEdit.Provider value={edit}>
    <div className={cls('shell', forceDesktop && 'force-desktop', edit.editing && 'layout-editing')}>
      <header className="topnav">
        <Logo />
        <span className="brand">Trade Pursuit</span>
        {api.demo && <span className="chip-top preview">Preview</span>}
        <nav className={cls('navlinks', isAdmin && 'many')}>
          {NAV.filter((n) => isAdmin || !n.admin).map(({ to, label, icon: I, end }) => (
            <NavLink key={to} to={to} end={end} title={label} className={({ isActive }) => cls('navlink', isActive && 'active')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="navpill" className="pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <I size={16} /> <span className="lbl">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {isAdmin && <NavLink to="/calm" className={({ isActive }) => cls('btn sm top-calm', isActive && 'primary')} title="Mind Calm"><Leaf size={15} /> Calm</NavLink>}
        <button className="btn sm top-quick" onClick={() => openModal('quick')} title="Quick log (Q)"><Plus size={15} /> Quick log</button>
        <button className={cls('icon-btn top-layout', editing && 'on')} onClick={() => setEditing((v) => !v)} title="Customize layout: drag and resize the blocks on this page" aria-pressed={editing}><LayoutDashboard size={17} /></button>
        <ThemeToggle />
        <button className="icon-btn top-settings" onClick={() => openModal('settings')} title="Settings"><Settings size={18} /></button>
        <button className="row" onClick={() => openModal('settings')} style={{ gap: 10 }} aria-label="Settings and profile">
          <span className="uname" style={{ fontWeight: 600 }}>{user.displayName}</span>
          <span className="avatar">{initials(user.displayName)}</span>
        </button>
      </header>

      <div className={cls('body', wide && 'wide')}>
        {!wide && <Desk open={deskOpen} toggle={() => setDesk((o) => !o)} />}
        <main className="main">
          <div className="main-card" ref={mainRef}>
            {/* Plain keyed fade-in (no exit animation): AnimatePresence "wait" could leave a page blank */}
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease }} style={{ position: 'relative', zIndex: 1 }}>
              <Outlet />
            </motion.div>
          </div>
        </main>
        {!wide && <Rail open={railOpen} toggle={() => setRail((o) => !o)} />}
      </div>

      <WeekTicker />

      <footer className="footer">
        <Seg options={[{ value: 'live', label: 'Live money' }, { value: 'paper', label: 'Paper money' }]} value={mode} onChange={setMode} />
        <span className="dim">Press <b className="muted">Q</b> quick log · <b className="muted">N</b> full log</span>
        <span className="row" style={{ gap: 16 }}>
          {api.demo ? <span>Preview mode · data stays in this browser</span> : <span>{user.username}</span>}
        </span>
      </footer>
      <TabBar />
      <AutoPass />
      <Modals />
      <DailyNudge />
      <CoachDock />
      <QuotePop />
      <Toast />
      <AnimatePresence>
        {edit.editing && (
          <motion.div className="edit-bar" initial={{ y: 30, opacity: 0, x: '-50%' }} animate={{ y: 0, opacity: 1, x: '-50%' }} exit={{ y: 30, opacity: 0, x: '-50%' }}>
            <LayoutDashboard size={16} />
            <span><b>Customize layout</b> <span className="muted">· drag ⠿ to move · drag a corner to resize</span></span>
            <button className="btn sm ghost" onClick={async () => { await resetLayout(boardIdFor(loc.pathname)); notify('Layout reset for this page'); }}><RotateCcw size={13} /> Reset page</button>
            <button className="btn sm primary" onClick={() => setEditing(false)}><Check size={14} /> Done</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </LayoutEdit.Provider>
  );
}

/**
 * Phones and iPads (up to 1024px): bottom tab bar instead of the top links.
 * Home, Journal, quick log (+), Analytics and More (every other page, Live/Paper, report, settings).
 */
function TabBar() {
  const { isAdmin, openModal, mode, setMode } = useApp();
  const loc = useLocation();
  const [more, setMore] = useState(false);
  useEffect(() => { setMore(false); }, [loc.pathname]);
  const main = [NAV[0], NAV.find((n) => n.to === '/journal')];
  const after = [NAV.find((n) => n.to === '/analytics')];
  const rest = NAV.filter((n) => (isAdmin || !n.admin) && !['/', '/journal', '/analytics'].includes(n.to));
  if (isAdmin) rest.push({ to: '/calm', label: 'Calm', icon: Leaf });
  const inMore = rest.some((n) => loc.pathname === n.to || loc.pathname.startsWith(`${n.to}/`));
  const Tab = ({ to, label, icon: I, end }) => (
    <NavLink to={to} end={end} title={label} className={({ isActive }) => cls('tab', isActive && 'active')}><I size={21} /><span>{label === 'Dashboard' ? 'Home' : label}</span></NavLink>
  );
  return (
    <>
      <nav className="tabbar" aria-label="Main">
        {main.map((n) => <Tab key={n.to} {...n} />)}
        <button className="tab-plus" onClick={() => openModal('quick')} aria-label="Quick log a trade"><Plus size={26} /></button>
        {after.map((n) => <Tab key={n.to} {...n} />)}
        <button className={cls('tab more-btn', (more || inMore) && 'active')} onClick={() => setMore((v) => !v)} aria-expanded={more}><SlidersHorizontal size={21} /><span>More</span></button>
      </nav>
      <AnimatePresence>
        {more && (
          <motion.div className="overlay more-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.div className="more-sheet" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} onClick={(e) => e.stopPropagation()}>
              <div className="sheet-grab" />
              <div className="more-grid">
                {rest.map(({ to, label, icon: I }) => (
                  <NavLink key={to} to={to} title={label} className={({ isActive }) => cls('more-item', isActive && 'active')}><I size={22} /><span>{label}</span></NavLink>
                ))}
              </div>
              <div className="more-row">
                <Seg options={[{ value: 'live', label: 'Live money' }, { value: 'paper', label: 'Paper money' }]} value={mode} onChange={setMode} />
              </div>
              <div className="more-row" style={{ gap: 8 }}>
                <button className="btn grow" onClick={() => { setMore(false); openModal('log'); }}><Plus size={15} /> Full trade log</button>
                <button className="btn grow" onClick={() => { setMore(false); openModal('report'); }}><FileDown size={15} /> Report</button>
                <button className="btn" onClick={() => { setMore(false); openModal('settings'); }} aria-label="Settings"><Settings size={16} /></button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
      <div style={{ padding: '12px 16px 0' }}>
        <button className="btn" style={{ width: '100%' }} onClick={() => openModal('report')}><FileDown size={15} /> Download report (PDF)</button>
      </div>
      <div className="desk-foot" style={{ marginTop: 12 }}>
        <div className="row between">
          <button className="eyebrow row" style={{ gap: 6 }} onClick={() => openModal('settings', { tab: 'Guardrails' })}>Guardrails <SlidersHorizontal size={12} /></button>
          <span className="muted mono" style={{ fontSize: 12 }}>{rulesOn}/2</span>
        </div>
        <div className="row" style={{ gap: 4, margin: '10px 0' }}>
          {[0, 1].map((i) => <div key={i} className="bar grow"><i style={{ width: i < rulesOn ? '100%' : 0, background: g.enabled ? 'var(--blue)' : 'var(--dim)' }} /></div>)}
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
  const { pathname } = useLocation();
  useEffect(() => { api.plans.get(date).then((r) => setPlan(r.plan)).catch(() => {}); }, [api, date, pathname]);
  useEffect(() => { const h = (e) => setPlan(e.detail); window.addEventListener('tp-plan', h); return () => window.removeEventListener('tp-plan', h); }, []);
  const checklist = settings.checklist || [];
  const checks = plan?.checks || [];
  const setCheck = async (i) => {
    const next = checklist.map((_, k) => (k === i ? !checks[k] : !!checks[k]));
    setPlan((p) => ({ ...(p || {}), checks: next }));
    const r = await api.plans.put(date, { checks: next });
    window.dispatchEvent(new CustomEvent('tp-plan-rail', { detail: r.plan }));
  };
  const td = trades.filter((t) => t.date === date && !t.noTrade);
  const pnl = td.reduce((s, t) => s + (t.pnl || 0), 0);
  const w = td.filter((t) => t.pnl > 0).length, l = td.filter((t) => t.pnl < 0).length;
  const kept = td.every((t) => t.followedPlan !== false);
  const recent = useMemo(() => trades.filter((t) => !t.noTrade).slice(0, 6), [trades]);
  const Sec = ({ k, title, right, children }) => (
    <div className="rail-sec">
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
              {[['Key levels', 'keyLevels'], ['Rule reminder', 'ruleReminder'], ['Avoid', 'avoid']].map(([l, k]) => plan[k] && <div key={k}><div className="eyebrow" style={{ fontSize: 10, marginBottom: 3 }}>{l}</div><div style={{ color: 'var(--text2)', lineHeight: 1.45 }}>{plan[k]}</div></div>)}
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="dashed">No pre-market plan yet</button>
          )}
        </Sec>
        <Sec k="check" title="Checklist" right={<button className="row muted mono" style={{ fontSize: 12, gap: 6 }} onClick={() => openModal('settings', { tab: 'Checklist' })}>{checklist.filter((_, i) => checks[i]).length}/{checklist.length} <Pencil size={12} /></button>}>
          <div className="col" style={{ gap: 10 }}>
            {checklist.map((c, i) => (
              <button key={i} className="row" style={{ alignItems: 'flex-start', gap: 10, textAlign: 'left', fontSize: 13.5, color: checks[i] ? 'var(--muted)' : 'var(--text2)' }} onClick={() => setCheck(i)}>
                <motion.span animate={{ scale: checks[i] ? [1, 1.25, 1] : 1 }} style={{ background: checks[i] ? 'var(--blue)' : 'transparent', transition: 'background .2s, border-color .2s', width: 17, height: 17, borderRadius: '50%', border: `1.5px solid ${checks[i] ? 'var(--blue)' : 'var(--dim)'}`, flex: 'none', marginTop: 1, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11 }}>{checks[i] ? '✓' : ''}</motion.span>
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
      <PlanDialog open={editing} onClose={() => setEditing(false)} plan={plan} onSave={async (b) => { const r = await api.plans.put(date, b); setPlan(r.plan); setEditing(false); window.dispatchEvent(new CustomEvent('tp-plan-rail', { detail: r.plan })); }} />
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
