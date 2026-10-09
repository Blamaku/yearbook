// =====================================================
//  GLUK YEARBOOK 2026 — SERVICE WORKER
//  Cache: gluk-v49  (bump this string on every deploy)
//
//  • Pages, scripts and styles: NETWORK-FIRST. When you are online you always get
//    the newest version; the saved copy is only used when you are offline.
//  • Images and CDN libraries: cache-first (fast, they rarely change).
//  • One missing file can no longer stop the worker from installing.
//  • Phone notifications: shows pushes from the "api" function and keeps the
//    number on the app icon (the page corrects it whenever the app is open).
// =====================================================
const CACHE = 'gluk-v49';
const STATE = 'gluk-state';          // tiny saved values (the app-icon number); kept across updates

// App-shell files saved for offline use
const SHELL = [
  '/',
  '/index.html',
  '/department.html',
  '/course.html',
  '/class.html',
  '/profiles.html',
  '/profile.html',
  '/feed.html',
  '/staff.html',
  '/about.html',
  '/constitution.html',
  '/letters.html',
  '/club.html',
  '/clubs.html',
  '/admin.html',
  '/style.css',
  '/app.js',
  '/feed.js',
  '/home.js',
  '/staff.js',
  '/letters.js',
  '/university.html',
  '/university.js',
  '/auth.js',
  '/firebase-config.js',
  '/supabase.js',
  '/manifest.json',
  '/logo.png',
  '/logo-128.png',
  '/logo-64.png',
  '/icon-192.png',
  '/favicon.ico',
];

// CDN hosts whose (versioned) files we keep after the first download
const CDN_HOSTS = [
  'www.gstatic.com',
  'cdn.jsdelivr.net',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Save files one by one; a missing file is skipped instead of failing the whole install.
    // cache:'reload' skips the browser's own cache so we never save a stale copy.
    await Promise.all(SHELL.map(async url => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (err) { console.warn('[SW] could not save', url, err && err.message); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== STATE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Pages, scripts, styles and data files from this site
function isCode(req, url) {
  return url.origin === self.location.origin &&
    (req.mode === 'navigate' || url.pathname === '/' || /\.(html|js|css|json)$/i.test(url.pathname));
}

// Saved under the page address WITHOUT ?query, so profile.html?id=7 and ?id=8 share one saved page
const keyFor = url => url.origin + url.pathname;

async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }));
    if (res.redirected && req.mode === 'navigate') return Response.redirect(res.url, 302);
    if (res.ok && !res.redirected) cache.put(keyFor(url), res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(keyFor(url));
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const home = await cache.match(url.origin + '/index.html');
      if (home) return home;
    }
    return new Response('You are offline.', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req.url, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Sign-in, database and storage traffic: never touch it
  if (/(firestore|identitytoolkit|securetoken)\.googleapis\.com$/.test(url.hostname) ||
      url.hostname.includes('apis.google.com') ||
      url.hostname.includes('firebaseapp.com') ||
      url.hostname.includes('supabase.co')) return;

  if (isCode(req, url))                 { e.respondWith(networkFirst(req, url)); return; }   // newest files first
  if (CDN_HOSTS.includes(url.hostname)) { e.respondWith(cacheFirst(req));        return; }   // library files
  if (url.origin === self.location.origin) { e.respondWith(cacheFirst(req));     return; }   // images, icons
  // everything else (other websites): leave to the browser
});

// ── App-icon number ──────────────────────────────────
// Android has no badge API: it shows a dot on the icon while a notification is in the tray.
// iPhone (Home Screen app) and desktop Chrome/Edge show the number set here.
async function readBadge() {
  try { const r = await (await caches.open(STATE)).match('/__badge'); return r ? (Number(await r.text()) || 0) : 0; }
  catch (err) { return 0; }
}
async function setBadge(n) {
  n = Math.max(0, Math.floor(Number(n) || 0));
  try { await (await caches.open(STATE)).put('/__badge', new Response(String(n))); } catch (err) {}
  try {
    if (n && self.navigator.setAppBadge) await self.navigator.setAppBadge(n);
    else if (!n && self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
  } catch (err) {}
}

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'SKIP_WAITING') self.skipWaiting();
  // The page knows the real unread count; clear=true means "the person has read everything"
  if (e.data.type === 'BADGE') e.waitUntil((async () => {
    await setBadge(e.data.count);
    if (e.data.clear) (await self.registration.getNotifications()).forEach(n => n.close());
  })());
});

// ── Phone notifications ──────────────────────────────
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    await setBadge((await readBadge()) + 1);
    await self.registration.showNotification(String(d.title || 'GLUK Yearbook'), {
      body: String(d.body || ''),
      icon: '/icon-192.png',
      badge: '/logo-64.png',                         // small status-bar icon (Android uses its outline)
      tag: d.tag ? String(d.tag) : undefined,        // the same comment never shows twice
      data: { url: typeof d.url === 'string' ? d.url : '/index.html' },
    });
    // An open copy of the app refreshes its bell straight away
    (await self.clients.matchAll({ type: 'window' })).forEach(c => c.postMessage({ type: 'PUSH' }));
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/index.html', self.location.origin);
  if (url.origin !== self.location.origin) return;     // only ever open this yearbook
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find(w => w.visibilityState === 'visible') || wins[0];
    if (win) {
      try { await win.focus(); await win.navigate(url.href); return; } catch (err) { /* fall through: open a new window */ }
    }
    await self.clients.openWindow(url.href);
  })());
});
