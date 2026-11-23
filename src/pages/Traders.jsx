import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Search, ArrowLeft, ShieldCheck, User as UserIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Reveal } from '../components/ui.jsx';
import { summary, cumulative, groupBy, real } from '../lib/stats.js';
import { weekWorst } from '../lib/coach.js';
import { cls } from '../lib/format.js';

const money = (n, d = 0) => (n == null || !Number.isFinite(n) ? '—' : `${n < 0 ? '-' : n > 0 ? '+' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })}`);
const pct = (n) => (Number.isFinite(n) ? `${n.toFixed(0)}%` : '—');
const date = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const AX = { tickLine: false, axisLine: false, tick: { fontSize: 12, fill: 'var(--text2)' } };

/** Admin only: every trader's journey, read-only */
export default function Traders() {
  const { id } = useParams();
  return id ? <TraderDetail id={id} /> : <TraderList />;
}

function TraderList() {
  const { api } = useApp();
  const nav = useNavigate();
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('live');
  useEffect(() => { api.admin.users().then((r) => setUsers(r.users)).catch((e) => setErr(e.message)); }, [api]);
  const rows = (users || [])
    .filter((u) => !q || `${u.username} ${u.displayName}`.toLowerCase().includes(q.toLowerCase()))
    .map((u) => ({ ...u, s: u.stats[mode] || null }))
    .sort((a, b) => (b.s?.last || '').localeCompare(a.s?.last || ''));
  const total = rows.reduce((a, u) => ({ trades: a.trades + (u.s?.trades || 0), pnl: a.pnl + (u.s?.pnl || 0) }), { trades: 0, pnl: 0 });
  return (
    <div className="page wide-page">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><Users size={22} /> Traders</h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Every trader on the site and their journal. Admin only, read-only.</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Seg options={[{ value: 'live', label: 'Live money' }, { value: 'paper', label: 'Paper money' }]} value={mode} onChange={setMode} />
          <div className="row" style={{ background: 'var(--panel2)', borderRadius: 10, padding: '0 10px', width: 220 }}><Search size={14} className="muted" /><input className="input" style={{ background: 'none', padding: 8 }} placeholder="Search traders" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
      </div>
      {err && <p className="neg">{err}</p>}
      {users && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginTop: 16 }}>
          {[['Traders', users.length], ['Admins', users.filter((u) => u.role === 'admin').length], [`${mode === 'live' ? 'Live' : 'Paper'} trades logged`, total.trades.toLocaleString('en-US')], ['Combined P&L', money(total.pnl)]].map(([l, v]) => (
            <Reveal key={l} className="card stat" style={{ padding: 16 }}><div className="label">{l}</div><div className="val" style={{ fontSize: 24, marginTop: 10 }}>{v}</div></Reveal>
          ))}
        </div>
      )}
      <Reveal className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl tr-tbl">
            <thead><tr><th>Trader</th><th>Role</th><th>Joined</th><th className="r">Trades</th><th className="r">Net P&L</th><th className="r">Win rate</th><th className="r">Off-plan</th><th>Last trade</th><th /></tr></thead>
            <tbody>
              {!users && !err && <tr><td colSpan={9} className="muted" style={{ padding: 24 }}>Loading…</td></tr>}
              {rows.map((u) => {
                const decided = (u.s?.wins || 0) + (u.s?.losses || 0);
                return (
                  <tr key={u.id} className="click" onClick={() => nav(`/traders/${u.id}`)}>
                    <td><b>{u.displayName}</b> <span className="muted">@{u.username}</span></td>
                    <td><RoleTag role={u.role} /></td>
                    <td className="muted">{date(u.joined)}</td>
                    <td className="r mono">{u.s?.trades || 0}</td>
                    <td className={cls('r mono', (u.s?.pnl || 0) > 0 ? 'pos' : (u.s?.pnl || 0) < 0 ? 'neg' : '')} style={{ fontWeight: 600 }}>{u.s ? money(u.s.pnl) : '—'}</td>
                    <td className="r mono">{decided ? pct((u.s.wins / decided) * 100) : '—'}</td>
                    <td className="r mono">{u.s?.trades ? pct((u.s.offPlan / u.s.trades) * 100) : '—'}</td>
                    <td className="muted">{u.s?.last || 'No trades yet'}</td>
                    <td><ChevronRight size={16} className="muted" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
}

const RoleTag = ({ role }) => (role === 'admin'
  ? <span className="tag" style={{ color: 'var(--blue)' }}><ShieldCheck size={12} /> Admin</span>
  : <span className="tag"><UserIcon size={12} /> User</span>);

function TraderDetail({ id }) {
  const { api, notify } = useApp();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState('live');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const load = () => api.admin.user(id).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { setD(null); load(); }, [id]); // eslint-disable-line

  const be = d?.user.settings?.breakEven || 0;
  const trades = useMemo(() => (d?.trades || []).filter((t) => (t.mode || 'live') === mode), [d, mode]);
  const s = useMemo(() => summary(trades, be), [trades, be]);
  const curve = useMemo(() => cumulative(trades), [trades]);
  const monthly = useMemo(() => {
    const m = new Map();
    for (const t of real(trades)) m.set(t.date.slice(0, 7), (m.get(t.date.slice(0, 7)) || 0) + (t.pnl || 0));
    return [...m.entries()].sort().slice(-12).map(([k, v]) => ({ m: new Date(`${k}-01`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), pnl: +v.toFixed(2) }));
  }, [trades]);
  const emo = useMemo(() => groupBy(trades, (t) => t.emotionsNeg || [], be).sort((a, b) => a.pnl - b.pnl).slice(0, 6), [trades, be]);
  const week = useMemo(() => weekWorst(trades, { be }), [trades, be]);
  const offPlan = real(trades).filter((t) => t.followedPlan === false);
  const accName = useMemo(() => new Map((d?.accounts || []).map((a) => [a.id, a.name])), [d]);
  const shown = trades.filter((t) => !q || `${t.symbol} ${t.playbook || ''} ${t.notes || ''} ${(t.emotionsNeg || []).join(' ')} ${(t.emotionsPos || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()));

  const setRole = async (role) => {
    try { await api.admin.setRole(id, role); notify(`${d.user.displayName} is now ${role === 'admin' ? 'an admin' : 'a user'}`); load(); }
    catch (e) { notify(e.message); }
  };

  if (err) return <div className="page"><button className="btn sm" onClick={() => nav('/traders')}><ArrowLeft size={14} /> All traders</button><p className="neg">{err}</p></div>;
  if (!d) return <div className="page"><p className="muted">Loading…</p></div>;
  const u = d.user;
  return (
    <div className="page wide-page">
      <button className="btn sm ghost" onClick={() => nav('/traders')}><ArrowLeft size={14} /> All traders</button>
      <div className="row between wrap" style={{ gap: 12, marginTop: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row">{u.displayName} <span className="muted" style={{ fontSize: 16, fontWeight: 400 }}>@{u.username}</span> <RoleTag role={u.role} /></h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Joined {date(u.joined)} · {d.trades.length} entries · {d.accounts.length} accounts{u.bio ? ` · ${u.bio}` : ''}</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Seg options={[{ value: 'live', label: 'Live money' }, { value: 'paper', label: 'Paper money' }]} value={mode} onChange={setMode} />
          {u.role === 'admin'
            ? <button className="btn sm" onClick={() => setRole('user')}>Make user</button>
            : <button className="btn sm primary" onClick={() => setRole('admin')}><ShieldCheck size={14} /> Make admin</button>}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginTop: 16 }}>
        {[
          ['Net P&L', money(s.total), `${s.count} trades`, s.total >= 0 ? 'var(--green)' : 'var(--red)'],
          ['Win rate', pct(s.winRate), `${s.wins}W · ${s.losses}L · ${s.be}BE`],
          ['Profit factor', Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : s.profitFactor === Infinity ? '∞' : '—', `Expectancy ${money(s.expectancy)}`],
          ['Avg win / loss', `${money(s.avgWin)} / ${money(-s.avgLoss)}`, s.avgWinRR ? `Avg winner ${s.avgWinRR.toFixed(1)}R` : ''],
          ['Off-plan trades', `${offPlan.length}`, offPlan.length ? `${money(offPlan.reduce((a, t) => a + (t.pnl || 0), 0))} from them` : 'Followed the plan', offPlan.length ? 'var(--red)' : undefined],
          ['Max drawdown', money(curve.at(-1)?.maxDD || 0), `Best ${money(s.best)} · worst ${money(s.worst)}`],
        ].map(([l, v, sub, color]) => (
          <Reveal key={l} className="card stat" style={{ padding: 16 }}><div className="label">{l}</div><div className="val" style={{ fontSize: 21, marginTop: 10, color }}>{v}</div>{sub && <div className="foot" style={{ fontSize: 12.5 }}>{sub}</div>}</Reveal>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,560px),1fr))' }}>
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Equity curve</h3>
          <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>Running P&L by day</div>
          <div style={{ height: 280, marginTop: 12 }}>
            {curve.length > 1 ? (
              <ResponsiveContainer>
                <AreaChart data={curve}>
                  <defs><linearGradient id="trEq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--blue)" stopOpacity={0.35} /><stop offset="1" stopColor="var(--blue)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="date" {...AX} minTickGap={40} />
                  <YAxis {...AX} width={70} tickFormatter={(v) => money(v)} />
                  <Tooltip formatter={(v) => money(v, 2)} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 10 }} />
                  <ReferenceLine y={0} stroke="var(--line2)" />
                  <Area dataKey="cum" name="P&L" stroke="var(--blue)" strokeWidth={2.2} fill="url(#trEq)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="empty" style={{ padding: 40 }}>Not enough trades yet.</div>}
          </div>
        </Reveal>
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>P&L by month</h3>
          <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>Last 12 months</div>
          <div style={{ height: 280, marginTop: 12 }}>
            {monthly.length ? (
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="m" {...AX} />
                  <YAxis {...AX} width={70} tickFormatter={(v) => money(v)} />
                  <Tooltip formatter={(v) => money(v, 2)} cursor={{ fill: 'var(--line)' }} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 10 }} />
                  <ReferenceLine y={0} stroke="var(--line2)" />
                  <Bar dataKey="pnl" name="P&L" radius={[4, 4, 0, 0]}>{monthly.map((m) => <Cell key={m.m} fill={m.pnl >= 0 ? 'var(--green)' : 'var(--red)'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty" style={{ padding: 40 }}>No trades yet.</div>}
          </div>
        </Reveal>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,400px),1fr))' }}>
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Last week's worst habits</h3>
          <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>{week.fromAllTime ? 'No trades last week: all-time costliest habits' : `${week.count} trades, ${money(week.pnl)}`}</div>
          <ol className="avoid" style={{ marginTop: 10 }}>
            {week.items.length ? week.items.slice(0, 6).map((x, i) => <li key={i}><b>{x.avoid}</b>{!x.mine && <span>{x.what}</span>}</li>) : <li className="muted">Nothing costly found.</li>}
          </ol>
        </Reveal>
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Emotions that cost money</h3>
          <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>Negative emotions tagged on trades</div>
          <div className="col" style={{ gap: 8, marginTop: 12 }}>
            {emo.length ? emo.map((g) => (
              <div key={g.key} className="row between" style={{ fontSize: 14 }}>
                <span>{g.key} <span className="muted">· {g.count} trades · {pct(g.winRate)} win</span></span>
                <b className={g.pnl < 0 ? 'neg' : 'pos'}>{money(g.pnl)}</b>
              </div>
            )) : <span className="muted">None tagged.</span>}
          </div>
        </Reveal>
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Accounts</h3>
          <div className="col" style={{ gap: 8, marginTop: 12 }}>
            {d.accounts.length ? d.accounts.map((a) => (
              <div key={a.id} className="row between" style={{ background: 'var(--panel2)', borderRadius: 10, padding: '9px 12px', fontSize: 13.5 }}>
                <span><b>{a.name}</b> <span className="muted">{a.firmName || a.firmType} · {a.phase}</span></span>
                <span className="row" style={{ gap: 8 }}><span className="mono">${(a.size || 0).toLocaleString('en-US')}</span><span className="tag">{a.status}</span></span>
              </div>
            )) : <span className="muted">No accounts.</span>}
          </div>
          {u.settings?.donts?.length > 0 && (
            <>
              <h3 style={{ margin: '16px 0 0', fontSize: 15 }}>Their own rules</h3>
              <ul className="muted" style={{ fontSize: 13.5, margin: '6px 0 0', paddingLeft: 18 }}>{u.settings.donts.map((x) => <li key={x}>{x}</li>)}</ul>
            </>
          )}
        </Reveal>
      </div>

      <Reveal className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
        <div className="row between wrap" style={{ padding: '16px 18px 8px', gap: 10 }}>
          <div><h3 style={{ margin: 0, fontSize: 17 }}>Trade log</h3><div className="sub" style={{ fontSize: 13, marginTop: 4 }}>{shown.length} of {trades.length} entries · click a row for the full entry</div></div>
          <div className="row" style={{ background: 'var(--panel2)', borderRadius: 10, padding: '0 10px', width: 260 }}><Search size={14} className="muted" /><input className="input" style={{ background: 'none', padding: 8 }} placeholder="Symbol, setup, emotion, note…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl tr-tbl">
            <thead><tr><th /><th>Date</th><th>Symbol</th><th>Side</th><th>Session</th><th>Setup</th><th className="r">P&L</th><th className="r">R</th><th>Plan</th><th>Grade</th><th>Emotions</th><th>Account</th></tr></thead>
            <tbody>
              {shown.slice(0, 500).map((t) => (
                <TradeRow key={t.id} t={t} open={open === t.id} toggle={() => setOpen(open === t.id ? null : t.id)} accName={accName} />
              ))}
              {!shown.length && <tr><td colSpan={12} className="muted" style={{ padding: 24 }}>No trades.</td></tr>}
            </tbody>
          </table>
        </div>
        {shown.length > 500 && <p className="dim" style={{ padding: '0 18px 14px', fontSize: 12.5 }}>Showing the latest 500. Search to narrow down.</p>}
      </Reveal>

      {d.plans.length > 0 && (
        <Reveal className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Recent pre-market plans</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', marginTop: 12 }}>
            {d.plans.slice(0, 9).map((p) => (
              <div key={p.id} style={{ background: 'var(--panel2)', borderRadius: 12, padding: 12, fontSize: 13.5 }}>
                <div className="row between"><b>{p.date}</b>{p.bias && <span className="tag">{p.bias}</span>}</div>
                {['keyLevels', 'ruleReminder', 'avoid', 'narrative'].filter((k) => p[k]).map((k) => <div key={k} className="muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{p[k]}</div>)}
              </div>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}

function TradeRow({ t, open, toggle, accName }) {
  if (t.noTrade) {
    return <tr><td /><td>{t.date}</td><td colSpan={10} className="muted">No trade day{t.notes ? ` · ${t.notes}` : ''}</td></tr>;
  }
  const emos = [...(t.emotionsNeg || []).map((e) => [e, 'neg']), ...(t.emotionsPos || []).map((e) => [e, 'pos'])];
  return (
    <>
      <tr className="click" onClick={toggle}>
        <td>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
        <td className="mono">{t.date}{t.entryTime ? <span className="dim"> {t.entryTime}</span> : ''}</td>
        <td><b>{t.symbol || '—'}</b></td>
        <td className={t.direction === 'short' ? 'neg' : 'pos'}>{t.direction === 'short' ? 'Short' : 'Long'}</td>
        <td className="muted">{t.session || '—'}</td>
        <td className="muted">{t.playbook || '—'}</td>
        <td className={cls('r mono', t.pnl > 0 ? 'pos' : t.pnl < 0 ? 'neg' : '')} style={{ fontWeight: 600 }}>{money(t.pnl, 2)}</td>
        <td className="r mono">{Number.isFinite(t.realizedRR) ? `${t.realizedRR}R` : '—'}</td>
        <td>{t.followedPlan === false ? <span className="tag" style={{ color: 'var(--red)' }}>Off plan</span> : <span className="dim">On plan</span>}</td>
        <td>{t.grade || '—'}</td>
        <td><span className="row wrap" style={{ gap: 4 }}>{emos.slice(0, 3).map(([e, k]) => <span key={e} className="tag" style={{ fontSize: 11.5, color: k === 'neg' ? 'var(--red)' : 'var(--green)' }}>{e}</span>)}{emos.length > 3 && <span className="dim">+{emos.length - 3}</span>}</span></td>
        <td className="muted">{(t.accounts || []).map((a) => accName.get(a)).filter(Boolean).join(', ') || '—'}</td>
      </tr>
      {open && (
        <tr className="tr-open">
          <td />
          <td colSpan={11}>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, fontSize: 13.5 }}>
              {[['Entry → exit', t.entry != null ? `${t.entry} → ${t.exit ?? '—'}` : '—'], ['Size', t.size ?? '—'], ['Stop / target', `${t.stopLoss ?? '—'} / ${t.target ?? '—'}`], ['Planned R', t.plannedRR ?? '—'], ['Time', `${t.entryTime || '—'} → ${t.exitTime || '—'}`], ['Exit reason', t.exitReason || '—'], ['After a loss', t.postLoss || '—'], ['Confluences', (t.confluences || []).join(', ') || '—']].map(([k, v]) => (
                <div key={k}><div className="dim" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k}</div><div>{String(v)}</div></div>
              ))}
            </div>
            {t.notes && <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 13.5 }}><span className="dim">Notes: </span>{t.notes}</div>}
          </td>
        </tr>
      )}
    </>
  );
}
