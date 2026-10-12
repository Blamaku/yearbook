// =====================================================
//  GLUK YEARBOOK 2026 — TIME CAPSULE  (capsule.html)
//
//  • Any student with a yearbook profile seals notes (and a photo) to their future self.
//  • They open on their own class's graduation day, once the admin has posted it (admin ›
//    Moderation › Grad days). Until then only the dates they were sealed show, even to the writer.
//  • The server (api: capsule.*) decides what is open; the class comes from the profile.
// =====================================================
(function () {
  'use strict';
  const MAX = 4000;
  const $ = id => document.getElementById(id);
  const E = s => window.escHtml(s == null ? '' : String(s));
  const plural = (n, one, many) => n === 1 ? one : many;
  const day = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const bigDay = iso => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' });
  const para = s => E(s).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');

  let user = null, data = null, unavailable = '', photo = null, busy = false, run = 0;

  function paint() {
    const box = $('cpMine');
    $('write').hidden = !(user && data && data.hasProfile);
    if (!user) {
      box.innerHTML = `<div class="lt-quiet">Sign in to start your time capsule.</div><button type="button" class="lt-btn" data-act="signin">Sign in</button>`;
      return;
    }
    if (unavailable) { box.innerHTML = `<div class="lt-quiet">${E(unavailable)}</div>`; return; }
    if (!data) { box.innerHTML = '<div class="lt-quiet">Loading…</div>'; return; }
    if (!data.hasProfile) {
      box.innerHTML = `<div class="lt-quiet">Create your yearbook profile first, so we know which class you graduate with.</div>
        <a class="lt-btn" href="profiles.html?action=add">Create my profile</a>`;
      return;
    }
    const n = data.capsules.length, days = data.opensAt ? Math.max(0, Math.ceil((Date.parse(data.opensAt) - Date.now()) / 864e5)) : null;
    $('cpPlace').textContent = data.open ? 'Your graduation day has come. Open your time capsule. 🎓'
      : data.opensAt ? `Class of ${data.classyear}: it opens on ${bigDay(data.opensAt)}, in ${days} ${plural(days, 'day', 'days')}.`
      : `Class of ${data.classyear || '…'}: it opens on your graduation day, once the admin posts it.`;
    if (data.open) {
      box.innerHTML = n ? `<div class="lt-sub">${n} ${plural(n, 'note', 'notes')} from your past self.</div>` + data.capsules.map(c => `<details class="lt-env-card">
          <summary><i aria-hidden="true">📦</i><span><b>Sealed on ${E(day(c.created_at))}</b><small>From your past self</small></span></summary>
          <div class="lt-paper">${c.photo_url ? `<img class="cp-img" src="${E(c.photo_url)}" alt="Your photo from then" loading="lazy">` : ''}<p>${para(c.body)}</p></div>
        </details>`).join('')
        : '<div class="lt-quiet">Your capsule is empty. Write a note to the person you will be next.</div>';
      return;
    }
    box.innerHTML = n
      ? `<div class="lt-sealed"><div class="lt-stack" aria-hidden="true">${'<i>📦</i>'.repeat(Math.min(n, 5))}</div>
          <div><b>${n} sealed ${plural(n, 'note', 'notes')}</b><span>Not even you can read them until your graduation day.</span></div></div>
        <ul class="cp-list">${data.capsules.map(c => `<li>📦 Sealed on ${E(day(c.created_at))}${c.has_photo ? ' · with a photo' : ''}
          <button type="button" class="lt-report" data-act="delete" data-id="${Number(c.id)}">Delete</button></li>`).join('')}</ul>`
      : '<div class="lt-quiet">Nothing sealed yet. Write your first note below.</div>';
  }
  function paintPhoto() {
    $('cpPhoto').innerHTML = photo
      ? `<img class="cp-img" src="${E(photo.preview)}" alt="The photo you chose"><button type="button" class="lt-btn ghost" data-act="nophoto">Remove the photo</button>`
      : '<button type="button" class="lt-btn ghost" data-act="photo">📷 Add a photo (optional)</button>';
  }

  async function load(u) {
    const mine = ++run;
    user = u || null; data = null; unavailable = '';
    paint();
    if (user) {
      try { data = await window.gApi('capsule.mine', {}); }
      catch (e) {
        console.warn('[capsule.mine]', e);
        unavailable = e.code === 'capsule_coming' || e.code === 'unknown_action' || e.unreachable
          ? 'The time capsule is being switched on. Please check back soon.' : (e.message || 'Could not load your capsule.');
      }
    }
    if (mine === run) paint();
  }

  async function send() {
    const body = $('cpBody').value.trim();
    if (!body) { window.showToast('Write something to your future self first.'); return; }
    busy = true; $('cpSend').disabled = true; $('cpSend').textContent = 'Sealing…';
    try {
      const url = photo ? await uploadPhoto(photo.blob, user.uid, 'capsule') : null;
      const r = await window.gApi('capsule.save', { body, photo_url: url });
      data.capsules.push(data.open ? { id: r.capsule.id, body, photo_url: url, created_at: r.capsule.created_at } : r.capsule);
      $('cpBody').value = ''; $('cpChars').textContent = `0 / ${MAX}`; photo = null; paintPhoto();
      try { sessionStorage.removeItem('gluk-capsule-draft'); } catch (e) {}
      window.showToast('Sealed 📦 See you on graduation day', 3500);
      paint();
    } catch (e) { console.warn('[capsule.save]', e); window.showToast(e.message || 'Could not seal it.'); }
    busy = false; $('cpSend').disabled = false; $('cpSend').textContent = 'Seal it 📦';
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b || busy) return;
    const act = b.dataset.act;
    if (act === 'signin') window.openAuthModal(() => {}, 'login');
    else if (act === 'photo') { $('cpFile').value = ''; $('cpFile').click(); }
    else if (act === 'nophoto') { photo = null; paintPhoto(); }
    else if (act === 'delete') {
      if (!confirm('Delete this sealed note? It cannot be undone.')) return;
      try { await window.gApi('capsule.delete', { id: Number(b.dataset.id) }); data.capsules = data.capsules.filter(c => Number(c.id) !== Number(b.dataset.id)); paint(); window.showToast('Deleted'); }
      catch (er) { window.showToast(er.message || 'Could not delete it.'); }
    }
  });
  $('cpFile').addEventListener('change', () => {
    const f = $('cpFile').files[0];
    if (!f || !/^image\//.test(f.type)) return;
    const rd = new FileReader();
    rd.onload = async () => { photo = await compressImage(rd.result, 1200, 0.8); paintPhoto(); };
    rd.readAsDataURL(f);
  });
  $('cpSend').addEventListener('click', send);
  $('cpBody').addEventListener('input', () => {
    $('cpChars').textContent = `${$('cpBody').value.length} / ${MAX}`;
    try { sessionStorage.setItem('gluk-capsule-draft', $('cpBody').value); } catch (e) {}
  });

  try { $('cpBody').value = sessionStorage.getItem('gluk-capsule-draft') || ''; } catch (e) {}
  $('cpChars').textContent = `${$('cpBody').value.length} / ${MAX}`;
  paint(); paintPhoto();
  auth.onAuthStateChanged(u => { load(u); });
})();
