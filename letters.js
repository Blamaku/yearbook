// =====================================================
//  GLUK YEARBOOK 2026 — LETTERS TO THE CLASS OF 2026  (letters.html)
//
//  • Write to one graduate (only they read it), to the whole class (the class
//    wall) or, for graduates, to your first-year self (kept, or shared on the wall).
//  • Everything stays sealed until Sunday 15 November 2026, 00:00 in Kisumu.
//    Before then "For you" is only a count; letters you wrote can still be
//    changed or deleted.
//  • letters.html?to=<profile id> starts a letter to that graduate.
//  • The server (api: letters.*) decides who may read what; the wall is the
//    public letters_wall view, empty until the letters open.
// =====================================================
(function () {
  'use strict';
  const OPEN_AT = Date.parse('2026-11-14T21:00:00Z');      // also in supabase-api CONFIG.lettersOpenAt and the SQL
  const CLASS = '2026';
  const MAX = 2000;
  const $ = id => document.getElementById(id);
  const isOpen = () => data ? !!data.open : Date.now() >= OPEN_AT;           // the server's clock wins over the phone's
  const plural = (n, one, many) => n === 1 ? one : many;
  const first = n => String(n || '').trim().split(/\s+/)[0] || '';
  const day = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const daysLeft = () => Math.max(0, Math.ceil((OPEN_AT - Date.now()) / 864e5));
  const para = s => esc(s).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');

  let user = null, me = null, data = null, unavailable = '';
  let kind = 'graduate', picked = null, editing = null, busy = false, run = 0;

  // ── the top of the page ──
  function paintHead() {
    $('ltOpens').textContent = isOpen()
      ? 'The letters are open. Letters written now arrive straight away.'
      : `Every letter stays sealed until Sunday 15 November · ${daysLeft()} ${plural(daysLeft(), 'day', 'days')} to go.`;
  }

  // ── For you ──
  function paintForYou() {
    const box = $('ltForYou');
    if (!user) {
      box.innerHTML = `<div class="lt-quiet">Sign in to see the letters written to you.</div>
        <button type="button" class="lt-btn" data-act="signin">Sign in</button>`;
      return;
    }
    if (unavailable) { box.innerHTML = `<div class="lt-quiet">${esc(unavailable)}</div>`; return; }
    if (!data) { box.innerHTML = '<div class="lt-quiet">Loading…</div>'; return; }
    const n = data.forMe.count;
    const shareBtn = me && me.classyear === CLASS && !me.isanonymous
      ? `<button type="button" class="lt-btn ghost" data-act="share">Ask classmates to write to you</button>` : '';
    if (!data.open) {
      box.innerHTML = n
        ? `<div class="lt-sealed"><div class="lt-stack" aria-hidden="true">${'<i>💌</i>'.repeat(Math.min(n, 5))}</div>
             <div><b>${n} sealed ${plural(n, 'letter is', 'letters are')} waiting for you</b>
             <span>${plural(n, 'It opens', 'They open')} on Sunday 15 November, in ${daysLeft()} ${plural(daysLeft(), 'day', 'days')}.</span></div></div>${shareBtn}`
        : `<div class="lt-quiet">No letters for you yet. They will stay sealed until Sunday 15 November.</div>${shareBtn}`;
      return;
    }
    const list = data.forMe.letters;
    box.innerHTML = list.length
      ? `<div class="lt-sub">${list.length} ${plural(list.length, 'letter', 'letters')} for you. Tap one to open it.</div>`
        + list.map(l => `<details class="lt-env-card" data-id="${Number(l.id)}">
            <summary><i aria-hidden="true">💌</i><span><b>${l.to_kind === 'self' ? 'From your past self' : 'From ' + esc(l.author_name)}</b>
              <small>${esc(day(l.created_at))}</small></span></summary>
            <div class="lt-paper"><p>${para(l.body)}</p><p class="lt-from">— ${esc(l.author_name)}</p>
              ${l.to_kind === 'graduate' ? `<div class="lt-paper-acts"><button type="button" data-act="remove" data-id="${Number(l.id)}">Remove</button>
                <button type="button" data-act="report" data-id="${Number(l.id)}">Report</button></div>` : ''}</div>
          </details>`).join('') + shareBtn
      : `<div class="lt-quiet">No letters for you yet.</div>${shareBtn}`;
  }

  // ── Write ──
  const LABELS = {
    graduate: { title: 'Write a letter', ph: g => g ? `Dear ${first(g.name)}, …` : 'Dear …' },
    class: { title: 'Write a letter', ph: () => 'Dear Class of 2026, …' },
    self: { title: 'Write a letter', ph: () => 'Dear first-year me, …' },
  };
  function signedAs() {
    if (me && me.name) return me.name;
    return user ? (user.displayName || String(user.email || '').split('@')[0]) : '';
  }
  function note() {
    const when = isOpen() ? 'straight away' : 'from Sunday 15 November';
    if (kind === 'graduate') return picked ? `Only ${first(picked.name)} will be able to read it, ${when}.` : 'Choose a graduate. Only they will be able to read your letter.';
    if (kind === 'class') return `It goes on the class wall for everyone to read, ${when}.`;
    return $('ltShare').checked ? `You will read it ${when}, and it goes on the class wall too.` : `Only you will read it, ${when}.`;
  }
  function paintWrite() {
    const signedIn = !!user;
    $('ltSelfKind').hidden = !(me && me.classyear === CLASS);
    if (kind === 'self' && $('ltSelfKind').hidden) kind = 'graduate';
    document.querySelectorAll('.lt-kind').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
      b.disabled = !!editing && b.dataset.kind !== kind;
    });
    $('ltTo').hidden = kind !== 'graduate';
    $('ltPicked').hidden = !picked;
    $('ltFind').hidden = !!picked;
    if (picked) $('ltPicked').innerHTML = `${avatar(picked)}<span><b>${esc(picked.name)}</b><small>${esc(picked.course || picked.dept || 'Class of 2026')}</small></span>
      ${editing ? '' : '<button type="button" data-act="unpick" aria-label="Choose someone else">✕</button>'}`;
    if (kind !== 'graduate' || picked) $('ltResults').innerHTML = '';
    $('ltShareRow').hidden = kind !== 'self';
    $('ltBody').placeholder = LABELS[kind].ph(picked);
    $('ltWriteTitle').textContent = editing ? 'Change your letter' : LABELS[kind].title;
    $('ltSign').textContent = signedIn ? 'Signed: ' + signedAs() : '';
    $('ltChars').textContent = `${$('ltBody').value.length} / ${MAX}`;
    $('ltNote').textContent = note();
    $('ltCancel').hidden = !editing;
    const send = $('ltSend');
    send.textContent = !signedIn ? 'Sign in to write a letter' : editing ? 'Save changes' : isOpen() ? 'Send the letter 💌' : 'Seal the letter 💌';
    send.disabled = busy || (signedIn && !!unavailable);
  }
  function avatar(p) {
    const photo = window.safeUrl(p.photo_url || (Array.isArray(p.photos) && p.photos[0]) || '');
    const ini = String(p.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    return photo ? `<img class="lt-av" src="${esc(photo)}" alt="" loading="lazy">` : `<span class="lt-av">${esc(ini)}</span>`;
  }

  // Graduates by name (Class of 2026, not anonymous, not you)
  let findT = 0, findRun = 0;
  function find() {
    clearTimeout(findT);
    const q = $('ltFind').value.replace(/[%_*\\"(),]/g, ' ').replace(/\s+/g, ' ').trim();
    if (q.length < 2) { $('ltResults').innerHTML = ''; return; }
    findT = setTimeout(async () => {
      const mine = ++findRun;
      const { data: rows, error } = await supabase.from('profiles_public').select('id,uid,name,course,dept,photo_url,photos')
        .eq('classyear', CLASS).eq('isanonymous', false).ilike('name', `%${q}%`).order('name').limit(8);
      if (mine !== findRun) return;
      if (error) { $('ltResults').innerHTML = '<div class="lt-quiet">Could not search right now.</div>'; return; }
      const list = (rows || []).filter(r => !user || r.uid !== user.uid);
      $('ltResults').innerHTML = list.length
        ? list.map(r => `<button type="button" class="lt-result" role="option" data-act="pick" data-id="${Number(r.id)}">${avatar(r)}
            <span><b>${esc(r.name)}</b><small>${esc(r.course || r.dept || 'Class of 2026')}</small></span></button>`).join('')
        : `<div class="lt-quiet">No graduate called "${esc(q)}". Letters go to the Class of 2026.</div>`;
      list.forEach(r => { found[r.id] = r; });
    }, 250);
  }
  const found = {};
  async function pickById(id) {
    if (found[id]) { picked = found[id]; return; }
    const { data: row } = await supabase.from('profiles_public').select('id,uid,name,course,dept,photo_url,photos,classyear,isanonymous').eq('id', id).limit(1).maybeSingle();
    if (row && row.classyear === CLASS && !row.isanonymous && !(user && row.uid === user.uid)) picked = row;
    else if (row) showToast(row.uid && user && row.uid === user.uid ? 'That is you! Write to your first-year self instead.' : 'Letters go to the Class of 2026.');
  }

  async function send() {
    if (!user) { window.openAuthModal(() => {}, 'login'); return; }
    const body = $('ltBody').value.trim();
    if (kind === 'graduate' && !picked && !editing) { showToast('Choose the graduate you are writing to.'); $('ltFind').focus(); return; }
    if (!body) { showToast('Write your letter first.'); $('ltBody').focus(); return; }
    busy = true; paintWrite();
    const wasEditing = !!editing;
    try {
      const payload = editing ? { id: editing.id, body, share: $('ltShare').checked }
        : { to: kind, profileId: picked ? Number(picked.id) : undefined, body, share: $('ltShare').checked };
      await window.gApi('letters.save', payload);
      showToast(wasEditing ? 'Saved ✅' : isOpen() ? 'Sent 💌' : 'Sealed 💌 It opens on Sunday 15 November', 3500);
      resetForm();
      await load(user);
      $('yours').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      console.warn('[letters.save]', e);
      showToast(e.code === 'letters_coming' || e.code === 'unknown_action' || e.unreachable
        ? 'Letters are being switched on. Please try again later.' : (e.message || 'Could not send the letter.'), 4000);
    } finally { busy = false; paintWrite(); }
  }
  function resetForm() {
    editing = null; picked = kind === 'graduate' ? null : picked;
    $('ltBody').value = ''; $('ltShare').checked = false; $('ltFind').value = '';
    try { sessionStorage.removeItem('gluk-letter-draft'); } catch (e) {}
  }

  // ── Letters you've written ──
  const toLine = l => l.to_kind === 'graduate' ? 'To ' + esc(l.to_name || 'a graduate') : l.to_kind === 'class' ? 'To the Class of 2026' : 'To my first-year self';
  function paintMine() {
    const list = (data && data.written) || [];
    $('yours').hidden = !user || !list.length;
    $('ltMine').innerHTML = list.map(l => {
      const status = l.hidden ? '<span class="lt-chip warn">Hidden by the admin</span>'
        : isOpen() ? '<span class="lt-chip">Delivered</span>' : '<span class="lt-chip">Sealed · opens 15 Nov</span>';
      const wall = l.to_kind === 'self' && l.on_wall ? ' · shared on the wall' : '';
      return `<div class="lt-card lt-mine">
        <div class="lt-mine-top"><b>${toLine(l)}</b>${status}</div>
        <div class="lt-mine-body">${para(l.body)}</div>
        <div class="lt-mine-foot"><small>Written ${esc(day(l.created_at))}${wall}</small>
          <span>${isOpen() ? '' : `<button type="button" data-act="edit" data-id="${Number(l.id)}">Change</button>`}
          <button type="button" class="danger" data-act="delete" data-id="${Number(l.id)}">Delete</button></span></div>
      </div>`;
    }).join('');
  }

  // ── The class wall ──
  async function paintWall() {
    const box = $('ltWall');
    if (!isOpen()) {
      const n = data ? data.wallCount : null;
      box.innerHTML = `<div class="lt-card lt-quiet">${n ? `${n} ${plural(n, 'letter', 'letters')} to the whole class ${plural(n, 'is', 'are')} sealed here.` : 'Letters to the whole class will appear here.'}
        They open on Sunday 15 November.</div>`;
      return;
    }
    const { data: rows, error } = await supabase.from('letters_wall').select('id,author_name,to_kind,body,created_at').order('created_at', { ascending: false }).limit(300);
    if (error) { box.innerHTML = '<div class="lt-card lt-quiet">The class wall could not load. Please try again.</div>'; return; }
    box.innerHTML = (rows || []).length
      ? `<div class="lt-wall">${rows.map(l => `<article class="lt-card lt-note-card">
          <div class="lt-paper-to">${l.to_kind === 'self' ? 'To my first-year self' : 'To the Class of 2026'}</div>
          <p>${para(l.body)}</p><p class="lt-from">— ${esc(l.author_name)}</p>
          ${user ? `<button type="button" class="lt-report" data-act="report" data-id="${Number(l.id)}">Report</button>` : ''}
        </article>`).join('')}</div>`
      : '<div class="lt-card lt-quiet">No letters to the whole class yet. Be the first!</div>';
  }

  // ── loading ──
  async function load(u) {
    const mine = ++run;
    user = u || null; data = null; unavailable = '';
    if (user && picked && picked.uid === user.uid) picked = null;          // a letter link to yourself
    paintForYou(); paintWrite();
    if (user) {
      try {
        const { data: rows } = await supabase.from('profiles_public').select('id,name,classyear,isanonymous').eq('uid', user.uid).limit(1);
        me = rows && rows[0] || null;
      } catch (e) { me = null; }
      try { data = await window.gApi('letters.mine', {}); }
      catch (e) {
        console.warn('[letters.mine]', e);
        unavailable = e.code === 'letters_coming' || e.code === 'unknown_action' || e.unreachable
          ? 'Letters are being switched on. Please check back soon.' : (e.message || 'Could not load your letters.');
      }
    } else me = null;
    if (mine !== run) return;
    paintForYou(); paintWrite(); paintMine(); paintWall();
  }

  // ── taps ──
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act], .lt-kind');
    if (!b) return;
    if (b.classList.contains('lt-kind')) {
      if (b.disabled) return;
      kind = b.dataset.kind; paintWrite();
      if (kind === 'graduate' && !picked) $('ltFind').focus(); else $('ltBody').focus();
      return;
    }
    const id = Number(b.dataset.id), act = b.dataset.act;
    if (act === 'signin') window.openAuthModal(() => {}, 'login');
    else if (act === 'pick') { picked = found[id] || null; paintWrite(); $('ltBody').focus(); }
    else if (act === 'unpick') { picked = null; paintWrite(); $('ltFind').focus(); }
    else if (act === 'share') {
      const url = location.origin + '/letters.html?to=' + encodeURIComponent(me.id) + '#write';
      const text = `Write me a letter for graduation week 💌 It stays sealed until 15 November.`;
      if (navigator.share) { try { await navigator.share({ title: 'Write me a letter', text, url }); } catch (er) {} }
      else { try { await navigator.clipboard.writeText(text + ' ' + url); showToast('Link copied. Paste it in your class group 💌'); } catch (er) { prompt('Copy this link:', url); } }
    }
    else if (act === 'edit') {
      const l = (data.written || []).find(x => Number(x.id) === id); if (!l) return;
      editing = l; kind = l.to_kind;
      picked = l.to_kind === 'graduate' ? { id: l.to_profile, name: l.to_name || 'a graduate' } : null;
      $('ltBody').value = l.body; $('ltShare').checked = !!(l.to_kind === 'self' && l.on_wall);
      paintWrite(); $('write').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('ltBody').focus({ preventScroll: true });
    }
    else if (act === 'delete') {
      if (!confirm('Delete this letter? This cannot be undone.')) return;
      try { await window.gApi('letters.delete', { id }); showToast('Letter deleted'); if (editing && editing.id === id) resetForm(); await load(user); }
      catch (er) { showToast(er.message || 'Could not delete it.'); }
    }
    else if (act === 'remove') {
      if (!confirm('Remove this letter from your letters?')) return;
      try { await window.gApi('letters.remove', { id }); showToast('Removed'); await load(user); }
      catch (er) { showToast(er.message || 'Could not remove it.'); }
    }
    else if (act === 'report') {
      if (!confirm('Ask the admin to look at this letter?')) return;
      try { await window.gApi('letters.report', { id }); showToast('Thanks. The admin will take a look.'); }
      catch (er) { showToast(er.message || 'Could not report it.'); }
    }
  });
  $('ltCancel').addEventListener('click', () => { resetForm(); paintWrite(); });
  $('ltSend').addEventListener('click', send);
  $('ltFind').addEventListener('input', find);
  $('ltShare').addEventListener('change', paintWrite);
  // The draft survives a sign-in round trip or a refresh
  $('ltBody').addEventListener('input', () => {
    $('ltChars').textContent = `${$('ltBody').value.length} / ${MAX}`;
    if (!editing) try { sessionStorage.setItem('gluk-letter-draft', JSON.stringify({ kind, to: picked && picked.id, body: $('ltBody').value })); } catch (e) {}
  });

  // ── start ──
  (async () => {
    paintHead(); paintWrite();
    let draft = null;
    try { draft = JSON.parse(sessionStorage.getItem('gluk-letter-draft') || 'null'); } catch (e) {}
    const to = Number(new URLSearchParams(location.search).get('to')) || (draft && draft.to) || 0;
    if (draft) { kind = draft.kind || 'graduate'; $('ltBody').value = draft.body || ''; }
    if (to) { kind = 'graduate'; await pickById(to); }
    paintWrite();
    if (location.hash === '#write' || to) setTimeout(() => $('write').scrollIntoView({ block: 'start' }), 300);
    auth.onAuthStateChanged(u => { load(u); });
  })();
})();
