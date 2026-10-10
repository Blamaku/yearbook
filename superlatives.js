// =====================================================
//  GLUK YEARBOOK 2026 — CLASS SUPERLATIVES (superlatives.html)
//
//  "Most likely to…" for the Class of 2026: anyone with a yearbook profile votes for one graduate per
//  category, and can change the vote until Sunday 15 November, 00:00 in Kisumu. Votes stay secret until
//  then; then each category shows its top 3 (no vote counts). The api does the counting (sup.*).
// =====================================================
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => window.escHtml(s);
  const CLASS = '2026';
  let board = null, mine = null, user = null, busy = false;

  const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const face = (p, cls = '') => {
    const photo = window.safeUrl(p.photo_url || (Array.isArray(p.photos) && p.photos[0]) || '');
    return photo ? `<span class="sp-face ${cls}" style="background-image:url('${esc(photo).replace(/'/g, '%27')}')" aria-hidden="true"></span>`
      : `<span class="sp-face ini ${cls}" aria-hidden="true">${esc(initials(p.name))}</span>`;
  };
  const nfmt = n => Number(n || 0).toLocaleString('en');
  const coming = e => !!e && (e.code === 'sup_coming' || e.code === 'unknown_action' || e.unreachable);

  async function loadBoard() {
    try { board = await window.gApiPublic('sup.board'); }
    catch (e) { console.warn('[superlatives]', e); board = { error: e }; }
    paint();
  }
  async function loadMine() {
    mine = null;
    if (user) {
      paint();
      try { mine = await window.gApi('sup.mine'); }
      catch (e) { console.warn('[superlatives mine]', e); mine = { error: e }; }
    }
    paint();
  }

  /* ── The page ──────────────────────────────────── */
  function statusHTML() {
    if (!board) return '<div class="sp-quiet">Loading…</div>';
    if (board.error) return `<div class="sp-quiet">${coming(board.error) ? 'The class superlatives are being switched on. Check back soon!' : 'Could not load the superlatives. Check your connection and try again.'}</div>`;
    const cats = board.categories || [];
    if (!board.open) return `<div class="sp-status won"><b>The Class of 2026 has spoken! 🎉</b><span>${nfmt(board.votes)} votes. Here are the winners.</span></div>`;
    if (!user) return `<div class="sp-status"><span>Anyone with a yearbook profile can vote. Votes stay secret until Sunday 15 November.</span><button type="button" class="sp-btn" data-act="signin">Sign in to vote</button></div>`;
    if (!mine) return '<div class="sp-quiet">Loading your votes…</div>';
    if (mine.error) return `<div class="sp-quiet">${coming(mine.error) ? 'Voting is being switched on. Check back soon!' : 'Could not load your votes. Check your connection.'}</div>`;
    if (!mine.canVote) return `<div class="sp-status"><span>Create your yearbook profile to vote for your classmates.</span><button type="button" class="sp-btn" data-act="create">Create my profile</button></div>`;
    const n = cats.filter(c => mine.votes && mine.votes[c.id]).length;
    return `<div class="sp-status"><span>You have voted in <b>${n} of ${cats.length}</b> categories. You can change a vote until Sunday 15 November; nobody sees votes before then.</span>
      <span class="sp-bar"><i style="width:${cats.length ? Math.round(n / cats.length * 100) : 0}%"></i></span></div>`;
  }

  function cardHTML(c) {
    if (!board.open) {
      const top = (board.results && board.results[c.id]) || [];
      const [w, ...rest] = top;
      return `<article class="sp-card won"><span class="sp-emoji" aria-hidden="true">${esc(c.emoji)}</span><h3>${esc(c.title)}</h3>
        ${w ? `<a class="sp-winner" href="profile.html?id=${Number(w.profile_id)}">${face(w, 'lg')}<span><small>🥇 Winner</small><b>${esc(w.name)}</b>${w.course ? `<em>${esc(w.course)}</em>` : ''}</span></a>
          ${rest.length ? `<div class="sp-runners">${rest.map((r, i) => `<a href="profile.html?id=${Number(r.profile_id)}">${['🥈', '🥉'][i]} ${face(r, 'sm')}<span>${esc(r.name)}</span></a>`).join('')}</div>` : ''}`
          : '<p class="sp-none">No votes in this category.</p>'}
      </article>`;
    }
    const v = mine && mine.votes && mine.votes[c.id];
    return `<article class="sp-card${v ? ' voted' : ''}"><span class="sp-emoji" aria-hidden="true">${esc(c.emoji)}</span><h3>${esc(c.title)}</h3>
      ${v ? `<div class="sp-pick">${face(v)}<span><small>Your vote</small><b>${esc(v.name)}</b></span><button type="button" class="sp-change" data-act="pick" data-cat="${Number(c.id)}">Change</button></div>`
        : `<button type="button" class="sp-choose" data-act="pick" data-cat="${Number(c.id)}">＋ Choose a classmate</button>`}
    </article>`;
  }

  function paint() {
    $('spStatus').innerHTML = statusHTML();
    const ok = board && !board.error;
    $('spVotes').textContent = ok ? (board.open ? `${nfmt(board.votes)} ${board.votes === 1 ? 'vote' : 'votes'} so far` : 'The winners are out!') : '';
    $('spGrid').innerHTML = ok ? (board.categories || []).map(cardHTML).join('') : '';
    $('spHint').hidden = !(ok && board.open);
    if (ok && !board.open) $('spPlace').textContent = 'Chosen by the Class of 2026. Congratulations to the winners!';
  }

  /* ── Voting in one category (a sheet the phone's back button closes) ── */
  let sheetCat = null, openedHere = false, findT = 0, findRun = 0;
  const catOf = id => ((board && board.categories) || []).find(c => c.id === id);
  function openSheet(id) {
    if (!user) { window.openAuthModal(() => {}, 'login'); return; }
    if (!mine || mine.error) return;
    if (!mine.canVote) { window.openProfileChooser ? window.openProfileChooser() : window.goToMyProfile(); return; }
    openedHere = true; location.hash = 'vote-' + id;
  }
  function closeSheet() {
    if (openedHere) { openedHere = false; history.back(); return; }
    history.replaceState(null, '', location.pathname + location.search); route();
  }
  function route() {
    const m = /^#vote-(\d+)$/.exec(location.hash), c = m && board && board.open && mine && mine.canVote ? catOf(Number(m[1])) : null;
    sheetCat = c || null;
    $('spOv').hidden = !c;
    document.documentElement.style.overflow = c ? 'hidden' : '';
    if (!c) { openedHere = false; return; }
    const v = mine.votes && mine.votes[c.id];
    $('spShTitle').innerHTML = `<span aria-hidden="true">${esc(c.emoji)}</span> ${esc(c.title)}`;
    $('spShNow').innerHTML = v ? `<div class="sp-pick">${face(v)}<span><small>Your vote</small><b>${esc(v.name)}</b></span><button type="button" class="sp-change danger" data-act="unvote">Remove</button></div>` : '';
    $('spFind').value = ''; $('spResults').innerHTML = '<div class="sp-quiet">Type at least 2 letters of a classmate’s name.</div>';
    setTimeout(() => $('spFind').focus(), 60);
  }
  // Class of 2026 graduates by name (not anonymous, not you)
  function find() {
    clearTimeout(findT);
    const q = $('spFind').value.replace(/[%_*\\"(),]/g, ' ').replace(/\s+/g, ' ').trim();
    if (q.length < 2) { $('spResults').innerHTML = '<div class="sp-quiet">Type at least 2 letters of a classmate’s name.</div>'; return; }
    findT = setTimeout(async () => {
      const run = ++findRun;
      const { data: rows, error } = await supabase.from('profiles_public').select('id,uid,name,course,dept,photo_url,photos')
        .eq('classyear', CLASS).eq('isanonymous', false).ilike('name', `%${q}%`).order('name').limit(8);
      if (run !== findRun) return;
      if (error) { $('spResults').innerHTML = '<div class="sp-quiet">Could not search right now.</div>'; return; }
      const list = (rows || []).filter(r => !user || r.uid !== user.uid);
      $('spResults').innerHTML = list.length
        ? list.map(r => `<button type="button" class="sp-result" data-act="vote" data-id="${Number(r.id)}">${face(r)}
            <span><b>${esc(r.name)}</b><small>${esc(r.course || r.dept || 'Class of 2026')}</small></span></button>`).join('')
        : `<div class="sp-quiet">No graduate called "${esc(q)}" in the Class of 2026.</div>`;
    }, 250);
  }
  async function vote(profileId) {
    if (busy || !sheetCat) return;
    busy = true;
    const cat = sheetCat.id, isNew = !(mine.votes && mine.votes[cat]);
    try {
      const r = await window.gApi('sup.vote', { category: cat, profileId });
      mine.votes = { ...(mine.votes || {}), [cat]: r.vote };
      if (isNew) board.votes = (board.votes || 0) + 1;    // a changed vote is still one vote
      closeSheet(); paint();
      window.showToast(`Voted for ${r.vote.name} ✓ You can change it until 15 November.`, 3500);
    } catch (e) { window.showToast(e.message || 'Could not save your vote.', 4000); }
    finally { busy = false; }
  }
  async function unvote() {
    if (busy || !sheetCat) return;
    busy = true;
    const cat = sheetCat.id;
    try {
      await window.gApi('sup.unvote', { category: cat });
      const v = { ...(mine.votes || {}) }; delete v[cat]; mine.votes = v;
      closeSheet(); paint(); window.showToast('Vote removed.');
    } catch (e) { window.showToast(e.message || 'Could not remove your vote.', 4000); }
    finally { busy = false; }
  }

  /* ── Wiring ────────────────────────────────────── */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'signin') window.openAuthModal(() => {}, 'login');
    else if (a === 'create') { window.openProfileChooser ? window.openProfileChooser() : window.goToMyProfile(); }
    else if (a === 'pick') openSheet(Number(b.dataset.cat));
    else if (a === 'vote') vote(Number(b.dataset.id));
    else if (a === 'unvote') unvote();
    else if (a === 'close') closeSheet();
  });
  $('spOv').addEventListener('click', e => { if (e.target === $('spOv')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('spOv').hidden) closeSheet(); });
  $('spFind').addEventListener('input', find);
  window.addEventListener('hashchange', route);
  loadBoard().then(route);
  auth.onAuthStateChanged(u => { user = u; loadMine().then(route); });
})();
