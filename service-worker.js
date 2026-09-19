// =====================================================
//  GLUK YEARBOOK 2026 — SERVICE WORKER (Phase 6+)
//  Cache: gluk-v4  (bump this string on every deploy)
// =====================================================
const CACHE = 'gluk-v5';

// App-shell files — all must be present on install
const SHELL = [
  '/',
  '/index.html',
  '/department.html',
  '/course.html',
  '/class.html',
  '/profiles.html',
  '/profile.html',
  '/admin.html',
  '/style.css',
  '/app.js',
  '/auth.js',
  '/firebase-config.js',
  '/supabase.js',        // ← was missing; needed for offline init
  '/manifest.json',
];

// CDN hosts whose responses we cache after first fetch
const CDN_HOSTS = [
  'www.gstatic.com',
  'cdn.jsdelivr.net',    // Supabase JS library
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET requests entirely
  if (e.request.method !== 'GET') return;

  // Firebase live API calls — always network-only (never cache auth / Firestore data)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('apis.google.com')
  ) return;

  // Supabase API calls — always network-only
  if (url.hostname.includes('supabase.co')) return;

  // CDN libraries (Firebase SDK, Supabase JS) — cache after first fetch
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(r => {
            if (r.ok) c.put(e.request, r.clone());
            return r;
          });
        })
      )
    );
    return;
  }

  // App shell — cache-first; fallback to network, then index.html for navigation
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(r => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});