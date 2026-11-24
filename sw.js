/* JEKETI RHYTHM service worker: keeps images, sounds, charts and song audio on the player's device.
 *
 * SAFE MODE: it never touches the game's own code. html, css, manifest and the game's scripts (game.js, songs.js, ...)
 * always come straight from the network / browser exactly as before, so an update to them can never be held back.
 *
 *  - images, fonts, charts: shown instantly from the device
 *  - song audio: saved in full (by the downloader, or once the player lingers on a song), then served from the device,
 *    including the range requests <audio> makes.
 *  - "pack-abort": the game asks this worker to stop every download in flight (pack files and keep-audio) the moment a song
 *    starts, so nothing competes with the song. Nothing half-saved is ever kept; downloader.js simply tries again after the song.
 *  - NEW: "pack" downloads. downloader.js asks this worker to fetch a list of files one by one (pack-fetch) and to
 *    report which files are still missing (pack-status). Pack images and charts live in their own cache (PACK) that
 *    game updates do NOT clear, so players don't re-download everything every time you bump version.js.
 *
 * If you replace a song's audio file with a different one under the SAME name, bump AUDIO_VERSION.
 * If you replace an IMAGE under the same name, bump PACK_VERSION (charts refresh by themselves).
 * Emergency off switch: open the game with ?nosw
 */
// the game registers this file as sw.js?v=<GAME_VERSION> (version.js): every game update installs a fresh worker and
// clears the saved images / charts of the old kind (MEDIA). Pack files and song audio are big, so they are NOT cleared.
const GAME_V = new URL(self.location.href).searchParams.get('v') || '0';
const AUDIO_VERSION = 'v2';        // bump ONLY if you replace a song's audio file under the same name
const PACK_VERSION = 'p1';         // bump ONLY if you replace an image under the same name (everyone re-downloads it)
const MEDIA = 'jeketi-media-' + GAME_V;
const AUDIO = 'jeketi-audio-' + AUDIO_VERSION;
const PACK = 'jeketi-pack-' + PACK_VERSION;
const packCtl = new Set();         // AbortControllers of the downloads in flight (pack-fetch and keep-audio)
function abortDownloads() { packCtl.forEach((c) => { try { c.abort(); } catch (err) { /* ignore */ } }); packCtl.clear(); }
const MAX_SONGS = 500;             // oldest saved songs are dropped beyond this (was 30: too small for a full download)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('jeketi-') && k !== MEDIA && k !== AUDIO && k !== PACK) await caches.delete(k);
    await self.clients.claim();
  })());
});

// the game's own scripts: never handled here
const CODE_JS = /\/(game|songs|sfx|points|cards|packs|shop|daily|sw|version|updater|leaderboard|downloader)\.js$/i;
const isAudio = (u) => /\.(mp3|ogg|m4a|aac|wav|opus|flac)$/i.test(u.pathname);
const isChart = (u) => /\/charts\/[^/]+\.js$/i.test(u.pathname);
const isMedia = (u) => /\.(png|jpe?g|gif|webp|avif|svg|ico|otf|ttf|woff2?)$/i.test(u.pathname) || (/\.js$/i.test(u.pathname) && !CODE_JS.test(u.pathname));   // last one = chart files
const keyOf = (u) => new Request(u.origin + u.pathname);       // cache key without ?query

self.addEventListener('message', (e) => {
  const d = e.data || {};
  const port = e.ports && e.ports[0];
  if (d.type === 'pack-abort') { abortDownloads(); if (port) port.postMessage({ ok: true }); }
  else if (d.type === 'keep-audio' && d.url) e.waitUntil(keepAudio(d.url));
  else if (d.type === 'pack-status' && Array.isArray(d.urls)) e.waitUntil(packStatus(d.urls).then((r) => port && port.postMessage(r)));
  else if (d.type === 'pack-fetch' && d.url) e.waitUntil(packFetch(d.url).then((r) => port && port.postMessage(r)));
});

async function trimAudio(cache) {
  const keys = await cache.keys();                               // oldest first
  for (let i = 0; i < keys.length - MAX_SONGS; i++) await cache.delete(keys[i]);
}

