// @ts-nocheck
// =====================================================================
//  GLUK YEARBOOK — SECURE API  (Supabase Edge Function named "api")
//
//  What it does: every change to your data goes through here. It checks the
//  person's Firebase login, decides whether they are allowed to do what they
//  asked (owner of the profile / club official / admin), validates the data,
//  and only then writes to the database with the server-side key.
//
//  Nothing in this file is secret. The database key is supplied by Supabase
//  itself (SUPABASE_SERVICE_ROLE_KEY) and never appears in your website code.
// =====================================================================

// ==DENO-IMPORTS-START==
import { createClient } from 'npm:@supabase/supabase-js@2';
// ==DENO-IMPORTS-END==

// ── Settings (change here only if your project details change) ────────
const CONFIG = {
  projectId: 'yearbook-d3f4f',                     // Firebase project id
  adminEmail: 'kuriablair@gmail.com',              // the one admin account
  origins: [                                       // websites allowed to call this API from a browser
    'https://yearbook-d3f4f.web.app',
    'https://yearbook-d3f4f.firebaseapp.com',
    'http://localhost:5500', 'http://127.0.0.1:5500',
    'http://localhost:5000', 'http://127.0.0.1:5000',
  ],
  previewOrigin: /^https:\/\/yearbook-d3f4f--[a-z0-9-]+\.web\.app$/,   // Firebase preview links (only the project owner can make one)
  profileBucket: 'profile-photos',
  clubBucket: 'club-files',
  maxBodyBytes: 300 * 1024,
  maxPhotoBytes: 6 * 1024 * 1024,
  maxFileBytes: 12 * 1024 * 1024,
  roles: [
    'Patron', 'Chairperson', 'Vice chairperson', 'Vice Chairperson', 'Secretary', 'Secretary General',
    'Treasurer', 'Finance Minister', 'Organizing secretary', 'Officer',
    'Academic Minister', 'Sports and Entertainment Minister', 'Gender and Social Welfare Minister',
    'Speaker (SLC)', 'Deputy Speaker (SLC)',
    'Campus Representative – Milimani', 'Campus Representative – Kibos', 'Campus Representative – Nairobi',
  ],
  postTypes: ['notice', 'event', 'activity', 'minutes', 'photo'],
  supabaseUrl: '',                                  // filled in automatically when the function starts
  // Phone notifications (Web Push). The public key is also in app.js; the private key is the
  // VAPID_PRIVATE_KEY secret in Supabase (Edge Functions → Secrets), never in this file.
  vapidPublicKey: 'BDU6dE7Bj4zzBxnrEE1YF_4tuyQ4DYerdmNPEtnIZ36UBV7e1Yha299-T_RxAN-v3RCvVELhFlYdnsBwd9GQwwQ',
  vapidSubject: 'mailto:kuriablair@gmail.com',      // push services contact this address if something goes wrong
  pushHosts: ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'],
  maxDevicesPerPerson: 10,
  notifyWindowMs: 10 * 60 * 1000,                   // a comment or reply can only trigger a push within 10 minutes of being written
  notifyPerPerson: 20,                              // at most this many pushes triggered by one person per 10 minutes
  commentsPerPerson: 20,                            // at most this many comments + replies by one person per 10 minutes
  lettersOpenAt: '2026-11-20T21:00:00Z',            // letters open on graduation day, Saturday 21 November 2026, 00:00 in Kisumu (also in letters.js and the SQL)
  lettersClass: '2026',                             // the graduating class letters are written to
  lettersPerPerson: 30,                             // at most this many new letters by one person per 24 hours
  friendRequestsPerDay: 40,                         // friend requests one person may send per 24 hours
  capsulesPerPerson: 20,                            // time capsule notes one student may seal
  ghostDays: 90,                                    // a profile its owner deletes can be restored for this long, then it is removed for good
  offices: ['dos', 'alumni'],                       // office dashboards (office.html); their names are OFFICE_NAMES in firebase-config.js
  errorsPerMinute: 60,                              // app error reports kept per minute, from everyone together
  // The class wall (wall.html): each kind opens on its graduation-week day, 00:00 in Kisumu (also in wall.js and the SQL)
  wallOpens: { memory: '2026-11-16T21:00:00Z', tag: '2026-11-17T21:00:00Z', song: '2026-11-18T21:00:00Z', joke: '2026-11-18T21:00:00Z', advice: '2026-11-19T21:00:00Z' },
  wallLimits: { memory: 10, tag: 4, song: 5, joke: 5, advice: 3 },   // per person
  glowRevealAt: '2026-11-15T21:00:00Z',             // Glow Up opens on Monday 16 November 2026, 00:00 in Kisumu (also in glowup.js and the SQL)
  contactsPerDay: 20,                               // different classmates' contact details one person may open per 24 hours
  supRevealAt: '2026-11-14T21:00:00Z',              // superlatives: voting closes and the top 3 are shown (Sunday 15 November, 00:00 in Kisumu)
  supClass: '2026',                                 // the class whose graduates can be voted for
  kyuRound: 10,                                     // questions in a round of Who's who? (university.js)
  kyuMinSeconds: 15,                                // a round finished faster than this does not count
  kyuPerHour: 40,                                   // at most this many rounds started by one person per hour
  chalRound: 10,                                    // questions in a round of Think it's easy? (challenge.js)
  chalMinSeconds: 20,                               // a round finished faster than this does not count
  chalPerHour: 40,                                  // at most this many rounds started by one person per hour
  // Pages whose visits are counted for the Developer tab (each page's <body data-page>)
  trackPages: ['home', 'feed', 'profiles', 'profile', 'clubs', 'club', 'department', 'course', 'class', 'staff',
    'about', 'constitution', 'letters', 'university', 'superlatives', 'challenge',
    'grad', 'glowup', 'capsule', 'wall', 'handbook', 'reel'],
};

const KEYS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// ── Errors ─────────────────────────────────────────────────────────────
class ApiError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra || {}; }
}
const bad       = m => new ApiError(400, 'invalid', m);
const forbidden = m => new ApiError(403, 'forbidden', m || 'You are not allowed to do that.');
const notFound  = m => new ApiError(404, 'not_found', m || 'Not found.');
const conflict  = (m, code, extra) => new ApiError(409, code || 'conflict', m, extra);

