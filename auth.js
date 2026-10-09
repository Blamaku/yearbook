// =====================================================
//  GLUK YEARBOOK 2026 — AUTH MODULE
//  Handles: login, signup, Google sign-in, logout,
//           user bar rendering, auth modal injection
// =====================================================
'use strict';

// ── Apply saved theme immediately (before first paint) ─
(function() {
  const t = localStorage.getItem('gluk-theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
})();

// Escape text before it goes into the user bar (display names are typed by users)
const _ubEsc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

// ── State ──────────────────────────────────────────
let currentUser   = null;
let _afterLogin   = null;   // callback to run after successful auth
let _defaultTab   = 'login';

// Show / hide password: a closed book while hidden, an open book while it can be read
const _PW_BOOK = `<button type="button" class="pw-book" aria-label="Show password" title="Show password" aria-pressed="false"
    onmousedown="event.preventDefault()" onclick="togglePasswordShown(this)">
    <svg class="pw-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19.5v-15A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5 1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6"/></svg>
    <svg class="pw-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10.3 5.2 7.9 4.5 3 4.5v13c4.9 0 7.3.7 9 2 1.7-1.3 4.1-2 9-2v-13c-4.9 0-7.3.7-9 2z"/><path d="M12 6.5v13"/><path d="M6 8.6c1.6.1 2.8.4 3.8.9M6 12c1.6.1 2.8.4 3.8.9M18 8.6c-1.6.1-2.8.4-3.8.9M18 12c-1.6.1-2.8.4-3.8.9"/></svg>
  </button>`;

function togglePasswordShown(btn) {
  const input = btn.parentElement.querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  const label = show ? 'Hide password' : 'Show password';
  btn.setAttribute('aria-pressed', String(show));
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

// Every password goes back to hidden (closed book), e.g. when the sign-in window closes
function hidePasswords() {
  document.querySelectorAll('.pw-wrap input').forEach(i => { i.type = 'password'; });
  document.querySelectorAll('.pw-book').forEach(b => {
    b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Show password'); b.title = 'Show password';
  });
}

// ── Inject Auth Modal HTML (runs immediately) ──────
(function buildAuthModal() {
  const el = document.createElement('div');
  el.innerHTML = `
  <div id="authOverlay" class="auth-overlay" onclick="handleAuthOverlayClick(event)">
    <div class="auth-card" id="authCard">

      <!-- Close button -->
      <button class="auth-close" onclick="closeAuthModal()" aria-label="Close">✕</button>

      <!-- Logo strip -->
      <div class="auth-logo-strip">
        <img class="auth-logo" src="logo-128.png" alt="GLUK crest" width="48" height="44">
        <div>
          <div class="auth-brand">GLUK Yearbook 2026</div>
          <div class="auth-brand-sub">Great Lakes University of Kisumu</div>
        </div>
      </div>

      <!-- Tab switcher -->
      <div class="auth-tab-row">
        <button class="auth-tab active" id="authTabLogin"  onclick="switchAuthTab('login')">Sign In</button>
        <button class="auth-tab"        id="authTabSignup" onclick="switchAuthTab('signup')">Sign Up</button>
      </div>

      <!-- ── LOGIN PANEL ── -->
      <div id="authLogin">
        <div class="auth-greeting">
          <div class="auth-wave">👋</div>
          <h2 class="auth-title">Welcome back!</h2>
          <p class="auth-subtitle">Sign in to your GLUK Yearbook account</p>
        </div>

        <!-- Google button -->
        <button class="btn-google" onclick="signInWithGoogle()">
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.3 6.7 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.9C14.6 16 19 12 24 12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.3 6.7 29.4 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.5-3.3-11.3-7.9L6 33.2C9.4 39.7 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.9 2.4-2.5 4.5-4.5 6l6.2 5.2C40.9 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-3.9z"/>
          </svg>
          Continue with Google
        </button>

        <div class="auth-or"><span>or sign in with email</span></div>

        <div class="auth-field">
          <label>Email</label>
          <input type="email" id="loginEmail" placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label>Password</label>
          <div class="pw-wrap"><input type="password" id="loginPass" placeholder="••••••••" autocomplete="current-password">${_PW_BOOK}</div>
        </div>

        <button type="button" class="auth-link-btn" onclick="forgotPassword()"
                style="display:block;margin:-4px 0 12px auto;font-size:.78rem">Forgot password?</button>

        <div id="loginNotice" style="display:none;background:#e8f7ee;color:#166534;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px;font-size:.78rem;line-height:1.5;margin-bottom:10px"></div>

        <div id="loginError" class="auth-error" style="display:none"></div>

        <button class="auth-submit" onclick="emailLogin()">Sign In →</button>

        <p class="auth-switch">
          Don't have an account?
          <button onclick="switchAuthTab('signup')" class="auth-link-btn">Sign up</button>
        </p>
      </div>

      <!-- ── SIGNUP PANEL ── -->
      <div id="authSignup" style="display:none">
        <div class="auth-greeting">
          <div class="auth-wave">🎓</div>
          <h2 class="auth-title">Nice to see you!</h2>
          <p class="auth-subtitle">Create your GLUK Yearbook account</p>
        </div>

        <!-- Google button -->
        <button class="btn-google" onclick="signInWithGoogle()">
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.3 6.7 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.9C14.6 16 19 12 24 12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.3 6.7 29.4 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.5-3.3-11.3-7.9L6 33.2C9.4 39.7 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.9 2.4-2.5 4.5-4.5 6l6.2 5.2C40.9 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-3.9z"/>
          </svg>
          Sign up with Google
        </button>

        <div class="auth-or"><span>or sign up with email</span></div>

        <div class="auth-field">
          <label>Full Name</label>
          <input type="text" id="signupName" placeholder="e.g. Achieng Otieno" autocomplete="name">
        </div>
        <div class="auth-field">
          <label>Email</label>
          <input type="email" id="signupEmail" placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label>Password <span style="font-weight:400;color:#8a97b0">(min 6 characters)</span></label>
          <div class="pw-wrap"><input type="password" id="signupPass" placeholder="••••••••" autocomplete="new-password">${_PW_BOOK}</div>
        </div>

        <div id="signupError" class="auth-error" style="display:none"></div>

        <button class="auth-submit" onclick="emailSignup()">Create Account →</button>

        <p class="auth-switch">
          Already have an account?
          <button onclick="switchAuthTab('login')" class="auth-link-btn">Sign in</button>
        </p>
      </div>

      <!-- ── LOADING STATE ── -->
      <div id="authLoading" style="display:none;text-align:center;padding:40px 20px">
        <div class="auth-spinner-ring"></div>
        <p style="margin-top:14px;color:#4a5568;font-size:.85rem">Signing you in...</p>
      </div>

    </div>
  </div>`;
  // Append to <html> not <body> — position:fixed in body is broken by
  // transforms, backdrop-filter, and iOS scroll-position tricks.
  // Children of <html> are ALWAYS positioned relative to the true viewport.
  document.documentElement.appendChild(el.firstElementChild);
})();

// ── Show guest bar IMMEDIATELY (buttons visible from first paint) ──
// auth.onAuthStateChanged fires async (~200ms). Without this, the
// user bar is completely empty on load — sign-in/up buttons invisible.
updateUserBar(null);

// ── Auth State Listener — updates bar when auth resolves ──────────
auth.onAuthStateChanged(user => {
  currentUser = user;
  updateUserBar(user);
  loadMe(user);                                       // your own photo (or initials) on the Me button
  if (window.gNotif) window.gNotif.start(user);       // notification bell (no-op when signed out)
  if (window.gPush) window.gPush.sync(user);          // phone notifications: keep this device registered
});

// ── "Me": wherever the site means "you" (the Me tab, the round badge in the top bar, the
//    profile button on inner pages) it shows your own yearbook photo, or your initials when
//    you have none, instead of a generic person icon. Signed out, the icon stays. ──────
const _ME_KEY = 'gluk-me', _ME_MS = 10 * 60000;      // looked up once, then kept for 10 minutes
let _me = null;                                      // { uid, photo, initials, at } for the signed-in person
const _initials = n => (String(n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();
const _meUrl = u => (/^https:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');

function paintMe() {
  const on = !!(_me && currentUser && _me.uid === currentUser.uid);
  const face = !on ? '' : _me.photo
    ? `<img class="me-face" src="${_ubEsc(_me.photo)}" alt="" decoding="async">`
    : `<span class="me-face me-ini">${_ubEsc(_me.initials)}</span>`;
  document.querySelectorAll('[data-me-face]').forEach(slot => {
    if (slot.dataset.icon === undefined) slot.dataset.icon = slot.innerHTML;   // the generic icon, for signing out
    slot.innerHTML = on ? face : slot.dataset.icon;
    slot.classList.toggle('has-me', on);
  });
}

async function loadMe(user, fresh) {
  _me = null;
  if (!user) { try { sessionStorage.removeItem(_ME_KEY); } catch (e) {} paintMe(); return; }
  try {
    const c = JSON.parse(sessionStorage.getItem(_ME_KEY) || 'null');
    if (!fresh && c && c.uid === user.uid && Date.now() - c.at < _ME_MS) { _me = c; paintMe(); return; }
  } catch (e) { /* nothing kept */ }
  _me = { uid: user.uid, photo: '', initials: _initials(user.displayName || String(user.email || '').split('@')[0]), at: Date.now() };
  paintMe();                                         // initials straight away; the photo follows
  // supabase.js and app.js load after this file: wait for them when sign-in resolves first
  if (typeof supabase === 'undefined' || !window.gApi) {
    await new Promise(r => document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true }));
  }
  try {
    const { data, error } = await supabase.from('profiles_public').select('name,photo_url').eq('uid', user.uid).limit(1);
    if (error) throw error;
    let row = data && data[0];
    if (!row && window.gApi) row = (await window.gApi('staff.mine', {})).staff;   // lecturers and staff
    if (row) { _me.photo = _meUrl(row.photo_url); if (row.name) _me.initials = _initials(row.name); }
    if (currentUser && currentUser.uid === user.uid) {
      try { sessionStorage.setItem(_ME_KEY, JSON.stringify(_me)); } catch (e) {}
    }
  } catch (e) { console.warn('[me]', e); }           // keep the initials; try again on the next page
  if (currentUser && currentUser.uid === user.uid) paintMe();
}
window.gMe = { paint: paintMe, refresh: () => loadMe(currentUser, true) };

// ── Update user bar on every page ─────────────────
function updateUserBar(user) {
  const bar = document.getElementById('userBar');
  if (!bar) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const themeIcon = isDark ? '☀️' : '🌙';
  const themeTitle = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  const themeBtn = `<button class="ub-theme-btn" onclick="toggleTheme()" title="${themeTitle}">${themeIcon}</button>`;
  if (user) {
    const name    = user.displayName || user.email.split('@')[0];
    const initial = _ubEsc(name.charAt(0).toUpperCase());
    const safeName = _ubEsc(name);
    const bellBtn = `<button type="button" class="ub-bell" id="ubBell" onclick="openNotifications()" aria-label="Notifications">🔔<span class="ub-bell-badge" id="notifBadge" style="display:none">0</span></button>`;
    const isAdmin = user.email === ADMIN_EMAIL;
    bar.innerHTML = `
      <div class="ub-left">
        <img class="ub-logo ub-logo-auth" src="logo-64.png" alt="GLUK" width="29" height="26">
        <div class="ub-avatar" data-me-face>${initial}</div>
        <span class="ub-name">${safeName}</span>
        ${isAdmin ? '<span class="ub-admin-badge">Admin</span>' : ''}
      </div>
      <div class="ub-right">
        ${bellBtn}
        ${themeBtn}
        ${isAdmin ? '<a href="admin.html" class="ub-btn ub-admin-btn">🛠 Admin</a>' : ''}
        <button class="ub-btn ub-logout" onclick="logOut()">Sign Out</button>
      </div>`;
    paintMe();
  } else {
    bar.innerHTML = `
      <div class="ub-left">
        <img class="ub-logo" src="logo-64.png" alt="GLUK" width="29" height="26">
        <span class="ub-guest">GLUK Yearbook 2026</span>
      </div>
      <div class="ub-right">
        ${themeBtn}
        <button class="ub-btn ub-signin" onclick="openAuthModal(null,'signup')">Sign Up</button>
        <button class="ub-btn ub-signin-outline" onclick="openAuthModal(null,'login')">Sign In</button>
      </div>`;
  }
  if (window.gNotif) window.gNotif.paintBadge();      // re-show the unread count after the bar is redrawn
}

// ── Open / Close Modal ─────────────────────────────
// ── iOS-correct scroll lock ───────────────────────
let _savedScrollY = 0;
function _lockScroll() {
  _savedScrollY = window.scrollY;
  // Use overflow:hidden on html element — avoids position:fixed on body
  // which would break all position:fixed children (including the overlay itself)
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.height   = '100%';
}
function _unlockScroll() {
  document.documentElement.style.overflow = '';
  document.documentElement.style.height   = '';
}

function openAuthModal(callback = null, tab = 'login') {
  _afterLogin = callback;
  _defaultTab = tab;
  clearErrors();
  switchAuthTab(tab);
  const overlay = document.getElementById('authOverlay');
  if (overlay) {
    // Never toggle display — overlay stays display:flex always (iOS Safari fix).
    // Visibility is controlled exclusively via opacity + pointer-events in CSS.
    requestAnimationFrame(() => overlay.classList.add('auth-visible'));
  }
  _lockScroll();
}

function closeAuthModal() {
  const overlay = document.getElementById('authOverlay');
  if (overlay) {
    overlay.classList.remove('auth-visible');
    // No display:none — overlay stays flex, hidden via opacity+pointer-events
  }
  _unlockScroll();
  showAuthPanel();
  hidePasswords();
  _afterLogin = null;
}

function handleAuthOverlayClick(e) {
  if (e.target === document.getElementById('authOverlay')) closeAuthModal();
}

function switchAuthTab(tab) {
  const loginPanel  = document.getElementById('authLogin');
  const signupPanel = document.getElementById('authSignup');
  const tabLogin    = document.getElementById('authTabLogin');
  const tabSignup   = document.getElementById('authTabSignup');
  clearErrors();
  if (tab === 'login') {
    loginPanel.style.display  = 'block';
    signupPanel.style.display = 'none';
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
  } else {
    loginPanel.style.display  = 'none';
    signupPanel.style.display = 'block';
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
  }
}

// ── Auth Actions ───────────────────────────────────
async function emailLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) return showError('login', 'Please enter your email and password.');
  showLoading();
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    onAuthDone();
  } catch (e) {
    showAuthPanel();
    showError('login', firebaseMsg(e));
  }
}

