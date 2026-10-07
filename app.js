// =====================================================
//  GLUK YEARBOOK 2026 — APP.JS
//  Auth:     Firebase   (window.auth, window.db)
//  Profiles: Supabase   (window.supabase = client)
//  Comments: Firestore  (realtime)
// =====================================================
'use strict';

// ── Dark Mode Toggle ──────────────────────────────────
window.toggleTheme = function() {
  const curr = document.documentElement.getAttribute('data-theme') || 'light';
  const next = curr === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('gluk-theme', next);
  // Re-render user bar so icon flips
  if (typeof updateUserBar === 'function') {
    updateUserBar(typeof currentUser !== 'undefined' ? currentUser : null);
  }
};

// ── Clear Cache & Reload ──────────────────────────────
window.clearCacheAndReload = async function() {
  showToast('Clearing cache… ⏳', 2000);
  try {
    // Unregister all service workers
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    // Delete all caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch(e) { console.warn('[clearCache]', e); }
  setTimeout(() => window.location.reload(true), 400);
};

// ── Dynamic graduation year (auto-updates Jan 1) ───
const GRAD_YEAR = new Date().getFullYear();
// Graduation ceremony date for each year (YYYY-MM-DD). Change it here and every countdown and label follows.
const GRAD_DATES = { 2026: '2026-11-20' };
const GRAD_DATE = new Date(`${GRAD_DATES[GRAD_YEAR] || GRAD_YEAR + '-11-20'}T09:00:00`).getTime();
window.GRAD_YEAR = GRAD_YEAR;
window.GRAD_DATE = GRAD_DATE;

// ── Class levels — a new intake joins every September ──────────
//   Jan–Aug : Y (final year, graduating Nov) … Y+3 (1st year)
//   Sep–Dec : Y (graduating Nov) … Y+4 (brand-new 1st-year intake)
// Every page reads its class list from here, so it updates itself each year.
const INTAKE_MONTH = 8;   // 0 = January … 8 = September (change if your intake month differs)

window.studentClassYears = function () {
  const years = [GRAD_YEAR, GRAD_YEAR + 1, GRAD_YEAR + 2, GRAD_YEAR + 3];
  if (new Date().getMonth() >= INTAKE_MONTH) years.push(GRAD_YEAR + 4);
  return years;
};

window.classLevelInfo = function (year) {
  year = Number(year);
  const afterIntake = new Date().getMonth() >= INTAKE_MONTH;
  const study = 4 - (year - (afterIntake ? GRAD_YEAR + 1 : GRAD_YEAR));   // year of study, 1–4
  if (year === GRAD_YEAR) return { icon: '🎓', badge: 'Graduating!', sub: `Final Year — Graduating November ${GRAD_YEAR}` };
  if (study === 4) return { icon: '📕', badge: 'Final Year', sub: 'Final Year' };
  if (study === 3) return { icon: '📘', badge: '3rd Year',   sub: 'Third Year' };
  if (study === 2) return { icon: '📗', badge: '2nd Year',   sub: 'Second Year' };
  if (study === 1) return { icon: '🌟', badge: '1st Year',   sub: `First Year — Class of ${year} Freshers` };
  return { icon: '📘', badge: '', sub: '' };
};

// ── Alumni years — a class year only appears once someone has a profile for it ──
// Returns [{year:'2025', count:12}, …] newest first, built from the profiles table.
window.getAlumniYears = async function () {
  const counts = {};
  const PAGE = 1000;                                   // Supabase returns at most 1000 rows per request
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await supabase
      .from('profiles_public')
      .select('classyear')
      .lte('classyear', String(GRAD_YEAR - 1))         // alumni = graduation year before this year
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    (data || []).forEach(r => {
      const y = String(r.classyear || '').trim();
      if (/^\d{4}$/.test(y)) counts[y] = (counts[y] || 0) + 1;
    });
    if (!data || data.length < PAGE) break;
  }
  return Object.keys(counts).sort((a, b) => b - a).map(y => ({ year: y, count: counts[y] }));
};

// ── GLUK Clubs ──────────────────────────────────────
// Single source of truth for every club: name, icon, colour, category, one-line description.
// The clubs list, each club page, the profile form and the admin panel all read from here.
const CLUB_CATEGORIES = ['Faith', 'Health', 'Arts and media', 'Leadership', 'Academic', 'Community', 'Sports and games'];
const CLUB_CATALOG = [
  { name:'GLUK Students Association',       icon:'🏫', color:'#0f4c81', cat:'Leadership',       desc:'Student governance & representation' },
  { name:'Red Cross Club',                  icon:'🚑', color:'#dc2626', cat:'Health',           desc:'Humanitarian service & first aid' },
  { name:'Drama Club',                      icon:'🎭', color:'#7c3aed', cat:'Arts and media',   desc:'Theatre, performance & storytelling' },
  { name:'Christian Union',                 icon:'✝️', color:'#1d4ed8', cat:'Faith',            desc:'Faith, fellowship & outreach' },
  { name:'Environmental Club',              icon:'🌿', color:'#16a34a', cat:'Community',        desc:'Green campus & sustainability' },
  { name:'Catholic Association',            icon:'⛪', color:'#b45309', cat:'Faith',            desc:'Catholic faith & community' },
  { name:'Choir',                           icon:'🎵', color:'#c026d3', cat:'Arts and media',   desc:'Singing, harmony & performance' },
  { name:'Health Club',                     icon:'💪', color:'#0891b2', cat:'Health',           desc:'Wellness, fitness & healthy living' },
  { name:'GLUSNA',                          icon:'💉', color:'#e11d48', cat:'Academic',         desc:'GLUK Student Nurses Association' },
  { name:'CLIMSA GLUK',                     icon:'🩺', color:'#0e7490', cat:'Academic',         desc:'Clinical Medicine Students Association' },
  { name:'Debate Club',                     icon:'🗣️', color:'#4f46e5', cat:'Leadership',       desc:'Public speaking & critical thinking' },
  { name:'Integrity Club',                  icon:'⚖️', color:'#0369a1', cat:'Leadership',       desc:'Ethics, leadership & accountability' },
  { name:'Transparency and Integrity Club', icon:'🔍', color:'#155e75', cat:'Leadership',       desc:'Transparency, accountability & good governance' },
  { name:'Art Club',                        icon:'🎨', color:'#ea580c', cat:'Arts and media',   desc:'Visual arts, painting & crafts' },
  { name:'Chess Club',                      icon:'♟️', color:'#374151', cat:'Sports and games', desc:'Strategy, mind games & tournaments' },
  { name:'Rotaract Club',                   icon:'🌍', color:'#b45f06', cat:'Community',        desc:'Community service & leadership' },
  { name:'Photography Club',                icon:'📷', color:'#475569', cat:'Arts and media',   desc:'Photography, film & visual media' },
  { name:'Toastmasters Club',               icon:'🎤', color:'#a16207', cat:'Leadership',       desc:'Communication & leadership skills' },
  { name:'Entrepreneurship Club',           icon:'💡', color:'#65a30d', cat:'Leadership',       desc:'Innovation, business & startups' },
  { name:'Science Club',                    icon:'🔬', color:'#0284c7', cat:'Academic',         desc:'Research, experiments & STEM' },
  { name:'Theology Club',                   icon:'📖', color:'#92400e', cat:'Faith',            desc:'Theology, Bible study & ministry' },
  { name:'Agribusiness Club',               icon:'🌾', color:'#4d7c0f', cat:'Academic',         desc:'Agriculture, food & agribusiness' },
  { name:'Biocosmos',                       icon:'🧬', color:'#0d9488', cat:'Academic',         desc:'Biology, nature & life sciences' },
  { name:'Public Health Club',              icon:'🌐', color:'#059669', cat:'Health',           desc:'Community health & public policy' },
  { name:'Medical Students Association',    icon:'🏥', color:'#b91c1c', cat:'Academic',         desc:'Medical education & clinical training' },
  { name:'Sports Medicine Club',            icon:'🏃', color:'#0f766e', cat:'Sports and games', desc:'Sports health & exercise science' },
  { name:'Student Teacher Association',     icon:'📚', color:'#6d28d9', cat:'Academic',         desc:'Education practice & pedagogy' },
  { name:'Mathematics Club',                icon:'➕', color:'#2563eb', cat:'Academic',         desc:'Maths, statistics & problem solving' },
  { name:'Music Band',                      icon:'🎸', color:'#db2777', cat:'Arts and media',   desc:'Instruments, concerts & music' },
  { name:'IT Society',                      icon:'💻', color:'#1e40af', cat:'Academic',         desc:'Technology, coding & digital skills' },
  { name:'SASCO',                           icon:'🤝', color:'#57534e', cat:'Community',        desc:'Student Academic Support Community' },
  { name:'Peer Counselling Club',           icon:'🧠', color:'#9333ea', cat:'Health',           desc:'Mental health & peer support' },
  { name:'Football Club',                   icon:'⚽', color:'#15803d', cat:'Sports and games', desc:'Soccer training, matches & tournaments' },
  { name:'Basketball Club',                 icon:'🏀', color:'#c2410c', cat:'Sports and games', desc:'Basketball training, matches & tournaments' },
  { name:'Volleyball Club',                 icon:'🏐', color:'#0891b2', cat:'Sports and games', desc:'Volleyball training, matches & tournaments' },
  { name:'Frisbee Club',                    icon:'🥏', color:'#65a30d', cat:'Sports and games', desc:'Ultimate frisbee, throwing & tournaments' },
  { name:'Rugby Club',                      icon:'🏉', color:'#7c2d12', cat:'Sports and games', desc:'Rugby training, matches & tournaments' },
  { name:'Netball Club',                    icon:'🏵️', color:'#be185d', cat:'Sports and games', desc:'Netball training, matches & tournaments' },
  { name:'Athletics Club',                  icon:'🏅', color:'#b45309', cat:'Sports and games', desc:'Track & field, running & competitions' },
  { name:'Innovation Club',                 icon:'🚀', color:'#4338ca', cat:'Leadership',       desc:'Ideas, prototyping & innovation challenges' },
  { name:'Academic Writers Club',           icon:'✍️', color:'#0d9488', cat:'Academic',         desc:'Research writing, essays & publishing skills' },
  { name:'Booklovers Club',                 icon:'📚', color:'#7e22ce', cat:'Arts and media',   desc:'Reading circles, book discussions & reviews' },
];
const GLUK_CLUBS = CLUB_CATALOG.map(c => c.name);
window.GLUK_CLUBS = GLUK_CLUBS;
window.CLUB_CATALOG = CLUB_CATALOG;
window.CLUB_CATEGORIES = CLUB_CATEGORIES;
window.clubMeta = name => CLUB_CATALOG.find(c => c.name === name) || null;

// ── Club helpers (shared by clubs.html, club.html and the admin panel) ──
window.escHtml = esc;                                   // escapes & < > " '  — safe inside text AND attributes

// Only allow full http(s) links (blocks javascript:, data:, empty and relative values)
window.safeUrl = function (u) {
  const s = String(u == null ? '' : u).trim();
  if (!/^https?:\/\//i.test(s)) return '';               // empty, relative, javascript:, data: ... all rejected
  try { return new URL(s).href; } catch (e) { return ''; }
};

// profiles.clubs can be a real array, a "a, b" string, or a Postgres "{a,\"b c\"}" literal
window.parseClubField = function (v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v !== 'string' || !v.trim()) return [];
  let s = v.trim();
  if (s.startsWith('{') && s.endsWith('}')) {
    s = s.slice(1, -1);
    const out = [], re = /"((?:[^"\\]|\\.)*)"|([^,]+)/g;
    let m;
    while ((m = re.exec(s))) out.push((m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2]).trim());
    return out.filter(Boolean);
  }
  return s.split(',').map(x => x.trim()).filter(Boolean);
};

// "0712 345 678" / "+254712345678" / "712345678"  ->  https://wa.me/254712345678   ('' if it doesn't look like a number)
window.waLink = function (raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = '254' + d.slice(1);
  else if (d.length === 9 && /^[71]/.test(d)) d = '254' + d;
  return (d.length >= 11 && d.length <= 15) ? 'https://wa.me/' + d : '';
};

// Kenyan numbers written 07…, 01…, 7…, 1… or 254…  ->  +254712345678.  Other formats are left exactly as typed.
// The birthday field uses a native date picker for a good mobile experience, but only the
// month and day are ever stored or sent to the server — the year is discarded on purpose.
window.birthdayFromInput = function (v) {
  const m = /^\d{4}-(\d{2}-\d{2})$/.exec(String(v || '').trim());
  return m ? m[1] : '';
};
window.birthdayToInput = function (stored) {
  const m = /^(\d{2}-\d{2})$/.exec(String(stored || '').trim());
  return m ? '2000-' + m[1] : '';                      // 2000 is a leap year, so 29 Feb round-trips too
};

window.normalizePhone = function (raw) {
  const s = String(raw == null ? '' : raw).trim();
  const d = s.replace(/\D/g, '');
  if (!s || !d) return s;
  if (s.startsWith('+')) return '+' + d;                               // already international
  if (d.startsWith('00')) return '+' + d.slice(2);                     // 0044… -> +44…
  if (/^0?[17]\d{8}$/.test(d)) return '+254' + d.replace(/^0/, '');    // 0712345678 / 0112345678 / 712345678
  if (/^254[17]\d{8}$/.test(d)) return '+' + d;                       // 254712345678
  return s;
};

