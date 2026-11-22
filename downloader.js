// ============================================================
//  JEKETI RHYTHM — downloader.js  (first-launch download)
//  Step 1 (shows a loading screen, first launch only): UI images, song covers, card images and the starter songs.
//  Step 2 (quiet, in the background): every other song, one at a time, paused while a song is being played.
//  Everything is saved on the device through sw.js. If anything here fails, the game simply works as before
//  (files that are not saved yet just stream from the internet).
//  Emergency off switch: ?nosw
// ============================================================
(() => {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol === 'file:' || /[?&]nosw/.test(location.search)) return;
  if (!Array.isArray(window.SONGS)) return;

  // ---------- WHAT TO DOWNLOAD (edit here) ----------
  const PACK_ID = 'p1';                                   // change it to show the loading screen again to everybody
  const STARTER_SONGS = ['ayo_senyumlah', 'wakaka_people', '12_seconds'];   // downloaded in step 1, before the game opens
  const UI_IMAGES = [
    'title.gif', 'play.webp', 'back.webp', 'pick-song.gif', 'shop.gif', 'my-cards.gif', 'cards-shop.gif',
    'exit.gif', 'finish.gif', 'game-over.gif', 'play-again.gif'
  ];
  // card pictures (images/cards/<name>.webp). When you add a card, add its name here.
  // A card that is not listed still works: it just loads from the internet like before.
  const CARDS = [
    'anindya', 'aralie', 'bernadya', 'christy', 'cynthia', 'daisy', 'danella', 'delynn', 'dream_back', 'eli', 'elin',
    'ella', 'erine', 'feni', 'fiony', 'freya', 'fritzy', 'gita', 'gracie', 'greesel', 'indah', 'jessi', 'kathrina',
    'kimmy', 'lana', 'levi', 'lia', 'lily', 'love_back', 'lulu', 'lyn', 'marsha', 'michie', 'muthe', 'nachia', 'nala',
    'nayla', 'oline', 'olla', 'oniel', 'passion_back', 'pia', 'raisha', 'ribka', 'trisha'
  ];
  const STEP1_PARALLEL = 4;                               // small files, a few at a time
  const MIN_FREE_MB = 120;                                // step 2 stops when the phone has less free space than this
  // --------------------------------------------------

  const FLAG = 'jeketi.pack.' + PACK_ID;
  const abs = (u) => new URL(u, document.baseURI).href;
  const uniq = (a) => Array.from(new Set(a));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const mb = (b) => (b / 1048576).toFixed(b < 10485760 ? 1 : 0);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  const starter = window.SONGS.filter((s) => STARTER_SONGS.indexOf(s.id) >= 0);
  const later = window.SONGS.filter((s) => STARTER_SONGS.indexOf(s.id) < 0);
  const songFiles = (s) => [s.chart && !Array.isArray(s.chart) ? s.chart : null, s.audio].filter(Boolean);

  const STEP1 = uniq([].concat(
    UI_IMAGES.map((n) => 'images/' + n),
    window.SONGS.map((s) => s.cover).filter(Boolean),
    CARDS.map((n) => 'images/cards/' + n + '.webp'),
    [].concat.apply([], starter.map(songFiles))
  )).map(abs);

  // ---------- screen ----------
  let ui = null;
  function css() {
    if (document.getElementById('dl-css')) return;
    const s = document.createElement('style');
    s.id = 'dl-css';
    s.textContent = [
      '#dl-screen{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;',
      'background:radial-gradient(ellipse at 50% 40%,#2f5a40 0%,#1d3a2a 55%,#16261c 100%);color:#f3ecd8;',
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;transition:opacity .45s}',
      '#dl-screen.dl-out{opacity:0;pointer-events:none}',
      '#dl-card{width:min(88%,720px);text-align:center}',
      '#dl-title{font-size:clamp(26px,4.6vw,64px);font-weight:800;letter-spacing:.04em;margin:0 0 .25em}',
      '#dl-sub{font-size:clamp(16px,2.1vw,30px);opacity:.85;margin:0 0 1.4em;line-height:1.35}',
      '#dl-bar{height:clamp(14px,1.9vw,26px);border-radius:99px;background:rgba(0,0,0,.35);overflow:hidden;',
      'box-shadow:inset 0 0 0 2px rgba(243,236,216,.25)}',
      '#dl-fill{height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#e9c46a,#f4a261);transition:width .25s}',
      '#dl-info{font-size:clamp(14px,1.8vw,26px);margin-top:.9em;opacity:.9;font-variant-numeric:tabular-nums}',
      '#dl-note{font-size:clamp(13px,1.5vw,22px);margin-top:1.6em;opacity:.65}',
      '#dl-btns{margin-top:1.4em;display:none;gap:14px;justify-content:center}',
      '#dl-btns button{font:inherit;font-weight:700;font-size:clamp(15px,1.9vw,26px);padding:.55em 1.3em;border-radius:99px;',
      'border:2px solid #f3ecd8;background:transparent;color:#f3ecd8;cursor:pointer}',
      '#dl-btns button.dl-main{background:#f3ecd8;color:#1d3a2a}',
      '#dl-pill{position:fixed;bottom:calc(8px + env(safe-area-inset-bottom,0px));right:8px;z-index:2147482000;max-width:70%;padding:5px 12px;border-radius:99px;',
      'background:rgba(22,38,28,.82);color:#f3ecd8;font:600 13px/1.3 system-ui,sans-serif;pointer-events:none;',
      'opacity:0;transition:opacity .4s}',
      '#dl-pill.dl-on{opacity:1}'
    ].join('');
    document.head.appendChild(s);
  }
  function showScreen() {
    if (ui) return;
    css();
    const el = document.createElement('div');
    el.id = 'dl-screen';
    el.innerHTML =
      '<div id="dl-card"><h1 id="dl-title">JEKETI RHYTHM</h1>' +
      '<p id="dl-sub">Getting the game ready.<br>This only happens the first time.</p>' +
      '<div id="dl-bar"><div id="dl-fill"></div></div>' +
      '<div id="dl-info">Starting…</div>' +
      '<div id="dl-btns"><button class="dl-main" id="dl-retry">Try again</button><button id="dl-skip">Play anyway</button></div>' +
      '<div id="dl-note">Wi-Fi is recommended</div></div>';
    document.body.appendChild(el);
    ui = {
      el, fill: el.querySelector('#dl-fill'), info: el.querySelector('#dl-info'), sub: el.querySelector('#dl-sub'),
      btns: el.querySelector('#dl-btns'), retry: el.querySelector('#dl-retry'), skip: el.querySelector('#dl-skip')
    };
  }
  function hideScreen() {
    if (!ui) return;
    const el = ui.el; ui = null;
    el.classList.add('dl-out');
    setTimeout(() => el.remove(), 600);
  }
  let pill = null, pillTimer = null;
  function say(text, hideAfter) {
    css();
    if (!pill) { pill = document.createElement('div'); pill.id = 'dl-pill'; document.body.appendChild(pill); }
    pill.textContent = text;
    pill.classList.add('dl-on');
    clearTimeout(pillTimer);
    if (hideAfter) pillTimer = setTimeout(() => pill && pill.classList.remove('dl-on'), hideAfter);
  }
  function quiet() { clearTimeout(pillTimer); if (pill) pill.classList.remove('dl-on'); }

  // ---------- talking to sw.js ----------
  function getSW() {
    return Promise.race([
      navigator.serviceWorker.ready.then((r) => r.active || navigator.serviceWorker.controller),
      sleep(10000).then(() => null)
    ]);
  }
  function ask(sw, msg, ms) {
    return new Promise((resolve) => {
      let done = false;
      const ch = new MessageChannel();
      const finish = (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } };
      const t = setTimeout(() => finish(null), ms || 180000);
      ch.port1.onmessage = (e) => finish(e.data);
      try { sw.postMessage(msg, [ch.port2]); } catch (e) { finish(null); }
    });
  }
  async function missingOf(sw, urls) {
    const r = await ask(sw, { type: 'pack-status', urls }, 20000);
    return r && Array.isArray(r.missing) ? r.missing : urls.slice();
  }
  // guard = true (step 2): while this file downloads, a song that starts stops it at once (pack-abort). The file is then tried
  // again after the song, and that does not count as a failed attempt.
  async function fetchOne(sw, url, guard) {
    for (let i = 0; i < 3; i++) {
      let watch = 0;
      const stop = () => { try { sw.postMessage({ type: 'pack-abort' }); } catch (e) { /* ignore */ } };
      if (guard) { watch = setInterval(() => { if (gameBusy()) stop(); }, 250); addEventListener('jeketi:busy', stop); }
      let r;
      try { r = await ask(sw, { type: 'pack-fetch', url }); }
      finally { if (guard) { clearInterval(watch); removeEventListener('jeketi:busy', stop); } }
      if (r && r.ok) return r;
      if (guard && r && r.aborted) {
        quiet();
        while (gameBusy() || document.hidden) await sleep(1500);
        i--; continue;
      }
      if (i < 2) await sleep(1200 * (i + 1));
      if (navigator.onLine === false) await new Promise((res) => addEventListener('online', res, { once: true }));
    }
    return { ok: false };
  }

  // ---------- step 1 ----------
  async function step1(sw, visible) {
    let missing = await missingOf(sw, STEP1);
    const total = STEP1.length;
    let done = total - missing.length, bytes = 0, failed = [], skipped = false;
    const paint = () => {
      if (visible && ui) {
        ui.fill.style.width = (total ? Math.round(done / total * 100) : 100) + '%';
        ui.info.textContent = done + ' / ' + total + ' files' + (bytes ? '  ·  ' + mb(bytes) + ' MB' : '');
      } else if (!visible && missing.length) {
        say('Updating game data… ' + done + ' / ' + total);
      }
    };
    if (visible && ui) ui.skip.onclick = () => { skipped = true; hideScreen(); };
    for (;;) {
      const queue = missing.slice();
      failed = [];
      paint();
      const worker = async () => {
        while (queue.length) {
          const url = queue.shift();
          const r = await fetchOne(sw, url);
          if (r.ok) { done++; bytes += r.bytes || 0; } else failed.push(url);
          paint();
        }
      };
      await Promise.all(Array.from({ length: STEP1_PARALLEL }, worker));
      if (!failed.length || skipped) break;
      if (!visible) break;                          // silent run: the next launch tries again
      // some files did not arrive: let the player choose
      if (ui) {
        ui.sub.innerHTML = 'Some files did not download.<br>Check your connection.';
        ui.info.textContent = done + ' / ' + total + ' files';
        ui.btns.style.display = 'flex';
        await new Promise((res) => { ui.retry.onclick = () => { ui.btns.style.display = 'none'; ui.sub.innerHTML = 'Getting the game ready.<br>This only happens the first time.'; res(); }; ui.skip.onclick = () => { skipped = true; hideScreen(); res(); }; });
        if (skipped) break;
      }
      missing = failed.slice();
    }
    store.set(FLAG, '1');
    hideScreen();
    if (!visible) quiet();
  }

  // ---------- step 2 ----------
  // "in a song" = playing / paused / starting, AND the moment a song is picked while its chart is still loading (game.js: playBusy)
  const gameBusy = () => { try { return typeof playBusy === 'function' ? playBusy() : (typeof mode !== 'undefined' && mode !== 'idle'); } catch (e) { return false; } };
  async function lowStorage() {
    try {
      const e = await navigator.storage.estimate();
      return !!(e && e.quota && (e.quota - (e.usage || 0)) < MIN_FREE_MB * 1048576);
    } catch (e) { return false; }
  }
  async function step2(sw) {
    const c = navigator.connection;
    if (c && c.saveData) return;                                   // the player turned on Data Saver: do not download extra
    const songs = later.filter((s) => s.audio);
    const list = [].concat.apply([], songs.map(songFiles)).map(abs);
    const missing = new Set(await missingOf(sw, list));
    const todo = songs.filter((s) => songFiles(s).some((f) => missing.has(abs(f))));
    if (!todo.length) return;
    const total = songs.length;
    let have = total - todo.length;
    for (const s of todo) {
      while (gameBusy() || document.hidden) { quiet(); await sleep(2500); }    // never compete with a song that is playing (and no pill on screen during play)
      if (await lowStorage()) { say('Storage almost full: the other songs will stream instead', 6000); return; }
      say('Downloading songs… ' + have + ' / ' + total);
      let ok = true;
      for (const f of songFiles(s)) {
        const r = await fetchOne(sw, abs(f), true);
        if (!r.ok) { ok = false; break; }
      }
      if (ok) have++; else { say('Download paused: connection problem. It will continue next time.', 5000); return; }
    }
    say('All songs downloaded ✓', 3500);
  }

  // ---------- start ----------
  async function run() {
    const first = !store.get(FLAG);
    if (first) { showScreen(); }
    const sw = await getSW();
    if (!sw) { hideScreen(); return; }                             // no service worker: the game works as before
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
    await step1(sw, first);
    await sleep(1500);
    await step2(sw);
  }
  const start = () => run().catch(() => { hideScreen(); quiet(); });
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);

  window.JeketiPack = { step1Files: STEP1.length, reset: () => { try { localStorage.removeItem(FLAG); } catch (e) { /* ignore */ } } };
})();