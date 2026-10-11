// =====================================================
//  GLUK YEARBOOK 2026 — STUDENT LEADERS (shared by university.html, profile.html and admin.html)
//
//  GLUKSA officials, class reps and other student leaders, past and present. The website reads the approved
//  ones from student_leaders_public. A student claims a role on their own profile through the api
//  (leaders.claim); it shows only once the admin approves it (Admin › Moderation › Leaders).
//  window.gLeaders: the labels, load(), the form, the claim sheet and the profile's badges.
// =====================================================
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = s => window.escHtml(s);

  const ORGS = {
    gluksa: { label: 'GLUKSA', long: 'GLUKSA (the students’ association)' },
    class:  { label: 'Class rep', long: 'A class (class representative)' },
    club:   { label: 'Club', long: 'A club or society' },
    other:  { label: 'Other', long: 'Something else (hostel, sports, campus…)' },
  };
  // Suggestions for the position (GLUKSA's from the 2025 constitution, Article 14, plus the older President titles)
  const TITLES = {
    gluksa: ['Chairperson', 'Vice chairperson', 'Secretary General', 'Finance Minister', 'Academic Minister', 'Sports and Entertainment Minister',
      'Gender and Social Welfare Minister', 'Speaker', 'Deputy Speaker', 'Campus Representative', 'President', 'Vice President'],
    class: ['Class representative', 'Assistant class representative'],
    club: ['Chairperson', 'Vice chairperson', 'Secretary', 'Treasurer', 'Organizing secretary'],
    other: ['Hostel captain', 'Games captain'],
  };
  const UNIT = {
    gluksa: { label: 'Campus or office (optional)', ph: 'e.g. Nairobi campus' },
    class:  { label: 'Which class?', ph: 'e.g. BSc. Nursing, Class of 2027' },
    club:   { label: 'Which club?', ph: 'e.g. Rotaract Club' },
    other:  { label: 'Where? (optional)', ph: 'e.g. Milimani hostel' },
  };

  // The order offices show in: the head of GLUKSA first
  const RANK = [/^(chair(person|man|lady)?|president)$/i, /^vice[- ]?(chair|president)/i, /^secretary[- ]general/i, /finance/i, /minister/i,
    /^speaker/i, /^deputy speaker/i, /campus/i, /^class rep/i, /^assistant/i];
  const rank = t => { const i = RANK.findIndex(re => re.test(String(t || '').trim())); return i < 0 ? RANK.length : i; };
  const isHead = r => r.org === 'gluksa' && rank(r.title) === 0;
  const byRank = (a, b) => rank(a.title) - rank(b.title) || b.term_from - a.term_from || String(a.name).localeCompare(String(b.name));

  // "2024/2025" for one academic year, "2023–2025" for longer, "since 2025" while serving with no end set (as in the api)
  const term = r => r.term_to == null ? (r.current ? `since ${r.term_from}` : String(r.term_from))
    : r.term_to === r.term_from ? String(r.term_from) : r.term_to === r.term_from + 1 ? `${r.term_from}/${r.term_to}` : `${r.term_from}–${r.term_to}`;
  const where = r => r.org === 'gluksa' ? ['GLUKSA', r.unit].filter(Boolean).join(' · ') : (r.unit || '');
  const roleLine = r => [r.title, where(r)].filter(Boolean).join(', ');
  const of = r => r.org === 'gluksa' ? 'of GLUKSA' : r.org === 'class' ? `for ${r.unit}` : r.org === 'club' ? `of ${r.unit}` : r.unit ? `at ${r.unit}` : '';
  // "is the Chairperson of GLUKSA" / "was the President of GLUKSA in 2024/2025"
  const sentence = r => `${r.current ? 'is' : 'was'} the ${r.title} ${of(r)}${r.current ? '' : ' in ' + term(r)}`.replace(/\s+/g, ' ').trim();
  const person = r => r.profile_id ? 'p' + r.profile_id : 'n' + String(r.name || '').trim().toLowerCase();

  const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  function face(r, cls = '') {
    const u = window.safeUrl(r.photo_url || '');
    return u ? `<span class="ku-face ${cls}" style="background-image:url('${E(u).replace(/'/g, '%27')}')" aria-hidden="true"></span>`
      : `<span class="ku-face ini ${cls}" aria-hidden="true">${E(initials(r.name))}</span>`;
  }

  // The approved leaders (everyone may read them). A missing table means the feature is being switched on.
  let cache = null;
  async function load(force) {
    if (cache && !force) return cache;
    cache = (async () => {
      const { data, error } = await supabase.from('student_leaders_public').select('*').order('term_from', { ascending: false }).limit(1000);
      if (error) {
        const er = new Error(error.message || 'Could not load the student leaders.');
        er.coming = /PGRST205|schema cache|does not exist|42P01/i.test(String((error.message || '') + ' ' + (error.code || '')));
        throw er;
      }
      return data || [];
    })();
    cache.catch(() => { cache = null; });
    return cache;
  }

  /* ── The form (the claim sheet; the admin page adds its own fields around it) ── */
  const academicYear = () => { const d = new Date(); return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; };
  function fieldsHTML(p, v = {}) {
    const y = new Date().getFullYear(), from = Number(v.term_from) || academicYear();
    const yearOpts = Array.from({ length: y + 2 - 2000 }, (_, i) => y + 1 - i);
    const org = ORGS[v.org] ? v.org : 'gluksa';
    return `
      <div class="form-group"><label class="form-label" for="${p}Org">Where was the role?</label>
        <select class="form-select" id="${p}Org" name="org">${Object.entries(ORGS).map(([k, o]) => `<option value="${k}"${k === org ? ' selected' : ''}>${E(o.long)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label" for="${p}Title">Position</label>
        <input class="form-input" id="${p}Title" name="title" maxlength="80" required list="${p}Titles" value="${E(v.title || '')}" autocomplete="off" placeholder="e.g. Chairperson">
        <datalist id="${p}Titles"></datalist></div>
      <div class="form-group"><label class="form-label" for="${p}Unit" id="${p}UnitLbl">${E(UNIT[org].label)}</label>
        <input class="form-input" id="${p}Unit" name="unit" maxlength="120" list="${p}Units" value="${E(v.unit || '')}" autocomplete="off">
        <datalist id="${p}Units"></datalist></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="${p}From">Term started</label>
          <select class="form-select" id="${p}From" name="term_from">${yearOpts.map(n => `<option value="${n}"${n === from ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label" for="${p}To">Term ended</label>
          <select class="form-select" id="${p}To" name="term_to" data-v="${v.term_to == null ? (v.org ? '' : from + 1) : Number(v.term_to)}"></select></div>
      </div>
      <label class="ld-check"><input type="checkbox" name="current"${v.current ? ' checked' : ''}> Serving now</label>
      <div class="form-group"><label class="form-label" for="${p}Note">A line about it <span class="ld-opt">(optional)</span></label>
        <textarea class="form-textarea" id="${p}Note" name="note" rows="3" maxlength="300" placeholder="What you did, or are proud of">${E(v.note || '')}</textarea></div>`;
  }
  // Suggestions and labels follow the kind of role; the end year follows the start year
  function syncForm(root, p, suggest = {}) {
    const org = root.querySelector('[name=org]').value, unit = $(p + 'Unit');
    $(p + 'Titles').innerHTML = (TITLES[org] || []).map(t => `<option value="${E(t)}">`).join('');
    const units = org === 'club' ? (window.GLUK_CLUBS || []) : (suggest[org] || []);
    $(p + 'Units').innerHTML = units.map(t => `<option value="${E(t)}">`).join('');
    $(p + 'UnitLbl').textContent = UNIT[org].label;
    unit.placeholder = UNIT[org].ph;
    unit.required = org === 'class' || org === 'club';
    const to = root.querySelector('[name=term_to]'), from = Number(root.querySelector('[name=term_from]').value);
    const fresh = !to.options.length;                       // just drawn: start from the saved end year
    if (fresh) root._ldFrom = null;
    let keep = fresh ? to.dataset.v : to.value;
    // the end moves with the start when it was the year after it (one academic year), or no longer fits
    if (keep !== '' && (Number(keep) === Number(root._ldFrom) + 1 || !(Number(keep) >= from && Number(keep) <= from + 8))) keep = String(from + 1);
    root._ldFrom = from;
    to.innerHTML = '<option value="">Not set</option>' + Array.from({ length: 9 }, (_, i) => from + i)
      .map(n => `<option value="${n}"${String(n) === String(keep) ? ' selected' : ''}>${n}</option>`).join('');
  }
  function wireForm(root, p, suggest) {
    root._ld = { p, suggest };                             // the same form is reused each time its sheet opens: listen once
    if (!root._ldWired) {
      root._ldWired = true;
      root.addEventListener('change', e => { if (e.target.name === 'org' || e.target.name === 'term_from') syncForm(root, root._ld.p, root._ld.suggest); });
    }
    syncForm(root, p, suggest);
  }
  function readForm(root) {
    const f = n => root.querySelector(`[name=${n}]`);
    return { org: f('org').value, title: f('title').value.trim(), unit: f('unit').value.trim(), term_from: Number(f('term_from').value),
      term_to: f('term_to').value ? Number(f('term_to').value) : null, current: f('current').checked, note: f('note').value.trim() };
  }

  /* ── The claim sheet (a student adds a role to their own profile) ── */
  let sheetDone = null, sheetOpen = false, busy = false;
  function sheet() {
    let ov = $('ldOv');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'sp-ov ld-ov'; ov.id = 'ldOv'; ov.hidden = true;
    ov.innerHTML = `<div class="sp-sheet ld-sheet" role="dialog" aria-modal="true" aria-labelledby="ldShTitle">
      <div class="sp-sh-head"><h2 id="ldShTitle">Add a leadership role</h2><button type="button" class="sp-x" data-ld="close" aria-label="Close">✕</button></div>
      <form id="ldForm" class="ld-form" novalidate></form></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-ld=close]')) closeClaim(); });
    ov.querySelector('form').addEventListener('submit', e => { e.preventDefault(); sendClaim(); });
    return ov;
  }
  // me: { course, classyear } of the student's profile (suggests their own class); row: a claim of theirs to change
  function openClaim(me, row, done) {
    const ov = sheet(), form = $('ldForm');
    sheetDone = done || null;
    form.dataset.id = row ? String(row.id) : '';
    $('ldShTitle').textContent = row ? 'Change your role' : 'Add a leadership role';
    form.innerHTML = `<p class="ld-sub">For GLUKSA officials, class reps and other student leaders, now or before. The admin checks it before it shows on your profile and on <a href="university.html#leaders">Know your university</a>.</p>
      ${fieldsHTML('ldf', row || {})}
      <button type="submit" class="btn-primary" id="ldSend">${row ? 'Send the change to the admin' : 'Send to the admin'}</button>`;
    const mine = me && me.course ? [`${me.course}, Class of ${me.classyear || ''}`.replace(/, Class of $/, '')] : [];
    wireForm(form, 'ldf', { class: mine });
    ov.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    if (!sheetOpen) { sheetOpen = true; history.pushState({ ldSheet: 1 }, ''); }
    setTimeout(() => form.querySelector('[name=title]').focus(), 60);
  }
  function hideClaim() {
    const ov = $('ldOv'); if (ov) ov.hidden = true;
    document.documentElement.style.overflow = '';
  }
  function closeClaim() {
    if (sheetOpen) { history.back(); return; }          // the popstate below hides it
    hideClaim();
  }
  window.addEventListener('popstate', () => { if (sheetOpen) { sheetOpen = false; hideClaim(); } });
  document.addEventListener('keydown', e => { const ov = $('ldOv'); if (e.key === 'Escape' && ov && !ov.hidden) { e.stopImmediatePropagation(); closeClaim(); } }, true);
  async function sendClaim() {
    if (busy) return;
    const form = $('ldForm'), v = readForm(form);
    if (v.title.length < 2) { window.showToast('Write the position, e.g. Class representative.'); form.querySelector('[name=title]').focus(); return; }
    if ((v.org === 'class' || v.org === 'club') && !v.unit) { window.showToast(v.org === 'class' ? 'Say which class.' : 'Say which club.'); form.querySelector('[name=unit]').focus(); return; }
    busy = true; $('ldSend').disabled = true;
    try {
      const id = form.dataset.id ? Number(form.dataset.id) : undefined;
      const r = await window.gApi('leaders.claim', id ? { id, leader: v } : { leader: v });
      closeClaim();
      window.showToast('Sent ✓ The admin will check it, then it shows on your profile.', 4000);
      if (sheetDone) sheetDone(r.leader);
    } catch (e) {
      window.showToast(e.code === 'leaders_coming' ? 'Student leaders are being switched on. Please try again later.' : (e.message || 'Could not send it.'), 4500);
    } finally { busy = false; const b = $('ldSend'); if (b) b.disabled = false; }
  }

  /* ── On a profile: the badges everyone sees, and the owner's own roles ── */
  const badgeHTML = r => `<a class="ld-badge${r.current ? ' now' : ''}" href="university.html#leaders"><span aria-hidden="true">🎖</span> ${E(r.honour || r.title)}${where(r) ? ', ' + E(where(r)) : ''} · ${E(term(r))}</a>`;
  async function paintBadges(profileId) {
    let rows;
    try { rows = (await load()).filter(r => Number(r.profile_id) === Number(profileId)); } catch (e) { return; }
    const old = $('ldBadges'); if (old) old.remove();
    const anchor = $('profileDept');
    if (!rows.length || !anchor) return;
    rows.sort((a, b) => (b.current - a.current) || b.term_from - a.term_from || byRank(a, b));
    anchor.insertAdjacentHTML('afterend', `<div id="ldBadges" class="ld-badges">${rows.map(badgeHTML).join('')}</div>`);
  }
  const STATUS = { pending: ['Waiting for the admin', 'wait'], approved: ['On your profile', 'live'], hidden: ['Hidden by the admin', 'off'] };
  let ownFor = null;
  async function paintOwner(profile) {
    ownFor = profile;
    let card = $('ldCard');
    const body = document.querySelector('.profile-body');
    if (!body) return;
    if (!card) {
      card = document.createElement('div');
      card.className = 'info-card ld-card'; card.id = 'ldCard';
      body.insertBefore(card, body.firstChild);
      card.addEventListener('click', onOwnerClick);
    }
    let r;
    try { r = await window.gApi('leaders.mine'); }
    catch (e) { card.remove(); return; }                // not switched on yet, or offline: nothing to show
    if (ownFor !== profile) return;
    if (!r.profile || r.profile.anonymous) { card.remove(); return; }
    card._rows = r.rows || [];
    card.innerHTML = `<div class="info-card-title">🎖 Leadership</div>
      ${card._rows.length ? `<ul class="ld-mine">${card._rows.map(x => `<li><span class="ld-mine-t"><b>${E(roleLine(x))}</b><small>${E(term(x))}${x.current ? ' · serving now' : ''}</small></span>
          <span class="ld-st ${STATUS[x.status][1]}">${STATUS[x.status][0]}</span>
          ${x.mine ? `<span class="ld-mine-acts"><button type="button" class="ld-link" data-ld-edit="${Number(x.id)}">Change</button><button type="button" class="ld-link danger" data-ld-del="${Number(x.id)}">Remove</button></span>` : ''}</li>`).join('')}</ul>`
        : '<p class="ld-empty">Were you a GLUKSA leader, a class rep or a club official? Add it, and once the admin checks it, it shows on your profile.</p>'}
      <button type="button" class="ld-add" data-ld-add>＋ Add a leadership role</button>`;
  }
  async function onOwnerClick(e) {
    const card = $('ldCard'), p = ownFor;
    if (e.target.closest('[data-ld-add]')) { openClaim(p, null, () => paintOwner(p)); return; }
    const ed = e.target.closest('[data-ld-edit]');
    if (ed) { const row = (card._rows || []).find(x => x.id === Number(ed.dataset.ldEdit)); if (row) openClaim(p, row, () => { paintOwner(p); paintBadges(p.id); }); return; }
    const del = e.target.closest('[data-ld-del]');
    if (del) {
      if (!confirm('Remove this role from your profile?')) return;
      del.disabled = true;
      try { await window.gApi('leaders.withdraw', { id: Number(del.dataset.ldDel) }); window.showToast('Removed.'); load(true).catch(() => {}); paintBadges(p.id); }
      catch (er) { window.showToast(er.message || 'Could not remove it.'); }
      paintOwner(p);
    }
  }
  // profile: the profile on the page ({ id, uid, course, classyear, isanonymous }); called again on sign-in changes
  function paintProfile(profile, user) {
    if (profile.isanonymous) return;
    paintBadges(profile.id);
    const card = $('ldCard');
    if (user && user.uid === profile.uid) paintOwner(profile);
    else if (card) { card.remove(); ownFor = null; }
  }

  window.gLeaders = { ORGS, TITLES, rank, isHead, byRank, term, where, roleLine, sentence, person, face, initials, load,
    fieldsHTML, syncForm, wireForm, readForm, openClaim, paintProfile };
})();