// Friendly "how active is this club" label for the clubs list
window.clubActivityLabel = function (iso) {
  if (!iso) return { text: 'No posts yet', fresh: false };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1)  return { text: 'New post today',   fresh: true };
  if (days < 7)  return { text: 'Active this week', fresh: true };
  if (days < 30) { const w = Math.floor(days / 7);  return { text: `Last post ${w} week${w === 1 ? '' : 's'} ago`,  fresh: false }; }
  const mo = Math.floor(days / 30);
  return { text: `Last post ${mo} month${mo === 1 ? '' : 's'} ago`, fresh: false };
};

// Member counts + last post date per club (cached for 5 minutes so browsing back and forth stays fast)
window.getClubStats = async function (force) {
  const KEY = 'gluk-club-stats';
  if (!force) {
    try {
      const c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (c && Date.now() - c.t < 300000) return c.d;
    } catch (e) {}
  }
  const members = {}, last = {}, PAGE = 1000;
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await supabase
      .from('profiles_public').select('clubs,isanonymous')
      .order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    (data || []).forEach(r => {
      if (r.isanonymous) return;                        // anonymous profiles aren't listed on club pages
      window.parseClubField(r.clubs).forEach(c => { members[c] = (members[c] || 0) + 1; });
    });
    if (!data || data.length < PAGE) break;
  }
  try {                                                  // newest post per club (ignore errors: table may not exist yet)
    const { data } = await supabase.from('club_posts').select('club_name,created_at')
      .order('created_at', { ascending: false }).limit(1000);
    (data || []).forEach(r => { if (!last[r.club_name]) last[r.club_name] = r.created_at; });
  } catch (e) {}
  const out = { members, last };
  try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: out })); } catch (e) {}
  return out;
};

// ── Kenya Counties ───────────────────────────────────
const KENYA_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu',
  'Garissa','Homa Bay','Isiolo','Kajiado','Kakamega','Kericho',
  'Kiambu','Kilifi','Kirinyaga','Kisii','Kisumu','Kitui','Kwale',
  'Laikipia','Lamu','Machakos','Makueni','Mandera','Marsabit',
  'Meru','Migori','Mombasa',"Murang'a",'Nairobi','Nakuru','Nandi',
  'Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya',
  'Taita-Taveta','Tana River','Tharaka-Nithi','Trans Nzoia',
  'Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
];
window.KENYA_COUNTIES = KENYA_COUNTIES;

// ── GLUK Programme Catalogue (mirrors department.html) ─
// Exposed on window so profiles.html inline script can reference it too.
const DEPT_COURSES_MAP = {
  'School of Medicine': [
    'BSc. in Clinical Medicine and Community Health',
    'MSc. in Clinical Medicine','MSc. in Medical Education','MSc. in Biology',
    'Diploma in Clinical Medicine and Surgery','BSc. in Physiotherapy',
    'BSc. Medical Laboratory Science','Health Care Assistant Certificate',
  ],
  'School of Nursing and Midwifery': [
    'BSc. in Nursing','BSc. in Nursing (Upgrading)','MSc. in Nursing','PhD in Nursing',
  ],
  'School of Public Health': [
    'BSc. in Public Health','BSc. in Community Health and Development',
    'MSc. in Community Health and Development','PhD in Community Health and Development',
    'PhD in Public Health','MSc. in Public Health',
    'BSc. in Community Nutrition and Dietetics','MSc. in Community Nutrition and Dietetics',
    'Postgraduate Diploma in Health Service Management',
    'Diploma in Community Health and Development','Certificate in Community Health and Development',
    'Diploma in Community Nutrition','Certificate in Community Nutrition',
  ],
  'Faculty of Education': [
    'Bachelor of Education (Arts)','Bachelor of Education (Science)',
    'Bachelor of Education (Special Needs)','Master of Education','PhD in Education',
    'Postgraduate Diploma in Education','Postgraduate Diploma in Technical Education',
    'Diploma in Psycho-Educational Assessment & Intervention Strategies',
    'Certificate in Psycho-Educational Assessment & Intervention Strategies',
    'Certificate in Cognitive and Affective Neuroscience',
  ],
  'Faculty of Humanities and Social Sciences': [
    'Bachelor of Arts in Counseling Psychology','Master of Counseling Psychology',
    'PhD in Counseling Psychology','Bachelor of Arts in Leadership and Governance',
    'Master of Arts in Leadership and Governance',
    'Bachelor of Theology','Diploma in Theology','Certificate in Theology','Master of Theology',
  ],
  'Faculty of Agribusiness and Technology': [
    'BSc. in Agribusiness Management','MSc. in Agribusiness Management','PhD in Agribusiness Management',
    'BSc. Information Technology','BSc. in Hospitality and Tourism',
    'Diploma in Hospitality and Tourism Management',
    'Bachelor of Business Administration','Diploma in Business Administration',
  ],
  'School of Business Administration': [
    'Bachelor of Commerce (Accounting)','Bachelor of Commerce (Finance)',
    'Bachelor of Commerce (Human Resource Management)',
    'Bachelor of Commerce (Procurement and Supply Chain Management)',
    'Master of Business Administration','PhD in Business Administration',
  ],
};
window.DEPT_COURSES_MAP = DEPT_COURSES_MAP;

// ── Normalize Supabase profile row ────────────────────
// PostgreSQL lowercases unquoted column names (classYear→classyear etc).
// This function accepts either casing so the rest of the app never sees undefined.
function normalizeProfile(s) {
  if (!s) return s;
  return {
    ...s,
    classYear:     s.classYear     || s.classyear     || '',
    bestMemory:    s.bestMemory    || s.bestmemory    || '',
    biggestLesson: s.biggestLesson || s.biggestlesson || '',
    mostLikelyTo:  s.mostLikelyTo || s.mostlikelyto  || '',
    whatareyouto:  s.whatareyouto  || '',
    currentcounty:    s.currentcounty    || '',
    currentlocation:  s.currentlocation  || '',
    isAnonymous:   s.isAnonymous   ?? s.isanonymous   ?? false,
    photo_url:     s.photo_url     || null,
    photos:        s.photos        || [],
  };
}
window.normalizeProfile = normalizeProfile;

// ── Service Worker + Auto-Update Banner ──────────────
(function initSW() {
  if (!('serviceWorker' in navigator)) return;

  // Local testing (Live Server, localhost): never keep a service worker there — it serves saved copies
  // of your pages and hides the edits you just made. Remove any that is already installed.
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'swUpdateBanner';
  banner.innerHTML = `
    <span style="flex:1">✨ New update available!</span>
    <button id="swUpdateBtn" style="
      background:var(--gold,#d4a017);color:#0a1628;
      border:none;border-radius:20px;padding:6px 14px;
      font-weight:800;font-size:.75rem;cursor:pointer;flex-shrink:0">
      Refresh ↻
    </button>
    <button id="swDismissBtn" aria-label="Dismiss" style="
      background:none;border:none;color:rgba(255,255,255,.5);
      font-size:1rem;cursor:pointer;padding:0 2px;flex-shrink:0">✕</button>`;
  banner.style.cssText = `
    position:fixed;bottom:80px;left:12px;right:12px;z-index:9999;
    background:linear-gradient(135deg,#0a1628,#1a2d50);
    color:#fff;border-radius:14px;padding:12px 14px;
    box-shadow:0 4px 20px rgba(0,0,0,.45);
    display:none;align-items:center;gap:10px;font-size:.82rem;font-weight:600;
    border:1px solid rgba(212,160,23,.3);`;
  document.body.appendChild(banner);

  let _waitingSW = null;
  function showUpdateBanner(sw) { _waitingSW = sw; banner.style.display = 'flex'; }

  document.getElementById('swUpdateBtn').addEventListener('click', () => {
    banner.style.display = 'none';
    if (_waitingSW) { _waitingSW.postMessage({ type: 'SKIP_WAITING' }); _waitingSW = null; }
  });
  document.getElementById('swDismissBtn').addEventListener('click', () => { banner.style.display = 'none'; });
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => {
        console.log('[SW]', reg.scope);
        if (reg.waiting) showUpdateBanner(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(newSW);
          });
        });
        setInterval(() => reg.update(), 60_000);
      })
      .catch(e => console.warn('[SW]', e));
  });
})();

// ── PWA Install ──────────────────────────────────────
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  // Show banner after 5 seconds if not already installed
  const b = document.getElementById('installBanner');
  if (b) {
    clearTimeout(window._installTimer);
    window._installTimer = setTimeout(() => {
      if (deferredPrompt) b.classList.add('show');
    }, 5000);
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const b = document.getElementById('installBanner');
  if (b) b.classList.remove('show');
});

window.installApp = function() {
  if (!deferredPrompt) {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      showToast('Tap Share ↑ then "Add to Home Screen" 📲', 4000);
    } else if (window.matchMedia('(display-mode: standalone)').matches) {
      showToast('Already installed! 📱');
      dismissInstall();
    } else {
      showToast('Install not available in this browser 📱', 3500);
    }
    return;
  }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(choice => {
    if (choice.outcome === 'accepted') showToast('Installing GLUK Yearbook… 🎉', 3000);
    deferredPrompt = null;
    dismissInstall();
  });
};

window.dismissInstall = function() {
  const b = document.getElementById('installBanner');
  if (b) b.classList.remove('show');
};

// Attach dismiss to button after DOM is ready (belt + suspenders)
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('dismissBtn');
  if (btn && !btn._dismissBound) {
    btn._dismissBound = true;
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      window.dismissInstall();
    });
  }
});

// ── Countdown ────────────────────────────────────────
function runCountdown() {
  const pad = n => String(n).padStart(2,'0');
  const set = (id,v) => { const el=document.getElementById('cd-'+id); if(el) el.textContent=v; };
  function tick() {
    const diff = GRAD_DATE - Date.now();
    if (diff <= 0) { ['days','hours','minutes','seconds'].forEach(u=>set(u,'00')); return; }
    set('days',   pad(Math.floor(diff/86400000)));
    set('hours',  pad(Math.floor((diff%86400000)/3600000)));
    set('minutes',pad(Math.floor((diff%3600000)/60000)));
    set('seconds',pad(Math.floor((diff%60000)/1000)));
  }
  tick(); setInterval(tick, 1000);
}
// Run immediately if elements already exist (scripts at bottom of body),
// otherwise wait for DOMContentLoaded (deferred / async load scenarios).
if (document.getElementById('cd-days')) {
  runCountdown();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('cd-days')) runCountdown();
  });
}

// ── Toast ────────────────────────────────────────────
window.showToast = function(msg, dur=2800) {
  let t = document.getElementById('glukToast');
  if (!t) { t=document.createElement('div'); t.id='glukToast'; t.className='gluk-toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('toast-show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('toast-show'), dur);
};
const showToast = window.showToast;

// ── Helpers ──────────────────────────────────────────
const Params = { get: k => new URLSearchParams(window.location.search).get(k)||'' };

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function ago(ts) {
  if (!ts) return '';
  const d=Date.now()-ts;
  if(d<60000) return 'just now';
  if(d<3600000) return Math.floor(d/60000)+'m ago';
  if(d<86400000) return Math.floor(d/3600000)+'h ago';
  return Math.floor(d/86400000)+'d ago';
}
function parseList(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v==='string'&&v) return v.split(',').map(x=>x.trim()).filter(Boolean);
  return [];
}

// ── Normalize Supabase photos field ──────────────────
// Supabase TEXT[] can come back as a JS array, a Postgres literal
// string like "{url1,url2}", or null/undefined. This always returns
// a clean JS string array with no empty entries.
function normalizePhotos(raw, fallbackUrl) {
  let arr = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === 'string' && raw.startsWith('{')) {
    // Postgres array literal: {url1,url2}
    arr = raw.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  }
  arr = arr.filter(u => typeof u === 'string' && u.startsWith('http'));
  if (!arr.length && fallbackUrl && typeof fallbackUrl === 'string' && fallbackUrl.startsWith('http')) {
    arr = [fallbackUrl];
  }
  return arr;
}
function makeBreadcrumb(dept, course, classYear) {
  const parts=['<a href="index.html">Home</a>'];
  if(dept) parts.push(`<a href="department.html?dept=${encodeURIComponent(dept)}">${esc(dept)}</a>`);
  if(course) parts.push(`<a href="course.html?dept=${encodeURIComponent(dept)}&course=${encodeURIComponent(course)}">${esc(course)}</a>`);
  if(classYear) parts.push(`<span>Class of ${classYear}</span>`);
  return parts.join(' <span style="opacity:.4">›</span> ');
}
function showSkeletons(id, n=6) {
  const g=document.getElementById(id); if(!g) return;
  g.innerHTML=Array(n).fill(`
    <div class="profile-card skeleton-card">
      <div class="sk-block" style="padding-top:133%"></div>
      <div class="card-body">
        <div class="sk-line" style="width:80%;height:12px;margin-bottom:8px"></div>
        <div class="sk-line" style="width:55%;height:9px;margin-bottom:8px"></div>
        <div class="sk-line" style="width:40%;height:9px"></div>
      </div>
    </div>`).join('');
}
function observeImages() {
  if(!('IntersectionObserver' in window)) return;
  const obs=new IntersectionObserver((entries,o)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        const img=e.target;
        if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src;}
        img.classList.add('img-loaded');o.unobserve(img);
      }
    });
  },{rootMargin:'120px'});
  document.querySelectorAll('img[loading="lazy"]').forEach(img=>obs.observe(img));
}

