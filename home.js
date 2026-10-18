// =====================================================
//  GLUK YEARBOOK 2026 — HOME  (index.html)
//
//  The crest, hello + countdown, shortcuts, one card that says what to do
//  next (create your profile as a student or staff / finish it / share it),
//  your class, who just joined, lecturers & staff, the latest messages
//  people wrote, About GLUK and the schools.
//
//  • Everything shown is public (profiles_public, staff_public, comments). A section
//    whose data can't load stays hidden instead of showing an error.
//  • Photos in the strips open the Students feed at that person.
// =====================================================
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!$('hmNew')) return;

  const STRIP = 12;                        // people per strip
  const COLS = 'id,name,dept,course,classyear,photo_url,photos';
  const MINE = 'id,name,dept,course,classyear,isanonymous,photo_url,photos,bio,hobbies,clubs,bestmemory,biggestlesson,mostlikelyto,county,country,has_birthday';

  // ── small helpers ──
  const first = n => String(n || '').trim().split(/\s+/)[0] || '';
  const initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const photoOf = s => window.safeUrl(normalizePhotos(s.photos, s.photo_url)[0] || '');
  const profileLink = s => `profile.html?id=${s.id}&dept=${encodeURIComponent(s.dept || '')}&course=${encodeURIComponent(s.course || '')}`;
  const feedLink = s => `feed.html?id=${s.id}`;
  const withPhoto = q => q.eq('isanonymous', false).not('photo_url', 'is', null).neq('photo_url', '');
  const show = (id, on) => { const el = $(id); if (el) el.hidden = !on; };

  // ── hello ──
  function greet(name, sub) {
    const h = new Date().getHours(), hi = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    $('hmHello').textContent = name ? `${hi}, ${name}` : `${hi}, welcome!`;
    $('hmSub').textContent = sub || '';
    show('hmSub', !!sub);
  }

  // ── the "what next" card ──
  // What a complete profile has, in the order we ask for it (anonymous profiles have no photo or county to add)
  const STEPS = [
    ['add a photo',                       s => !!photoOf(s), true],
    ['write a short bio',                 s => !!s.bio],
    ['add your best memory',              s => !!s.bestmemory],
    ['say what you are most likely to do', s => !!s.mostlikelyto],
    ['add your biggest lesson',           s => !!s.biggestlesson],
    ['list your hobbies',                 s => !!s.hobbies],
    ['add your clubs',                    s => window.parseClubField(s.clubs).length > 0],
    ['add your birthday',                 s => !!s.has_birthday],
    ['add where you are from',            s => !!s.county || (!!s.country && s.country !== 'Kenya'), true],   // a county, or a home country outside Kenya
  ];
  function act(cls, title, text, button, bar) {
    const el = $('hmAct');
    el.className = 'hm-act' + (cls ? ' ' + cls : '');
    el.innerHTML = `<div class="hm-act-t"><b>${title}</b><span>${text}</span>${bar == null ? '' :
      `<div class="hm-bar" role="progressbar" aria-label="Profile complete" aria-valuenow="${bar}" aria-valuemin="0" aria-valuemax="100"><i style="width:${bar}%"></i></div>`}</div>${button}`;
  }
  const CREATE = '<button type="button" class="hm-btn" data-act="create">Create</button>';   // asks: student or staff?
  function paintAct(user, me, staff) {
    if (!user) return act('is-new', 'Create your yearbook profile', 'For students, alumni, lecturers and staff.', CREATE);
    if (staff) return staff.status === 'approved'
      ? act('', 'Your staff profile is live 🎓', 'Students can see it on the yearbook.', '<a class="hm-btn" href="staff.html">Open</a>')
      : act('', 'Your staff profile is waiting for approval', 'The admin will check it soon.', '<a class="hm-btn" href="staff.html">Open</a>');
    if (!me) return act('is-new', "You don't have a profile yet", 'Add yours so classmates can find and sign it.', CREATE);
    const steps = STEPS.filter(([, , needsPublic]) => !(needsPublic && me.isanonymous));
    const done = steps.filter(([, test]) => test(me)).length;
    const pct = Math.round(done / steps.length * 100);
    const next = steps.find(([, test]) => !test(me));
    if (next) return act('', `Your profile is ${pct}% done`, `Next: ${next[0]}.`,
      `<a class="hm-btn" href="${esc(profileLink(me))}#edit">Finish</a>`, pct);
    act('', 'Your yearbook page is ready 🎉', 'Share it so classmates can sign it.',
      '<button type="button" class="hm-btn" id="hmShare">Share</button>');
    $('hmShare').onclick = () => share(me);
  }
  $('hmAct').addEventListener('click', e => { if (e.target.closest('[data-act="create"]')) window.openProfileChooser(); });
  async function share(me) {
    const url = new URL(profileLink(me), location.href).href;
    try {
      if (navigator.share) { await navigator.share({ title: 'Sign my GLUK yearbook', url }); return; }
      await navigator.clipboard.writeText(url);
      showToast('Link copied! 🔗');
    } catch (e) { /* closed the share sheet */ }
  }

  // ── strips of people ──
  const face = s => {
    const u = photoOf(s);
    return `<a class="hm-face" href="${esc(feedLink(s))}">
      <span class="hm-av">${u ? `<img src="${esc(thumbUrl(u, 160))}" alt="" loading="lazy" decoding="async">` : esc(initials(s.name))}</span>
      <span class="hm-face-n">${esc(first(s.name))}</span></a>`;
  };
  const tile = s => `<a class="hm-tile" href="${esc(feedLink(s))}">
      <img src="${esc(thumbUrl(photoOf(s), 240))}" alt="" loading="lazy" decoding="async">
      <span class="hm-tile-b"><span class="hm-tile-n">${esc(s.name)}</span><span class="hm-tile-c">${esc(s.course || s.dept || '')}</span></span></a>`;

  async function loadNew() {
    const { data, error } = await withPhoto(supabase.from('profiles_public').select(COLS))
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(STRIP);
    const rows = (data || []).filter(photoOf);
    if (error || !rows.length) return show('hmNewSec', false);
    $('hmNew').innerHTML = rows.map(tile).join('');
  }

  async function loadClass(me) {
    if (!me || !me.course || !me.classyear) return show('hmClassSec', false);
    const { data, error } = await withPhoto(supabase.from('profiles_public').select(COLS))
      .eq('course', me.course).eq('classyear', me.classyear).neq('id', me.id)
      .order('created_at', { ascending: false }).limit(STRIP);
    const rows = (data || []).filter(photoOf);
    if (error || !rows.length) return show('hmClassSec', false);
    $('hmClassAll').href = `profiles.html?dept=${encodeURIComponent(me.dept || '')}&course=${encodeURIComponent(me.course)}&class=${encodeURIComponent(me.classyear)}`;
    $('hmClass').innerHTML = rows.map(face).join('');
    show('hmClassSec', true);
  }

  // ── Faces of 2026 (graduation week, 15–21 Nov): "GLUK Yearbook congratulates …" ──
  // Everyone gets the same fixed order, split into 7 days, so every graduate with a photo has a day in the
  // spotlight; Home turns through today's group, starting at a random face. ?faces=1 shows it before the week.
  const seeded = (a, seed) => { let x = seed >>> 0; const r = () => { x = (x + 0x6D2B79F5) >>> 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  async function loadFaces() {
    const G = window.GLUK_GRADWEEK, t = G ? G.today() : -1;
    if (!/[?&]faces=1/.test(location.search) && (t < 0 || t > 6)) return;
    const { data, error } = await withPhoto(supabase.from('profiles_public').select(COLS)).eq('classyear', '2026').order('id').limit(1000);
    const all = seeded((data || []).filter(photoOf), 2026);
    if (error || !all.length) return;
    const per = Math.ceil(all.length / 7), day = Math.max(0, t);
    const list = all.slice(day * per, day * per + per).length ? all.slice(day * per, day * per + per) : all;
    let i = Math.floor(Math.random() * list.length), timer = null, rest = 0;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function paint() {
      const p = list[i];
      $('hmFaces').innerHTML = `<a class="hm-face-big" href="${esc(profileLink(p))}"><img src="${esc(thumbUrl(photoOf(p), 640))}" alt="" loading="lazy">
        <span class="hm-face-t"><small>GLUK Yearbook congratulates</small><b>${esc(p.name)}</b><span>${esc(p.course || p.dept || '')}</span></span></a>
        ${list.length > 1 ? `<button type="button" class="hm-face-nav prev" data-step="-1" aria-label="Previous graduate">‹</button><button type="button" class="hm-face-nav next" data-step="1" aria-label="Next graduate">›</button>` : ''}`;
      $('hmFacesN').textContent = `${i + 1} of ${list.length} today`;
    }
    const step = d => { i = (i + d + list.length) % list.length; paint(); };
    $('hmFaces').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (!b) return; e.preventDefault(); rest = Date.now() + 8000; step(Number(b.dataset.step)); });
    paint(); show('hmFacesSec', true);
    if (!still && list.length > 1) timer = setInterval(() => { if (!document.hidden && Date.now() > rest) step(1); }, 4500);
  }

  // ── lecturers and staff: approved ones in a random order (staff add theirs through "Create") ──
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const staffLabel = s => s.title ? `${s.title} ${String(s.name).trim().split(/\s+/).pop()}` : first(s.name);   // "Dr Achieng"
  async function loadStaff() {
    const { data, error } = await supabase.from('staff_public').select('id,name,title,photo_url').limit(60);
    if (error || !data || !data.length) return;                   // none approved yet: the section stays hidden
    $('hmStaff').innerHTML = shuffle(data).map(s => {
      const u = window.safeUrl(s.photo_url);
      return `<a class="hm-face is-staff" href="staff.html?id=${Number(s.id)}">
        <span class="hm-av">${u ? `<img src="${esc(thumbUrl(u, 160))}" alt="" loading="lazy" decoding="async">` : esc(initials(s.name))}</span>
        <span class="hm-face-n">${esc(staffLabel(s))}</span></a>`;
    }).join('');
    show('hmStaffSec', true);
  }

  // ── latest messages: the newest comments, with whose yearbook they are on ──
  async function loadMessages() {
    const { data, error } = await supabase.from('comments').select('id,profile_id,author_name,text,created_at')
      .order('created_at', { ascending: false }).limit(6);
    if (error || !data || !data.length) return show('hmMsgsSec', false);
    const r = await supabase.from('profiles_public').select('id,name,dept,course').in('id', [...new Set(data.map(c => c.profile_id))]);
    const on = new Map((r.data || []).map(p => [Number(p.id), p]));
    const rows = data.filter(c => on.has(Number(c.profile_id))).slice(0, 3);    // comments on archived profiles are skipped
    if (!rows.length) return show('hmMsgsSec', false);
    $('hmMsgs').innerHTML = rows.map(c => {
      const p = on.get(Number(c.profile_id));
      return `<a class="hm-msg" href="${esc(profileLink(p))}#comments">
        <span class="hm-msg-top"><span class="hm-msg-who"><b>${esc(c.author_name || 'Someone')}</b> on ${esc(first(p.name))}’s yearbook</span>
        <time datetime="${esc(c.created_at)}">${esc(ago(Date.parse(c.created_at)))}</time></span>
        <span class="hm-msg-t">${esc(c.text)}</span></a>`;
    }).join('');
  }

  // How many letters are waiting for you (only a count until graduation day, 21 November); quietly does nothing if letters aren't on yet
  async function paintLetters(user, mine) {
    const sub = $('hmLettersSub');
    const base = 'Write to a graduate. Every letter stays sealed until graduation day.';
    if (!user) { sub.textContent = base; return; }
    try {
      const r = await window.gApi('letters.mine', { countOnly: true });
      if (mine !== run) return;
      const n = r.forMe.count;
      sub.textContent = !n ? base : r.open ? `${n} ${n === 1 ? 'letter is' : 'letters are'} waiting for you. Open them!`
        : `${n} sealed ${n === 1 ? 'letter is' : 'letters are'} waiting for you. ${n === 1 ? 'It opens' : 'They open'} on graduation day, 21 November.`;
    } catch (e) { sub.textContent = base; }
  }

  async function loadCount() {
    const { count, error } = await supabase.from('profiles_public').select('id', { count: 'exact', head: true });
    if (error || !count) return;
    $('hmStudentsN').textContent = `${count} profiles`;
    // Under the countdown: how full the yearbook is (a goal and a bar can come once the class size is known)
    $('hmTally').innerHTML = `<b>${count.toLocaleString('en-GB')}</b> students are in the yearbook — and counting`;
    $('hmTally').hidden = false;
  }

  // ── signed-in part: runs again whenever someone signs in or out ──
  let run = 0;
  async function signedIn(user) {
    const mine = ++run;
    let me = null, staff = null;
    if (user) {
      const { data, error } = await supabase.from('profiles_public').select(MINE).eq('uid', user.uid).limit(1);
      if (error) throw error;
      me = data && data[0] ? data[0] : null;
      // No student profile: perhaps a lecturer or staff member (not yet switched on, or unreachable: treat as none)
      if (!me) staff = await window.gApi('staff.mine', {}).then(r => r.staff, () => null);
    }
    if (mine !== run) return;                                     // a newer sign-in/out has taken over
    const name = me ? first(me.name) : staff ? [staff.title, String(staff.name || '').trim().split(/\s+/).pop()].filter(Boolean).join(' ')
      : user ? first(user.displayName || String(user.email || '').split('@')[0]) : '';
    greet(name, me ? [me.classyear ? 'Class of ' + me.classyear : '', me.course || me.dept || ''].filter(Boolean).join(' · ') : staff ? staff.position : '');
    paintAct(user, me, staff);
    loadClass(me).catch(() => show('hmClassSec', false));
    paintLetters(user, mine);
  }

  greet('');
  // Graduation week: during the week the card says which day it is and what is open
  (function paintGrad() {
    const G = window.GLUK_GRADWEEK, card = $('hmGrad');
    if (!G || !card) return;
    const t = G.today();
    if (t >= 0 && t < 7) {
      const d = G.DAYS[t];
      card.classList.add('live'); card.href = 'grad.html#day-' + d.key;
      $('hmGradIc').textContent = d.emoji;
      $('hmGradT').textContent = `Graduation week · Day ${t + 1}: ${d.title}`;
      $('hmGradSub').textContent = d.line;
    } else if (t >= 7) {
      $('hmGradT').textContent = 'Congratulations, Class of 2026 🎓';
      $('hmGradSub').textContent = 'Relive graduation week: letters, Glow Up and more.';
    } else {
      const days = Math.ceil((G.START - Date.now()) / 864e5);
      $('hmGradSub').textContent = `Starts in ${days} ${days === 1 ? 'day' : 'days'}. Seven days, seven surprises. See the plan and get ready.`;
    }
  })();
  // Class superlatives: from the reveal, the card invites people to see the winners
  if ($('hmSupSub') && Date.now() >= Date.parse(window.SUP_REVEAL_AT || '2026-11-14T21:00:00Z')) $('hmSupSub').textContent = 'The winners are out! See who the Class of 2026 voted for.';
  loadNew().catch(() => show('hmNewSec', false));
  loadFaces().catch(() => show('hmFacesSec', false));
  loadStaff().catch(() => {});
  loadMessages().catch(() => show('hmMsgsSec', false));
  loadCount().catch(() => {});
  auth.onAuthStateChanged(user => {
    signedIn(user).catch(e => {
      console.warn('[home]', e);                                    // couldn't check for a profile: don't claim there is none
      if (user) act('', 'Your yearbook profile', 'Open it to add photos and memories.', '<button type="button" class="hm-btn" onclick="goToMyProfile()">Open</button>');
      else paintAct(null, null);
    });
  });
})();
