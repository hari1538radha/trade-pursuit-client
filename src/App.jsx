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
import Community from './pages/Community.jsx';
import PreMarket from './pages/PreMarket.jsx';
import News from './pages/News.jsx';

// In-memory routing in the static preview, clean URLs when served by the API server.
const Router = import.meta.env.VITE_DEMO === 'true' ? MemoryRouter : BrowserRouter;

export default function App() {
  const { user, booting } = useApp();
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
          <Route path="premarket" element={<PreMarket />} />
          <Route path="news" element={<News />} />
          <Route path="community" element={<Community />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
