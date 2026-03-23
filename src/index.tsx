import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Import Tailwind Styles
import App from './App';
import { initObservability } from './observability';

// 🔭 Initialize Observability (Vercel Analytics + Sentry + Performance)
initObservability();

// 🔄 Handle dynamic import failures (e.g., after deployment with new chunk hashes)
// This gives users a better experience by auto-refreshing instead of showing errors
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  console.warn('🔄 Dynamic import failed, refreshing page...');
  window.location.reload();
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);