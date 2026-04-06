// =====================================================
//  GLUK YEARBOOK 2026 — AUTH MODULE
//  Handles: login, signup, Google sign-in, logout,
//           user bar rendering, auth modal injection
// =====================================================
'use strict';

// ── State ──────────────────────────────────────────
let currentUser   = null;
let _afterLogin   = null;   // callback to run after successful auth
let _defaultTab   = 'login';

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
        <div class="auth-crest">G</div>
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
          <input type="password" id="loginPass" placeholder="••••••••" autocomplete="current-password">
        </div>

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
          <input type="password" id="signupPass" placeholder="••••••••" autocomplete="new-password">
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
  document.body.appendChild(el.firstElementChild);
})();

// ── Auth State Listener ────────────────────────────
auth.onAuthStateChanged(user => {
  currentUser = user;
  updateUserBar(user);
});

// ── Update user bar on every page ─────────────────
function updateUserBar(user) {
  const bar = document.getElementById('userBar');
  if (!bar) return;
  if (user) {
    const name    = user.displayName || user.email.split('@')[0];
    const initial = name.charAt(0).toUpperCase();
    const isAdmin = user.email === ADMIN_EMAIL;
    bar.innerHTML = `
      <div class="ub-left">
        <div class="ub-avatar">${initial}</div>
        <span class="ub-name">${name}</span>
        ${isAdmin ? '<span class="ub-admin-badge">Admin</span>' : ''}
      </div>
      <div class="ub-right">
        ${isAdmin ? '<a href="admin.html" class="ub-btn ub-admin-btn">🛠 Admin</a>' : ''}
        <button class="ub-btn ub-logout" onclick="logOut()">Sign Out</button>
      </div>`;
  } else {
    bar.innerHTML = `
      <div class="ub-left">
        <span class="ub-guest">GLUK Yearbook 2026</span>
      </div>
      <div class="ub-right">
        <button class="ub-btn ub-signin" onclick="openAuthModal(null,'signup')">Sign Up</button>
        <button class="ub-btn ub-signin-outline" onclick="openAuthModal(null,'login')">Sign In</button>
      </div>`;
  }
}

// ── Open / Close Modal ─────────────────────────────
function openAuthModal(callback = null, tab = 'login') {
  _afterLogin = callback;
  _defaultTab = tab;
  clearErrors();
  switchAuthTab(tab);
  const overlay = document.getElementById('authOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('auth-visible'), 10);
  }
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  const overlay = document.getElementById('authOverlay');
  if (overlay) {
    overlay.classList.remove('auth-visible');
    setTimeout(() => { overlay.style.display = 'none'; }, 250);
  }
  document.body.style.overflow = '';
  showAuthPanel();
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
  };
  return map[err.code] || 'Something went wrong. Please try again.';
}

// ── Expose globals ─────────────────────────────────
window.openAuthModal           = openAuthModal;
window.closeAuthModal          = closeAuthModal;
window.handleAuthOverlayClick  = handleAuthOverlayClick;
window.switchAuthTab           = switchAuthTab;
window.emailLogin              = emailLogin;
window.emailSignup             = emailSignup;
window.signInWithGoogle        = signInWithGoogle;
window.logOut                  = logOut;
window.requireAuth             = requireAuth;