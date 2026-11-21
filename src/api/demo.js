// Browser-only backend used for the hosted preview (VITE_DEMO=true).
// Same shape as the HTTP API, persisted in localStorage.
import firmsCatalog from '@shared/firms.json';
import { setToken, getToken } from './http.js';
import { ymd, addDays, parseYmd } from '../lib/dates.js';

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
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { throw fail(413, 'Browser storage is full — remove some screenshots'); } };
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
const fail = (status, msg) => Object.assign(new Error(msg), { status });
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 60));
const hash = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, '0')).join('');
const me = () => { const u = db.users.find((u) => u.id === getToken()); if (!u) throw fail(401, 'Not signed in'); return u; };
const pub = ({ pw, ...u }) => u;
const now = () => new Date().toISOString();

function newUser(username, pw, displayName) {
  return { id: id(), username, displayName: displayName || username, pw, bio: '', createdAt: now(), settings: { checklist: [...DEFAULT_CHECKLIST], breakEven: 0, guardrails: { enabled: false, dailyLossLimit: 0, maxTradesPerDay: 0 }, tags: structuredClone(DEFAULT_TAGS) }, goals: { week: '', month: '', year: '', life: '', why: '' } };
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
      for (const k of ['trades', 'accounts', 'plans', 'posts']) db[k] = db[k].filter((x) => x.user !== u.id);
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
      if (!p) { p = { id: id(), user: uid, date, bias: '', keyLevels: '', ruleReminder: '', avoid: '', checks: [] }; db.plans.push(p); }
      Object.assign(p, b); save(); return wait({ plan: p });
    },
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
