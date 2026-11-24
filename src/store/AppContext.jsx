import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../api/index.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [allTrades, setAllTrades] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [mode, setModeState] = useState(() => localStorage.getItem('edgelog.mode') || 'live');
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null); // {type, props}
  const [ask, setAsk] = useState(null); // {msg, type, resolve}
  const [hidePnl, setHidePnl] = useState(() => localStorage.getItem('edgelog.hide') === '1');
  // Light mode by default (and after every sign-in); the sun/moon button still switches for the session
  const [theme, setThemeState] = useState(() => localStorage.getItem('edgelog.theme') || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f5fa' : '#0b0d14');
  }, [theme]);
  const setTheme = (t) => { localStorage.setItem('edgelog.theme', t); setThemeState(t); };
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const notify = useCallback((msg) => { setToast(msg); clearTimeout(window.__t); window.__t = setTimeout(() => setToast(null), 2600); }, []);
  const setMode = (m) => { localStorage.setItem('edgelog.mode', m); setModeState(m); };
  const toggleHide = () => setHidePnl((h) => { localStorage.setItem('edgelog.hide', h ? '0' : '1'); return !h; });

  const loadData = useCallback(async () => {
    const [t, a] = await Promise.all([api.trades.list(), api.accounts.list()]);
    setAllTrades(t.trades);
    setAccounts(a.accounts);
  }, []);

  // Stay signed in: the session token is kept in this browser until you sign out.
  // Only a real "not signed in" answer (401) clears it; a sleeping or unreachable server is retried.
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!getToken()) return setBooting(false);
      for (let attempt = 0; attempt < 12 && !stop; attempt++) {
        try {
          const { user } = await api.auth.me();
          setTheme('light'); // every visit opens in light mode
          setUser(user);
          try { localStorage.setItem('tp.lastUser', user.username); } catch { /* */ }
          await loadData();
          break;
        } catch (e) {
          if (e.status === 401 || e.status === 403) { setToken(null); break; }
          setWaking(true); // server asleep (Render free plan) or offline: wait and try again
          await new Promise((r) => setTimeout(r, Math.min(2000 + attempt * 1500, 8000)));
        }
      }
      setWaking(false);
      setBooting(false);
    })();
    return () => { stop = true; };
  }, [loadData]);

  const signIn = async (kind, creds) => {
    const { token, user } = await api.auth[kind](creds);
    setToken(token);
    try { localStorage.setItem('tp.lastUser', user.username); } catch { /* */ }
    setTheme('light');
    setUser(user);
    await loadData();
  };
  const signInToken = async (token) => {
    setToken(token);
    const { user } = await api.auth.me();
    setUser(user);
    await loadData();
  };
  const signOut = () => { setToken(null); setUser(null); setAllTrades([]); setAccounts([]); };

  const updateUser = async (patch) => { const { user } = await api.auth.update(patch); const fresh = { ...user, settings: { ...(user.settings || {}) } }; setUser(fresh); return fresh; };

  const saveTrade = async (data, id) => {
    if (id) {
      const { trade } = await api.trades.update(id, data);
      setAllTrades((ts) => ts.map((t) => (t.id === id ? trade : t)));
      return trade;
    }
    const { trade } = await api.trades.create({ mode, ...data });
    setAllTrades((ts) => [trade, ...ts]);
    return trade;
  };
  const deleteTrade = async (id) => { await api.trades.remove(id); setAllTrades((ts) => ts.filter((t) => t.id !== id)); };
  const importTrades = async (rows) => { await api.trades.bulk(rows.map((r) => ({ mode, ...r }))); await loadData(); };

  const addAccounts = async (data) => { const { accounts: a } = await api.accounts.create(data); setAccounts((x) => [...x, ...a]); return a; };
  const updateAccount = async (id, data) => { const { account } = await api.accounts.update(id, data); setAccounts((x) => x.map((a) => (a.id === id ? account : a))); };
  const removeAccount = async (id) => { await api.accounts.remove(id); setAccounts((x) => x.filter((a) => a.id !== id)); await loadData(); };

  const trades = useMemo(() => allTrades.filter((t) => (t.mode || 'live') === mode), [allTrades, mode]);

  const value = {
    api, user, booting, waking, theme, setTheme, toggleTheme, trades, allTrades, accounts, mode, setMode, hidePnl, toggleHide,
    signIn, signInToken, signOut, updateUser, loadData, saveTrade, deleteTrade, importTrades,
    addAccounts, updateAccount, removeAccount, notify, toast, modal,
    openModal: (type, props = {}) => setModal({ type, props }), closeModal: () => setModal(null),
    ask, confirmAsk: (msg, type) => new Promise((resolve) => setAsk({ msg, type, resolve })), closeAsk: (v) => { ask?.resolve(v); setAsk(null); },
    settings: user?.settings || {}, breakEven: user?.settings?.breakEven || 0,
    isAdmin: user?.role === 'admin',
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
