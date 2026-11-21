import firmsCatalog from '@shared/firms.json';

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
    const e = new Error(data.error || `Request failed (${res.status})`);
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
  plans: { get: (d) => req('GET', `/plans/${d}`), put: (d, b) => req('PUT', `/plans/${d}`, b) },
  posts: {
    list: (p) => req('GET', `/posts${qs(p)}`),
    create: (b) => req('POST', '/posts', b),
    like: (id) => req('POST', `/posts/${id}/like`),
    remove: (id) => req('DELETE', `/posts/${id}`),
  },
  firms: async () => firmsCatalog,
};
