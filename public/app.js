// =====================================================
//  GLUK YEARBOOK 2026 — MAIN APP JS
//  Phases 1–6 combined
// =====================================================
'use strict';

// ── Service Worker ─────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(r => console.log('[SW] Registered:', r.scope))
      .catch(e => console.warn('[SW] Failed:', e));
  });
}

// ── PWA Install Prompt ─────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('installBanner');
  if (banner) setTimeout(() => banner.classList.add('show'), 4000);
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  document.getElementById('installBanner')?.classList.remove('show');
});
window.installApp = () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
};
window.dismissInstall = () => {
  document.getElementById('installBanner')?.classList.remove('show');
};

// ── Graduation Countdown ───────────────────────────
function runCountdown() {
  const target = new Date('2026-11-27T09:00:00').getTime();
  const pad = n => String(n).padStart(2,'0');
  const set = (id, v) => { const el = document.getElementById('cd-'+id); if(el) el.textContent = v; };
  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) { ['days','hours','minutes','seconds'].forEach(u => set(u,'00')); return; }
    set('days',    pad(Math.floor(diff / 86400000)));
    set('hours',   pad(Math.floor((diff % 86400000) / 3600000)));
    set('minutes', pad(Math.floor((diff % 3600000) / 60000)));
    set('seconds', pad(Math.floor((diff % 60000) / 1000)));
  }
  tick();
  setInterval(tick, 1000);
}
if (document.getElementById('cd-days')) runCountdown();

// ── Toast ──────────────────────────────────────────
function showToast(msg, duration = 2500) {
  let t = document.getElementById('glukToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'glukToast';
    t.className = 'gluk-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('toast-show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('toast-show'), duration);
}

// ── URL params ─────────────────────────────────────
const Params = { get: k => new URLSearchParams(window.location.search).get(k) || '' };

// ── Image compression ──────────────────────────────
function compressImage(dataUrl, max = 700, q = 0.72) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width: w, height: h } = img;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h * max / w); w = max; }
        else       { w = Math.round(w * max / h); h = max; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      res(canvas.toDataURL('image/jpeg', q));
    };
    img.src = dataUrl;
  });
}

// ── Skeleton loaders ───────────────────────────────
function showSkeletons(id, n = 6) {
  const g = document.getElementById(id);
  if (!g) return;
  g.innerHTML = Array(n).fill(`
    <div class="profile-card skeleton-card" style="pointer-events:none">
      <div class="sk-block" style="padding-top:110%"></div>
      <div class="card-body">
        <div class="sk-line" style="width:80%;height:14px;margin-bottom:8px"></div>
        <div class="sk-line" style="width:55%;height:10px"></div>
      </div>
    </div>`).join('');
}

// ── Lazy image loading ─────────────────────────────
function observeImages() {
  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
        img.classList.add('img-loaded');
        o.unobserve(img);
      }
    });
  }, { rootMargin: '100px' });
  document.querySelectorAll('img[loading="lazy"]').forEach(img => obs.observe(img));
}

