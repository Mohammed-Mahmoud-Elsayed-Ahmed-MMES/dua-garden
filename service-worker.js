/**
 * service-worker.js
 * Dua Garden PWA Service Worker
 *
 * Strategy:
 *   - App shell (HTML, CSS, JS) → Cache First (loads instantly offline)
 *   - Supabase API calls        → Network First (always fresh data)
 *   - Google Fonts              → Cache First (no repeated downloads)
 */

const CACHE_NAME    = 'dua-garden-v1';
const OFFLINE_URL   = '/';

// Files to cache immediately on install (the app shell)
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/styles.css',
  '/assets/js/config.js',
  '/assets/js/state.js',
  '/assets/js/ui.js',
  '/assets/js/auth.js',
  '/assets/js/drawer.js',
  '/assets/js/categories.js',
  '/assets/js/duplicate.js',
  '/assets/js/ai.js',
  '/assets/js/duas.js',
  '/assets/js/pdf.js',
  '/assets/js/app.js',
  '/assets/images/icon-192.png',
  '/assets/images/icon-512.png',
];

/* ── Install: cache the app shell ────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

/* ── Activate: clean up old caches ───────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch: smart caching strategy ───────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Supabase API & external AI APIs → Network First, no caching
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('groq.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('cloudflare.com')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Google Fonts → Cache First
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 3. App shell assets → Cache First, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Cache valid responses
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return the cached home page
        if (request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});