async function keepAudio(url) {
  const ac = new AbortController();
  packCtl.add(ac);
  try {
    const u = new URL(url);
    if (u.origin !== location.origin) return;
    const cache = await caches.open(AUDIO), key = keyOf(u);
    if (await cache.match(key)) return;
    const res = await fetch(u.href, { cache: 'no-store', signal: ac.signal });     // no Range header: the whole file
    if (!res.ok || res.status !== 200) return;
    await cache.put(key, res);
    await trimAudio(cache);
  } catch (err) { /* offline, blocked or stopped because a song started: audio simply streams as usual */ }
  finally { packCtl.delete(ac); }
}

// ---- pack downloads (see downloader.js) ----
async function isSaved(u) {
  const key = keyOf(u);
  if (isAudio(u)) return !!(await (await caches.open(AUDIO)).match(key));
  return !!(await (await caches.open(PACK)).match(key)) || !!(await (await caches.open(MEDIA)).match(key));
}

async function packStatus(urls) {
  const missing = [];
  for (const url of urls) {
    try { if (!(await isSaved(new URL(url)))) missing.push(url); } catch (err) { missing.push(url); }
  }
  return { missing };
}

async function packFetch(url) {
  const ac = new AbortController();
  packCtl.add(ac);
  try {
    const u = new URL(url);
    if (u.origin !== location.origin) return { ok: false };
    if (await isSaved(u)) return { ok: true, skipped: true, bytes: 0 };
    const audio = isAudio(u);
    const res = await fetch(u.href, audio ? { cache: 'no-store', signal: ac.signal } : { signal: ac.signal });
    if (!res.ok || res.status !== 200) return { ok: false };
    const bytes = Number(res.headers.get('content-length')) || 0;
    const cache = await caches.open(audio ? AUDIO : PACK);
    await cache.put(keyOf(u), res);                              // only stored when the whole file arrived
    if (audio) await trimAudio(cache);
    return { ok: true, bytes };
  } catch (err) { return { ok: false, aborted: ac.signal.aborted }; }   // offline / interrupted / stopped by pack-abort: nothing half-saved, the caller retries
  finally { packCtl.delete(ac); }
}

// range requests from a saved song. A Blob slice is read lazily, so the whole song is not copied into memory
// for every range request (this matters on low-memory phones)
async function rangeFrom(cached, rangeHeader) {
  const blob = await cached.blob();
  const size = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  let start = m && m[1] !== '' ? parseInt(m[1], 10) : 0;
  let end = m && m[2] !== '' ? parseInt(m[2], 10) : size - 1;
  if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Length': String(end - start + 1),
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Accept-Ranges': 'bytes',
    },
  });
}

async function audioResponse(req, u) {
  try {
    const cache = await caches.open(AUDIO);
    const cached = await cache.match(keyOf(u));
    if (cached) {
      const range = req.headers.get('range');
      return range ? await rangeFrom(cached.clone(), range) : cached;
    }
  } catch (err) { /* fall through to the network */ }
  return fetch(req);
}

async function mediaResponse(req, u, event) {
  let cache, hit, fromPack = false;
  try {
    const key = keyOf(u);
    const pack = await caches.open(PACK);
    hit = await pack.match(key);
    if (hit) { cache = pack; fromPack = true; }
    else { cache = await caches.open(MEDIA); hit = await cache.match(key); }
  } catch (err) { return fetch(req); }
  // CHARTS: network first, so an edited chart reaches players on their very next play. The saved copy is only used offline / on a failed request.
  if (isChart(u)) {
    try {
      const res = await fetch(req);
      if (res && res.ok && res.status === 200) { cache.put(keyOf(u), res.clone()).catch(() => {}); return res; }
      return hit || res;
    } catch (err) { if (hit) return hit; throw err; }
  }
  // downloaded pack images are served as they are (no network request each time = less work on slow phones).
  // charts are still refreshed quietly in the background, so a fixed chart reaches players.
  if (hit && fromPack && !isChart(u)) return hit;
  const refresh = fetch(req).then((res) => {
    if (res && res.ok && res.status === 200) cache.put(keyOf(u), res.clone()).catch(() => {});
    return res;
  });
  if (hit) { event.waitUntil(refresh.catch(() => {})); return hit; }
  return refresh;                                                // first time: plain network, saved on the way
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode === 'navigate') return;   // pages are never handled
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;                      // other sites (Google Fonts etc.): untouched
  if (isAudio(u)) { event.respondWith(audioResponse(req, u)); return; }
  if (isMedia(u)) { event.respondWith(mediaResponse(req, u, event)); return; }
});