// =====================================================
//  GLUK YEARBOOK 2026 — GRADUATION WEEK  (grad.html, and the Home card)
//
//  Seven days, 15–21 November 2026: one theme a day, each opening at 00:00 in Kisumu.
//  window.GLUK_GRADWEEK holds the days; Home uses it for its card, grad.html for the timeline.
//  The days that collect something (letters, votes, Glow Up …) say how to get ready before they open.
// =====================================================
(function () {
  'use strict';
  const DAY = 864e5;
  const START = Date.parse('2026-11-14T21:00:00Z');        // Sunday 15 November 2026, 00:00 in Kisumu
  const DAYS = [
    { key: 'unsealed', emoji: '💌', title: 'Unsealed',
      line: 'Every sealed letter opens, and the class superlative winners are revealed.',
      prep: 'Write your letters and cast your votes before Sunday.',
      links: [['💌 Letters', 'letters.html'], ['🏆 Superlatives', 'superlatives.html']] },
    { key: 'glowup', emoji: '✨', title: 'Glow Up',
      line: 'First year vs now. Drag the slider across the whole class’s glow-ups.',
      prep: 'Add your Then vs Now photos. They stay sealed until Monday.',
      links: [['✨ Glow Up', 'glowup.html']] },
    { key: 'timemachine', emoji: '⏳', title: 'Time Machine',
      line: 'Memory Lane 2022 → 2026: a chapter for every year, told by the class.' },
    { key: 'mypeople', emoji: '🫂', title: 'My People',
      line: 'Tag your best friend, study partner, mentor and chaos partner.' },
    { key: 'soundtrack', emoji: '🎧', title: 'Soundtrack & Inside Jokes',
      line: 'The class playlist, and the things only the Class of 2026 understands.' },
    { key: 'torch', emoji: '🔥', title: 'Pass the Torch',
      line: 'One piece of advice for the freshers, and the final course battle.',
      prep: 'Play your course’s quiz so your course leads the battle.',
      links: [['🏆 Course battle', 'challenge.html#battle']] },
    { key: 'bigday', emoji: '🎓', title: 'The Big Day',
      line: 'Graduation Day. The whole yearbook turns gold. We came as students. We leave as graduates.' },
  ];
  const dayStart = i => START + i * DAY;
  // -1 before the week, 0–6 during it, 7 after it
  const today = (now = Date.now()) => now < START ? -1 : Math.min(7, Math.floor((now - START) / DAY));
  const label = (i, opts) => new Date(dayStart(i) + 12 * 3600e3).toLocaleDateString('en-GB',
    Object.assign({ weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' }, opts || {}));
  window.GLUK_GRADWEEK = { START, DAYS, dayStart, today, label };

  // ── grad.html ──
  const box = document.getElementById('gwDays');
  if (!box) return;
  const $ = id => document.getElementById(id);
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => n === 1 ? one : many;
  let painted = -2;

  function paint() {
    const t = today();
    if (t !== painted) {
      painted = t;
      box.innerHTML = DAYS.map((d, i) => {
        const state = i < t ? 'done' : i === t ? 'now' : 'soon';
        const pill = state === 'now' ? '<span class="gw-pill now">Today</span>'
          : state === 'done' ? '<span class="gw-pill">Opened</span>' : `<span class="gw-pill">Opens ${E(label(i, { day: undefined, month: undefined }))}</span>`;
        const links = (d.links || []).map(([txt, href]) => `<a class="gw-go" href="${E(href)}">${E(txt)}</a>`).join('');
        const ready = state === 'soon'
          ? (d.prep ? `<p class="gw-prep"><b>Get ready:</b> ${E(d.prep)}</p>` : '<p class="gw-prep muted">Coming soon. Keep an eye on this page.</p>') : '';
        return `<li class="gw-day ${state}" id="day-${d.key}">
          <div class="gw-date"><b>${E(label(i, { weekday: 'short', day: undefined, month: undefined }))}</b><span>${new Date(dayStart(i) + 12 * 3600e3).getUTCDate()}</span></div>
          <div class="gw-card">
            <div class="gw-top"><span class="gw-emo" aria-hidden="true">${d.emoji}</span><div class="gw-tt"><small>Day ${i + 1}</small><h3>${E(d.title)}</h3></div>${pill}</div>
            <p class="gw-line">${E(d.line)}</p>${ready}
            ${links && (state !== 'soon' || d.prep) ? `<div class="gw-links">${links}</div>` : ''}
          </div></li>`;
      }).join('');
      $('gwPlace').textContent = t < 0 ? 'Seven days, seven surprises. Each morning something new opens.'
        : t < 7 ? `Day ${t + 1} of 7 · ${DAYS[t].emoji} ${DAYS[t].title} is open today.`
        : 'Thank you, Class of 2026. We came as students. We leave as graduates. 🎓';
      document.body.classList.toggle('gw-live', t >= 0 && t < 7);
    }
    // the countdown to the next day that opens
    const next = t < 6 ? t + 1 : -1, cd = $('gwNext');
    if (next < 0 || t >= 7) { cd.hidden = true; return; }
    const ms = Math.max(0, dayStart(next) - Date.now());
    const dd = Math.floor(ms / DAY), hh = Math.floor(ms % DAY / 3600e3), mm = Math.floor(ms % 3600e3 / 60e3), ss = Math.floor(ms % 60e3 / 1e3);
    cd.hidden = false;
    $('gwNextT').textContent = `${DAYS[next].emoji} ${DAYS[next].title} opens in`;
    $('gwNextN').textContent = dd ? `${dd} ${plural(dd, 'day', 'days')} ${hh} h ${mm} min` : `${hh} h ${mm} min ${String(ss).padStart(2, '0')} s`;
  }
  paint();
  setInterval(paint, 1000);
  if (location.hash) setTimeout(() => { const el = document.querySelector(location.hash); if (el) el.scrollIntoView({ block: 'center' }); }, 200);

  $('gwShare').addEventListener('click', async () => {
    const url = location.origin + '/grad.html', text = 'Graduation week for the GLUK Class of 2026: seven days, 15–21 November 🎓';
    if (navigator.share) { try { await navigator.share({ title: 'GLUK graduation week', text, url }); } catch (e) {} }
    else { try { await navigator.clipboard.writeText(text + ' ' + url); window.showToast('Link copied. Paste it in your class group 🎓'); } catch (e) { prompt('Copy this link:', url); } }
  });
})();
