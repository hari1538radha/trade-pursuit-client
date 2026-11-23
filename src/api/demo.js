// Browser-only backend used for the hosted preview (VITE_DEMO=true).
// Same shape as the HTTP API, persisted in localStorage.
import firmsCatalog from '@shared/firms.json';
import { setToken, getToken } from './http.js';
import { fetchNewsDirect } from './news.js';
import { ymd, addDays, parseYmd } from '../lib/dates.js';
import { UNDERLYINGS, normalizeChain, chainStats, marketOpen, tickDelta } from '../lib/market/options.js';
const demoLive = new Map(); const demoTicks = [];
const pkey = (kind) => ({ 'money/entries': 'entries', 'money/emis': 'emis', 'props/purchases': 'purchases', 'props/payouts': 'payouts' }[kind] || kind);
/** Preview only: a month of sample expenses/income, two EMIs and 3 weeks of lifestyle logs for the admin */
function seedPersonal() {
  db.personal ||= {};
  const u = db.users.find((x) => x.id === getToken());
  if (!u || u.role !== 'admin' || db.personal.seeded === u.id) return;
  db.personal.seeded = u.id;
  let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const E = (db.personal.entries ||= []);
  for (let n = 0; n < 75; n++) {
    if (r() < 0.75) E.push({ id: id(), user: u.id, kind: 'expense', date: day(n), amount: Math.round(120 + r() * 380), category: 'Food', method: 'UPI', note: '' });
    if (n % 4 === 0) E.push({ id: id(), user: u.id, kind: 'expense', date: day(n), amount: Math.round(400 + r() * 300), category: 'Petrol', method: 'Card', note: '' });
    if (n % 11 === 3) E.push({ id: id(), user: u.id, kind: 'expense', date: day(n), amount: Math.round(800 + r() * 2200), category: 'Shopping', method: 'Card', note: '' });
  }
  for (const n of [5, 35, 65]) {
    E.push({ id: id(), user: u.id, kind: 'expense', date: day(n), amount: 7800 + Math.round(r() * 3000), category: 'Card bill', method: 'Bank', note: 'Credit card statement' });
    E.push({ id: id(), user: u.id, kind: 'expense', date: day(n + 2), amount: 1499, category: 'Bills', method: 'UPI', note: 'Phone + internet' });
    E.push({ id: id(), user: u.id, kind: 'income', date: day(n + 1), amount: 25000, category: 'Salary', method: 'Bank', note: 'Sample income' });
  }
  const ymNow = new Date(); const ymS = (k) => { const d = new Date(ymNow.getFullYear(), ymNow.getMonth() - k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  db.personal.emis ||= [];
  db.personal.emis.push({ id: id(), user: u.id, name: 'Bike loan', lender: 'Sample bank', amount: 3450, dueDay: 5, start: ymS(9), months: 24, paid: [9, 8, 7, 6, 5, 4, 3, 2, 1].map(ymS), note: '' });
  db.personal.emis.push({ id: id(), user: u.id, name: 'Phone EMI', lender: 'Card EMI', amount: 2100, dueDay: 12, start: ymS(4), months: 12, paid: [4, 3, 2, 1].map(ymS), note: '' });
  db.personal.days ||= [];
  for (let n = 21; n >= 1; n--) {
    db.personal.days.push({ id: id(), user: u.id, date: day(n), habits: { wake: r() > 0.25, gym: r() > 0.4, read: r() > 0.5, journal: r() > 0.3, nojunk: r() > 0.35 }, sleep: +(5.5 + r() * 3).toFixed(1), workout: r() > 0.4 ? Math.round(30 + r() * 40) : 0, steps: Math.round(4000 + r() * 7000), water: +(1.5 + r() * 2).toFixed(1), meditation: r() > 0.5 ? 10 : 0, screen: +(2 + r() * 4).toFixed(1), mood: 2 + Math.round(r() * 3), energy: 2 + Math.round(r() * 3), weight: +(78.4 - (21 - n) * 0.06 + (r() - 0.5) * 0.5).toFixed(1), calories: Math.round(1900 + r() * 700), protein: Math.round(80 + r() * 60), junk: r() > 0.7, meals: { breakfast: 'Oats, eggs', lunch: 'Rice, dal, chicken', dinner: 'Chapati, paneer', snacks: r() > 0.7 ? 'Chips' : 'Fruit' } });
  }
  u.settings.life ||= { habits: [{ id: 'wake', name: 'Wake up by 6:30' }, { id: 'gym', name: 'Workout' }, { id: 'read', name: 'Read 20 min' }, { id: 'journal', name: 'Journal every trade' }, { id: 'nojunk', name: 'No junk food' }], targets: { sleep: 7.5, workout: 45, steps: 8000, water: 3, calories: 2200, protein: 130, screen: 3 }, weightGoal: 74, dietPlan: { breakfast: 'Oats + 3 eggs', lunch: 'Rice, dal, chicken/paneer, salad', dinner: '2 chapati, sabzi, curd', snacks: 'Fruit, nuts, buttermilk', rules: 'No sugar drinks. Last meal by 9 PM.' } };
  save();
}
const demoRecs = () => { try { return JSON.parse(localStorage.getItem('tp.demo.rec')) || []; } catch { return []; } };
const packChain = (chain) => chain.map((r) => [r.strike, r.ce.oi, r.pe.oi, r.ce.prevOi, r.pe.prevOi]);
function driftChain(prevChain, base, strength = 1) {
  const by = new Map(prevChain.map((r) => [r.strike, r]));
  return base.map((r) => {
    const p = by.get(r.strike); if (!p) return r;
    const j = (oi) => Math.max(0, Math.round(oi + (Math.random() < 0.35 ? (Math.random() - 0.42) * oi * 0.004 * strength : 0)));
    const ce = j(p.ce.oi), pe = j(p.pe.oi);
    return { ...r, ce: { ...r.ce, oi: ce, chgOi: ce - r.ce.prevOi }, pe: { ...r.pe, oi: pe, chgOi: pe - r.pe.prevOi } };
  });
}
function demoTick(k, prevChain, chain, at) {
  const stats = chainStats(chain);
  const d = tickDelta(prevChain, chain, stats.atm);
  const tick = { at, spot: stats.spot, atm: stats.atm, pcr: stats.pcr, ceOI: stats.ceOI, peOI: stats.peOI, dCe: d.dCe, dPe: d.dPe, ceDelta: d.ceDelta, peDelta: d.peDelta, d: d.strikes };
  demoTicks.push({ k, ...tick, s: packChain(chain) }); if (demoTicks.length > 6000) demoTicks.shift();
  return tick;
}
/** Sample data: one 3-second pull. The first pull of a chain backfills the last 40 minutes. */
function demoPull(underlying, expiry) {
  const stock = !UNDERLYINGS[underlying] ? demoStocks().results.find((x) => x.symbol === underlying) : null;
  const k = `${underlying}|${expiry}`;
  const base = normalizeChain(rawChain(UNDERLYINGS[underlying]?.key || `NSE_EQ|${stock?.isin || underlying}`, expiry, 1, stock?.close).rows);
  let prev = demoLive.get(k);
  if (!prev) {
    // Backfill: start lower and drift up to today's numbers
    let c = base.map((r) => ({ ...r, ce: { ...r.ce, oi: Math.round(r.ce.oi * 0.93) }, pe: { ...r.pe, oi: Math.round(r.pe.oi * 0.93) } }));
    const n = 800, now = Date.now();
    for (let i = n; i > 0; i--) { const nx = driftChain(c, base, 2.2); demoTick(k, c, nx, new Date(now - i * 3000).toISOString()); c = nx; }
    prev = { chain: c };
  }
  const chain = driftChain(prev.chain, base);
  const stats = chainStats(chain);
  const tick = demoTick(k, prev.chain, chain, new Date().toISOString());
  demoLive.set(k, { chain });
  return { chain, stats, has: { delta: true }, marketOpen: marketOpen(), at: new Date().toISOString(), tick };
}
import { SETUPS, analyze } from '../lib/market/scanner.js';
import { rawChain, demoHistory, demoStocks } from '../lib/market/demo.js';

const KEY = 'edgelog.demo.db';
const DEFAULT_CHECKLIST = ['Have you done your high timeframe?', 'Do you have that FVG gap?', 'Do we have an inverse to the upside?', 'Did we think about this entry before entering?'];
const DEFAULT_TAGS = {
  playbooks: ['Reversal', 'Continuation', 'Retracement', 'Manipulation'],
  targets: ['Liquidity sweep', 'Equal highs', 'Equal lows', 'Session liquidity', 'Major high', 'Major low'],
  confluences: ['FVG', 'Order block', 'Breaker', 'Equilibrium', 'Imbalance', 'Liquidity sweep'],
  confirmations: ['iFVG', 'Market structure shift', 'Retest', 'Rejection'],
  bonus: ['SMT', 'CISD', 'Displacement'],
  exitReasons: [],
};

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
let db = load() || { users: [], trades: [], accounts: [], plans: [], posts: [] };
db.friends ||= [];
db.notes ||= []; db.quiz ||= []; db.watch ||= [];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { throw fail(413, 'Browser storage is full — remove some screenshots'); } };
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
const fail = (status, msg) => Object.assign(new Error(msg), { status });
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 60));
const hash = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, '0')).join('');
const me = () => { const u = db.users.find((u) => u.id === getToken()); if (!u) throw fail(401, 'Not signed in'); return u; };
const pub = ({ pw, ...u }) => u;
const who = (uid) => { const u = db.users.find((x) => x.id === uid); return u ? { id: u.id, username: u.username, displayName: u.displayName } : null; };
const friendIds = (uid) => db.friends.filter((f) => f.status === 'accepted' && (f.from === uid || f.to === uid)).map((f) => (f.from === uid ? f.to : f.from));

