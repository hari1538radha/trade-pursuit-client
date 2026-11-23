// Browser-only backend used for the hosted preview (VITE_DEMO=true).
// Same shape as the HTTP API, persisted in localStorage.
import firmsCatalog from '@shared/firms.json';
import { setToken, getToken } from './http.js';
import { fetchNewsDirect } from './news.js';
import { ymd, addDays, parseYmd } from '../lib/dates.js';
import { UNDERLYINGS, normalizeChain, chainStats, marketOpen } from '../lib/market/options.js';
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
  markets: { async range() { throw fail(503, 'live prices need the API server'); } },
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
    async chain({ underlying, expiry }) {
      me();
      const stock = !UNDERLYINGS[underlying] ? demoStocks().results.find((x) => x.symbol === underlying) : null;
      const chain = normalizeChain(rawChain(UNDERLYINGS[underlying]?.key || `NSE_EQ|${stock?.isin || underlying}`, expiry, 1, stock?.close).rows);
      return wait({ chain, stats: chainStats(chain), has: { ltp: true, iv: true, delta: true, theta: true, gamma: true, vega: true, volume: true }, marketOpen: marketOpen(), at: new Date().toISOString() });
    },
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
    save();
    return { token };
  },
};
