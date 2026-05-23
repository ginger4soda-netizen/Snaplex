import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Import Tailwind Styles
import { initObservability } from './observability';

// 🔭 Initialize Observability (Vercel Analytics + Sentry + Performance)
initObservability();

// 🔄 Handle dynamic import failures (e.g., after deployment with new chunk hashes)
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  console.warn('Dynamic import failed, refreshing page...');
  window.location.reload();
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Detect Tauri environment and load the appropriate app
const isTauri = !!(window as any).__TAURI_INTERNALS__;

async function renderApp() {
  const root = ReactDOM.createRoot(rootElement);
  if (isTauri) {
    const { default: App } = await import('./App');
    root.render(<React.StrictMode><App /></React.StrictMode>);
  } else {
    const { default: AppWeb } = await import('./AppWeb');
    root.render(<React.StrictMode><AppWeb /></React.StrictMode>);
  }
}

renderApp();