// ══ Secure API client ═══════════════════════════════════════════
// Every change to your data goes through the "api" function in Supabase, which checks who is asking.
// While rolling out, if the function cannot be reached the app quietly uses the old direct write instead
// (window.GLUK_API.strict = true turns that fallback off — do that once the database is locked).
window.GLUK_API = window.GLUK_API || { url: SUPABASE_URL + '/functions/v1/api', strict: true };

window.gApi = async function (action, payload) {
  const user = auth.currentUser;
  if (!user) { const e = new Error('Please sign in first.'); e.code = 'auth'; throw e; }
  let token;
  try { token = await user.getIdToken(); }
  catch (e) { const er = new Error('Please sign in again.'); er.code = 'auth'; throw er; }
  let res, body = null;
  try {
    res = await fetch(window.GLUK_API.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-firebase-token': token, 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify(Object.assign({ action }, payload || {})),
    });
  } catch (e) { const er = new Error('Could not reach the secure service.'); er.unreachable = true; throw er; }
  try { body = await res.json(); } catch (e) { body = null; }
  if (!body || typeof body.ok !== 'boolean') {              // not our function answering (not deployed yet, or the platform is busy)
    const er = new Error('The secure service is not available.'); er.unreachable = true; er.status = res.status; throw er;
  }
  if (!body.ok) { const er = new Error(body.error || 'The request failed.'); er.code = body.code; er.status = res.status; er.data = body; throw er; }
  return body;
};

// Try the secure service first; only if it is unreachable (and not in strict mode) run the old direct write.
window.apiWrite = async function (action, payload, direct) {
  try { return await window.gApi(action, payload); }
  catch (e) {
    if (e.unreachable && !window.GLUK_API.strict && typeof direct === 'function') { console.warn('[api] service unreachable, using the direct path for', action); return direct(); }
    throw e;
  }
};

// Upload a file to a one-time slot. Uses the storage library when it has the method, else sends the file itself.
window.putToSlot = async function (bucket, slot, file, contentType) {
  const st = supabase.storage.from(bucket);
  if (typeof st.uploadToSignedUrl === 'function') return st.uploadToSignedUrl(slot.path, slot.token, file, { contentType });
  if (!slot.signedUrl) return { error: { message: 'The storage library on this page is too old for secure uploads.' } };
  const fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', file);
  try {
    const res = await fetch(slot.signedUrl, { method: 'PUT', body: fd, headers: { 'x-upsert': 'false' } });
    return res.ok ? { error: null } : { error: { message: 'Upload failed (' + res.status + ')' } };
  } catch (e) { return { error: { message: 'Could not reach storage.' } }; }
};

async function createProfileRecord(rec) {
  const res = await window.apiWrite('profile.create', { profile: rec }, async () => {
    const { data, error } = await supabase.from('profiles').insert([rec]).select();
    if (error) throw error;
    return { profile: data && data[0] };
  });
  return res.profile ? [res.profile] : [];
}
async function updateProfileRecord(id, patch) {
  await window.apiWrite('profile.update', { id, patch }, async () => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) throw error;
    return {};
  });
}
// ══ end Secure API client ═══════════════════════════════════════

// ── Image compress → {blob, preview} ─────────────────
function compressImage(dataUrl, max=700, q=0.72) {
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      let{width:w,height:h}=img;
      if(w>max||h>max){if(w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;}}
      const c=document.createElement('canvas');
      c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
      c.toBlob(blob=>res({blob,preview:c.toDataURL('image/jpeg',q)}),'image/jpeg',q);
    };
    img.src=dataUrl;
  });
}

// ── Upload to Supabase Storage ────────────────────────
// Returns the public CDN URL of the uploaded photo.
// Throws a descriptive Error on any failure so callers can surface it.
async function uploadPhoto(blob, uid, tag) {
  // 1) ask the secure service for a one-time upload slot in this person's own folder
  let slot = null;
  try {
    slot = await window.gApi('upload.sign', { bucket: 'profile-photos', contentType: 'image/jpeg', tag, size: blob.size });
  } catch (e) {
    if (!(e.unreachable && !window.GLUK_API.strict)) throw new Error(`Upload failed: ${e.message}`);
  }
  if (slot) {
    const { error } = await window.putToSlot('profile-photos', slot, blob, 'image/jpeg');
    if (error) throw new Error(`Upload failed: ${error.message || error.error || JSON.stringify(error)}`);
    return slot.publicUrl;
  }

  // 2) service not reachable yet (rollout): the old direct upload
  const path = `${uid}/${Date.now()}_${tag}.jpg`;

  const { data, error } = await supabase.storage
    .from('profile-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    // Supabase storage errors often have a useful .message and .statusCode
    const detail = error.message || error.error || JSON.stringify(error);
    throw new Error(`Upload failed: ${detail}`);
  }
  if (!data?.path) throw new Error('Upload returned no path.');

  const { data: urlData } = supabase.storage
    .from('profile-photos')
    .getPublicUrl(data.path);

  const publicUrl = urlData?.publicUrl;
  if (!publicUrl || typeof publicUrl !== 'string' || publicUrl.length < 10) {
    throw new Error('Could not build public URL for photo.');
  }
  return publicUrl;
}

// ── 4-Photo Slot System ───────────────────────────────
let _photoData=[null,null,null,null];

function _emptySlot(el,idx){
  el.style.position='';
  el.innerHTML=`
    <input type="file" id="ph${idx}" accept="image/*" style="display:none" onchange="handlePhotoSlot(this,${idx})">
    <label for="ph${idx}" style="cursor:pointer;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:5px;width:100%;height:100%;padding:8px">
      <span style="font-size:1.6rem">📷</span>
      <span style="font-size:.6rem;color:var(--gray-400);font-weight:600">Photo ${idx+1}</span>
    </label>`;
}
window.resetPhotoSlots=function(){
  _photoData=[null,null,null,null];
  for(let i=0;i<4;i++){const s=document.getElementById(`photoSlot${i}`);if(s)_emptySlot(s,i);}
};
window.handlePhotoSlot=async function(input,idx){
  const file=input.files[0]; if(!file) return;
  const slot=document.getElementById(`photoSlot${idx}`);
  if(slot) slot.innerHTML=`<div class="sk-block" style="width:100%;height:100%;border-radius:8px;margin:0"></div>`;
  const reader=new FileReader();
  reader.onload=async e=>{
    const{blob,preview}=await compressImage(e.target.result,900,0.82);
    _photoData[idx]={blob,preview};
    if(slot){
      slot.style.position='relative';
      slot.innerHTML=`
        <img src="${preview}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:block">
        <button type="button" onclick="clearPhotoSlot(${idx})"
          style="position:absolute;top:4px;right:4px;background:rgba(7,17,43,.8);color:#fff;
            border:none;border-radius:50%;width:22px;height:22px;font-size:.6rem;
            cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">✕</button>`;
    }
  };
  reader.readAsDataURL(file);
};
window.clearPhotoSlot=function(idx){
  _photoData[idx]=null;
  const s=document.getElementById(`photoSlot${idx}`);
  if(s)_emptySlot(s,idx);
};

// ── Build form options ────────────────────────────────
window.buildFormOptions=function(form){
  const countyEl=form.querySelector('select[name="county"]');
  if(countyEl){
    countyEl.innerHTML=`<option value="">— Select County —</option>`+
      KENYA_COUNTIES.map(c=>`<option value="${c}">${c}</option>`).join('');
  }
  // Also populate current county select (where they are NOW)
  const currCountyEl=form.querySelector('select[name="currentcounty"]');
  if(currCountyEl && currCountyEl !== countyEl){
    currCountyEl.innerHTML=`<option value="">— Select County —</option>`+
      KENYA_COUNTIES.map(c=>`<option value="${c}">${c}</option>`).join('');
  }
  const grid=form.querySelector('.clubs-check-grid');
  if(grid){
    grid.innerHTML=GLUK_CLUBS.map(c=>`
      <label class="club-check-item">
        <input type="checkbox" name="club_cb" value="${c}">
        <span>${c}</span>
      </label>`).join('');
  }
};
window.preCheckClubs=function(form,clubs=[]){
  form.querySelectorAll('input[name="club_cb"]').forEach(cb=>cb.checked=clubs.includes(cb.value));
};
window.preSetCounty=function(form,county){
  const s=form.querySelector('select[name="county"]');
  if(s&&county)s.value=county;
};
function getCheckedClubs(form){
  return Array.from(form.querySelectorAll('input[name="club_cb"]:checked')).map(cb=>cb.value);
}

// ──────────────────────────────────────────────────────
//  PROFILES PAGE
// ──────────────────────────────────────────────────────
// Active filter state (module-level so export can read it)
window._activeFilters = { dept:'', course:'', classYear:'', search:'', club:'', county:'' };

async function initProfilesPage(){
  const dept=Params.get('dept'), course=Params.get('course'), classYear=Params.get('class');
  const mode = Params.get('mode'); // 'alumni' | 'students' | '' (blank = show all)
  const isAlumni   = mode === 'alumni';
  const isStudents = !isAlumni;  // default to students view

  // Lock context filters from URL; course starts as the URL course (user can override via select)
  window._activeFilters = { dept, course, classYear, search:'', club:'', county:'', mode };

  const isAll=!dept&&!course&&!classYear;

  const titleEl=document.getElementById('profilesTitle');
  const subEl=document.getElementById('profilesSubtitle');
  if(isAll){
    if(isAlumni){
      if(titleEl) titleEl.textContent='Alumni Profiles';
      if(subEl)   subEl.textContent='GLUK Graduates';
    } else {
      if(titleEl) titleEl.textContent='All Students';
      if(subEl)   subEl.textContent='GLUK Yearbook';
    }
  } else {
    if(titleEl) titleEl.textContent=classYear?`Class of ${classYear}`:course||dept||'Students';
    if(subEl)   subEl.textContent=[dept,course].filter(Boolean).join(' › ');
  }

  const bc=document.getElementById('breadcrumb');
  if(bc){
    if(isAll && isAlumni){
      bc.innerHTML=`<a href="index.html">Home</a> <span style="opacity:.4">›</span> <span>Alumni Profiles</span>`;
    } else if(isAll){
      bc.innerHTML=`<a href="index.html">Home</a> <span style="opacity:.4">›</span> <span>All Students</span>`;
    } else {
      bc.innerHTML=makeBreadcrumb(dept,course,classYear);
    }
  }

  // Banner
  const banner=document.getElementById('allStudentsBanner');
  const alumBanner=document.getElementById('alumniModeBanner');
  if(isAll && isAlumni){
    if(banner)     banner.style.display='none';
    if(alumBanner) alumBanner.style.display='flex';
  } else if(isAll){
    if(banner)     banner.style.display='flex';
    if(alumBanner) alumBanner.style.display='none';
  }

  // Year chips — current students vs alumni
  const fw=document.getElementById('filterChips');
  const fwLbl=document.getElementById('yearFilterLbl');
  if(fw){
    const renderYearChips = (years) => {
      // keep whichever chip is currently selected (the alumni list arrives a moment after the page)
      const keep = document.querySelector('.chip[data-filtertype="year"].active')?.dataset.year || 'All';
      const activeYr = years.map(String).includes(keep) ? keep : 'All';
      fw.innerHTML = years.map(y =>
        `<button class="chip ${String(y)===activeYr?'active':''}" data-year="${y}" data-filtertype="year"
          onclick="filterYear('${y}',this)">${y==='All'?'All Years':'Class of '+y}</button>`
      ).join('');
    };
    if(isAlumni){
      // Alumni classes appear only once someone has created a profile for that year
      renderYearChips(['All']);
      window.getAlumniYears()
        .then(list => renderYearChips(['All', ...list.map(a => a.year)]))
        .catch(e => console.warn('[alumni year chips]', e));
    } else {
      renderYearChips(['All', ...window.studentClassYears()]);
    }
    if(fwLbl) fwLbl.style.display='block';
  }

  // County + School + Programme + Club compact selects row
  const selRow = document.getElementById('compactFilterRow');
  if (selRow) {

    // ── School / Faculty filter (cascades into Programme) ──
    const schoolSel = document.getElementById('schoolFilterSel');
    const courseSel = document.getElementById('courseFilterSel');

    function rebuildCourseOptions(selectedDept) {
      if (!courseSel) return;
      if (selectedDept && DEPT_COURSES_MAP[selectedDept]) {
        courseSel.innerHTML = `<option value="">All Programmes</option>` +
          DEPT_COURSES_MAP[selectedDept].map(c => `<option value="${c}">${c}</option>`).join('');
      } else {
        courseSel.innerHTML = `<option value="">All Programmes</option>` +
          Object.entries(DEPT_COURSES_MAP).map(([d, courses]) =>
            `<optgroup label="${d}">${courses.map(c =>
              `<option value="${c}">${c}</option>`).join('')}</optgroup>`
          ).join('');
      }
      // Restore URL course pre-selection if it belongs to this dept
      const urlCourse = window._activeFilters.course || '';
      if (urlCourse) { courseSel.value = urlCourse; }
      courseSel.classList.toggle('has-value', !!courseSel.value);
    }

    if (schoolSel) {
      schoolSel.innerHTML = `<option value="">All Schools</option>` +
        Object.keys(DEPT_COURSES_MAP).map(d => `<option value="${d}">${d}</option>`).join('');
      // Pre-select URL dept
      if (dept) { schoolSel.value = dept; schoolSel.classList.add('has-value'); }

      schoolSel.addEventListener('change', () => {
        const v = schoolSel.value;
        window._activeFilters.dept   = v;
        window._activeFilters.course = '';   // clear programme when school changes
        schoolSel.classList.toggle('has-value', !!v);
        rebuildCourseOptions(v);
        if (courseSel) { courseSel.value = ''; courseSel.classList.remove('has-value'); }
        _reloadGrid();
      });
    }

    // ── Programme / Course filter (depends on school) ──────
    rebuildCourseOptions(dept); // initial population
    if (course && courseSel) { courseSel.value = course; courseSel.classList.add('has-value'); }
    if (courseSel) {
      courseSel.addEventListener('change', () => {
        window._activeFilters.course = courseSel.value;
        courseSel.classList.toggle('has-value', !!courseSel.value);
        _reloadGrid();
      });
    }

    // ── County filter ──────────────────────────────────────
    const countySel = document.getElementById('countyFilterSel');
    if (countySel) {
      countySel.innerHTML = `<option value="">All Counties</option>` +
        KENYA_COUNTIES.map(c => `<option value="${c}">${c}</option>`).join('');
      countySel.addEventListener('change', () => {
        window._activeFilters.county = countySel.value;
        countySel.classList.toggle('has-value', !!countySel.value);
        _reloadGrid();
      });
    }

    // ── Club filter ────────────────────────────────────────
    const clubSel = document.getElementById('clubFilterSel');
    if (clubSel) {
      clubSel.innerHTML = `<option value="">All Clubs</option>` +
        GLUK_CLUBS.map(c => `<option value="${c}">${c}</option>`).join('');
      clubSel.addEventListener('change', () => {
        window._activeFilters.club = clubSel.value;
        clubSel.classList.toggle('has-value', !!clubSel.value);
        _reloadGrid();
      });
    }
  }

  showSkeletons('profilesGrid',6);
  await loadProfilesGrid(dept,course,classYear,'','','');

  // Live count banner
  if(isAll){
    const el=document.getElementById('allStudentsCount');
    const countQ = isAlumni
      ? supabase.from('profiles_public').select('id',{count:'exact',head:true}).lte('classyear', String(GRAD_YEAR-1))
      : supabase.from('profiles_public').select('id',{count:'exact',head:true});
    countQ.then(({count})=>{
      if(el) el.textContent=`${count??0} ${isAlumni?'alumni':'student'} profiles in the yearbook`;
    }).catch(()=>{});
  }

  // Search
  const si=document.getElementById('searchInput');
  if(si){
    let dt;
    si.addEventListener('input',()=>{
      clearTimeout(dt);
      dt=setTimeout(()=>{
        window._activeFilters.search = si.value;
        _reloadGrid();
      },280);
    });
  }
}

