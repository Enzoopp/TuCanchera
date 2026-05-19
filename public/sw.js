// TuCanchera Service Worker
// Estrategia: Network-first para la API, Cache-first para assets estáticos.
// Permite funcionamiento offline básico: muestra la shell de la app aunque no
// haya conexión, y cachea fonts/assets para cargas más rápidas.

const CACHE_NAME = 'tucanchera-v1'
const STATIC_ASSETS = [
  '/',
  '/explorar',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

// Instalación: precache de assets del shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Si algún asset falla, continúa de todas formas
      })
    })
  )
  self.skipWaiting()
})

// Activación: limpia caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch: Network-first con fallback a cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // No interceptar peticiones a Supabase ni a APIs externas
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('unsplash.com') ||
    event.request.method !== 'GET'
  ) {
    return
  }

  // Para navegación (HTML), network-first con fallback a '/'
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/') || new Response('Offline', { status: 503 })
      })
    )
    return
  }

  // Para assets estáticos (JS/CSS/fonts/images): cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        // Cachea solo respuestas válidas
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})
