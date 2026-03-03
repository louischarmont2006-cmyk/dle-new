import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

// Enregistrement du Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ Service Worker enregistré:', registration.scope);
      })
      .catch((error) => {
        console.log('❌ Échec Service Worker:', error);
      });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredInstallPrompt = e;
  console.log('💡 PWA installable');
});

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installée !');
  window.deferredInstallPrompt = null;
});

// ✅ FIX — StrictMode retiré car il cause des déconnexions/reconnexions
// en développement qui brisent les sockets et les salons privés
createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)