function _reloadGrid() {
  const ay = document.querySelector('.chip[data-filtertype="year"].active')?.dataset.year || '';
  loadProfilesGrid(
    window._activeFilters.dept   || '',
    window._activeFilters.course || '',
    ay === 'All' ? '' : (ay || window._activeFilters.classYear || ''),
    document.getElementById('searchInput')?.value || '',
    window._activeFilters.club   || '',
    window._activeFilters.county || ''
  );
}

window.filterYear=async function(year,btn){
  document.querySelectorAll('.chip[data-filtertype="year"]').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  const yr = year==='All'?'':year;
  window._activeFilters.classYear = yr;
  showSkeletons('profilesGrid',6);
  _reloadGrid();
};
window.filterClub=async function(club,btn){
  if(btn){
    document.querySelectorAll('.chip[data-filtertype="club"]').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
  }
  window._activeFilters.club = club;
  showSkeletons('profilesGrid',6);
  _reloadGrid();
};

async function loadProfilesGrid(dept,course,classYear,search,clubFilter,countyFilter){
  const grid=document.getElementById('profilesGrid'); if(!grid) return;
  try{
    let query=supabase.from('profiles_public')
      .select('*')
      .order('created_at',{ascending:false});
    if(dept)         query=query.eq('dept',dept);
    if(course)       query=query.eq('course',course);
    if(classYear)    query=query.eq('classyear',classYear);
    if(countyFilter) query=query.eq('county',countyFilter);
    // Only alumni mode applies a range filter — default (All Students) shows everyone
    const _mode = window._activeFilters?.mode;
    if(!classYear && _mode === 'alumni'){
      query = query.lte('classyear', String(GRAD_YEAR - 1));
    }

    const{data,error}=await query;
    if(error) throw error;

    let list = (data || []).map(normalizeProfile);
    if(search){ const s=search.toLowerCase(); list=list.filter(x=>x.name?.toLowerCase().includes(s)||x.reg?.toLowerCase().includes(s)); }
    if(clubFilter){
      // parseList handles JS arrays, Postgres literals {A,B}, and comma-strings
      list=list.filter(x=>{
        const raw=x.clubs;
        if(!raw) return false;
        if(Array.isArray(raw)) return raw.some(c=>c===clubFilter);
        if(typeof raw==='string'){
          const arr=raw.startsWith('{')
            ?raw.slice(1,-1).split(',').map(c=>c.trim().replace(/^"|"$/g,''))
            :raw.split(',').map(c=>c.trim());
          return arr.includes(clubFilter);
        }
        return false;
      });
    }

    const p=new URLSearchParams(window.location.search);
    const deptCtx=dept||p.get('dept')||'';
    const courseCtx=course||p.get('course')||'';

    if(!list.length){
      grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🎓</div><h3>No students yet</h3>
        <p>${search||clubFilter||countyFilter?'Try a different filter.':'Be the first! Tap + to add your profile.'}</p></div>`;
      return;
    }
    grid.innerHTML=list.map(s=>{
      const initials=(s.name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
      const showPhoto = !s.isAnonymous && s.photo_url;
      const ph=showPhoto
        ?`<img src="${esc(window.safeUrl(s.photo_url))}" alt="${esc(s.name)}" loading="lazy" class="profile-img">`
        :`<div class="card-photo-placeholder"><span class="initials">${s.isAnonymous?'🕵️':initials}</span><span class="ph-label">${s.isAnonymous?'ANON':'GLUK'}</span></div>`;
      const link=`profile.html?id=${s.id}&dept=${encodeURIComponent(s.dept||deptCtx)}&course=${encodeURIComponent(s.course||courseCtx)}`;
      return `<a class="profile-card fade-in" href="${link}">
        <div class="card-photo-wrap">${ph}</div>
        <div class="card-body">
          <div class="card-name">${esc(s.name)}</div>
          <div class="card-reg">${s.isAnonymous?'🔒 Anonymous':esc(s.reg)}</div>
          <span class="card-badge">Class of ${s.classYear||'?'}</span>
        </div></a>`;
    }).join('');
    observeImages();
  }catch(err){
    console.error('[loadProfilesGrid]',err);
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">⚠️</div><h3>Could not load profiles</h3>
      <p>${esc(err.message)}</p></div>`;
  }
}

// ── Consent Modal ─────────────────────────────────────
// NOTE: Add this column to Supabase if not present:
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS isAnonymous BOOLEAN DEFAULT FALSE;
window.openConsentModal = function() {
  requireAuth(() => {
    const modal = document.getElementById('consentModal');
    if (!modal) { openAddModal(); return; } // fallback if modal missing
    const cb  = document.getElementById('consentCheckbox');
    const err = document.getElementById('consentError');
    if (cb)  cb.checked = false;
    if (err) err.style.display = 'none';
    updateConsentBtn();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }, 'signup');
};
window.closeConsentModal = function() {
  document.getElementById('consentModal')?.classList.add('hidden');
  document.body.style.overflow = '';
};
window.updateConsentBtn = function() {
  const cb  = document.getElementById('consentCheckbox');
  const btn = document.getElementById('consentAgreeBtn');
  if (cb && btn) { btn.style.opacity = cb.checked ? '1' : '.45'; btn.style.pointerEvents = cb.checked ? '' : 'none'; }
};
window.acceptConsent = function() {
  const cb  = document.getElementById('consentCheckbox');
  const err = document.getElementById('consentError');
  if (!cb?.checked) { if (err) err.style.display = 'block'; return; }
  closeConsentModal();
  openAddModal();
};

// ── Submit anonymous profile ───────────────────────────
window.submitAnonymousProfile = async function() {
  if (!currentUser) { openAuthModal(null, 'login'); return; }
  const form = document.getElementById('addProfileForm');
  if (!form) return;
  const fd        = new FormData(form);
  const name      = (fd.get('name') || '').trim();
  const reg       = (fd.get('reg')  || '').trim();
  const p         = new URLSearchParams(window.location.search);
  // Form value first (student's actual selection), URL as fallback
  const deptVal   = (fd.get('dept')   || p.get('dept')   || '').trim();
  const courseVal = (fd.get('course') || p.get('course') || '').trim();
  const yearVal   = (fd.get('classYear') || p.get('class') || String(GRAD_YEAR)).trim();

  if (!deptVal)   { showToast('Please select your School / Faculty 🏫'); return; }
  if (!courseVal) { showToast('Please select your Programme 📚'); return; }

  if (!name) { showToast('Please enter your name first ✍️'); return; }

  const anonBtn = document.getElementById('anonSubmitBtn');
  if (anonBtn) { anonBtn.disabled = true; anonBtn.textContent = 'Saving…'; }
  try {
    const { data: existing } = await supabase.from('profiles_public').select('id').eq('uid', currentUser.uid).limit(1);
    if (existing && existing.length > 0) {
      showToast('You already have a profile! Edit it instead ✏️');
      setTimeout(() => window.location.href = `profile.html?id=${existing[0].id}`, 800);
      return;
    }
    const inserted = await createProfileRecord({
      uid: currentUser.uid, name, reg, dept: deptVal, course: courseVal,
      classyear: yearVal, isanonymous: true,
    });
    closeAddModal();
    showToast('Anonymous profile saved! 🕵️', 3000);
    if (inserted?.[0]?.id) {
      setTimeout(() => window.location.href = `profile.html?id=${inserted[0].id}&dept=${encodeURIComponent(deptVal)}&course=${encodeURIComponent(courseVal)}`, 1000);
    }
  } catch(err) {
    console.error('[submitAnonymousProfile]', err);
    showToast('❌ Save failed: ' + err.message, 4000);
  } finally {
    if (anonBtn) { anonBtn.disabled = false; anonBtn.textContent = '🕵️  Stay Anonymous'; }
  }
};

// ── Open add modal — redirect to edit if profile exists ─
window.openAddModal=function(){
  requireAuth(async()=>{
    if(currentUser){
      showToast('Checking your profile…');
      try{
        const{data,error}=await supabase
          .from('profiles_public')
          .select('id,dept,course')
          .eq('uid',currentUser.uid)
          .limit(1);
        if(!error && data && data.length>0){
          const existing = data[0];
          // Redirect to their profile so they can edit it
          const link = `profile.html?id=${existing.id}&dept=${encodeURIComponent(existing.dept||'')}&course=${encodeURIComponent(existing.course||'')}`;
          showToast('Taking you to your profile ✏️');
          setTimeout(()=>{ window.location.href = link; }, 800);
          return;
        }
      }catch(e){ console.warn('[openAddModal check]', e); }
    }
    const modal=document.getElementById('addModal');
    const form=document.getElementById('addProfileForm');
    if(!modal||!form) return;
    buildFormOptions(form);
    resetPhotoSlots();
    modal.classList.remove('hidden');
    document.body.style.overflow='hidden';
  },'signup');
};

window.closeAddModal=function(){
  document.getElementById('addModal')?.classList.add('hidden');
  document.body.style.overflow='';
  _photoData=[null,null,null,null];
};

// ══ Notifications (in-app bell) ══════════════════════════════════
// Built from real data every time — there are no notification records to store, fake or clean up:
//   • new comments on MY profile              (Firestore: comments)
//   • replies to comments I wrote             (Firestore: comments.lastReply*)
//   • new posts in clubs I joined             (Supabase: club_posts)
//   • new classmates (same class + course)    (Supabase: profiles)
// "Read" is one timestamp per person: Firestore userState/{uid}.notifSeenAt (this device is the fallback).
window.gNotif = (function () {
  const DAYS = 14, FRESH_MS = 180000, POLL_MS = 300000, MAX = 40;
  let _uid = null, _items = [], _seenAt = 0, _unread = 0, _noProfile = false, _busy = null, _timer = null, _loaded = false;

  const ms = t => {
    try {
      if (!t) return 0;
      if (typeof t.toMillis === 'function') return t.toMillis();
      const v = new Date(t).getTime();
      return Number.isFinite(v) ? v : 0;
    } catch (e) { return 0; }
  };
  const snip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const ckey = () => 'gluk-notif:' + _uid;
  const skey = () => 'gluk-notif-seen:' + _uid;
  const iso  = t => new Date(t).toISOString();

  function readCache() {
    try { const c = JSON.parse(sessionStorage.getItem(ckey()) || 'null'); return (c && Date.now() - c.t < FRESH_MS) ? c : null; }
    catch (e) { return null; }
  }
  function writeCache() {
    try { sessionStorage.setItem(ckey(), JSON.stringify({ t: Date.now(), items: _items, seenAt: _seenAt, noProfile: _noProfile })); } catch (e) {}
  }
  const recount = () => { _unread = _items.filter(it => it.at > _seenAt).length; };

  /* ── where "read" is remembered ── */
  async function loadSeenAt() {
    try {
      const ref = db.collection('userState').doc(_uid);
      const snap = await ref.get();
      const t = snap.exists ? ms(snap.data().notifSeenAt) : 0;
      if (t) return t;
      const now = Date.now();                                    // first visit: start with a clean slate
      ref.set({ notifSeenAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
      try { localStorage.setItem(skey(), String(now)); } catch (e) {}
      return now;
    } catch (e) {                                                // rules not updated yet: remember it on this device instead
      let t = 0;
      try { t = Number(localStorage.getItem(skey())) || 0; } catch (e2) {}
      if (!t) { t = Date.now(); try { localStorage.setItem(skey(), String(t)); } catch (e3) {} }
      return t;
    }
  }

  /* ── sources ── */
  async function myProfile() {
    const { data, error } = await supabase.from('profiles_public').select('id,name,classyear,course,dept,clubs,has_birthday').eq('uid', _uid).limit(1);
    if (error) throw error;
    return data && data[0] ? data[0] : null;
  }

  async function commentsOnMe(p, since) {
    const base = db.collection('comments').where('studentId', '==', String(p.id));
    let docs;
    try { docs = (await base.orderBy('timestamp', 'desc').limit(20).get()).docs; }
    catch (e) { docs = (await base.limit(100).get()).docs; }      // the index is not created yet: read a few and sort here
    return docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.authorUid !== _uid && ms(c.timestamp) >= since)
      .map(c => ({ type: 'comment', key: 'c' + c.id, at: ms(c.timestamp), who: c.authorName, text: c.text, studentId: String(p.id) }));
  }

  async function repliesToMe(since) {
    const base = db.collection('comments').where('authorUid', '==', _uid);
    let docs;
    try { docs = (await base.orderBy('lastReplyAt', 'desc').limit(20).get()).docs; }
    catch (e) { docs = (await base.limit(100).get()).docs; }
    return docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.lastReplyAt && c.lastReplyUid !== _uid && ms(c.lastReplyAt) >= since)
      .map(c => ({ type: 'reply', key: 'r' + c.id, at: ms(c.lastReplyAt), who: c.lastReplyBy, text: c.text, studentId: String(c.studentId || '') }));
  }

  async function clubPosts(p, since) {
    const clubs = window.parseClubField ? window.parseClubField(p.clubs) : [];
    if (!clubs.length) return [];
    const { data, error } = await supabase.from('club_posts')
      .select('id,club_name,type,title,body,author_name,created_by,created_at')
      .in('club_name', clubs).gt('created_at', iso(since)).order('created_at', { ascending: false }).limit(20);
    if (error) return [];
    return (data || []).filter(r => r.created_by !== _uid)
      .map(r => ({ type: 'club', key: 'p' + r.id, at: ms(r.created_at), club: r.club_name, kind: r.type, title: r.title, text: r.body }));
  }

  async function classmates(p, since, seenAt) {
    if (!p.classyear) return [];
    let q = supabase.from('profiles_public').select('created_at').eq('classyear', p.classyear).neq('uid', _uid)
      .gt('created_at', iso(since)).or('isanonymous.is.null,isanonymous.eq.false');
    q = p.course ? q.eq('course', p.course) : (p.dept ? q.eq('dept', p.dept) : q);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(50);
    if (error || !data || !data.length) return [];
    const times = data.map(r => ms(r.created_at));
    return [{ type: 'class', key: 'k', at: times[0], n: times.length, fresh: times.filter(t => t > seenAt).length,
              year: p.classyear, course: p.course || '', dept: p.dept || '' }];
  }

  async function nameTargets(list, p) {
    const own = p ? String(p.id) : '';
    const ids = [...new Set(list.map(x => x.studentId).filter(id => /^\d+$/.test(id) && id !== own))].map(Number);
    let map = {};
    if (ids.length) {
      const { data } = await supabase.from('profiles_public').select('id,name').in('id', ids);
      (data || []).forEach(r => { map[String(r.id)] = r.name; });
    }
    list.forEach(x => { x.target = x.studentId === own ? 'your profile' : (map[x.studentId] ? map[x.studentId] + '’s profile' : 'a profile'); });
  }

  async function compute() {
    const since = Date.now() - DAYS * 864e5;
    const [seenAt, profile] = await Promise.all([loadSeenAt(), myProfile().catch(() => null)]);
    const safe = pr => Promise.resolve(pr).catch(e => { console.warn('[notif]', e); return []; });
    const [c, r, k, m] = await Promise.all([
      profile ? safe(commentsOnMe(profile, since)) : [],
      safe(repliesToMe(since)),
      profile ? safe(clubPosts(profile, since)) : [],
      profile ? safe(classmates(profile, since, seenAt)) : [],
    ]);
    try { await nameTargets(r, profile); } catch (e) { r.forEach(x => { x.target = 'a profile'; }); }
    _seenAt = seenAt;
    _noProfile = !profile;
    // A standing reminder, not a time-bound event — it keeps showing (though not re-badging once seen)
    // until the birthday is actually added, however long that takes.
    const bday = (profile && !profile.has_birthday)
      ? [{ type: 'birthday', key: 'bday-' + profile.id, at: Date.now() + 100 * 365 * 864e5 }] : [];
    _items = [].concat(c, r, k, m, bday).sort((a, b) => b.at - a.at).slice(0, MAX);
    _loaded = true;
    recount(); writeCache();
  }

  /* ── badge + refresh ── */
  function paintBadge() {
    const b = document.getElementById('notifBadge');
    if (b) { b.textContent = _unread > 9 ? '9+' : String(_unread); b.style.display = _unread ? 'flex' : 'none'; }
    const bell = document.getElementById('ubBell');
    if (bell) bell.setAttribute('aria-label', _unread ? 'Notifications, ' + _unread + ' new' : 'Notifications');
  }

  function refresh(force) {
    if (!_uid) return Promise.resolve();
    if (_busy) return _busy;
    if (!force) {
      const c = readCache();
      if (c) { _items = c.items; _seenAt = c.seenAt; _noProfile = c.noProfile; _loaded = true; recount(); paintBadge(); return Promise.resolve(); }
    }
    const uid = _uid;
    _busy = compute().catch(e => console.warn('[notif] could not load', e)).then(() => { _busy = null; if (uid === _uid) paintBadge(); });
    return _busy;
  }

  function stop() {
    _uid = null; _items = []; _unread = 0; _seenAt = 0; _loaded = false;
    if (_timer) { clearInterval(_timer); _timer = null; }
    paintBadge();
  }

  function start(user) {
    if (!user || !document.getElementById('userBar')) { stop(); return; }   // signed out, or a page without the user bar (admin)
    if (_uid !== user.uid) { _uid = user.uid; _items = []; _seenAt = 0; _unread = 0; _loaded = false; }
    refresh(false);
    if (!_timer) _timer = setInterval(() => { if (document.visibilityState !== 'hidden') refresh(true); }, POLL_MS);
  }

  /* ── the panel ── */
  const KIND = { notice: 'New notice', activity: 'New activity', minutes: 'New minutes', photo: 'New photos' };
  function itemHTML(it) {
    const meta = it.type === 'club' && window.clubMeta ? window.clubMeta(it.club) : null;
    let ico, title, sub, href;
    if (it.type === 'comment') {
      ico = '💬'; title = `<b>${esc(it.who || 'Someone')}</b> commented on your profile`; sub = '“' + esc(snip(it.text, 80)) + '”';
      href = 'profile.html?id=' + encodeURIComponent(it.studentId) + '#comments';
    } else if (it.type === 'reply') {
      ico = '↩️'; title = `<b>${esc(it.who || 'Someone')}</b> replied to your comment`; sub = 'on ' + esc(it.target || 'a profile');
      href = 'profile.html?id=' + encodeURIComponent(it.studentId) + '#comments';
    } else if (it.type === 'club') {
      ico = meta ? meta.icon : '🏛'; title = `<b>${esc(it.club)}</b> · ${esc(KIND[it.kind] || 'New post')}`;
      sub = esc(snip(it.title || it.text, 90));
      href = 'club.html?club=' + encodeURIComponent(it.club) + '#feed';
    } else if (it.type === 'birthday') {
      ico = '🎂'; title = `Add your birthday`; sub = 'Let classmates celebrate with you — it only takes a second.';
      href = 'profile.html?id=' + encodeURIComponent(it.key.replace('bday-', '')) + '#edit';
    } else {
      ico = '👥'; title = `<b>${it.n}</b> new ${it.n === 1 ? 'classmate' : 'classmates'} joined`;
      sub = 'Class of ' + esc(it.year) + (it.course ? ' · ' + esc(it.course) : '');
      href = 'profiles.html?dept=' + encodeURIComponent(it.dept) + '&course=' + encodeURIComponent(it.course) + '&class=' + encodeURIComponent(it.year);
    }
    const unread = it.at > _seenAt;
    return `<a class="notif-item${unread ? ' unread' : ''}" href="${esc(href)}">
      <span class="notif-ico">${ico}</span>
      <span class="notif-main"><span class="notif-t">${title}</span>${sub ? `<span class="notif-s">${sub}</span>` : ''}</span>
      <span class="notif-when">${esc(ago(it.at))}</span></a>`;
  }
  function panelHTML() {
    if (!_items.length) {
      return _noProfile
        ? `<div class="notif-empty"><div class="notif-empty-ico">🔔</div><b>Create your profile to get notifications</b>Comments, club posts and new classmates show up here once you have a yearbook profile.<br><a class="btn-primary" href="profiles.html?action=add" style="display:block;max-width:220px;margin:14px auto 0;text-decoration:none;text-align:center">Create my profile</a></div>`
        : `<div class="notif-empty"><div class="notif-empty-ico">🎉</div><b>You’re all caught up</b>Comments, replies, club posts and new classmates will appear here.</div>`;
    }
    return `<div class="notif-list">${_items.map(itemHTML).join('')}</div>`;
  }
  function ensurePanel() {
    let ov = document.getElementById('notifOv');
    if (ov && ov.__ready) return ov;
    ov = document.createElement('div');
    ov.id = 'notifOv'; ov.className = 'notif-ov'; ov.__ready = true;
    ov.innerHTML = `<div class="notif-sheet" role="dialog" aria-modal="true" aria-label="Notifications">
      <div class="modal-handle"></div>
      <div class="notif-head"><div class="notif-title">Notifications</div><button type="button" class="notif-x" id="notifClose" aria-label="Close">✕</button></div>
      <div id="notifBody"></div></div>`;
    document.documentElement.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov || (e.target.closest && e.target.closest('#notifClose'))) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    return ov;
  }
  function markSeen() {
    if (!_uid || !_unread) return;
    _seenAt = Date.now(); _unread = 0; paintBadge(); writeCache();
    try { localStorage.setItem(skey(), String(_seenAt)); } catch (e) {}
    db.collection('userState').doc(_uid).set({ notifSeenAt: firebase.firestore.FieldValue.serverTimestamp() })
      .catch(e => console.warn('[notif] could not save read state', e));
  }
  async function open() {
    if (!currentUser) { openAuthModal(null, 'login'); return; }
    const ov = ensurePanel(), body = document.getElementById('notifBody');
    body.innerHTML = _loaded ? panelHTML() : '<div class="notif-empty">Loading…</div>';
    ov.classList.add('notif-open'); document.documentElement.style.overflow = 'hidden';
    await refresh(true);
    body.innerHTML = panelHTML();          // unread items stay highlighted while the panel is open …
    markSeen();                            // … and count as read from now on
  }
  function close() {
    const ov = document.getElementById('notifOv');
    if (ov) ov.classList.remove('notif-open');
    document.documentElement.style.overflow = '';
  }

  // Notification links to a profile's comments jump straight to them
  if (location.hash === '#comments') {
    const jump = () => { const el = document.getElementById('commentsCard'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    setTimeout(jump, 900); setTimeout(jump, 2200);
  }

  return { start, stop, refresh, open, close, paintBadge };
})();
window.openNotifications = () => window.gNotif.open();

// ── My Profile shortcut (top-bar icon on the students page) ───
// Signed out  -> opens the sign-in box, then continues automatically
// Has profile -> jumps straight to it
// No profile  -> starts the create-profile flow (consent -> form)
window.goToMyProfile = function () {
  requireAuth(async () => {
    // The admin's "profile" is the admin panel
    if (typeof ADMIN_EMAIL !== 'undefined' && currentUser &&
        String(currentUser.email || '').toLowerCase() === String(ADMIN_EMAIL).toLowerCase()) {
      window.location.href = 'admin.html';
      return;
    }
    showToast('Finding your profile…');
    try {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('id,dept,course')
        .eq('uid', currentUser.uid)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        const p = data[0];
        window.location.href = `profile.html?id=${p.id}&dept=${encodeURIComponent(p.dept || '')}&course=${encodeURIComponent(p.course || '')}`;
      } else {
        showToast('No profile yet - let\'s create yours 🎓');
        openConsentModal();
      }
    } catch (e) {
      console.warn('[goToMyProfile]', e);
      showToast('Could not check your profile. Please try again.');
    }
  }, 'login');
};

// ── Submit new profile ────────────────────────────────
window.submitProfile=async function(e){
  e.preventDefault();
  if(!currentUser){openAuthModal(null,'signup');return;}
  const form=document.getElementById('addProfileForm');
  const fd=new FormData(form);
  const p=new URLSearchParams(window.location.search);
  const btn=form.querySelector('button[type=submit]');

  // Validate required fields
  const name=(fd.get('name')||'').trim();
  const reg=(fd.get('reg')||'').trim();
  if(!name){ showToast('Please enter your full name ✍️'); btn?.focus(); return; }
  if(!reg)  { showToast('Please enter your reg number 📋'); return; }

  // Form value first — student's actual selection wins over URL context
  const deptVal  = (fd.get('dept')  || p.get('dept')  || '').trim();
  const courseVal= (fd.get('course')|| p.get('course')|| '').trim();
  const yearVal  = (fd.get('classYear') || p.get('class') || String(GRAD_YEAR)).trim();

  // ── Require dept + course so the student appears in the right section ──
  // Without these, the profile saves with blank dept/course and only ever
  // appears in "All Students" — never in the dept/course/year filtered views.
  if (!deptVal) {
    showToast('Please select your School / Faculty 🏫');
    btn && (btn.disabled = false);
    // Scroll to the dept field so the user sees it
    document.getElementById('f-dept')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (!courseVal) {
    showToast('Please select your Programme 📚');
    btn && (btn.disabled = false);
    document.getElementById('f-course')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if(btn){btn.disabled=true;btn.textContent='📸 Uploading photos…';}

  // Show a progress indicator in the grid while we wait
  const grid=document.getElementById('profilesGrid');
  if(grid){
    const saving=document.createElement('div');
    saving.id='savingIndicator';
    saving.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--navy);color:#fff;padding:12px 22px;border-radius:50px;font-size:.8rem;font-weight:600;z-index:9999;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,.3)';
    saving.innerHTML='<span style="animation:spin .7s linear infinite;display:inline-block">⏳</span> Saving your profile…';
    document.body.appendChild(saving);
  }

  try{
    const uid=currentUser.uid;

    // Double-check no existing profile (in case user was fast)
    const{data:existing}=await supabase.from('profiles_public').select('id').eq('uid',uid).limit(1);
    if(existing && existing.length>0){
      closeAddModal();
      showToast('You already have a profile! Redirecting… ✏️');
      setTimeout(()=>{ window.location.href=`profile.html?id=${existing[0].id}`; },800);
      return;
    }

    // Upload photos — one at a time, with per-slot feedback
    const photoUrls = [];
    const filledSlots = _photoData.filter(Boolean).length;

    for (let i = 0; i < 4; i++) {
      if (!_photoData[i]) continue;
      const slot = document.getElementById(`photoSlot${i}`);
      // Show uploading spinner on the slot
      if (slot) slot.innerHTML = `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:6px;background:var(--off-white)">
          <span style="font-size:1.4rem;animation:spin .7s linear infinite;display:inline-block">⏳</span>
          <span style="font-size:.6rem;color:var(--gray-400);font-weight:600">Uploading…</span>
        </div>`;
      if (btn) btn.textContent = `📸 Uploading photo ${photoUrls.length + 1} of ${filledSlots}…`;
      try {
        const url = await uploadPhoto(_photoData[i].blob, uid, i);
        photoUrls.push(url);
        // Show green tick on slot
        if (slot) slot.innerHTML = `
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
            background:var(--off-white);border-radius:8px">
            <span style="font-size:2rem">✅</span>
          </div>`;
      } catch (er) {
        console.error(`[Photo slot ${i}]`, er);
        // Show red X on slot so user can see which one failed
        if (slot) slot.innerHTML = `
          <div style="width:100%;height:100%;display:flex;flex-direction:column;
            align-items:center;justify-content:center;gap:4px;background:#fef2f2;border-radius:8px">
            <span style="font-size:1.4rem">❌</span>
            <span style="font-size:.58rem;color:#dc2626;font-weight:700;text-align:center;padding:0 4px">${er.message}</span>
          </div>`;
        showToast(`⚠️ Photo ${i + 1} failed: ${er.message}`, 5000);
      }
    }

    // If user picked photos but ALL uploads failed — stop here so profile
    // isn't saved with photo_url:null when the user clearly wanted photos
    if (filledSlots > 0 && photoUrls.length === 0) {
      showToast('❌ All photo uploads failed. Check Supabase storage bucket is public.', 6000);
      if (btn) { btn.disabled = false; btn.textContent = '✓  Save My Profile'; }
      document.getElementById('savingIndicator')?.remove();
      return;
    }

    if (btn) btn.textContent = '💾 Saving profile…';

    const profile={
      uid,
      name,
      reg,
      dept:          deptVal,
      course:        courseVal,
      classyear:     yearVal,
      county:        fd.get('county')||'',
      constituency:  (fd.get('constituency')||'').trim(),
      currentcounty:   (fd.get('currentcounty')||'').trim(),
      currentlocation: (fd.get('currentlocation')||'').trim(),
      whatsapp:      window.normalizePhone(fd.get('whatsapp')),
      birthday:      window.birthdayFromInput(fd.get('birthday')),
      email:         (fd.get('email')||currentUser.email||'').trim(),
      bio:           (fd.get('bio')||'').trim(),
      hobbies:       (fd.get('hobbies')||'').split(',').map(x=>x.trim()).filter(Boolean).join(', '),
      clubs:         getCheckedClubs(form),
      bestmemory:    (fd.get('bestMemory')||'').trim(),
      biggestlesson: (fd.get('biggestLesson')||'').trim(),
      mostlikelyto:  (fd.get('mostLikelyTo')||'').trim(),
      whatareyouto:  (fd.get('whatareyouto')||'').trim(),
      photo_url:     photoUrls[0]||null,
      photos:        photoUrls,
    };

    const inserted = await createProfileRecord(profile);

    // Close modal and reset form FIRST
    closeAddModal();
    form.reset();
    resetPhotoSlots();

    // Show success
    showToast('Profile saved! 🎉 Welcome to the yearbook!', 3500);

    // Navigate to their new profile if we got the ID back
    if(inserted && inserted.length>0){
      const newId=inserted[0].id;
      setTimeout(()=>{
        window.location.href=`profile.html?id=${newId}&dept=${encodeURIComponent(deptVal)}&course=${encodeURIComponent(courseVal)}`;
      }, 1200);
    } else {
      // Fallback: reload the grid to show the new profile
      await loadProfilesGrid(deptVal,courseVal,yearVal,'','','');
    }
  }catch(err){
    console.error('[submitProfile]',err);
    let msg = err.message||'Unknown error';
    if(msg.includes('duplicate')||msg.includes('unique')) msg = 'You already have a profile! Try editing it instead.';
    showToast('❌ Save failed: '+msg, 4000);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='✓  Save Profile';}
    document.getElementById('savingIndicator')?.remove();
  }
};

// ──────────────────────────────────────────────────────
//  PROFILE DETAIL PAGE
// ──────────────────────────────────────────────────────
let _currentProfile=null;

// Contact details and birthday are not in the public view, so they come from the secure
// service: signed-in visitors get a classmate's contact details, the owner gets everything.
let _privateFor=null;                                   // "uid:id" the private fields were loaded for
async function loadPrivateFields(){
  const p=_currentProfile, user=auth&&auth.currentUser;
  if(!p||!user) return false;
  const key=user.uid+':'+p.id;
  if(_privateFor===key) return true;
  try{
    const r=await window.gApi('profile.private',{id:p.id});
    if(_currentProfile!==p) return false;               // the page moved on meanwhile
    _currentProfile=normalizeProfile({...p,...(r.profile||{})});
    _privateFor=key;
    paintProfile(_currentProfile);
    return true;
  }catch(e){ console.warn('[profile.private]',e); return false; }
}

function initProfilePage(){
  const id=Params.get('id'); if(!id){window.location.href='profiles.html';return;}
  supabase.from('profiles_public').select('*').eq('id',id).single()
    .then(({data,error})=>{
      if(error||!data){
        console.error(error);
        showToast('Profile not found.');
        setTimeout(()=>window.location.href='profiles.html',1500);
        return;
      }
      _currentProfile = normalizeProfile(data);
      paintProfile(_currentProfile);
      auth.onAuthStateChanged(()=>loadPrivateFields());   // runs now, and again after signing in
      startComments(id);
      // Show edit button to profile owner — check immediately + on auth change
      function _refreshEditBtn(user){
        const btn=document.getElementById('editProfileBtn');
        if(btn) btn.style.display=(user&&user.uid===data.uid)?'flex':'none';
      }
      _refreshEditBtn(currentUser); // check immediately (auth may already be resolved)
      auth.onAuthStateChanged(_refreshEditBtn); // also watch for sign-in/out
      // A notification (e.g. "add your birthday") can link straight to the edit form — opens once only
      if (location.hash === '#edit') {
        let _editOpened = false;
        const tryOpen = u => { if (!_editOpened && u && u.uid === data.uid) { _editOpened = true; window.openEditMyProfile(); } };
        tryOpen(currentUser);
        auth.onAuthStateChanged(tryOpen);
      }
    })
    .catch(err=>{console.error(err);showToast('Could not load profile.');});
}

function paintProfile(s){
  const initials=(s.name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  const isAnon = !!s.isAnonymous;

  // ── Resolve photo list robustly ──────────────────────
  const photoList    = isAnon ? [] : normalizePhotos(s.photos, s.photo_url);
  const primaryPhoto = photoList[0] || null;

  const av=document.getElementById('profileAvatar');
  if(av){
    if(primaryPhoto){
      const img=document.createElement('img');
      img.alt=s.name||'';
      img.style.cssText='width:100%;height:100%;border-radius:50%;object-fit:cover;display:block';
      img.onerror=()=>{ av.innerHTML=`<div class="avatar-inner">${initials}</div>`; };
      img.src=primaryPhoto;
      av.innerHTML=''; av.appendChild(img);
    } else {
      av.innerHTML=`<div class="avatar-inner">${isAnon?'🕵️':initials}</div>`;
    }
  }

  const tx=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v||'---';};
  tx('profileName',  s.name);
  tx('profileReg',   isAnon ? '🔒 Anonymous' : s.reg);
  tx('profileDept',  s.dept&&s.course?`${s.dept} — ${s.course}`:(s.dept||s.course||'GLUK Student'));

  // Anonymous: hide private sections, show privacy note
  const privateIds = ['profileCounty','profileConst','profileEmail'];
  privateIds.forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=isAnon?'🔒 Hidden':'---'; });
  if(!isAnon){
    // Contact details only reach the page for signed-in visitors (see loadPrivateFields)
    const signIn = (auth && auth.currentUser) ? '' : '🔒 Sign in to see';
    tx('profileCounty',s.county);
    tx('profileConst', s.constituency || signIn);
    tx('profileEmail', s.email || signIn);
  }
  tx('profileBio',   isAnon?'This student chose to keep their profile private.':s.bio);
  tx('profileMemory',isAnon?'🔒 Private':s.bestMemory);
  tx('profileLesson',isAnon?'🔒 Private':s.biggestLesson);
  tx('profileLikely',isAnon?'🔒 Private':s.mostLikelyTo);

  // ── Where Are You Right Now? (current location) ───
  const currCard = document.getElementById('currentLocationCard');
  const currEl   = document.getElementById('profileCurrentLocation');
  const currWork = document.getElementById('profileCurrentWork');
  if (!isAnon && (s.currentlocation || s.currentcounty || s.whatareyouto)) {
    if (currCard) currCard.style.display = 'block';
    if (currEl) {
      const parts = [s.currentlocation, s.currentcounty ? s.currentcounty + ' County' : ''].filter(Boolean);
      currEl.textContent = parts.join(', ') || '—';
    }
    if (currWork) currWork.textContent = s.whatareyouto || '';
  } else {
    if (currCard) currCard.style.display = 'none';
  }

  // ── Home origin display ───────────────────────────
  const homeDisplay = document.getElementById('profileCountyDisplay');
  if (homeDisplay && s.county) {
    homeDisplay.textContent = `🏠 ${s.county}${s.constituency ? ', ' + s.constituency : ''}`;
  }

  // Legacy What Are You Up To card (kept for back-compat, hidden if new card shows)
  const wauCard = document.getElementById('whatUpToCard');
  if (wauCard) wauCard.style.display = 'none'; // superseded by currentLocationCard

  // Show anonymous badge on dept span
  const deptBadge = document.getElementById('profileDept');
  if(deptBadge && isAnon && !document.getElementById('anonBadge')){
    deptBadge.insertAdjacentHTML('afterend','<span id="anonBadge" style="display:inline-block;background:rgba(100,100,100,.15);color:#666;font-size:.65rem;padding:2px 8px;border-radius:20px;margin-left:6px">🕵️ Anonymous</span>');
  }

  document.title = `${s.name||'Profile'} — GLUK Yearbook ${GRAD_YEAR}`;

  paintWhatsappButtons(s, isAnon);
  const em=document.getElementById('emailBtn');
  if(em){ const ok=!isAnon&&s.email; if(ok) em.href=`mailto:${s.email}`; em.style.display=ok?'':'none'; }

  const hEl=document.getElementById('profileHobbies');
  if(hEl){ if(isAnon){ hEl.innerHTML=`<span style="font-size:.8rem;color:var(--gray-400)">🔒 Private</span>`; } else { const h=parseList(s.hobbies);hEl.innerHTML=h.length?h.map(x=>`<span class="pill">${esc(x)}</span>`).join(''):`<span style="font-size:.8rem;color:var(--gray-400)">No hobbies listed</span>`; } }
  const cEl=document.getElementById('profileClubs');
  if(cEl){ if(isAnon){ cEl.innerHTML=`<span style="font-size:.8rem;color:var(--gray-400)">🔒 Private</span>`; } else { const c=parseList(s.clubs);cEl.innerHTML=c.length?c.map(x=>`<span class="pill club">${esc(x)}</span>`).join(''):`<span style="font-size:.8rem;color:var(--gray-400)">No clubs listed</span>`; } }

  initCarousel(photoList);

}

