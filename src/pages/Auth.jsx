import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Logo, Seg, Field, ease } from '../components/ui.jsx';
import { ThemeToggle } from '../components/Layout.jsx';

export default function Auth() {
  const { signIn, signInToken, api } = useApp();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', password: '', displayName: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const t = setTimeout(() => setSlow(true), 4000);
    try { await signIn(mode === 'login' ? 'login' : 'register', mode === 'login' ? { username: f.username, password: f.password } : f); }
    catch (e2) { setErr(e2.message === 'Failed to fetch' ? 'Can\'t reach the server. Check your connection and try again.' : e2.message); }
    clearTimeout(t); setSlow(false); setBusy(false);
  };
  return (
    <div className="auth">
      <div className="auth-art">
        <motion.div initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease }} style={{ position: 'absolute', inset: 0 }}>
          <svg viewBox="0 0 600 400" style={{ position: 'absolute', right: -40, top: 60, width: '110%', opacity: 0.55 }}>
            <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4f8cff" stopOpacity=".5" /><stop offset="1" stopColor="#4f8cff" stopOpacity="0" /></linearGradient></defs>
            <motion.path d="M0 320 L60 300 L110 310 L170 250 L220 270 L280 200 L330 215 L390 150 L450 170 L510 90 L600 60" stroke="#7fb0ff" strokeWidth="3" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, ease }} />
            <path d="M0 320 L60 300 L110 310 L170 250 L220 270 L280 200 L330 215 L390 150 L450 170 L510 90 L600 60 L600 400 L0 400Z" fill="url(#g)" />
          </svg>
        </motion.div>
        <div style={{ position: 'relative' }}>
          <div className="row" style={{ gap: 12, marginBottom: 30 }}><Logo size={40} /><b style={{ fontSize: 24 }}>Trade Pursuit</b></div>
          <h1>Find your edge.<br /><span className="muted">Keep your evals.</span></h1>
          <p className="muted" style={{ fontSize: 18, maxWidth: 440, lineHeight: 1.5 }}>A free trading journal for prop traders. Log in seconds, track every eval against its rules, and see what actually pays.</p>
        </div>
      </div>
      <div className="auth-form">
        <div style={{ position: 'absolute', top: 20, right: 20 }}><ThemeToggle /></div>
        <motion.form onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} style={{ width: 'min(400px,100%)' }} className="col">
          <div style={{ marginBottom: 26 }}><Seg size="lg" options={[{ value: 'login', label: 'Sign in' }, { value: 'register', label: 'Create account' }]} value={mode} onChange={(m) => { setMode(m); setErr(''); }} /></div>
          <h2 style={{ fontSize: 34, margin: '0 0 6px', letterSpacing: '-.03em' }}>{mode === 'login' ? 'Welcome back' : 'Start journaling'}</h2>
          <p className="muted" style={{ marginTop: 0 }}>{mode === 'login' ? 'Username and password. That’s it.' : 'Pick a username your friends will recognise. Free, no card.'}</p>
          <div className="col" style={{ gap: 14, marginTop: 14 }}>
            <Field label="Username"><input className="input" autoFocus autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="hari_trades" /></Field>
            <AnimatePresence>
              {mode === 'register' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <Field label="Display name (optional)"><input className="input" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} placeholder="Hari R" /></Field>
                </motion.div>
              )}
            </AnimatePresence>
            <Field label="Password"><input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="6+ characters" /></Field>
            <AnimatePresence>{err && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="neg" style={{ margin: 0 }}>{err}</motion.p>}</AnimatePresence>
            <motion.button whileTap={{ scale: 0.98 }} className="btn primary" style={{ height: 50, fontSize: 16, marginTop: 6 }} disabled={busy}>{busy ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Sign in' : 'Create account'} {!busy && <ArrowRight size={17} />}</motion.button>
            {slow && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Waking up the server, this can take up to a minute the first time.</p>}
            {api.demo && (
              <button type="button" className="btn" style={{ height: 46 }} onClick={async () => { setBusy(true); const { token } = await api.sample(); await signInToken(token); }}>
                <Sparkles size={16} /> Explore with sample trades
              </button>
            )}
          </div>
          {api.demo && <p className="dim" style={{ fontSize: 12.5, marginTop: 18 }}>Preview build: accounts and trades are stored only in this browser.</p>}
        </motion.form>
      </div>
    </div>
  );
}
