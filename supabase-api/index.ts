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
  postTypes: ['notice', 'activity', 'minutes', 'photo'],
  supabaseUrl: '',                                  // filled in automatically when the function starts
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
    if (type === 'minutes' && !text && !files.length) throw bad('Add the minutes text or upload the file.');
    if (type === 'photo' && !files.length) throw bad('Add at least one photo.');
    const date = body.post_date ? String(body.post_date) : new Date(ctx.now()).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('Date must look like 2026-09-21.');
    const row = { club_name: club, type, title: title || null, body: text || null, post_date: date, file_urls: files,
      attendees: (type === 'activity' || type === 'minutes') ? attendees : [], created_by: ctx.user.uid,
      author_name: txt(body.author_name, 120, 'Author') || ctx.user.name || ctx.user.email.split('@')[0] };
    const ins = await ctx.db.from('club_posts').insert(row).select();
    if (ins.error) throw new ApiError(500, 'db', 'Could not save the post: ' + ins.error.message);
    return { post: ins.data && ins.data[0] };
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

  // ── admin only ──
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

// ── The request handler ────────────────────────────────────────────────
export function createApi({ config, db, storage, getKeys, now = () => Date.now(), rand = () => Math.random().toString(36).slice(2, 8) }) {
  const cors = origin => {
    const h = { 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Headers': 'content-type, x-firebase-token, authorization, apikey, x-client-info' };
    if (origin && config.origins.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
    return h;
  };
  const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

  async function keysStatus() { try { const k = await getKeys(false); return k.length ? 'ok' : 'empty'; } catch (e) { return 'error'; } }

  async function handle(req) {
    const headers = cors(req.headers.get('origin'));
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      if (req.method === 'GET') return json({ ok: true, service: 'gluk-api', version: 1, keys: await keysStatus() }, 200, headers);
      if (req.method !== 'POST') throw new ApiError(405, 'method', 'Use POST.');
      const len = Number(req.headers.get('content-length') || 0);
      if (len > config.maxBodyBytes) throw new ApiError(413, 'too_large', 'That request is too large.');
      let body;
      try { const text = await req.text(); if (text.length > config.maxBodyBytes) throw new Error('big'); body = JSON.parse(text); } catch (e) { throw bad('The request could not be read.'); }
      if (!isObj(body)) throw bad('The request could not be read.');
      const action = String(body.action || '');
      if (action === 'ping') return json({ ok: true, service: 'gluk-api', version: 1, keys: await keysStatus() }, 200, headers);
      const fn = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
      if (!fn) throw new ApiError(404, 'unknown_action', 'Unknown action.');
      const token = req.headers.get('x-firebase-token') || '';
      if (!token) throw new ApiError(401, 'auth', 'Please sign in first.');
      const user = await verifyFirebaseToken(token, { projectId: config.projectId, getKeys, nowSec: () => Math.floor(now() / 1000) });
      const isAdmin = user.emailVerified && !!user.email && lower(user.email) === lower(config.adminEmail);
      const result = await fn({ user, isAdmin, db, storage, config, now, rand }, body);
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

// ==DENO-WIRING-START==
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  (() => { try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')['default']; } catch (_) { return undefined; } })();
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const api = createApi({ config: { ...CONFIG, supabaseUrl: SUPABASE_URL }, db: admin, storage: admin.storage, getKeys: fetchGoogleKeys });
Deno.serve(req => api.handle(req));
// ==DENO-WIRING-END==

export { CONFIG };