// Both "chat on WhatsApp" buttons on a profile: hidden when there is no usable number.
function paintWhatsappButtons(s, isAnon) {
  const wa = document.getElementById('whatsappBtn'), waS = document.getElementById('waShareBtn');
  const link = (!isAnon && s.whatsapp) ? window.waLink(s.whatsapp) : '';
  const href = link ? `${link}?text=Hi%20${encodeURIComponent(s.name || '')}%2C%20I%20saw%20your%20GLUK%20Yearbook%20profile!` : '';
  if (wa)  { if (href) wa.href = href;  wa.style.display  = href ? '' : 'none'; }
  if (waS) { if (href) waS.href = href; waS.style.display = href ? '' : 'none'; }
}

// ── Edit own profile ──────────────────────────────────
window.openEditMyProfile=async function(){
  if(!_currentProfile) return;
  const form=document.getElementById('editMyForm');
  const modal=document.getElementById('editMyModal');
  if(!form||!modal){ showToast('Edit form not found'); return; }
  // Without the private fields the form would save blank WhatsApp/email/birthday over the real ones
  if(!(await loadPrivateFields())){ showToast('Could not load your details. Check your connection and try again.', 4000); return; }
  buildFormOptions(form);
  const s=_currentProfile;
  const q=n=>form.querySelector(`[name="${n}"]`);
  if(q('name'))            q('name').value=s.name||'';
  if(q('reg'))             q('reg').value=s.reg||'';
  if(q('whatsapp'))        q('whatsapp').value=window.normalizePhone(s.whatsapp);   // old numbers show (and get saved) in +254 form
  if(q('birthday'))        q('birthday').value=window.birthdayToInput(s.birthday);
  if(q('email'))           q('email').value=s.email||'';
  if(q('constituency'))    q('constituency').value=s.constituency||'';
  if(q('currentlocation')) q('currentlocation').value=s.currentlocation||'';
  if(q('bio'))             q('bio').value=s.bio||'';
  if(q('hobbies'))         q('hobbies').value=parseList(s.hobbies).join(', ');
  if(q('bestMemory'))      q('bestMemory').value=s.bestMemory||'';
  if(q('biggestLesson'))   q('biggestLesson').value=s.biggestLesson||'';
  if(q('mostLikelyTo'))    q('mostLikelyTo').value=s.mostLikelyTo||'';
  if(q('whatareyouto'))    q('whatareyouto').value=s.whatareyouto||'';
  preSetCounty(form,s.county||'');
  // Pre-set current county select (separate from home county)
  const ccSel = form.querySelector('select[name="currentcounty"]');
  if(ccSel) ccSel.value = s.currentcounty||'';
  preCheckClubs(form,parseList(s.clubs));
  const curPhotos = document.getElementById('editCurrentPhotos');
  if (curPhotos) {
    const ph = normalizePhotos(s.photos, s.photo_url);
    curPhotos.innerHTML = ph.length
      ? ph.map((u, i) => `
          <div style="position:relative;display:inline-block">
            <img src="${esc(window.safeUrl(u))}" style="width:60px;height:60px;object-fit:cover;border-radius:10px;
              border:2px solid ${i === 0 ? 'var(--gold)' : 'var(--gray-200)'}">
            ${i === 0 ? '<span style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);background:var(--gold);color:var(--navy);font-size:.5rem;font-weight:900;padding:1px 6px;border-radius:20px;white-space:nowrap">Profile</span>' : ''}
          </div>`).join('')
      : `<span style="font-size:.72rem;color:var(--gray-400)">No photos yet</span>`;
  }
  resetPhotoSlots();
  modal.classList.remove('hidden');
  document.body.style.overflow='hidden';
};

