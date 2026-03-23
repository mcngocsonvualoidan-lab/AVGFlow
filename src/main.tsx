import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    // Dispatch a custom event so the React component can show a notification
    window.dispatchEvent(new CustomEvent('sw-update-available'));
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

// Expose update function to window for the component to call
// @ts-ignore
window.updateApp = () => updateSW(true);

// Detect F5 / Ctrl+R to mark manual reload (suppress update popup after reload)
window.addEventListener('keydown', (e) => {
  if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
    sessionStorage.setItem('avgflow-manual-reload', Date.now().toString());
  }
});

// Reload when new SW takes control
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