// Recurring macro releases, used only when the live feed can't be reached from the preview.
function sampleNews(week) {
  const mon = parseYmd(addDays(ymd(), -((new Date().getDay() + 6) % 7) + (week === 'nextweek' ? 7 : 0)));
  const at = (d, h, m) => { const x = new Date(Date.UTC(mon.getFullYear(), mon.getMonth(), mon.getDate() + d, h, m)); return x.toISOString(); };
  const rows = [
    [0, 1, 30, 'AUD', 'medium', 'Retail Sales m/m', '0.3%', '0.2%'], [0, 15, 0, 'USD', 'low', 'Fed Governor Speaks', '', ''],
    [1, 7, 0, 'GBP', 'high', 'CPI y/y', '3.4%', '3.6%'], [1, 13, 30, 'USD', 'high', 'Core CPI m/m', '0.3%', '0.3%'], [1, 13, 30, 'USD', 'high', 'CPI y/y', '2.9%', '3.0%'],
    [2, 9, 0, 'EUR', 'medium', 'German ZEW Economic Sentiment', '12.5', '9.8'], [2, 15, 30, 'USD', 'medium', 'Crude Oil Inventories', '-1.2M', '2.1M'], [2, 19, 0, 'USD', 'high', 'FOMC Meeting Minutes', '', ''],
    [3, 13, 30, 'USD', 'high', 'Unemployment Claims', '221K', '218K'], [3, 13, 30, 'USD', 'medium', 'Philly Fed Manufacturing Index', '-2.5', '-5.6'], [3, 23, 50, 'JPY', 'low', 'Trade Balance', '-0.31T', '-0.47T'],
    [4, 8, 30, 'EUR', 'medium', 'Flash Manufacturing PMI', '46.0', '45.9'], [4, 13, 30, 'CAD', 'high', 'Retail Sales m/m', '0.4%', '-0.1%'], [4, 15, 0, 'USD', 'medium', 'Revised UoM Consumer Sentiment', '51.5', '51.0'],
  ];
  return rows.map(([d, h, m, currency, impact, title, forecast, previous]) => ({ id: `${currency}-${d}-${title}`, title, currency, date: at(d, h, m), impact, forecast, previous, actual: '' }));
}
const now = () => new Date().toISOString();

