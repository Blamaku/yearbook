// =====================================================
//  GLUK YEARBOOK 2026 — COPY COMMENTS FROM FIREBASE TO SUPABASE (one-off)
//
//  node scripts/migrate-comments.mjs            → look only: counts, problems, a sample row
//  node scripts/migrate-comments.mjs --write    → copy, then check every comment and reply arrived
//
//  Run --write only after Firestore comments are read-only (firestore.rules), so
//  nothing new appears there while copying. Ids are kept, so running it twice is
//  safe; it refuses to run once people have commented in Supabase (it would
//  overwrite their newer likes and replies) unless --force is added.
//  Keys come from .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
// =====================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRESTORE = 'https://firestore.googleapis.com/v1/projects/yearbook-d3f4f/databases/(default)/documents';
const WRITE = process.argv.includes('--write'), FORCE = process.argv.includes('--force');

const env = {};
for (const line of fs.readFileSync(path.join(REPO, '.env'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].trim();
}
const SUPABASE_URL = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) { console.error('.env needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function getJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} from ${url.replace(/\?.*/, '')}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

// ── read Firestore (public) ──
async function list(collectionPath) {
  const docs = [];
  let token = '';
  do {
    const page = await getJson(`${FIRESTORE}/${collectionPath}?pageSize=300${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
    docs.push(...(page.documents || []));
    token = page.nextPageToken || '';
  } while (token);
  return docs;
}
const val = v => v == null ? null
  : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue
  : 'timestampValue' in v ? v.timestampValue : 'booleanValue' in v ? v.booleanValue
  : 'arrayValue' in v ? (v.arrayValue.values || []).map(val) : null;
const plain = d => ({ id: d.name.split('/').pop(), createTime: d.createTime,
  ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, val(v)])) });

// ── turn them into rows ──
const problems = [];
const ID = /^[A-Za-z0-9]{1,40}$/;
const name = s => String(s || '').trim().slice(0, 100) || 'Anonymous';
const likers = a => [...new Set((Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && x))];
const at = d => d.timestamp || d.createTime;

export function toRows(comments, repliesByComment) {
  const rows = [], replyRows = [];
  for (const c of comments) {
    const pid = Number(c.studentId), text = String(c.text || '').trim();
    if (!ID.test(c.id)) { problems.push(`comment ${c.id}: id is not letters and digits, skipped`); continue; }
    if (!Number.isInteger(pid) || pid <= 0) { problems.push(`comment ${c.id}: no profile id ("${c.studentId}"), skipped`); continue; }
    if (!text || text.length > 300) { problems.push(`comment ${c.id}: empty or too long text, skipped`); continue; }
    const reps = (repliesByComment[c.id] || []).filter(r => {
      const t = String(r.text || '').trim();
      if (!ID.test(r.id) || !t || t.length > 300) { problems.push(`reply ${c.id}/${r.id}: bad id or text, skipped`); return false; }
      return true;
    }).sort((a, b) => String(at(a)).localeCompare(String(at(b))));
    const last = reps.at(-1), liked = likers(c.likedBy);
    rows.push({ id: c.id, profile_id: pid, author_uid: String(c.authorUid || 'unknown'), author_name: name(c.authorName), text,
      like_count: liked.length, liked_by: liked, reply_count: reps.length,
      last_reply_at: last ? at(last) : null, last_reply_by: last ? name(last.authorName) : null, last_reply_uid: last ? String(last.authorUid || '') || null : null,
      created_at: at(c) });
    for (const r of reps) {
      const rl = likers(r.likedBy);
      replyRows.push({ id: r.id, comment_id: c.id, author_uid: String(r.authorUid || 'unknown'), author_name: name(r.authorName),
        text: String(r.text).trim(), like_count: rl.length, liked_by: rl, created_at: at(r) });
    }
  }
  return { rows, replyRows };
}

async function idsIn(table) {
  const ids = new Set();
  for (let from = 0; ; from += 1000) {
    const page = await getJson(`${SUPABASE_URL}/rest/v1/${table}?select=id&order=id.asc&limit=1000&offset=${from}`, { headers: auth });
    page.forEach(r => ids.add(r.id));
    if (page.length < 1000) return ids;
  }
}
async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    await getJson(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=id`, { method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 200)) });
  }
}

// ── run ──
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Reading Firebase comments…');
  const comments = (await list('comments')).map(plain);
  const repliesByComment = {};
  for (const c of comments) {
    const r = (await list(`comments/${c.id}/replies`)).map(plain);
    if (r.length) repliesByComment[c.id] = r;
  }
  const { rows, replyRows } = toRows(comments, repliesByComment);
  console.log(`  Firebase: ${comments.length} comments, ${Object.values(repliesByComment).flat().length} replies`);
  console.log(`  to copy:  ${rows.length} comments, ${replyRows.length} replies`);
  problems.forEach(p => console.log('  ! ' + p));
  if (rows[0]) console.log('  sample:', JSON.stringify({ ...rows[0], author_uid: '…', liked_by: `[${rows[0].liked_by.length}]` }));

  if (!WRITE) { console.log('\nLooked only. Add --write to copy.'); process.exit(0); }

  const before = await idsIn('comments');
  const fromFirebase = new Set(rows.map(r => r.id));
  const newer = [...before].filter(id => !fromFirebase.has(id));
  if (newer.length && !FORCE) {
    console.error(`\nStopped: Supabase already has ${newer.length} comment(s) that are not from Firebase, so people are commenting there.\n` +
      'Copying again would overwrite their newer likes and replies. Add --force only if you are sure.');
    process.exit(1);
  }
  console.log('\nCopying…');
  await upsert('comments', rows);
  await upsert('comment_replies', replyRows);

  const [cIds, rIds] = await Promise.all([idsIn('comments'), idsIn('comment_replies')]);
  const missingC = rows.filter(r => !cIds.has(r.id)).length, missingR = replyRows.filter(r => !rIds.has(r.id)).length;
  console.log(`  Supabase now: ${cIds.size} comments, ${rIds.size} replies`);
  if (missingC || missingR) { console.error(`  MISSING after copy: ${missingC} comments, ${missingR} replies`); process.exit(1); }
  console.log('  every comment and reply arrived ✓');
}
