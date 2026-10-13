// =====================================================
//  GLUK YEARBOOK 2026 — OFFICE DASHBOARDS (office.html)
//  One page for every office: the signed-in person sees only their own office's dashboard (api office.me);
//  the super admin sees every office, with a switch. Every list an office opens and every export is written
//  in the audit log (the api does that before it answers).
//    dos     Office of the Dean of Students: the students database (permission dos.students) and the club activity records (dos.clubs)
//    alumni  Directorate of External Affairs: the alumni records from alumni-form.html, who has not filled it yet, withdrawal
//            requests, and contacting alumni privately (BCC email, one-by-one WhatsApp) (permission alumni)
// =====================================================
'use strict';
(function () {
  const NAMES = (typeof OFFICE_NAMES !== 'undefined' && OFFICE_NAMES) || {};
  const $ = id => document.getElementById(id);
  const body = $('ofBody'), seg = $('ofSeg');
  const card = html => { body.innerHTML = `<div class="of-card">${html}</div>`; };
  const nfmt = n => Number(n || 0).toLocaleString('en');
  const plural = (n, one, many) => Number(n) === 1 ? one : many;
  const initials = n => (String(n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase();
  const fmtDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const tile = (n, label) => `<div class="of-tile"><b>${esc(typeof n === 'number' ? nfmt(n) : n)}</b><span>${esc(label)}</span></div>`;
  let offices = [], perms = [], cur = '';

  // ── CSV files that Excel opens straight away: UTF-8 with a byte-order mark, and no cell can start a formula ──
  function csvCell(v) {
    if (v && typeof v === 'object' && 'raw' in v) return '"' + String(v.raw).replace(/"/g, '""') + '"';      // our own ="…" for phone numbers
    let s = String(v == null ? '' : v);
    if (/^[=@\t\r]/.test(s) || /^[+-][^\d\s]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  // A phone number as ="+2547…", so Excel keeps the + and every digit (the number is checked: digits and + - ( ) only)
  const phoneCell = v => /^\+?[\d\s()-]{6,30}$/.test(String(v || '')) ? { raw: `="${v}"` } : (v || '');
  function download(name, header, rows) {
    const text = '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const today = () => new Date().toISOString().slice(0, 10);

  // ══ Office of the Dean of Students ══
  const DOS = { tab: 'students', f: {}, rows: [], total: 0, more: false, year: 0, clubs: null };
  let _seq = 0, _typing = 0;
  const DOS_TABS = [['students', '👥 Students database', 'dos.students'], ['clubs', '🏛 Club records', 'dos.clubs']];
  function paintDos() {
    const tabs = DOS_TABS.filter(t => perms.includes(t[2]));        // each tab needs its own permission
    if (!tabs.some(t => t[0] === DOS.tab)) DOS.tab = tabs[0][0];
    body.innerHTML = `<div class="of-tabs" role="tablist">${tabs.map(([k, label]) =>
        `<button type="button" role="tab" data-dt="${k}" class="${DOS.tab === k ? 'on' : ''}" aria-selected="${DOS.tab === k}">${label}</button>`).join('')}</div>
      <div id="dosPane"></div>`;
    if (DOS.tab === 'students') paintStudents(); else paintClubs();
  }

  /* — the students database — */
  const options = (list, val, all) => `<option value="">${esc(all)}</option>` + list.map(x => `<option value="${esc(x)}"${String(x) === String(val || '') ? ' selected' : ''}>${esc(x)}</option>`).join('');
  function paintStudents() {
    const f = DOS.f, map = window.DEPT_COURSES_MAP || {};
    const courses = [...new Set(f.dept ? (map[f.dept] || []) : [].concat(...Object.values(map)))].sort();
    const years = []; for (let y = (window.GRAD_YEAR || new Date().getFullYear()) + 4; y >= 2007; y--) years.push(String(y));
    $('dosPane').innerHTML = `
      <div class="of-filters of-noprint">
        <input type="search" id="dsQ" class="form-input" placeholder="Search by name or reg number" value="${esc(f.q || '')}" autocomplete="off" aria-label="Search by name or reg number">
        <select id="dsDept" class="form-select" aria-label="School">${options(Object.keys(map), f.dept, 'All schools')}</select>
        <select id="dsCourse" class="form-select" aria-label="Programme">${options(courses, f.course, 'All programmes')}</select>
        <select id="dsYear" class="form-select" aria-label="Class year">${options(years, f.classyear, 'All classes')}</select>
        <select id="dsCounty" class="form-select" aria-label="Home county">${options(window.KENYA_COUNTIES || [], f.county, 'All counties')}</select>
        <select id="dsClub" class="form-select" aria-label="Club">${options(window.GLUK_CLUBS || [], f.club, 'All clubs')}</select>
      </div>
      <div class="of-meta"><span id="dsCount">Loading…</span><span style="flex:1"></span>
        ${Object.keys(f).length ? '<button type="button" class="of-link" data-ds="clear">Clear filters</button>' : ''}
        <button type="button" class="of-btn" data-ds="export">⬇ Export CSV</button></div>
      <div id="dsList" class="of-list"></div><div id="dsMore"></div>`;
    loadStudents(true);
  }
  async function loadStudents(reset) {
    const seq = ++_seq;
    if (reset) { DOS.rows = []; $('dsList').innerHTML = '<div class="of-empty">Loading…</div>'; $('dsMore').innerHTML = ''; }
    let r;
    try { r = await window.gApi('dos.students', { ...DOS.f, from: reset ? 0 : DOS.rows.length }); }
    catch (e) { if (seq === _seq) $('dsList').innerHTML = `<div class="of-empty">${esc((e && e.message) || 'Could not load the students.')}</div>`; return; }
    if (seq !== _seq || !$('dsList')) return;                 // a newer search is on its way, or the tab changed
    DOS.rows = DOS.rows.concat(r.rows || []); DOS.total = r.total || 0; DOS.more = !!r.more;
    $('dsCount').textContent = nfmt(DOS.total) + ' ' + plural(DOS.total, 'student', 'students');
    $('dsList').innerHTML = DOS.rows.length ? DOS.rows.map(studentRow).join('') : '<div class="of-empty">No students match.</div>';
    $('dsMore').innerHTML = DOS.more ? `<button type="button" class="of-btn wide" data-ds="more">Show more (${nfmt(DOS.total - DOS.rows.length)} left)</button>` : '';
  }
  function studentRow(s) {
    const photo = window.safeUrl ? window.safeUrl(s.photo_url) : '';
    const place = s.country && s.country !== 'Kenya' ? s.country : s.county;
    const tel = s.whatsapp ? `<a href="tel:${esc(String(s.whatsapp).replace(/[^\d+]/g, ''))}">${esc(s.whatsapp)}</a>` : '';
    const mail = s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '';
    return `<div class="of-row">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : `<span class="of-av">${esc(initials(s.name))}</span>`}
      <div class="of-row-main"><b>${esc(s.name || 'Unnamed')}</b>${s.isanonymous ? ' <span class="of-tag">anonymous on the yearbook</span>' : ''}
        <span>${esc([s.reg, s.course, s.classyear && 'Class of ' + s.classyear, place].filter(Boolean).join(' · '))}</span>
        <span>${[tel, mail].filter(Boolean).join(' · ') || 'No contact details given'}</span></div></div>`;
  }
  async function exportStudents(btn) {
    btn.disabled = true; btn.textContent = 'Preparing…';
    try {
      const r = await window.gApi('dos.students', { ...DOS.f, export: true });
      const rows = (r.rows || []).map(s => [s.name, s.reg, s.dept, s.course, s.classyear, s.country || 'Kenya', s.county, s.currentcounty, phoneCell(s.whatsapp), s.email,
        (Array.isArray(s.clubs) ? s.clubs : []).join('; '), s.isanonymous ? 'yes' : '', s.created_at ? String(s.created_at).slice(0, 10) : '']);
      download(`GLUK students ${today()}.csv`, ['Name', 'Reg number', 'School', 'Programme', 'Class year', 'Home country', 'Home county', 'County now',
        'Phone (WhatsApp)', 'Email', 'Clubs', 'Anonymous on the yearbook', 'Joined the yearbook'], rows);
      showToast('⬇ ' + nfmt(rows.length) + ' ' + plural(rows.length, 'student', 'students') + ' exported');
    } catch (e) { showToast('❌ ' + ((e && e.message) || 'Could not export.'), 3500); }
    btn.disabled = false; btn.textContent = '⬇ Export CSV';
  }

  /* — the club activity records, by year and trimester — */
  const TRI = ['', 'January – April', 'May – August', 'September – December'];
  const TYPE = { notice: 'Notice', event: 'Event', activity: 'Activity', minutes: 'Minutes', photo: 'Photos' };
  async function paintClubs() {
    const now = new Date().getFullYear();
    if (!DOS.year) DOS.year = now;
    $('dosPane').innerHTML = `<div class="of-meta of-noprint"><label class="of-label">Year <select id="dcYear" class="form-select" style="width:auto"><option>${DOS.year}</option></select></label>
        <span style="flex:1"></span><button type="button" class="of-btn" data-dc="print">🖨 Print</button><button type="button" class="of-btn" data-dc="export">⬇ Export CSV</button></div>
      <div id="dcBody"><div class="of-empty">Loading…</div></div>`;
    let d;
    try { d = await window.gApi('dos.clubs', { year: DOS.year }); }
    catch (e) { $('dcBody').innerHTML = `<div class="of-empty">${esc((e && e.message) || 'Could not load the club records.')}</div>`; return; }
    if (!$('dcBody')) return;
    DOS.clubs = d;
    const years = []; for (let y = now; y >= Math.min(d.firstYear || now, now); y--) years.push(y);
    $('dcYear').innerHTML = years.map(y => `<option value="${y}"${y === DOS.year ? ' selected' : ''}>${y}</option>`).join('');
    $('dcBody').innerHTML = clubsHTML(d);
  }
  function clubsHTML(d) {
    const names = [...new Set([...(window.GLUK_CLUBS || []), ...d.posts.map(p => p.club), ...d.officials.map(o => o.club)])];
    const postsOf = n => d.posts.filter(p => p.club === n), officialsOf = n => d.officials.filter(o => o.club === n);
    const infoOf = n => d.info.find(i => i.club === n) || {};
    const active = names.filter(n => postsOf(n).length), quiet = names.filter(n => !postsOf(n).length);
    const top = active.map(n => [n, postsOf(n).length]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const clubCard = n => {
      const posts = postsOf(n), i = infoOf(n), offs = officialsOf(n), m = d.members[n] || 0;
      return `<section class="of-club"><h3>${esc(n)} <small>${nfmt(posts.length)} ${plural(posts.length, 'activity', 'activities')} · ${nfmt(m)} ${plural(m, 'member', 'members')}</small></h3>
        <p class="of-club-meta">${offs.length ? 'Officials: ' + esc(offs.map(o => o.role + ' – ' + (o.name || o.email)).join(', ')) : 'No officials recorded'}${i.days || i.place ? ' · Meets ' + esc([i.days, i.place].filter(Boolean).join(', ')) : ''}</p>
        ${[1, 2, 3].map(t => {
          const list = posts.filter(p => p.trimester === t);
          return list.length ? `<div class="of-tri">${esc(TRI[t])}</div><div class="of-scroll"><table class="of-table"><thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Attendance</th></tr></thead>
            <tbody>${list.map(p => `<tr><td>${esc(fmtDay(p.date))}</td><td>${esc(TYPE[p.type] || p.type)}</td><td>${esc(p.title || '—')}</td><td>${p.attendees ? nfmt(p.attendees) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '';
        }).join('')}</section>`;
    };
    return `<h2 class="of-print-title">Club activity records, ${esc(String(d.year))}</h2>
      <div class="of-tiles">${tile(active.length + ' of ' + names.length, 'Clubs active')}${tile(d.posts.length, 'Activities posted')}${[1, 2, 3].map(t => tile(d.posts.filter(p => p.trimester === t).length, TRI[t])).join('')}</div>
      ${top.length ? `<div class="of-box"><b>Most active clubs</b><ol>${top.map(([n, c]) => `<li>${esc(n)} <span>${nfmt(c)}</span></li>`).join('')}</ol></div>` : ''}
      ${active.map(clubCard).join('') || `<div class="of-empty">No club activities were posted in ${esc(String(d.year))}.</div>`}
      ${quiet.length ? `<div class="of-box"><b>No activity posted in ${esc(String(d.year))} · ${quiet.length} ${plural(quiet.length, 'club', 'clubs')}</b><p>${quiet.map(n => esc(n) + (officialsOf(n).length ? '' : ' (no officials)')).join(' · ')}</p></div>` : ''}
      <p class="of-note">Activities are what clubs post on the yearbook: notices, events, activities, minutes and photos, by the date they happened. Officials and members are as they are today; the yearbook does not keep their history.</p>`;
  }
  async function exportClubs(btn) {
    btn.disabled = true; btn.textContent = 'Preparing…';
    try {
      const d = await window.gApi('dos.clubs', { year: DOS.year, export: true });
      const offs = n => d.officials.filter(o => o.club === n).map(o => o.role + ' – ' + (o.name || o.email)).join('; ');
      const rows = d.posts.map(p => [p.club, p.date, TRI[p.trimester], TYPE[p.type] || p.type, p.title, p.attendees || '', p.files || '', p.by, offs(p.club), d.members[p.club] || 0]);
      download(`GLUK club records ${d.year}.csv`, ['Club', 'Date', 'Trimester', 'Type', 'Title', 'Attendance', 'Files', 'Posted by', 'Officials (today)', 'Members (today)'], rows);
      showToast('⬇ ' + nfmt(rows.length) + ' ' + plural(rows.length, 'activity', 'activities') + ' exported');
    } catch (e) { showToast('❌ ' + ((e && e.message) || 'Could not export.'), 3500); }
    btn.disabled = false; btn.textContent = '⬇ Export CSV';
  }

  // ══ Directorate of External Affairs: the alumni records (alumni-form.html fills them) ══
  const ALU = { tab: 'records', f: {}, rows: [], total: 0, more: false, withdrawals: 0, year: 0, pending: [], subject: '', msg: '' };
  const INTEREST = { mentorship: 'Mentorship', lectures: 'Guest lectures', internships: 'Internships / jobs', events: 'Events and reunions', fundraising: 'Fundraising', other: 'Other' };
  const WORK = ['Employed', 'Self-employed', 'Unemployed', 'Further studies', 'Internship'];
  const ALU_TABS = [['records', '🎓 Alumni records'], ['pending', '⏳ Not yet filled'], ['withdrawals', '🗑 Withdrawal requests']];
  const formLink = () => location.origin + '/alumni-form.html';
  const reminder = name => `Hello ${String(name || '').trim().split(/\s+/)[0] || ''}, this is GLUK's Directorate of External Affairs. Please fill in your alumni registration form, part of your graduation clearance: ${formLink()}`;
  const mailto = (to, subject, text, bcc) => `mailto:${encodeURIComponent(to || '')}?${bcc ? 'bcc=' + encodeURIComponent(bcc) + '&' : ''}subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(text || '')}`;
  const waHref = (phone, text) => { const l = window.waLink ? window.waLink(phone) : ''; return l ? l + '?text=' + encodeURIComponent(text || '') : ''; };
  const okEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; }
  }
  function paintAlumni() {
    body.innerHTML = `<div class="of-tabs" role="tablist">${ALU_TABS.map(([k, label]) => `<button type="button" role="tab" data-at="${k}" class="${ALU.tab === k ? 'on' : ''}" aria-selected="${ALU.tab === k}">${label}${k === 'withdrawals' && ALU.withdrawals ? ` (${ALU.withdrawals})` : ''}</button>`).join('')}</div>
      <div id="aluPane"></div>`;
    ({ records: paintRecords, pending: paintPending, withdrawals: paintWithdrawals })[ALU.tab]();
  }

  /* — the records — */
  function paintRecords() {
    const f = ALU.f, map = window.DEPT_COURSES_MAP || {}, now = new Date().getFullYear(), yrs = [];
    for (let y = now + 1; y >= 2007; y--) yrs.push(String(y));
    const places = [...(window.KENYA_COUNTIES || []), ...(window.COUNTRIES || []).filter(c => c !== 'Kenya')];
    $('aluPane').innerHTML = `
      <div class="of-filters of-noprint">
        <input type="search" id="alQ" class="form-input" placeholder="Search name, reg number, employer or job" value="${esc(f.q || '')}" autocomplete="off" aria-label="Search">
        <select id="alYear" class="form-select" aria-label="Year of graduation">${options(yrs, f.graduation_year, 'All graduation years')}</select>
        <select id="alProg" class="form-select" aria-label="Programme">${options([...new Set([].concat(...Object.values(map)))].sort(), f.programme, 'All programmes')}</select>
        <select id="alPlace" class="form-select" aria-label="County or country">${options(places, f.residence, 'Anywhere')}</select>
        <select id="alWork" class="form-select" aria-label="Employment status">${options(WORK, f.employment_status, 'Any employment status')}</select>
      </div>
      <div class="of-meta"><span id="alCount">Loading…</span><span style="flex:1"></span>
        ${Object.keys(f).length ? '<button type="button" class="of-link" data-al="clear">Clear filters</button>' : ''}
        <button type="button" class="of-btn" data-al="export">⬇ Export CSV</button></div>
      <details class="of-box of-noprint of-contact"><summary><b>✉️ Contact these alumni</b></summary>
        <p>Write your message once. By email it goes as BCC, so nobody sees anyone else’s address. WhatsApp opens one chat at a time, with your message ready.</p>
        <input id="alSubj" class="form-input" maxlength="120" placeholder="Subject (for email)" value="${esc(ALU.subject)}" aria-label="Subject">
        <textarea id="alMsg" class="form-input" rows="4" maxlength="1500" placeholder="Your message" aria-label="Message">${esc(ALU.msg)}</textarea>
        <div class="of-acts"><button type="button" class="of-btn" data-al="bcc">📋 Copy the BCC email list</button><button type="button" class="of-btn" data-al="mail">✉️ Open in my email app</button></div>
        <p class="of-note">The list is everyone matching the filters above. Each person below also has their own WhatsApp and email buttons.</p>
      </details>
      <div id="alList" class="of-list"></div><div id="alMore"></div>`;
    loadRecords(true);
  }
  async function loadRecords(reset) {
    const seq = ++_seq;
    if (reset) { ALU.rows = []; $('alList').innerHTML = '<div class="of-empty">Loading…</div>'; $('alMore').innerHTML = ''; }
    let r;
    try { r = await window.gApi('alumni.list', { ...ALU.f, from: reset ? 0 : ALU.rows.length }); }
    catch (e) { if (seq === _seq) $('alList').innerHTML = `<div class="of-empty">${esc((e && e.message) || 'Could not load the alumni records.')}</div>`; return; }
    if (seq !== _seq || !$('alList')) return;
    ALU.rows = ALU.rows.concat(r.rows || []); ALU.total = r.total || 0; ALU.more = !!r.more;
    if (r.withdrawals !== ALU.withdrawals) { ALU.withdrawals = r.withdrawals || 0; const t = body.querySelector('[data-at="withdrawals"]'); if (t) t.textContent = '🗑 Withdrawal requests' + (ALU.withdrawals ? ` (${ALU.withdrawals})` : ''); }
    $('alCount').textContent = nfmt(ALU.total) + ' alumni ' + plural(ALU.total, 'record', 'records');
    $('alList').innerHTML = ALU.rows.length ? ALU.rows.map(recordRow).join('') : '<div class="of-empty">No alumni records match.</div>';
    $('alMore').innerHTML = ALU.more ? `<button type="button" class="of-btn wide" data-al="more">Show more (${nfmt(ALU.total - ALU.rows.length)} left)</button>` : '';
  }
  const contactLinks = (i, phone, email) => [phone ? `<a href="tel:${esc(String(phone).replace(/[^\d+]/g, ''))}">${esc(phone)}</a>` : '', email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : ''].filter(Boolean).join(' · ')
    + `<span class="of-acts">${phone && window.waLink && window.waLink(phone) ? `<button type="button" class="of-btn sm" data-al="wa" data-i="${i}">💬 WhatsApp</button>` : ''}${okEmail(email) ? `<button type="button" class="of-btn sm" data-al="em" data-i="${i}">✉️ Email</button>` : ''}</span>`;
  function recordRow(a, i) {
    const work = [a.employment_status, a.job_title, a.employer && 'at ' + a.employer, a.work_location].filter(Boolean).join(' · ');
    const likes = (a.interests || []).map(k => k === 'other' ? a.interest_other : INTEREST[k]).filter(Boolean);
    return `<div class="of-row"><span class="of-av">${esc(initials(a.full_name))}</span>
      <div class="of-row-main"><b>${esc(a.full_name)}</b>${a.withdraw_requested_at ? ' <span class="of-tag">asked to withdraw</span>' : ''}
        <span>${esc([a.reg, a.programme, 'Class of ' + a.graduation_year, a.residence].filter(Boolean).join(' · '))}</span>
        <span>${esc(work)}</span>
        ${likes.length ? `<span>${likes.map(x => `<span class="of-tag">${esc(x)}</span>`).join(' ')}</span>` : ''}
        <span>${contactLinks(i, a.phone, a.email)}</span></div></div>`;
  }
  async function exportRecords(btn) {
    btn.disabled = true; btn.textContent = 'Preparing…';
    try {
      const r = await window.gApi('alumni.list', { ...ALU.f, export: true });
      const idCell = v => /^\d+$/.test(String(v || '')) ? { raw: `="${v}"` } : (v || '');
      const rows = (r.rows || []).map(a => [a.full_name, a.reg, idCell(a.national_id), a.gender, a.dob, phoneCell(a.phone), a.email, a.postal_address, a.residence,
        a.school, a.programme, a.specialization, a.admission_intake, a.admission_year, a.graduation_year, a.study_mode, a.employment_status, a.employer, a.job_title,
        a.work_location, a.further_studies, (a.interests || []).map(k => INTEREST[k]).join('; '), a.interest_other, a.signature_name, String(a.submitted_at || '').slice(0, 10),
        a.withdraw_requested_at ? String(a.withdraw_requested_at).slice(0, 10) : '']);
      download(`GLUK alumni ${today()}.csv`, ['Full name', 'Registration number', 'National ID / Passport No.', 'Gender', 'Date of birth', 'Mobile phone', 'Personal email', 'Postal address',
        'County / country of residence', 'School / faculty', 'Programme of study', 'Specialization / option', 'Intake', 'Year of admission', 'Year of graduation', 'Mode of study',
        'Employment status', 'Organization / employer', 'Job title / position', 'Work location', 'Further studies', 'Areas of interest', 'Other interest', 'Signed as', 'Sent on', 'Asked to withdraw on'], rows);
      showToast('⬇ ' + nfmt(rows.length) + ' alumni ' + plural(rows.length, 'record', 'records') + ' exported');
    } catch (e) { showToast('❌ ' + ((e && e.message) || 'Could not export.'), 3500); }
    btn.disabled = false; btn.textContent = '⬇ Export CSV';
  }
  // Everyone matching the filters, as one BCC list (the api logs it as an email list)
  async function bccList(btn) {
    btn.disabled = true;
    try {
      const r = await window.gApi('alumni.list', { ...ALU.f, export: true, purpose: 'contact' });
      return [...new Set((r.rows || []).map(a => String(a.email || '').trim().toLowerCase()).filter(okEmail))];
    } catch (e) { showToast('❌ ' + ((e && e.message) || 'Could not get the list.'), 3500); return null; }
    finally { btn.disabled = false; }
  }

  /* — not yet filled: a class's yearbook profiles without an alumni record — */
  async function paintPending() {
    if (!ALU.year) ALU.year = window.GRAD_YEAR || new Date().getFullYear();
    const now = new Date().getFullYear(), yrs = [];
    for (let y = now + 1; y >= 2007; y--) yrs.push(y);
    $('aluPane').innerHTML = `<div class="of-meta of-noprint"><label class="of-label">Class of <select id="alPendYear" class="form-select" style="width:auto">${yrs.map(y => `<option${y === ALU.year ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
        <span style="flex:1"></span><button type="button" class="of-btn" data-al="pend-bcc">📋 Copy their emails (BCC)</button></div>
      <div id="alPend"><div class="of-empty">Loading…</div></div>`;
    let r;
    try { r = await window.gApi('alumni.pending', { classyear: String(ALU.year) }); }
    catch (e) { $('alPend').innerHTML = `<div class="of-empty">${esc((e && e.message) || 'Could not load the class.')}</div>`; return; }
    if (!$('alPend')) return;
    ALU.pending = r.rows || [];
    $('alPend').innerHTML = `<div class="of-tiles">${tile(r.total, 'In the yearbook')}${tile(r.filled, 'Filled the form')}${tile(ALU.pending.length, 'Not yet')}</div>
      <p class="of-note">Students of the Class of ${esc(String(r.classyear))} with a yearbook profile who have not sent the alumni form. The reminder buttons fill in a message with the form’s link: ${esc(formLink())}</p>
      <div class="of-list">${ALU.pending.length ? ALU.pending.map((p, i) => `<div class="of-row">${window.safeUrl && window.safeUrl(p.photo_url) ? `<img src="${esc(window.safeUrl(p.photo_url))}" alt="" loading="lazy">` : `<span class="of-av">${esc(initials(p.name))}</span>`}
        <div class="of-row-main"><b>${esc(p.name || 'Unnamed')}</b><span>${esc(p.course || '')}</span>
          <span>${[p.whatsapp && window.waLink && window.waLink(p.whatsapp) ? `<button type="button" class="of-btn sm" data-al="pend-wa" data-i="${i}">💬 Remind on WhatsApp</button>` : '',
            okEmail(p.email) ? `<button type="button" class="of-btn sm" data-al="pend-em" data-i="${i}">✉️ Remind by email</button>` : ''].join('') || 'No contact details on their profile'}</span></div></div>`).join('')
        : '<div class="of-empty">🎉 Everyone in this class has filled the form.</div>'}</div>`;
  }

  /* — withdrawal requests — */
  async function paintWithdrawals() {
    $('aluPane').innerHTML = `<p class="of-note">These alumni asked for their record to be removed (Kenya Data Protection Act, 2019). Remove it once you have dealt with it; the removal is written in the audit log.</p><div id="alWd" class="of-list"><div class="of-empty">Loading…</div></div>`;
    let r;
    try { r = await window.gApi('alumni.list', { withdrawals: true }); }
    catch (e) { $('alWd').innerHTML = `<div class="of-empty">${esc((e && e.message) || 'Could not load the requests.')}</div>`; return; }
    if (!$('alWd')) return;
    ALU.withdrawals = (r.rows || []).length;
    $('alWd').innerHTML = (r.rows || []).length ? r.rows.map(a => `<div class="of-row"><span class="of-av">${esc(initials(a.full_name))}</span>
      <div class="of-row-main"><b>${esc(a.full_name)}</b><span>${esc([a.reg, a.programme, 'Class of ' + a.graduation_year].join(' · '))}</span>
        <span>Asked on ${esc(fmtDay(a.withdraw_requested_at))}${a.withdraw_reason ? ': “' + esc(a.withdraw_reason) + '”' : ''}</span>
        <span><button type="button" class="of-btn sm" data-al="remove" data-id="${Number(a.id)}" data-name="${esc(a.full_name)}">🗑 Remove the record</button></span></div></div>`).join('')
      : '<div class="of-empty">No requests. 👍</div>';
  }

  // ══ The page: which office, and its dashboard ══
  function paint() {
    seg.hidden = offices.length < 2;
    seg.innerHTML = offices.map(o => `<button type="button" role="tab" aria-selected="${o === cur}" class="${o === cur ? 'on' : ''}" data-o="${esc(o)}">${esc(NAMES[o] || o)}</button>`).join('');
    $('ofTitle').textContent = NAMES[cur] || 'Office dashboard';
    $('ofSub').textContent = 'Your office’s dashboard on the GLUK Yearbook. Every list you open and every export is recorded in an audit log the yearbook’s admin can read.';
    if (cur === 'dos') paintDos(); else paintAlumni();
  }
  seg.addEventListener('click', e => {
    const b = e.target.closest('[data-o]'); if (!b) return;
    cur = b.dataset.o; try { sessionStorage.setItem('gluk-office-tab', cur); } catch (er) {}
    paint();
  });
  body.addEventListener('click', async e => {
    const b = e.target.closest('[data-dt],[data-ds],[data-dc],[data-at],[data-al]'); if (!b) return;
    if (b.dataset.at) { ALU.tab = b.dataset.at; paintAlumni(); return; }
    if (b.dataset.al) { alumniClick(b); return; }
    if (b.dataset.dt) { DOS.tab = b.dataset.dt; paintDos(); }
    else if (b.dataset.ds === 'more') loadStudents(false);
    else if (b.dataset.ds === 'export') exportStudents(b);
    else if (b.dataset.ds === 'clear') { DOS.f = {}; paintStudents(); }
    else if (b.dataset.dc === 'print') window.print();
    else if (b.dataset.dc === 'export') exportClubs(b);
  });
  async function alumniClick(b) {
    const act = b.dataset.al, i = Number(b.dataset.i), a = ALU.rows[i], p = ALU.pending[i];
    const first = n => String(n || '').trim().split(/\s+/)[0] || '';
    const open = url => { if (url) window.open(url, '_blank', 'noopener'); };
    if (act === 'clear') { ALU.f = {}; paintRecords(); }
    else if (act === 'more') loadRecords(false);
    else if (act === 'export') exportRecords(b);
    else if (act === 'bcc' || act === 'mail') {
      const list = await bccList(b); if (!list) return;
      if (!list.length) { showToast('Nobody matching the filters has an email address.'); return; }
      const url = mailto('', ALU.subject, ALU.msg, list.join(','));
      if (act === 'mail' && url.length <= 1900) { location.href = url; return; }
      const ok = await copy(list.join(', '));
      showToast(ok ? `📋 ${list.length} ${plural(list.length, 'email', 'emails')} copied${act === 'mail' ? ' (too many for an email link)' : ''}. Paste them into the BCC box of a new email.` : 'Could not copy the list.', 5000);
    }
    else if (act === 'wa' && a) open(waHref(a.phone, ALU.msg || `Hello ${first(a.full_name)},`));
    else if (act === 'em' && a) location.href = mailto(a.email, ALU.subject, ALU.msg);
    else if (act === 'pend-wa' && p) open(waHref(p.whatsapp, reminder(p.name)));
    else if (act === 'pend-em' && p) location.href = mailto(p.email, 'Your GLUK alumni registration form', reminder(p.name));
    else if (act === 'pend-bcc') {
      const list = [...new Set(ALU.pending.map(x => String(x.email || '').trim().toLowerCase()).filter(okEmail))];
      if (!list.length) { showToast('Nobody in this list has an email address.'); return; }
      showToast(await copy(list.join(', ')) ? `📋 ${list.length} ${plural(list.length, 'email', 'emails')} copied. Paste them into BCC, with the form’s link: ${formLink()}` : 'Could not copy the list.', 6000);
    }
    else if (act === 'remove') {
      if (!confirm(`Remove the alumni record of ${b.dataset.name}? It cannot be undone.`)) return;
      b.disabled = true;
      try { await window.gApi('alumni.remove', { id: Number(b.dataset.id) }); showToast('🗑 Removed'); paintWithdrawals(); }
      catch (er) { showToast('❌ ' + ((er && er.message) || 'Could not remove it.'), 3500); b.disabled = false; }
    }
  }
  const ALU_FILTER = { alYear: 'graduation_year', alProg: 'programme', alPlace: 'residence', alWork: 'employment_status' };
  const FILTER = { dsDept: 'dept', dsCourse: 'course', dsYear: 'classyear', dsCounty: 'county', dsClub: 'club' };
  body.addEventListener('change', e => {
    const t = e.target;
    if (FILTER[t.id]) {
      if (t.value) DOS.f[FILTER[t.id]] = t.value; else delete DOS.f[FILTER[t.id]];
      if (t.id === 'dsDept') delete DOS.f.course;              // the programmes follow the school
      paintStudents();
    } else if (t.id === 'dcYear') { DOS.year = Number(t.value); paintClubs(); }
    else if (ALU_FILTER[t.id]) { if (t.value) ALU.f[ALU_FILTER[t.id]] = t.value; else delete ALU.f[ALU_FILTER[t.id]]; paintRecords(); }
    else if (t.id === 'alPendYear') { ALU.year = Number(t.value); paintPending(); }
  });
  body.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'alSubj') ALU.subject = t.value;
    else if (t.id === 'alMsg') ALU.msg = t.value;
    if (t.id !== 'dsQ' && t.id !== 'alQ') return;
    clearTimeout(_typing);
    _typing = setTimeout(() => {
      const q = t.value.trim(), f = t.id === 'dsQ' ? DOS.f : ALU.f;
      if (q) f.q = q; else delete f.q;
      if (t.id === 'dsQ') loadStudents(true); else loadRecords(true);
    }, 350);
  });

  auth.onAuthStateChanged(async u => {
    if (!u) {
      seg.hidden = true;
      card(`<div class="of-ico">🔐</div><h2>Sign in</h2><p>This page is for the university offices that use the yearbook. Sign in with the email the yearbook’s admin added for your office.</p>
        <button type="button" class="btn-primary" onclick="openAuthModal(null,'login')">Sign in</button>`);
      return;
    }
    if (!u.emailVerified) {
      card(`<div class="of-ico">✉️</div><h2>Verify your email first</h2><p>For your office’s safety, the dashboard opens only for a verified email. Open the link we sent to ${esc(u.email || 'your email')}, then come back here.</p>`);
      return;
    }
    try { const me = await window.gApi('office.me', {}); offices = me.offices || []; perms = me.perms || []; }
    catch (e) { card(`<p>${esc((e && e.message) || 'Could not check your office. Please try again.')}</p>`); return; }
    if (!offices.length) {
      card(`<div class="of-ico">🏛</div><h2>No office dashboard for this account</h2><p>This page is for the university’s offices. If your office should have one, ask the yearbook’s admin to add ${esc(u.email || 'your email')}.</p>`);
      return;
    }
    let saved = ''; try { saved = sessionStorage.getItem('gluk-office-tab') || ''; } catch (e) {}
    cur = offices.includes(saved) ? saved : offices[0];
    paint();
  });
})();
