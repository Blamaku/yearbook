// =====================================================
//  GLUK YEARBOOK 2026 — BACKUP
//
//  Run:   node scripts/backup.mjs
//
//  Saves a dated copy of:
//    • every database table (JSON, includes private fields: WhatsApp, email, birthday)
//    • Firebase comments and their replies (JSON)
//    • every photo and club file in storage (kept in one shared folder; only new files download)
//    • a full restorable database dump (SQL) — only when Docker Desktop is running
//
//  Keys come from .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_POOLER_URL).
//  Where: BACKUP_DIR in .env, otherwise C:\Users\<you>\GLUK-backups. Never inside this
//  project folder — the repo is public and a backup holds students' contact details.
// =====================================================
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIREBASE_PROJECT = 'yearbook-d3f4f';

// ── settings ─────────────────────────────────────────
const env = {};
for (const line of fs.readFileSync(path.join(REPO, '.env'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].trim();
}
const SUPABASE_URL = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) { console.error('.env needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const DEST = path.resolve(env.BACKUP_DIR || path.join(os.homedir(), 'GLUK-backups'));
if (!path.relative(REPO, DEST).startsWith('..')) { console.error(`Refusing to back up inside the project folder (${DEST}): the repo is public.`); process.exit(1); }

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const STAMP = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
const RUN = path.join(DEST, STAMP);
const FILES = path.join(DEST, 'storage');            // shared by every backup: photos never change once uploaded
fs.mkdirSync(path.join(RUN, 'database'), { recursive: true });
fs.mkdirSync(path.join(RUN, 'firebase'), { recursive: true });

const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const manifest = { started: now.toISOString(), project: SUPABASE_URL, tables: {}, firebase: {}, storage: {}, sqlDump: null, problems: [] };
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 1));
const problem = msg => { manifest.problems.push(msg); console.warn('  ! ' + msg); };

async function getJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url.replace(/\?.*/, '')}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ── 1. database tables (Supabase REST, server key) ────
async function backupTables() {
  console.log('Database tables');
  const spec = await getJson(`${SUPABASE_URL}/rest/v1/`, { headers: { ...auth, Accept: 'application/openapi+json' } });
  for (const [name, def] of Object.entries(spec.definitions || {})) {
    const cols = Object.keys(def.properties || {});
    const order = cols.includes('id') ? 'id' : cols[0];
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const page = await getJson(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(name)}?select=*&order=${encodeURIComponent(order)}.asc&limit=1000&offset=${from}`, { headers: auth });
      rows.push(...page);
      if (page.length < 1000) break;
    }
    save(path.join(RUN, 'database', `${name}.json`), rows);
    manifest.tables[name] = rows.length;
    console.log(`  ${name}: ${rows.length}`);
  }
}

// ── 2. Firebase comments + replies (public, read through Firestore REST) ──
async function backupFirebase() {
  console.log('Firebase comments');
  const base = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
  async function list(collectionPath) {
    const docs = [];
    let token = '';
    do {
      const page = await getJson(`${base}/${collectionPath}?pageSize=300${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
      docs.push(...(page.documents || []));
      token = page.nextPageToken || '';
    } while (token);
    return docs;
  }
  const comments = await list('comments');
  const replies = {};
  let replyCount = 0;
  for (const c of comments) {
    const id = c.name.split('/').pop();
    const r = await list(`comments/${id}/replies`);
    if (r.length) { replies[id] = r; replyCount += r.length; }
  }
  save(path.join(RUN, 'firebase', 'comments.json'), comments);           // raw Firestore format: restorable as-is
  save(path.join(RUN, 'firebase', 'replies.json'), replies);
  manifest.firebase = { comments: comments.length, replies: replyCount, note: 'userState (notification read times) is private to each user and not backed up' };
  console.log(`  comments: ${comments.length}, replies: ${replyCount}`);
}

