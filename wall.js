// =====================================================
//  GLUK YEARBOOK 2026 — THE CLASS WALL  (wall.html?d=…, graduation week days 3–6)
//
//  ?d=timemachine  ⏳ memories from each year, 2022 → 2026   (opens Tue 17 Nov)
//  ?d=mypeople     🫂 tag your best friend, study partner, mentor, chaos partner (Wed 18 Nov)
//  ?d=soundtrack   🎧 the class playlist + things only the Class of 2026 understands (Thu 19 Nov)
//  ?d=torch        🔥 one piece of advice for the freshers (Fri 20 Nov)
//
//  Anyone with a named yearbook profile adds now; each part stays sealed until 00:00 in Kisumu
//  on its day. The api (wall.*) checks and keeps them; the public grad_posts_wall view shows them.
// =====================================================
(function () {
  'use strict';
  const OPENS = { memory: '2026-11-16T21:00:00Z', tag: '2026-11-17T21:00:00Z', song: '2026-11-18T21:00:00Z', joke: '2026-11-18T21:00:00Z', advice: '2026-11-19T21:00:00Z' };   // also in the api CONFIG.wallOpens and the SQL
  const DAYS = {
    timemachine: { emoji: '⏳', day: 'Day 3 · Tuesday 17 November', title: 'Time Machine', kinds: ['memory'],
      place: 'Memory Lane 2022 → 2026: one chapter for every year, told by the class.' },
    mypeople: { emoji: '🫂', day: 'Day 4 · Wednesday 18 November', title: 'My People', kinds: ['tag'],
      place: 'Tag your best friend, study partner, mentor and chaos partner. They find out on the day.' },
    soundtrack: { emoji: '🎧', day: 'Day 5 · Thursday 19 November', title: 'Soundtrack & Inside Jokes', kinds: ['song', 'joke'],
      place: 'The Class of 2026 playlist, and the things only we understand.' },
    torch: { emoji: '🔥', day: 'Day 6 · Friday 20 November', title: 'Pass the Torch', kinds: ['advice'],
      place: 'One piece of advice for the freshers who come after us.' },
  };
  const ROLES = { bestie: ['💛', 'Best friend'], study: ['📚', 'Study partner'], mentor: ['🧭', 'Mentor'], chaos: ['🌪️', 'Chaos partner'] };
  const YEARS = [2022, 2023, 2024, 2025, 2026];
  const NOUN = { memory: ['memory', 'memories'], tag: ['tag', 'tags'], song: ['song', 'songs'], joke: ['inside joke', 'inside jokes'], advice: ['piece of advice', 'pieces of advice'] };
  const $ = id => document.getElementById(id);
  const E = s => window.escHtml(s == null ? '' : String(s));
  const n2 = (n, k) => `${n} ${n === 1 ? NOUN[k][0] : NOUN[k][1]}`;
  const opensDay = k => new Date(OPENS[k]).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Nairobi' });
  const daysTo = k => Math.max(0, Math.ceil((Date.parse(OPENS[k]) - Date.now()) / 864e5));
  const para = s => E(s).replace(/\n+/g, '<br>');
  const face = (url, name) => url ? `<img class="wl-face" src="${E(url)}" alt="" loading="lazy">` : `<span class="wl-face">${E(String(name || '?').trim().charAt(0).toUpperCase())}</span>`;

  let d = new URLSearchParams(location.search).get('d');
  if (!DAYS[d]) d = 'timemachine';
  let user = null, data = null, unavailable = '', busy = false, run = 0, picked = null, found = {}, findT = null, counts = null;
  const isOpen = k => data ? !!data.open[k] : Date.now() >= Date.parse(OPENS[k]);

  function paintHead() {
    const D = DAYS[d];
    $('wlEmo').textContent = D.emoji; $('wlDay').textContent = D.day; $('wlTitle').textContent = D.title;
    document.title = `${D.title} — GLUK Yearbook 2026`;
    const k = D.kinds[0];
    const c = counts ? D.kinds.map(x => n2(counts[x] || 0, x)).join(' and ') : '';
    $('wlPlace').textContent = isOpen(k) ? D.place + ' It is open!'
      : `${D.place} Opens ${opensDay(k)}, in ${daysTo(k)} ${daysTo(k) === 1 ? 'day' : 'days'}${c ? ` · ${c} sealed so far` : ''}.`;
    $('wlTabs').innerHTML = Object.entries(DAYS).map(([key, x]) => `<a class="wl-tab${key === d ? ' on' : ''}" href="wall.html?d=${key}"${key === d ? ' aria-current="page"' : ''}>${x.emoji} ${E(x.title.split(' & ')[0])}</a>`).join('');
  }

  // ── the form ──
  function form() {
    const box = $('wlForm');
    if (!user) { box.innerHTML = `<div class="lt-quiet">Sign in to add yours. It stays sealed until the day.</div><button type="button" class="lt-btn" data-act="signin">Sign in</button>`; return; }
    if (unavailable) { box.innerHTML = `<div class="lt-quiet">${E(unavailable)}</div>`; return; }
    if (!data) { box.innerHTML = '<div class="lt-quiet">Loading…</div>'; return; }
    if (!data.profile) { box.innerHTML = `<div class="lt-quiet">Create your yearbook profile first, then add to the class wall.</div><a class="lt-btn" href="profiles.html?action=add">Create my profile</a>`; return; }
    const sealed = k => isOpen(k) ? 'It goes on the wall straight away.' : `It stays sealed until ${opensDay(k)}.`;
    const blocks = {
      memory: () => `<label class="lt-label" for="wlYear">Which year?</label>
        <div class="wl-years" role="group" aria-label="Year">${YEARS.map(y => `<button type="button" class="wl-year" data-act="year" data-v="${y}" aria-pressed="false">${y}</button>`).join('')}</div>
        <label class="lt-label" for="wlBody">The memory</label>
        <textarea class="lt-body" id="wlBody" rows="5" maxlength="600" placeholder="First week, that lecture, the trip, the night before exams…"></textarea>
        <p class="lt-note">${sealed('memory')}</p><div class="lt-acts"><button type="button" class="lt-send" data-act="save" data-kind="memory">Add to the Time Machine ⏳</button></div>`,
      tag: () => `<label class="lt-label">Who are they to you?</label>
        <div class="wl-roles" role="group" aria-label="Role">${Object.entries(ROLES).map(([k, [ic, t]]) => `<button type="button" class="wl-role" data-act="role" data-v="${k}" aria-pressed="false"><i aria-hidden="true">${ic}</i>${E(t)}</button>`).join('')}</div>
        <label class="lt-label" for="wlFind">Your classmate</label>
        <div class="lt-picked" id="wlPicked" hidden></div>
        <input type="search" class="lt-find" id="wlFind" placeholder="Search the Class of 2026 by name" autocomplete="off">
        <div class="lt-results" id="wlResults" role="listbox" aria-label="Classmates"></div>
        <label class="lt-label" for="wlBody">A line about them (optional)</label>
        <input class="lt-find" id="wlBody" maxlength="200" placeholder="Carried me through pharmacology">
        <p class="lt-note">They get a notification that someone tagged them, but not who. ${sealed('tag')}</p>
        <div class="lt-acts"><button type="button" class="lt-send" data-act="save" data-kind="tag">Tag them 🫂</button></div>`,
      song: () => `<label class="lt-label" for="wlTitleIn">A song for the class playlist</label>
        <input class="lt-find" id="wlTitleIn" maxlength="120" placeholder="Song – Artist">
        <label class="lt-label" for="wlWhy">Why this one? (optional)</label>
        <input class="lt-find" id="wlWhy" maxlength="200" placeholder="Every class party ended with it">
        <p class="lt-note">${sealed('song')}</p><div class="lt-acts"><button type="button" class="lt-send" data-act="save" data-kind="song">Add the song 🎧</button></div>`,
      joke: () => `<label class="lt-label" for="wlJoke">Only the Class of 2026 understands…</label>
        <textarea class="lt-body" id="wlJoke" rows="3" maxlength="300" placeholder="The 8am in LT3. You know the one."></textarea>
        <p class="lt-note">Keep it kind: no names in jokes about people. ${sealed('joke')}</p>
        <div class="lt-acts"><button type="button" class="lt-send" data-act="save" data-kind="joke">Add the inside joke 😂</button></div>`,
      advice: () => `<label class="lt-label" for="wlBody">Dear fresher…</label>
        <textarea class="lt-body" id="wlBody" rows="4" maxlength="400" placeholder="The one thing you wish someone had told you in first year."></textarea>
        <p class="lt-note">${sealed('advice')}</p><div class="lt-acts"><button type="button" class="lt-send" data-act="save" data-kind="advice">Pass the torch 🔥</button></div>`,
    };
    box.innerHTML = DAYS[d].kinds.map((k, i) => (i ? '<hr class="wl-hr">' : '') + blocks[k]()).join('');
    picked = null;
    if ($('wlFind')) $('wlFind').addEventListener('input', find);
  }
  const chosen = sel => { const b = document.querySelector(sel + '[aria-pressed="true"]'); return b ? b.dataset.v : ''; };

  function find() {
    clearTimeout(findT);
    const q = $('wlFind').value.replace(/[%_*\\"(),]/g, ' ').replace(/\s+/g, ' ').trim();
    if (q.length < 2) { $('wlResults').innerHTML = ''; return; }
    findT = setTimeout(async () => {
      const { data: rows, error } = await supabase.from('profiles_public').select('id,uid,name,course,photo_url')
        .eq('classyear', '2026').eq('isanonymous', false).ilike('name', `%${q}%`).order('name').limit(8);
      if (error) { $('wlResults').innerHTML = '<div class="lt-quiet">Could not search right now.</div>'; return; }
      const list = (rows || []).filter(r => !user || r.uid !== user.uid);
      list.forEach(r => { found[r.id] = r; });
      $('wlResults').innerHTML = list.length ? list.map(r => `<button type="button" class="lt-result" role="option" data-act="pick" data-id="${Number(r.id)}">${face(r.photo_url, r.name)}
          <span><b>${E(r.name)}</b><small>${E(r.course || 'Class of 2026')}</small></span></button>`).join('')
        : `<div class="lt-quiet">Nobody in the Class of 2026 called "${E(q)}".</div>`;
    }, 250);
  }

  // ── yours ──
  function paintMine() {
    const mine = data && data.mine ? data.mine.filter(p => DAYS[d].kinds.includes(p.kind)) : [];
    $('yours').hidden = !mine.length;
    $('wlMine').innerHTML = mine.map(p => `<div class="lt-card wl-mine"><div>
        <small>${p.kind === 'memory' ? Number(p.year) : p.kind === 'tag' ? E(ROLES[p.tag_role][0] + ' ' + ROLES[p.tag_role][1] + ': ' + (p.tagged_name || 'a classmate')) : p.kind === 'song' ? '🎧 ' + E(p.title) : p.kind === 'joke' ? '😂 Inside joke' : '🔥 Advice'}</small>
        ${p.body ? `<p>${para(p.body)}</p>` : ''}<span class="lt-chip">${isOpen(p.kind) ? 'On the wall' : 'Sealed · opens ' + E(opensDay(p.kind).split(',')[0])}</span></div>
      <button type="button" class="lt-report" data-act="delete" data-id="${Number(p.id)}">Delete</button></div>`).join('');
  }

  // ── the wall ──
  async function paintWall() {
    const box = $('wlWall'), kinds = DAYS[d].kinds;
    if (!counts) {
      const r = await supabase.from('grad_posts_count').select('kind,n');
      if (r.error) { box.innerHTML = '<div class="lt-card lt-quiet">The class wall is being switched on. Please check back soon.</div>'; return; }
      counts = {}; (r.data || []).forEach(x => { counts[x.kind] = x.n; }); paintHead();
    }
    const shut = kinds.filter(k => !isOpen(k)), open = kinds.filter(isOpen);
    let html = shut.length ? `<div class="lt-card gu-sealed"><div class="gu-sealed-art" aria-hidden="true"><i>🔒</i></div>
      <div><b>${shut.map(k => n2(counts[k] || 0, k)).join(' and ')} sealed</b><span>It opens on ${E(opensDay(shut[0]))}, in ${daysTo(shut[0])} ${daysTo(shut[0]) === 1 ? 'day' : 'days'}. Add yours above.</span></div></div>` : '';
    if (open.length) {
      const { data: rows, error } = await supabase.from('grad_posts_wall').select('id,kind,year,tag_role,title,body,profile_id,name,photo_url,course,tagged_profile,tagged_name,tagged_photo')
        .in('kind', open).order('created_at', { ascending: true }).limit(1000);
      if (error) html += '<div class="lt-card lt-quiet">The wall could not load. Please try again.</div>';
      else html += open.map(k => render(k, (rows || []).filter(r => r.kind === k))).join('');
    }
    box.innerHTML = html;
  }
  const by = p => `<span class="wl-by">${face(p.photo_url, p.name)}<span><b>${E(p.name)}</b>${p.course ? `<small>${E(p.course)}</small>` : ''}</span>
    ${user ? `<button type="button" class="lt-report" data-act="report" data-id="${Number(p.id)}">Report</button>` : ''}</span>`;
  function render(k, rows) {
    if (!rows.length) return `<div class="lt-card lt-quiet">No ${NOUN[k][1]} yet. Be the first!</div>`;
    if (k === 'memory') return YEARS.map((y, i) => { const list = rows.filter(r => r.year === y); return list.length
      ? `<div class="wl-chapter"><h3><span>Chapter ${i + 1}</span>${y}</h3>${list.map(p => `<article class="lt-card wl-post"><p>${para(p.body)}</p>${by(p)}</article>`).join('')}</div>` : ''; }).join('');
    if (k === 'tag') return Object.entries(ROLES).map(([role, [ic, t]]) => { const list = rows.filter(r => r.tag_role === role); return list.length
      ? `<div class="wl-chapter"><h3><span>${ic}</span>${E(t)}s</h3>${list.map(p => `<article class="lt-card wl-tag">${face(p.photo_url, p.name)}<span class="wl-arrow" aria-hidden="true">→</span>${face(p.tagged_photo, p.tagged_name)}
          <div><b>${E(p.name)}</b> tagged <a href="profile.html?id=${Number(p.tagged_profile)}"><b>${E(p.tagged_name)}</b></a> as their ${E(t.toLowerCase())}${p.body ? `<p>“${E(p.body)}”</p>` : ''}</div></article>`).join('')}</div>` : ''; }).join('');
    if (k === 'song') {
      const songs = new Map();                               // the same song added by several people counts once, with its fans
      rows.forEach(r => { const key = r.title.toLowerCase().replace(/[^a-z0-9]+/g, ''); const s = songs.get(key) || { title: r.title, fans: [], why: [] }; s.fans.push(r.name); if (r.body) s.why.push(r.body); songs.set(key, s); });
      const list = [...songs.values()].sort((a, b) => b.fans.length - a.fans.length);
      return `<div class="wl-chapter"><h3><span>🎧</span>The Class of 2026 playlist</h3><ol class="wl-playlist">${list.map(s => `<li><b>${E(s.title)}</b>
        <small>${s.fans.length > 1 ? `${s.fans.length} classmates picked it` : 'Picked by ' + E(s.fans[0])}${s.why[0] ? ' · “' + E(s.why[0]) + '”' : ''}</small>
        <a class="wl-play" href="https://www.youtube.com/results?search_query=${encodeURIComponent(s.title)}" target="_blank" rel="noopener" aria-label="Find ${E(s.title)} on YouTube">▶</a></li>`).join('')}</ol></div>`;
    }
    if (k === 'joke') return `<div class="wl-chapter"><h3><span>😂</span>Only the Class of 2026 understands</h3><div class="wl-grid">${rows.map(p => `<article class="lt-card wl-post wl-joke"><p>${para(p.body)}</p>${by(p)}</article>`).join('')}</div></div>`;
    return `<div class="wl-grid">${rows.map(p => `<article class="lt-card wl-post wl-advice"><small>Dear fresher,</small><p>${para(p.body)}</p>${by(p)}</article>`).join('')}</div>`;
  }

  // ── loading ──
  async function load(u) {
    const mine = ++run;
    user = u || null; data = null; unavailable = '';
    form(); paintMine();
    if (user) {
      try { data = await window.gApi('wall.mine', {}); counts = data.counts; }
      catch (e) {
        console.warn('[wall.mine]', e);
        unavailable = e.code === 'wall_coming' || e.code === 'unknown_action' || e.unreachable
          ? 'The class wall is being switched on. Please check back soon.' : (e.message || 'Could not load the class wall.');
      }
    }
    if (mine !== run) return;
    paintHead(); form(); paintMine(); paintWall();
  }

  async function save(kind) {
    const v = id => ($(id) ? $(id).value.trim() : '');
    const p = { kind };
    if (kind === 'memory') { p.year = Number(chosen('.wl-year')); p.body = v('wlBody'); if (!p.year) return window.showToast('Choose the year.'); if (!p.body) return window.showToast('Write the memory.'); }
    if (kind === 'tag') { p.role = chosen('.wl-role'); p.profileId = picked && picked.id; p.body = v('wlBody'); if (!p.role) return window.showToast('Choose who they are to you.'); if (!p.profileId) return window.showToast('Choose your classmate.'); }
    if (kind === 'song') { p.title = v('wlTitleIn'); p.body = v('wlWhy'); if (!p.title) return window.showToast('Write the song and who sings it.'); }
    if (kind === 'joke') { p.body = v('wlJoke'); if (!p.body) return window.showToast('Write the inside joke.'); }
    if (kind === 'advice') { p.body = v('wlBody'); if (!p.body) return window.showToast('Write your advice.'); }
    busy = true;
    try {
      const r = await window.gApi('wall.save', p);
      const replaced = kind === 'tag' && data.mine.some(x => x.kind === 'tag' && x.tag_role === p.role);   // a new tag for a role replaces the old one
      data.mine = data.mine.filter(x => !(replaced && x.kind === 'tag' && x.tag_role === p.role)).concat(r.post);
      if (counts && !replaced) counts[kind] = (counts[kind] || 0) + 1;
      window.showToast(isOpen(kind) ? 'Added ✅' : `Sealed ✅ It opens on ${opensDay(kind)}`, 3500);
      form(); paintMine(); paintHead();
      if (isOpen(kind)) paintWall();
    } catch (e) { console.warn('[wall.save]', e); window.showToast(e.message || 'Could not add it.'); }
    busy = false;
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b || busy) return;
    const act = b.dataset.act;
    if (act === 'signin') window.openAuthModal(() => {}, 'login');
    else if (act === 'year' || act === 'role') { b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
    else if (act === 'pick') {
      picked = found[b.dataset.id] || null;
      $('wlPicked').hidden = !picked; $('wlFind').hidden = !!picked; $('wlResults').innerHTML = '';
      if (picked) $('wlPicked').innerHTML = `${face(picked.photo_url, picked.name)}<span><b>${E(picked.name)}</b><small>${E(picked.course || '')}</small></span><button type="button" data-act="unpick" aria-label="Choose someone else">✕</button>`;
    }
    else if (act === 'unpick') { picked = null; $('wlPicked').hidden = true; $('wlFind').hidden = false; $('wlFind').value = ''; $('wlFind').focus(); }
    else if (act === 'save') save(b.dataset.kind);
    else if (act === 'delete') {
      if (!confirm('Delete this?')) return;
      try { await window.gApi('wall.delete', { id: Number(b.dataset.id) }); const p = data.mine.find(x => Number(x.id) === Number(b.dataset.id));
        data.mine = data.mine.filter(x => x !== p); if (counts && p) counts[p.kind] = Math.max(0, (counts[p.kind] || 1) - 1);
        window.showToast('Deleted'); paintMine(); paintHead(); if (p && isOpen(p.kind)) paintWall(); }
      catch (er) { window.showToast(er.message || 'Could not delete it.'); }
    }
    else if (act === 'report') {
      if (!confirm('Ask the admin to look at this?')) return;
      try { await window.gApi('wall.report', { id: Number(b.dataset.id) }); window.showToast('Thanks. The admin will take a look.'); }
      catch (er) { window.showToast(er.message || 'Could not report it.'); }
    }
  });

  paintHead(); form(); paintWall();
  auth.onAuthStateChanged(u => { load(u); });
})();