// ── Sample seed data ───────────────────────────────
const SAMPLE_STUDENTS = [
  {id:'S001',name:'Achieng Otieno',reg:'GLUK/HS/CM/BCM/2022/001',dept:'Health Sciences',course:'Clinical Medicine',classYear:'2026',county:'Kisumu',constituency:'Kisumu East',whatsapp:'+254700000001',email:'achieng.otieno@students.gluk.ac.ke',bio:'Passionate about community health and rural outreach. Believes medicine is a calling, not just a career. Volunteered at JOOTRH during internship. Aspires to specialise in Internal Medicine.',hobbies:['Reading','Hiking','Cooking','Photography'],clubs:['Medical Students Association','Red Cross Club','Drama Club'],bestMemory:'Our first clinical posting at Kisumu County Hospital — the nervous excitement mixed with the joy of actually helping a patient for the first time.',biggestLesson:'Empathy is the most powerful medicine. No drug in the formulary can heal the way genuine human connection does.',mostLikelyTo:"Become Kenya's youngest Chief Medical Officer 🏥",photos:[],photo:null,uid:null},
  {id:'S002',name:'Omondi Kevin',reg:'GLUK/HS/CM/BCM/2022/002',dept:'Health Sciences',course:'Clinical Medicine',classYear:'2026',county:'Siaya',constituency:'Alego Usonga',whatsapp:'+254700000002',email:'kevin.omondi@students.gluk.ac.ke',bio:'Sports medicine enthusiast and fitness advocate. Ran the Kisumu Marathon three years running while balancing clinical rotations.',hobbies:['Running','Football','Music','Mentoring'],clubs:['Sports Medicine Club','Christian Union','Environmental Club'],bestMemory:'Winning the inter-university football tournament — we carried that trophy back to GLUK on a boda boda!',biggestLesson:'Consistency beats talent every single time. Show up, do the work, repeat.',mostLikelyTo:'Open a chain of sports clinics across East Africa ⚽',photos:[],photo:null,uid:null},
  {id:'S003',name:'Nafula Wanjiku',reg:'GLUK/HS/CM/BCM/2022/003',dept:'Health Sciences',course:'Clinical Medicine',classYear:'2026',county:'Kakamega',constituency:'Shinyalu',whatsapp:'+254700000003',email:'wanjiku.nafula@students.gluk.ac.ke',bio:'Dedicated to maternal and child health. Founded the campus Mama-Care initiative, providing free antenatal education to over 200 women.',hobbies:['Writing','Knitting','Community Service','Gardening'],clubs:['Nursing & Midwifery Support Club','Gender Equity Club','Choir'],bestMemory:'The day our Mama-Care team conducted outreach in Nyalenda — seeing the smiles on expectant mothers who had never accessed healthcare before.',biggestLesson:'Service to others is the rent you pay for your room here on Earth.',mostLikelyTo:'Win a UN award for maternal health innovation 🌍',photos:[],photo:null,uid:null},
  {id:'S004',name:'Barasa Daniel',reg:'GLUK/HS/CM/BCM/2022/004',dept:'Health Sciences',course:'Clinical Medicine',classYear:'2026',county:'Bungoma',constituency:'Kanduyi',whatsapp:'+254700000004',email:'daniel.barasa@students.gluk.ac.ke',bio:'Technology enthusiast merging healthcare with innovation. Built a mobile app prototype for patient triage during final year. Digital health is the future.',hobbies:['Coding','Gaming','Tech Blogs','Chess'],clubs:['Health Informatics Club','Computer Science Society','Debate Club'],bestMemory:'Presenting our digital triage app at the East Africa Health Innovation Summit and receiving a standing ovation.',biggestLesson:'Do not wait for perfect conditions. Start where you are, use what you have.',mostLikelyTo:'Build the Netflix of African Healthcare 💻',photos:[],photo:null,uid:null},
  {id:'S005',name:'Chebet Faith',reg:'GLUK/EDU/2022/001',dept:'Education',course:'Education',classYear:'2026',county:'Nandi',constituency:'Mosop',whatsapp:'+254700000005',email:'faith.chebet@students.gluk.ac.ke',bio:'Born teacher with a passion for early childhood development. Believes every child deserves quality education regardless of background.',hobbies:['Storytelling','Painting','Yoga','Nature Walks'],clubs:['Student Teacher Association','Art Club','Environment Club'],bestMemory:'Teaching 50 children in Kibera and seeing them light up when they finally grasped a concept — pure joy.',biggestLesson:'Patience is not the ability to wait, but how you act while waiting.',mostLikelyTo:"Become Kenya's best Minister of Education 📚",photos:[],photo:null,uid:null},
  {id:'S006',name:'Mwangi James',reg:'GLUK/EDU/2022/002',dept:'Education',course:'Education',classYear:'2026',county:"Murang'a",constituency:'Kigumo',whatsapp:'+254700000006',email:'james.mwangi@students.gluk.ac.ke',bio:'Mathematics and Science education specialist. Tutored over 100 secondary school students in KCSE preparation.',hobbies:['Math Puzzles','Cycling','Teaching','Drumming'],clubs:['Mathematics Club','Science Olympiad Team','Music Band'],bestMemory:'When three of my peer-tutoring students scored A in Mathematics in KCSE — I cried tears of joy.',biggestLesson:'Teaching is not about transferring knowledge; it is about igniting a flame that never goes out.',mostLikelyTo:"Write Kenya's most popular Mathematics textbook 📐",photos:[],photo:null,uid:null},
];