// ── 3. storage files (only new ones download) ─────────
async function backupStorage() {
  console.log('Storage files');
  const buckets = await getJson(`${SUPABASE_URL}/storage/v1/bucket`, { headers: auth });
  for (const b of buckets) {
    const objects = [];
    async function walk(prefix) {
      for (let offset = 0; ; offset += 1000) {
        const items = await getJson(`${SUPABASE_URL}/storage/v1/object/list/${b.id}`, {
          method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
        });
        for (const it of items) {
          const full = prefix ? `${prefix}/${it.name}` : it.name;
          if (it.id === null) await walk(full);                           // a folder
          else objects.push({ path: full, size: (it.metadata && it.metadata.size) || 0 });
        }
        if (items.length < 1000) break;
      }
    }
    await walk('');
    let fresh = 0, bytes = 0, next = 0;
    const worker = async () => {
      while (next < objects.length) {
        const o = objects[next++];
        const target = path.join(FILES, b.id, ...o.path.split('/'));
        bytes += o.size;
        if (fs.existsSync(target) && fs.statSync(target).size === o.size) continue;
        try {
          const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${b.id}/${o.path.split('/').map(encodeURIComponent).join('/')}`, { headers: auth });
          if (!res.ok) throw new Error(String(res.status));
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
          fresh++;
        } catch (e) { problem(`could not download ${b.id}/${o.path} (${e.message})`); }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    save(path.join(RUN, `storage-${b.id}.json`), objects);                // the list of files at this moment
    manifest.storage[b.id] = { files: objects.length, mb: +(bytes / 1048576).toFixed(1), newlyDownloaded: fresh };
    console.log(`  ${b.id}: ${objects.length} files (${(bytes / 1048576).toFixed(1)} MB), ${fresh} new`);
  }
}

// ── 4. full SQL dump (only when Docker Desktop is running) ──
function backupSqlDump() {
  console.log('Full database dump (SQL)');
  if (!env.SUPABASE_POOLER_URL) return problem('SUPABASE_POOLER_URL missing in .env, so no SQL dump');
  // `docker info` can exit 0 even when the engine is down, so check that it really printed a version
  const up = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8' });
  if (up.status !== 0 || !/^\d+\.\d+/.test(String(up.stdout || '').trim())) {
    manifest.sqlDump = 'skipped: Docker Desktop is not running';
    return console.log('  skipped: start Docker Desktop to include it (the tables above already hold all the data)');
  }
  // The address (with password) goes in through an environment variable, not the command line
  const out = spawnSync('docker', ['run', '--rm', '-e', 'PGURL', 'postgres:17-alpine', 'sh', '-c',
    'pg_dump "$PGURL" --schema=public --no-owner --quote-all-identifiers'],
    { env: { ...process.env, PGURL: env.SUPABASE_POOLER_URL }, maxBuffer: 1024 * 1024 * 1024 });
  if (out.status !== 0) return problem('pg_dump failed: ' + String(out.stderr || '').slice(0, 300));
  fs.writeFileSync(path.join(RUN, 'database.sql'), out.stdout);
  manifest.sqlDump = `database.sql (${(out.stdout.length / 1048576).toFixed(1)} MB)`;
  console.log('  ' + manifest.sqlDump);
}

// ── run ──────────────────────────────────────────────
console.log(`Backing up to ${RUN}\n`);
for (const [step, fn] of [['tables', backupTables], ['firebase', backupFirebase], ['storage', backupStorage], ['sql dump', backupSqlDump]]) {
  try { await fn(); } catch (e) { problem(`${step} failed: ${e.message}`); }
}
manifest.finished = new Date().toISOString();
save(path.join(RUN, 'manifest.json'), manifest);

// Tell the admin page's Developer tab how this backup went (a failure here is only a warning)
try {
  const files = Object.values(manifest.storage).reduce((n, b) => n + b.files, 0);
  const mb = +Object.values(manifest.storage).reduce((n, b) => n + b.mb, 0).toFixed(1);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ops_events`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ kind: 'backup', ok: !manifest.problems.length, details: {
      folder: STAMP, profiles: manifest.tables.profiles ?? null, comments: manifest.firebase.comments ?? null,
      replies: manifest.firebase.replies ?? null, files, mb, sqlDump: manifest.sqlDump, problems: manifest.problems.slice(0, 5) } }),
  });
  if (!res.ok) console.warn(`  (could not report to the dashboard: ${res.status})`);
} catch (e) { console.warn('  (could not report to the dashboard: ' + e.message + ')'); }
console.log(`\n${manifest.problems.length ? 'Finished WITH PROBLEMS (see above)' : 'Backup complete'}: ${RUN}`);
process.exit(manifest.problems.length ? 1 : 0);
