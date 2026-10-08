// =====================================================
//  GLUK YEARBOOK 2026 — STAFF  (staff.html)
//
//  staff.html?id=12   one lecturer or staff member, as everyone sees them
//  staff.html         your own staff profile: add it, edit it, and see
//                     whether the admin has approved it yet
//
//  • Visitors only ever see approved staff (staff_public). A new staff
//    profile waits for the admin, so nobody can pose as a lecturer.
//  • Before the staff table exists the form says "switching on soon".
// =====================================================
(function () {
  'use strict';
  const box = document.getElementById('sf');
  if (!box) return;
  const id = Number(new URLSearchParams(location.search).get('id')) || 0;
  const TITLES = ['Dr', 'Prof', 'Mr', 'Mrs', 'Ms', 'Rev', 'Eng'];
  const MAX_MSG = 600;

  const fullName = s => [s.title, s.name].filter(Boolean).join(' ');
  const initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const back = '<a class="sf-back" href="index.html">‹ Home</a>';
  const note = (icon, title, text, buttons) => `${back}<div class="sf-card sf-note">
    <div class="sf-note-ic" aria-hidden="true">${icon}</div><h1>${title}</h1><p>${text}</p><div class="sf-btns">${buttons || ''}</div></div>`;
  const loading = () => { box.innerHTML = back + '<div class="sf-card"><div class="hm-sk" style="height:220px;border-radius:var(--radius-md)"></div></div>'; };

  // ── one staff member ──
  async function showOne() {
    const { data, error } = await supabase.from('staff_public').select('*').eq('id', id).limit(1);
    const s = !error && data && data[0];
    if (!s) {
      box.innerHTML = note('🔍', 'Staff profile not found', 'It may have been removed, or it is still waiting for approval.', '<a class="hm-btn" href="index.html">Go to Home</a>');
      return;
    }
    document.title = `${fullName(s)} — GLUK Yearbook`;
    const photo = window.safeUrl(s.photo_url);
    const meta = [s.dept, s.since_year ? 'At GLUK since ' + s.since_year : ''].filter(Boolean);
    box.innerHTML = `${back}<article class="sf-card sf-view">
      <div class="sf-av">${photo ? `<img src="${esc(photo)}" alt="${esc(fullName(s))}">` : esc(initials(s.name))}</div>
      <span class="sf-badge">GLUK staff</span>
      <h1>${esc(fullName(s))}</h1>
      <p class="sf-pos">${esc(s.position)}</p>
      ${meta.length ? `<p class="sf-meta">${meta.map(esc).join(' · ')}</p>` : ''}
      ${s.message ? `<figure class="sf-msg"><figcaption>To the Class of ${esc(window.GRAD_YEAR)}</figcaption><blockquote>${esc(s.message)}</blockquote></figure>` : ''}
    </article>`;
  }

  // ── your own staff profile ──
  let me = null;                                       // the signed-in person
  let mine = null;                                     // their saved staff profile, or null
  let draft = null;                                    // what is typed in the form, kept while it is redrawn
  let photo = null;                                    // null = unchanged, { blob, preview } = newly picked, '' = removed
  async function showMine(user) {
    me = user;
    if (!user) {
      box.innerHTML = note('🎓', 'Lecturers and staff', `Sign in to add your staff profile: your photo, your role and a message to the Class of ${esc(window.GRAD_YEAR)}.`,
        '<button type="button" class="hm-btn" data-act="signup">Create account</button><button type="button" class="sf-btn2" data-act="signin">Sign in</button>');
      return;
    }
    loading();
    try { mine = (await window.gApi('staff.mine', {})).staff; }
    catch (e) {
      box.innerHTML = e.code === 'staff_coming' || e.code === 'unknown_action'
        ? note('⏳', 'Staff profiles are switching on soon', 'Please check back in a little while.', '<a class="hm-btn" href="index.html">Go to Home</a>')
        : note('⚠️', 'Could not load your staff profile', esc(e.message || 'Please try again.'), '<button type="button" class="hm-btn" data-act="retry">Try again</button>');
      return;
    }
    photo = null; draft = null;
    paintForm();
  }

  function statusBox() {
    if (!mine) return `<p class="sf-lead">Students will see your photo, your role and your message on the yearbook's Home page.
      The admin checks every staff profile before it appears, so students know it is really you.</p>`;
    if (mine.status === 'approved') return `<div class="sf-status ok"><b>Live</b> Students can see your profile. <a href="staff.html?id=${Number(mine.id)}">View it</a></div>`;
    if (mine.status === 'hidden') return '<div class="sf-status off"><b>Hidden</b> The admin has hidden your profile. Contact the yearbook admin if this is a mistake.</div>';
    return '<div class="sf-status wait"><b>Waiting for approval</b> The admin will check it soon. Your phone gets a notification when it goes live.</div>';
  }

  function paintForm() {
    const s = draft || mine || {};
    const shown = photo === '' ? '' : photo ? photo.preview : window.safeUrl(mine && mine.photo_url);
    const v = k => esc(s[k] || '');
    const depts = Object.keys(window.DEPT_COURSES_MAP || {});
    box.innerHTML = `${back}<form class="sf-card sf-form" id="sfForm" novalidate>
      <h1>${mine ? 'Your staff profile' : 'Add your staff profile'}</h1>
      ${statusBox()}
      <div class="sf-photo">
        <div class="sf-av">${shown ? `<img src="${esc(shown)}" alt="Your photo">` : esc(initials(s.name || (me && me.displayName)))}</div>
        <div class="sf-photo-btns">
          <label class="sf-btn2" for="sfPhoto">${shown ? 'Change photo' : 'Add a photo'}</label>
          <input type="file" id="sfPhoto" accept="image/*" hidden>
          ${shown ? '<button type="button" class="sf-link" data-act="no-photo">Remove</button>' : ''}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="sfTitle">Title</label>
          <select class="form-select" id="sfTitle" name="title"><option value="">None</option>${TITLES.map(t => `<option${s.title === t ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label" for="sfYear">At GLUK since</label>
          <input class="form-input" id="sfYear" name="since_year" inputmode="numeric" maxlength="4" placeholder="e.g. 2015" value="${v('since_year')}"></div>
      </div>
      <div class="form-group"><label class="form-label" for="sfName">Full name *</label>
        <input class="form-input" id="sfName" name="name" maxlength="120" required autocomplete="name" value="${v('name') || esc((me && me.displayName) || '')}"></div>
      <div class="form-group"><label class="form-label" for="sfPos">Position *</label>
        <input class="form-input" id="sfPos" name="position" maxlength="120" required placeholder="e.g. Lecturer, Clinical Medicine" value="${v('position')}"></div>
      <div class="form-group"><label class="form-label" for="sfDept">School or office</label>
        <input class="form-input" id="sfDept" name="dept" maxlength="120" list="sfDepts" placeholder="e.g. School of Medicine, Registry" value="${v('dept')}">
        <datalist id="sfDepts">${depts.map(d => `<option value="${esc(d)}">`).join('')}</datalist></div>
      <div class="form-group"><label class="form-label" for="sfMsg">Message to the Class of ${esc(window.GRAD_YEAR)}</label>
        <textarea class="form-textarea" id="sfMsg" name="message" rows="4" maxlength="${MAX_MSG}" placeholder="Congratulations, advice, a memory…">${v('message')}</textarea>
        <div class="char-count" id="sfMsgN"></div></div>
      <button type="submit" class="btn-primary" id="sfSave">${mine ? 'Save changes' : 'Send for approval'}</button>
      ${mine ? '<button type="button" class="sf-link sf-del" data-act="delete">Delete my staff profile</button>' : ''}
    </form>`;
    const msg = document.getElementById('sfMsg'), n = document.getElementById('sfMsgN');
    const count = () => { n.textContent = `${MAX_MSG - msg.value.length} characters left`; };
    msg.addEventListener('input', count); count();
    document.getElementById('sfPhoto').addEventListener('change', pickPhoto);
  }

  // Redraw the form (after picking or removing a photo) without losing what has been typed
  function redraw() {
    const f = document.getElementById('sfForm');
    if (f) draft = Object.fromEntries(new FormData(f));
    paintForm();
  }
  function pickPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => { photo = await compressImage(ev.target.result, 900, 0.82); redraw(); };
    reader.readAsDataURL(file);
  }

  async function save(e) {
    e.preventDefault();
    const f = e.target, btn = document.getElementById('sfSave');
    const d = Object.fromEntries(new FormData(f));
    if (!String(d.name || '').trim()) { showToast('Please enter your name ✍️'); f.name.focus(); return; }
    if (!String(d.position || '').trim()) { showToast('Please enter your position'); f.position.focus(); return; }
    if (d.since_year && !/^\d{4}$/.test(d.since_year.trim())) { showToast('"At GLUK since" must be a year, like 2015'); f.since_year.focus(); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      let url = photo === '' ? '' : (mine && mine.photo_url) || '';
      if (photo && photo.blob) url = await uploadPhoto(photo.blob, me.uid, 'staff');
      const was = mine;
      mine = (await window.gApi('staff.save', { staff: { ...d, photo_url: url } })).staff;
      draft = null; photo = null;
      paintForm();
      showToast(!was ? 'Sent! The admin will approve it soon 🎓'
        : mine.status === 'pending' && was.status === 'approved' ? 'Saved. Your new name needs the admin to approve it again.' : 'Saved ✅');
      window.scrollTo(0, 0);
    } catch (err) {
      console.warn('[staff save]', err);
      showToast('⚠️ ' + (err.message || 'Could not save. Please try again.'));
      btn.disabled = false; btn.textContent = mine ? 'Save changes' : 'Send for approval';
    }
  }

  async function remove() {
    if (!confirm('Delete your staff profile? Students will no longer see it.')) return;
    try { await window.gApi('staff.delete', {}); mine = null; draft = null; photo = null; showToast('Staff profile deleted'); paintForm(); }
    catch (err) { showToast('⚠️ ' + (err.message || 'Could not delete. Please try again.')); }
  }

  box.addEventListener('submit', e => { if (e.target.id === 'sfForm') save(e); });
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'signup') openAuthModal(null, 'signup');
    else if (a === 'signin') openAuthModal(null, 'login');
    else if (a === 'retry') showMine(me);
    else if (a === 'no-photo') { photo = ''; redraw(); }
    else if (a === 'delete') remove();
  });

  if (id) showOne().catch(e => { console.warn('[staff]', e); box.innerHTML = note('⚠️', 'Could not load this profile', 'Please check your connection and try again.', ''); });
  else auth.onAuthStateChanged(user => { showMine(user).catch(e => console.warn('[staff]', e)); });
})();
