// =====================================================
//  GLUK YEARBOOK 2026 — SERVICE WORKER (Phase 6)
// =====================================================
const CACHE = 'gluk-v3';
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
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Non-GET: skip
  if (e.request.method !== 'GET') return;

  // Firebase API calls: network only
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com') ||
      url.hostname.includes('apis.google.com')) {
    return;
  }

  // Firebase/Google CDN — cache after first fetch
  if (url.hostname === 'www.gstatic.com') {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; });
        })
      )
    );
    return;
  }

  // App shell: cache-first, fallback to network then index.html
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