window.closeEditMyModal=function(){
  document.getElementById('editMyModal')?.classList.add('hidden');
  document.body.style.overflow='';
  _photoData=[null,null,null,null];
};

window.saveMyProfile=async function(e){
  e.preventDefault();
  if(!currentUser||!_currentProfile) return;
  if(currentUser.uid!==_currentProfile.uid){showToast('Not authorised');return;}
  const form=document.getElementById('editMyForm');
  const fd=new FormData(form);
  const btn=form.querySelector('button[type=submit]');
  if(btn){btn.disabled=true;btn.textContent='Uploading…';}
  try{
    const uid=currentUser.uid;
    // Keep existing photos unless user picked new ones
    const existingPhotos = normalizePhotos(_currentProfile.photos, _currentProfile.photo_url);
    let photoUrls = [...existingPhotos];

    if (_photoData.some(Boolean)) {
      if (btn) btn.textContent = '📸 Uploading photos…';
      const uploaded = [];
      const filledSlots = _photoData.filter(Boolean).length;

      for (let i = 0; i < 4; i++) {
        if (!_photoData[i]) continue;
        const slot = document.getElementById(`photoSlot${i}`);
        if (slot) slot.innerHTML = `
          <div style="width:100%;height:100%;display:flex;flex-direction:column;
            align-items:center;justify-content:center;gap:6px;background:var(--off-white)">
            <span style="font-size:1.4rem;animation:spin .7s linear infinite;display:inline-block">⏳</span>
            <span style="font-size:.6rem;color:var(--gray-400);font-weight:600">Uploading…</span>
          </div>`;
        if (btn) btn.textContent = `📸 Uploading photo ${uploaded.length + 1} of ${filledSlots}…`;
        try {
          const url = await uploadPhoto(_photoData[i].blob, uid, `edit_${Date.now()}_${i}`);
          uploaded.push(url);
          if (slot) slot.innerHTML = `
            <div style="width:100%;height:100%;display:flex;align-items:center;
              justify-content:center;background:var(--off-white);border-radius:8px">
              <span style="font-size:2rem">✅</span>
            </div>`;
        } catch (er) {
          console.error(`[Edit photo ${i}]`, er);
          if (slot) slot.innerHTML = `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;
              align-items:center;justify-content:center;gap:4px;background:#fef2f2;border-radius:8px">
              <span style="font-size:1.4rem">❌</span>
              <span style="font-size:.58rem;color:#dc2626;font-weight:700;text-align:center;padding:0 4px">${er.message}</span>
            </div>`;
          showToast(`⚠️ Photo ${i + 1} failed: ${er.message}`, 5000);
        }
      }

      if (uploaded.length > 0) {
        // New uploads replace existing ones
        photoUrls = uploaded;
      } else if (filledSlots > 0) {
        showToast('⚠️ All uploads failed — keeping existing photos.', 5000);
        // photoUrls stays as existingPhotos
      }
    }

    if (btn) btn.textContent = '💾 Saving…';
    const update={
      name:          (fd.get('name')||'').trim(),
      reg:           (fd.get('reg')||'').trim(),
      whatsapp:      window.normalizePhone(fd.get('whatsapp')),
      birthday:      window.birthdayFromInput(fd.get('birthday')),
      email:         (fd.get('email')||'').trim(),
      county:        fd.get('county')||'',
      constituency:  (fd.get('constituency')||'').trim(),
      currentcounty:    (fd.get('currentcounty')||'').trim(),
      currentlocation:  (fd.get('currentlocation')||'').trim(),
      bio:           (fd.get('bio')||'').trim(),
      hobbies:       (fd.get('hobbies')||'').split(',').map(x=>x.trim()).filter(Boolean).join(', '),
      clubs:         getCheckedClubs(form),
      bestmemory:    (fd.get('bestMemory')||'').trim(),
      biggestlesson: (fd.get('biggestLesson')||'').trim(),
      mostlikelyto:  (fd.get('mostLikelyTo')||'').trim(),
      whatareyouto:  (fd.get('whatareyouto')||'').trim(),
      photo_url:     photoUrls[0] || null,
      photos:        photoUrls,
      updated_at:    new Date().toISOString(),
    };
    await updateProfileRecord(_currentProfile.id, update);

    closeEditMyModal();
    showToast('Profile updated! ✅', 3000);

    // Re-fetch from DB so profile photo + carousel reflect the ACTUAL saved state
    const { data: refreshed } = await supabase
      .from('profiles_public').select('*').eq('id', _currentProfile.id).single();
    if (refreshed) {
      _currentProfile = normalizeProfile(refreshed);
      _privateFor = null;
      paintProfile(_currentProfile);
      loadPrivateFields();
    } else {
      // Fallback: paint from the in-memory merged object
      _currentProfile = { ..._currentProfile, ...update };
      paintProfile(_currentProfile);
    }
  }catch(err){
    console.error('[saveMyProfile]',err);
    showToast('❌ Update failed: '+err.message, 4000);
  }
  finally{if(btn){btn.disabled=false;btn.textContent='💾 Save Changes';}}
};

