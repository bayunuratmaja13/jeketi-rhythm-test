/* JEKETI RHYTHM service worker: keeps the game on the player's device.
 *
 *  - code (html / js / css): network first, so a new version shows up right away; the saved copy is used offline / on slow networks
 *  - images, fonts, charts, sound effects: instant from the device, refreshed quietly in the background
 *  - song audio: saved in full once the player lingers on a song (the game asks for it), then always served from the
 *    device, including the range requests <audio> makes. Oldest songs are dropped after MAX_SONGS.
 *
 * If you replace a song's audio file with a different one under the SAME name, bump VERSION.
 */
const VERSION = 'v1';
const CODE = 'jeketi-code-' + VERSION;
const MEDIA = 'jeketi-media-' + VERSION;
const AUDIO = 'jeketi-audio-' + VERSION;
const MAX_SONGS = 30;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [CODE, MEDIA, AUDIO];
    for (const k of await caches.keys()) if (k.startsWith('jeketi-') && !keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isAudio = (u) => /\.(mp3|ogg|m4a|aac|wav|opus|flac)$/i.test(u.pathname);
const isCode = (u, req) => req.mode === 'navigate' || req.destination === 'document' || /\.(html|js|css|webmanifest|json)$/i.test(u.pathname) || u.pathname.endsWith('/');
// cache key without the query string (the game opens game.html?v=... and the like)
const keyOf = (u) => new Request(u.origin + u.pathname);

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
    const res = await fetch(u.href, { cache: 'no-store' });          // no Range header: the whole file
    if (!res.ok || res.status !== 200) return;
    await cache.put(key, res);
    const keys = await cache.keys();                                  // oldest first
    for (let i = 0; i < keys.length - MAX_SONGS; i++) await cache.delete(keys[i]);
  } catch (err) { /* offline or blocked: the browser still plays from the network */ }
}

async function rangeFrom(cached, rangeHeader) {
  const buf = await cached.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  let start = m && m[1] !== '' ? parseInt(m[1], 10) : 0;
  let end = m && m[2] !== '' ? parseInt(m[2], 10) : size - 1;
  if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }   // "last N bytes"
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
  const cache = await caches.open(AUDIO);
  const cached = await cache.match(keyOf(u));
  if (!cached) return fetch(req);                                     // not saved yet: normal network streaming
  const range = req.headers.get('range');
  if (!range) return cached;
  return rangeFrom(cached.clone(), range);
}

async function networkFirst(req, u) {
  const cache = await caches.open(CODE), key = keyOf(u);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.status === 200) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req, u, event) {
  const cache = await caches.open(MEDIA), key = keyOf(u);
  const hit = await cache.match(key);
  const refresh = fetch(req).then((res) => {
    if (res && res.ok && res.status === 200) cache.put(key, res.clone());
    return res;
  }).catch(() => null);
  if (hit) { event.waitUntil(refresh); return hit; }
  const res = await refresh;
  return res || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;                           // fonts / CDNs: leave to the browser
  if (u.pathname.endsWith('/sw.js')) return;
  if (isAudio(u)) { event.respondWith(audioResponse(req, u)); return; }
  if (isCode(u, req)) { event.respondWith(networkFirst(req, u)); return; }
  event.respondWith(staleWhileRevalidate(req, u, event));
});