async function seedIfEmpty() {
  try {
    const snap = await db.collection('students').limit(1).get();
    if (snap.empty) {
      const batch = db.batch();
      SAMPLE_STUDENTS.forEach(s => {
        batch.set(db.collection('students').doc(s.id),
          { ...s, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
    }
  } catch(e) { console.warn('[Seed]', e.message); }
}

// ── PROFILES PAGE ──────────────────────────────────
async function initProfilesPage() {
  await seedIfEmpty();
  const dept = Params.get('dept'), course = Params.get('course'), classYear = Params.get('class');

  const titleEl = document.getElementById('profilesTitle');
  const subEl   = document.getElementById('profilesSubtitle');
  if (titleEl) titleEl.textContent = classYear ? `Class of ${classYear}` : course || dept || 'All Students';
  if (subEl)   subEl.textContent   = [dept, course].filter(Boolean).join(' › ');

  const bc = document.getElementById('breadcrumb');
  if (bc) bc.innerHTML = makeBreadcrumb(dept, course, classYear);

  // Filter chips
  const fw = document.getElementById('filterChips');
  if (fw) {
    fw.innerHTML = ['All','2026','2027','2028','2029'].map((y,i) =>
      `<button class="chip ${i===0?'active':''}" data-year="${y}"
        onclick="filterYear('${y}',this)">${y==='All'?'All Classes':'Class of '+y}</button>`
    ).join('');
  }

  showSkeletons('profilesGrid', 6);
  await loadProfiles(dept, course, classYear, '');

  const si = document.getElementById('searchInput');
  if (si) {
    let dt;
    si.addEventListener('input', () => {
      clearTimeout(dt);
      dt = setTimeout(async () => {
        const activeChip = document.querySelector('.chip.active');
        const year = activeChip?.dataset.year || classYear;
        await loadProfiles(dept, course, year === 'All' ? '' : year, si.value);
      }, 300);
    });
  }
}

window.filterYear = async function(year, btn) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const p = new URLSearchParams(window.location.search);
  const d = p.get('dept') || '', c2 = p.get('course') || '';
  const q = document.getElementById('searchInput')?.value || '';
  showSkeletons('profilesGrid', 6);
  await loadProfiles(d, c2, year === 'All' ? '' : year, q);
};

async function loadProfiles(dept, course, classYear, search) {
  const grid = document.getElementById('profilesGrid');
  if (!grid) return;
  try {
    let q = db.collection('students');
    if (dept)      q = q.where('dept',      '==', dept);
    if (course)    q = q.where('course',    '==', course);
    if (classYear) q = q.where('classYear', '==', classYear);
    const snap = await q.get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(x => x.name?.toLowerCase().includes(s) || x.reg?.toLowerCase().includes(s));
    }
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🎓</div><h3>No students found</h3>
        <p>Try a different search or add new profiles</p></div>`;
      return;
    }
    grid.innerHTML = list.map(s => {
      const initials = (s.name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
      const ph = s.photo
        ? `<img src="${s.photo}" alt="${s.name}" loading="lazy" class="profile-img">`
        : `<div class="card-photo-placeholder"><span class="initials">${initials}</span><span class="ph-label">GLUK</span></div>`;
      const link = `profile.html?id=${s.id}&dept=${encodeURIComponent(dept)}&course=${encodeURIComponent(course)}`;
      return `<a class="profile-card fade-in" href="${link}">
        <div class="card-photo-wrap">${ph}</div>
        <div class="card-body">
          <div class="card-name">${s.name}</div>
          <div class="card-reg">${s.reg}</div>
          <span class="card-badge">Class of ${s.classYear}</span>
        </div></a>`;
    }).join('');
    observeImages();
  } catch(e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">⚠️</div><h3>Could not load profiles</h3>
      <p>Check your connection and try again.</p></div>`;
  }
}

// ── ADD PROFILE MODAL ──────────────────────────────
window.openAddModal = function() {
  requireAuth(async () => {
    if (currentUser) {
      try {
        const ex = await db.collection('students').where('uid','==',currentUser.uid).limit(1).get();
        if (!ex.empty) { showToast('You already have a profile! 🎓'); return; }
      } catch(e) {}
    }
    document.getElementById('addModal')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }, 'signup');
};

window.closeAddModal = function() {
  document.getElementById('addModal')?.classList.add('hidden');
  document.body.style.overflow = '';
};

window.handlePhotoUpload = async function(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const compressed = await compressImage(e.target.result, 600, 0.7);
    const preview = document.getElementById('photoPreview');
    if (preview) preview.innerHTML = `<img src="${compressed}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto;display:block">`;
    window._photo = compressed;
  };
  reader.readAsDataURL(file);
};

window.submitProfile = async function(e) {
  e.preventDefault();
  if (!currentUser) { openAuthModal(null,'signup'); return; }
  const form = document.getElementById('addProfileForm');
  const data = new FormData(form);
  const p    = new URLSearchParams(window.location.search);
  const btn  = form.querySelector('button[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    await db.collection('students').add({
      name:          data.get('name') || '',
      reg:           data.get('reg') || '',
      dept:          p.get('dept') || data.get('dept') || '',
      course:        p.get('course') || data.get('course') || '',
      classYear:     data.get('classYear') || p.get('class') || '2026',
      county:        data.get('county') || '',
      constituency:  data.get('constituency') || '',
      whatsapp:      data.get('whatsapp') || '',
      email:         data.get('email') || currentUser.email || '',
      bio:           data.get('bio') || '',
      hobbies:       (data.get('hobbies')||'').split(',').map(x=>x.trim()).filter(Boolean),
      clubs:         (data.get('clubs')||'').split(',').map(x=>x.trim()).filter(Boolean),
      bestMemory:    data.get('bestMemory') || '',
      biggestLesson: data.get('biggestLesson') || '',
      mostLikelyTo:  data.get('mostLikelyTo') || '',
      photos: [], photo: window._photo || null, uid: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    window._photo = null;
    closeAddModal();
    form.reset();
    document.getElementById('photoPreview').innerHTML = `<div class="upload-icon">📷</div><p>Tap to upload photo</p>`;
    showToast('Profile saved! 🎉');
    const dept = p.get('dept'), course = p.get('course'), classYear = p.get('class');
    await loadProfiles(dept, course, classYear, '');
  } catch(e) {
    showToast('❌ Could not save. Try again.');
    console.error(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✓  Save Profile'; }
  }
};

// ── PROFILE DETAIL PAGE ────────────────────────────
function initProfilePage() {
  const id = Params.get('id');
  if (!id) { window.location.href = 'profiles.html'; return; }
  db.collection('students').doc(id).get().then(doc => {
    if (!doc.exists) { window.location.href = 'profiles.html'; return; }
    paintProfile({ id: doc.id, ...doc.data() });
    startComments(id);
  }).catch(() => showToast('Could not load profile.'));
}

function paintProfile(s) {
  const initials = (s.name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  const av = document.getElementById('profileAvatar');
  if (av) av.innerHTML = s.photo
    ? `<img src="${s.photo}" alt="${s.name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
    : `<div class="avatar-inner">${initials}</div>`;

  const tx = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v || '---'; };
  tx('profileName',   s.name);
  tx('profileReg',    s.reg);
  tx('profileDept',   `${s.dept} — ${s.course}`);
  tx('profileCounty', s.county);
  tx('profileConst',  s.constituency);
  tx('profileEmail',  s.email);
  tx('profileBio',    s.bio);
  tx('profileMemory', s.bestMemory);
  tx('profileLesson', s.biggestLesson);
  tx('profileLikely', s.mostLikelyTo);

  const wa = document.getElementById('whatsappBtn');
  if (wa && s.whatsapp) wa.href = `https://wa.me/${s.whatsapp.replace(/\D/g,'')}?text=Hi%20${encodeURIComponent(s.name)}%2C%20saw%20your%20GLUK%20Yearbook%20profile!`;
  const em = document.getElementById('emailBtn');
  if (em && s.email) em.href = `mailto:${s.email}`;

  const hEl = document.getElementById('profileHobbies');
  if (hEl && s.hobbies?.length) hEl.innerHTML = s.hobbies.map(h=>`<span class="pill">${h}</span>`).join('');
  const cEl = document.getElementById('profileClubs');
  if (cEl && s.clubs?.length) cEl.innerHTML = s.clubs.map(c=>`<span class="pill club">${c}</span>`).join('');

  initCarousel(s.photos || []);
  setTimeout(() => {
    const waBtn = document.getElementById('whatsappBtn');
    const waS   = document.getElementById('waShareBtn');
    if (waBtn && waS) waS.href = waBtn.href;
  }, 400);
}

// ── CAROUSEL ───────────────────────────────────────
let cIdx = 0;
function initCarousel(photos) {
  const track = document.getElementById('carouselTrack');
  const dots  = document.getElementById('carouselDots');
  if (!track) return;
  const ph = [{icon:'📸',label:'Memory 1'},{icon:'🌅',label:'Memory 2'},{icon:'🎓',label:'Memory 3'},{icon:'🏥',label:'Memory 4'}];
  const slides = photos.length
    ? photos.slice(0,4).map(src=>`<div class="carousel-slide"><img src="${src}" alt="Photo" loading="lazy"></div>`)
    : ph.map(p=>`<div class="carousel-slide"><div class="slide-placeholder"><span>${p.icon}</span><span style="font-size:.75rem;margin-top:8px">${p.label}</span></div></div>`);
  track.innerHTML = slides.join('');
  if (dots) dots.innerHTML = slides.map((_,i)=>`<div class="c-dot ${i===0?'active':''}" onclick="goSlide(${i})"></div>`).join('');
  cIdx = 0; updateCarousel();
}
window.goSlide = i => {
  const t = document.getElementById('carouselTrack');
  const n = t?.children.length || 0;
  cIdx = ((i % n) + n) % n; updateCarousel();
};
window.prevSlide = () => goSlide(cIdx - 1);
window.nextSlide = () => goSlide(cIdx + 1);
function updateCarousel() {
  const t = document.getElementById('carouselTrack');
  if (t) t.style.transform = `translateX(-${cIdx*100}%)`;
  document.querySelectorAll('.c-dot').forEach((d,i) => d.classList.toggle('active', i===cIdx));
}
let txStart = 0;
document.addEventListener('touchstart', e => { if(e.target.closest('.carousel-wrap')) txStart = e.touches[0].clientX; }, {passive:true});
document.addEventListener('touchend',   e => {
  if (!e.target.closest('.carousel-wrap')) return;
  const diff = txStart - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 40) diff > 0 ? nextSlide() : prevSlide();
});

// ── COMMENTS (Firestore realtime) ──────────────────
let _unsub = null;

function startComments(studentId) {
  if (_unsub) _unsub();
  const box = document.getElementById('commentsContainer');
  if (!box) return;
  box.innerHTML = `<div class="sk-block" style="height:60px;border-radius:10px;margin-bottom:10px"></div>
                   <div class="sk-block" style="height:60px;border-radius:10px"></div>`;
  _unsub = db.collection('comments')
    .where('studentId','==',studentId)
    .orderBy('timestamp','asc')
    .onSnapshot(snap => {
      paintComments(snap.docs.map(d=>({id:d.id,...d.data()})), studentId);
    }, err => {
      if (box) box.innerHTML = `<p style="text-align:center;color:#8a97b0;font-size:.8rem;padding:20px">Comments unavailable.</p>`;
    });
}

function paintComments(list, studentId) {
  const box = document.getElementById('commentsContainer');
  const cnt = document.getElementById('commentCount');
  if (!box) return;
  if (cnt) cnt.textContent = list.length;
  if (!list.length) {
    box.innerHTML = `<div class="empty-state" style="padding:24px 0">
      <div class="empty-icon" style="font-size:2rem">💬</div>
      <h3 style="font-size:.875rem">No comments yet</h3>
      <p>Be the first to leave a memory!</p></div>`;
    return;
  }
  box.innerHTML = list.map(c => {
    const initials = (c.authorName||'A').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    const ts = c.timestamp?.toDate ? c.timestamp.toDate().getTime() : (c.timestamp||0);
    const liked = c.likedBy?.includes(currentUser?.uid);
    return `<div class="comment-item" id="ci-${c.id}">
      <div class="avatar-sm">${initials}</div>
      <div class="comment-bubble">
        <div><span class="comment-user">${esc(c.authorName||'Anonymous')}</span>
        <span class="comment-time">${ago(ts)}</span></div>
        <div class="comment-text">${esc(c.text)}</div>
        <div class="comment-actions">
          <button class="comment-action-btn ${liked?'liked':''}"
            onclick="toggleLike('${c.id}','${studentId}')">
            ${liked?'❤️':'🤍'} ${c.likes||0}
          </button>
        </div>
      </div></div>`;
  }).join('');
}

window.submitComment = async function() {
  requireAuth(async () => {
    const input = document.getElementById('commentInput');
    const id    = Params.get('id');
    const text  = input?.value.trim();
    if (!text || !id) return;
    if (text.length > 144) { showToast('Max 144 characters ✂️'); return; }
    const authorName = currentUser.displayName || currentUser.email.split('@')[0];
    const btn = document.querySelector('.comment-send-btn');
    if (btn) btn.disabled = true;
    try {
      await db.collection('comments').add({
        studentId: id, text, authorName,
        authorUid: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        likes: 0, likedBy: [],
      });
      if (input) input.value = '';
      const ctr = document.getElementById('commentCharCount');
      if (ctr) ctr.textContent = '144 chars left';
    } catch(e) {
      showToast('❌ Could not post comment.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }, 'login');
};

window.toggleLike = async function(commentId, studentId) {
  if (!currentUser) { openAuthModal(null,'login'); return; }
  const ref  = db.collection('comments').doc(commentId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const uid = currentUser.uid;
  const liked = (snap.data().likedBy||[]).includes(uid);
  await ref.update({
    likes:   firebase.firestore.FieldValue.increment(liked ? -1 : 1),
    likedBy: liked ? firebase.firestore.FieldValue.arrayRemove(uid) : firebase.firestore.FieldValue.arrayUnion(uid),
  });
};

// ── Helpers ────────────────────────────────────────
function ago(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000)   return 'just now';
  if (d < 3600000) return Math.floor(d/60000)+'m ago';
  if (d < 86400000)return Math.floor(d/3600000)+'h ago';
  return Math.floor(d/86400000)+'d ago';
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function makeBreadcrumb(dept, course, classYear) {
  let parts = ['<a href="index.html">Home</a>'];
  if (dept)      parts.push(`<a href="department.html?dept=${encodeURIComponent(dept)}">${dept}</a>`);
  if (course)    parts.push(`<a href="course.html?dept=${encodeURIComponent(dept)}&course=${encodeURIComponent(course)}">${course}</a>`);
  if (classYear) parts.push(`<span>Class of ${classYear}</span>`);
  return parts.join(' <span style="opacity:.4">›</span> ');
}

// ── Profile page extras ────────────────────────────
let bioOpen = false;
window.toggleBio = function() {
  const el = document.getElementById('profileBio');
  const btn = document.getElementById('readMoreBtn');
  bioOpen = !bioOpen;
  el.style.webkitLineClamp = bioOpen ? 'unset' : '5';
  el.style.overflow = bioOpen ? 'visible' : 'hidden';
  btn.textContent = bioOpen ? 'Show less ‹' : 'Read more ›';
};
window.shareProfile = function() {
  const name = document.getElementById('profileName')?.textContent || '';
  if (navigator.share) {
    navigator.share({ title:`${name} — GLUK Yearbook 2026`, text:`Check out ${name}'s profile!`, url: window.location.href }).catch(()=>{});
  } else copyProfileLink();
};
window.copyProfileLink = function() {
  navigator.clipboard.writeText(window.location.href)
    .then(() => showToast('Link copied! 🔗'))
    .catch(() => showToast('Could not copy'));
};
window.handleCommentKey = function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
};

// ── Back nav ───────────────────────────────────────
window.goBack = function() {
  if (document.referrer && document.referrer !== window.location.href) history.back();
  else window.location.href = 'index.html';
};

// ── Auto-init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'profiles') initProfilesPage();
  if (page === 'profile')  initProfilePage();

  // char counter on comment box
  const box = document.getElementById('commentInput');
  const ctr = document.getElementById('commentCharCount');
  if (box && ctr) {
    box.addEventListener('input', () => {
      const left = 144 - box.value.length;
      ctr.textContent = `${left} chars left`;
      ctr.style.color = left < 20 ? '#ef4444' : '#8a97b0';
    });
  }

  // Update comment input area based on auth state
  auth.onAuthStateChanged(user => {
    const wrap  = document.getElementById('commentInputWrap');
    const gate  = document.getElementById('commentGate');
    const avEl  = document.getElementById('commentAvatar');
    if (wrap && gate) {
      if (user) {
        wrap.style.display = 'block';
        gate.style.display = 'none';
        if (avEl) avEl.textContent = (user.displayName||user.email)[0].toUpperCase();
      } else {
        wrap.style.display = 'none';
        gate.style.display = 'block';
      }
    }
  });
});