// ── Carousel ──────────────────────────────────────────
let cIdx=0;
function initCarousel(photos){
  const track=document.getElementById('carouselTrack');
  const dots=document.getElementById('carouselDots');
  if(!track) return;
  const placeholders=[
    {icon:'📸',label:'Photo 1'},{icon:'🌅',label:'Photo 2'},
    {icon:'🎓',label:'Photo 3'},{icon:'🏫',label:'Photo 4'},
  ];
  const slides=photos.length
    ?photos.slice(0,4).map((src,si)=>{
      const ph=placeholders[si]||placeholders[0];
      return `<div class="carousel-slide"><img src="${esc(window.safeUrl(src))}" alt="Photo ${si+1}" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<div class=&quot;slide-placeholder&quot;><span>${ph.icon}</span></div>'"></div>`;
    })
    :placeholders.map(p=>`<div class="carousel-slide"><div class="slide-placeholder"><span>${p.icon}</span><span style="font-size:.75rem;margin-top:8px;color:rgba(255,255,255,.5)">${p.label}</span></div></div>`);
  track.innerHTML=slides.join('');
  if(dots) dots.innerHTML=slides.map((_,i)=>`<div class="c-dot ${i===0?'active':''}" onclick="goSlide(${i})"></div>`).join('');
  cIdx=0; updateCarousel();
}
window.goSlide=i=>{const t=document.getElementById('carouselTrack');const n=t?.children.length||0;cIdx=((i%n)+n)%n;updateCarousel();};
window.prevSlide=()=>goSlide(cIdx-1);
window.nextSlide=()=>goSlide(cIdx+1);
function updateCarousel(){
  const t=document.getElementById('carouselTrack');
  if(t) t.style.transform=`translateX(-${cIdx*100}%)`;
  document.querySelectorAll('.c-dot').forEach((d,i)=>d.classList.toggle('active',i===cIdx));
}
let txStart=0;
document.addEventListener('touchstart',e=>{if(e.target.closest('.carousel-wrap'))txStart=e.touches[0].clientX;},{passive:true});
document.addEventListener('touchend',e=>{if(!e.target.closest('.carousel-wrap'))return;const diff=txStart-e.changedTouches[0].clientX;if(Math.abs(diff)>40)diff>0?nextSlide():prevSlide();});

// ── Comments + Replies ────────────────────────────────
let _unsub = null;

