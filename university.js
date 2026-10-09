// =====================================================
//  GLUK YEARBOOK 2026 — KNOW YOUR UNIVERSITY (university.html)
//
//  Who runs GLUK, as a chart you can tap, and "Who's who?", a 10-question quiz.
//  Names, titles and photos come from gluk.ac.ke › About › Governance, as listed on
//  9 October 2026 (photos are copies in img/leaders/). When the university changes its
//  leadership, edit PEOPLE and GROUPS below; nothing else needs to change.
// =====================================================
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = s => window.escHtml(s);
  const SITE = 'https://www.gluk.ac.ke/';

  // What each office does (short, plain summaries)
  const OFFICE = {
    chancellor: 'The head of the university. The Chancellor presides over graduation and confers degrees.',
    bot: 'Holds the university in trust for its founders and safeguards its mission.',
    council: 'The governing body of the university. It sets policy, approves plans and budgets, and oversees the management. The Vice Chancellor is its secretary.',
    vc: 'The chief executive and academic head of GLUK. The Vice Chancellor runs the university day to day and leads the University Management Board.',
    dvcfap: 'Oversees finance, administration, staff and the university’s property, and guides planning under the 2023–2027 strategic plan.',
    dvcasar: 'Leads the academic side of GLUK: the academic programmes, student affairs and research.',
    umb: 'The senior team that runs the university day to day, led by the Vice Chancellor.',
  };

  // photo: the file in img/leaders/ (none: initials are shown). short: the office in a sentence or a quiz answer.
  // uniq: nobody else holds this office (so the quiz can ask "Who is the …?"). key: comes up in most quiz rounds.
  const PEOPLE = [
    { id: 'nyongo', name: "Prof. Peter Anyang' Nyong'o", photo: true, role: 'Chancellor', short: 'Chancellor', desc: OFFICE.chancellor,
      creds: 'FAAS, EGH · BA (Makerere), MA, PhD (Chicago)', page: 'chancellor/', uniq: true, key: true },
    { id: 'miseda', name: 'Prof. Hazel Miseda-Mumbo', photo: true, role: 'Vice Chancellor', short: 'Vice Chancellor', desc: OFFICE.vc,
      also: 'Secretary to the Governing Council', page: 'vice-chancellor/', uniq: true, key: true },
    { id: 'mwayuli', name: 'Prof. Genevieve Mwayuli', photo: true, role: 'Deputy Vice Chancellor, Finance, Administration and Planning',
      short: 'Deputy Vice Chancellor for Finance, Administration and Planning', desc: OFFICE.dvcfap, page: 'dvc-fap/', uniq: true, key: true },
    { id: 'wafula', name: 'Prof. Charles Wafula', photo: true, role: 'Deputy Vice Chancellor, Academic, Student Affairs and Research',
      short: 'Deputy Vice Chancellor for Academic, Student Affairs and Research', desc: OFFICE.dvcasar, page: 'dvc-aar/', uniq: true, key: true },

    // Board of Trustees
    { id: 'kodia', name: 'The Right Rev. Prof. David Kodia', photo: true, role: 'Chairman, Board of Trustees', short: 'Chairman of the Board of Trustees',
      desc: OFFICE.bot, creds: 'M.Th (UK), PhD (NCU)', page: 'board-of-trustees/', uniq: true, key: true },
    { id: 'gokoth', name: 'George Okoth', role: 'Member, Board of Trustees', desc: OFFICE.bot, page: 'board-of-trustees/' },
    { id: 'owiti', name: 'Helen Owiti', role: 'Member, Board of Trustees', desc: OFFICE.bot, page: 'board-of-trustees/' },
    { id: 'sime', name: 'Canon, CPA, Maurice Ochola Sime', role: 'Member, Board of Trustees', desc: OFFICE.bot, page: 'board-of-trustees/' },
    { id: 'omanga', name: 'Dr. Eunice Omanga', role: 'Member, Board of Trustees', desc: OFFICE.bot, page: 'board-of-trustees/' },
    { id: 'ambitho', name: 'Ms. Angela Ambitho', role: 'Member, Board of Trustees', desc: OFFICE.bot, page: 'board-of-trustees/' },

    // Governing Council (the Vice Chancellor is its secretary)
    { id: 'orege', name: 'Eng. Carey Orege', photo: true, role: 'Chairperson, Governing Council', short: 'Chairperson of the Governing Council',
      desc: OFFICE.council, page: 'governing-council/', uniq: true, key: true },
    ...[['ogara', 'Prof. William Otiende Ogara'], ['rasawo', 'Prof. Joseph O. Rasawo'], ['oyaya', 'Dr. Charles Oyaya'],
      ['some', 'Prof. Eng. David Kimutai Some'], ['kuria', 'Ms. Jane W. Kuria'], ['angira', 'Dr. Charles Angira'],
      ['okwang', 'Ms. Cynthia Okwang'], ['farah', 'Eng. Farah Mohammed'], ['dotieno', 'Mr. David Otieno']]
      .map(([id, name]) => ({ id, name, photo: true, role: 'Member, Governing Council', is: 'sits on the Governing Council', desc: OFFICE.council, page: 'governing-council/' })),

    // University Management Board (with the Vice Chancellor and both deputies)
    ...[
      ['ochola', 'Dr. Penina Ochola', 'Principal, College of Health Sciences', 'Principal of the College of Health Sciences', 'Leads the College of Health Sciences.'],
      ['onyango', 'Dr. Ezekiel Nyangia Onyango', 'Registrar, Administration', 'Registrar (Administration)', 'Heads the university’s administration.', true],
      ['nandi', 'Dr. Pamela Nandi', 'Registrar, Academics', 'Registrar (Academics)', 'Heads the academic registry: admissions, student records and examinations.', true],
      ['oria', 'Mr. Kevin Oria', 'Academic Standards & Compliance Officer', 'Academic Standards & Compliance Officer', 'Makes sure GLUK’s programmes meet academic standards and regulations.'],
      ['kojwang', "Mr. Richard Ogada Kojwang'", 'Finance Manager', 'Finance Manager', 'Manages the university’s money, fees included.'],
      ['ochiel', 'Bishop James Ochiel', 'Director, External Affairs', 'Director of External Affairs', 'Looks after GLUK’s partnerships and relations beyond the campus.'],
      ['cotieno', 'Dr. Careena Otieno', 'Director, Centre of Research and Innovation', 'Director of the Centre of Research and Innovation', 'Leads research and innovation at GLUK.'],
      ['okayo', 'Dr. Joyce Okayo', 'Director, Quality Assurance', 'Director of Quality Assurance', 'Checks and improves the quality of teaching and services.'],
      ['assefa', 'Mrs. Mekdes Assefa', 'Dean of Students', 'Dean of Students', 'Looks after student welfare and student life: the office to go to with student matters.', true],
      ['lubeka', 'Dr. Agrippina Buyanzi Lubeka', 'Director, Nairobi Campus', 'Director of the Nairobi Campus', 'Leads GLUK’s Nairobi campus.'],
      ['osoo', 'Mr. Dan Osoo', 'University Librarian', 'University Librarian', 'Runs the university library.'],
      ['atieno', 'Mrs. Mary Anne Atieno', 'Human Resource Officer', 'Human Resource Officer', 'Handles staff recruitment and welfare.'],
      ['nyapada', 'Ms. Grace Nyapada', 'Procurement Officer', 'Procurement Officer', 'Buys the goods and services the university needs.'],
      ['obiero', 'Ms. Florence Obiero', 'Internal Audit', 'Internal Audit', 'Checks the university’s accounts and controls independently.'],
    ].map(([id, name, role, short, desc, key]) => ({ id, name, photo: true, role, short, desc, page: 'university-management-board/', uniq: true, key: !!key,
      ...(id === 'obiero' ? { ask: 'Who works in Internal Audit?', is: 'works in Internal Audit' } : {}) })),
  ];
  const byId = Object.fromEntries(PEOPLE.map(p => [p.id, p]));

  const GROUPS = {
    bot:     { name: 'Board of Trustees', ids: ['kodia', 'gokoth', 'owiti', 'sime', 'omanga', 'ambitho'], page: 'board-of-trustees/', color: '#7c3aed' },
    council: { name: 'Governing Council', ids: ['orege', 'miseda', 'ogara', 'rasawo', 'oyaya', 'some', 'kuria', 'angira', 'okwang', 'farah', 'dotieno'], page: 'governing-council/', color: '#0f766e' },
    umb:     { name: 'University Management Board', ids: ['miseda', 'mwayuli', 'wafula', 'ochola', 'onyango', 'nandi', 'oria', 'kojwang', 'ochiel', 'cotieno', 'okayo', 'assefa', 'lubeka', 'osoo', 'atieno', 'nyapada', 'obiero'], page: 'university-management-board/', color: '#1d4ed8' },
  };
  const COLOR = { nyongo: '#b45309', miseda: '#0f4c81', mwayuli: '#0e7490', wafula: '#0e7490' };
  const colorOf = p => COLOR[p.id] || (GROUPS.bot.ids.includes(p.id) ? GROUPS.bot.color : GROUPS.umb.ids.includes(p.id) ? GROUPS.umb.color : GROUPS.council.color);
  const groupsOf = p => Object.values(GROUPS).filter(g => g.ids.includes(p.id));
  const isText = p => p.is || 'is the ' + (p.short || p.role);

  // A round face, or initials when there is no photo
  const ini = n => n.replace(/^(The |Right |Rev\.|Prof\.|Dr\.|Eng\.|Mr\.|Mrs\.|Ms\.|Bishop |Canon, |CPA, |\s)+/g, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const face = (p, cls = '') => p.photo
    ? `<span class="ku-face ${cls}" style="background-image:url('img/leaders/${p.id}.jpg')" aria-hidden="true"></span>`
    : `<span class="ku-face ini ${cls}" aria-hidden="true">${E(ini(p.name))}</span>`;

  /* ── The chart ─────────────────────────────────── */
  const big = (p, label) => `<button type="button" class="ku-big" data-who="${p.id}" style="--kc:${colorOf(p)}">
      ${face(p, 'xl')}<span class="ku-role">${E(label)}</span><span class="ku-name">${E(p.name)}</span><span class="ku-tap">What the office does ›</span></button>`;
  const mid = (p, label) => `<button type="button" class="ku-mid" data-who="${p.id}" style="--kc:${colorOf(p)}">
      ${face(p, 'lg')}<span class="ku-role">${E(label)}</span><span class="ku-name">${E(p.name)}</span></button>`;
  const small = p => `<button type="button" class="ku-p" data-who="${p.id}" style="--kc:${colorOf(p)}">
      ${face(p)}<b>${E(p.name)}</b><small>${E(p.role.replace(/^Member, .*/, 'Member'))}</small></button>`;
  function groupTile(key) {
    const g = GROUPS[key], chair = byId[g.ids[0]];
    return `<button type="button" class="ku-grp" data-grp="${key}" aria-expanded="false" aria-controls="grp-${key}" style="--kc:${g.color}">
      <span class="ku-grp-faces">${g.ids.slice(0, 4).map(id => face(byId[id], 'sm')).join('')}</span>
      <b>${E(g.name)}</b><small>${g.ids.length} members · chaired by ${E(chair.name)}</small><span class="ku-grp-go" aria-hidden="true">▾</span></button>`;
  }
  const panel = key => `<div class="ku-panel" id="grp-${key}" hidden><p>${E(OFFICE[key])}</p><div class="ku-board">${GROUPS[key].ids.map(id => small(byId[id])).join('')}</div></div>`;

  function paintChart() {
    $('kuChart').innerHTML = `
      <div class="ku-lvl">The head of the university</div>
      ${big(byId.nyongo, 'Chancellor')}
      <span class="ku-line"></span><span class="ku-split"></span>
      <div class="ku-two">${groupTile('bot')}${groupTile('council')}</div>
      ${panel('bot')}${panel('council')}
      <span class="ku-line tall"></span>
      <div class="ku-lvl">Runs the university</div>
      ${big(byId.miseda, 'Vice Chancellor')}
      <span class="ku-line"></span><span class="ku-split"></span>
      <div class="ku-two">${mid(byId.mwayuli, 'DVC · Finance, Administration & Planning')}${mid(byId.wafula, 'DVC · Academic, Student Affairs & Research')}</div>
      <span class="ku-line tall"></span>
      <div class="ku-lvl">University Management Board</div>
      <p class="ku-lvl-sub">${E(OFFICE.umb)}</p>
      <div class="ku-board">${GROUPS.umb.ids.slice(3).map(id => small(byId[id])).join('')}</div>`;
  }

  /* ── One person, in a sheet ────────────────────── */
  function personHTML(p) {
    const groups = groupsOf(p);
    return `<div class="ku-sh-face" style="--kc:${colorOf(p)}">${face(p, 'xxl')}</div>
      <p class="ku-role" style="--kc:${colorOf(p)}">${E(p.role)}</p>
      <h3 class="ku-sh-name" id="kuShName">${E(p.name)}</h3>
      ${p.creds ? `<p class="ku-creds">${E(p.creds)}</p>` : ''}
      <div class="ku-what"><b>What this office does</b><p>${E(p.desc)}</p></div>
      ${p.also ? `<p class="ku-also">Also: ${E(p.also)}</p>` : ''}
      ${groups.length ? `<p class="ku-in">${groups.map(g => `<span style="--kc:${g.color}">${E(g.name)}</span>`).join('')}</p>` : ''}
      <a class="ku-srclink" href="${SITE + p.page}" target="_blank" rel="noopener">See on gluk.ac.ke ↗</a>`;
  }

  /* ── Who's who? ────────────────────────────────── */
  const ROUND = 10, BEST = 'gluk-kyu-best';
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const others = (p, pool, n) => shuffle(pool.filter(x => x !== p)).slice(0, n);
  const withPhoto = PEOPLE.filter(p => p.photo);
  const named = withPhoto.filter(p => p.uniq);                 // offices only one person holds
  let quiz = null, user = null, roundSeq = 0;
  const fmtTime = s => s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  // Signed in, the api times the round from here, and its best goes on the leaderboard
  function startRound() {
    const r = newRound();
    r.n = ++roundSeq;
    if (user) r.runP = window.gApi('kyu.start').then(x => x.run).catch(e => { r.startErr = e; return null; });
    return r;
  }

  function question(kind, p) {
    if (kind === 'face') return { kind, p, ask: p.ask || `Who is the ${p.short}?`, opts: shuffle([p, ...others(p, withPhoto, 3)]) };
    if (kind === 'role') return { kind, p, ask: `What is ${p.name}’s office at GLUK?`, opts: shuffle([p, ...others(p, named, 3)]) };
    return { kind: 'name', p, ask: 'Who is this?', opts: shuffle([p, ...others(p, withPhoto, 3)]) };
  }
  // The first question is always the Vice Chancellor; then the best-known offices, then anyone
  function newRound() {
    const vc = byId.miseda;
    const keys = shuffle(named.filter(p => p.key && p !== vc)).slice(0, 5);
    const rest = shuffle(withPhoto.filter(p => p !== vc && !keys.includes(p))).slice(0, ROUND - 1 - keys.length);
    const qs = [question('face', vc), ...shuffle([...keys, ...rest]).map(p => question(shuffle(p.uniq ? ['name', 'face', 'role'] : ['name'])[0], p))];
    return { qs, i: 0, score: 0, answered: false };
  }
  const best = () => { try { return Number(localStorage.getItem(BEST)) || 0; } catch (e) { return 0; } };
  function saveBest(n) { try { if (n > best()) localStorage.setItem(BEST, String(n)); } catch (e) {} }
  function preload(q) { if (q) (q.kind === 'face' ? q.opts : [q.p]).forEach(p => { if (p.photo) new Image().src = `img/leaders/${p.id}.jpg`; }); }

  function paintQ() {
    const q = quiz.qs[quiz.i];
    $('kqCount').textContent = `${quiz.i + 1} / ${quiz.qs.length}`;
    $('kqScore').textContent = `${quiz.score} correct`;
    $('kqBar').style.width = (quiz.i / quiz.qs.length * 100) + '%';
    const media = q.kind === 'face' ? '' : `<div class="kq-photo">${face(q.p, 'q')}</div>${q.kind === 'role' ? `<p class="kq-who">${E(q.p.name)}</p>` : ''}`;
    const opts = q.kind === 'face'
      ? `<div class="kq-faces">${q.opts.map((o, i) => `<button type="button" class="kq-fopt" data-i="${i}" aria-label="Choice ${i + 1}">${face(o, 'q2')}<span class="kq-fname">${E(o.name)}</span></button>`).join('')}</div>`
      : `<div class="kq-opts">${q.opts.map((o, i) => `<button type="button" class="kq-opt" data-i="${i}">${E(q.kind === 'role' ? o.short : o.name)}</button>`).join('')}</div>`;
    $('kqBody').innerHTML = `<p class="kq-ask" id="kqAsk">${E(q.ask)}</p>${media}${opts}<p class="kq-feedback" id="kqFb" aria-live="polite"></p>
      <button type="button" class="kq-next" id="kqNext" hidden>${quiz.i + 1 < quiz.qs.length ? 'Next question ›' : 'See my score ›'}</button>`;
    quiz.answered = false;
    $('kqBody').classList.remove('done');
    preload(quiz.qs[quiz.i + 1]);
  }
  function answer(i) {
    if (!quiz || quiz.answered) return;
    const q = quiz.qs[quiz.i], pick = q.opts[i], right = pick === q.p;
    quiz.answered = true;
    if (right) quiz.score++;
    document.querySelectorAll('#kqBody [data-i]').forEach(b => {
      const o = q.opts[+b.dataset.i];
      b.disabled = true;
      b.classList.add(o === q.p ? 'right' : (o === pick ? 'wrong' : 'dim'));
    });
    $('kqBody').classList.add('done');
    $('kqFb').className = 'kq-feedback ' + (right ? 'yes' : 'no');
    $('kqFb').innerHTML = `${right ? '✅ Correct!' : '❌ Not quite.'} <b>${E(q.p.name)}</b> ${E(isText(q.p))}.`;
    $('kqScore').textContent = `${quiz.score} correct`;
    $('kqNext').hidden = false; $('kqNext').focus({ preventScroll: true });
  }
  function next() {
    if (!quiz) return;
    quiz.i++;
    if (quiz.i < quiz.qs.length) { paintQ(); return; }
    const n = quiz.score, total = quiz.qs.length, was = best();
    saveBest(n);
    $('kqBar').style.width = '100%';
    $('kqCount').textContent = 'Done';
    const msg = n === total ? 'You know GLUK inside out! 🏆' : n >= 7 ? 'Great! You know who runs GLUK. 🎓' : n >= 4 ? 'Not bad. Meet the leaders, then try again.' : 'Time to meet your leaders!';
    $('kqBody').classList.remove('done');
    $('kqBody').innerHTML = `<div class="kq-end">
      <div class="kq-big">${n}<span>/${total}</span></div>
      <p class="kq-msg">${E(msg)}</p>
      <p class="kq-bestline">${n > was && was ? 'A new best score!' : `Your best: ${Math.max(n, was)}/${total}`}</p>
      <p class="kq-board" id="kqBoard" data-round="${quiz.n}"></p>
      <button type="button" class="kq-next" id="kqAgain">Play again</button>
      <button type="button" class="kq-ghost" id="kqShare">Challenge a friend</button>
      <button type="button" class="kq-ghost" id="kqMeet">Meet the leaders</button></div>`;
    paintBest();
    saveRound(quiz);
  }

  /* ── The leaderboard ───────────────────────────── */
  const boardSay = e => e && e.code === 'kyu_coming' ? 'The leaderboard is being switched on. Your next rounds will count.'
    : e && e.data ? e.message : 'Could not save your score. Check your connection.';
  async function saveRound(round) {
    const say = html => { const el = $('kqBoard'); if (el && el.dataset.round === String(round.n)) el.innerHTML = html; };
    if (!round.runP) { say('Sign in to put your score on the leaderboard. <button type="button" class="kq-link" id="kqSignIn">Sign in</button>'); return; }
    say('Saving your score…');
    const id = await round.runP;
    if (!id) { say(E(boardSay(round.startErr))); return; }
    try {
      const r = await window.gApi('kyu.finish', { run: id, score: round.score });
      say(r.hidden ? `Saved. You are hidden from the leaderboard. <span>Time: ${fmtTime(r.seconds)}</span>`
        : `🏆 You are <b>#${r.rank}</b> of ${r.total} on the leaderboard${r.newBest || r.first ? ' · a new best!' : ''} <span>Time: ${fmtTime(r.seconds)}${r.newBest || r.first ? '' : ` · your best: ${r.best.score}/${ROUND} in ${fmtTime(r.best.seconds)}`}</span>`);
      loadBoard();
    } catch (e) { say(E(boardSay(e))); }
  }

  let board = [], boardAll = false;
  const lbFace = r => {
    const u = window.safeUrl(r.photo_url);
    return u ? `<span class="ku-face lb" style="background-image:url('${E(u).replace(/'/g, '%27')}')" aria-hidden="true"></span>`
      : `<span class="ku-face lb ini" aria-hidden="true">${E(ini(r.name) || '?')}</span>`;
  };
  function paintBoard() {
    const rows = boardAll ? board : board.slice(0, 10);
    $('kuBoard').innerHTML = board.length ? `<ol class="ku-lb">${rows.map((r, i) => `<li class="ku-lb-row${i < 3 ? ' top' : ''}">
        <span class="ku-lb-n">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>${lbFace(r)}<span class="ku-lb-name">${E(r.name)}</span>
        <span class="ku-lb-score"><b>${Number(r.score)}/${ROUND}</b><small>${fmtTime(Number(r.seconds))}</small></span></li>`).join('')}</ol>
      ${board.length > 10 ? `<button type="button" class="ku-lb-more" id="kuLbMore">${boardAll ? 'Show the top 10' : `Show the top ${board.length}`}</button>` : ''}`
      : '<p class="ku-lb-empty">No scores yet. Sign in, play a round and be the first on the board!</p>';
  }
  async function loadBoard() {
    try {
      const { data, error } = await supabase.from('kyu_leaderboard').select('name,photo_url,score,seconds').limit(50);
      if (error) throw error;
      board = data || [];
      paintBoard();
    } catch (e) {
      const coming = /PGRST205|schema cache|does not exist|42P01/i.test(String(e && (e.message || '') + ' ' + (e.code || '')));
      $('kuBoard').innerHTML = `<p class="ku-lb-empty">${coming ? 'The leaderboard opens very soon.' : 'Could not load the leaderboard. Check your connection.'}</p>`;
    }
    loadMe();
  }
  // Your own place, and the choice to leave the board
  async function loadMe() {
    const el = $('kuMe');
    if (!user) { el.innerHTML = '<span>Sign in, then play, to get on the leaderboard.</span><button type="button" class="ku-lb-btn" id="kuSignIn">Sign in</button>'; return; }
    try {
      const { me } = await window.gApi('kyu.me');
      el.innerHTML = !me ? '<span>Play a round to get on the board.</span>'
        : me.hidden ? `<span>You are hidden from the leaderboard (your best: ${me.score}/${ROUND}).</span><button type="button" class="ku-lb-btn" data-hide="0">Show me</button>`
        : `<span>You: <b>#${me.rank}</b> of ${me.total} · ${me.score}/${ROUND} in ${fmtTime(me.seconds)}</span><button type="button" class="ku-lb-btn ghost" data-hide="1">Hide me</button>`;
    } catch (e) { el.innerHTML = ''; }
  }
  async function share() {
    const n = quiz ? quiz.score : best();
    const text = `I got ${n}/${ROUND} on "Who's who at GLUK?" Can you name the Vice Chancellor?`;
    const url = location.origin + '/university.html';
    try {
      if (navigator.share) { await navigator.share({ title: 'Know your university', text, url }); return; }
      await navigator.clipboard.writeText(text + ' ' + url);
      window.showToast('Copied. Paste it to a friend!');
    } catch (e) { /* closed the share sheet */ }
  }
  function paintBest() {
    const b = best();
    $('kuBest').textContent = b ? `Your best: ${b}/${ROUND}` : '10 quick questions. Can you name the Vice Chancellor?';
  }

  /* ── Sheets that the phone's back button closes (#play, #who-<id>) ── */
  let openedHere = false;
  function go(hash) { openedHere = true; location.hash = hash; }
  function close() {
    if (openedHere) { openedHere = false; history.back(); return; }
    history.replaceState(null, '', location.pathname + location.search);
    route();
  }
  function route() {
    const h = location.hash.slice(1), m = /^who-([a-z]+)$/.exec(h), p = m && byId[m[1]];
    const playing = h === 'play';
    $('kuQuiz').hidden = !playing;
    if (playing && !quiz) { quiz = startRound(); paintQ(); }
    if (!playing) quiz = null;
    $('kuOv').hidden = !p;
    if (p) { $('kuSheetBody').innerHTML = personHTML(p); $('kuSheet').scrollTop = 0; }
    document.documentElement.style.overflow = (playing || p) ? 'hidden' : '';
    if (!h || (!playing && !p)) openedHere = false;
  }

  /* ── Wiring ────────────────────────────────────── */
  paintChart(); paintBest();
  $('kuChart').addEventListener('click', e => {
    const g = e.target.closest('[data-grp]');
    if (g) {
      const panelEl = $('grp-' + g.dataset.grp), open = panelEl.hidden;
      document.querySelectorAll('.ku-grp').forEach(b => { b.setAttribute('aria-expanded', 'false'); $('grp-' + b.dataset.grp).hidden = true; });
      panelEl.hidden = !open; g.setAttribute('aria-expanded', String(open));
      return;
    }
    const w = e.target.closest('[data-who]'); if (w) go('who-' + w.dataset.who);
  });
  document.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => { quiz = null; go('play'); }));
  $('kuMeet').addEventListener('click', () => $('chart').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  $('kuX').addEventListener('click', close);
  $('kuOv').addEventListener('click', e => { if (e.target === $('kuOv')) close(); });
  $('kqX').addEventListener('click', close);
  $('kqBody').addEventListener('click', e => {
    const o = e.target.closest('[data-i]'); if (o) { answer(+o.dataset.i); return; }
    if (e.target.closest('#kqNext')) next();
    else if (e.target.closest('#kqAgain')) { quiz = startRound(); paintQ(); }
    else if (e.target.closest('#kqSignIn')) window.openAuthModal(null, 'login');
    else if (e.target.closest('#kqShare')) share();
    else if (e.target.closest('#kqMeet')) { close(); setTimeout(() => $('chart').scrollIntoView({ block: 'start' }), 200); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && (!$('kuOv').hidden || !$('kuQuiz').hidden)) close(); });
  $('kuBoard').addEventListener('click', e => { if (e.target.closest('#kuLbMore')) { boardAll = !boardAll; paintBoard(); } });
  $('kuMe').addEventListener('click', async e => {
    if (e.target.closest('#kuSignIn')) { window.openAuthModal(null, 'login'); return; }
    const b = e.target.closest('[data-hide]'); if (!b) return;
    b.disabled = true;
    try { await window.gApi('kyu.hide', { hidden: b.dataset.hide === '1' }); } catch (er) { window.showToast(er.message || 'Could not change that.'); }
    loadBoard();
  });
  window.addEventListener('hashchange', route);
  route();
  loadBoard();
  auth.onAuthStateChanged(u => { user = u; loadMe(); });

  window.__kyu = { PEOPLE, GROUPS, newRound };     // for the tests
})();
