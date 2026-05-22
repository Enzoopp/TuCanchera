import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode desactivado: en dev hace que Supabase Auth no pueda
// adquirir su lock de sesion (monta componentes 2 veces) -> bloqueo de 5s.
// En produccion (npm run build) esto no aplica - StrictMode no tiene efecto.
createRoot(document.getElementById('root')!).render(<App />)

// Registrar Service Worker para PWA (solo en produccion, no en dev)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
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