function sortComments(docs) {
  return docs.slice().sort((a, b) => {
    const ta = a.timestamp?.seconds ?? a.timestamp?.toDate?.()?.getTime()/1000 ?? 0;
    const tb = b.timestamp?.seconds ?? b.timestamp?.toDate?.()?.getTime()/1000 ?? 0;
    return ta - tb;
  });
}

function startComments(profileId) {
  if (_unsub) _unsub();
  const box = document.getElementById('commentsContainer'); if (!box) return;
  box.innerHTML = `<div class="sk-block" style="height:60px;border-radius:10px;margin-bottom:10px"></div><div class="sk-block" style="height:60px;border-radius:10px"></div>`;
  const q = db.collection('comments').where('studentId', '==', String(profileId));
  try {
    _unsub = q.onSnapshot(
      snap => paintComments(sortComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))), profileId),
      err  => {
        console.warn('[Comments onSnapshot]', err.code, err.message);
        db.collection('comments').where('studentId', '==', String(profileId)).get()
          .then(snap => paintComments(sortComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))), profileId))
          .catch(e2 => {
            console.error('[Comments get]', e2.code, e2.message);
            if (box) box.innerHTML = `<p style="text-align:center;color:#8a97b8;font-size:.8rem;padding:20px">Comments unavailable.<br><small>(${esc(e2.code || 'unknown error')})</small></p>`;
          });
      }
    );
  } catch(e) { console.warn('[Comments try/catch]', e); if (box) box.innerHTML = ''; }
}

function paintComments(list, profileId) {
  const box = document.getElementById('commentsContainer');
  const cnt = document.getElementById('commentCount');
  if (!box) return;
  if (cnt) cnt.textContent = list.length;
  if (!list.length) {
    box.innerHTML = `<div class="empty-state" style="padding:24px 0"><div class="empty-icon" style="font-size:2rem">💬</div><h3 style="font-size:.875rem">No comments yet</h3><p>Be the first to leave a memory!</p></div>`;
    return;
  }
  box.innerHTML = list.map(c => {
    const initials = (c.authorName || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const ts = c.timestamp?.toDate ? c.timestamp.toDate().getTime() : (c.timestamp || 0);
    const liked = c.likedBy?.includes(currentUser?.uid);
    const rc = c.replyCount || 0;
    const safeAuthor = esc(c.authorName || 'Anonymous');
    return `<div class="comment-item" id="ci-${c.id}">
      <div class="avatar-sm">${initials}</div>
      <div class="comment-bubble">
        <div><span class="comment-user">${safeAuthor}</span><span class="comment-time">${ago(ts)}</span></div>
        <div class="comment-text">${esc(c.text)}</div>
        <div class="comment-actions">
          <button class="comment-action-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${c.id}','${profileId}')">
            ${liked ? '❤️' : '🤍'} ${c.likes || 0}
          </button>
          <button class="comment-action-btn reply-btn" onclick="openReplyInput('${c.id}','${safeAuthor}','${profileId}')">
            💬 Reply
          </button>
        </div>
        <div class="reply-input-area hidden" id="ria-${c.id}">
          <div class="reply-input-wrap">
            <div class="avatar-sm avatar-xs" id="replyAv-${c.id}">?</div>
            <input class="reply-input" id="replyInput-${c.id}"
              placeholder="Reply to ${safeAuthor}…" maxlength="144"
              onkeydown="handleReplyKey(event,'${c.id}','${profileId}')">
            <button class="comment-send-btn reply-send" onclick="submitReply('${c.id}','${profileId}')">➤</button>
          </div>
        </div>
        ${rc > 0 ? `<button class="view-replies-btn" id="vrb-${c.id}" onclick="toggleReplies('${c.id}')">
          <span class="vr-line"></span>
          <span class="vr-text"><span class="vr-chevron" id="vrc-${c.id}">▶</span> View ${rc} repl${rc === 1 ? 'y' : 'ies'}</span>
        </button>` : `<span id="vrb-${c.id}"></span>`}
        <div class="replies-container hidden" id="rc-${c.id}"></div>
      </div>
    </div>`;
  }).join('');
  if (currentUser) {
    const init = (currentUser.displayName || currentUser.email)[0].toUpperCase();
    document.querySelectorAll('[id^="replyAv-"]').forEach(el => el.textContent = init);
  }
}

window.submitComment = async function() {
  requireAuth(async () => {
    const input = document.getElementById('commentInput');
    const id = Params.get('id');
    const text = input?.value.trim();
    if (!text || !id) return;
    if (text.length > 144) { showToast('Max 144 characters ✂️'); return; }
    const authorName = currentUser.displayName || currentUser.email.split('@')[0];
    // Use the specific main comment send button, not .comment-send-btn which also matches reply buttons
    const btn = document.querySelector('#commentInputWrap .comment-send-btn');
    if (btn) btn.disabled = true;
    try {
      await db.collection('comments').add({
        studentId: String(id), text, authorName, authorUid: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        likes: 0, likedBy: [], replyCount: 0,
      });
      if (input) input.value = '';
      const ctr = document.getElementById('commentCharCount');
      if (ctr) ctr.textContent = '144 chars left';
    } catch(e) { showToast('❌ Could not post comment.'); }
    finally { if (btn) btn.disabled = false; }
  }, 'login');
};

window.toggleLike = async function(commentId, profileId) {
  if (!currentUser) { openAuthModal(null, 'login'); return; }
  const ref = db.collection('comments').doc(commentId);
  const snap = await ref.get(); if (!snap.exists) return;
  const uid = currentUser.uid;
  const liked = (snap.data().likedBy || []).includes(uid);
  await ref.update({
    likes: firebase.firestore.FieldValue.increment(liked ? -1 : 1),
    likedBy: liked ? firebase.firestore.FieldValue.arrayRemove(uid) : firebase.firestore.FieldValue.arrayUnion(uid),
  });
};

// ── Reply system ──────────────────────────────────────
const _openReplies = new Set();

window.openReplyInput = function(commentId, authorName, profileId) {
  requireAuth(() => {
    document.querySelectorAll('.reply-input-area').forEach(el => {
      if (el.id !== `ria-${commentId}`) el.classList.add('hidden');
    });
    const area = document.getElementById(`ria-${commentId}`);
    if (!area) return;
    const isOpen = !area.classList.contains('hidden');
    area.classList.toggle('hidden', isOpen);
    if (!isOpen) {
      const inp = document.getElementById(`replyInput-${commentId}`);
      if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 60); }
      if (currentUser) {
        const av = document.getElementById(`replyAv-${commentId}`);
        if (av) av.textContent = (currentUser.displayName || currentUser.email)[0].toUpperCase();
      }
    }
  }, 'login');
};

window.handleReplyKey = function(e, commentId, profileId) {
  if (e.key === 'Enter') { e.preventDefault(); submitReply(commentId, profileId); }
};

window.submitReply = async function(commentId, profileId) {
  if (!currentUser) { openAuthModal(null, 'login'); return; }
  const input = document.getElementById(`replyInput-${commentId}`);
  const text = input?.value.trim();
  if (!text) return;
  if (text.length > 144) { showToast('Max 144 characters ✂️'); return; }
  const btn = document.querySelector(`#ria-${commentId} .reply-send`);
  if (btn) btn.disabled = true;
  try {
    const authorName = currentUser.displayName || currentUser.email.split('@')[0];
    await db.collection('comments').doc(commentId).collection('replies').add({
      text, authorName, authorUid: currentUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      likes: 0, likedBy: [],
    });
    await db.collection('comments').doc(commentId).update({
      replyCount: firebase.firestore.FieldValue.increment(1),
      lastReplyAt: firebase.firestore.FieldValue.serverTimestamp(),   // lets the comment's author see "X replied to your comment"
      lastReplyBy: authorName,
      lastReplyUid: currentUser.uid,
    });
    if (input) input.value = '';
    document.getElementById(`ria-${commentId}`)?.classList.add('hidden');
    showToast('Reply posted! 💬');
    setTimeout(() => loadReplies(commentId), 300);
  } catch(e) {
    console.error('[submitReply]', e);
    showToast('❌ Could not post reply.');
  } finally { if (btn) btn.disabled = false; }
};

window.toggleReplies = function(commentId) {
  const container = document.getElementById(`rc-${commentId}`);
  if (!container) return;
  if (_openReplies.has(commentId)) {
    container.classList.add('hidden');
    const ch = document.getElementById(`vrc-${commentId}`);
    if (ch) ch.textContent = '▶';
    _openReplies.delete(commentId);
  } else {
    loadReplies(commentId);
  }
};

window.loadReplies = async function(commentId) {
  const container = document.getElementById(`rc-${commentId}`);
  if (!container) return;
  container.classList.remove('hidden');
  const ch = document.getElementById(`vrc-${commentId}`);
  if (ch) ch.textContent = '▼';
  _openReplies.add(commentId);
  container.innerHTML = `<div class="reply-skeleton"><div class="sk-block" style="height:38px;border-radius:8px"></div></div>`;
  try {
    const snap = await db.collection('comments').doc(commentId).collection('replies').orderBy('timestamp', 'asc').get();
    const replies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!replies.length) { container.innerHTML = ''; return; }
    container.innerHTML = replies.map(r => {
      const initials = (r.authorName || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const ts = r.timestamp?.toDate ? r.timestamp.toDate().getTime() : (r.timestamp || 0);
      const liked = r.likedBy?.includes(currentUser?.uid);
      return `<div class="reply-item" id="ri-${r.id}">
        <div class="avatar-sm avatar-xs">${initials}</div>
        <div class="comment-bubble">
          <div><span class="comment-user">${esc(r.authorName || 'Anonymous')}</span><span class="comment-time">${ago(ts)}</span></div>
          <div class="comment-text">${esc(r.text)}</div>
          <div class="comment-actions">
            <button class="comment-action-btn ${liked ? 'liked' : ''}" onclick="toggleLikeReply('${commentId}','${r.id}')">
              ${liked ? '❤️' : '🤍'} ${r.likes || 0}
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
    const vrbtn = document.getElementById(`vrb-${commentId}`);
    if (vrbtn?.tagName === 'BUTTON') {
      const n = replies.length;
      vrbtn.innerHTML = `<span class="vr-line"></span><span class="vr-text"><span class="vr-chevron" id="vrc-${commentId}">▼</span> ${n} repl${n === 1 ? 'y' : 'ies'}</span>`;
    }
  } catch(e) {
    console.error('[loadReplies]', e);
    container.innerHTML = `<p style="font-size:.75rem;color:#8a97b8;padding:6px 0 4px">Could not load replies.</p>`;
  }
};

window.toggleLikeReply = async function(commentId, replyId) {
  if (!currentUser) { openAuthModal(null, 'login'); return; }
  const ref = db.collection('comments').doc(commentId).collection('replies').doc(replyId);
  const snap = await ref.get(); if (!snap.exists) return;
  const uid = currentUser.uid;
  const liked = (snap.data().likedBy || []).includes(uid);
  await ref.update({
    likes: firebase.firestore.FieldValue.increment(liked ? -1 : 1),
    likedBy: liked ? firebase.firestore.FieldValue.arrayRemove(uid) : firebase.firestore.FieldValue.arrayUnion(uid),
  });
  loadReplies(commentId);
};

// ── Misc ──────────────────────────────────────────────
let bioOpen=false;
window.toggleBio=function(){
  const el=document.getElementById('profileBio');
  const btn=document.getElementById('readMoreBtn');
  bioOpen=!bioOpen;
  el.style.webkitLineClamp=bioOpen?'unset':'5';
  el.style.overflow=bioOpen?'visible':'hidden';
  btn.textContent=bioOpen?'Show less ‹':'Read more ›';
};
window.shareProfile=function(){
  const name=document.getElementById('profileName')?.textContent||'';
  if(navigator.share) navigator.share({title:`${name} — GLUK Yearbook`,url:window.location.href}).catch(()=>{});
  else copyProfileLink();
};
window.copyProfileLink=function(){
  navigator.clipboard.writeText(window.location.href)
    .then(()=>showToast('Link copied! 🔗')).catch(()=>showToast('Could not copy'));
};
window.handleCommentKey=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submitComment();}};
window.goBack=function(){if(document.referrer&&document.referrer!==window.location.href&&!document.referrer.includes('about:'))history.back();else window.location.href='index.html';};

// ── Auto-init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  const page=document.body.dataset.page;
  if(page==='profiles') initProfilesPage();
  if(page==='profile')  initProfilePage();

  const box=document.getElementById('commentInput');
  const ctr=document.getElementById('commentCharCount');
  if(box&&ctr) box.addEventListener('input',()=>{
    const left=144-box.value.length;
    ctr.textContent=`${left} chars left`;
    ctr.style.color=left<20?'#dc2626':'#8a97b8';
  });

  auth.onAuthStateChanged(user=>{
    const wrap=document.getElementById('commentInputWrap');
    const gate=document.getElementById('commentGate');
    const avEl=document.getElementById('commentAvatar');
    if(wrap&&gate){
      if(user){
        wrap.style.display='block';
        gate.style.display='none';
        if(avEl)avEl.textContent=(user.displayName||user.email)[0].toUpperCase();
      } else {
        wrap.style.display='none';
        // Show gate below existing comments (don't hide the comments list)
        gate.style.display='block';
      }
    }
  });
});