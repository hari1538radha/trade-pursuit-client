import firmsCatalog from '@shared/firms.json';
import { fetchNewsDirect, lastNews } from './news.js';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';
const TOKEN_KEY = 'edgelog.token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() && { Authorization: `Bearer ${getToken()}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error ? `${data.error}${data.details?.reason ? ` (${data.details.reason})` : ''}` : `Request failed (${res.status})`);
    e.status = res.status;
    throw e;
  }
  return data;
}

/** Ping the API on load so a sleeping free Render instance starts waking right away. */
export const warmUp = () => fetch(BASE + '/health').catch(() => {});

const qs = (o = {}) => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')); return p.toString() ? `?${p}` : ''; };

export const httpApi = {
  demo: false,
  auth: {
    register: (b) => req('POST', '/auth/register', b),
    login: (b) => req('POST', '/auth/login', b),
    me: () => req('GET', '/auth/me'),
    update: (b) => req('PATCH', '/auth/me', b),
    password: (b) => req('POST', '/auth/password', b),
    deleteHistory: () => req('DELETE', '/auth/history'),
    deleteAccount: (b) => req('DELETE', '/auth/me', b),
  },
  trades: {
    list: (p) => req('GET', `/trades${qs(p)}`),
    create: (b) => req('POST', '/trades', b),
    bulk: (trades) => req('POST', '/trades/bulk', { trades }),
    update: (id, b) => req('PUT', `/trades/${id}`, b),
    remove: (id) => req('DELETE', `/trades/${id}`),
  },
  accounts: {
    list: () => req('GET', '/accounts'),
    create: (b) => req('POST', '/accounts', b),
    update: (id, b) => req('PUT', `/accounts/${id}`, b),
    remove: (id) => req('DELETE', `/accounts/${id}`),
  },
  plans: {
    get: (d) => req('GET', `/plans/${d}`),
    put: (d, b) => req('PUT', `/plans/${d}`, b),
    list: (p) => req('GET', `/plans${qs(p)}`),
    share: (d, userIds) => req('POST', `/plans/${d}/share`, { userIds }),
    shared: (date) => req('GET', `/plans/shared${qs({ date })}`),
  },
  friends: {
    list: () => req('GET', '/friends'),
    request: (username) => req('POST', '/friends', { username }),
    accept: (id) => req('POST', `/friends/${id}/accept`),
    remove: (id) => req('DELETE', `/friends/${id}`),
  },
  // Server first (shared cache); if it can't reach the feed, try from the browser, then the last copy we saw.
  async news(week = 'thisweek') {
    try {
      const out = await req('GET', `/news${qs({ week })}`);
      try { localStorage.setItem(`tp.news.${week}`, JSON.stringify(out)); } catch { /* storage full */ }
      return out;
    } catch (serverErr) {
      try { return await fetchNewsDirect(week); } catch { /* fall through */ }
      const last = lastNews(week);
      if (last) return last;
      throw serverErr;
    }
  },
  posts: {
    list: (p) => req('GET', `/posts${qs(p)}`),
    create: (b) => req('POST', '/posts', b),
    like: (id) => req('POST', `/posts/${id}/like`),
    remove: (id) => req('DELETE', `/posts/${id}`),
  },
  markets: { range: (symbols) => req('GET', `/markets/range${qs({ symbols: symbols.join(',') })}`) },
  notes: {
    list: () => req('GET', '/notes'),
    create: (b) => req('POST', '/notes', b),
    update: (id, b) => req('PUT', `/notes/${id}`, b),
    remove: (id) => req('DELETE', `/notes/${id}`),
  },
  quiz: { list: () => req('GET', '/quiz'), save: (b) => req('POST', '/quiz', b) },
  options: {
    // body: { cookie, underlying, expiry, atm, debug }  (cookie = your own Sensibull session)
    chain: (body) => req('POST', '/options/chain', body),
    history: (key, expiry) => req('GET', `/options/history${qs({ key, expiry })}`),
  },
  stocks: {
    status: () => req('GET', '/stocks/status'),
    refresh: () => req('POST', '/stocks/refresh'),
    setups: () => req('GET', '/stocks/setups'),
    scan: (p) => req('GET', `/stocks/scan${qs(p)}`),
    search: (q) => req('GET', `/stocks/search${qs({ q })}`),
    detail: (sym) => req('GET', `/stocks/${encodeURIComponent(sym)}`),
  },
  watchlist: {
    list: () => req('GET', '/watchlist'),
    add: (b) => req('POST', '/watchlist', b),
    update: (id, b) => req('PUT', `/watchlist/${id}`, b),
    remove: (id) => req('DELETE', `/watchlist/${id}`),
  },
  firms: async () => firmsCatalog,
};
