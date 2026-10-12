// =====================================================
//  GLUK YEARBOOK 2026 — GLOW UP: THEN VS NOW  (glowup.html, graduation week day 2)
//
//  • A Class of 2026 graduate with a named profile adds two photos: one from first year ("then")
//    and one from now (a new photo or one already on their profile), a year and a caption.
//  • It stays sealed until Monday 16 November 2026, 00:00 in Kisumu. Until then the gallery only
//    says how many are sealed (the glowups_count view); from then it is the glowups_wall view.
//  • Each glow-up is a slider: drag across to go from then to now.
//  • The server (api: glow.*) checks who may add one and that both photos are the graduate's own.
// =====================================================
(function () {
  'use strict';
  const OPEN_AT = Date.parse('2026-11-15T21:00:00Z');      // also in supabase-api CONFIG.glowRevealAt and the SQL
  const CLASS = '2026';
  const $ = id => document.getElementById(id);
  const E = s => window.escHtml(s == null ? '' : String(s));
  const plural = (n, one, many) => n === 1 ? one : many;
  const daysLeft = () => Math.max(0, Math.ceil((OPEN_AT - Date.now()) / 864e5));
  const isOpen = () => data ? !!data.open : Date.now() >= OPEN_AT;           // the server's clock wins over the phone's
  const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

  let user = null, me = null, data = null, unavailable = '', editing = false, busy = false, run = 0;
  let draft = null, pickSide = null, wallCount = null;

  // ── the slider ──
  function compare(thenUrl, nowUrl, year, name) {
    const who = name ? E(name) + ': ' : '';
    return `<div class="gu-cmp" style="--x:50%">
      <img class="gu-now" src="${E(nowUrl)}" alt="${who}now" loading="lazy">
      <img class="gu-then" src="${E(thenUrl)}" alt="${who}then" loading="lazy">
      <span class="gu-tag l">Then${year ? ' · ' + Number(year) : ''}</span><span class="gu-tag r">Now · 2026</span>
      <span class="gu-handle" aria-hidden="true"></span>
      <input type="range" class="gu-range" min="0" max="100" value="50" aria-label="Slide from then to now">
    </div>`;
  }
  document.addEventListener('input', e => {
    if (e.target.classList.contains('gu-range')) e.target.parentNode.style.setProperty('--x', e.target.value + '%');
  });

  // ── the top of the page ──
  function paintHead() {
    const n = data ? data.count : wallCount;
    $('guPlace').textContent = isOpen()
      ? 'The gallery is open. Drag each photo across to see the glow-up.'
      : `Your first year next to now. The gallery opens on Monday 16 November, in ${daysLeft()} ${plural(daysLeft(), 'day', 'days')}`
        + (n ? ` · ${n} ${plural(n, 'glow-up', 'glow-ups')} sealed so far.` : '.');
  }

  // ── yours ──
  function newDraft(g) {
    return g ? { then: { url: g.then_url }, now: { url: g.now_url }, year: g.then_year || '', caption: g.caption || '' }
      : { then: null, now: null, year: 2022, caption: '' };
  }
  function slot(side) {
    const p = draft[side], img = p && (p.preview || p.url);
    const t = side === 'then' ? ['Then', 'A first-year photo'] : ['Now', 'A photo from this year'];
    return `<button type="button" class="gu-slot${img ? ' has' : ''}" data-act="pick" data-side="${side}">
      ${img ? `<img src="${E(img)}" alt="">` : '<i aria-hidden="true">📷</i>'}
      <b>${t[0]}</b><span>${img ? 'Tap to change' : t[1]}</span></button>`;
  }
  function paintMine() {
    const box = $('guMine');
    if (!user) {
      box.innerHTML = `<div class="lt-quiet">Graduating in 2026? Sign in to add your first-year photo next to one from now.</div>
        <button type="button" class="lt-btn" data-act="signin">Sign in</button>`;
      return;
    }
    if (unavailable) { box.innerHTML = `<div class="lt-quiet">${E(unavailable)}</div>`; return; }
    if (!data) { box.innerHTML = '<div class="lt-quiet">Loading…</div>'; return; }
    if (!me) {
      box.innerHTML = `<div class="lt-quiet">Create your yearbook profile first, then add your Glow Up.</div>
        <a class="lt-btn" href="profiles.html?action=add">Create my profile</a>`;
      return;
    }
    if (String(me.classyear || '') !== CLASS) {
      box.innerHTML = `<div class="lt-quiet">Glow Up is for the Class of ${CLASS}. Enjoy the gallery from Monday 16 November!</div>`;
      return;
    }
    if (me.isanonymous) {
      box.innerHTML = `<div class="lt-quiet">Your profile is anonymous. Show your name on it to add a Glow Up.</div>
        <a class="lt-btn ghost" href="profile.html?id=${Number(me.id)}">Open my profile</a>`;
      return;
    }
    const g = data.glow;
    if (g && !editing) {
      box.innerHTML = `${compare(g.then_url, g.now_url, g.then_year, me.name)}
        ${g.caption ? `<p class="gu-cap">“${E(g.caption)}”</p>` : ''}
        <p class="gu-status">${g.hidden ? 'The admin has hidden this one from the gallery.'
          : isOpen() ? '✨ It is in the gallery.' : `🔒 Sealed until Monday 16 November. Only you can see it.`}</p>
        <div class="lt-acts gu-acts"><button type="button" class="lt-btn" data-act="edit">Change it</button>
          <button type="button" class="lt-btn ghost" data-act="share">Ask classmates to add theirs</button>
          <button type="button" class="lt-btn ghost danger" data-act="delete">Delete</button></div>`;
      return;
    }
    if (!draft) draft = newDraft(g);
    const own = [me.photo_url, ...(me.photos || [])].filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 5);
    box.innerHTML = `<div class="gu-pair">${slot('then')}<span class="gu-arrow" aria-hidden="true">→</span>${slot('now')}</div>
      ${own.length ? `<div class="gu-own"><span>Or use a profile photo for <b>Now</b>:</span>
        ${own.map(u => `<button type="button" class="gu-thumb${draft.now && draft.now.url === u ? ' on' : ''}" data-act="useown" data-url="${E(u)}"><img src="${E(u)}" alt="A profile photo"></button>`).join('')}</div>` : ''}
      <label class="lt-label" for="guYear">When was the first photo taken?</label>
      <select class="lt-find gu-year" id="guYear"><option value="">Not sure</option>
        ${YEARS.map(y => `<option value="${y}"${Number(draft.year) === y ? ' selected' : ''}>${y}</option>`).join('')}</select>
      <label class="lt-label" for="guCap">A caption (optional)</label>
      <input class="lt-find" id="guCap" maxlength="140" placeholder="From lost fresher to final-year legend" value="${E(draft.caption)}">
      ${draft.then && draft.now ? `<p class="lt-label">Preview: drag across</p>${compare(draft.then.preview || draft.then.url, draft.now.preview || draft.now.url, draft.year)}` : ''}
      <p class="lt-note">It stays sealed until Monday 16 November. Then it joins the class gallery with your name and course.</p>
      <div class="lt-acts"><button type="button" class="lt-send" data-act="save"${busy ? ' disabled' : ''}>${busy ? 'Saving…' : g ? 'Save changes ✨' : 'Seal my Glow Up ✨'}</button>
        ${g ? '<button type="button" class="lt-cancel" data-act="cancel">Cancel</button>' : ''}</div>`;
  }

  // ── the gallery ──
  async function paintWall() {
    const box = $('guWall');
    if (!isOpen()) {
      let n = data ? data.count : null;
      if (n == null) {
        const r = await supabase.from('glowups_count').select('n').limit(1);
        if (r.error) { box.innerHTML = '<div class="lt-card lt-quiet">Glow Up is being switched on. Please check back soon.</div>'; return; }
        n = (r.data && r.data[0] && r.data[0].n) || 0;
        wallCount = n; paintHead();
      }
      box.innerHTML = `<div class="lt-card gu-sealed"><div class="gu-sealed-art" aria-hidden="true"><i>🔒</i></div>
        <div><b>${n ? `${n} ${plural(n, 'glow-up is', 'glow-ups are')} sealed` : 'The gallery is sealed'}</b>
        <span>It opens on Monday 16 November, in ${daysLeft()} ${plural(daysLeft(), 'day', 'days')}. Day 2 of <a href="grad.html">graduation week</a>.</span></div></div>`;
      return;
    }
    const { data: rows, error } = await supabase.from('glowups_wall').select('profile_id,name,course,then_url,now_url,then_year,caption').limit(1000);
    if (error) { box.innerHTML = '<div class="lt-card lt-quiet">The gallery could not load. Please try again.</div>'; return; }
    const list = (rows || []).slice();
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    box.innerHTML = list.length
      ? `<p class="gu-count">${list.length} ${plural(list.length, 'glow-up', 'glow-ups')} · drag each one across</p><div class="gu-wall">${list.map(g => `<article class="gu-item">
          ${compare(g.then_url, g.now_url, g.then_year, g.name)}
          <div class="gu-who"><a href="profile.html?id=${Number(g.profile_id)}"><b>${E(g.name)}</b></a><span>${E(g.course || '')}</span>
            ${g.caption ? `<p>“${E(g.caption)}”</p>` : ''}
            ${user ? `<button type="button" class="lt-report" data-act="report" data-id="${Number(g.profile_id)}">Report</button>` : ''}</div>
        </article>`).join('')}</div>`
      : '<div class="lt-card lt-quiet">No glow-ups yet. Be the first!</div>';
  }

  // ── loading ──
  async function load(u) {
    const mine = ++run;
    user = u || null; data = null; unavailable = ''; me = null;
    paintMine();
    if (user) {
      try {
        const { data: rows } = await supabase.from('profiles_public').select('id,name,classyear,isanonymous,photo_url,photos').eq('uid', user.uid).limit(1);
        me = rows && rows[0] || null;
      } catch (e) { me = null; }
      try { data = await window.gApi('glow.mine', {}); }
      catch (e) {
        console.warn('[glow.mine]', e);
        unavailable = e.code === 'glow_coming' || e.code === 'unknown_action' || e.unreachable
          ? 'Glow Up is being switched on. Please check back soon.' : (e.message || 'Could not load your Glow Up.');
      }
    }
    if (mine !== run) return;
    paintHead(); paintMine(); paintWall();
  }

  function keepInputs() {
    if (!draft) return;
    if ($('guYear')) draft.year = $('guYear').value;
    if ($('guCap')) draft.caption = $('guCap').value;
  }

  async function save() {
    keepInputs();
    if (!draft.then || !draft.now) { window.showToast('Add both photos: one from then and one from now.'); return; }
    busy = true; paintMine();
    try {
      for (const side of ['then', 'now']) {
        const p = draft[side];
        if (p.blob) { p.url = await uploadPhoto(p.blob, user.uid, 'glow' + side); p.blob = null; }
      }
      const r = await window.gApi('glow.save', { then_url: draft.then.url, now_url: draft.now.url,
        then_year: draft.year === '' ? null : Number(draft.year), caption: draft.caption });
      data.glow = r.glow; if (!editing) data.count++;
      editing = false; draft = null;
      window.showToast(isOpen() ? 'Saved ✨' : 'Sealed ✨ It opens on Monday 16 November', 3500);
    } catch (e) { console.warn('[glow.save]', e); window.showToast(e.message || 'Could not save it.'); }
    busy = false; paintHead(); paintMine();
  }

  // ── taps ──
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b || busy) return;
    const act = b.dataset.act;
    if (act === 'signin') window.openAuthModal(() => {}, 'login');
    else if (act === 'pick') { keepInputs(); pickSide = b.dataset.side; $('guFile').value = ''; $('guFile').click(); }
    else if (act === 'useown') { keepInputs(); draft.now = { url: b.dataset.url }; paintMine(); }
    else if (act === 'save') save();
    else if (act === 'edit') { editing = true; draft = newDraft(data.glow); paintMine(); }
    else if (act === 'cancel') { editing = false; draft = null; paintMine(); }
    else if (act === 'delete') {
      if (!confirm('Delete your Glow Up?')) return;
      try { await window.gApi('glow.delete', {}); data.glow = null; data.count = Math.max(0, data.count - 1); draft = null; window.showToast('Deleted'); }
      catch (er) { window.showToast(er.message || 'Could not delete it.'); }
      paintHead(); paintMine();
    }
    else if (act === 'share') {
      const url = location.origin + '/glowup.html', text = 'Glow Up ✨ Put your first-year photo next to one from now. The Class of 2026 gallery opens Monday 16 November.';
      if (navigator.share) { try { await navigator.share({ title: 'Glow Up: Then vs Now', text, url }); } catch (er) {} }
      else { try { await navigator.clipboard.writeText(text + ' ' + url); window.showToast('Link copied. Paste it in your class group ✨'); } catch (er) { prompt('Copy this link:', url); } }
    }
    else if (act === 'report') {
      if (!confirm('Ask the admin to look at this glow-up?')) return;
      try { await window.gApi('glow.report', { profileId: Number(b.dataset.id) }); window.showToast('Thanks. The admin will take a look.'); }
      catch (er) { window.showToast(er.message || 'Could not report it.'); }
    }
  });
  $('guFile').addEventListener('change', () => {
    const f = $('guFile').files[0], side = pickSide;
    if (!f || !side) return;
    if (!/^image\//.test(f.type)) { window.showToast('Choose a photo.'); return; }
    const rd = new FileReader();
    rd.onload = async () => {
      const { blob, preview } = await compressImage(rd.result, 1200, 0.8);
      draft[side] = { blob, preview };
      paintMine();
    };
    rd.readAsDataURL(f);
  });

  // ── start ──
  paintHead(); paintMine(); paintWall();
  auth.onAuthStateChanged(u => { load(u); });
})();
