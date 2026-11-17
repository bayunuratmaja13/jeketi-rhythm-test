/* JEKETI RHYTHM service worker: keeps images, sounds, charts and song audio on the player's device.
 *
 * SAFE MODE: it never touches the game's own code. html, css, manifest and the game's scripts (game.js, songs.js, ...)
 * always come straight from the network / browser exactly as before, so an update to them can never be held back.
 *
 *  - images, fonts, charts: shown instantly from the device, refreshed quietly in the background
 *  - song audio: saved in full once the player lingers on a song (the game asks for it), then served from the device,
 *    including the range requests <audio> makes. The oldest songs are dropped after MAX_SONGS.
 *
 * If you replace a song's audio file with a different one under the SAME name, bump VERSION.
 * Emergency off switch: open the game with ?nosw
 */
const VERSION = 'v2';
const MEDIA = 'jeketi-media-' + VERSION;
const AUDIO = 'jeketi-audio-' + VERSION;
const MAX_SONGS = 30;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('jeketi-') && k !== MEDIA && k !== AUDIO) await caches.delete(k);
    await self.clients.claim();
  })());
});

// the game's own scripts: never handled here
const CODE_JS = /\/(game|songs|sfx|points|cards|packs|shop|daily|sw)\.js$/i;
const isAudio = (u) => /\.(mp3|ogg|m4a|aac|wav|opus|flac)$/i.test(u.pathname);
const isMedia = (u) => /\.(png|jpe?g|gif|webp|avif|svg|ico|otf|ttf|woff2?)$/i.test(u.pathname) || (/\.js$/i.test(u.pathname) && !CODE_JS.test(u.pathname));   // last one = chart files
const keyOf = (u) => new Request(u.origin + u.pathname);       // cache key without ?query

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'keep-audio' && d.url) e.waitUntil(keepAudio(d.url));
});

async function keepAudio(url) {
  try {
    const u = new URL(url);
    if (u.origin !== location.origin) return;
    const cache = await caches.open(AUDIO), key = keyOf(u);
    if (await cache.match(key)) return;
    const res = await fetch(u.href, { cache: 'no-store' });     // no Range header: the whole file
    if (!res.ok || res.status !== 200) return;
    await cache.put(key, res);
    const keys = await cache.keys();                             // oldest first
    for (let i = 0; i < keys.length - MAX_SONGS; i++) await cache.delete(keys[i]);
  } catch (err) { /* offline or blocked: audio simply streams as usual */ }
}

async function rangeFrom(cached, rangeHeader) {
  const buf = await cached.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  let start = m && m[1] !== '' ? parseInt(m[1], 10) : 0;
  let end = m && m[2] !== '' ? parseInt(m[2], 10) : size - 1;
  if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(buf.slice(start, end + 1), {
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
  let cache, hit;
  try { cache = await caches.open(MEDIA); hit = await cache.match(keyOf(u)); } catch (err) { return fetch(req); }
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