async function emailSignup() {
  const name  = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass  = document.getElementById('signupPass').value;
  if (!name)          return showError('signup', 'Please enter your full name.');
  if (!email)         return showError('signup', 'Please enter your email.');
  if (pass.length < 6)return showError('signup', 'Password must be at least 6 characters.');
  showLoading();
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    currentUser = auth.currentUser;
    onAuthDone();
  } catch (e) {
    showAuthPanel();
    showError('signup', firebaseMsg(e));
  }
}

async function signInWithGoogle() {
  showLoading();
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
    onAuthDone();
  } catch (e) {
    showAuthPanel();
    if (e.code !== 'auth/popup-closed-by-user') {
      showError(_defaultTab, firebaseMsg(e));
    }
  }
}

async function logOut() {
  if (window.gPush) await window.gPush.forget();      // this device stops getting this person's notifications
  await auth.signOut();
  window.location.reload();
}

function onAuthDone() {
  currentUser = auth.currentUser;
  closeAuthModal();
  updateUserBar(currentUser);
  if (typeof _afterLogin === 'function') {
    const cb = _afterLogin;
    _afterLogin = null;
    cb();
  }
}

// ── Forgot password ────────────────────────────────
// Uses the email typed in the sign-in box. A 60-second cooldown stops
// repeated taps (repeated sends can get throttled by Firebase).
let _lastReset = 0;
async function forgotPassword() {
  clearErrors();
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) return showError('login', 'Type your email above first, then tap "Forgot password?".');
  const wait = 60000 - (Date.now() - _lastReset);
  if (wait > 0) return showError('login', `Reset email already sent. Please wait ${Math.ceil(wait / 1000)}s before trying again.`);
  try {
    await auth.sendPasswordResetEmail(email);
    _lastReset = Date.now();
    const notice = document.getElementById('loginNotice');
    if (notice) {
      notice.textContent = `If an account exists for ${email}, a reset link is on its way. Check your inbox and your spam/promotions folder. Signed up with Google? Use "Continue with Google" instead.`;
      notice.style.display = 'block';
    }
  } catch (e) {
    showError('login', firebaseMsg(e));
  }
}

