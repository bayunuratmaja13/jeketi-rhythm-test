// ============================================================
//  JEKETI RHYTHM — updater.js  (automatic update, no manual refresh)
//  Compares this page's GAME_VERSION with the live version.js on the server. If the server has a newer one,
//  the page reloads itself, but only at a safe moment (never during a song, results, pack opening, ...).
// ============================================================
(() => {
  'use strict';
  const CURRENT = Number(window.GAME_VERSION) || 0;
  if (!CURRENT || location.protocol === 'file:') return;

  const CHECK_EVERY_MS = 5 * 60 * 1000;     // periodic check while the game stays open
  const RETRY_MS = 8000;                    // while an update waits for a safe moment
  const MIN_GAP_MS = 20 * 1000;             // never check more often than this
  const GUARD = 'jeketi.updTried';          // stops a reload loop if the server keeps serving old files
  let latest = CURRENT, lastCheck = 0, waiting = null, checking = false;

  function safeToReload() {
    try {
      if (typeof mode !== 'undefined' && mode !== 'idle') return false;                  // song / countdown / paused / game over
      const r = document.getElementById('results');
      if (r && r.classList.contains('show')) return false;                              // results screen
      if (document.getElementById('pack-overlay')) return false;                        // pack opening
      if (document.querySelector('.cmb')) return false;                                 // combine animation
      const v = document.getElementById('card-viewer');
      if (v && v.classList.contains('show')) return false;                              // card viewer
    } catch (e) { /* if unsure, treat as safe only when idle below */ }
    return true;
  }

  function reloadNow() {
    try { sessionStorage.setItem(GUARD, String(latest)); } catch (e) { /* ignore */ }
    const u = new URL(location.href);
    u.searchParams.set('_u', String(latest));         // new address = the page itself is fetched fresh too
    location.replace(u.href);
  }

  function applyWhenSafe() {
    if (latest <= CURRENT) return;
    let tried = null;
    try { tried = sessionStorage.getItem(GUARD); } catch (e) { /* ignore */ }
    if (tried && Number(tried) >= latest) return;      // already reloaded for this version once: don't loop
    if (safeToReload()) { reloadNow(); return; }
    clearTimeout(waiting);
    waiting = setTimeout(applyWhenSafe, RETRY_MS);
  }

  async function check(force) {
    if (checking) return;
    const now = Date.now();
    if (!force && now - lastCheck < MIN_GAP_MS) return;
    lastCheck = now; checking = true;
    try {
      const res = await fetch('version.js?t=' + now, { cache: 'no-store' });
      if (!res.ok) return;
      const m = /GAME_VERSION\s*=\s*(\d+)/.exec(await res.text());
      if (m) { latest = Math.max(latest, Number(m[1])); applyWhenSafe(); }
    } catch (e) { /* offline: try again later */ }
    finally { checking = false; }
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
  window.addEventListener('online', () => check(true));
  window.addEventListener('pageshow', (e) => { if (e.persisted) check(true); });
  setInterval(() => check(false), CHECK_EVERY_MS);
  check(true);                                         // right after the game opens

  window.GameUpdater = { check: () => check(true), current: CURRENT, get latest() { return latest; } };
})();