(() => {
  'use strict';
  const CURRENT = Number(window.GAME_VERSION) || 0;
  if (!CURRENT || location.protocol === 'file:') return;

  const CHECK_EVERY_MS = 5 * 60 * 1000;
  const RETRY_MS = 8000;
  const MIN_GAP_MS = 20 * 1000;
  const GUARD = 'jeketi.updTried';
  let latest = CURRENT, lastCheck = 0, waiting = null, checking = false;

  function safeToReload() {
    try {
      if (typeof mode !== 'undefined' && mode !== 'idle') return false;
      const r = document.getElementById('results');
      if (r && r.classList.contains('show')) return false;
      if (document.getElementById('pack-overlay')) return false;
      if (document.querySelector('.cmb')) return false;
      const v = document.getElementById('card-viewer');
      if (v && v.classList.contains('show')) return false;
    } catch (e) {  }
    return true;
  }

  function reloadNow() {
    try { sessionStorage.setItem(GUARD, String(latest)); } catch (e) {  }
    const u = new URL(location.href);
    u.searchParams.set('_u', String(latest));
    location.replace(u.href);
  }

  function applyWhenSafe() {
    if (latest <= CURRENT) return;
    let tried = null;
    try { tried = sessionStorage.getItem(GUARD); } catch (e) {  }
    if (tried && Number(tried) >= latest) return;
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
    } catch (e) {  }
    finally { checking = false; }
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
  window.addEventListener('online', () => check(true));
  window.addEventListener('pageshow', (e) => { if (e.persisted) check(true); });
  setInterval(() => check(false), CHECK_EVERY_MS);
  check(true);

  window.GameUpdater = { check: () => check(true), current: CURRENT, get latest() { return latest; } };
})();