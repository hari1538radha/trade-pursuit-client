import { MemoryRouter, BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from './store/AppContext.jsx';
import { Logo } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Journal from './pages/Journal.jsx';
import Analytics from './pages/Analytics.jsx';
import Propfirm from './pages/Propfirm.jsx';
import Strategy from './pages/Strategy.jsx';
import Options from './pages/Options.jsx';
import Stocks from './pages/Stocks.jsx';
import Goldbach from './pages/Goldbach.jsx';
import Levels from './pages/Levels.jsx';
import Macro from './pages/Macro.jsx';
import Notes from './pages/Notes.jsx';
import Quiz from './pages/Quiz.jsx';
import Calm from './pages/Calm.jsx';
import News from './pages/News.jsx';
import Traders from './pages/Traders.jsx';
import Money from './pages/Money.jsx';
import Payouts from './pages/Payouts.jsx';
import Life from './pages/Life.jsx';

// In-memory routing in the static preview, clean URLs when served by the API server.
const Router = import.meta.env.VITE_DEMO === 'true' ? MemoryRouter : BrowserRouter;

export default function App() {
  const { user, booting, isAdmin } = useApp();
  // Admin-only pages: users are sent back to the dashboard
  const admin = (el) => (isAdmin ? el : <Navigate to="/" replace />);
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, []);
  if (booting) return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.4 }} style={{ display: 'inline-block' }}><Logo size={48} /></motion.div>
        {slow && <p className="muted" style={{ marginTop: 18 }}>Waking up the server. The first load after a quiet spell can take up to a minute.</p>}
      </div>
    </div>
  );
  if (!user) return <Auth />;
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="journal" element={<Journal />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="propfirm" element={<Propfirm />} />
          <Route path="strategy" element={<Strategy />} />
          <Route path="options" element={admin(<Options />)} />
          <Route path="stocks" element={admin(<Stocks />)} />
          <Route path="goldbach" element={admin(<Goldbach />)} />
          <Route path="levels" element={admin(<Levels />)} />
          <Route path="macro" element={admin(<Macro />)} />
          <Route path="notes" element={admin(<Notes />)} />
          <Route path="quiz" element={admin(<Quiz />)} />
          <Route path="calm" element={admin(<Calm />)} />
          <Route path="news" element={<News />} />
          <Route path="money" element={admin(<Money />)} />
          <Route path="payouts" element={admin(<Payouts />)} />
          <Route path="lifestyle" element={admin(<Life />)} />
          <Route path="traders" element={admin(<Traders />)} />
          <Route path="traders/:id" element={admin(<Traders />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
