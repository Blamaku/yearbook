// =====================================================
//  GLUK YEARBOOK 2026 — THE FINAL REEL  (reel.html)
//
//  An opening card, then every Class of 2026 graduate with a photo (about 1.6 s each, in a fixed shuffled
//  order), then the last card: "We came as students. We leave as graduates." Tap to pause; skip to the end.
//  Plays from graduation day (21 Nov, 00:00 Kisumu); ?preview=1 plays it earlier. Everything is public
//  (profiles_public); anonymous profiles and profiles without a photo are left out.
// =====================================================
(function () {
  'use strict';
  const OPEN_AT = Date.parse('2026-11-20T21:00:00Z');
  const PER = 1600, CARD = 3200;
  const $ = id => document.getElementById(id);
  const E = s => window.escHtml(s == null ? '' : String(s));
  const stage = $('rlStage');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const preview = /[?&]preview=1/.test(location.search);

  if (!preview && Date.now() < OPEN_AT) {
    const days = Math.ceil((OPEN_AT - Date.now()) / 864e5);
    stage.innerHTML = `<div class="rl-card"><img src="logo.png" alt="" width="120"><h1>The final reel</h1>
      <p>It plays on graduation day, Saturday 21 November, in ${days} ${days === 1 ? 'day' : 'days'}.</p>
      <p class="rl-small">Every graduate of the Class of 2026 with a photo on their profile is in it. <a href="profiles.html?action=add">Add yours</a>.</p></div>`;
    return;
  }

  // the same order for everyone (as on Home's Faces of 2026)
  const seeded = (a, seed) => { let s = seed >>> 0; const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let slides = [], i = 0, timer = null, paused = false, started = 0, left = 0;
  const last = () => `<div class="rl-card rl-end"><img src="logo.png" alt="" width="132">
      <h1>We came as students.<br>We leave as graduates.</h1><p>Congratulations, Class of 2026 🎓</p>
      <div class="rl-acts"><button type="button" class="ku-play" id="rlAgain">▶ Play again</button><button type="button" class="ku-meet" id="rlShare">Share</button></div></div>`;
  function show(n) {
    i = n; clearTimeout(timer);
    const s = slides[i];
    stage.innerHTML = s.html;
    $('rlBar').style.width = `${Math.round((i + 1) / slides.length * 100)}%`;
    $('rlCtl').hidden = i === slides.length - 1;
    if (i === slides.length - 1) {
      $('rlAgain').onclick = () => show(0);
      $('rlShare').onclick = async () => {
        const url = location.origin + '/reel.html', text = 'We came as students. We leave as graduates. 🎓 The GLUK Class of 2026 final reel';
        if (navigator.share) { try { await navigator.share({ title: 'The final reel', text, url }); } catch (e) {} }
        else { try { await navigator.clipboard.writeText(text + ' ' + url); window.showToast('Link copied 🎓'); } catch (e) { prompt('Copy this link:', url); } }
      };
      return;
    }
    for (const n of [i + 1, i + 2, i + 3]) if (slides[n] && slides[n].img) { const im = new Image(); im.src = slides[n].img; }
    left = s.ms; started = Date.now();
    if (!paused) timer = setTimeout(() => show(i + 1), left);
  }
  function pause(on) {
    paused = on; $('rlPause').textContent = on ? '▶' : '❚❚'; $('rlPause').setAttribute('aria-label', on ? 'Play' : 'Pause');
    if (on) { clearTimeout(timer); left = Math.max(300, left - (Date.now() - started)); stage.classList.add('paused'); }
    else { stage.classList.remove('paused'); started = Date.now(); timer = setTimeout(() => show(i + 1), left); }
  }
  $('rlPause').addEventListener('click', () => pause(!paused));
  $('rlSkip').addEventListener('click', () => { paused = false; show(slides.length - 1); });
  stage.addEventListener('click', e => { if (!e.target.closest('button, a') && i < slides.length - 1) pause(!paused); });

  (async () => {
    stage.innerHTML = '<div class="rl-card"><p>Loading the Class of 2026…</p></div>';
    const { data, error } = await supabase.from('profiles_public').select('id,name,course,photo_url,photos')
      .eq('classyear', '2026').eq('isanonymous', false).not('photo_url', 'is', null).neq('photo_url', '').order('id').limit(1000);
    const people = seeded((data || []).map(p => ({ ...p, img: window.safeUrl(normalizePhotos(p.photos, p.photo_url)[0] || '') })).filter(p => p.img), 2026);
    if (error) console.error('[reel] could not load the graduates', error);
    slides = [{ ms: CARD, html: `<div class="rl-card"><img src="logo.png" alt="" width="120"><p class="rl-k">Great Lakes University of Kisumu</p><h1>The Class of 2026</h1><p>${people.length ? people.length + ' graduates. One last time.' : 'One last time.'}</p></div>` }]
      .concat(people.map(p => ({ ms: PER, img: p.img, html: `<figure class="rl-face${still ? ' still' : ''}"><img src="${E(p.img)}" alt=""><figcaption><b>${E(p.name)}</b><span>${E(p.course || '')}</span></figcaption></figure>` })))
      .concat([{ ms: 0, html: last() }]);
    show(0);
  })();
})();