// ── requireAuth guard ──────────────────────────────
function requireAuth(callback, tab = 'login') {
  if (currentUser) { callback(); }
  else { openAuthModal(callback, tab); }
}

// ── Helpers ────────────────────────────────────────
function showLoading() {
  document.getElementById('authLogin').style.display   = 'none';
  document.getElementById('authSignup').style.display  = 'none';
  document.getElementById('authLoading').style.display = 'block';
}

function showAuthPanel() {
  document.getElementById('authLoading').style.display = 'none';
  switchAuthTab(_defaultTab);
}

function showError(panel, msg) {
  const id = panel === 'login' ? 'loginError' : 'signupError';
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearErrors() {
  const _n = document.getElementById('loginNotice');
  if (_n) { _n.textContent = ''; _n.style.display = 'none'; }
  ['loginError','signupError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  });
}

function firebaseMsg(err) {
  const map = {
    'auth/user-not-found':        'No account found with this email.',
    'auth/wrong-password':        'Incorrect password. Please try again.',
    'auth/email-already-in-use':  'This email is already registered. Sign in instead.',
    'auth/invalid-email':         'Please enter a valid email address.',
    'auth/weak-password':         'Password must be at least 6 characters.',
    'auth/network-request-failed':'Network error. Check your internet connection.',
    'auth/too-many-requests':     'Too many attempts. Please wait a moment.',
    'auth/invalid-credential':    'Incorrect email or password.',
    'auth/popup-blocked':         'Popup was blocked. Allow popups and try again.',
    'auth/unauthorized-domain':   'Google sign-in is not allowed from this web address. Use the live site, or open the local site at localhost instead of 127.0.0.1.',
  };
  return map[err.code] || 'Something went wrong. Please try again.';
}

// ── Expose globals ─────────────────────────────────
window.openAuthModal           = openAuthModal;
window.closeAuthModal          = closeAuthModal;
window.handleAuthOverlayClick  = handleAuthOverlayClick;
window.switchAuthTab           = switchAuthTab;
window.togglePasswordShown     = togglePasswordShown;
window.emailLogin              = emailLogin;
window.emailSignup             = emailSignup;
window.signInWithGoogle        = signInWithGoogle;
window.logOut                  = logOut;
window.requireAuth             = requireAuth;
window.forgotPassword           = forgotPassword;