// ── Small validators ───────────────────────────────────────────────────
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function txt(v, max, label, { required = false } = {}) {
  if (v === undefined || v === null) { if (required) throw bad(`${label} is required.`); return ''; }
  if (typeof v !== 'string') throw bad(`${label} must be text.`);
  const s = v.trim();
  if (required && !s) throw bad(`${label} is required.`);
  if (s.length > max) throw bad(`${label} is too long (max ${max} characters).`);
  return s;
}
function emailOrBlank(v, label) {
  const s = txt(v, 120, label);
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad(`${label} does not look like an email address.`);
  return s;
}
// Month-and-day only (no year — see the app update notes for why), e.g. "09-23"
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function birthdayOrBlank(v, label) {
  const s = txt(v, 5, label);
  if (!s) return '';
  const m = /^(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw bad(`${label} must be a month and day, like 09-23.`);
  const mo = +m[1], day = +m[2];
  if (mo < 1 || mo > 12 || day < 1 || day > DAYS_IN_MONTH[mo - 1]) throw bad(`${label} is not a real date.`);
  return s;
}
function phoneOrBlank(v, label) {
  const s = txt(v, 30, label);
  if (s && !/^[+\d][\d\s\-()]{5,29}$/.test(s)) throw bad(`${label} does not look like a phone number.`);
  return s;
}
// A country's name as the profile form lists it: letters, spaces and a little punctuation, e.g. "Côte d'Ivoire"
function countryOrBlank(v, label) {
  const s = txt(v, 60, label);
  if (s && !/^\p{L}[\p{L} .,'’()-]*$/u.test(s)) throw bad(`${label} does not look like a country.`);
  return s;
}
function strList(v, maxItems, maxLen, label) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw bad(`${label} must be a list.`);
  if (v.length > maxItems) throw bad(`${label} has too many items (max ${maxItems}).`);
  return v.map(x => txt(x, maxLen, label, { required: true }));
}
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'club';
const safeName = s => String(s || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-60);
const publicBase = (cfg, bucket) => `${cfg.supabaseUrl}/storage/v1/object/public/${bucket}/`;
function fileUrls(cfg, list, bucket, max, label, folder) {
  const urls = strList(list, max, 600, label);
  const base = publicBase(cfg, bucket) + (folder ? folder + '/' : '');
  urls.forEach(u => { if (!u.startsWith(base) || /[\s"'<>]/.test(u) || u.includes('..')) throw bad(`${label} contains a link that is not from this yearbook's storage.`); });
  return urls;
}

// ── Profile fields the app may write ───────────────────────────────────
// (owners can change these on their own profile)
function ownerFields(cfg, uid, p, out) {
  const has = k => Object.prototype.hasOwnProperty.call(p, k);
  if (has('name'))            out.name = txt(p.name, 120, 'Name', { required: true });
  if (has('reg'))             out.reg = txt(p.reg, 60, 'Reg number');
  if (has('whatsapp'))        out.whatsapp = phoneOrBlank(p.whatsapp, 'WhatsApp number');
  if (has('email'))           out.email = emailOrBlank(p.email, 'Email');
  if (has('country'))         out.country = countryOrBlank(p.country, 'Home country');
  if (has('county'))          out.county = txt(p.county, 60, 'County');
  if (has('constituency'))    out.constituency = txt(p.constituency, 80, 'Constituency');
  if (has('currentcounty'))   out.currentcounty = txt(p.currentcounty, 60, 'Current county');
  if (has('currentlocation')) out.currentlocation = txt(p.currentlocation, 120, 'Current location');
  if (has('bio'))             out.bio = txt(p.bio, 600, 'Bio');
  if (has('hobbies'))         out.hobbies = txt(Array.isArray(p.hobbies) ? p.hobbies.join(', ') : p.hobbies, 500, 'Hobbies');
  if (has('clubs'))           out.clubs = strList(p.clubs, 40, 80, 'Clubs');
  if (has('bestmemory'))      out.bestmemory = txt(p.bestmemory, 400, 'Best memory');
  if (has('biggestlesson'))   out.biggestlesson = txt(p.biggestlesson, 200, 'Biggest lesson');
  if (has('mostlikelyto'))    out.mostlikelyto = txt(p.mostlikelyto, 200, 'Most likely to');
  if (has('whatareyouto'))    out.whatareyouto = txt(p.whatareyouto, 300, 'What are you up to');
  if (has('birthday'))        out.birthday = birthdayOrBlank(p.birthday, 'Birthday');
  if (has('photos')) {
    const owner = uid;                                 // owners may only use photos they uploaded themselves
    out.photos = fileUrls(cfg, p.photos, cfg.profileBucket, 4, 'Photos', owner);
  }
  if (has('photo_url')) {
    out.photo_url = p.photo_url ? fileUrls(cfg, [p.photo_url], cfg.profileBucket, 1, 'Photo', uid)[0] : null;
  }
  return out;
}
// (only the admin can change these on an existing profile)
function adminFields(p, out) {
  const has = k => Object.prototype.hasOwnProperty.call(p, k);
  if (has('dept'))      out.dept = txt(p.dept, 120, 'School', { required: true });
  if (has('course'))    out.course = txt(p.course, 200, 'Programme', { required: true });
  if (has('classyear')) out.classyear = classYear(p.classyear);
  return out;
}
function classYear(v) {
  const s = String(v == null ? '' : v).trim();
  if (!/^\d{4}$/.test(s) || +s < 1990 || +s > 2100) throw bad('Class year must be a 4-digit year.');
  return s;
}

// ── Firebase login check (no libraries: standard Web Crypto only) ───────
const b64uBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
const b64uJson = s => JSON.parse(new TextDecoder().decode(b64uBytes(s)));

export async function verifyFirebaseToken(token, { projectId, getKeys, nowSec }) {
  const fail = why => new ApiError(401, 'auth', 'Please sign in again.', { why });
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw fail('format');
  let header, payload;
  try { header = b64uJson(parts[0]); payload = b64uJson(parts[1]); } catch (e) { throw fail('decode'); }
  if (header.alg !== 'RS256' || !header.kid) throw fail('alg');
  let jwk = (await getKeys(false)).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await getKeys(true)).find(k => k.kid === header.kid);   // keys rotate: look again once
  if (!jwk) throw fail('kid');
  let ok = false;
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  } catch (e) { throw fail('key'); }
  if (!ok) throw fail('signature');
  const now = nowSec(), skew = 60;
  if (typeof payload.exp !== 'number' || payload.exp + skew < now) throw fail('expired');
  if (typeof payload.iat !== 'number' || payload.iat - skew > now) throw fail('iat');
  if (payload.aud !== projectId) throw fail('aud');
  if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw fail('iss');
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw fail('sub');
  return { uid: payload.sub, email: String(payload.email || ''), emailVerified: payload.email_verified === true, name: String(payload.name || '') };
}

// ── Who is allowed to do what ──────────────────────────────────────────
const lower = s => String(s || '').trim().toLowerCase();
async function isClubOfficer(ctx, club) {
  if (!ctx.user.emailVerified || !ctx.user.email) return false;     // an unverified email can never act as an official
  const r = await ctx.db.from('club_officers').select('id').eq('club_name', club).eq('officer_email', lower(ctx.user.email)).limit(1);
  if (r.error) return false;
  return !!(r.data && r.data.length);
}
async function requireClubManager(ctx, club) {
  if (ctx.isAdmin) return;
  if (!(await isClubOfficer(ctx, club))) throw forbidden('Only this club\u2019s officials can do that.');
}
const requireAdmin = ctx => { if (!ctx.isAdmin) throw forbidden('Only the super admin can do that.'); };
// ── Offices (since 2026-10-31): each office admin sees only their own office's dashboard (office.html) ──
// The super admin (the adminEmail account) passes every office check. An office admin needs a verified email.
const officeDbError = e => missingTable(e)
  ? new ApiError(503, 'offices_coming', 'Office dashboards are being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not do that. Please try again.');
async function loadOffices(ctx) {
  if (ctx.offices) return ctx.offices;
  if (ctx.isSuperAdmin || ctx.isAdmin) return (ctx.offices = [...ctx.config.offices]);
  if (!ctx.user || !ctx.user.emailVerified || !ctx.user.email) return (ctx.offices = []);
  const r = await ctx.db.from('office_admins').select('office').eq('email', lower(ctx.user.email)).limit(10);
  return (ctx.offices = r.error ? [] : [...new Set((r.data || []).map(x => x.office))].filter(o => ctx.config.offices.includes(o)));
}
async function requireOffice(ctx, office) {
  if (!(await loadOffices(ctx)).includes(office)) throw forbidden('Only this office can do that.');
}
// Who did what (the super admin reads it in Developer > Audit). If it cannot be written, the action does not happen.
async function audit(ctx, office, action, detail) {
  const r = await ctx.db.from('office_audit').insert({ email: lower(ctx.user.email) || ctx.user.uid, office: office || null, action,
    detail: detail || {}, created_at: new Date(ctx.now()).toISOString() });
  if (r.error) throw officeDbError(r.error);
}
async function getRow(ctx, table, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw bad('Missing or invalid id.');
  const r = await ctx.db.from(table).select('*').eq('id', n).single();
  if (r.error || !r.data) throw notFound();
  return r.data;
}
const missingTable = e => !!e && /schema cache|does not exist|PGRST205|42P01/i.test((e.message || '') + ' ' + (e.code || ''));

// ── Phone notifications: who gets what ─────────────────────────────────
const snip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const pushDbError = e => missingTable(e)
  ? new ApiError(500, 'push_tables_missing', 'Phone notifications are not set up yet (run the push_notifications migration).')
  : new ApiError(500, 'db', 'Could not save the notification settings.');
const POST_KIND = { notice: 'New notice', event: 'Coming up', activity: 'New activity', minutes: 'New minutes', photo: 'New photos' };
// "Sat 24 Oct" for an event's date (a plain yyyy-mm-dd)
const eventDay = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const docId = (v, label) => { const s = String(v || ''); if (!/^[A-Za-z0-9]{1,40}$/.test(s)) throw bad(`Missing or invalid ${label}.`); return s; };

// A browser's push address must belong to a real push service: the server POSTs to it.
function pushSubscription(cfg, s) {
  if (!isObj(s) || !isObj(s.keys)) throw bad('Missing subscription.');
  const endpoint = txt(s.endpoint, 1000, 'Endpoint', { required: true });
  let u;
  try { u = new URL(endpoint); } catch (e) { throw bad('Endpoint is not a web address.'); }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.port || !cfg.pushHosts.some(h => host === h || host.endsWith('.' + h))) throw bad('That is not a known push service.');
  const p256dh = txt(s.keys.p256dh, 100, 'Key', { required: true }), auth = txt(s.keys.auth, 40, 'Key', { required: true });
  let pk, ak;
  try { pk = b64uBytes(p256dh); ak = b64uBytes(auth); } catch (e) { throw bad('The subscription keys could not be read.'); }
  if (pk.length !== 65 || pk[0] !== 4 || ak.length !== 16) throw bad('The subscription keys are the wrong size.');
  return { endpoint, p256dh, auth };
}

// One row per comment/reply that triggered a push: stops the same one being sent twice,
// and caps how many pushes one person can trigger in 10 minutes.
async function claimEvent(ctx, key) {
  const since = new Date(ctx.now() - 10 * 60 * 1000).toISOString();
  const recent = await ctx.db.from('push_events').select('key', { count: 'exact', head: true })
    .eq('actor_uid', ctx.user.uid).gte('created_at', since);
  if (recent.error) throw pushDbError(recent.error);
  if ((recent.count || 0) >= ctx.config.notifyPerPerson) return 'throttled';
  const ins = await ctx.db.from('push_events').insert({ key, actor_uid: ctx.user.uid, created_at: new Date(ctx.now()).toISOString() });
  if (ins.error) { if (ins.error.code === '23505') return 'duplicate'; throw pushDbError(ins.error); }
  return 'ok';
}

// Send one notification to every device of these people. Devices the push service says are gone get removed.
async function pushToUids(ctx, uids, payload) {
  if (!ctx.push) return { sent: 0, reason: 'not_configured' };
  const list = [...new Set(uids.filter(Boolean))];
  const subs = [];
  for (let i = 0; i < list.length; i += 100) {
    const r = await ctx.db.from('push_subscriptions').select('id,endpoint,p256dh,auth').in('uid', list.slice(i, i + 100));
    if (r.error) throw pushDbError(r.error);
    subs.push(...(r.data || []));
  }
  let sent = 0, failed = 0, next = 0;
  const gone = [];
  const worker = async () => {
    while (next < subs.length) {
      const s = subs[next++];
      try {
        const status = await ctx.push.send(s, payload);
        if (status >= 200 && status < 300) sent++;
        else if (status === 404 || status === 410) gone.push(s.id);
        else { failed++; console.warn('[push] the push service answered', status, new URL(s.endpoint).hostname); }
      } catch (e) { failed++; console.warn('[push] send failed', e && e.message); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, subs.length) }, worker));
  if (gone.length) await ctx.db.from('push_subscriptions').delete().in('id', gone);
  if (subs.length) await logEvent(ctx, 'push', failed === 0,
    { what: PUSH_WHAT[String(payload.tag || '').split('-')[0]] || 'other', devices: subs.length, sent, failed, removed: gone.length });
  return { sent, removed: gone.length };
}

// A line in the developer diary (ops_events). Never lets a diary problem break the real work.
const PUSH_WHAT = { c: 'comment', r: 'reply', p: 'club post', l: 'like', s: 'staff approved', t: 'letter', ld: 'leader approved', test: 'test',
  fr: 'friend request', fa: 'friend accepted', fp: 'friend photos', fu: 'friend update', fl: 'friend likes', n: "what's new", wt: 'wall tag', gd: 'graduation day' };
async function logEvent(ctx, kind, ok, details) {
  try { await ctx.db.from('ops_events').insert({ kind, ok, details, created_at: new Date(ctx.now()).toISOString() }); }
  catch (e) { /* the dashboard just misses one line */ }
}

async function notifyClubMembers(ctx, post) {
  if (!ctx.push || !post) return;
  const r = await ctx.db.from('profiles').select('uid').contains('clubs', [post.club_name]).limit(5000);
  if (r.error) { console.warn('[push] could not find club members', r.error.message); return; }
  const uids = (r.data || []).map(x => x.uid).filter(u => u && u !== ctx.user.uid);
  const n = (post.file_urls || []).length;
  let body = post.title || post.body || (post.type === 'photo' ? `${n} new photo${n === 1 ? '' : 's'}` : '');
  if (post.type === 'event' && post.post_date) body = `${eventDay(post.post_date)} · ${body}`;
  return pushToUids(ctx, uids, { title: `${post.club_name} · ${POST_KIND[post.type] || 'New post'}`, body: snip(body, 140),
    url: '/club.html?club=' + encodeURIComponent(post.club_name) + '&post=' + post.id + '#feed', tag: 'p-' + post.id });
}

// ── Comments (in Supabase since 2026-10-09) ────────────────────────────
const commentDbError = e => missingTable(e)
  ? new ApiError(503, 'comments_moving', 'Comments are being moved right now. Please try again in a few minutes.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
// The name shown on a comment: the account's name when the login carries it, else what the page sent, else the email's first part
const authorName = (ctx, body) => snip(ctx.user.name, 60) || snip(typeof body.authorName === 'string' ? body.authorName : '', 60)
  || snip(String(ctx.user.email || '').split('@')[0], 60) || 'Someone';
// The name on what someone writes or does (comments, replies, likes, letters): their yearbook name, else their
// approved staff name, else their account's name marked "(guest)", so nobody can pass as a student just by
// renaming their account. Someone with an anonymous yearbook profile keeps their account's name. Looked up once per request.
async function shownName(ctx, body, max = 60) {
  if (ctx.shown === undefined) {
    const p = await ctx.db.from('profiles').select('name,isanonymous').eq('uid', ctx.user.uid).limit(1);
    const row = !p.error && p.data && p.data[0];
    if (row) ctx.shown = !row.isanonymous && String(row.name || '').trim() ? row.name : authorName(ctx, body || {});
    else {
      const s = await ctx.db.from('staff_profiles').select('name,title').eq('uid', ctx.user.uid).eq('status', 'approved').limit(1);
      const st = !s.error && s.data && s.data[0];
      ctx.shown = st && String(st.name || '').trim() ? [st.title, st.name].filter(Boolean).join(' ') : snip(authorName(ctx, body || {}), 52) + ' (guest)';
    }
  }
  return snip(ctx.shown, max);
}
// Someone with their own yearbook profile, or an approved staff profile: the people who may see classmates' contacts
async function isMember(ctx) {
  const p = await ctx.db.from('profiles').select('id').eq('uid', ctx.user.uid).limit(1);
  if (!p.error && p.data && p.data.length) return true;
  const s = await ctx.db.from('staff_profiles').select('id').eq('uid', ctx.user.uid).eq('status', 'approved').limit(1);
  return !s.error && !!(s.data && s.data.length);
}
// At most 20 comments + replies per person per 10 minutes (Firebase had no limit at all)
async function commentRateLimit(ctx) {
  const since = new Date(ctx.now() - 10 * 60 * 1000).toISOString();
  const count = t => ctx.db.from(t).select('id', { count: 'exact', head: true }).eq('author_uid', ctx.user.uid).gte('created_at', since);
  const [a, b] = await Promise.all([count('comments'), count('comment_replies')]);
  if (a.error || b.error) throw commentDbError(a.error || b.error);
  if ((a.count || 0) + (b.count || 0) >= ctx.config.commentsPerPerson) throw new ApiError(429, 'slow_down', 'You are commenting very fast. Please wait a few minutes.');
}
// Ids like Firestore's: 20 letters and digits, unbiased
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function randomId(n = 20) {
  const out = [];
  while (out.length < n) for (const x of crypto.getRandomValues(new Uint8Array(n * 2))) if (x < 248 && out.length < n) out.push(ID_CHARS[x % 62]);
  return out.join('');
}

// ── Profile likes (the heart on the Students feed, since 2026-10-10) ───
const likeDbError = e => missingTable(e)
  ? new ApiError(503, 'likes_coming', 'Likes are being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
// The owner hears about each person's like once, ever: liking, unliking and liking again sends nothing new
async function notifyLike(ctx, pid, owner) {
  if (await claimEvent(ctx, `l:${pid}:${ctx.user.uid}`) !== 'ok') return { sent: 0 };
  return pushToUids(ctx, [owner], { title: `${await shownName(ctx, {})} liked your profile ❤️`,
    body: 'Open the yearbook to see your page.', url: `/profile.html?id=${pid}`, tag: 'l-' + pid });
}

// ── Staff profiles (lecturers and staff on the Home page, since 2026-10-11) ──
// A new one waits for the admin's approval, so nobody can pose as a lecturer.
const STAFF_STATUS = ['pending', 'approved', 'hidden'];
const staffDbError = e => missingTable(e)
  ? new ApiError(503, 'staff_coming', 'Staff profiles are being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
// The staff groups and the academic ranks the form offers (staff.js has the same lists). The ranks follow the
// Kenyan university ladder (CUE's grading nomenclature), plus the other teaching posts a university has.
const STAFF_GROUPS = ['teaching', 'leadership', 'admin', 'technical', 'library', 'welfare', 'ict', 'finance', 'facilities', 'other'];
const STAFF_RANKS = ['Graduate Assistant', 'Research Assistant', 'Tutorial Fellow', 'Junior Research Fellow', 'Assistant Lecturer', 'Lecturer',
  'Research Fellow', 'Senior Lecturer', 'Senior Research Fellow', 'Associate Professor', 'Professor', 'Professor Emeritus',
  'Adjunct Lecturer', 'Visiting Lecturer', 'Part-time Lecturer', 'Clinical Instructor', 'Tutor'];
const STAFF_CAMPUSES = ['Main campus, Kisumu', 'Milimani', 'Nairobi', 'More than one campus'];
const STAFF_LEAD_LEVELS = ['school', 'department', 'programme'];       // leads their school or faculty / their department / a programme
const STAFF_CHART = ['lead_level', 'campus', 'help_with'];             // since the staff_chart migration
const STAFF_DETAILS = ['category', 'rank', 'lead_role', 'unit', 'teaches', 'qualifications', ...STAFF_CHART];
// What makes someone look senior: a change to any of these on a live profile goes back to the admin
const STAFF_CHECKED = ['name', 'title', 'position', 'rank', 'lead_role', 'lead_level'];
function staffFields(ctx, p) {
  const since = txt(p.since_year, 4, 'Year you joined GLUK');
  if (since && (!/^\d{4}$/.test(since) || +since < 1950 || +since > new Date(ctx.now()).getFullYear())) throw bad('Year you joined GLUK must be a 4-digit year.');
  const category = txt(p.category, 40, 'Staff group'), rank = txt(p.rank, 60, 'Academic rank');
  if (category && !STAFF_GROUPS.includes(category)) throw bad('Choose your staff group from the list.');
  if (rank && !STAFF_RANKS.includes(rank)) throw bad('Choose your academic rank from the list.');
  const leadLevel = txt(p.lead_level, 20, 'Whether you lead it'), campus = txt(p.campus, 60, 'Campus');
  if (leadLevel && !STAFF_LEAD_LEVELS.includes(leadLevel)) throw bad('Choose whether you lead your school, your department or a programme.');
  if (campus && !STAFF_CAMPUSES.includes(campus)) throw bad('Choose your campus from the list.');
  return {
    name: txt(p.name, 120, 'Name', { required: true }),
    title: txt(p.title, 20, 'Title') || null,
    position: txt(p.position, 120, 'Position', { required: true }),
    dept: txt(p.dept, 120, 'School or office') || null,
    since_year: since || null,
    message: txt(p.message, 600, 'Message') || null,
    photo_url: p.photo_url ? fileUrls(ctx.config, [p.photo_url], ctx.config.profileBucket, 1, 'Photo', ctx.user.uid)[0] : null,
    category: category || null,
    rank: rank || null,
    lead_role: txt(p.lead_role, 80, 'Leadership role') || null,
    unit: txt(p.unit, 120, 'Department or unit') || null,
    teaches: txt(p.teaches, 300, 'Units you teach') || null,
    qualifications: txt(p.qualifications, 160, 'Qualifications') || null,
    lead_level: leadLevel || null,
    campus: campus || null,
    help_with: txt(p.help_with, 160, 'What students come to you for') || null,
  };
}
// Before the staff_details migration the new columns are missing: save without them rather than fail
const missingColumn = e => !!e && (e.code === '42703' || e.code === 'PGRST204' || /column/i.test(e.message || ''));
const without = keys => rec => Object.fromEntries(Object.entries(rec).filter(([k]) => !keys.includes(k)));
const withoutChart = without(STAFF_CHART), withoutDetails = without(STAFF_DETAILS);
async function myStaff(ctx) {
  const r = await ctx.db.from('staff_profiles').select('*').eq('uid', ctx.user.uid).limit(1);
  if (r.error) throw staffDbError(r.error);
  return (r.data && r.data[0]) || null;
}

// ── Student leaders (since 2026-10-19): GLUKSA, class reps and others, past and present ──
// The admin adds anyone, alumni with no profile too. A student may claim a role on their own profile;
// it shows only once the admin approves it, so nobody can make themselves president.
const LEADER_ORGS = ['gluksa', 'class', 'club', 'other'];
const LEADER_STATUS = ['pending', 'approved', 'hidden'];
const LEADER_COLS = 'id,profile_id,name,org,title,unit,term_from,term_to,current,honour,note,photo_url,status,claimed_by,created_at,updated_at,reviewed_at';
const leaderDbError = e => missingTable(e)
  ? new ApiError(503, 'leaders_coming', 'Student leaders are being switched on. Please try again later.')
  : e && e.code === '23505' ? conflict('That role and term are already on this profile.', 'exists')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
// The fields a student and the admin both fill in
function leaderFields(ctx, p) {
  const org = String(p.org || '');
  if (!LEADER_ORGS.includes(org)) throw bad('Choose where the role was: GLUKSA, a class, a club or other.');
  const title = txt(p.title, 80, 'Position', { required: true });
  if (title.length < 2) throw bad('Write the position, e.g. Class representative.');
  const unit = txt(p.unit, 120, org === 'class' ? 'Class' : org === 'club' ? 'Club' : 'Office or campus');
  if (org === 'class' && !unit) throw bad('Say which class, e.g. BSc. Nursing, Class of 2027.');
  if (org === 'club' && !unit) throw bad('Say which club.');
  const year = new Date(ctx.now()).getUTCFullYear();
  const from = Number(p.term_from), to = p.term_to === undefined || p.term_to === null || p.term_to === '' ? null : Number(p.term_to);
  if (!Number.isInteger(from) || from < 1990 || from > year + 1) throw bad('Choose the year the term started.');
  if (to !== null && (!Number.isInteger(to) || to < from || to > from + 8 || to > year + 2)) throw bad('The term must end in or after the year it started.');
  if (p.current !== undefined && typeof p.current !== 'boolean') throw bad('Say whether they are serving now.');
  return { org, title, unit: unit || null, term_from: from, term_to: to, current: p.current === true, note: txt(p.note, 300, 'A line about it') || null };
}
// The caller's own student profile (a claim always goes on it)
async function myProfile(ctx) {
  const r = await ctx.db.from('profiles').select('id,name,isanonymous').eq('uid', ctx.user.uid).limit(1);
  if (r.error) throw new ApiError(500, 'db', 'Could not check your profile.');
  return (r.data && r.data[0]) || null;
}
const ownLeader = r => ({ id: r.id, org: r.org, title: r.title, unit: r.unit, term_from: r.term_from, term_to: r.term_to,
  current: r.current, honour: r.honour, note: r.note, status: r.status, mine: !!r.claimed_by, created_at: r.created_at });
// "2024/2025" for one academic year, "2023–2025" for longer, "since 2025" while serving with no end set (also in leaders.js)
const leaderTerm = r => r.term_to == null ? (r.current ? `since ${r.term_from}` : String(r.term_from))
  : r.term_to === r.term_from ? String(r.term_from) : r.term_to === r.term_from + 1 ? `${r.term_from}/${r.term_to}` : `${r.term_from}–${r.term_to}`;
// The student hears when their role goes live (a claim the admin approved, or one the admin added for them)
async function notifyLeader(ctx, row) {
  let uid = row.claimed_by;
  if (!uid && row.profile_id) {
    const p = await ctx.db.from('profiles').select('uid').eq('id', row.profile_id).limit(1);
    uid = p.data && p.data[0] && p.data[0].uid;
  }
  if (!uid) return;
  const where = row.org === 'gluksa' ? 'GLUKSA' : row.unit || '';
  return pushToUids(ctx, [uid], { title: 'You are on the roll of student leaders 🎖',
    body: snip(`${row.title}${where ? ', ' + where : ''} · ${leaderTerm(row)}. It now shows on your profile and on Know your university.`, 180),
    url: row.profile_id ? `/profile.html?id=${row.profile_id}` : '/university.html#leaders', tag: 'ld-' + row.id });
}

// ── Letters to the Class of 2026 (since 2026-10-12) ─────────────────────
// To one graduate (private: only they and the writer ever read it), to the whole class (the wall),
// or to the writer's own first-year self (kept, or shared on the wall). All sealed until lettersOpenAt.
const LETTER_KINDS = ['graduate', 'class', 'self'];
const LETTER_MINE = 'id,to_kind,to_profile,to_name,body,on_wall,hidden,created_at,updated_at';
const letterDbError = e => missingTable(e)
  ? new ApiError(503, 'letters_coming', 'Letters are being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
const lettersOpen = ctx => ctx.now() >= Date.parse(ctx.config.lettersOpenAt);
async function letterRow(ctx, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw bad('Missing or invalid letter.');
  const r = await ctx.db.from('letters').select('*').eq('id', n).limit(1);
  if (r.error) throw letterDbError(r.error);
  if (!r.data || !r.data[0]) throw notFound('That letter could not be found.');
  return r.data[0];
}
// A letter is signed the same way as a comment (see shownName). Never anonymous.
const signedName = ctx => shownName(ctx, {}, 80);
// What the writer gets back about their own letter (never the logins)
const ownLetter = r => ({ id: r.id, to_kind: r.to_kind, to_profile: r.to_profile, to_name: r.to_name, body: r.body,
  on_wall: r.on_wall, hidden: r.hidden, created_at: r.created_at, updated_at: r.updated_at });
// The graduate's phone hears that a letter is waiting, but not who wrote it or what it says
async function notifyLetter(ctx, letter) {
  if (!letter || letter.to_kind !== 'graduate' || !letter.to_uid || !letter.id) return { sent: 0 };
  if (await claimEvent(ctx, 't:' + letter.id) !== 'ok') return { sent: 0 };
  const open = lettersOpen(ctx);
  return pushToUids(ctx, [letter.to_uid], {
    title: open ? `💌 ${letter.author_name} wrote you a letter` : '💌 Someone wrote you a letter',
    body: open ? 'Open the yearbook to read it.' : 'It stays sealed until graduation day, 21 November.',
    url: '/letters.html#for-you', tag: 't-' + letter.id });
}

// ── Glow Up: Then vs Now (graduation week, day 2; since 2026-10-23) ──────
// One per Class of 2026 graduate with a named profile: a first-year photo and one from now, both from their
// own storage folder. Sealed until glowRevealAt; then the public glowups_wall view shows it.
const GLOW_MINE = 'profile_id,then_url,now_url,then_year,caption,hidden,created_at,updated_at';
const glowDbError = e => missingTable(e)
  ? new ApiError(503, 'glow_coming', 'Glow Up is being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
const glowOpen = ctx => ctx.now() >= Date.parse(ctx.config.glowRevealAt);
const ownGlow = r => r ? { profile_id: r.profile_id, then_url: r.then_url, now_url: r.now_url, then_year: r.then_year ?? null,
  caption: r.caption || '', hidden: !!r.hidden, created_at: r.created_at, updated_at: r.updated_at } : null;

// ── Time capsule (since 2026-10-25) ────────────────────────────────────
// A student seals notes to their future self; they open on their own class's graduation day (grad_days,
// posted by the admin). The class comes from the profile when it is read, so a changed class follows.
const capDbError = e => missingTable(e)
  ? new ApiError(503, 'capsule_coming', 'The time capsule is being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
async function capsuleState(ctx) {
  const p = await ctx.db.from('profiles').select('id,classyear').eq('uid', ctx.user.uid).limit(1);
  if (p.error) throw capDbError(p.error);
  const prof = p.data && p.data[0];
  if (!prof) return { prof: null, classyear: null, opensAt: null, open: false };
  const classyear = String(prof.classyear || '');
  const g = classyear ? await ctx.db.from('grad_days').select('opens_at').eq('classyear', classyear).limit(1) : { data: [] };
  if (g.error) throw capDbError(g.error);
  const opensAt = g.data && g.data[0] ? g.data[0].opens_at : null;
  return { prof, classyear, opensAt, open: !!opensAt && ctx.now() >= Date.parse(opensAt) };
}
// ── The class wall (since 2026-10-26): graduation week days 3–6 ──────────
// Memories by year, tagging your people, the class playlist, inside jokes and advice for the freshers.
// Anyone with a named yearbook profile adds them; each kind stays sealed until its day (CONFIG.wallOpens).
const WALL_KINDS = ['memory', 'tag', 'song', 'joke', 'advice'];
const WALL_ROLES = { bestie: 'best friend', study: 'study partner', mentor: 'mentor', chaos: 'chaos partner' };
const WALL_COLS = 'id,kind,year,tag_role,tagged_profile,title,body,hidden,created_at';
const wallDbError = e => missingTable(e)
  ? new ApiError(503, 'wall_coming', 'The class wall is being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
const wallOpen = (ctx, kind) => ctx.now() >= Date.parse(ctx.config.wallOpens[kind]);
async function wallRow(ctx, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw bad('Missing or invalid post.');
  const r = await ctx.db.from('grad_posts').select('*').eq('id', n).limit(1);
  if (r.error) throw wallDbError(r.error);
  if (!r.data || !r.data[0]) throw notFound('That post could not be found.');
  return r.data[0];
}

// ── Deleting your own profile (since 2026-10-30) ──────────────────────────────
// The profile moves to profiles_archive as a "ghost": hidden from everyone at once, and its owner can restore it
// for ghostDays. Then it is removed for good with everything tied to it (purge_ghost in the database, photos here).
const ARCHIVE_ONLY = ['archived_at', 'archived_by', 'deleted_by_owner', 'deleted_at', 'purge_after'];
const ghostDbError = e => missingTable(e) || missingColumn(e)
  ? new ApiError(503, 'delete_coming', 'Deleting profiles is being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not do that. Please try again.');
const ghostInfo = (ctx, g) => ({ id: g.id, name: g.name, course: g.course || '', classyear: g.classyear || '', email: g.email || '',
  deleted_at: g.deleted_at, purge_after: g.purge_after, days_left: Math.max(0, Math.ceil((Date.parse(g.purge_after) - ctx.now()) / 864e5)) });
// The logins of every ghost (before the SQL, nobody is one)
async function ghostUids(ctx) {
  const r = await ctx.db.from('profiles_archive').select('uid').eq('deleted_by_owner', true).limit(5000);
  return new Set(r.error ? [] : (r.data || []).map(x => x.uid));
}
// One ghost, by { uid } or { id }
async function ghostRow(ctx, q) {
  if (!q.uid && !(Number.isInteger(Number(q.id)) && Number(q.id) > 0)) throw bad('Missing or invalid profile.');
  const base = ctx.db.from('profiles_archive').select('*').eq('deleted_by_owner', true);
  const r = await (q.uid ? base.eq('uid', q.uid) : base.eq('id', Number(q.id))).limit(1);
  if (r.error) { if (missingColumn(r.error)) return null; throw ghostDbError(r.error); }
  return (r.data && r.data[0]) || null;
}
// Bring a ghost back just as it was
async function unGhost(ctx, g) {
  const ex = await ctx.db.from('profiles').select('id').eq('uid', g.uid).limit(1);
  if (ex.error) throw ghostDbError(ex.error);
  if (ex.data && ex.data.length) throw conflict('This account already has a live profile.', 'exists');
  const ins = await ctx.db.from('profiles').insert(Object.fromEntries(Object.entries(g).filter(([k]) => !ARCHIVE_ONLY.includes(k))));
  if (ins.error) throw ghostDbError(ins.error);
  const del = await ctx.db.from('profiles_archive').delete().eq('id', g.id);
  if (del.error) { await ctx.db.from('profiles').delete().eq('id', g.id); throw ghostDbError(del.error); }
  await logEvent(ctx, 'profile_restored', true, { id: g.id });
}
// Remove a ghost for good: its photos first (if that fails, nothing else goes and the next run tries again), then the rest
async function purgeGhost(ctx, g) {
  const uid = safeUid(g.uid);
  if (uid && ctx.storage) {
    const bucket = ctx.storage.from(ctx.config.profileBucket);
    for (let round = 0; round < 20; round++) {
      const l = await bucket.list(uid, { limit: 1000 });
      if (l.error) throw new ApiError(500, 'storage', 'Could not remove the photos.');
      const files = (l.data || []).filter(f => f && f.id && f.name).map(f => `${uid}/${f.name}`);
      if (!files.length) break;
      const rm = await bucket.remove(files);
      if (rm.error) throw new ApiError(500, 'storage', 'Could not remove the photos.');
    }
  }
  const r = await ctx.db.rpc('purge_ghost', { p_id: g.id });
  if (r.error) throw ghostDbError(r.error);
  await logEvent(ctx, 'profile_purged', true, { id: g.id, removed: r.data || {} });
  return r.data || {};
}
// Every ghost whose days are over (the nightly run, and the admin's Deleted profiles tab)
async function purgeDue(ctx) {
  const r = await ctx.db.from('profiles_archive').select('id,uid').eq('deleted_by_owner', true)
    .lte('purge_after', new Date(ctx.now()).toISOString()).limit(50);
  if (r.error) { if (missingColumn(r.error)) return 0; throw ghostDbError(r.error); }
  let n = 0;
  for (const g of r.data || []) {
    try { await purgeGhost(ctx, g); n++; }
    catch (e) { await logEvent(ctx, 'profile_purged', false, { id: g.id, msg: snip(e && e.message, 200) }); }
  }
  return n;
}
// The nightly run's secret, compared without giving away how much of it matched
const sameSecret = (a, b) => { a = String(a || ''); b = String(b || ''); if (!b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

// ── Friends (since 2026-10-27) ─────────────────────────────────────────
// A request waits until the other person accepts; only friends hear about each other's new photos, profile
// updates (once a day) and likes (once a day). Only the api reads friend_links; a person's friends show on
// their profile only if they chose that (friend_prefs).
const friendDbError = e => missingTable(e)
  ? new ApiError(503, 'friends_coming', 'Friends are being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
const kisumuDay = ctx => new Date(ctx.now() + 3 * 3600e3).toISOString().slice(0, 10);
const safeUid = u => /^[A-Za-z0-9_-]{1,128}$/.test(String(u || '')) ? String(u) : '';
// What on a profile counts as "an update" for friends, and how it reads ("Ann updated her best memory")
const FRIEND_FIELDS = [['bio', 'bio'], ['bestmemory', 'best memory'], ['biggestlesson', 'biggest lesson'], ['mostlikelyto', '"most likely to"'],
  ['hobbies', 'hobbies'], ['whatareyouto', 'what they are up to'], ['clubs', 'clubs']];
async function myLinks(ctx, uid) {
  const r = await ctx.db.from('friend_links').select('*').or(`from_uid.eq.${safeUid(uid)},to_uid.eq.${safeUid(uid)}`).limit(3000);
  if (r.error) throw friendDbError(r.error);
  return r.data || [];
}
// Whether someone chose to show their friends on their profile (no choice yet, or before the SQL: private)
async function friendsPublic(ctx, uid) {
  const r = await ctx.db.from('friend_prefs').select('public').eq('uid', safeUid(uid)).limit(1);
  return !r.error && !!(r.data && r.data[0] && r.data[0].public);
}
async function friendUids(ctx, uid) {
  const links = await myLinks(ctx, uid);
  return links.filter(l => l.status === 'accepted').map(l => l.from_uid === uid ? l.to_uid : l.from_uid);
}
// Tell someone's friends (in the background; a missing table or a push problem never breaks the real work)
async function tellFriends(ctx, uid, key, payload) {
  try {
    const f = await friendUids(ctx, uid);
    if (!f.length || await claimEvent(ctx, key) !== 'ok') return;
    await pushToUids(ctx, f, payload);
  } catch (e) { console.warn('[friends push]', e && e.message); }
}
// After a profile change: new photos (pushed every time) or an updated field (pushed at most once a day)
async function friendNews(ctx, row, patch) {
  if (row.isanonymous) return;
  const had = new Set([...(Array.isArray(row.photos) ? row.photos : []), row.photo_url].filter(Boolean));
  const fresh = new Set([...(patch.photos || []), patch.photo_url].filter(u => u && !had.has(u)));
  const norm = v => JSON.stringify(v == null ? '' : v);
  const changed = FRIEND_FIELDS.filter(([k]) => k in patch && (Array.isArray(patch[k]) ? patch[k].length : patch[k]) && norm(patch[k]) !== norm(row[k]));
  const name = snip(row.name, 60), url = `/profile.html?id=${row.id}`, at = new Date(ctx.now()).toISOString();
  if (fresh.size) {
    await ctx.db.from('friend_events').insert({ uid: row.uid, profile_id: row.id, kind: 'photo', n: fresh.size, created_at: at });
    await tellFriends(ctx, row.uid, `fp:${row.id}:${Math.floor(ctx.now() / 600000)}`, { title: `📸 ${name} added ${fresh.size === 1 ? 'a new photo' : fresh.size + ' new photos'}`,
      body: 'Open the yearbook to see them.', url, tag: 'fp-' + row.id });
  } else if (changed.length) {
    await ctx.db.from('friend_events').insert({ uid: row.uid, profile_id: row.id, kind: 'update', detail: changed.map(c => c[1]).join(', '), created_at: at });
    await tellFriends(ctx, row.uid, `fu:${row.id}:${kisumuDay(ctx)}`, { title: `✏️ ${name} updated their profile`,
      body: snip(`New ${changed.map(c => c[1]).join(', ')}. Have a look!`, 140), url, tag: 'fu-' + row.id });
  }
}

// A short, safe copy of an error's stack (no query strings)
const errStack = v => snip(String(v || '').replace(/\?[^\s):]*/g, ''), 1500);
// Errors that are not the yearbook's: cross-origin "Script error.", code that phone browsers and wallet apps inject
// into pages, and service-worker updates a bad connection broke (also in app.js and admin.html)
const ERROR_NOISE = /^Script error\.?$|__firefox__|ethereum|webkit\.messageHandlers|Failed to update a ServiceWorker|reading 'M_ID'/i;
const isNoise = d => ERROR_NOISE.test(String((d && d.msg) || ''));
// What kind of device a phone-notification address belongs to, from its push service
const pushDevice = host => /apple\.com$/.test(host) ? 'iPhone or Mac (Safari)' : /mozilla\.com$/.test(host) ? 'Firefox'
  : /windows\.com$/.test(host) ? 'Windows (Edge)' : /googleapis\.com$/.test(host) ? 'Android or Chrome' : 'Other';
// The kinds of line in the developer diary (ops_events), for the Activity page's filters
const DIARY_KINDS = ['client_error', 'api_error', 'push', 'backup', 'purge', 'contact_limit', 'letter_report', 'wall_report', 'glow_report',
  'profile_deleted', 'profile_restored', 'profile_purged'];

// ── The Dean of Students' dashboard (since 2026-11-01): the students database and club records ──
// Only the 'dos' office (and the super admin) reads these, and every list view and export goes in office_audit.
const DOS_COLS = 'id,name,reg,dept,course,classyear,county,country,currentcounty,whatsapp,email,clubs,isanonymous,photo_url,created_at';
// The filters the yearbook uses (school, programme, class year, county, club) and a name or reg number to search for
function dosFilters(b) {
  const f = {};
  for (const [k, max, label] of [['dept', 120, 'School'], ['course', 200, 'Programme'], ['county', 60, 'County'], ['club', 80, 'Club'], ['q', 60, 'Search']]) {
    const v = txt(b[k], max, label); if (v) f[k] = v;
  }
  if (b.classyear) f.classyear = classYear(b.classyear);
  if (f.q) { f.q = f.q.replace(/[%_*\\"(),]/g, ' ').replace(/\s+/g, ' ').trim(); if (!f.q) delete f.q; }   // searched as plain text
  return f;
}
function dosQuery(q, f) {
  if (f.dept) q = q.eq('dept', f.dept);
  if (f.course) q = q.eq('course', f.course);
  if (f.classyear) q = q.eq('classyear', f.classyear);
  if (f.county) q = q.eq('county', f.county);
  if (f.club) q = q.contains('clubs', [f.club]);
  if (f.q) q = q.or(`name.ilike."%${f.q}%",reg.ilike."%${f.q}%"`);
  return q;
}
// The trimester of a date: 1 = January–April, 2 = May–August, 3 = September–December (GLUK's three intakes)
const trimester = d => { const m = Number(String(d).slice(5, 7)); return m <= 4 ? 1 : m <= 8 ? 2 : 3; };

// ── Who's who? leaderboard (since 2026-10-13) ──────────────────────────
const kyuDbError = e => missingTable(e)
  ? new ApiError(503, 'kyu_coming', 'The leaderboard is being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
// How a player shows on the board: their yearbook name and photo, else their approved staff profile, else
// their account's name. Never the email. An anonymous yearbook profile stays anonymous here too.
async function playerCard(ctx) {
  const p = await ctx.db.from('profiles').select('name,photo_url,isanonymous').eq('uid', ctx.user.uid).limit(1);
  const row = !p.error && p.data && p.data[0];
  if (row && row.isanonymous) return { name: 'Anonymous player', photo_url: null };
  if (row && String(row.name || '').trim()) return { name: snip(row.name, 60), photo_url: row.photo_url || null };
  const s = await ctx.db.from('staff_profiles').select('name,title,photo_url').eq('uid', ctx.user.uid).eq('status', 'approved').limit(1);
  const st = !s.error && s.data && s.data[0];
  if (st && String(st.name || '').trim()) return { name: snip([st.title, st.name].filter(Boolean).join(' '), 60), photo_url: st.photo_url || null };
  return { name: snip(ctx.user.name, 60) || 'GLUK player', photo_url: null };
}
// Place on the board: 1 + everyone with a better score, the same score faster, or both the same but earlier
// Players who hid their name keep their place (the board shows their score, blurred); only removed ones have none.
// The database counts both numbers: a list of rows would stop at Supabase's 1,000-row cap.
// (Both callers save the player's row first, so `total` already includes them.)
async function kyuRank(ctx, me) {
  const board = () => ctx.db.from('kyu_board').select('uid', { count: 'exact', head: true }).eq('removed', false);
  const s = Number(me.score), sec = Number(me.seconds), at = new Date(me.achieved_at).toISOString();
  const [all, ahead] = await Promise.all([board(), me.removed ? { count: 0 } : board().neq('uid', me.uid)
    .or(`score.gt.${s},and(score.eq.${s},seconds.lt.${sec}),and(score.eq.${s},seconds.eq.${sec},achieved_at.lt."${at}")`)]);
  if (all.error || ahead.error) throw kyuDbError(all.error || ahead.error);
  return { rank: me.removed ? null : 1 + (ahead.count || 0), total: all.count || 0 };
}

// ── Think it's easy? course battle (since 2026-10-22) ──────────────────
// Each player counts for the team of their own course; the board (chal_board) averages each player's best round
// on their own profession's quiz. The same quizzes and course patterns as challenge.js.
const CHAL_TEAMS = [
  ['clinician', /clinical medicine|medical education|surgery/i], ['nurse', /nursing|midwif/i], ['teacher', /education/i],
  ['publichealth', /public health|community health|nutrition|health service/i], ['counsellor', /counsel|psycholog/i],
  ['business', /commerce|business|accounting|finance|procurement|human resource/i], ['it', /information technology|computer/i],
];
const CHAL_QUIZZES = CHAL_TEAMS.map(t => t[0]);
const chalTeam = p => { const hit = c => (CHAL_TEAMS.find(([, re]) => re.test(c || '')) || [])[0]; return (p && (hit(p.course) || hit(p.dept))) || null; };
const chalDbError = e => missingTable(e)
  ? new ApiError(503, 'chal_coming', 'The course battle is being switched on. Your next rounds will count.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');

// ── Class superlatives (since 2026-10-17) ──────────────────────────────
// Anyone with a yearbook (or approved staff) profile votes once per category for a Class of 2026 graduate, and may
// change the vote until supRevealAt. Votes stay secret until then; then the top 3 of each are shown, with no counts.
const supDbError = e => missingTable(e)
  ? new ApiError(503, 'sup_coming', 'The superlatives are being switched on. Please try again later.')
  : new ApiError(500, 'db', 'Could not save that. Please try again.');
const supOpen = ctx => ctx.now() < Date.parse(ctx.config.supRevealAt);
const supNominee = (ctx, p) => !!p && String(p.classyear || '') === ctx.config.supClass && !p.isanonymous;
const supCache = new WeakMap();                         // the public board, kept a minute per database client
async function supCategories(ctx, withHidden) {
  const r = await ctx.db.from('sup_categories').select('id,title,emoji,sort,hidden').order('sort', { ascending: true }).limit(200);
  if (r.error) throw supDbError(r.error);
  return (r.data || []).filter(c => withHidden || !c.hidden)
    .map(c => ({ id: c.id, title: c.title, emoji: c.emoji, sort: c.sort, ...(withHidden ? { hidden: c.hidden } : {}) }));
}
// Every vote, 1,000 at a time: the Supabase API never returns more than 1,000 rows to one request.
async function supAllVotes(ctx) {
  const all = [];
  for (let from = 0; from < 500000; from += 1000) {
    const v = await ctx.db.from('sup_votes').select('category_id,profile_id,voter_uid')
      .order('category_id', { ascending: true }).order('voter_uid', { ascending: true }).range(from, from + 999);
    if (v.error) throw supDbError(v.error);
    all.push(...(v.data || []));
    if ((v.data || []).length < 1000) break;
  }
  const ghosts = await ghostUids(ctx);                     // votes by someone who deleted their profile don't count
  return ghosts.size ? all.filter(v => !ghosts.has(v.voter_uid)) : all;
}
// Each category's leaders, most votes first (a tie goes to the lower profile id, so it never flickers).
// Someone who has since become anonymous, left the class or been deleted is skipped.
async function supTally(ctx, cats, top) {
  const v = { data: await supAllVotes(ctx) };
  const counts = {}, ranked = {}, ids = new Set(), people = {};
  (v.data || []).forEach(x => { const c = counts[x.category_id] = counts[x.category_id] || {}; c[x.profile_id] = (c[x.profile_id] || 0) + 1; });
  for (const cat of cats) {
    ranked[cat.id] = Object.entries(counts[cat.id] || {}).map(([pid, n]) => ({ profile_id: Number(pid), votes: n }))
      .sort((a, b) => b.votes - a.votes || a.profile_id - b.profile_id);
    ranked[cat.id].slice(0, top + 5).forEach(x => ids.add(x.profile_id));
  }
  const list = [...ids];
  for (let i = 0; i < list.length; i += 200) {
    const p = await ctx.db.from('profiles').select('id,name,photo_url,course,classyear,isanonymous').in('id', list.slice(i, i + 200));
    if (p.error) throw supDbError(p.error);
    (p.data || []).forEach(x => { people[x.id] = x; });
  }
  const results = {};
  for (const cat of cats) results[cat.id] = ranked[cat.id].filter(x => supNominee(ctx, people[x.profile_id])).slice(0, top)
    .map(x => ({ profile_id: x.profile_id, name: people[x.profile_id].name, photo_url: people[x.profile_id].photo_url || null, course: people[x.profile_id].course || '', votes: x.votes }));
  return { results, votes: (v.data || []).length, voters: new Set((v.data || []).map(x => x.voter_uid)).size };
}

// ── App traffic (since 2026-10-13): one anonymous line per page opened ──
const visitorId = v => { const s = String(v || ''); return /^[a-z0-9]{12,40}$/.test(s) ? s : ''; };

// A comment or reply only triggers a push if it really exists, was written by the caller, and is new.
function checkFreshByCaller(ctx, doc) {
  if (!doc) throw notFound();
  if (doc.authorUid !== ctx.user.uid) throw forbidden();
  const at = Date.parse(doc.createTime || '');
  return Number.isFinite(at) && ctx.now() - at <= ctx.config.notifyWindowMs;
}

// ── Actions ────────────────────────────────────────────────────────────
const ACTIONS = {
  // Who am I? (used by the admin page to show the connection status)
  async whoami(ctx) {
    return { uid: ctx.user.uid, email: ctx.user.email, emailVerified: ctx.user.emailVerified, isAdmin: ctx.isAdmin };
  },

  // Which office dashboards may I open? (office.html, and the 🏛 Office link in the top bar)
  async 'office.me'(ctx) {
    return { superAdmin: !!ctx.isSuperAdmin, offices: await loadOffices(ctx) };
  },

  // ── profiles ──
  async 'profile.create'(ctx, body) {
    if (!isObj(body.profile)) throw bad('Missing profile.');
    const p = body.profile, uid = ctx.user.uid;
    const rec = ownerFields(ctx.config, uid, p, {});
    rec.name = txt(p.name, 120, 'Name', { required: true });
    rec.dept = txt(p.dept, 120, 'School', { required: true });
    rec.course = txt(p.course, 200, 'Programme', { required: true });
    rec.classyear = classYear(p.classyear);
    if (p.isanonymous === true) rec.isanonymous = true;
    rec.uid = uid;                                                     // always the signed-in person, whatever the request says
    const ex = await ctx.db.from('profiles').select('id').eq('uid', uid).limit(1);
    if (ex.error) throw new ApiError(500, 'db', 'Could not check your profile.');
    if (ex.data && ex.data.length) throw conflict('You already have a profile.', 'exists', { id: ex.data[0].id });
    const ar = await ctx.db.from('profiles_archive').select('id,deleted_by_owner').eq('uid', uid).limit(1);
    const old = !ar.error && ar.data && ar.data[0];
    if (old && old.deleted_by_owner) throw conflict('You deleted your profile. Tap "Restore my profile" at the top of the page to bring it back.', 'ghost');
    if (old) throw conflict('Your profile is archived. Please contact the admin.', 'archived');
    const ins = await ctx.db.from('profiles').insert([rec]).select();
    if (ins.error) throw new ApiError(500, 'db', 'Could not save your profile: ' + ins.error.message);
    return { profile: ins.data[0] };
  },

  async 'profile.update'(ctx, body) {
    if (!isObj(body.patch)) throw bad('Missing changes.');
    const row = await getRow(ctx, 'profiles', body.id);
    const owner = row.uid === ctx.user.uid;
    if (!owner && !ctx.isAdmin) throw forbidden('You can only edit your own profile.');
    const patch = ownerFields(ctx.config, row.uid, body.patch, {});    // photos must sit in the profile owner's own folder
    if (ctx.isAdmin) adminFields(body.patch, patch);
    if (!Object.keys(patch).length) throw bad('Nothing to change.');
    patch.updated_at = new Date(ctx.now()).toISOString();
    const before = { ...row };                                          // what it was, for the friends' news
    const up = await ctx.db.from('profiles').update(patch).eq('id', row.id);
    if (up.error) throw new ApiError(500, 'db', 'Could not save the changes: ' + up.error.message);
    if (owner) ctx.background(friendNews(ctx, before, patch).catch(e => console.warn('[friend news]', e && e.message)));
    return {};
  },

  // Delete your own profile ({ confirm: 'DELETE' }): hidden from everyone at once, yours to restore for ghostDays
  async 'profile.delete'(ctx, body) {
    if (body.confirm !== 'DELETE') throw bad('Type DELETE to confirm.');
    const r = await ctx.db.from('profiles').select('*').eq('uid', ctx.user.uid).limit(1);
    if (r.error) throw ghostDbError(r.error);
    const row = r.data && r.data[0];
    if (!row) throw notFound('You have no profile to delete.');
    const now = ctx.now(), at = new Date(now).toISOString(), purge = new Date(now + ctx.config.ghostDays * 864e5).toISOString();
    const ghost = { ...row, archived_at: at, archived_by: ctx.user.email || ctx.user.uid, deleted_by_owner: true, deleted_at: at, purge_after: purge };
    const ins = await ctx.db.from('profiles_archive').insert(ghost);
    if (ins.error) throw ghostDbError(ins.error);
    const del = await ctx.db.from('profiles').delete().eq('id', row.id);
    if (del.error) { await ctx.db.from('profiles_archive').delete().eq('id', row.id); throw ghostDbError(del.error); }
    await ctx.db.from('push_subscriptions').delete().eq('uid', ctx.user.uid);      // a deleted profile gets no notifications
    await logEvent(ctx, 'profile_deleted', true, { id: row.id, purge_after: purge });
    return { ghost: ghostInfo(ctx, ghost) };
  },

  // Did you delete your profile? (asked when you are signed in without one, for the "Restore my profile" banner)
  async 'profile.ghost'(ctx) {
    const g = await ghostRow(ctx, { uid: ctx.user.uid });
    return { ghost: g ? ghostInfo(ctx, g) : null };
  },

  async 'profile.restore'(ctx) {
    const g = await ghostRow(ctx, { uid: ctx.user.uid });
    if (!g) throw notFound('There is no deleted profile to restore.');
    await unGhost(ctx, g);
    return { profile: { id: g.id } };
  },

  // Contact details and birthday are not in the public view (profiles_public).
  // The owner and the admin get the whole row. A classmate's contact details (never the birthday) go only to
  // people with their own yearbook or approved staff profile, and to each of them for at most contactsPerDay
  // different profiles a day, so nobody can collect every student's WhatsApp number and email.
  async 'profile.private'(ctx, body) {
    const row = await getRow(ctx, 'profiles', body.id);
    if (row.uid === ctx.user.uid || ctx.isAdmin) return { profile: row };
    if (row.isanonymous) return { profile: {} };
    if (!(await isMember(ctx))) return { profile: {}, locked: 'profile' };
    const since = new Date(ctx.now() - 24 * 3600e3).toISOString();
    const seen = await ctx.db.from('contact_views').select('profile_id').eq('uid', ctx.user.uid).gte('at', since).limit(1000);
    if (seen.error && !missingTable(seen.error)) throw new ApiError(500, 'db', 'Could not load the contact details.');
    if (!seen.error) {                                     // (before the contact_views table exists there is no daily limit)
      const opened = new Set((seen.data || []).map(r => Number(r.profile_id)));
      if (!opened.has(row.id)) {
        if (opened.size >= ctx.config.contactsPerDay) {
          // the Developer tab hears once a day about each account that hits the limit
          if (await claimEvent(ctx, `k:${ctx.user.uid}:${new Date(ctx.now()).toISOString().slice(0, 10)}`) === 'ok')
            await logEvent(ctx, 'contact_limit', false, { email: ctx.user.email, profiles: opened.size });
          return { profile: {}, locked: 'limit', limit: ctx.config.contactsPerDay };
        }
        const ins = await ctx.db.from('contact_views').insert({ uid: ctx.user.uid, profile_id: row.id, at: new Date(ctx.now()).toISOString() });
        if (ins.error && !missingTable(ins.error)) throw new ApiError(500, 'db', 'Could not load the contact details.');
      }
    }
    return { profile: { email: row.email || '', whatsapp: row.whatsapp || '',
      constituency: row.constituency || '', currentlocation: row.currentlocation || '' } };
  },

  // ── one-time upload slots (the browser then uploads straight to storage) ──
  async 'upload.sign'(ctx, body) {
    const cfg = ctx.config, bucket = String(body.bucket || ''), ctype = String(body.contentType || '').toLowerCase();
    const size = Number(body.size) || 0;
    let path;
    if (bucket === cfg.profileBucket) {
      const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      if (!types[ctype]) throw bad('Photos must be JPEG, PNG or WebP.');
      if (size > cfg.maxPhotoBytes) throw bad('That photo is too large.');
      const tag = String(body.tag || 'p').replace(/[^a-z0-9_-]/gi, '').slice(0, 20) || 'p';
      path = `${ctx.user.uid}/${ctx.now()}_${tag}.${types[ctype]}`;
    } else if (bucket === cfg.clubBucket) {
      const club = txt(body.club, 80, 'Club', { required: true });
      await requireClubManager(ctx, club);
      const okTypes = /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/;
      if (!okTypes.test(ctype)) throw bad('That file type is not allowed.');
      if (size > cfg.maxFileBytes) throw bad('That file is too large.');
      path = `${slug(club)}/${ctx.now()}_${ctx.rand()}_${safeName(body.filename)}`;
    } else throw bad('Unknown storage area.');
    const r = await ctx.storage.from(bucket).createSignedUploadUrl(path);
    if (r.error || !r.data) throw new ApiError(500, 'storage', 'Could not prepare the upload.');
    return { bucket, path: r.data.path || path, token: r.data.token, signedUrl: r.data.signedUrl || '', publicUrl: publicBase(cfg, bucket) + (r.data.path || path) };
  },

  // ── club posts / info ──
  async 'club.post.create'(ctx, body) {
    const cfg = ctx.config, club = txt(body.club, 80, 'Club', { required: true });
    await requireClubManager(ctx, club);
    const type = String(body.type || '');
    if (!cfg.postTypes.includes(type)) throw bad('Unknown post type.');
    const title = txt(body.title, 120, 'Title'), text = txt(body.body, 2000, 'Details');
    const files = fileUrls(cfg, body.file_urls, cfg.clubBucket, 8, 'Files');
    const attendees = strList(body.attendees, 300, 80, 'Attendees');
    if (type === 'notice' && !title && !text) throw bad('Add a title or some details.');
    if ((type === 'activity' || type === 'minutes') && !title) throw bad('Add a title.');
    if (type === 'event' && !title) throw bad('Give the event a name.');
    if (type === 'minutes' && !text && !files.length) throw bad('Add the minutes text or upload the file.');
    if (type === 'photo' && !files.length) throw bad('Add at least one photo.');
    const date = body.post_date ? String(body.post_date) : new Date(ctx.now()).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('Date must look like 2026-09-21.');
    if (type === 'event') {                                 // something planned: today in Kisumu (UTC+3) or later, within a year
      const today = new Date(ctx.now() + 3 * 3600e3).toISOString().slice(0, 10);
      if (date < today) throw bad("An event needs today's date or a later one.");
      if (date > new Date(ctx.now() + 400 * 864e5).toISOString().slice(0, 10)) throw bad('That date is more than a year away.');
    }
    const row = { club_name: club, type, title: title || null, body: text || null, post_date: date, file_urls: files,
      attendees: (type === 'activity' || type === 'minutes') ? attendees : [], created_by: ctx.user.uid,
      author_name: txt(body.author_name, 120, 'Author') || ctx.user.name || ctx.user.email.split('@')[0] };
    const ins = await ctx.db.from('club_posts').insert(row).select();
    if (ins.error) throw new ApiError(500, 'db', 'Could not save the post: ' + ins.error.message);
    const post = ins.data && ins.data[0];
    ctx.background(notifyClubMembers(ctx, post));          // members' phones are told after the reply is sent
    return { post };
  },

  async 'club.post.delete'(ctx, body) {
    const post = await getRow(ctx, 'club_posts', body.id);
    if (!(ctx.isAdmin || post.created_by === ctx.user.uid || await isClubOfficer(ctx, post.club_name))) throw forbidden();
    const del = await ctx.db.from('club_posts').delete().eq('id', post.id);
    if (del.error) throw new ApiError(500, 'db', 'Could not delete the post.');
    return {};
  },

  async 'club.post.pin'(ctx, body) {
    if (typeof body.pinned !== 'boolean') throw bad('pinned must be true or false.');
    const post = await getRow(ctx, 'club_posts', body.id);
    await requireClubManager(ctx, post.club_name);
    const up = await ctx.db.from('club_posts').update({ pinned: body.pinned }).eq('id', post.id);
    if (up.error) throw new ApiError(500, 'db', missingTable(up.error) || /pinned/i.test(up.error.message || '') ? 'Pinning is not set up yet (run clubs-upgrade.sql).' : 'Could not pin the post.', { code: 'pinned' });
    return {};
  },

  async 'club.info.save'(ctx, body) {
    const club = txt(body.club, 80, 'Club', { required: true });
    await requireClubManager(ctx, club);
    if (!isObj(body.info)) throw bad('Missing club details.');
    const i = body.info;
    const row = { club_name: club, about: txt(i.about, 800, 'About') || null, meeting_days: txt(i.meeting_days, 80, 'Meeting days') || null,
      meeting_place: txt(i.meeting_place, 80, 'Meeting place') || null, contact_whatsapp: phoneOrBlank(i.contact_whatsapp, 'WhatsApp number') || null,
      contact_email: emailOrBlank(i.contact_email, 'Email') || null, updated_by: ctx.user.uid, updated_at: new Date(ctx.now()).toISOString() };
    const up = await ctx.db.from('club_info').upsert(row, { onConflict: 'club_name' });
    if (up.error) throw new ApiError(500, 'db', missingTable(up.error) ? 'Club details are not set up yet (run clubs-upgrade.sql).' : 'Could not save the details.');
    return {};
  },

  // Officials' emails are not public, so the club page asks here whether the caller is listed.
  // Listed-but-unverified is reported too (the page asks them to verify); posting still needs a verified email.
  async 'club.officer.me'(ctx, body) {
    const club = txt(body.club, 80, 'Club', { required: true });
    if (!ctx.user.email) return { officer: null };
    const r = await ctx.db.from('club_officers').select('role,officer_name').eq('club_name', club).eq('officer_email', lower(ctx.user.email)).limit(1);
    if (r.error) throw new ApiError(500, 'db', 'Could not check the club officials.');
    const o = r.data && r.data[0];
    return { officer: o ? { role: o.role, officer_name: o.officer_name } : null };
  },

  // A club's posts for a signed-in student, minutes included (the public key does not read minutes)
  async 'club.feed'(ctx, body) {
    const club = txt(body.club, 80, 'Club', { required: true }), filter = String(body.filter || 'all');
    if (filter !== 'all' && !ctx.config.postTypes.includes(filter)) throw bad('Unknown filter.');
    const from = Math.max(0, Math.min(5000, Number(body.from) || 0)), size = Math.max(1, Math.min(50, Number(body.size) || 15));
    const build = withPinned => {
      let q = ctx.db.from('club_posts').select('*').eq('club_name', club);
      if (filter !== 'all') q = q.eq('type', filter);
      if (withPinned) q = q.order('pinned', { ascending: false, nullsFirst: false });
      return q.order('created_at', { ascending: false }).range(from, from + size - 1);
    };
    let r = await build(true);
    if (r.error && /pinned/i.test(r.error.message || '')) r = await build(false);   // pinning not set up
    if (r.error) throw new ApiError(500, 'db', 'Could not load the posts.');
    return { rows: r.data || [] };
  },

  // ── phone notifications ──
  // This device wants notifications for the signed-in person (a device moves to whoever signed in last).
  async 'push.subscribe'(ctx, body) {
    const s = pushSubscription(ctx.config, body.subscription), nowIso = new Date(ctx.now()).toISOString();
    const up = await ctx.db.from('push_subscriptions').upsert({ ...s, uid: ctx.user.uid, last_seen_at: nowIso }, { onConflict: 'endpoint' });
    if (up.error) throw pushDbError(up.error);
    const all = await ctx.db.from('push_subscriptions').select('id').eq('uid', ctx.user.uid).order('last_seen_at', { ascending: false });
    const extra = (all.data || []).slice(ctx.config.maxDevicesPerPerson).map(r => r.id);
    if (extra.length) await ctx.db.from('push_subscriptions').delete().in('id', extra);
    return { push: ctx.push ? 'on' : 'not_configured' };
  },

  async 'push.unsubscribe'(ctx, body) {
    const endpoint = txt(body.endpoint, 1000, 'Endpoint', { required: true });
    const del = await ctx.db.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('uid', ctx.user.uid);
    if (del.error) throw pushDbError(del.error);
    return {};
  },

  // "Send me a test" — only ever to the caller's own devices, at most once a minute.
  async 'push.test'(ctx) {
    if (!ctx.push) return { sent: 0, reason: 'not_configured' };
    const claim = await claimEvent(ctx, `t:${ctx.user.uid}:${Math.floor(ctx.now() / 60000)}`);
    if (claim !== 'ok') return { sent: 0, reason: claim };
    return pushToUids(ctx, [ctx.user.uid], { title: 'GLUK Yearbook', body: 'Notifications are working on this device 🎉', url: '/index.html', tag: 'test' });
  },

  // Comments and replies are saved straight to Firebase by the browser, which then asks for the push here.
  async 'notify.comment'(ctx, body) {
    const id = docId(body.commentId, 'comment');
    const c = await ctx.firestore('comments/' + id);
    if (!checkFreshByCaller(ctx, c)) return { sent: 0, reason: 'old' };
    const pid = Number(c.studentId);
    if (!Number.isInteger(pid) || pid <= 0) return { sent: 0 };
    const r = await ctx.db.from('profiles').select('uid').eq('id', pid).limit(1);
    const owner = r.data && r.data[0] && r.data[0].uid;
    if (!owner || owner === ctx.user.uid) return { sent: 0 };
    const claim = await claimEvent(ctx, 'c:' + id);
    if (claim !== 'ok') return { sent: 0, reason: claim };
    return pushToUids(ctx, [owner], { title: `${snip(c.authorName, 60) || 'Someone'} commented on your profile`, body: snip(c.text, 140),
      url: `/profile.html?id=${pid}#comments`, tag: 'c-' + id });
  },

  async 'notify.reply'(ctx, body) {
    const cid = docId(body.commentId, 'comment'), rid = docId(body.replyId, 'reply');
    const reply = await ctx.firestore(`comments/${cid}/replies/${rid}`);
    if (!checkFreshByCaller(ctx, reply)) return { sent: 0, reason: 'old' };
    const c = await ctx.firestore('comments/' + cid);
    if (!c || !c.authorUid || c.authorUid === ctx.user.uid) return { sent: 0 };
    const claim = await claimEvent(ctx, 'r:' + rid);
    if (claim !== 'ok') return { sent: 0, reason: claim };
    const pid = /^\d+$/.test(String(c.studentId || '')) ? c.studentId : '';
    return pushToUids(ctx, [c.authorUid], { title: `${snip(reply.authorName, 60) || 'Someone'} replied to your comment`, body: snip(reply.text, 140),
      url: pid ? `/profile.html?id=${pid}#comments` : '/index.html', tag: 'r-' + rid });
  },

  // ── comments ──
  async 'comment.create'(ctx, body) {
    const text = txt(body.text, 144, 'Comment', { required: true });
    const pid = Number(body.profileId);
    if (!Number.isInteger(pid) || pid <= 0) throw bad('Missing or invalid profile.');
    const p = await ctx.db.from('profiles').select('uid').eq('id', pid).limit(1);
    if (p.error) throw new ApiError(500, 'db', 'Could not check the profile.');
    if (!p.data || !p.data.length) throw notFound('That profile is not in the yearbook any more.');
    await commentRateLimit(ctx);
    const row = { id: ctx.newId(), profile_id: pid, author_uid: ctx.user.uid, author_name: await shownName(ctx, body), text };
    const ins = await ctx.db.from('comments').insert(row).select();
    if (ins.error) throw commentDbError(ins.error);
    const owner = p.data[0].uid;
    if (owner && owner !== ctx.user.uid) ctx.background(pushToUids(ctx, [owner], { title: `${snip(row.author_name, 60)} commented on your profile`,
      body: snip(text, 140), url: `/profile.html?id=${pid}#comments`, tag: 'c-' + row.id }));
    return { comment: (ins.data && ins.data[0]) || row };
  },

  async 'comment.reply'(ctx, body) {
    const cid = docId(body.commentId, 'comment');
    const text = txt(body.text, 144, 'Reply', { required: true });
    await commentRateLimit(ctx);
    const id = ctx.newId(), name = await shownName(ctx, body);
    const r = await ctx.db.rpc('comment_add_reply', { p_id: id, p_comment: cid, p_uid: ctx.user.uid, p_name: name, p_text: text });
    if (r.error) throw commentDbError(r.error);
    if (!r.data) throw notFound('That comment was deleted.');
    const to = r.data.comment_author;
    if (to && to !== ctx.user.uid) ctx.background(pushToUids(ctx, [to], { title: `${snip(name, 60)} replied to your comment`,
      body: snip(text, 140), url: `/profile.html?id=${Number(r.data.profile_id)}#comments`, tag: 'r-' + id }));
    return { reply: { id, comment_id: cid, author_uid: ctx.user.uid, author_name: name, text } };
  },

  // Like or unlike a comment (or one of its replies, with replyId)
  async 'comment.like'(ctx, body) {
    const cid = docId(body.commentId, 'comment');
    const rid = body.replyId == null || body.replyId === '' ? null : docId(body.replyId, 'reply');
    const r = await ctx.db.rpc('comment_toggle_like', { p_comment: cid, p_reply: rid, p_uid: ctx.user.uid });
    if (r.error) throw commentDbError(r.error);
    if (!r.data) throw notFound('That comment was deleted.');
    return { likes: Number(r.data.likes) || 0, liked: r.data.liked === true };
  },

  // ── profile likes ──
  // Sets the like to what the page asks (true or false) rather than flipping it, so a double-tap can't undo it
  async 'profile.like'(ctx, body) {
    const pid = Number(body.profileId);
    if (!Number.isInteger(pid) || pid <= 0) throw bad('Missing or invalid profile.');
    if (typeof body.like !== 'boolean') throw bad('Say whether to like or unlike.');
    const p = await ctx.db.from('profiles').select('uid').eq('id', pid).limit(1);
    if (p.error) throw new ApiError(500, 'db', 'Could not check the profile.');
    if (!p.data || !p.data.length) throw notFound('That profile is not in the yearbook any more.');
    const r = await ctx.db.rpc('profile_set_like', { p_profile: pid, p_uid: ctx.user.uid, p_like: body.like });
    if (r.error) throw likeDbError(r.error);
    const owner = p.data[0].uid;
    if (body.like && r.data && r.data.changed === true && owner && owner !== ctx.user.uid) {
      ctx.background(notifyLike(ctx, pid, owner));
      ctx.background((async () => {
        const o = await ctx.db.from('profiles').select('name,isanonymous').eq('id', pid).limit(1);
        const who = o.data && o.data[0];
        if (!who || who.isanonymous) return;
        await tellFriends(ctx, owner, `fl:${pid}:${kisumuDay(ctx)}`, { title: `❤️ ${snip(who.name, 60)}'s profile is getting likes today`,
          body: 'Show your friend some love too.', url: `/profile.html?id=${pid}`, tag: 'fl-' + pid });
      })().catch(e => console.warn('[friend likes push]', e && e.message)));
    }
    return { likes: Number(r.data && r.data.likes) || 0, liked: body.like };
  },

  // ── staff profiles ──
  // The caller's own staff profile, whatever its status (the public only ever sees approved ones)
  async 'staff.mine'(ctx) {
    return { staff: await myStaff(ctx) };
  },

  // Create or edit your own. A new one waits for the admin; edits keep their status, except a new name, title,
  // position, rank or leadership role on an approved profile, which the admin checks again.
  async 'staff.save'(ctx, body) {
    if (!isObj(body.staff)) throw bad('Missing staff profile.');
    const rec = staffFields(ctx, body.staff), old = await myStaff(ctx);
    const recheck = old && old.status === 'approved' && STAFF_CHECKED.some(k => k in old && (rec[k] || null) !== (old[k] || null));
    const write = r => old
      ? ctx.db.from('staff_profiles').update({ ...r, updated_at: new Date(ctx.now()).toISOString(), ...(recheck ? { status: 'pending' } : {}) }).eq('id', old.id)
      : ctx.db.from('staff_profiles').insert({ ...r, uid: ctx.user.uid, status: 'pending' });
    let w = await write(rec);
    if (w.error && missingColumn(w.error)) w = await write(withoutChart(rec));       // before the staff_chart migration
    if (w.error && missingColumn(w.error)) w = await write(withoutDetails(rec));     // before the staff_details migration
    if (w.error) throw w.error.code === '23505' ? conflict('You already have a staff profile.', 'exists') : staffDbError(w.error);
    return { staff: await myStaff(ctx) };
  },

  async 'staff.delete'(ctx) {
    const old = await myStaff(ctx);
    if (!old) throw notFound('You have no staff profile.');
    const del = await ctx.db.from('staff_profiles').delete().eq('id', old.id);
    if (del.error) throw staffDbError(del.error);
    return {};
  },

  // ── student leaders ──
  // The roles on your own profile: the ones the admin added for you and your own claims, whatever their status
  async 'leaders.mine'(ctx) {
    const me = await myProfile(ctx);
    if (!me) return { profile: null, rows: [] };
    const r = await ctx.db.from('student_leaders').select(LEADER_COLS).eq('profile_id', me.id)
      .order('term_from', { ascending: false }).limit(50);
    if (r.error) throw leaderDbError(r.error);
    return { profile: { id: me.id, anonymous: !!me.isanonymous }, rows: (r.data || []).map(ownLeader) };
  },

  // Claim a role on your own profile ({ leader }), or change a claim of yours ({ id, leader }).
  // Either way it waits for the admin: nothing shows on the site before then.
  async 'leaders.claim'(ctx, body) {
    if (!isObj(body.leader)) throw bad('Missing role.');
    const me = await myProfile(ctx);
    if (!me) throw forbidden('Create your yearbook profile first, then add your role.');
    if (me.isanonymous) throw forbidden('Your profile is anonymous, and a leadership role would show your name. Ask the admin instead.');
    const rec = leaderFields(ctx, body.leader), nowIso = new Date(ctx.now()).toISOString();
    if (body.id != null) {
      const row = await getRow(ctx, 'student_leaders', body.id);
      if (row.claimed_by !== ctx.user.uid || Number(row.profile_id) !== Number(me.id)) throw forbidden('You can only change roles you added yourself.');
      const up = await ctx.db.from('student_leaders').update({ ...rec, status: 'pending', updated_at: nowIso }).eq('id', row.id).select(LEADER_COLS);
      if (up.error) throw leaderDbError(up.error);
      return { leader: ownLeader(up.data[0]) };
    }
    const have = await ctx.db.from('student_leaders').select('id,status').eq('profile_id', me.id).limit(100);
    if (have.error) throw leaderDbError(have.error);
    const rows = have.data || [];
    if (rows.length >= 12) throw conflict('That is a lot of roles! Ask the admin to add any more.', 'too_many');
    if (rows.filter(x => x.status === 'pending').length >= 4) throw conflict('The admin has not checked your other roles yet. Add more once they have.', 'too_many');
    const ins = await ctx.db.from('student_leaders').insert({ ...rec, profile_id: me.id, name: snip(me.name, 120), claimed_by: ctx.user.uid,
      status: 'pending', created_at: nowIso, updated_at: nowIso }).select(LEADER_COLS);
    if (ins.error) throw leaderDbError(ins.error);
    return { leader: ownLeader(ins.data[0]) };
  },

  // Take back a role you added yourself. One the admin added stays: ask the admin.
  async 'leaders.withdraw'(ctx, body) {
    const row = await getRow(ctx, 'student_leaders', body.id);
    if (row.claimed_by !== ctx.user.uid) throw forbidden('Only the admin can remove this one.');
    const del = await ctx.db.from('student_leaders').delete().eq('id', row.id);
    if (del.error) throw leaderDbError(del.error);
    return {};
  },

  // ── Letters to the Class of 2026 ──
  // Everything the letters page needs. Letters written to you are only a count until the letters open.
  // countOnly: just how many are waiting for you (the Home page).
  async 'letters.mine'(ctx, body) {
    const uid = ctx.user.uid, open = lettersOpen(ctx), countOnly = !!body.countOnly;
    const [mine, forMe, wall] = await Promise.all([
      countOnly ? { data: [] } : ctx.db.from('letters').select(LETTER_MINE).eq('author_uid', uid).order('created_at', { ascending: false }).limit(200),
      ctx.db.from('letters').select(open ? 'id,to_kind,author_name,author_uid,body,created_at' : 'id,author_uid').eq('to_uid', uid)
        .eq('removed', false).eq('hidden', false).order('created_at', { ascending: false }).limit(500),
      countOnly ? { count: 0 } : ctx.db.from('letters').select('id', { count: 'exact', head: true }).eq('on_wall', true).eq('hidden', false),
    ]);
    const err = mine.error || forMe.error || wall.error;
    if (err) throw letterDbError(err);
    const ghosts = await ghostUids(ctx);                     // a letter from someone who deleted their profile waits with them
    const got = (forMe.data || []).filter(l => !ghosts.has(l.author_uid)).map(({ author_uid, ...l }) => l);
    return { openAt: ctx.config.lettersOpenAt, open, written: (mine.data || []).map(ownLetter),
      forMe: { count: got.length, letters: open ? got : [] }, wallCount: wall.count || 0 };
  },

  // Write a new letter ({ to, profileId?, body, share? }) or change one of yours before they open ({ id, body, share? })
  async 'letters.save'(ctx, body) {
    const cfg = ctx.config, uid = ctx.user.uid, now = new Date(ctx.now()).toISOString();
    const text = txt(body.body, 2000, 'Your letter', { required: true });
    if (body.id != null) {
      const row = await letterRow(ctx, body.id);
      if (row.author_uid !== uid) throw forbidden('You can only change your own letters.');
      if (lettersOpen(ctx)) throw conflict('Letters have opened, so this one has been delivered and can no longer be changed.', 'delivered');
      const patch = { body: text, updated_at: now };
      if (row.to_kind === 'self') patch.on_wall = !!body.share;
      const up = await ctx.db.from('letters').update(patch).eq('id', row.id);
      if (up.error) throw letterDbError(up.error);
      return { letter: ownLetter({ ...row, ...patch }) };
    }
    const kind = String(body.to || '');
    if (!LETTER_KINDS.includes(kind)) throw bad('Choose who the letter is for.');
    const since = new Date(ctx.now() - 24 * 3600e3).toISOString();
    const recent = await ctx.db.from('letters').select('id', { count: 'exact', head: true }).eq('author_uid', uid).gte('created_at', since);
    if (recent.error) throw letterDbError(recent.error);
    if ((recent.count || 0) >= cfg.lettersPerPerson) throw new ApiError(429, 'slow_down', 'You have written a lot of letters today. Please try again tomorrow.');
    const rec = { author_uid: uid, author_name: await signedName(ctx), to_kind: kind, to_profile: null, to_uid: null, to_name: null,
      body: text, on_wall: kind === 'class', hidden: false, removed: false, reported: false, created_at: now, updated_at: now };
    if (kind === 'graduate') {
      const pid = Number(body.profileId);
      if (!Number.isInteger(pid) || pid <= 0) throw bad('Choose the graduate you are writing to.');
      const p = await ctx.db.from('profiles').select('id,uid,name,classyear,isanonymous').eq('id', pid).limit(1);
      if (p.error) throw letterDbError(p.error);
      const g = p.data && p.data[0];
      if (!g) throw notFound('That graduate could not be found.');
      if (String(g.classyear || '') !== cfg.lettersClass) throw bad(`Letters go to the Class of ${cfg.lettersClass}.`);
      if (g.isanonymous) throw bad('This graduate keeps their profile anonymous, so letters cannot be addressed to them.');
      if (g.uid === uid) throw bad('To write to yourself, choose "My first-year self".');
      Object.assign(rec, { to_profile: g.id, to_uid: g.uid, to_name: snip(g.name, 80) });
    } else if (kind === 'self') {
      Object.assign(rec, { to_uid: uid, on_wall: !!body.share });
    }
    const ins = await ctx.db.from('letters').insert(rec).select('id');
    if (ins.error) throw letterDbError(ins.error);
    const saved = { ...rec, id: (Array.isArray(ins.data) ? ins.data[0] : ins.data).id };
    ctx.background(notifyLetter(ctx, saved));
    return { letter: ownLetter(saved) };
  },

  // The writer can take a letter back at any time
  async 'letters.delete'(ctx, body) {
    const row = await letterRow(ctx, body.id);
    if (row.author_uid !== ctx.user.uid) throw forbidden('You can only delete your own letters.');
    const del = await ctx.db.from('letters').delete().eq('id', row.id);
    if (del.error) throw letterDbError(del.error);
    return {};
  },

  // The graduate a letter was written to can remove it from their letters
  async 'letters.remove'(ctx, body) {
    const row = await letterRow(ctx, body.id);
    if (row.to_uid !== ctx.user.uid || row.to_kind !== 'graduate') throw forbidden();
    const up = await ctx.db.from('letters').update({ removed: true }).eq('id', row.id);
    if (up.error) throw letterDbError(up.error);
    return {};
  },

  // Ask the admin to look at a letter: one written to you, or one on the wall once it is public
  async 'letters.report'(ctx, body) {
    const row = await letterRow(ctx, body.id);
    const toMe = row.to_uid === ctx.user.uid && row.to_kind === 'graduate';
    const onWall = row.on_wall && !row.hidden && lettersOpen(ctx);
    if (!toMe && !onWall) throw forbidden();
    const up = await ctx.db.from('letters').update({ reported: true }).eq('id', row.id);
    if (up.error) throw letterDbError(up.error);
    await logEvent(ctx, 'letter_report', true, { id: row.id, kind: row.to_kind });
    return {};
  },

  // ── Who's who? ──
  // A signed-in round starts here, so the api can time it
  async 'kyu.start'(ctx) {
    const since = new Date(ctx.now() - 3600e3).toISOString();
    const recent = await ctx.db.from('kyu_runs').select('id', { count: 'exact', head: true }).eq('uid', ctx.user.uid).gte('started_at', since);
    if (recent.error) throw kyuDbError(recent.error);
    if ((recent.count || 0) >= ctx.config.kyuPerHour) throw new ApiError(429, 'slow_down', 'You have played a lot this hour. Take a break and try again later.');
    const ins = await ctx.db.from('kyu_runs').insert({ uid: ctx.user.uid, started_at: new Date(ctx.now()).toISOString() }).select('id');
    if (ins.error) throw kyuDbError(ins.error);
    return { run: (Array.isArray(ins.data) ? ins.data[0] : ins.data).id };
  },

  // The round's score ({ run, score }). Its time is the api's own, from kyu.start; the best round goes on the board.
  async 'kyu.finish'(ctx, body) {
    const cfg = ctx.config, uid = ctx.user.uid, nowIso = new Date(ctx.now()).toISOString();
    const id = Number(body.run), score = body.score;
    if (!Number.isInteger(id) || id <= 0) throw bad('Missing or invalid round.');
    if (!Number.isInteger(score) || score < 0 || score > cfg.kyuRound) throw bad(`The score must be from 0 to ${cfg.kyuRound}.`);
    const r = await ctx.db.from('kyu_runs').select('*').eq('id', id).eq('uid', uid).limit(1);
    if (r.error) throw kyuDbError(r.error);
    const run = r.data && r.data[0];
    if (!run) throw notFound('That round could not be found.');
    if (run.finished_at) throw conflict('That round has already been counted.', 'counted');
    const seconds = Math.round((ctx.now() - Date.parse(run.started_at)) / 1000);
    if (seconds < cfg.kyuMinSeconds) throw bad('That was too fast to be a real round.');
    if (seconds > 3600) throw conflict('That round was started too long ago to count.', 'stale');
    const up = await ctx.db.from('kyu_runs').update({ finished_at: nowIso, score, seconds }).eq('id', id);
    if (up.error) throw kyuDbError(up.error);
    const b = await ctx.db.from('kyu_board').select('*').eq('uid', uid).limit(1);
    if (b.error) throw kyuDbError(b.error);
    const old = b.data && b.data[0];
    const better = !old || score > old.score || (score === old.score && seconds < old.seconds);
    const row = { uid, ...(await playerCard(ctx)), plays: (old ? old.plays : 0) + 1, updated_at: nowIso,
      hidden: old ? old.hidden : false, removed: old ? old.removed : false,
      ...(better ? { score, seconds, achieved_at: nowIso } : { score: old.score, seconds: old.seconds, achieved_at: old.achieved_at }) };
    const w = await ctx.db.from('kyu_board').upsert(row, { onConflict: 'uid' });
    if (w.error) throw kyuDbError(w.error);
    return { score, seconds, best: { score: row.score, seconds: row.seconds }, newBest: better && !!old, first: !old,
      hidden: !!row.hidden, removed: !!row.removed, ...(await kyuRank(ctx, row)) };
  },

  // Your own line on the board (the leaderboard on the page shows it)
  async 'kyu.me'(ctx) {
    const b = await ctx.db.from('kyu_board').select('*').eq('uid', ctx.user.uid).limit(1);
    if (b.error) throw kyuDbError(b.error);
    const me = b.data && b.data[0];
    if (!me) return { me: null };
    return { me: { name: me.name, score: me.score, seconds: me.seconds, plays: me.plays, hidden: !!me.hidden, removed: !!me.removed, ...(await kyuRank(ctx, me)) } };
  },

  // Hide your name on the board (your score stays, blurred), or show it again; the admin's removal is separate
  async 'kyu.hide'(ctx, body) {
    if (typeof body.hidden !== 'boolean') throw bad('Say whether to hide or show.');
    const up = await ctx.db.from('kyu_board').update({ hidden: body.hidden, updated_at: new Date(ctx.now()).toISOString() }).eq('uid', ctx.user.uid);
    if (up.error) throw kyuDbError(up.error);
    return { hidden: body.hidden };
  },

  // ── Glow Up: Then vs Now ──
  // Your own glow-up (if any), how many are sealed so far, and whether the gallery is open
  async 'glow.mine'(ctx) {
    const [g, c] = await Promise.all([
      ctx.db.from('glowups').select(GLOW_MINE).eq('uid', ctx.user.uid).limit(1),
      ctx.db.from('glowups').select('uid', { count: 'exact', head: true }).eq('hidden', false),
    ]);
    if (g.error || c.error) throw glowDbError(g.error || c.error);
    return { glow: ownGlow(g.data && g.data[0]), count: c.count || 0, open: glowOpen(ctx), revealAt: ctx.config.glowRevealAt };
  },

  // Add or change yours ({ then_url, now_url, then_year?, caption? }). Both photos must be your own uploads.
  async 'glow.save'(ctx, body) {
    const cfg = ctx.config, uid = ctx.user.uid, now = new Date(ctx.now()).toISOString();
    const p = await ctx.db.from('profiles').select('id,classyear,isanonymous').eq('uid', uid).limit(1);
    if (p.error) throw glowDbError(p.error);
    const prof = p.data && p.data[0];
    if (!prof) throw conflict('Create your yearbook profile first, then add your Glow Up.', 'no_profile');
    if (String(prof.classyear || '') !== cfg.lettersClass) throw bad(`Glow Up is for the Class of ${cfg.lettersClass}.`);
    if (prof.isanonymous) throw bad('Your profile is anonymous. Show your name on it to add a Glow Up.');
    if (!body.then_url || !body.now_url) throw bad('Add both photos: one from then and one from now.');
    const [thenUrl] = fileUrls(cfg, [body.then_url], cfg.profileBucket, 1, 'The "then" photo', uid);
    const [nowUrl] = fileUrls(cfg, [body.now_url], cfg.profileBucket, 1, 'The "now" photo', uid);
    if (thenUrl === nowUrl) throw bad('Use two different photos.');
    let year = null;
    if (body.then_year != null && body.then_year !== '') {
      year = Number(body.then_year);
      if (!Number.isInteger(year) || year < 2015 || year > 2026) throw bad('Choose the year the first photo was taken.');
    }
    const caption = txt(body.caption, 140, 'The caption');
    const old = await ctx.db.from('glowups').select('*').eq('uid', uid).limit(1);
    if (old.error) throw glowDbError(old.error);
    const was = old.data && old.data[0];
    const row = { uid, profile_id: prof.id, then_url: thenUrl, now_url: nowUrl, then_year: year, caption,
      hidden: was ? !!was.hidden : false, reported: was ? !!was.reported : false,
      created_at: was ? was.created_at : now, updated_at: now };
    const w = await ctx.db.from('glowups').upsert(row, { onConflict: 'uid' });
    if (w.error) throw glowDbError(w.error);
    return { glow: ownGlow(row) };
  },

  async 'glow.delete'(ctx) {
    const del = await ctx.db.from('glowups').delete().eq('uid', ctx.user.uid);
    if (del.error) throw glowDbError(del.error);
    return {};
  },

  // Ask the admin to look at a glow-up in the gallery ({ profileId })
  async 'glow.report'(ctx, body) {
    const pid = Number(body.profileId);
    if (!Number.isInteger(pid) || pid <= 0) throw bad('Missing or invalid glow-up.');
    if (!glowOpen(ctx)) throw forbidden();
    const r = await ctx.db.from('glowups').select('uid,hidden').eq('profile_id', pid).limit(1);
    if (r.error) throw glowDbError(r.error);
    const row = r.data && r.data[0];
    if (!row || row.hidden) throw notFound('That glow-up could not be found.');
    const up = await ctx.db.from('glowups').update({ reported: true }).eq('profile_id', pid);
    if (up.error) throw glowDbError(up.error);
    await logEvent(ctx, 'glow_report', true, { profile_id: pid });
    return {};
  },

  // ── Time capsule ──
  // Your class, its graduation day if posted, and your capsule notes: sealed ones are only dates until it opens
  async 'capsule.mine'(ctx) {
    const st = await capsuleState(ctx);
    const r = await ctx.db.from('capsules').select(st.open ? 'id,body,photo_url,created_at' : 'id,photo_url,created_at')
      .eq('uid', ctx.user.uid).order('created_at', { ascending: true }).limit(100);
    if (r.error) throw capDbError(r.error);
    const rows = (r.data || []).map(x => st.open ? x : { id: x.id, created_at: x.created_at, has_photo: !!x.photo_url });
    return { hasProfile: !!st.prof, classyear: st.classyear, opensAt: st.opensAt, open: st.open, capsules: rows };
  },

  // Seal a note ({ body, photo_url? }): the photo must be your own upload
  async 'capsule.save'(ctx, body) {
    const cfg = ctx.config, uid = ctx.user.uid;
    const st = await capsuleState(ctx);
    if (!st.prof) throw conflict('Create your yearbook profile first, so we know your class.', 'no_profile');
    const text = txt(body.body, 4000, 'Your note', { required: true });
    const photo = body.photo_url ? fileUrls(cfg, [body.photo_url], cfg.profileBucket, 1, 'The photo', uid)[0] : null;
    const n = await ctx.db.from('capsules').select('id', { count: 'exact', head: true }).eq('uid', uid);
    if (n.error) throw capDbError(n.error);
    if ((n.count || 0) >= cfg.capsulesPerPerson) throw new ApiError(429, 'slow_down', `Your time capsule is full (${cfg.capsulesPerPerson} notes).`);
    const rec = { uid, body: text, photo_url: photo, created_at: new Date(ctx.now()).toISOString() };
    const ins = await ctx.db.from('capsules').insert(rec).select('id');
    if (ins.error) throw capDbError(ins.error);
    return { capsule: { id: (Array.isArray(ins.data) ? ins.data[0] : ins.data).id, created_at: rec.created_at, has_photo: !!photo } };
  },

  async 'capsule.delete'(ctx, body) {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) throw bad('Missing or invalid note.');
    const del = await ctx.db.from('capsules').delete().eq('id', id).eq('uid', ctx.user.uid);
    if (del.error) throw capDbError(del.error);
    return {};
  },

  // ── The class wall ──
  // Your own posts (with the names of the people you tagged), how many of each kind are sealed, and which are open
  async 'wall.mine'(ctx) {
    const me = await myProfile(ctx);
    const [mine, ...cs] = await Promise.all([
      me ? ctx.db.from('grad_posts').select(WALL_COLS).eq('uid', ctx.user.uid).order('created_at', { ascending: true }).limit(100) : { data: [] },
      ...WALL_KINDS.map(k => ctx.db.from('grad_posts').select('id', { count: 'exact', head: true }).eq('kind', k).eq('hidden', false)),
    ]);
    const err = mine.error || (cs.find(c => c.error) || {}).error;
    if (err) throw wallDbError(err);
    const rows = mine.data || [], ids = [...new Set(rows.map(x => x.tagged_profile).filter(Boolean))], names = {};
    if (ids.length) {
      const p = await ctx.db.from('profiles').select('id,name').in('id', ids);
      (p.data || []).forEach(x => { names[x.id] = x.name; });
    }
    const counts = Object.fromEntries(WALL_KINDS.map((k, i) => [k, cs[i].count || 0]));
    const open = Object.fromEntries(WALL_KINDS.map(k => [k, wallOpen(ctx, k)]));
    return { profile: me ? { id: me.id, anonymous: !!me.isanonymous } : null, mine: rows.map(x => ({ ...x, tagged_name: names[x.tagged_profile] || null })),
      counts, open, opens: ctx.config.wallOpens, limits: ctx.config.wallLimits };
  },

  // Add a post: { kind, year? (memory), role + profileId (tag: replaces your earlier tag for that role), title (song), body }
  async 'wall.save'(ctx, body) {
    const cfg = ctx.config, uid = ctx.user.uid, kind = String(body.kind || '');
    if (!WALL_KINDS.includes(kind)) throw bad('Unknown kind of post.');
    const me = await myProfile(ctx);
    if (!me) throw conflict('Create your yearbook profile first, then add to the class wall.', 'no_profile');
    const rec = { uid, profile_id: me.id, kind, year: null, tag_role: null, tagged_profile: null, title: null, body: '', hidden: false, reported: false,
      created_at: new Date(ctx.now()).toISOString() };
    let tagged = null;
    if (kind === 'memory') {
      const y = Number(body.year);
      if (!Number.isInteger(y) || y < 2015 || y > 2026) throw bad('Choose the year it happened.');
      rec.year = y; rec.body = txt(body.body, 600, 'Your memory', { required: true });
    } else if (kind === 'tag') {
      const role = String(body.role || '');
      if (!WALL_ROLES[role]) throw bad('Choose who they are to you.');
      const pid = Number(body.profileId);
      if (!Number.isInteger(pid) || pid <= 0) throw bad('Choose a classmate.');
      const p = await ctx.db.from('profiles').select('id,uid,name,isanonymous').eq('id', pid).limit(1);
      if (p.error) throw wallDbError(p.error);
      tagged = p.data && p.data[0];
      if (!tagged) throw notFound('That classmate could not be found.');
      if (tagged.isanonymous) throw bad('That profile is anonymous, so it cannot be tagged.');
      if (tagged.id === me.id) throw bad('Tag a classmate, not yourself!');
      Object.assign(rec, { tag_role: role, tagged_profile: tagged.id, body: txt(body.body, 200, 'A line about them') });
    } else if (kind === 'song') {
      rec.title = txt(body.title, 120, 'The song', { required: true });
      if (rec.title.length < 2) throw bad('Write the song and who sings it.');
      rec.body = txt(body.body, 200, 'Why this song');
    } else {
      rec.body = txt(body.body, kind === 'advice' ? 400 : 300, kind === 'advice' ? 'Your advice' : 'Your inside joke', { required: true });
    }
    const have = await ctx.db.from('grad_posts').select('id,tag_role').eq('uid', uid).eq('kind', kind).limit(100);
    if (have.error) throw wallDbError(have.error);
    const same = kind === 'tag' ? (have.data || []).find(x => x.tag_role === rec.tag_role) : null;
    if (!same && (have.data || []).length >= cfg.wallLimits[kind]) throw new ApiError(429, 'slow_down', `You have added ${cfg.wallLimits[kind]} already. Delete one to add another.`);
    const w = same ? await ctx.db.from('grad_posts').update({ tagged_profile: rec.tagged_profile, body: rec.body, hidden: false, reported: false, created_at: rec.created_at }).eq('id', same.id).select(WALL_COLS)
      : await ctx.db.from('grad_posts').insert(rec).select(WALL_COLS);
    if (w.error) throw wallDbError(w.error);
    const row = Array.isArray(w.data) ? w.data[0] : w.data;
    // the person tagged hears that someone tagged them, but not who, until My People day
    if (tagged && tagged.uid && tagged.uid !== uid) ctx.background((async () => {
      if (await claimEvent(ctx, `wt:${uid}:${rec.tag_role}:${tagged.id}`) !== 'ok') return;
      const open = wallOpen(ctx, 'tag');
      await pushToUids(ctx, [tagged.uid], { title: `🫂 Someone tagged you as their ${WALL_ROLES[rec.tag_role]}`,
        body: open ? 'See who on the class wall.' : 'Find out who on Wednesday 18 November, My People day.', url: '/wall.html?d=mypeople', tag: 'wt-' + row.id });
    })().catch(e => console.warn('[wall tag push]', e)));
    return { post: { ...row, tagged_name: tagged ? tagged.name : null } };
  },

  async 'wall.delete'(ctx, body) {
    const row = await wallRow(ctx, body.id);
    if (row.uid !== ctx.user.uid) throw forbidden('You can only delete your own posts.');
    const del = await ctx.db.from('grad_posts').delete().eq('id', row.id);
    if (del.error) throw wallDbError(del.error);
    return {};
  },

  // Ask the admin to look at a post on the wall (once it is public)
  async 'wall.report'(ctx, body) {
    const row = await wallRow(ctx, body.id);
    if (row.hidden || !wallOpen(ctx, row.kind)) throw forbidden();
    const up = await ctx.db.from('grad_posts').update({ reported: true }).eq('id', row.id);
    if (up.error) throw wallDbError(up.error);
    await logEvent(ctx, 'wall_report', true, { id: row.id, kind: row.kind });
    return {};
  },

  // ── Friends ──
  // Your friend requests and friendships, as the other person's profile and where it stands
  async 'friend.mine'(ctx) {
    const uid = ctx.user.uid;
    const links = await myLinks(ctx, uid);
    return { links: links.map(l => ({ id: l.id, profile_id: l.from_uid === uid ? l.to_profile : l.from_profile, status: l.status, dir: l.from_uid === uid ? 'out' : 'in' })),
      public: await friendsPublic(ctx, uid) };
  },

  // Show your friends on your profile, or keep them to yourself ({ public })
  async 'friend.privacy'(ctx, body) {
    if (typeof body.public !== 'boolean') throw bad('Say whether your friends list is public.');
    const w = await ctx.db.from('friend_prefs').upsert({ uid: ctx.user.uid, public: body.public, updated_at: new Date(ctx.now()).toISOString() }, { onConflict: 'uid' });
    if (w.error) throw friendDbError(w.error);
    return { public: body.public };
  },

  // Someone's friends, when they chose to show them ({ profileId }). Anonymous friends are left out.
  async 'friend.list'(ctx, body) {
    const pid = Number(body.profileId);
    if (!Number.isInteger(pid) || pid <= 0) throw bad('Missing or invalid profile.');
    const p = await ctx.db.from('profiles').select('id,uid,isanonymous').eq('id', pid).limit(1);
    if (p.error) throw friendDbError(p.error);
    const who = p.data && p.data[0];
    if (!who || !who.uid || who.isanonymous || !(await friendsPublic(ctx, who.uid))) return { public: false, friends: [] };
    const ids = (await myLinks(ctx, who.uid)).filter(l => l.status === 'accepted').map(l => l.from_uid === who.uid ? l.to_profile : l.from_profile);
    const friends = [];
    for (let i = 0; i < ids.length; i += 200) {
      const r = await ctx.db.from('profiles').select('id,name,photo_url,course,isanonymous').in('id', ids.slice(i, i + 200));
      if (r.error) throw friendDbError(r.error);
      (r.data || []).filter(x => !x.isanonymous).forEach(x => friends.push({ id: x.id, name: snip(x.name, 60), photo_url: x.photo_url || null, course: x.course || '' }));
    }
    friends.sort((a, b) => a.name.localeCompare(b.name));
    return { public: true, friends };
  },

  // Ask someone to be your friend ({ profileId }). If they already asked you, this accepts their request.
  async 'friend.request'(ctx, body) {
    const cfg = ctx.config, uid = ctx.user.uid, nowIso = new Date(ctx.now()).toISOString();
    const me = await myProfile(ctx);
    if (!me) throw conflict('Create your yearbook profile first, then add friends.', 'no_profile');
    const pid = Number(body.profileId);
    if (!Number.isInteger(pid) || pid <= 0) throw bad('Missing or invalid profile.');
    const p = await ctx.db.from('profiles').select('id,uid,name,isanonymous').eq('id', pid).limit(1);
    if (p.error) throw friendDbError(p.error);
    const them = p.data && p.data[0];
    if (!them || !them.uid) throw notFound('That profile could not be found.');
    if (them.uid === uid) throw bad('That is your own profile!');
    if (them.isanonymous) throw bad('This profile is anonymous, so it cannot be added as a friend.');
    const ex = (await myLinks(ctx, uid)).find(l => l.from_uid === them.uid || l.to_uid === them.uid);
    if (ex && ex.status === 'accepted') return { status: 'accepted', id: ex.id };
    if (ex && ex.from_uid === uid) return { status: 'pending', id: ex.id };
    if (ex) {                                                   // they asked first: accept
      const up = await ctx.db.from('friend_links').update({ status: 'accepted', accepted_at: nowIso }).eq('id', ex.id);
      if (up.error) throw friendDbError(up.error);
      ctx.background(pushToUids(ctx, [them.uid], { title: `🤝 ${snip(me.name, 60)} accepted your friend request`, body: 'You will now hear when they add photos or update their profile.',
        url: `/profile.html?id=${me.id}`, tag: 'fa-' + ex.id }).catch(() => {}));
      return { status: 'accepted', id: ex.id };
    }
    const since = new Date(ctx.now() - 24 * 3600e3).toISOString();
    const n = await ctx.db.from('friend_links').select('id', { count: 'exact', head: true }).eq('from_uid', uid).gte('created_at', since);
    if (n.error) throw friendDbError(n.error);
    if ((n.count || 0) >= cfg.friendRequestsPerDay) throw new ApiError(429, 'slow_down', 'You have sent a lot of friend requests today. Please try again tomorrow.');
    const ins = await ctx.db.from('friend_links').insert({ from_uid: uid, to_uid: them.uid, from_profile: me.id, to_profile: them.id, status: 'pending', created_at: nowIso }).select('id');
    if (ins.error) throw ins.error.code === '23505' ? conflict('You are already connected.', 'exists') : friendDbError(ins.error);
    const id = (Array.isArray(ins.data) ? ins.data[0] : ins.data).id;
    ctx.background((async () => {
      if (await claimEvent(ctx, `fr:${uid}:${them.uid}`) !== 'ok') return;   // one push per pair, even after a re-request
      await pushToUids(ctx, [them.uid], { title: `🤝 ${snip(me.name, 60)} wants to be your friend`, body: 'Open the yearbook to accept.', url: `/profile.html?id=${me.id}`, tag: 'fr-' + id });
    })().catch(e => console.warn('[friend request push]', e && e.message)));
    return { status: 'pending', id };
  },

  // Accept or decline a request someone sent you ({ id, accept })
  async 'friend.respond'(ctx, body) {
    const uid = ctx.user.uid, id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) throw bad('Missing or invalid request.');
    const r = await ctx.db.from('friend_links').select('*').eq('id', id).limit(1);
    if (r.error) throw friendDbError(r.error);
    const row = r.data && r.data[0];
    if (!row || row.to_uid !== uid || row.status !== 'pending') throw notFound('That friend request is no longer there.');
    if (!body.accept) {
      const del = await ctx.db.from('friend_links').delete().eq('id', id);
      if (del.error) throw friendDbError(del.error);
      return { status: null };
    }
    const up = await ctx.db.from('friend_links').update({ status: 'accepted', accepted_at: new Date(ctx.now()).toISOString() }).eq('id', id);
    if (up.error) throw friendDbError(up.error);
    const me = await myProfile(ctx);
    if (me) ctx.background(pushToUids(ctx, [row.from_uid], { title: `🤝 ${snip(me.name, 60)} accepted your friend request`, body: 'You will now hear when they add photos or update their profile.',
      url: `/profile.html?id=${me.id}`, tag: 'fa-' + id }).catch(() => {}));
    return { status: 'accepted' };
  },

  // Cancel your request, decline theirs, or unfriend ({ profileId })
  async 'friend.remove'(ctx, body) {
    const uid = ctx.user.uid, pid = Number(body.profileId);
    if (!Number.isInteger(pid) || pid <= 0) throw bad('Missing or invalid profile.');
    const link = (await myLinks(ctx, uid)).find(l => (l.from_uid === uid ? l.to_profile : l.from_profile) === pid);
    if (!link) return {};
    const del = await ctx.db.from('friend_links').delete().eq('id', link.id);
    if (del.error) throw friendDbError(del.error);
    return {};
  },

  // For the Alerts tab: requests waiting for you, requests of yours that were accepted, and your friends' news
  // (new photos, profile updates, likes per day) from the last 14 days
  async 'friend.activity'(ctx) {
    const uid = ctx.user.uid, since = new Date(ctx.now() - 14 * 864e5).toISOString();
    const links = await myLinks(ctx, uid);
    const items = [];
    for (const l of links) {
      if (l.status === 'pending' && l.to_uid === uid) items.push({ type: 'freq', id: l.id, profile_id: l.from_profile, at: l.created_at });
      if (l.status === 'accepted' && l.from_uid === uid && l.accepted_at && l.accepted_at >= since) items.push({ type: 'faccept', profile_id: l.to_profile, at: l.accepted_at });
    }
    const friends = links.filter(l => l.status === 'accepted').map(l => l.from_uid === uid ? { uid: l.to_uid, pid: l.to_profile } : { uid: l.from_uid, pid: l.from_profile });
    if (friends.length) {
      const fu = friends.map(x => x.uid), fp = friends.map(x => x.pid);
      const [ev, lk] = await Promise.all([
        ctx.db.from('friend_events').select('profile_id,kind,n,detail,created_at').in('uid', fu.slice(0, 500)).gte('created_at', since).order('created_at', { ascending: false }).limit(200),
        ctx.db.from('profile_likes').select('profile_id,created_at').in('profile_id', fp.slice(0, 500)).gte('created_at', since).limit(5000),
      ]);
      (ev.data || []).forEach(e => items.push({ type: e.kind === 'photo' ? 'fphoto' : 'fupdate', profile_id: e.profile_id, n: e.n, detail: e.detail, at: e.created_at }));
      const days = {};
      (lk.data || []).forEach(x => { const k = x.profile_id + '|' + new Date(Date.parse(x.created_at) + 3 * 3600e3).toISOString().slice(0, 10);
        const d = days[k] = days[k] || { type: 'flikes', profile_id: x.profile_id, n: 0, at: x.created_at }; d.n++; if (x.created_at > d.at) d.at = x.created_at; });
      items.push(...Object.values(days));
    }
    const ids = [...new Set(items.map(x => x.profile_id))], people = {};
    if (ids.length) {
      const p = await ctx.db.from('profiles').select('id,name,photo_url,isanonymous').in('id', ids);
      (p.data || []).forEach(x => { people[x.id] = x; });
    }
    return { items: items.filter(x => people[x.profile_id] && !people[x.profile_id].isanonymous)
      .map(x => ({ ...x, name: snip(people[x.profile_id].name, 60), photo_url: people[x.profile_id].photo_url || null })) };
  },

  // ── app errors (no sign-in needed): kept for the Developer tab ──
  async err(ctx, body) {
    const since = new Date(ctx.now() - 60e3).toISOString();
    const recent = await ctx.db.from('ops_events').select('kind', { count: 'exact', head: true }).eq('kind', 'client_error').gte('created_at', since);
    if (recent.error || (recent.count || 0) >= ctx.config.errorsPerMinute) return { kept: false };
    if (ERROR_NOISE.test(String(body.msg || ''))) return { kept: false };      // not the yearbook's own code
    const line = Number(body.line) || 0, col = Number(body.col) || 0;
    await logEvent(ctx, 'client_error', false, { msg: snip(body.msg, 300) || 'Error', page: snip(body.page, 120), file: snip(body.file, 200),
      line: line > 0 && line < 1e6 ? Math.floor(line) : 0, col: col > 0 && col < 1e6 ? Math.floor(col) : 0,
      stack: errStack(body.stack), kind: snip(body.kind, 20), ua: snip(body.ua, 160), signedIn: body.signedIn === true });
    return { kept: true };
  },

  // ── Think it's easy? course battle ──
  // A signed-in round starts here, so the api can time it: { quiz }
  async 'chal.start'(ctx, body) {
    const quiz = String(body.quiz || '');
    if (!CHAL_QUIZZES.includes(quiz)) throw bad('Unknown quiz.');
    const since = new Date(ctx.now() - 3600e3).toISOString();
    const recent = await ctx.db.from('chal_runs').select('id', { count: 'exact', head: true }).eq('uid', ctx.user.uid).gte('started_at', since);
    if (recent.error) throw chalDbError(recent.error);
    if ((recent.count || 0) >= ctx.config.chalPerHour) throw new ApiError(429, 'slow_down', 'You have played a lot this hour. Take a break and try again later.');
    const ins = await ctx.db.from('chal_runs').insert({ uid: ctx.user.uid, quiz, started_at: new Date(ctx.now()).toISOString() }).select('id');
    if (ins.error) throw chalDbError(ins.error);
    return { run: (Array.isArray(ins.data) ? ins.data[0] : ins.data).id };
  },

  // The round's score ({ run, score }). It counts for the player's team when they have a yearbook profile
  // and played their own profession's quiz; their best round per quiz is kept either way.
  async 'chal.finish'(ctx, body) {
    const cfg = ctx.config, uid = ctx.user.uid, nowIso = new Date(ctx.now()).toISOString();
    const id = Number(body.run), score = body.score;
    if (!Number.isInteger(id) || id <= 0) throw bad('Missing or invalid round.');
    if (!Number.isInteger(score) || score < 0 || score > cfg.chalRound) throw bad(`The score must be from 0 to ${cfg.chalRound}.`);
    const r = await ctx.db.from('chal_runs').select('*').eq('id', id).eq('uid', uid).limit(1);
    if (r.error) throw chalDbError(r.error);
    const run = r.data && r.data[0];
    if (!run) throw notFound('That round could not be found.');
    if (run.finished_at) throw conflict('That round has already been counted.', 'counted');
    const seconds = Math.round((ctx.now() - Date.parse(run.started_at)) / 1000);
    if (seconds < cfg.chalMinSeconds) throw bad('That was too fast to be a real round.');
    if (seconds > 3600) throw conflict('That round was started too long ago to count.', 'stale');
    const up = await ctx.db.from('chal_runs').update({ finished_at: nowIso, score, seconds }).eq('id', id);
    if (up.error) throw chalDbError(up.error);
    const me = await ctx.db.from('profiles').select('id,course,dept').eq('uid', uid).limit(1);
    if (me.error) throw chalDbError(me.error);
    const prof = me.data && me.data[0];
    if (!prof) return { score, seconds, counted: false, reason: 'profile' };
    const team = chalTeam(prof);
    const b = await ctx.db.from('chal_best').select('*').eq('uid', uid).eq('quiz', run.quiz).limit(1);
    if (b.error) throw chalDbError(b.error);
    const old = b.data && b.data[0];
    const better = !old || score > old.score || (score === old.score && seconds < old.seconds);
    const row = { uid, quiz: run.quiz, profile_id: prof.id, team, plays: (old ? old.plays : 0) + 1, updated_at: nowIso,
      ...(better ? { score, seconds, achieved_at: nowIso } : { score: old.score, seconds: old.seconds, achieved_at: old.achieved_at }) };
    const w = await ctx.db.from('chal_best').upsert(row, { onConflict: 'uid,quiz' });
    if (w.error) throw chalDbError(w.error);
    return { score, seconds, team, counted: team === run.quiz, reason: team === run.quiz ? null : team ? 'other_quiz' : 'no_team',
      best: { score: row.score, seconds: row.seconds }, newBest: better && !!old };
  },

  // ── Class superlatives ──
  // The categories, for everyone; once voting has closed, the top 3 of each (no vote counts). No sign-in needed.
  async 'sup.board'(ctx) {
    const hit = supCache.get(ctx.db);
    if (hit && ctx.now() - hit.at < 60e3) return hit.data;
    const open = supOpen(ctx), categories = await supCategories(ctx, false);
    let data;
    if (open) {
      const n = await ctx.db.from('sup_votes').select('category_id', { count: 'exact', head: true });
      data = { open, revealAt: ctx.config.supRevealAt, categories, votes: n.error ? 0 : (n.count || 0) };
    } else {
      const t = await supTally(ctx, categories, 3);
      const results = Object.fromEntries(Object.entries(t.results).map(([k, list]) => [k, list.map(({ votes, ...x }) => x)]));
      data = { open, revealAt: ctx.config.supRevealAt, categories, votes: t.votes, results };
    }
    supCache.set(ctx.db, { at: ctx.now(), data });
    return data;
  },

  // Your own votes, and whether you may vote
  async 'sup.mine'(ctx) {
    const canVote = await isMember(ctx);
    const r = await ctx.db.from('sup_votes').select('category_id,profile_id').eq('voter_uid', ctx.user.uid).limit(500);
    if (r.error) throw supDbError(r.error);
    const ids = [...new Set((r.data || []).map(x => Number(x.profile_id)))], people = {};
    if (ids.length) {
      const p = await ctx.db.from('profiles').select('id,name,photo_url,course').in('id', ids);
      (p.data || []).forEach(x => { people[x.id] = x; });
    }
    const votes = {};
    (r.data || []).forEach(x => { const p = people[x.profile_id]; if (p) votes[x.category_id] = { profile_id: p.id, name: p.name, photo_url: p.photo_url || null, course: p.course || '' }; });
    return { canVote, open: supOpen(ctx), revealAt: ctx.config.supRevealAt, votes };
  },

  // Vote, or change your vote, in one category: { category, profileId }
  async 'sup.vote'(ctx, body) {
    const uid = ctx.user.uid, nowIso = new Date(ctx.now()).toISOString();
    if (!supOpen(ctx)) throw conflict('Voting has closed. The winners are out!', 'closed');
    const cat = Number(body.category), pid = Number(body.profileId);
    if (!Number.isInteger(cat) || cat <= 0) throw bad('Choose a category.');
    if (!Number.isInteger(pid) || pid <= 0) throw bad('Choose a graduate.');
    if (!(await isMember(ctx))) throw forbidden('Create your yearbook profile to vote.');
    const c = await ctx.db.from('sup_categories').select('id,hidden').eq('id', cat).limit(1);
    if (c.error) throw supDbError(c.error);
    if (!c.data || !c.data[0] || c.data[0].hidden) throw notFound('That category is not taking votes.');
    const p = await ctx.db.from('profiles').select('id,uid,name,photo_url,course,classyear,isanonymous').eq('id', pid).limit(1);
    if (p.error) throw supDbError(p.error);
    const g = p.data && p.data[0];
    if (!g) throw notFound('That graduate could not be found.');
    if (!supNominee(ctx, g)) throw bad(`You can vote for graduates of the Class of ${ctx.config.supClass} (not anonymous profiles).`);
    if (g.uid === uid) throw bad('You cannot vote for yourself!');
    const old = await ctx.db.from('sup_votes').select('category_id').eq('category_id', cat).eq('voter_uid', uid).limit(1);
    if (old.error) throw supDbError(old.error);
    const w = old.data && old.data.length
      ? await ctx.db.from('sup_votes').update({ profile_id: g.id, updated_at: nowIso }).eq('category_id', cat).eq('voter_uid', uid)
      : await ctx.db.from('sup_votes').insert({ category_id: cat, voter_uid: uid, profile_id: g.id, created_at: nowIso, updated_at: nowIso });
    if (w.error) throw supDbError(w.error);
    return { vote: { category_id: cat, profile_id: g.id, name: g.name, photo_url: g.photo_url || null, course: g.course || '' } };
  },

  // Take back your vote in one category: { category }
  async 'sup.unvote'(ctx, body) {
    if (!supOpen(ctx)) throw conflict('Voting has closed.', 'closed');
    const cat = Number(body.category);
    if (!Number.isInteger(cat) || cat <= 0) throw bad('Choose a category.');
    const d = await ctx.db.from('sup_votes').delete().eq('category_id', cat).eq('voter_uid', ctx.user.uid);
    if (d.error) throw supDbError(d.error);
    return {};
  },

  // ── app traffic ── (the one action that needs no sign-in; it stores no name, account or IP)
  async hit(ctx, body) {
    const page = String(body.page || ''), visitor = visitorId(body.visitor);
    if (!ctx.config.trackPages.includes(page) || !visitor) return { counted: false };
    const since = new Date(ctx.now() - 60e3).toISOString();
    const recent = await ctx.db.from('page_views').select('id', { count: 'exact', head: true }).eq('visitor', visitor).gte('at', since);
    if (recent.error) { if (missingTable(recent.error)) return { counted: false }; throw new ApiError(500, 'db', 'Could not count that.'); }
    if ((recent.count || 0) >= 30) return { counted: false };          // a page every 2 seconds for a minute: not a person reading
    const item = typeof body.item === 'string' ? snip(body.item, 120) || null : null;
    const ins = await ctx.db.from('page_views').insert({ at: new Date(ctx.now()).toISOString(), page, item, visitor,
      signed_in: body.signedIn === true, app: body.app === true, phone: body.phone === true });
    if (ins.error) { if (missingTable(ins.error)) return { counted: false }; throw new ApiError(500, 'db', 'Could not count that.'); }
    return { counted: true };
  },

  // ── admin only ──
  // Who visits, where they go and when (the Developer tab). Profile and staff ids come back with their names.
  async 'admin.dev.traffic'(ctx) {
    requireAdmin(ctx);
    const r = await ctx.db.rpc('dev_traffic');
    if (r.error) {
      throw missingTable(r.error) || /dev_traffic/.test(r.error.message || '')
        ? new ApiError(500, 'traffic_missing', 'Traffic counting is not set up yet (run the quiz_and_traffic migration).')
        : new ApiError(500, 'db', 'Could not load the traffic numbers.');
    }
    const t = r.data || {}, names = {};
    const ids = page => [...new Set((t.items || []).filter(i => i.page === page && /^\d{1,12}$/.test(String(i.item))).map(i => Number(i.item)))];
    const pids = ids('profile'), sids = ids('staff');
    if (pids.length) {
      const p = await ctx.db.from('profiles').select('id,name,isanonymous').in('id', pids);
      (p.data || []).forEach(x => { names['profile:' + x.id] = x.isanonymous ? 'An anonymous profile' : x.name; });
    }
    if (sids.length) {
      const s = await ctx.db.from('staff_profiles').select('id,name,title').in('id', sids);
      (s.data || []).forEach(x => { names['staff:' + x.id] = [x.title, x.name].filter(Boolean).join(' '); });
    }
    return { at: new Date(ctx.now()).toISOString(), traffic: t, names };
  },

  // Every club's posts, minutes included, 20 at a time (Moderation › Posts)
  async 'admin.club.posts'(ctx, body) {
    requireAdmin(ctx);
    const from = Math.max(0, Math.min(50000, Number(body.from) || 0));
    let q = ctx.db.from('club_posts').select('*').order('created_at', { ascending: false }).range(from, from + 19);
    if (body.club) q = q.eq('club_name', txt(body.club, 80, 'Club'));
    const r = await q;
    if (r.error) throw new ApiError(500, missingTable(r.error) ? 'club_tables_missing' : 'db', 'Could not load the posts.');
    return { rows: r.data || [] };
  },

  // Superlatives: every category (hidden ones too) with its leaders and their votes so far, and how many have voted
  async 'admin.sup.list'(ctx) {
    requireAdmin(ctx);
    const categories = await supCategories(ctx, true);
    const t = await supTally(ctx, categories, 5);
    return { categories, results: t.results, votes: t.votes, voters: t.voters, open: supOpen(ctx), revealAt: ctx.config.supRevealAt };
  },

  // Add a category ({ title, emoji? }) or change one ({ id, title?, emoji?, hidden?, sort? })
  async 'admin.sup.category'(ctx, body) {
    requireAdmin(ctx);
    const patch = {};
    if (body.title !== undefined) {
      patch.title = txt(body.title, 80, 'Category', { required: true });
      if (patch.title.length < 3) throw bad('The category needs a few more letters.');
    }
    if (body.emoji !== undefined) patch.emoji = txt(body.emoji, 16, 'Emoji', { required: true });
    if (body.hidden !== undefined) { if (typeof body.hidden !== 'boolean') throw bad('hidden must be true or false.'); patch.hidden = body.hidden; }
    if (body.sort !== undefined) { if (!Number.isInteger(body.sort)) throw bad('sort must be a whole number.'); patch.sort = body.sort; }
    if (body.id == null) {
      if (!patch.title) throw bad('Give the category a title.');
      const last = await ctx.db.from('sup_categories').select('sort').order('sort', { ascending: false }).limit(1);
      if (last.error) throw supDbError(last.error);
      const top = (last.data && last.data[0] && last.data[0].sort) || 0;
      const ins = await ctx.db.from('sup_categories').insert({ emoji: '🏆', sort: top + 10, hidden: false, ...patch });
      if (ins.error) throw supDbError(ins.error);
    } else {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) throw bad('Missing or invalid category.');
      if (!Object.keys(patch).length) throw bad('Nothing to change.');
      const up = await ctx.db.from('sup_categories').update(patch).eq('id', id);
      if (up.error) throw supDbError(up.error);
    }
    supCache.delete(ctx.db);                              // the public board shows the change straight away
    return { categories: await supCategories(ctx, true) };
  },

  // The Who's who? board with the logins, so the admin can take off anyone who cheated
  async 'admin.kyu.list'(ctx) {
    requireAdmin(ctx);
    const r = await ctx.db.from('kyu_board').select('uid,name,score,seconds,plays,hidden,removed,achieved_at')
      .order('score', { ascending: false }).order('seconds', { ascending: true }).limit(300);
    if (r.error) throw kyuDbError(r.error);
    return { rows: r.data || [] };
  },

  async 'admin.kyu.review'(ctx, body) {
    requireAdmin(ctx);
    const uid = String(body.uid || '');
    if (!/^[A-Za-z0-9]{1,128}$/.test(uid)) throw bad('Missing or invalid player.');
    if (typeof body.removed !== 'boolean') throw bad('Say whether to remove or restore.');
    const up = await ctx.db.from('kyu_board').update({ removed: body.removed }).eq('uid', uid);
    if (up.error) throw kyuDbError(up.error);
    return {};
  },

  async 'admin.staff.list'(ctx) {
    requireAdmin(ctx);
    const r = await ctx.db.from('staff_profiles').select('*').order('created_at', { ascending: false }).limit(1000);
    if (r.error) throw staffDbError(r.error);
    return { rows: r.data || [] };
  },

  // Approve, hide or send back to pending. The staff member's phone hears when they go live.
  async 'admin.staff.review'(ctx, body) {
    requireAdmin(ctx);
    const status = String(body.status || '');
    if (!STAFF_STATUS.includes(status)) throw bad('Unknown status.');
    const row = await getRow(ctx, 'staff_profiles', body.id), was = row.status;
    const up = await ctx.db.from('staff_profiles').update({ status, reviewed_at: new Date(ctx.now()).toISOString(), reviewed_by: ctx.user.email }).eq('id', row.id);
    if (up.error) throw staffDbError(up.error);
    if (status === 'approved' && was !== 'approved') ctx.background(pushToUids(ctx, [row.uid], { title: 'Your staff profile is live 🎓',
      body: 'Students can now see it on the GLUK Yearbook.', url: `/staff.html?id=${row.id}`, tag: 's-' + row.id }));
    return {};
  },

  async 'admin.staff.delete'(ctx, body) {
    requireAdmin(ctx);
    const row = await getRow(ctx, 'staff_profiles', body.id);
    const del = await ctx.db.from('staff_profiles').delete().eq('id', row.id);
    if (del.error) throw staffDbError(del.error);
    return {};
  },

  // Student leaders: every entry, claims waiting for approval too, with the linked profiles
  async 'admin.leaders.list'(ctx) {
    requireAdmin(ctx);
    const r = await ctx.db.from('student_leaders').select(LEADER_COLS)
      .order('term_from', { ascending: false }).order('id', { ascending: false }).limit(2000);
    if (r.error) throw leaderDbError(r.error);
    const rows = r.data || [], ids = [...new Set(rows.map(x => Number(x.profile_id)).filter(Boolean))], profiles = {};
    for (let i = 0; i < ids.length; i += 200) {
      const p = await ctx.db.from('profiles').select('id,name,photo_url,course,classyear,isanonymous').in('id', ids.slice(i, i + 200));
      if (p.error) throw leaderDbError(p.error);
      (p.data || []).forEach(x => { profiles[x.id] = x; });
    }
    return { rows, profiles };
  },

  // Add a leader ({ leader }) or change one ({ id, leader }). Only the admin sets the name, the linked profile,
  // a photo, an honour (e.g. President emeritus) and the status. A leader the admin adds is live straight away.
  async 'admin.leaders.save'(ctx, body) {
    requireAdmin(ctx);
    if (!isObj(body.leader)) throw bad('Missing leader.');
    const p = body.leader, rec = leaderFields(ctx, p), nowIso = new Date(ctx.now()).toISOString();
    const old = body.id != null ? await getRow(ctx, 'student_leaders', body.id) : null, was = old ? old.status : null;
    let profile = null;
    if (p.profile_id !== undefined && p.profile_id !== null && p.profile_id !== '') {
      const pid = Number(p.profile_id);
      if (!Number.isInteger(pid) || pid <= 0) throw bad('Invalid profile.');
      const r = await ctx.db.from('profiles').select('id,uid,name,isanonymous').eq('id', pid).limit(1);
      if (r.error) throw leaderDbError(r.error);
      profile = r.data && r.data[0];
      if (!profile) throw notFound('That profile could not be found.');
      if (profile.isanonymous) throw bad('That profile is anonymous: linking it would show who it is.');
    }
    rec.profile_id = profile ? profile.id : null;
    rec.name = txt(p.name, 120, 'Name') || (profile ? snip(profile.name, 120) : '');
    if (rec.name.length < 2) throw bad('Write their name.');
    rec.honour = txt(p.honour, 60, 'Honour') || null;
    rec.photo_url = !p.photo_url ? null : old && p.photo_url === old.photo_url ? old.photo_url
      : fileUrls(ctx.config, [p.photo_url], ctx.config.profileBucket, 1, 'Photo', ctx.user.uid)[0];
    const status = p.status === undefined ? (was || 'approved') : String(p.status);
    if (!LEADER_STATUS.includes(status)) throw bad('Unknown status.');
    rec.status = status;
    rec.updated_at = nowIso;
    if (was !== status) Object.assign(rec, { reviewed_at: nowIso, reviewed_by: ctx.user.email });
    const w = old ? await ctx.db.from('student_leaders').update(rec).eq('id', old.id).select(LEADER_COLS)
      : await ctx.db.from('student_leaders').insert({ ...rec, created_at: nowIso }).select(LEADER_COLS);
    if (w.error) throw leaderDbError(w.error);
    const row = w.data[0];
    if (status === 'approved' && was !== 'approved') ctx.background(notifyLeader(ctx, row));
    return { leader: row };
  },

  // Approve, hide or send back to pending. The student's phone hears when their role goes live.
  async 'admin.leaders.review'(ctx, body) {
    requireAdmin(ctx);
    const status = String(body.status || '');
    if (!LEADER_STATUS.includes(status)) throw bad('Unknown status.');
    const row = await getRow(ctx, 'student_leaders', body.id), was = row.status, nowIso = new Date(ctx.now()).toISOString();
    const up = await ctx.db.from('student_leaders').update({ status, reviewed_at: nowIso, reviewed_by: ctx.user.email }).eq('id', row.id);
    if (up.error) throw leaderDbError(up.error);
    if (status === 'approved' && was !== 'approved') ctx.background(notifyLeader(ctx, { ...row, status }));
    return {};
  },

  async 'admin.leaders.delete'(ctx, body) {
    requireAdmin(ctx);
    const row = await getRow(ctx, 'student_leaders', body.id);
    const del = await ctx.db.from('student_leaders').delete().eq('id', row.id);
    if (del.error) throw leaderDbError(del.error);
    return {};
  },

  // Letters the admin may see: the wall ones (to check before and after they open) and any someone reported.
  // A private letter nobody reported never leaves its writer and reader.
  async 'admin.letters.list'(ctx) {
    requireAdmin(ctx);
    const cols = 'id,author_name,to_kind,to_name,body,on_wall,hidden,reported,removed,created_at';
    const [wall, flagged] = await Promise.all([
      ctx.db.from('letters').select(cols).eq('on_wall', true).order('created_at', { ascending: false }).limit(1000),
      ctx.db.from('letters').select(cols).eq('reported', true).order('created_at', { ascending: false }).limit(500),
    ]);
    if (wall.error || flagged.error) throw letterDbError(wall.error || flagged.error);
    const seen = new Set(), rows = [];
    for (const r of [...(flagged.data || []), ...(wall.data || [])]) if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
    return { rows, openAt: ctx.config.lettersOpenAt };
  },

  // Hide or show a letter; either way its report is dealt with
  async 'admin.letters.review'(ctx, body) {
    requireAdmin(ctx);
    const row = await letterRow(ctx, body.id);
    const up = await ctx.db.from('letters').update({ hidden: !!body.hidden, reported: false }).eq('id', row.id);
    if (up.error) throw letterDbError(up.error);
    return {};
  },

  // App and server errors of the last 14 days (newest first) for the Developer tab
  async 'admin.dev.errors'(ctx) {
    requireAdmin(ctx);
    const since = new Date(ctx.now() - 14 * 864e5).toISOString();
    const r = await ctx.db.from('ops_events').select('kind,details,created_at').in('kind', ['client_error', 'api_error'])
      .gte('created_at', since).order('created_at', { ascending: false }).limit(1000);
    if (r.error) throw new ApiError(500, 'db', 'Could not load the errors.');
    return { rows: r.data || [] };
  },

  // Graduation days: every class's posted day, and how many capsule notes wait in each class
  async 'admin.graddays.list'(ctx) {
    requireAdmin(ctx);
    const [g, c] = await Promise.all([
      ctx.db.from('grad_days').select('classyear,opens_at,posted_at').order('classyear', { ascending: true }),
      ctx.db.from('capsules').select('uid').limit(10000),
    ]);
    if (g.error || c.error) throw capDbError(g.error || c.error);
    const uids = [...new Set((c.data || []).map(x => x.uid))], byUid = {};
    for (let i = 0; i < uids.length; i += 500) {
      const p = await ctx.db.from('profiles').select('uid,classyear').in('uid', uids.slice(i, i + 500));
      if (!p.error) (p.data || []).forEach(x => { byUid[x.uid] = String(x.classyear || ''); });
    }
    const waiting = {};
    (c.data || []).forEach(x => { const y = byUid[x.uid] || '?'; waiting[y] = (waiting[y] || 0) + 1; });
    return { rows: g.data || [], waiting };
  },

  // Post (or move) a class's graduation day ({ classyear, date: 'YYYY-MM-DD' }); capsules open at 00:00 in Kisumu.
  // Students of that class with capsule notes hear about it on their phones.
  async 'admin.gradday.save'(ctx, body) {
    requireAdmin(ctx);
    const classyear = String(body.classyear || '').trim(), date = String(body.date || '').trim();
    if (!/^20[0-9]{2}$/.test(classyear)) throw bad('Enter the class year, e.g. 2027.');
    if (!/^20[0-9]{2}-[01][0-9]-[0-3][0-9]$/.test(date) || isNaN(Date.parse(date + 'T00:00:00+03:00'))) throw bad('Choose the graduation date.');
    const opensAt = new Date(Date.parse(date + 'T00:00:00+03:00')).toISOString();
    const w = await ctx.db.from('grad_days').upsert({ classyear, opens_at: opensAt, posted_at: new Date(ctx.now()).toISOString() }, { onConflict: 'classyear' });
    if (w.error) throw capDbError(w.error);
    ctx.background((async () => {
      const p = await ctx.db.from('profiles').select('uid').eq('classyear', classyear).limit(5000);
      const uids = (p.data || []).map(x => x.uid).filter(Boolean);
      if (!uids.length) return;
      const c = await ctx.db.from('capsules').select('uid').in('uid', uids).limit(10000);
      const who = [...new Set((c.data || []).map(x => x.uid))];
      if (!who.length || await claimEvent(ctx, 'gd:' + classyear + ':' + date) !== 'ok') return;
      const day = new Date(opensAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' });
      await pushToUids(ctx, who, { title: '📦 Your graduation day is set', body: `Your time capsule opens on ${day}.`, url: '/capsule.html', tag: 'gd-' + classyear });
    })().catch(e => console.warn('[gradday push]', e)));
    return { row: { classyear, opens_at: opensAt } };
  },

  async 'admin.gradday.delete'(ctx, body) {
    requireAdmin(ctx);
    const classyear = String(body.classyear || '').trim();
    if (!/^20[0-9]{2}$/.test(classyear)) throw bad('Missing class year.');
    const del = await ctx.db.from('grad_days').delete().eq('classyear', classyear);
    if (del.error) throw capDbError(del.error);
    return {};
  },

  // The class wall: every post (reported first), with the names of who wrote it and who was tagged
  async 'admin.wall.list'(ctx) {
    requireAdmin(ctx);
    const r = await ctx.db.from('grad_posts').select('id,profile_id,kind,year,tag_role,tagged_profile,title,body,hidden,reported,created_at')
      .order('created_at', { ascending: false }).limit(1000);
    if (r.error) throw wallDbError(r.error);
    const rows = r.data || [], ids = [...new Set(rows.flatMap(x => [x.profile_id, x.tagged_profile]).filter(Boolean))], names = {};
    for (let i = 0; i < ids.length; i += 200) {
      const p = await ctx.db.from('profiles').select('id,name').in('id', ids.slice(i, i + 200));
      if (!p.error) (p.data || []).forEach(x => { names[x.id] = x.name; });
    }
    rows.sort((a, b) => (b.reported ? 1 : 0) - (a.reported ? 1 : 0));
    return { rows: rows.map(x => ({ ...x, name: names[x.profile_id] || '', tagged_name: names[x.tagged_profile] || null })), opens: ctx.config.wallOpens };
  },

  async 'admin.wall.review'(ctx, body) {
    requireAdmin(ctx);
    const row = await wallRow(ctx, body.id);
    const up = await ctx.db.from('grad_posts').update({ hidden: !!body.hidden, reported: false }).eq('id', row.id);
    if (up.error) throw wallDbError(up.error);
    return {};
  },

  // What's new: the admin's announcements of app updates (the newest first)
  async 'admin.news.list'(ctx) {
    requireAdmin(ctx);
    const r = await ctx.db.from('announcements').select('*').order('created_at', { ascending: false }).limit(100);
    if (r.error) throw friendDbError(r.error);
    return { rows: r.data || [] };
  },

  // Post one ({ emoji?, title, body?, url?, push? }): everyone sees it in Alerts; push (default) also tells every phone
  async 'admin.news.save'(ctx, body) {
    requireAdmin(ctx);
    const title = txt(body.title, 120, 'The title', { required: true });
    if (title.length < 3) throw bad('The title needs a few more letters.');
    const text = txt(body.body, 600, 'The text'), emoji = txt(body.emoji, 16, 'The emoji') || '✨';
    const url = txt(body.url, 300, 'The link');
    if (url && !/^\/[A-Za-z0-9._~\/?#=&%+-]*$/.test(url)) throw bad('The link must be a page of the yearbook, like /grad.html.');
    const at = new Date(ctx.now()).toISOString();
    const ins = await ctx.db.from('announcements').insert({ emoji, title, body: text, url: url || null, hidden: false, created_at: at }).select('id');
    if (ins.error) throw friendDbError(ins.error);
    const id = (Array.isArray(ins.data) ? ins.data[0] : ins.data).id;
    if (body.push !== false) ctx.background((async () => {
      const all = [];
      for (let from = 0; from < 50000; from += 1000) {
        const r = await ctx.db.from('push_subscriptions').select('uid').order('id', { ascending: true }).range(from, from + 999);
        if (r.error) break;
        all.push(...(r.data || []).map(x => x.uid));
        if ((r.data || []).length < 1000) break;
      }
      await pushToUids(ctx, [...new Set(all)], { title: `${emoji} ${title}`, body: snip(text, 140) || 'Open the yearbook to see what is new.', url: url || '/index.html', tag: 'n-' + id });
    })().catch(e => console.warn('[news push]', e && e.message)));
    return { row: { id, emoji, title, body: text, url: url || null, hidden: false, created_at: at } };
  },

  async 'admin.news.hide'(ctx, body) {
    requireAdmin(ctx);
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) throw bad('Missing or invalid announcement.');
    const up = await ctx.db.from('announcements').update({ hidden: !!body.hidden }).eq('id', id);
    if (up.error) throw friendDbError(up.error);
    return {};
  },

  // Glow Up: every glow-up (reported first) with the graduate's name
  async 'admin.glow.list'(ctx) {
    requireAdmin(ctx);
    const r = await ctx.db.from('glowups').select('profile_id,then_url,now_url,then_year,caption,hidden,reported,created_at,updated_at')
      .order('updated_at', { ascending: false }).limit(1000);
    if (r.error) throw glowDbError(r.error);
    const rows = r.data || [], ids = rows.map(x => x.profile_id);
    const names = {};
    if (ids.length) {
      const p = await ctx.db.from('profiles').select('id,name,course').in('id', ids);
      if (!p.error) (p.data || []).forEach(x => { names[x.id] = x; });
    }
    rows.sort((a, b) => (b.reported ? 1 : 0) - (a.reported ? 1 : 0));
    return { rows: rows.map(x => ({ ...x, name: (names[x.profile_id] || {}).name || '', course: (names[x.profile_id] || {}).course || '' })),
      revealAt: ctx.config.glowRevealAt };
  },

  // Hide or show a glow-up ({ profileId, hidden }); either way its report is dealt with
  async 'admin.glow.review'(ctx, body) {
    requireAdmin(ctx);
    const pid = Number(body.profileId);
    if (!Number.isInteger(pid) || pid <= 0) throw bad('Missing or invalid glow-up.');
    const up = await ctx.db.from('glowups').update({ hidden: !!body.hidden, reported: false }).eq('profile_id', pid);
    if (up.error) throw glowDbError(up.error);
    return {};
  },

  async 'admin.comment.delete'(ctx, body) {
    requireAdmin(ctx);
    const del = await ctx.db.from('comments').delete().eq('id', docId(body.commentId, 'comment'));   // its replies go with it
    if (del.error) throw commentDbError(del.error);
    return {};
  },

  async 'admin.reply.delete'(ctx, body) {
    requireAdmin(ctx);
    const r = await ctx.db.rpc('comment_delete_reply', { p_comment: docId(body.commentId, 'comment'), p_reply: docId(body.replyId, 'reply') });
    if (r.error) throw commentDbError(r.error);
    return { deleted: r.data === true };
  },

  // Everything the admin page's Developer tab shows, in one call.
  async 'admin.dev.stats'(ctx) {
    requireAdmin(ctx);
    const weekAgo = new Date(ctx.now() - 7 * 864e5).toISOString();
    const ev = () => ctx.db.from('ops_events');
    const [stats, backup, pushes, recent, keys, purge] = await Promise.all([
      ctx.db.rpc('dev_stats'),
      ev().select('ok,details,created_at').eq('kind', 'backup').order('created_at', { ascending: false }).limit(1),
      ev().select('ok,details').eq('kind', 'push').gte('created_at', weekAgo).limit(5000),
      ev().select('kind,ok,details,created_at').order('created_at', { ascending: false }).limit(15),
      ctx.keysStatus(),
      ev().select('ok,details,created_at').eq('kind', 'purge').order('created_at', { ascending: false }).limit(1),
    ]);
    if (stats.error) {
      throw missingTable(stats.error) || /dev_stats/.test(stats.error.message || '')
        ? new ApiError(500, 'dev_missing', 'The developer numbers are not set up yet (run the dev_dashboard migration).')
        : new ApiError(500, 'db', 'Could not load the developer numbers.');
    }
    // Comments are counted in the database since they moved there; before that, Firestore counts them
    const sd = stats.data || {};
    const comments = sd.comments != null ? { total: Number(sd.comments), week: Number(sd.comments_7d) || 0 }
      : ctx.firestoreStats ? await ctx.firestoreStats(weekAgo).catch(e => ({ error: String(e && e.message || e) })) : null;
    const p = pushes.error ? [] : (pushes.data || []);
    const sum = k => p.reduce((n, e) => n + (Number(e.details && e.details[k]) || 0), 0);
    return {
      at: new Date(ctx.now()).toISOString(),
      health: { keys, push: ctx.push ? 'on' : 'off', comments: comments && !comments.error ? 'ok' : 'error' },
      stats: stats.data || {},
      comments: comments && !comments.error ? comments : null,
      pushWeek: { batches: p.length, sent: sum('sent'), failed: sum('failed'), removed: sum('removed') },
      lastBackup: backup.error ? null : ((backup.data || [])[0] || null),
      lastPurge: purge.error ? null : ((purge.data || [])[0] || null),
      recent: recent.error ? [] : (recent.data || []),
    };
  },

  // Full profile rows (with contact details) for the admin dashboard and exports.
  async 'admin.profiles.list'(ctx, body) {
    requireAdmin(ctx);
    const from = Math.max(0, Math.min(50000, Number(body.from) || 0));
    const r = await ctx.db.from('profiles').select('*')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + 999);
    if (r.error) throw new ApiError(500, 'db', 'Could not load the profiles.');
    return { rows: r.data || [] };
  },

  // Find a student by name or reg number (to make them a club official).
  async 'admin.profile.search'(ctx, body) {
    requireAdmin(ctx);
    const q = txt(body.q, 60, 'Search').replace(/[%_\\,()*]/g, ' ').trim();
    if (q.length < 2) return { rows: [] };
    const cols = 'id,name,reg,email,classyear,course,photo_url,isanonymous';
    const [byName, byReg] = await Promise.all([
      ctx.db.from('profiles').select(cols).ilike('name', `%${q}%`).limit(8),
      ctx.db.from('profiles').select(cols).ilike('reg', `%${q}%`).limit(8),
    ]);
    if (byName.error || byReg.error) throw new ApiError(500, 'db', 'Could not search the profiles.');
    return { rows: (byName.data || []).concat(byReg.data || []) };
  },

  async 'admin.officer.list'(ctx) {
    requireAdmin(ctx);
    const r = await ctx.db.from('club_officers').select('*').order('id', { ascending: true }).limit(5000);
    if (r.error) throw new ApiError(500, missingTable(r.error) ? 'club_tables_missing' : 'db', missingTable(r.error) ? 'The club tables are not set up yet (run clubs-upgrade.sql).' : 'Could not load the officials.');
    return { rows: r.data || [] };
  },

  // Archived profiles are hidden from the public key once the database is locked, so the admin reads them here.
  async 'admin.archive.list'(ctx, body) {
    requireAdmin(ctx);
    const from = Math.max(0, Math.min(50000, Number(body.from) || 0));
    const r = await ctx.db.from('profiles_archive').select('*').eq('deleted_by_owner', false)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + 999);
    if (r.error) throw new ApiError(500, missingTable(r.error) ? 'archive_missing' : 'db', missingTable(r.error) ? 'The archive is not set up yet (run admin-upgrade.sql).' : 'Could not load the archive.');
    return { rows: r.data || [] };
  },

  async 'admin.profile.archive'(ctx, body) {
    requireAdmin(ctx);
    const row = await getRow(ctx, 'profiles', body.id);
    const rec = { ...row, archived_at: new Date(ctx.now()).toISOString(), archived_by: ctx.user.email };
    const ins = await ctx.db.from('profiles_archive').insert(rec);
    if (ins.error) throw new ApiError(500, missingTable(ins.error) ? 'archive_missing' : 'db', missingTable(ins.error) ? 'The archive is not set up yet (run admin-upgrade.sql).' : 'Could not archive: ' + ins.error.message);
    const del = await ctx.db.from('profiles').delete().eq('id', row.id);
    if (del.error) { await ctx.db.from('profiles_archive').delete().eq('id', row.id); throw new ApiError(500, 'db', 'Could not archive the profile.'); }
    return {};
  },

  async 'admin.profile.restore'(ctx, body) {
    requireAdmin(ctx);
    const row = await getRow(ctx, 'profiles_archive', body.id);
    if (row.uid) {
      const ex = await ctx.db.from('profiles').select('id').eq('uid', row.uid).limit(1);
      if (ex.data && ex.data.length) throw conflict('This person already has a new profile, so this one can\u2019t be restored.', 'exists');
    }
    const rest = Object.fromEntries(Object.entries(row).filter(([k]) => !ARCHIVE_ONLY.includes(k)));
    const ins = await ctx.db.from('profiles').insert(rest);          // same id, so comments and club membership come back
    if (ins.error) throw new ApiError(500, 'db', 'Could not restore: ' + ins.error.message);
    await ctx.db.from('profiles_archive').delete().eq('id', row.id);
    return {};
  },

  async 'admin.profile.delete'(ctx, body) {
    requireAdmin(ctx);
    const table = body.archived === true ? 'profiles_archive' : 'profiles';
    const row = await getRow(ctx, table, body.id);
    const del = await ctx.db.from(table).delete().eq('id', row.id);
    if (del.error) throw new ApiError(500, 'db', 'Could not delete the profile.');
    return {};
  },

  // Profiles their owners deleted, soonest to go first. Overdue ones are removed first, in case the nightly run missed them.
  async 'admin.ghosts.list'(ctx) {
    requireAdmin(ctx);
    const purged = await purgeDue(ctx);
    const r = await ctx.db.from('profiles_archive').select('id,uid,name,course,classyear,email,photo_url,deleted_at,purge_after')
      .eq('deleted_by_owner', true).order('purge_after', { ascending: true }).limit(1000);
    if (r.error) throw ghostDbError(r.error);
    return { rows: (r.data || []).map(g => ({ ...ghostInfo(ctx, g), photo_url: g.photo_url || null })), purged };
  },

  async 'admin.ghost.restore'(ctx, body) {
    requireAdmin(ctx);
    const g = await ghostRow(ctx, { id: body.id });
    if (!g) throw notFound('That deleted profile is not there any more.');
    await unGhost(ctx, g);
    return {};
  },

  // Remove one for good now, without waiting for its days to run out
  async 'admin.ghost.purge'(ctx, body) {
    requireAdmin(ctx);
    const g = await ghostRow(ctx, { id: body.id });
    if (!g) throw notFound('That deleted profile is not there any more.');
    return { removed: await purgeGhost(ctx, g) };
  },

  // ── super admin: the to-do list, office admins, the audit log and the Developer tab's pages ──
  // Home's to-do list and the badges on the menu: everything waiting for the super admin, in one call
  async 'admin.todo'(ctx) {
    requireAdmin(ctx);
    const count = (t, f) => f(ctx.db.from(t).select('*', { count: 'exact', head: true })).then(r => r.error ? null : (r.count || 0));
    const day = new Date(ctx.now() - 864e5).toISOString();
    const [staff, leaders, letters, wall, glow, ghosts, errs, backup] = await Promise.all([
      count('staff_profiles', q => q.eq('status', 'pending')),
      count('student_leaders', q => q.eq('status', 'pending')),
      count('letters', q => q.eq('reported', true)),
      count('grad_posts', q => q.eq('reported', true)),
      count('glowups', q => q.eq('reported', true)),
      count('profiles_archive', q => q.eq('deleted_by_owner', true)),
      ctx.db.from('ops_events').select('details').in('kind', ['client_error', 'api_error']).gte('created_at', day).limit(1000),
      ctx.db.from('ops_events').select('ok,created_at').eq('kind', 'backup').order('created_at', { ascending: false }).limit(1),
    ]);
    return { staff, leaders, reported: { letters, wall, glow }, ghosts,
      errors24h: errs.error ? null : (errs.data || []).filter(e => !isNoise(e.details)).length,
      lastBackup: backup.error ? null : ((backup.data || [])[0] || null) };
  },

  async 'admin.offices.list'(ctx) {
    requireAdmin(ctx);
    const r = await ctx.db.from('office_admins').select('id,email,office,granted_by,created_at').order('created_at', { ascending: true }).limit(500);
    if (r.error) throw officeDbError(r.error);
    return { rows: r.data || [] };
  },

  // Make someone an office admin ({ email, office }). They sign in with that email (verified) and open office.html.
  async 'admin.office.add'(ctx, body) {
    requireAdmin(ctx);
    const email = lower(emailOrBlank(body.email, 'Email'));
    if (!email) throw bad('Write their email.');
    const office = String(body.office || '');
    if (!ctx.config.offices.includes(office)) throw bad('Choose the office.');
    if (email === lower(ctx.config.adminEmail)) throw bad('The super admin already sees every office.');
    const ins = await ctx.db.from('office_admins').insert({ email, office, granted_by: lower(ctx.user.email), created_at: new Date(ctx.now()).toISOString() }).select('id');
    if (ins.error) throw ins.error.code === '23505' ? conflict('They are already an admin of that office.', 'exists') : officeDbError(ins.error);
    await audit(ctx, null, 'office_admin_added', { email, office });
    return { id: (Array.isArray(ins.data) ? ins.data[0] : ins.data).id };
  },

  async 'admin.office.remove'(ctx, body) {
    requireAdmin(ctx);
    const row = await getRow(ctx, 'office_admins', body.id);
    const del = await ctx.db.from('office_admins').delete().eq('id', row.id);
    if (del.error) throw officeDbError(del.error);
    await audit(ctx, null, 'office_admin_removed', { email: row.email, office: row.office });
    return {};
  },

  // Every list view, export and office-admin change, newest first
  async 'admin.audit.list'(ctx) {
    requireAdmin(ctx);
    const r = await ctx.db.from('office_audit').select('id,email,office,action,detail,created_at').order('created_at', { ascending: false }).limit(500);
    if (r.error) throw officeDbError(r.error);
    return { rows: r.data || [] };
  },

  // Who has phone notifications on (each person, their devices, since when) and what was sent in the last 7 days
  async 'admin.dev.push'(ctx) {
    requireAdmin(ctx);
    const weekAgo = new Date(ctx.now() - 7 * 864e5).toISOString();
    const [subs, ev] = await Promise.all([
      ctx.db.from('push_subscriptions').select('uid,endpoint,created_at,last_seen_at').limit(5000),
      ctx.db.from('ops_events').select('ok,details').eq('kind', 'push').gte('created_at', weekAgo).limit(5000),
    ]);
    if (subs.error) throw pushDbError(subs.error);
    const byUid = new Map();
    for (const x of subs.data || []) {
      let host = ''; try { host = new URL(x.endpoint).hostname; } catch (e) { /* not a web address */ }
      const d = byUid.get(x.uid) || { uid: x.uid, devices: [], since: x.created_at, seen: x.last_seen_at };
      d.devices.push({ kind: pushDevice(host), since: x.created_at, seen: x.last_seen_at });
      if (x.created_at && (!d.since || x.created_at < d.since)) d.since = x.created_at;
      if (x.last_seen_at && (!d.seen || x.last_seen_at > d.seen)) d.seen = x.last_seen_at;
      byUid.set(x.uid, d);
    }
    const uids = [...byUid.keys()], prof = {}, staff = {};
    for (let i = 0; i < uids.length; i += 200) {
      const part = uids.slice(i, i + 200);
      const [pr, st] = await Promise.all([
        ctx.db.from('profiles').select('id,uid,name,email,course,classyear,photo_url').in('uid', part),
        ctx.db.from('staff_profiles').select('id,uid,name,title,position').in('uid', part)]);
      (pr.data || []).forEach(x => { prof[x.uid] = x; });
      (st.data || []).forEach(x => { staff[x.uid] = x; });
    }
    const people = [...byUid.values()].map(d => {
      const pr = prof[d.uid], st = staff[d.uid];
      return { name: pr ? pr.name : st ? [st.title, st.name].filter(Boolean).join(' ') : '', profile_id: pr ? pr.id : null, staff_id: !pr && st ? st.id : null,
        email: pr ? pr.email || '' : '', course: pr ? pr.course || '' : st ? st.position || '' : '', classyear: pr ? pr.classyear || '' : '',
        photo_url: pr ? pr.photo_url || null : null, devices: d.devices, since: d.since, seen: d.seen };
    }).sort((a, b) => String(b.seen || '').localeCompare(String(a.seen || '')));
    const e = ev.error ? [] : (ev.data || []), what = {};
    for (const x of e) {
      const d = x.details || {}, k = d.what || 'other', w = what[k] = what[k] || { what: k, batches: 0, sent: 0, failed: 0 };
      w.batches++; w.sent += Number(d.sent) || 0; w.failed += Number(d.failed) || 0;
    }
    const sum = k => e.reduce((n, x) => n + (Number(x.details && x.details[k]) || 0), 0);
    return { people, devices: (subs.data || []).length,
      week: { batches: e.length, sent: sum('sent'), failed: sum('failed'), removed: sum('removed'), byWhat: Object.values(what).sort((a, b) => b.sent - a.sent) } };
  },

  // The developer diary, newest first, 100 at a time ({ kind?, before? }), and how many of each kind in 30 days
  async 'admin.dev.activity'(ctx, body) {
    requireAdmin(ctx);
    const kind = String(body.kind || ''), before = body.before ? String(body.before) : '';
    if (kind && !DIARY_KINDS.includes(kind)) throw bad('Unknown kind of event.');
    if (before && isNaN(Date.parse(before))) throw bad('Invalid date.');
    let q = ctx.db.from('ops_events').select('id,kind,ok,details,created_at').order('created_at', { ascending: false }).limit(100);
    if (kind) q = q.eq('kind', kind);
    if (before) q = q.lt('created_at', before);
    const month = new Date(ctx.now() - 30 * 864e5).toISOString();
    const [r, ...n] = await Promise.all([q, ...DIARY_KINDS.map(k => ctx.db.from('ops_events').select('id', { count: 'exact', head: true }).eq('kind', k).gte('created_at', month))]);
    if (r.error) throw new ApiError(500, 'db', 'Could not load the activity.');
    const kinds = {};
    DIARY_KINDS.forEach((k, i) => { if (!n[i].error && n[i].count) kinds[k] = n[i].count; });
    return { rows: r.data || [], kinds, more: (r.data || []).length === 100 };
  },

  // The Developer tab's People page: who is in the yearbook, how complete their profiles are, and what gets used
  async 'admin.dev.insights'(ctx) {
    requireAdmin(ctx);
    const all = [];
    for (let from = 0; from < 50000; from += 1000) {
      const r = await ctx.db.from('profiles').select('id,name,dept,course,classyear,county,country,photo_url,bio,whatsapp,email,birthday,clubs,isanonymous,created_at')
        .order('id', { ascending: true }).range(from, from + 999);
      if (r.error) throw new ApiError(500, 'db', 'Could not load the profiles.');
      all.push(...(r.data || []));
      if ((r.data || []).length < 1000) break;
    }
    const tally = f => { const m = {}; all.forEach(x => { const k = f(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n); };
    const named = all.filter(x => !x.isanonymous);
    const filled = v => Array.isArray(v) ? v.length > 0 : !!String(v || '').trim();
    const share = f => named.length ? Math.round(named.filter(f).length / named.length * 100) : 0;
    const since = ctx.now() - 30 * 864e5, kday = iso => new Date(Date.parse(iso) + 3 * 3600e3).toISOString().slice(0, 10);
    const clubs = {};
    all.forEach(x => (Array.isArray(x.clubs) ? x.clubs : []).forEach(c => { clubs[c] = (clubs[c] || 0) + 1; }));
    const count = (t, f) => (f ? f(ctx.db.from(t).select('*', { count: 'exact', head: true })) : ctx.db.from(t).select('*', { count: 'exact', head: true }))
      .then(r => r.error ? null : (r.count || 0));
    const [likes, comments, replies, friends, friendRequests, letters, capsules, glow, wall, votes, kyu, chal, staff, leaders, news, likeTop, commentTop] = await Promise.all([
      count('profile_likes'), count('comments'), count('comment_replies'),
      count('friend_links', q => q.eq('status', 'accepted')), count('friend_links', q => q.eq('status', 'pending')),
      count('letters'), count('capsules'), count('glowups'), count('grad_posts'), count('sup_votes'), count('kyu_board'), count('chal_best'),
      count('staff_profiles', q => q.eq('status', 'approved')), count('student_leaders', q => q.eq('status', 'approved')), count('announcements'),
      ctx.db.from('profile_like_counts').select('profile_id,likes').order('likes', { ascending: false }).limit(5),
      ctx.db.from('profile_comment_counts').select('profile_id,comments').order('comments', { ascending: false }).limit(5),
    ]);
    const byId = Object.fromEntries(all.map(x => [x.id, x]));
    const top = (r, key) => (r.error ? [] : r.data || []).filter(x => byId[x.profile_id]).map(x => ({ id: x.profile_id, name: byId[x.profile_id].name, n: Number(x[key]) || 0 }));
    return {
      total: all.length, anonymous: all.length - named.length,
      byClass: tally(x => String(x.classyear || '')).sort((a, b) => b.k.localeCompare(a.k)),
      bySchool: tally(x => x.dept),
      byCounty: tally(x => x.country && x.country !== 'Kenya' ? '' : x.county).slice(0, 10),
      countries: tally(x => x.country && x.country !== 'Kenya' ? x.country : ''),
      complete: { photo: share(x => filled(x.photo_url)), bio: share(x => filled(x.bio)), whatsapp: share(x => filled(x.whatsapp)),
        email: share(x => filled(x.email)), birthday: share(x => filled(x.birthday)), clubs: share(x => filled(x.clubs)) },
      joined: tally(x => Date.parse(x.created_at) >= since ? kday(x.created_at) : '').sort((a, b) => a.k.localeCompare(b.k)),
      clubs: Object.entries(clubs).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n).slice(0, 10),
      topLiked: top(likeTop, 'likes'), topCommented: top(commentTop, 'comments'),
      features: { likes, comments, replies, friends, friendRequests, letters, capsules, glow, wall, votes, kyu, chal, staff, leaders, news },
    };
  },

  // ── the Office of the Dean of Students (office.html) ──
  // The students database, 100 at a time, A to Z ({ dept?, course?, classyear?, county?, club?, q?, from? }).
  // { ...filters, export: true } gives every match at once, for the CSV. Both are written in the audit log first.
  async 'dos.students'(ctx, body) {
    await requireOffice(ctx, 'dos');
    const f = dosFilters(body), all = body.export === true;
    const from = all ? 0 : Math.max(0, Math.min(50000, Number(body.from) || 0));
    const page = (a, b) => dosQuery(ctx.db.from('profiles').select(DOS_COLS), f).order('name', { ascending: true }).order('id', { ascending: true }).range(a, b);
    const n = await dosQuery(ctx.db.from('profiles').select('id', { count: 'exact', head: true }), f);
    if (n.error) throw new ApiError(500, 'db', 'Could not load the students.');
    const total = n.count || 0;
    await audit(ctx, 'dos', all ? 'students_exported' : 'students_viewed', { filters: f, rows: all ? total : Math.max(0, Math.min(100, total - from)), from });
    const rows = [];
    for (let a = from; a < (all ? total : from + 100); a += 1000) {
      const r = await page(a, Math.min(a + 999, all ? total - 1 : from + 99));
      if (r.error) throw new ApiError(500, 'db', 'Could not load the students.');
      rows.push(...(r.data || []));
      if ((r.data || []).length < 1000) break;
    }
    return { rows, total, more: !all && from + rows.length < total };
  },

  // Club activity records for one year ({ year, export? }): every post with its date, type and trimester; the clubs'
  // officials, members and meeting details. Officials and members are as they are today (the yearbook keeps no history).
  async 'dos.clubs'(ctx, body) {
    await requireOffice(ctx, 'dos');
    const year = Number(body.year), thisYear = new Date(ctx.now()).getUTCFullYear();
    if (!Number.isInteger(year) || year < 2000 || year > thisYear + 1) throw bad('Choose the year.');
    const [posts, officers, info, first] = await Promise.all([
      ctx.db.from('club_posts').select('id,club_name,type,title,post_date,attendees,file_urls,author_name')
        .gte('post_date', `${year}-01-01`).lte('post_date', `${year}-12-31`).order('post_date', { ascending: true }).limit(5000),
      ctx.db.from('club_officers').select('club_name,officer_name,officer_email,role').limit(5000),
      ctx.db.from('club_info').select('club_name,about,meeting_days,meeting_place,contact_email,contact_whatsapp').limit(1000),
      ctx.db.from('club_posts').select('post_date').order('post_date', { ascending: true }).limit(1),
    ]);
    if (posts.error || officers.error) throw new ApiError(500, missingTable(posts.error || officers.error) ? 'club_tables_missing' : 'db', 'Could not load the club records.');
    const members = {};
    for (let a = 0; a < 50000; a += 1000) {
      const r = await ctx.db.from('profiles').select('clubs').order('id', { ascending: true }).range(a, a + 999);
      if (r.error) throw new ApiError(500, 'db', 'Could not count the members.');
      (r.data || []).forEach(x => (Array.isArray(x.clubs) ? x.clubs : []).forEach(c => { members[c] = (members[c] || 0) + 1; }));
      if ((r.data || []).length < 1000) break;
    }
    const rows = (posts.data || []).map(x => ({ id: x.id, club: x.club_name, type: x.type, title: x.title || '', date: x.post_date, trimester: trimester(x.post_date),
      attendees: Array.isArray(x.attendees) ? x.attendees.length : 0, files: Array.isArray(x.file_urls) ? x.file_urls.length : 0, by: x.author_name || '' }));
    await audit(ctx, 'dos', body.export === true ? 'club_records_exported' : 'club_records_viewed', { year, rows: rows.length });
    const f = first.data && first.data[0];
    return { year, firstYear: f ? Number(String(f.post_date).slice(0, 4)) : thisYear, posts: rows, members,
      officials: (officers.data || []).map(o => ({ club: o.club_name, name: o.officer_name || '', email: o.officer_email || '', role: o.role || '' })),
      info: info.error ? [] : (info.data || []).map(i => ({ club: i.club_name, about: i.about || '', days: i.meeting_days || '', place: i.meeting_place || '', email: i.contact_email || '', whatsapp: i.contact_whatsapp || '' })) };
  },

  async 'admin.officer.add'(ctx, body) {
    requireAdmin(ctx);
    const club = txt(body.club, 80, 'Club', { required: true });
    const email = lower(emailOrBlank(body.email, 'Email'));
    if (!email) throw bad('Email is required.');
    const role = String(body.role || 'Officer');
    if (!ctx.config.roles.includes(role)) throw bad('Unknown role.');
    const ins = await ctx.db.from('club_officers').insert({ club_name: club, officer_email: email, officer_name: txt(body.name, 80, 'Name') || null, role }).select();
    if (ins.error) {
      if (ins.error.code === '23505') throw conflict('That person is already an official of this club.', 'duplicate');
      throw new ApiError(500, missingTable(ins.error) ? 'club_tables_missing' : 'db', missingTable(ins.error) ? 'The club tables are not set up yet (run clubs-upgrade.sql).' : 'Could not add the official.');
    }
    return { officer: ins.data && ins.data[0] };
  },

  async 'admin.officer.remove'(ctx, body) {
    requireAdmin(ctx);
    const row = await getRow(ctx, 'club_officers', body.id);
    const del = await ctx.db.from('club_officers').delete().eq('id', row.id);
    if (del.error) throw new ApiError(500, 'db', 'Could not remove the official.');
    return {};
  },
};

// Actions anyone may call without signing in: they change nobody's data, and show only what anyone may see
const PUBLIC_ACTIONS = ['hit', 'sup.board', 'err'];

// ── The request handler ────────────────────────────────────────────────
export function createApi({ config, db, storage, getKeys, now = () => Date.now(), rand = () => Math.random().toString(36).slice(2, 8),
  push = null, firestore = null, firestoreStats = null, newId = () => randomId(20), purgeSecret = '',
  background = p => { Promise.resolve(p).catch(e => console.error('[api] background task failed', e)); } }) {
  const cors = origin => {
    const h = { 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Headers': 'content-type, x-firebase-token, authorization, apikey, x-client-info' };
    if (origin && (config.origins.includes(origin) || (config.previewOrigin && config.previewOrigin.test(origin)))) h['Access-Control-Allow-Origin'] = origin;
    return h;
  };
  const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

  async function keysStatus() { try { const k = await getKeys(false); return k.length ? 'ok' : 'empty'; } catch (e) { return 'error'; } }

  async function handle(req) {
    const headers = cors(req.headers.get('origin'));
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    let action = '';
    try {
      const ping = async () => json({ ok: true, service: 'gluk-api', version: 1, keys: await keysStatus(), push: push ? 'on' : 'off' }, 200, headers);
      if (req.method === 'GET') return ping();
      if (req.method !== 'POST') throw new ApiError(405, 'method', 'Use POST.');
      const len = Number(req.headers.get('content-length') || 0);
      if (len > config.maxBodyBytes) throw new ApiError(413, 'too_large', 'That request is too large.');
      let body;
      try { const text = await req.text(); if (text.length > config.maxBodyBytes) throw new Error('big'); body = JSON.parse(text); } catch (e) { throw bad('The request could not be read.'); }
      if (!isObj(body)) throw bad('The request could not be read.');
      action = String(body.action || '');
      if (action === 'ping') return ping();
      if (action === 'purge.run') {                         // the nightly clean-up (pg_cron + pg_net): only with the secret
        if (!sameSecret(req.headers.get('x-purge-secret'), purgeSecret)) throw forbidden();
        const purged = await purgeDue({ db, storage, config, now });
        await logEvent({ db, now }, 'purge', true, { purged });      // Developer > Health shows when it last ran
        return json({ ok: true, purged }, 200, headers);
      }
      const fn = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
      if (!fn) throw new ApiError(404, 'unknown_action', 'Unknown action.');
      if (PUBLIC_ACTIONS.includes(action)) {                // counted without a sign-in
        const result = await fn({ user: null, isAdmin: false, db, storage: null, config, now, rand, push: null, background }, body);
        return json({ ok: true, ...result }, 200, headers);
      }
      const token = req.headers.get('x-firebase-token') || '';
      if (!token) throw new ApiError(401, 'auth', 'Please sign in first.');
      const user = await verifyFirebaseToken(token, { projectId: config.projectId, getKeys, nowSec: () => Math.floor(now() / 1000) });
      const isAdmin = user.emailVerified && !!user.email && lower(user.email) === lower(config.adminEmail);
      const result = await fn({ user, isAdmin, isSuperAdmin: isAdmin, db, storage, config, now, rand, push, firestore, firestoreStats, newId, background, keysStatus }, body);
      return json({ ok: true, ...result }, 200, headers);
    } catch (e) {
      if (e instanceof ApiError && e.status >= 500 && e.code !== 'too_large') await logEvent({ db, now }, 'api_error', false, { msg: snip(e.message, 300), code: e.code, action, stack: errStack(e.stack) });
      if (e instanceof ApiError) return json({ ok: false, error: e.message, code: e.code, ...e.extra }, e.status, headers);
      console.error('[api] unexpected error', e);
      await logEvent({ db, now }, 'api_error', false, { msg: snip(e && e.message || e, 300), action, stack: errStack(e && e.stack) });
      return json({ ok: false, error: 'Something went wrong on the server.', code: 'server' }, 500, headers);
    }
  }
  return { handle, ACTIONS };
}

// ── Google's public keys for checking Firebase logins (cached for an hour) ──
let _keys = null, _keysAt = 0;
export async function fetchGoogleKeys(force) {
  if (!force && _keys && Date.now() - _keysAt < 3600e3) return _keys;
  const res = await fetch(KEYS_URL);
  if (!res.ok) throw new Error('Could not fetch the sign-in keys (' + res.status + ')');
  const j = await res.json();
  _keys = Array.isArray(j.keys) ? j.keys : [];
  _keysAt = Date.now();
  return _keys;
}

// ── Web Push (standard Web Crypto only) ────────────────────────────────
// RFC 8291 encrypts the message so only the person's browser can read it; RFC 8292 (VAPID) signs
// each request so push services know it comes from this yearbook.
const b64u = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const utf8 = s => new TextEncoder().encode(s);
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let i = 0; for (const p of parts) { out.set(p, i); i += p.length; } return out; };
async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bytes * 8));
}

// `serverKeys` and `salt` are only passed in by the tests (to reproduce RFC 8291's worked example).
export async function encryptPush(plaintext, uaPublicB64u, authB64u, { serverKeys, salt } = {}) {
  const uaPublic = b64uBytes(uaPublicB64u), authSecret = b64uBytes(authB64u);
  salt = salt || crypto.getRandomValues(new Uint8Array(16));
  const as = serverKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(utf8('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(plaintext, [2])));   // 2 = last (only) record
  const header = new Uint8Array(21);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096);                  // record size
  header[20] = asPublic.length;
  return concat(header, asPublic, sealed);
}

export function createPushSender({ publicKey, privateKey, subject, fetchFn = fetch, nowSec = () => Math.floor(Date.now() / 1000), ttl = 2 * 86400 }) {
  const pub = b64uBytes(publicKey);
  let signing = null;
  const jwts = new Map();                                           // one signed token per push service, reused for up to 11 hours
  async function vapid(aud) {
    const now = nowSec(), hit = jwts.get(aud);
    if (hit && hit.exp - now > 3600) return hit.header;
    signing = signing || await crypto.subtle.importKey('jwk',
      { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: privateKey, ext: true },
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const exp = now + 12 * 3600;
    const unsigned = b64u(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))) + '.' + b64u(utf8(JSON.stringify({ aud, exp, sub: subject })));
    const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signing, utf8(unsigned)));
    const header = `vapid t=${unsigned}.${b64u(sig)}, k=${publicKey}`;
    jwts.set(aud, { exp, header });
    return header;
  }
  async function send(sub, data) {
    const body = await encryptPush(utf8(JSON.stringify(data)), sub.p256dh, sub.auth);
    const res = await fetchFn(sub.endpoint, { method: 'POST', body, headers: {
      'Authorization': await vapid(new URL(sub.endpoint).origin), 'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream', 'TTL': String(ttl), 'Urgency': 'normal' } });
    try { await res.body?.cancel(); } catch (e) { /* nothing to read */ }
    return res.status;
  }
  return { send };
}

// ── Reading one comment or reply from Firebase (comments are public, so no key is needed) ──
export function firestoreReader(projectId, fetchFn = fetch) {
  return async path => {
    const res = await fetchFn(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Firestore answered ' + res.status);
    const doc = await res.json(), out = { createTime: doc.createTime || '' };   // createTime is set by Google, so it can't be faked
    for (const [k, v] of Object.entries(doc.fields || {})) out[k] = v.stringValue ?? v.timestampValue ?? v.integerValue ?? v.booleanValue ?? null;
    return out;
  };
}

// ── Comment counts for the Developer tab (Firestore count queries: no documents are downloaded) ──
// Plain counts only: a count combined with a sum skips the older comments that have no replyCount field.
export function firestoreStats(projectId, fetchFn = fetch) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runAggregationQuery`;
  async function count(where) {
    const structuredQuery = { from: [{ collectionId: 'comments' }], ...(where ? { where } : {}) };
    const res = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredAggregationQuery: { structuredQuery, aggregations: [{ alias: 'n', count: {} }] } }) });
    if (!res.ok) throw new Error('Firestore answered ' + res.status);
    const out = await res.json();
    const n = (Array.isArray(out) ? out[0] : out)?.result?.aggregateFields?.n;
    return Number(n?.integerValue ?? 0);
  }
  return async sinceIso => {
    const [total, week] = await Promise.all([count(null),
      count({ fieldFilter: { field: { fieldPath: 'timestamp' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: sinceIso } } })]);
    return { total, week };
  };
}

// ==DENO-WIRING-START==
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  (() => { try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')['default']; } catch (_) { return undefined; } })();
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const api = createApi({ config: { ...CONFIG, supabaseUrl: SUPABASE_URL }, db: admin, storage: admin.storage, getKeys: fetchGoogleKeys,
  push: VAPID_PRIVATE_KEY ? createPushSender({ publicKey: CONFIG.vapidPublicKey, privateKey: VAPID_PRIVATE_KEY, subject: CONFIG.vapidSubject }) : null,
  firestore: firestoreReader(CONFIG.projectId),
  firestoreStats: firestoreStats(CONFIG.projectId),
  purgeSecret: Deno.env.get('PURGE_SECRET') || '',
  background: p => { const t = Promise.resolve(p).catch(e => console.error('[api] background task failed', e)); globalThis.EdgeRuntime?.waitUntil?.(t); } });
Deno.serve(req => api.handle(req));
// ==DENO-WIRING-END==

export { CONFIG };
