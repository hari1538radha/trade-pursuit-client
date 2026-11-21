import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { AppProvider } from './store/AppContext.jsx';
import App from './App.jsx';
import './styles.css';
import { warmUp } from './api/http.js';

if (import.meta.env.VITE_DEMO !== 'true') warmUp();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AppProvider><App /></AppProvider>
    </MotionConfig>
  </StrictMode>
);
