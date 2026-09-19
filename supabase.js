// =====================================================
//  GLUK YEARBOOK 2026 — SUPABASE CONFIG
//  Profiles + Photos → Supabase
//  Auth + Comments   → Firebase
//
//  ── TABLE SCHEMA (run fix-supabase.sql instead) ──
//  All column names are lowercase (PostgreSQL default):
//    classyear, bestmemory, biggestlesson,
//    mostlikelyto, isanonymous
//
//  ── RLS ──────────────────────────────────────────
//  ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
//
//  ── STORAGE ──────────────────────────────────────
//  Bucket: profile-photos   Public: YES
// =====================================================

const SUPABASE_URL = "https://erelegzvgxwxwroqjynw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWxlZ3p2Z3h3eHdyb3FqeW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0Njg0NTksImV4cCI6MjA5MTA0NDQ1OX0.Do1CnX1MxT9-rgT-zvgL92KcP7FRgCDHxKwdx5TYs1s";

// ── Chainable fallback stub ────────────────────────
// The real Supabase client returns a query-builder that
// is thenable (Promise-like) at the end of a chain.
// The old stub broke because select() returned a real
// Promise immediately, so .order()/.eq() failed on it.
// This stub is fully chainable AND thenable.
function _makeStub(msg) {
  const err = { message: msg || 'Supabase not loaded', code: 'PGRST_NOT_LOADED' };
  const stub = {
    // Query builder chain — all return `stub` so chaining works
    select:   function() { return stub; },
    insert:   function() { return stub; },
    update:   function() { return stub; },
    delete:   function() { return stub; },
    upsert:   function() { return stub; },
    eq:       function() { return stub; },
    neq:      function() { return stub; },
    gt:       function() { return stub; },
    lt:       function() { return stub; },
    gte:      function() { return stub; },
    lte:      function() { return stub; },
    like:     function() { return stub; },
    ilike:    function() { return stub; },
    in:       function() { return stub; },
    is:       function() { return stub; },
    order:    function() { return stub; },
    limit:    function() { return stub; },
    range:    function() { return stub; },
    single:   function() { return stub; },
    maybeSingle: function() { return stub; },
    head:     function() { return stub; },
    count:    function() { return stub; },
    // Thenable — makes `await stub` resolve with error payload
    then: function(resolve) {
      return Promise.resolve({ data: null, error: err, count: null }).then(resolve);
    },
    catch: function(reject) { return Promise.resolve().catch(reject); },
    finally: function(fn)   { return Promise.resolve().finally(fn); },
  };
  return stub;
}

// ── Initialise Supabase client ─────────────────────
// Script load order: Supabase CDN → supabase.js → app.js
// The CDN sets window.supabase = { createClient, ... }
// We replace it with the actual client instance here.
(function initSupabase() {
  if (window.supabase && typeof window.supabase.from === 'function') {
    // Already a live client (e.g. hot-reload scenario)
    console.log('[Supabase] Client already initialised.');
    return;
  }

  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          // Disable Supabase's own auth — we use Firebase Auth
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      console.log('[Supabase] Client ready.');
    } catch (e) {
      console.error('[Supabase] createClient failed:', e);
      _installStub('createClient error: ' + e.message);
    }
    return;
  }

  // CDN didn't load — install a stub so the rest of the app
  // degrades gracefully instead of throwing TypeError.
  console.error('[Supabase] CDN library not ready. Check internet connection and script load order.');
  _installStub('Supabase CDN not loaded');
})();

function _installStub(reason) {
  window.supabase = {
    from: function() { return _makeStub(reason); },
    storage: {
      from: function() {
        return {
          upload:       function() { return Promise.resolve({ data: null, error: { message: reason } }); },
          getPublicUrl: function() { return { data: { publicUrl: '' } }; },
          remove:       function() { return Promise.resolve({ data: null, error: { message: reason } }); },
        };
      },
    },
  };
}