function newUser(username, pw, displayName) {
  return { id: id(), username, displayName: displayName || username, pw, bio: '', createdAt: now(), settings: { checklist: [...DEFAULT_CHECKLIST], breakEven: 0, guardrails: { enabled: false, dailyLossLimit: 0, maxTradesPerDay: 0 }, donts: [], coach: { enabled: true, lookback: 5 }, tags: structuredClone(DEFAULT_TAGS) }, goals: { week: '', month: '', year: '', life: '', why: '' } };
}

export const demoApi = {
  demo: true,
  auth: {
    async register({ username, password, displayName }) {
      username = String(username || '').trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,24}$/.test(username)) throw fail(400, 'username: 3-24 letters, numbers, _ or .');
      if (!password || password.length < 6) throw fail(400, 'password: at least 6 characters');
      if (db.users.some((u) => u.username === username)) throw fail(409, 'That username is taken');
      const u = newUser(username, await hash(password), displayName);
      db.users.push(u); save();
      return wait({ token: u.id, user: pub(u) });
    },
    async login({ username, password }) {
      const u = db.users.find((x) => x.username === String(username).trim().toLowerCase());
      if (!u || u.pw !== (await hash(password))) throw fail(401, 'Wrong username or password');
      return wait({ token: u.id, user: pub(u) });
    },
    async me() { return wait({ user: pub(me()) }); },
    async update(b) {
      const u = me();
      if (b.displayName !== undefined) u.displayName = b.displayName;
      if (b.bio !== undefined) u.bio = b.bio;
      Object.assign(u.settings, b.settings || {}); Object.assign(u.goals, b.goals || {});
      save(); return wait({ user: pub(u) });
    },
    async password({ current, next }) {
      const u = me();
      if (u.pw !== (await hash(current))) throw fail(401, 'Current password is wrong');
      if (!next || next.length < 6) throw fail(400, 'New password needs 6+ characters');
      u.pw = await hash(next); save(); return wait({ ok: true });
    },
    async deleteHistory() {
      const uid = me().id;
      for (const k of ['trades', 'accounts', 'plans']) db[k] = db[k].filter((x) => x.user !== uid);
      save(); return wait({ ok: true });
    },
    async deleteAccount({ password }) {
      const u = me();
      if (u.pw !== (await hash(password))) throw fail(401, 'Password is wrong');
      for (const k of ['trades', 'accounts', 'plans', 'posts', 'notes', 'quiz', 'watch']) db[k] = db[k].filter((x) => x.user !== u.id);
      db.friends = db.friends.filter((f) => f.from !== u.id && f.to !== u.id);
      db.users = db.users.filter((x) => x.id !== u.id); save(); return wait({ ok: true });
    },
  },
  trades: {
    async list(p = {}) {
      const uid = me().id;
      let t = db.trades.filter((x) => x.user === uid);
      if (p.mode) t = t.filter((x) => (x.mode || 'live') === p.mode);
      t.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      return wait({ trades: t, total: t.length });
    },
    async create(b) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) throw fail(400, 'date is required');
      const t = { mode: 'live', direction: 'long', pnl: 0, followedPlan: true, accounts: [], ...b, symbol: (b.symbol || '').toUpperCase(), id: id(), user: me().id, createdAt: now(), updatedAt: now() };
      db.trades.push(t); save(); return wait({ trade: t });
    },
    async bulk(trades) {
      const uid = me().id;
      for (const b of trades) db.trades.push({ mode: 'live', direction: 'long', pnl: 0, accounts: [], ...b, id: id(), user: uid, createdAt: now(), updatedAt: now() });
      save(); return wait({ inserted: trades.length });
    },
    async update(tid, b) {
      const t = db.trades.find((x) => x.id === tid && x.user === me().id);
      if (!t) throw fail(404, 'Trade not found');
      Object.assign(t, b, { updatedAt: now() }); if (b.symbol) t.symbol = b.symbol.toUpperCase();
      save(); return wait({ trade: t });
    },
    async remove(tid) { db.trades = db.trades.filter((x) => !(x.id === tid && x.user === me().id)); save(); return wait({ ok: true }); },
  },
  accounts: {
    async list() { const uid = me().id; return wait({ accounts: db.accounts.filter((a) => a.user === uid) }); },
    async create({ count = 1, ...b }) {
      const uid = me().id; const made = [];
      for (let i = 0; i < count; i++) made.push({ kind: 'eval', status: 'active', phase: 'Phase 1', paid: 0, payouts: [], ...b, name: count > 1 ? `${b.name} ${i + 1}` : b.name, startBalance: b.startBalance ?? b.size, id: id(), user: uid, createdAt: now() });
      db.accounts.push(...made); save(); return wait({ accounts: made });
    },
    async update(aid, b) {
      const a = db.accounts.find((x) => x.id === aid && x.user === me().id);
      if (!a) throw fail(404, 'Account not found');
      Object.assign(a, b); save(); return wait({ account: a });
    },
    async remove(aid) {
      const uid = me().id;
      db.accounts = db.accounts.filter((x) => !(x.id === aid && x.user === uid));
      for (const t of db.trades) if (t.user === uid) t.accounts = (t.accounts || []).filter((x) => x !== aid);
      save(); return wait({ ok: true });
    },
  },
  plans: {
    async get(date) { const uid = me().id; return wait({ plan: db.plans.find((p) => p.user === uid && p.date === date) || null }); },
    async put(date, b) {
      const uid = me().id;
      let p = db.plans.find((x) => x.user === uid && x.date === date);
      if (!p) { p = { id: id(), user: uid, date, bias: '', keyLevels: '', ruleReminder: '', avoid: '', checks: [], instruments: [], sessionFocus: '', narrative: '', bullCase: '', bearCase: '', newsToWatch: '', images: [], sharedWith: [] }; db.plans.push(p); }
      Object.assign(p, b); save(); return wait({ plan: p });
    },
    async list({ from, to } = {}) {
      const uid = me().id;
      const plans = db.plans.filter((p) => p.user === uid && (!from || p.date >= from) && (!to || p.date <= to)).sort((a, b) => b.date.localeCompare(a.date));
      return wait({ plans: plans.map(({ images, checks, ...p }) => ({ ...p, imageCount: (images || []).length })) });
    },
    async share(date, userIds) {
      const uid = me().id; const fr = friendIds(uid);
      if (userIds.some((u) => !fr.includes(u))) throw fail(403, 'You can only share with friends');
      await this.put(date, {});
      const p = db.plans.find((x) => x.user === uid && x.date === date);
      p.sharedWith = [...new Set(userIds)]; save(); return wait({ plan: p });
    },
    async shared(date) {
      const uid = me().id; const fr = friendIds(uid);
      const plans = db.plans.filter((p) => p.date === date && (p.sharedWith || []).includes(uid) && fr.includes(p.user)).map(({ sharedWith, checks, user, ...p }) => ({ ...p, author: who(user) }));
      return wait({ plans });
    },
  },
  friends: {
    async list() {
      const uid = me().id; const out = { friends: [], incoming: [], outgoing: [] };
      for (const f of db.friends.filter((f) => f.from === uid || f.to === uid)) {
        const other = who(f.from === uid ? f.to : f.from); if (!other) continue;
        const row = { id: f.id, user: other, createdAt: f.createdAt };
        if (f.status === 'accepted') out.friends.push(row); else (f.from === uid ? out.outgoing : out.incoming).push(row);
      }
      return wait(out);
    },
    async request(username) {
      const uid = me().id;
      const o = db.users.find((u) => u.username === String(username).trim().toLowerCase().replace(/^@/, ''));
      if (!o) throw fail(404, 'No trader with that username');
      if (o.id === uid) throw fail(400, "You can't add yourself");
      const rev = db.friends.find((f) => f.from === o.id && f.to === uid);
      if (rev) { rev.status = 'accepted'; save(); return wait({ status: 'accepted', id: rev.id, user: who(o.id) }); }
      const ex = db.friends.find((f) => f.from === uid && f.to === o.id);
      if (ex) return wait({ status: ex.status, id: ex.id, user: who(o.id) });
      const f = { id: id(), from: uid, to: o.id, status: 'pending', createdAt: now() };
      db.friends.push(f); save(); return wait({ status: 'pending', id: f.id, user: who(o.id) });
    },
    async accept(fid) {
      const f = db.friends.find((x) => x.id === fid && x.to === me().id && x.status === 'pending');
      if (!f) throw fail(404, 'Request not found');
      f.status = 'accepted'; save(); return wait({ ok: true });
    },
    async remove(fid) {
      const uid = me().id; const f = db.friends.find((x) => x.id === fid && (x.from === uid || x.to === uid));
      if (!f) throw fail(404, 'Request not found');
      db.friends = db.friends.filter((x) => x !== f);
      for (const p of db.plans) if (p.user === f.from || p.user === f.to) p.sharedWith = (p.sharedWith || []).filter((u) => u !== f.from && u !== f.to);
      save(); return wait({ ok: true });
    },
  },
  /** The preview has no server: try the public feed directly, else show clearly labelled sample events. */
  async news(week = 'thisweek') {
    try {
      return await fetchNewsDirect(week);
    } catch {
      return { events: sampleNews(week), updatedAt: now(), sample: true };
    }
  },
  posts: {
    async list() {
      const uid = me().id;
      const posts = db.posts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => {
        const a = db.users.find((u) => u.id === p.user);
        return { ...p, likes: p.likes.length, liked: p.likes.includes(uid), mine: p.user === uid, author: a ? { id: a.id, username: a.username, displayName: a.displayName } : null };
      });
      return wait({ posts, next: null });
    },
    async create({ text, trade }) {
      const u = me();
      const tags = [...new Set((text.match(/[#$][a-z0-9_]+/gi) || []).map((t) => t.toLowerCase()))];
      const p = { id: id(), user: u.id, text, tags, trade, likes: [], createdAt: now() };
      db.posts.push(p); save();
      return wait({ post: { ...p, likes: 0, liked: false, mine: true, author: { id: u.id, username: u.username, displayName: u.displayName } } });
    },
    async like(pid) {
      const uid = me().id; const p = db.posts.find((x) => x.id === pid);
      if (!p) throw fail(404, 'Post not found');
      const liked = p.likes.includes(uid);
      p.likes = liked ? p.likes.filter((x) => x !== uid) : [...p.likes, uid];
      save(); return wait({ liked: !liked, likes: p.likes.length });
    },
    async remove(pid) { const uid = me().id; db.posts = db.posts.filter((p) => !(p.id === pid && p.user === uid)); save(); return wait({ ok: true }); },
  },
  // Admin's own tracking (sample data in the preview)
  personal: {
    async list(kind, q = {}) { me(); const k = pkey(kind); seedPersonal(); return wait({ items: (db.personal[k] || []).filter((x) => x.user === me().id && (!q.from || x.date >= q.from) && (!q.to || x.date <= q.to)).sort((a, b) => (b.date || b.start || '').localeCompare(a.date || a.start || '')) }); },
    async create(kind, b) { const k = pkey(kind); const it = { id: id(), user: me().id, ...b }; (db.personal[k] ||= []).push(it); save(); return wait({ item: it }); },
    async update(kind, iid, b) { const it = (db.personal[pkey(kind)] || []).find((x) => x.id === iid && x.user === me().id); if (!it) throw fail(404, 'Not found'); Object.assign(it, b); save(); return wait({ item: it }); },
    async remove(kind, iid) { const k = pkey(kind); db.personal[k] = (db.personal[k] || []).filter((x) => !(x.id === iid && x.user === me().id)); save(); return wait({ ok: true }); },
    async importProps({ purchases = [], payouts = [] }) {
      const uid = me().id; db.personal.purchases ||= []; db.personal.payouts ||= [];
      const key = (x, a) => `${x.date}|${x.firm}|${a}`;
      const have = new Map(); db.personal.purchases.filter((x) => x.user === uid).forEach((p) => have.set(key(p, p.fee), (have.get(key(p, p.fee)) || 0) + 1));
      const seen = new Map(); let a = 0, b = 0;
      for (const p of purchases) { const k = key(p, p.fee); seen.set(k, (seen.get(k) || 0) + 1); if (seen.get(k) > (have.get(k) || 0)) { db.personal.purchases.push({ id: id(), user: uid, ...p }); a++; } }
      const hp = new Set(db.personal.payouts.filter((x) => x.user === uid).map((p) => key(p, p.net)));
      for (const p of payouts) if (!hp.has(key(p, p.net))) { db.personal.payouts.push({ id: id(), user: uid, ...p }); b++; }
      save(); return wait({ purchases: a, payouts: b, skipped: purchases.length + payouts.length - a - b });
    },
    async days(from) { me(); seedPersonal(); return wait({ items: (db.personal.days || []).filter((x) => x.user === me().id && (!from || x.date >= from)).sort((a, b) => b.date.localeCompare(a.date)) }); },
    async saveDay(date, b) {
      db.personal.days ||= [];
      let d = db.personal.days.find((x) => x.user === me().id && x.date === date);
      if (!d) { d = { id: id(), user: me().id, date, habits: {}, meals: {} }; db.personal.days.push(d); }
      for (const [k, v] of Object.entries(b)) { if (k === 'habits' || k === 'meals') d[k] = { ...(d[k] || {}), ...v }; else d[k] = v; }
      save(); return wait({ item: d });
    },
  },
  admin: {
    async users() {
      if (me().role !== 'admin') throw fail(403, 'This page is for admins only');
      return wait({ users: db.users.map((u) => {
        const stats = {};
        for (const mode of ['live', 'paper']) {
          const ts = db.trades.filter((t) => t.user === u.id && (t.mode || 'live') === mode && !t.noTrade);
          if (!ts.length) continue;
          const ds = ts.map((t) => t.date).sort();
          stats[mode] = { trades: ts.length, pnl: ts.reduce((a, t) => a + (t.pnl || 0), 0), wins: ts.filter((t) => t.pnl > 0).length, losses: ts.filter((t) => t.pnl < 0).length, offPlan: ts.filter((t) => t.followedPlan === false).length, first: ds[0], last: ds.at(-1) };
        }
        return { id: u.id, username: u.username, displayName: u.displayName, role: u.role || 'user', joined: u.createdAt, stats };
      }) });
    },
    async user(uid) {
      if (me().role !== 'admin') throw fail(403, 'This page is for admins only');
      const u = db.users.find((x) => x.id === uid); if (!u) throw fail(404, 'Trader not found');
      return wait({
        user: { id: u.id, username: u.username, displayName: u.displayName, role: u.role || 'user', joined: u.createdAt, bio: u.bio, settings: { breakEven: u.settings?.breakEven || 0, donts: u.settings?.donts || [] } },
        accounts: db.accounts.filter((a) => a.user === uid),
        trades: db.trades.filter((t) => t.user === uid).sort((a, b) => b.date.localeCompare(a.date)),
        plans: db.plans.filter((p) => p.user === uid).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
      });
    },
    async setRole(uid, role) {
      const u = db.users.find((x) => x.id === uid); if (!u) throw fail(404, 'Trader not found');
      if (role === 'user' && uid === me().id && !db.users.some((x) => x.id !== uid && x.role === 'admin')) throw fail(400, "You're the only admin. Make someone else admin first.");
      u.role = role; save(); return wait({ ok: true, role });
    },
  },
  markets: {
    async range() { throw fail(503, 'live prices need the API server'); },
    // Sample candles for the Goldbach page (clearly labelled as sample data)
    async goldbach(symbol, interval = '1h') {
      const base = symbol === 'XAGUSD' ? 50.4 : 4065;
      const vol = symbol === 'XAGUSD' ? 0.18 : 9;
      const step = { '15m': 9e5, '1h': 3.6e6, '4h': 1.44e7, '1d': 8.64e7 }[interval] || 3.6e6;
      const scale = Math.sqrt(step / 3.6e6);
      let seed = symbol === 'XAGUSD' ? 11 : 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const n = 220, now = Math.floor(Date.now() / step) * step;
      let p = base - vol * 6 * scale;
      const candles = [];
      for (let i = n; i > 0; i--) {
        const o = p, c = o + (rnd() - 0.47) * vol * scale * 1.6;
        candles.push({ t: now - i * step, o, h: Math.max(o, c) + rnd() * vol * scale * 0.7, l: Math.min(o, c) - rnd() * vol * scale * 0.7, c });
        p = c;
      }
      return wait({ symbol, name: symbol === 'XAGUSD' ? 'Silver' : 'Gold', interval, candles, price: p, spot: p, futures: p, basis: 0, adr: vol * 7, source: 'Sample data', updatedAt: new Date().toISOString(), demo: true });
    },
  },
  notes: {
    async list() { const uid = me().id; return wait({ notes: db.notes.filter((n) => n.user === uid).sort((a, b) => (b.pinned - a.pinned) || b.updatedAt.localeCompare(a.updatedAt)) }); },
    async create(b) {
      if (!b.title?.trim()) throw fail(400, 'title is required');
      const n = { kind: 'lesson', body: '', tags: [], pinned: false, ...b, id: id(), user: me().id, createdAt: now(), updatedAt: now() };
      db.notes.push(n); save(); return wait({ note: n });
    },
    async update(nid, b) {
      const n = db.notes.find((x) => x.id === nid && x.user === me().id);
      if (!n) throw fail(404, 'Note not found');
      Object.assign(n, b, { updatedAt: now() }); save(); return wait({ note: n });
    },
    async remove(nid) { db.notes = db.notes.filter((x) => !(x.id === nid && x.user === me().id)); save(); return wait({ ok: true }); },
  },
  quiz: {
    async list() { const uid = me().id; return wait({ results: db.quiz.filter((q) => q.user === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }); },
    async save(b) { const r = { ...b, id: id(), user: me().id, createdAt: now() }; db.quiz.push(r); save(); return wait({ result: r }); },
  },
  options: {
    async chain({ underlying, expiry }) { me(); return wait(demoPull(underlying, expiry)); },
    async live(underlying, expiry) { me(); return wait({ ...demoPull(underlying, expiry), source: 'db' }); },
    async ticks(underlying, expiry, since, bucket) {
      const k = `${underlying}|${expiry}`;
      if (!demoLive.has(k)) demoPull(underlying, expiry);
      const rows = demoTicks.filter((t) => t.k === k);
      if (bucket === '1m') {
        const m = new Map();
        for (const t of rows) {
          const key = Math.floor(new Date(t.at).getTime() / 60000) * 60000;
          const b = m.get(key) || { at: new Date(key).toISOString(), dCe: 0, dPe: 0, n: 0 };
          b.dCe += t.dCe; b.dPe += t.dPe; b.n++; b.pcr = t.pcr; b.ceOI = t.ceOI; b.peOI = t.peOI; b.spot = t.spot;
          m.set(key, b);
        }
        return wait({ ticks: [...m.values()], bucket: '1m' });
      }
      const from = since ? new Date(since).getTime() : 0;
      return wait({ ticks: rows.filter((t) => new Date(t.at).getTime() > from).map(({ k: _k, s: _s, ...t }) => t) });
    },
    async strikeSeries(underlying, expiry, strikes) {
      const want = new Set(strikes);
      const rows = demoTicks.filter((t) => t.k === `${underlying}|${expiry}` && t.s);
      return wait({ points: rows.map((t) => ({ at: t.at, s: t.s.filter((x) => want.has(x[0])) })) });
    },
    async recorders() { return wait({ recorders: demoRecs(), marketOpen: marketOpen() }); },
    async saveRecorder(b) {
      const list = demoRecs().filter((r) => r.underlying !== b.underlying);
      const rec = { id: b.underlying, underlying: b.underlying, expiry: b.expiry, atm: b.atm || 'ten', autoRoll: true, enabled: b.enabled !== false, status: b.enabled === false ? 'paused' : 'recording', lastAt: new Date().toISOString(), pulls: 0 };
      localStorage.setItem('tp.demo.rec', JSON.stringify([...list, rec]));
      return wait({ recorder: rec });
    },
    async removeRecorder(u) { localStorage.setItem('tp.demo.rec', JSON.stringify(demoRecs().filter((r) => r.underlying !== u))); return wait({ ok: true }); },
    async removeAllRecorders() { localStorage.removeItem('tp.demo.rec'); return wait({ ok: true }); },
    async history(underlying, expiry) {
      const stock = !UNDERLYINGS[underlying] ? demoStocks().results.find((x) => x.symbol === underlying) : null;
      return wait({ snaps: demoHistory(UNDERLYINGS[underlying]?.key || `NSE_EQ|${stock?.isin || underlying}`, expiry, stock?.close) });
    },
  },
  stocks: {
    async status() { const d = demoStocks(); return wait({ lastDate: d.lastDate, symbols: d.results.length, stale: false, demo: true, job: { running: false } }); },
    async refresh() { return wait({ job: { running: false } }); },
    async setups() { return wait({ setups: SETUPS }); },
    async scan(q = {}) {
      const d = demoStocks();
      const base = d.results.filter((x) => x.close >= (q.minPrice ?? 20) && (!q.maxPrice || x.close <= q.maxPrice) && x.turnoverCr >= (q.minTurnover ?? 1));
      const counts = {};
      for (const x of base) for (const t of x.tags) counts[t] = (counts[t] || 0) + 1;
      let rows = base.filter((x) => (!q.setup || x.tags.includes(q.setup)) && (!q.q || x.symbol.includes(q.q.toUpperCase())));
      const key = { turnover: (x) => -x.turnoverCr, change: (x) => -x.chgPct, volume: (x) => -x.volRatio, fromHigh: (x) => -x.fromHigh, fromLow: (x) => x.fromLow, rsi: (x) => x.rsi ?? 50 }[q.sort || 'turnover'];
      rows = rows.slice().sort((a, b) => key(a) - key(b));
      return wait({ lastDate: d.lastDate, total: rows.length, universe: base.length, counts, rows: rows.slice(0, q.limit || 500) });
    },
    async search(q) { const u = String(q).toUpperCase(); return wait({ results: demoStocks().results.filter((x) => x.symbol.startsWith(u)).slice(0, 15).map((x) => ({ symbol: x.symbol, name: x.name, isin: x.isin, close: x.close })) }); },
    async detail(sym) {
      const s = demoStocks().series.get(sym);
      if (!s) throw fail(404, 'Symbol not found');
      const from = s.c.length - 250;
      return wait({ symbol: s.symbol, name: s.name, isin: s.isin, analysis: analyze(s), bars: s.d.slice(from).map((d, i) => ({ d, o: s.o[from + i], h: s.h[from + i], l: s.l[from + i], c: s.c[from + i], v: s.v[from + i] })) });
    },
  },
  watchlist: {
    async list() {
      const uid = me().id; const bySym = new Map(demoStocks().results.map((x) => [x.symbol, x]));
      return wait({ items: db.watch.filter((w) => w.user === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((w) => ({ ...w, now: bySym.get(w.symbol) || null })) });
    },
    async add(b) {
      const uid = me().id; const sym = b.symbol.toUpperCase();
      let w = db.watch.find((x) => x.user === uid && x.symbol === sym);
      if (!w) { w = { id: id(), user: uid, status: 'watching', side: 'watch', note: '', createdAt: now() }; db.watch.push(w); }
      Object.assign(w, b, { symbol: sym, updatedAt: now() }); save(); return wait({ item: w });
    },
    async update(wid, b) { const w = db.watch.find((x) => x.id === wid && x.user === me().id); if (!w) throw fail(404, 'Not found'); Object.assign(w, b); save(); return wait({ item: w }); },
    async remove(wid) { db.watch = db.watch.filter((x) => !(x.id === wid && x.user === me().id)); save(); return wait({ ok: true }); },
  },
  firms: async () => firmsCatalog,

  /** Create a sample user with ~2 months of realistic trades so every screen has data. */
  async sample() {
    const name = 'sample_' + Math.random().toString(36).slice(2, 6);
    const { token } = await this.auth.register({ username: name, password: 'sample123', displayName: 'Sample Trader' });
    setToken(token);
    const uid = token;
    const fp = { id: id(), user: uid, name: 'Funding Pips 50K', firmId: 'funding-pips', firmName: 'Funding Pips', firmType: 'CFD', program: '2 Step', variant: 'Standard', size: 50000, startBalance: 50000, phase: 'Phase 1', kind: 'eval', status: 'active', paid: 349, payouts: [], createdAt: now(), rules: { profitTarget: 4000, maxLoss: 5000, maxLossType: 'Static', dailyLoss: 2500, minDays: 3 } };
    const ax = { id: id(), user: uid, name: 'Apex 50K', firmId: 'apex', firmName: 'Apex Trader Funding', firmType: 'Futures', program: 'Evaluation', variant: 'Full', size: 50000, startBalance: 50000, phase: 'Funded', kind: 'funded', status: 'active', paid: 0, payouts: [{ amount: 1500, date: addDays(ymd(), -12) }], createdAt: now(), rules: { profitTarget: null, maxLoss: 2500, maxLossType: 'Intraday trailing', dailyLoss: null, minDays: 0 } };
    db.accounts.push(fp, ax);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const syms = [['MNQ', 'Futures', ax.id], ['MNQ', 'Futures', ax.id], ['ES', 'Futures', ax.id], ['XAU', 'Forex', fp.id], ['EURUSD', 'Forex', fp.id]];
    for (let d = 60; d >= 1; d--) {
      const date = addDays(ymd(), -d); const wd = parseYmd(date).getDay();
      if (wd === 0 || wd === 6 || rnd() < 0.25) continue;
      const n = 1 + Math.floor(rnd() * 2.2);
      for (let i = 0; i < n; i++) {
        const [symbol, assetClass, acc] = pick(syms);
        const session = pick(['NY AM', 'NY AM', 'London', 'NY PM', 'Asia']);
        const plan = rnd() > 0.18;
        const win = rnd() < (plan ? 0.6 : 0.35);
        const rrv = win ? +(0.8 + rnd() * 2.2).toFixed(1) : -1;
        const risk = 150 + Math.round(rnd() * 150);
        const hr = { Asia: 20, London: 3, 'NY AM': 9, 'NY PM': 13 }[session] + Math.floor(rnd() * 2);
        const negs = plan ? [] : [pick(['Fomo', 'Revenge', 'Impatient', 'Greedy', 'Distracted'])];
        db.trades.push({
          id: id(), user: uid, mode: 'live', date, symbol, assetClass, tradeType: pick(['Day', 'Scalp']), direction: rnd() > 0.45 ? 'long' : 'short', session,
          followedPlan: plan, accounts: [acc], pnl: Math.round(risk * rrv), size: 1 + Math.floor(rnd() * 3), plannedRR: 2, realizedRR: rrv,
          entryTime: `${String(hr).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`,
          playbook: pick(DEFAULT_TAGS.playbooks), targets: [pick(DEFAULT_TAGS.targets)], confluences: [pick(DEFAULT_TAGS.confluences), pick(DEFAULT_TAGS.confluences)].filter((v, k, a) => a.indexOf(v) === k),
          confirmations: [pick(DEFAULT_TAGS.confirmations)], bonus: rnd() > 0.6 ? [pick(DEFAULT_TAGS.bonus)] : [],
          emotionsPos: plan ? [pick(['Patient', 'Focused', 'Disciplined', 'Calm'])] : [], emotionsNeg: negs,
          postLoss: negs[0] === 'Revenge' ? 'Revenge trade' : 'No revenge trade', grade: plan ? pick(['A+', 'A', 'A', 'B']) : pick(['B', 'C', 'F']),
          notes: plan ? 'Waited for the sweep, entered on the retest. Process held.' : 'Jumped in before confirmation.', images: [], createdAt: now(), updatedAt: now(),
        });
      }
    }
    me().role = 'admin';
    // Two sample friends (normal users) so the admin Traders page has people to show
    const mine = db.trades.filter((t) => t.user === uid);
    [['priya_fx', 'Priya', 0.8], ['rahul.nq', 'Rahul', 1.35]].forEach(([uname, dname, k], fi) => {
      if (db.users.some((x) => x.username === uname)) return;
      const f = newUser(uname, 'x', dname); f.role = 'user'; db.users.push(f);
      const acc = { ...fp, id: id(), user: f.id, name: fi ? 'Apex 50K' : 'FTMO 100K', firmName: fi ? 'Apex Trader Funding' : 'FTMO', size: fi ? 50000 : 100000 };
      db.accounts.push(acc);
      let s2 = 31 + fi * 17; const r2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647);
      for (const t of mine) if (r2() < 0.8) db.trades.push({ ...t, id: id(), user: f.id, accounts: [acc.id], pnl: Math.round(t.pnl * k * (0.6 + r2() * 0.8) - (t.followedPlan ? 0 : 60 * k)) });
    });
    save();
    return { token };
  },
};
