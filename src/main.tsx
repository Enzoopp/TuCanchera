import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode desactivado: en dev hace que Supabase Auth no pueda
// adquirir su lock de sesión (monta componentes 2 veces) → bloqueo de 5s.
// En producción (npm run build) esto no aplica — StrictMode no tiene efecto.
createRoot(document.getElementById('root')!).render(<App />)

// Registrar Service Worker para PWA (solo en producción o HTTPS)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.info('[SW] Registrado:', reg.scope)
      })
      .catch((err) => {
        console.warn('[SW] Error al registrar:', err)
      })
  })
}
