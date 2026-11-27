const GAME_V = new URL(self.location.href).searchParams.get('v') || '0';
const AUDIO_VERSION = 'v2';
const PACK_VERSION = 'p2';
const MEDIA = 'jeketi-media-' + GAME_V;
const AUDIO = 'jeketi-audio-' + AUDIO_VERSION;
const PACK = 'jeketi-pack-' + PACK_VERSION;
const packCtl = new Set();
function abortDownloads() { packCtl.forEach((c) => { try { c.abort(); } catch (err) {  } }); packCtl.clear(); }
const MAX_SONGS = 500;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('jeketi-') && k !== MEDIA && k !== AUDIO && k !== PACK) await caches.delete(k);
    await self.clients.claim();
  })());
});

const CODE_JS = /\/(game|songs|sfx|points|cards|packs|shop|daily|sw|version|updater|leaderboard|downloader)\.js$/i;
const isAudio = (u) => /\.(mp3|ogg|m4a|aac|wav|opus|flac)$/i.test(u.pathname);
const isChart = (u) => /\/charts\/[^/]+\.js$/i.test(u.pathname);
const isMedia = (u) => /\.(png|jpe?g|gif|webp|avif|svg|ico|otf|ttf|woff2?)$/i.test(u.pathname) || (/\.js$/i.test(u.pathname) && !CODE_JS.test(u.pathname));
const keyOf = (u) => new Request(u.origin + u.pathname);

self.addEventListener('message', (e) => {
  const d = e.data || {};
  const port = e.ports && e.ports[0];
  if (d.type === 'pack-abort') { abortDownloads(); if (port) port.postMessage({ ok: true }); }
  else if (d.type === 'keep-audio' && d.url) e.waitUntil(keepAudio(d.url));
  else if (d.type === 'pack-status' && Array.isArray(d.urls)) e.waitUntil(packStatus(d.urls).then((r) => port && port.postMessage(r)));
  else if (d.type === 'pack-fetch' && d.url) e.waitUntil(packFetch(d.url).then((r) => port && port.postMessage(r)));
});

async function trimAudio(cache) {
  const keys = await cache.keys();
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
    const res = await fetch(u.href, { cache: 'no-store', signal: ac.signal });
    if (!res.ok || res.status !== 200) return;
    await cache.put(key, res);
    await trimAudio(cache);
  } catch (err) {  }
  finally { packCtl.delete(ac); }
}

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
    await cache.put(keyOf(u), res);
    if (audio) await trimAudio(cache);
    return { ok: true, bytes };
  } catch (err) { return { ok: false, aborted: ac.signal.aborted }; }
  finally { packCtl.delete(ac); }
}

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
  } catch (err) {  }
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
  if (isChart(u)) {
    try {
      const res = await fetch(req);
      if (res && res.ok && res.status === 200) { cache.put(keyOf(u), res.clone()).catch(() => {}); return res; }
      return hit || res;
    } catch (err) { if (hit) return hit; throw err; }
  }
  if (hit && fromPack && !isChart(u)) return hit;
  const refresh = fetch(req).then((res) => {
    if (res && res.ok && res.status === 200) cache.put(keyOf(u), res.clone()).catch(() => {});
    return res;
  });
  if (hit) { event.waitUntil(refresh.catch(() => {})); return hit; }
  return refresh;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode === 'navigate') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;
  if (isAudio(u)) { event.respondWith(audioResponse(req, u)); return; }
  if (isMedia(u)) { event.respondWith(mediaResponse(req, u, event)); return; }
});
