// =====================================================
//  GLUK YEARBOOK 2026 — THE ALUMNI REGISTRATION FORM (alumni-form.html)
//  The Directorate of External Affairs' paper form, online. It is filled in from the student's yearbook profile
//  (api alumni.mine), kept as a draft on this device until it is sent (alumni.save), and can be changed or
//  withdrawn later (alumni.withdraw). Only the student, the alumni office and the super admin read it.
// =====================================================
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const form = $('afForm'), gate = $('afGate'), done = $('afDone');
  const FIELDS = ['full_name', 'reg', 'national_id', 'gender', 'dob', 'phone', 'email', 'postal_address', 'residence', 'school', 'programme', 'specialization',
    'admission_intake', 'admission_year', 'graduation_year', 'study_mode', 'employment_status', 'employer', 'job_title', 'work_location', 'further_studies', 'interest_other'];
  const INTEREST = { mentorship: 'Mentorship of current students', lectures: 'Guest lectures / talks', internships: 'Internship / job placement support',
    events: 'Alumni events and reunions', fundraising: 'Fundraising / resource mobilization', other: 'Other' };
  const day = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const sameName = (a, b) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ') === String(b || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let me = null, data = null, draftKey = '', _saveT = 0;

  // ── the lists: counties and countries, schools and their programmes, years ──
  const opts = (list, all) => (all ? `<option value="">${esc(all)}</option>` : '') + list.map(x => `<option>${esc(x)}</option>`).join('');
  const years = (from, to) => { const y = []; for (let i = from; i >= to; i--) y.push(String(i)); return y; };
  function fillLists() {
    const now = new Date().getFullYear(), map = window.DEPT_COURSES_MAP || {};
    $('af-residence').innerHTML = '<option value="">Choose…</option>' + `<optgroup label="In Kenya: county">${opts(window.KENYA_COUNTIES || [])}</optgroup>`
      + `<optgroup label="Outside Kenya: country">${opts((window.COUNTRIES || []).filter(c => c !== 'Kenya'))}</optgroup>`;
    $('af-school').innerHTML = opts(Object.keys(map), 'Choose…');
    $('af-admission_year').innerHTML = opts(years(now, 1990), 'Year…');
    $('af-graduation_year').innerHTML = opts(years(now + 6, 1990), 'Choose…');
    fillProgrammes('');
  }
  // The programmes of the chosen school; a programme that is not in the list (an older name, say) is kept as it is
  function fillProgrammes(keep) {
    const map = window.DEPT_COURSES_MAP || {}, school = $('af-school').value;
    const list = [...new Set(school ? (map[school] || []) : [].concat(...Object.values(map)))].sort();
    if (keep && !list.includes(keep)) list.unshift(keep);
    $('af-programme').innerHTML = opts(list, 'Choose…');
    if (keep) $('af-programme').value = keep;
  }
  // A value for a <select> that is not one of its options yet (e.g. a school from an older profile) is added to it
  function setValue(name, v) {
    const el = form.elements[name]; if (!el || v == null || v === '') return;
    if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(v))) el.insertAdjacentHTML('beforeend', `<option>${esc(String(v))}</option>`);
    el.value = String(v);
  }
  function fill(rec) {
    form.reset();
    setValue('school', rec.school); fillProgrammes(rec.programme || '');
    FIELDS.filter(k => k !== 'programme').forEach(k => setValue(k, rec[k]));
    form.querySelectorAll('[name="interests"]').forEach(x => { x.checked = (rec.interests || []).includes(x.value); });
    $('afSign').value = ''; $('afAgree').checked = false;
    otherBox();
  }
  const values = () => ({ ...Object.fromEntries(FIELDS.map(k => [k, form.elements[k].value.trim()])),
    interests: [...form.querySelectorAll('[name="interests"]:checked')].map(x => x.value) });
  function otherBox() {
    const on = form.querySelector('[name="interests"][value="other"]').checked;
    $('afOtherBox').hidden = !on; $('af-interest_other').required = on;
  }
  // The intake and year of admission are in the reg number: B11/GLUK/S133K/2022 is the September 2022 intake
  function fromReg() {
    const m = /\/([JMS])\d+[A-Z]*\/((?:19|20)\d{2})\s*$/i.exec($('af-reg').value);
    if (!m) return;
    if (!form.elements.admission_intake.value) form.elements.admission_intake.value = { J: 'January', M: 'May', S: 'September' }[m[1].toUpperCase()];
    if (!form.elements.admission_year.value) setValue('admission_year', m[2]);
  }

  // ── the draft, on this device only, until the form is sent ──
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch (e) { return null; } };
  const dropDraft = () => { clearTimeout(_saveT); try { localStorage.removeItem(draftKey); } catch (e) {} };
  function keepDraft() {
    if (data && data.record) return;                         // a sent form is changed and sent again, never drafted
    clearTimeout(_saveT);
    _saveT = setTimeout(() => { if (data && data.record) return; try { localStorage.setItem(draftKey, JSON.stringify(values())); } catch (e) {} }, 400);
  }

  // ── what the page shows ──
  function showForm(editing) {
    gate.hidden = true; done.hidden = true; form.hidden = false;
    const draft = !editing && readDraft();
    fill(editing ? data.record : draft || data.prefill || {});
    $('afPre').hidden = editing || !!draft || !data.profileId;
    $('afDraft').hidden = !!editing; $('afCancel').hidden = !editing;
    $('afSend').textContent = editing ? 'Save my changes' : 'Send my alumni form';
    $('afDate').textContent = day(new Date().toISOString());
    $('afErr').hidden = true;
    window.scrollTo(0, 0);
  }
  function showDone() {
    const r = data.record;
    gate.hidden = true; form.hidden = true; done.hidden = false;
    const asked = r.withdraw_requested_at;
    done.innerHTML = `<div class="of-card af-done"><div class="of-ico">${asked ? '🗑' : '✅'}</div>
        <h2>${asked ? 'You asked for your alumni record to be removed' : 'Your alumni form is with the Directorate of External Affairs'}</h2>
        <p>${asked ? `On ${esc(day(asked))}. The Directorate of External Affairs will remove it. Changed your mind? Keep it below.`
          : `Sent on ${esc(day(r.submitted_at))}${r.updated_at !== r.submitted_at ? `, last changed on ${esc(day(r.updated_at))}` : ''}. Thank you, and welcome to the GLUK Alumni Association! 🎓`}</p>
        <dl class="af-sum"><dt>Name</dt><dd>${esc(r.full_name)}</dd><dt>Programme</dt><dd>${esc(r.programme)}, class of ${esc(String(r.graduation_year))}</dd>
          <dt>Now</dt><dd>${esc([r.employment_status, r.job_title, r.employer].filter(Boolean).join(' · '))}</dd>
          <dt>Happy to help with</dt><dd>${esc((r.interests || []).map(k => k === 'other' ? r.interest_other : INTEREST[k]).filter(Boolean).join(', ') || '—')}</dd></dl>
        <div class="af-acts"><button type="button" class="btn-primary" data-af="edit">✏️ See or change my form</button></div></div>
      <div class="of-box af-wd">${asked ? `<b>Keep my alumni record</b><p>Take back your request, and the office keeps your record.</p>
          <button type="button" class="of-btn" data-af="keep">Keep my record</button>`
        : `<b>Withdraw my alumni record</b><p>Ask the Directorate of External Affairs to remove your alumni record. Your yearbook profile stays as it is.</p>
          <textarea class="form-input" id="afWhy" rows="2" maxlength="300" placeholder="Why? (optional)"></textarea>
          <button type="button" class="of-btn" data-af="withdraw">Ask for it to be removed</button>`}</div>`;
  }
  function paint() { if (data.record) showDone(); else showForm(false); }

  // ── sending ──
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('afErr'), send = $('afSend'), v = values();
    err.hidden = true;
    if (!form.reportValidity()) return;
    if (Number(v.graduation_year) < Number(v.admission_year)) { err.textContent = 'Your year of graduation must be in or after your year of admission.'; err.hidden = false; return; }
    if (!sameName($('afSign').value, v.full_name)) { err.textContent = 'To sign, type your full name exactly as in Section A.'; err.hidden = false; $('afSign').focus(); return; }
    send.disabled = true; const label = send.textContent; send.textContent = 'Sending…';
    try {
      const r = await window.gApi('alumni.save', { record: v, agree: $('afAgree').checked, signature: $('afSign').value.trim() });
      data.record = r.record; dropDraft();
      try { sessionStorage.setItem('gluk-alumni:' + me.uid, '0'); } catch (er) {}     // no more reminders
      showToast(label === 'Save my changes' ? '✅ Saved' : '🎓 Sent. Thank you!', 3500);
      showDone(); window.scrollTo(0, 0);
    } catch (er) { err.textContent = (er && er.message) || 'Could not send the form. Please try again.'; err.hidden = false; }
    send.disabled = false; send.textContent = label;
  });
  form.addEventListener('input', e => { if (e.target.id === 'af-reg') fromReg(); keepDraft(); });
  form.addEventListener('change', e => {
    if (e.target.id === 'af-school') fillProgrammes('');
    if (e.target.name === 'interests') otherBox();
    keepDraft();
  });
  $('afCancel').onclick = () => { showDone(); window.scrollTo(0, 0); };
  done.addEventListener('click', async e => {
    const b = e.target.closest('[data-af]'); if (!b) return;
    if (b.dataset.af === 'edit') { showForm(true); return; }
    const keep = b.dataset.af === 'keep';
    if (!keep && !confirm('Ask the Directorate of External Affairs to remove your alumni record?')) return;
    b.disabled = true;
    try {
      const patch = await window.gApi('alumni.withdraw', keep ? { cancel: true } : { reason: ($('afWhy') && $('afWhy').value.trim()) || '' });
      Object.assign(data.record, patch);
      showToast(keep ? '✅ Your record stays' : 'Your request was sent to the office', 3500);
      showDone();
    } catch (er) { showToast('❌ ' + ((er && er.message) || 'Could not do that.'), 3500); b.disabled = false; }
  });

  auth.onAuthStateChanged(async u => {
    me = u;
    if (!u) {
      form.hidden = true; done.hidden = true; gate.hidden = false;
      gate.innerHTML = `<div class="of-ico">🎓</div><h2>Sign in to fill in your alumni form</h2><p>It is part of your graduation clearance, and takes about five minutes. Sign in with the account you use for the yearbook.</p>
        <button type="button" class="btn-primary" onclick="openAuthModal(null,'login')">Sign in</button>`;
      return;
    }
    draftKey = 'gluk-alumni-draft:' + u.uid;
    gate.hidden = false; gate.innerHTML = '<p>Loading your form…</p>';
    try { data = await window.gApi('alumni.mine', {}); }
    catch (e) { gate.innerHTML = `<p>${esc(e && e.code === 'alumni_coming' ? 'The alumni form is being switched on. Please come back a little later.' : (e && e.message) || 'Could not load your form. Please reload the page.')}</p>`; return; }
    fillLists();
    paint();
  });
})();
