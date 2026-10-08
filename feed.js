// =====================================================
//  GLUK YEARBOOK 2026 — STUDENTS FEED  (feed.html)
//
//  One student per screen. Swipe up for the next one, sideways for their
//  other photos. Double-tap a photo (or tap the heart) to like; the speech
//  bubble opens their comments; the round photo opens their full profile.
//
//  • Only profiles with a photo appear, and never anonymous ones.
//  • Order: profiles added in the last two days first, then everyone else
//    shuffled. The order and position are kept for this visit, so coming
//    back from a profile carries on where you were.
//  • Students load 8 at a time, a few screens before you reach them.
//  • feed.html?id=123 starts with that student.
//  • Before the profile_likes table exists the heart says "coming soon"
//    and everything else works.
// =====================================================
(function () {
  'use strict';
  const BATCH = 8;                         // students fetched at a time
  const FRESH_MS = 2 * 86400000;           // profiles newer than this go to the top
  const KEEP_MS = 30 * 60000;              // a saved place older than this starts a new shuffle
  const SAVE_KEY = 'gluk-feed';
  const COLS = 'id,uid,name,dept,course,classyear,county,photos,photo_url,mostlikelyto,bio,created_at';

  const feed = document.getElementById('feed');
  const sheet = document.getElementById('fdSheet');
  if (!feed || !sheet) return;

  let order = [], shown = 0, busy = false, current = 0, likesOn = true, observer = null;
  const people = new Map();                // id -> profile
  const likes = new Map();                 // id -> { n, mine }
  const talk = new Map();                  // id -> number of comments
  const seq = new Map();                   // id -> number of the latest like request (older answers are ignored)

  // ── small helpers ──
  const fmt = n => n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
  const profileLink = s => `profile.html?id=${s.id}&dept=${encodeURIComponent(s.dept || '')}&course=${encodeURIComponent(s.course || '')}`;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const me = () => (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : null;
  const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
    talk:  '<path d="M20.5 11.6c0 4.4-3.8 7.9-8.5 7.9-1.2 0-2.4-.2-3.4-.6L3.5 20.5l1.4-4.1a7.5 7.5 0 0 1-1.4-4.8c0-4.4 3.8-7.9 8.5-7.9s8.5 3.5 8.5 7.9z"/>',
    share: '<path d="M14 4.5 21 11l-7 6.5V14c-5 0-8.5 1.6-11 5.5 1-5.3 4-9.7 11-10.5z"/>',
  };

  // ── remembering the order and place for this visit ──
  function save() {
    try { sessionStorage.setItem(SAVE_KEY, JSON.stringify({ order, current, at: Date.now() })); } catch (e) { /* private mode: start fresh next time */ }
  }
  function restore() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null');
      if (s && Array.isArray(s.order) && s.order.length && Date.now() - s.at < KEEP_MS) return s;
    } catch (e) { /* nothing saved */ }
    return null;
  }

  // ── the cards that aren't students ──
  const note = (icon, title, text, buttons, cls) => `<section class="fd-slide fd-note${cls ? ' ' + cls : ''}"><div class="fd-note-in">
      <div class="fd-note-ic" aria-hidden="true">${icon}</div><h2>${title}</h2><p>${text}</p><div class="fd-note-btns">${buttons || ''}</div></div></section>`;
  const loading = () => '<section class="fd-slide fd-note"><div class="fd-spin" role="status" aria-label="Loading students"></div></section>';
  const ending = () => note('🎉', "You're all caught up", 'You have seen every student with a photo. Start again in a new order, or browse the full list.',
    '<button type="button" class="fd-btn" data-act="again">Start again</button><a class="fd-btn fd-btn-ghost" href="profiles.html">Browse all students</a>', 'fd-end');

  // ── one student ──
  function slideHTML(s, i) {
    const photos = normalizePhotos(s.photos, s.photo_url).slice(0, 4).map(u => window.safeUrl(u)).filter(Boolean);
    if (!photos.length) return '';
    const id = Number(s.id), name = esc(s.name || 'GLUK student'), link = esc(profileLink(s));
    const lv = s.classYear ? window.classLevelInfo(s.classYear) : { badge: '' };
    const meta = [esc(s.course || s.dept || ''), s.classYear ? 'Class of ' + esc(s.classYear) : ''].filter(Boolean).join(' · ');
    const cap = s.mostLikelyTo ? `<b>Most likely to:</b> ${esc(s.mostLikelyTo)}` : esc(String(s.bio || '').slice(0, 240));
    const ph = photos.map((u, k) => `<div class="fd-ph"><img class="fd-bg" data-src="${esc(u)}" alt="" aria-hidden="true"><img class="fd-img" src="${esc(u)}" alt="${k ? '' : name}" ${i < 2 && !k ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`).join('');
    return `<section class="fd-slide" data-i="${i}" data-id="${id}" aria-label="${name}">
      <div class="fd-stage">
        <div class="fd-card">
          <div class="fd-photos">${ph}</div>
          ${photos.length > 1 ? `<div class="fd-dots" aria-hidden="true">${photos.map((_, k) => `<i${k ? '' : ' class="on"'}></i>`).join('')}</div>` : ''}
          <div class="fd-shade"></div>
          <div class="fd-info">
            ${lv.badge ? `<span class="fd-chip">${lv.icon} ${esc(lv.badge)}</span>` : ''}
            <a class="fd-name" href="${link}">${name}</a>
            ${meta ? `<div class="fd-meta">${meta}</div>` : ''}
            ${s.county ? `<div class="fd-meta">📍 ${esc(s.county)}</div>` : ''}
            ${cap ? `<p class="fd-cap">${cap}</p>` : ''}
          </div>
        </div>
        <div class="fd-rail">
          <a class="fd-av" href="${link}" aria-label="Open ${name}'s profile"><img src="${esc(photos[0])}" alt="" loading="lazy" decoding="async"></a>
          <button type="button" class="fd-act fd-like" data-act="like" aria-pressed="false" aria-label="Like">${svg(ICON.heart)}<span class="fd-n"></span></button>
          <button type="button" class="fd-act" data-act="comments" aria-label="Comments">${svg(ICON.talk)}<span class="fd-n"></span></button>
          <button type="button" class="fd-act" data-act="share" aria-label="Share">${svg(ICON.share)}<span class="fd-n">Share</span></button>
        </div>
      </div>
    </section>`;
  }

  function paintRail(id) {
    const slide = feed.querySelector(`.fd-slide[data-id="${Number(id)}"]`); if (!slide) return;
    const L = likes.get(id) || { n: 0, mine: false };
    const lb = slide.querySelector('.fd-like');
    lb.setAttribute('aria-pressed', String(!!L.mine));
    lb.setAttribute('aria-label', L.mine ? 'Unlike' : 'Like');
    lb.querySelector('.fd-n').textContent = likesOn ? fmt(L.n) : 'Like';
    slide.querySelector('[data-act="comments"] .fd-n').textContent = fmt(talk.get(id) || 0);
  }

  // ── loading ──
  // Every student with a photo, as ids only (cheap even for thousands), then shuffled
  async function fetchOrder() {
    const rows = [];
    for (let from = 0; from < 10000; from += 1000) {
      const { data, error } = await supabase.from('profiles_public').select('id,created_at')
        .eq('isanonymous', false).not('photo_url', 'is', null).neq('photo_url', '')
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const now = Date.now(), isNew = r => now - (Date.parse(r.created_at || '') || 0) < FRESH_MS;
    return [...rows.filter(isNew).map(r => Number(r.id)), ...shuffle(rows.filter(r => !isNew(r)).map(r => Number(r.id)))];
  }

  // Comments per student. Before the likes file has been run there is no counts view: count the comments themselves
  async function commentCounts(ids) {
    const out = new Map(ids.map(id => [id, 0]));
    let r = await supabase.from('profile_comment_counts').select('profile_id,comments').in('profile_id', ids);
    if (!r.error) { for (const x of r.data || []) out.set(Number(x.profile_id), Number(x.comments) || 0); return out; }
    r = await supabase.from('comments').select('profile_id').in('profile_id', ids).limit(5000);
    if (!r.error) for (const x of r.data || []) out.set(Number(x.profile_id), (out.get(Number(x.profile_id)) || 0) + 1);
    return out;
  }

  // Which of these students the signed-in person has liked
  async function refreshMine(ids) {
    for (const id of ids) { const L = likes.get(id); if (L) L.mine = false; }
    const uid = me();
    if (uid && likesOn) {
      for (let k = 0; k < ids.length; k += 200) {
        const { data, error } = await supabase.from('profile_likes').select('profile_id').eq('uid', uid).in('profile_id', ids.slice(k, k + 200));
        if (error) break;
        for (const r of data || []) { const L = likes.get(Number(r.profile_id)); if (L) L.mine = true; }
      }
    }
    ids.forEach(paintRail);
  }

  async function loadMore() {
    if (busy || shown >= order.length) return false;
    busy = true;
    const ids = order.slice(shown, shown + BATCH), uid = me();
    try {
      const [p, lc, cc, mine] = await Promise.all([
        supabase.from('profiles_public').select(COLS).in('id', ids),
        supabase.from('profile_like_counts').select('profile_id,likes').in('profile_id', ids),
        commentCounts(ids),
        uid ? supabase.from('profile_likes').select('profile_id').eq('uid', uid).in('profile_id', ids) : Promise.resolve({ data: [] }),
      ]);
      if (p.error) throw p.error;
      if (lc.error) likesOn = false;                                          // the likes table isn't there yet
      for (const r of p.data || []) people.set(Number(r.id), normalizeProfile(r));
      for (const id of ids) likes.set(id, { n: 0, mine: false });
      for (const r of lc.data || []) { const L = likes.get(Number(r.profile_id)); if (L) L.n = Number(r.likes) || 0; }
      for (const r of (mine && !mine.error && mine.data) || []) { const L = likes.get(Number(r.profile_id)); if (L) L.mine = true; }
      for (const [id, n] of cc) talk.set(id, n);

      feed.querySelectorAll('.fd-end,.fd-retry').forEach(el => el.remove());
      feed.insertAdjacentHTML('beforeend', ids.map((id, k) => people.has(id) ? slideHTML(people.get(id), shown + k) : '').join(''));
      shown += ids.length;
      ids.forEach(paintRail);
      if (shown >= order.length) feed.insertAdjacentHTML('beforeend', ending());
      watch();
      if (me() !== uid) refreshMine([...likes.keys()]);                      // signed in or out while this batch loaded
      return true;
    } catch (e) {
      console.error('[feed] could not load students', e);
      feed.querySelectorAll('.fd-retry').forEach(el => el.remove());
      feed.insertAdjacentHTML('beforeend', note('⚠️', 'Could not load more students', 'Check your connection and try again.',
        '<button type="button" class="fd-btn" data-act="more">Try again</button>', 'fd-retry'));
      return false;
    } finally { busy = false; }
  }

  // The slide in view decides what to load next and is the place remembered
  function watch() {
    if (!observer && 'IntersectionObserver' in window) observer = new IntersectionObserver(es => {
      for (const e of es) if (e.isIntersecting) {
        current = Number(e.target.dataset.i) || 0;
        save();
        if (shown - current <= 4) loadMore();
      }
    }, { root: feed, threshold: 0.6 });
    if (observer) feed.querySelectorAll('.fd-slide[data-id]:not([data-seen])').forEach(el => { el.dataset.seen = '1'; observer.observe(el); });
  }

  async function start(fresh) {
    shown = 0; current = 0; people.clear(); likes.clear(); talk.clear();
    const want = Number(new URLSearchParams(location.search).get('id')) || 0;
    const kept = !fresh && !want && restore();
    feed.innerHTML = loading();
    try { order = kept ? kept.order.map(Number) : await fetchOrder(); }
    catch (e) {
      console.error('[feed]', e);
      feed.innerHTML = note('⚠️', 'Could not load students', 'Check your connection and try again.', '<button type="button" class="fd-btn" data-act="retry">Try again</button>');
      return;
    }
    if (want) order = [want, ...order.filter(id => id !== want)];
    if (!order.length) {
      feed.innerHTML = note('🎓', 'No photos yet', 'Add your profile with a photo and you will be the first one here.', '<a class="fd-btn" href="profiles.html?action=add">Add your profile</a>');
      return;
    }
    feed.innerHTML = '';
    const target = kept ? Math.min(Number(kept.current) || 0, order.length - 1) : 0;
    while (shown <= target + 1 && shown < order.length) if (!await loadMore()) break;
    if (target) {
      const el = [...feed.querySelectorAll('.fd-slide[data-id]')].find(x => Number(x.dataset.i) >= target);
      if (el) { feed.scrollTop = el.offsetTop; current = Number(el.dataset.i); }
    }
    save();
  }

  // ── liking ──
  function pop(id) {
    const b = feed.querySelector(`.fd-slide[data-id="${Number(id)}"] .fd-like`); if (!b) return;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }
  function likesSoon() { likesOn = false; showToast('❤️ Likes are switching on soon'); [...likes.keys()].forEach(paintRail); }

  async function setLike(id, like) {
    if (!id) return;
    if (!me()) { requireAuth(() => setLike(id, like), 'login'); return; }
    if (!likesOn) { likesSoon(); return; }
    const L = likes.get(id) || { n: 0, mine: false };
    if (L.mine === like) { if (like) pop(id); return; }
    const before = { ...L }, n = (seq.get(id) || 0) + 1;
    seq.set(id, n);
    likes.set(id, { n: Math.max(0, L.n + (like ? 1 : -1)), mine: like });   // show it at once; the server's answer corrects the number
    paintRail(id); if (like) pop(id);
    try {
      const r = await window.gApi('profile.like', { profileId: id, like });
      if (seq.get(id) === n) likes.set(id, { n: Number(r.likes) || 0, mine: r.liked === true });
    } catch (e) {
      if (seq.get(id) === n) likes.set(id, before);
      if (e && (e.code === 'likes_coming' || e.code === 'unknown_action')) likesSoon();
      else showToast('❌ ' + (e && e.code === 'not_found' ? e.message : 'Could not save your like. Please try again.'), 3500);
    }
    paintRail(id);
  }

  // The big heart where a photo was double-tapped
  function burst(slide, e) {
    const card = slide.querySelector('.fd-card'), r = card.getBoundingClientRect();
    const h = document.createElement('div');
    h.className = 'fd-burst'; h.innerHTML = svg(ICON.heart);
    h.style.left = ((e.clientX || r.left + r.width / 2) - r.left) + 'px';
    h.style.top = ((e.clientY || r.top + r.height / 2) - r.top) + 'px';
    h.style.setProperty('--r', Math.round(Math.random() * 30 - 15) + 'deg');
    card.appendChild(h);
    h.addEventListener('animationend', () => h.remove());
  }

  function share(id) {
    const s = people.get(id); if (!s) return;
    const url = new URL(profileLink(s), location.href).href;
    if (navigator.share) navigator.share({ title: `${s.name} — GLUK Yearbook 2026`, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => showToast('Link copied! 🔗')).catch(() => showToast('Could not copy the link'));
  }

  // ── comments sheet (the comment code itself lives in app.js) ──
  function openSheet(id) {
    if (!id || !sheet.hidden) return;
    sheet.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    window.startComments(id);
    history.pushState({ fdSheet: 1 }, '');                                  // the phone's back button closes the sheet
    const x = sheet.querySelector('[data-close]'); if (x) x.focus({ preventScroll: true });
  }
  function closeSheet(fromHistory) {
    if (sheet.hidden) return;
    sheet.hidden = true;
    document.documentElement.style.overflow = '';
    window.stopComments();
    if (!fromHistory && history.state && history.state.fdSheet) history.back();
    const b = feed.querySelector(`.fd-slide[data-i="${current}"] [data-act="comments"]`); if (b) b.focus({ preventScroll: true });
  }
  sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('[data-close]')) closeSheet(false); });
  window.addEventListener('popstate', () => closeSheet(true));
  document.addEventListener('gluk:comments', e => {
    const id = Number(e.detail && e.detail.profileId);
    if (id && talk.has(id)) { talk.set(id, Number(e.detail.count) || 0); paintRail(id); }
  });

  // ── taps ──
  let lastTap = { t: 0, id: 0 };
  feed.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (btn) {
      const act = btn.dataset.act, slide = btn.closest('.fd-slide'), id = slide ? Number(slide.dataset.id) : 0;
      if (act === 'like') setLike(id, !(likes.get(id) || {}).mine);
      else if (act === 'comments') openSheet(id);
      else if (act === 'share') share(id);
      else if (act === 'retry') start(true);
      else if (act === 'more') { slide.remove(); loadMore(); }
      else if (act === 'again') { try { sessionStorage.removeItem(SAVE_KEY); } catch (_) {} history.replaceState(null, '', 'feed.html'); feed.scrollTop = 0; start(true); }
      return;
    }
    const cap = e.target.closest('.fd-cap');
    if (cap) { cap.classList.toggle('open'); return; }
    const photo = e.target.closest('.fd-photos');
    if (!photo) return;
    const slide = photo.closest('.fd-slide'), id = Number(slide.dataset.id), now = Date.now();
    if (now - lastTap.t < 320 && lastTap.id === id) { lastTap = { t: 0, id: 0 }; burst(slide, e); setLike(id, true); }
    else lastTap = { t: now, id };
  });

  // Landscape and square photos are shown whole on a blurred copy of themselves instead of being cropped
  feed.addEventListener('load', e => {
    const img = e.target;
    if (!img.classList || !img.classList.contains('fd-img') || !img.naturalWidth) return;
    if (img.naturalHeight / img.naturalWidth < 1.15) {
      const bg = img.parentElement.querySelector('.fd-bg');
      if (bg && bg.dataset.src) { bg.src = bg.dataset.src; delete bg.dataset.src; }
      img.parentElement.classList.add('fit');
    }
  }, true);

  // The dots under a student's photos follow the sideways swipe
  feed.addEventListener('scroll', e => {
    const box = e.target;
    if (!box.classList || !box.classList.contains('fd-photos')) return;
    const k = Math.round(box.scrollLeft / Math.max(1, box.clientWidth));
    box.parentElement.querySelectorAll('.fd-dots i').forEach((d, j) => d.classList.toggle('on', j === k));
  }, true);

  // ── keyboard (laptops): ↑ ↓ next/previous student, ← → their photos, L like, Esc close ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSheet(false); return; }
    const t = e.target;
    if (!sheet.hidden || e.altKey || e.ctrlKey || e.metaKey || (t && t.closest && t.closest('input,textarea,select,[contenteditable]'))) return;
    const slide = feed.querySelector(`.fd-slide[data-i="${current}"]`);
    if (['ArrowDown', 'PageDown', 'j'].includes(e.key)) { e.preventDefault(); feed.scrollBy({ top: feed.clientHeight, behavior: 'smooth' }); }
    else if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); feed.scrollBy({ top: -feed.clientHeight, behavior: 'smooth' }); }
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && slide) {
      const box = slide.querySelector('.fd-photos');
      if (box) { e.preventDefault(); box.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * box.clientWidth, behavior: 'smooth' }); }
    } else if (e.key === 'l' && slide) { const id = Number(slide.dataset.id); setLike(id, !(likes.get(id) || {}).mine); }
  });

  // Signing in or out changes which hearts are filled
  if (typeof auth !== 'undefined') auth.onAuthStateChanged(() => { if (likes.size) refreshMine([...likes.keys()]); });

  start(false);
})();
