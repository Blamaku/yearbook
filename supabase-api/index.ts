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
  lettersOpenAt: '2026-11-14T21:00:00Z',            // letters open on Sunday 15 November 2026, 00:00 in Kisumu (also in letters.js and the SQL)
  lettersClass: '2026',                             // the graduating class letters are written to
  lettersPerPerson: 30,                             // at most this many new letters by one person per 24 hours
  contactsPerDay: 20,                               // different classmates' contact details one person may open per 24 hours
  kyuRound: 10,                                     // questions in a round of Who's who? (university.js)
  kyuMinSeconds: 15,                                // a round finished faster than this does not count
  kyuPerHour: 40,                                   // at most this many rounds started by one person per hour
  // Pages whose visits are counted for the Developer tab (each page's <body data-page>)
  trackPages: ['home', 'feed', 'profiles', 'profile', 'clubs', 'club', 'department', 'course', 'class', 'staff',
    'about', 'constitution', 'letters', 'university'],
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
const requireAdmin = ctx => { if (!ctx.isAdmin) throw forbidden('Only the admin can do that.'); };
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
const PUSH_WHAT = { c: 'comment', r: 'reply', p: 'club post', l: 'like', s: 'staff approved', t: 'letter', test: 'test' };
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
function staffFields(ctx, p) {
  const since = txt(p.since_year, 4, 'Year you joined GLUK');
  if (since && (!/^\d{4}$/.test(since) || +since < 1950 || +since > new Date(ctx.now()).getFullYear())) throw bad('Year you joined GLUK must be a 4-digit year.');
  return {
    name: txt(p.name, 120, 'Name', { required: true }),
    title: txt(p.title, 20, 'Title') || null,
    position: txt(p.position, 120, 'Position', { required: true }),
    dept: txt(p.dept, 120, 'School or office') || null,
    since_year: since || null,
    message: txt(p.message, 600, 'Message') || null,
    photo_url: p.photo_url ? fileUrls(ctx.config, [p.photo_url], ctx.config.profileBucket, 1, 'Photo', ctx.user.uid)[0] : null,
  };
}
async function myStaff(ctx) {
  const r = await ctx.db.from('staff_profiles').select('*').eq('uid', ctx.user.uid).limit(1);
  if (r.error) throw staffDbError(r.error);
  return (r.data && r.data[0]) || null;
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
    body: open ? 'Open the yearbook to read it.' : 'It stays sealed until Sunday 15 November.',
    url: '/letters.html#for-you', tag: 't-' + letter.id });
}

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
    const ar = await ctx.db.from('profiles_archive').select('id').eq('uid', uid).limit(1);
    if (!ar.error && ar.data && ar.data.length) throw conflict('Your profile is archived. Please contact the admin.', 'archived');
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
    const up = await ctx.db.from('profiles').update(patch).eq('id', row.id);
    if (up.error) throw new ApiError(500, 'db', 'Could not save the changes: ' + up.error.message);
    return {};
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
    if (body.like && r.data && r.data.changed === true && owner && owner !== ctx.user.uid) ctx.background(notifyLike(ctx, pid, owner));
    return { likes: Number(r.data && r.data.likes) || 0, liked: body.like };
  },

  // ── staff profiles ──
  // The caller's own staff profile, whatever its status (the public only ever sees approved ones)
  async 'staff.mine'(ctx) {
    return { staff: await myStaff(ctx) };
  },

  // Create or edit your own. A new one waits for the admin; edits keep their status,
  // except a new name on an approved profile, which the admin checks again.
  async 'staff.save'(ctx, body) {
    if (!isObj(body.staff)) throw bad('Missing staff profile.');
    const rec = staffFields(ctx, body.staff), old = await myStaff(ctx);
    const w = old
      ? await ctx.db.from('staff_profiles').update({ ...rec, updated_at: new Date(ctx.now()).toISOString(),
          ...(old.status === 'approved' && rec.name !== old.name ? { status: 'pending' } : {}) }).eq('id', old.id)
      : await ctx.db.from('staff_profiles').insert({ ...rec, uid: ctx.user.uid, status: 'pending' });
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

  // ── Letters to the Class of 2026 ──
  // Everything the letters page needs. Letters written to you are only a count until the letters open.
  // countOnly: just how many are waiting for you (the Home page).
  async 'letters.mine'(ctx, body) {
    const uid = ctx.user.uid, open = lettersOpen(ctx), countOnly = !!body.countOnly;
    const [mine, forMe, wall] = await Promise.all([
      countOnly ? { data: [] } : ctx.db.from('letters').select(LETTER_MINE).eq('author_uid', uid).order('created_at', { ascending: false }).limit(200),
      ctx.db.from('letters').select(open ? 'id,to_kind,author_name,body,created_at' : 'id').eq('to_uid', uid)
        .eq('removed', false).eq('hidden', false).order('created_at', { ascending: false }).limit(500),
      countOnly ? { count: 0 } : ctx.db.from('letters').select('id', { count: 'exact', head: true }).eq('on_wall', true).eq('hidden', false),
    ]);
    const err = mine.error || forMe.error || wall.error;
    if (err) throw letterDbError(err);
    const got = forMe.data || [];
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
    const [stats, backup, pushes, recent, keys] = await Promise.all([
      ctx.db.rpc('dev_stats'),
      ev().select('ok,details,created_at').eq('kind', 'backup').order('created_at', { ascending: false }).limit(1),
      ev().select('ok,details').eq('kind', 'push').gte('created_at', weekAgo).limit(5000),
      ev().select('kind,ok,details,created_at').order('created_at', { ascending: false }).limit(15),
      ctx.keysStatus(),
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
    const r = await ctx.db.from('profiles_archive').select('*')
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
    const { archived_at, archived_by, ...rest } = row;
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

// Actions anyone may call without signing in (they never read or change anyone's data)
const PUBLIC_ACTIONS = ['hit'];

// ── The request handler ────────────────────────────────────────────────
export function createApi({ config, db, storage, getKeys, now = () => Date.now(), rand = () => Math.random().toString(36).slice(2, 8),
  push = null, firestore = null, firestoreStats = null, newId = () => randomId(20),
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
    try {
      const ping = async () => json({ ok: true, service: 'gluk-api', version: 1, keys: await keysStatus(), push: push ? 'on' : 'off' }, 200, headers);
      if (req.method === 'GET') return ping();
      if (req.method !== 'POST') throw new ApiError(405, 'method', 'Use POST.');
      const len = Number(req.headers.get('content-length') || 0);
      if (len > config.maxBodyBytes) throw new ApiError(413, 'too_large', 'That request is too large.');
      let body;
      try { const text = await req.text(); if (text.length > config.maxBodyBytes) throw new Error('big'); body = JSON.parse(text); } catch (e) { throw bad('The request could not be read.'); }
      if (!isObj(body)) throw bad('The request could not be read.');
      const action = String(body.action || '');
      if (action === 'ping') return ping();
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
      const result = await fn({ user, isAdmin, db, storage, config, now, rand, push, firestore, firestoreStats, newId, background, keysStatus }, body);
      return json({ ok: true, ...result }, 200, headers);
    } catch (e) {
      if (e instanceof ApiError) return json({ ok: false, error: e.message, code: e.code, ...e.extra }, e.status, headers);
      console.error('[api] unexpected error', e);
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
  background: p => { const t = Promise.resolve(p).catch(e => console.error('[api] background task failed', e)); globalThis.EdgeRuntime?.waitUntil?.(t); } });
Deno.serve(req => api.handle(req));
// ==DENO-WIRING-END==

export { CONFIG };
