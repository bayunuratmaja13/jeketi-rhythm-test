/* Switched off: this version removes itself and everything it saved, then does nothing. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('jeketi-')) await caches.delete(k);
    await self.registration.unregister();
  })());
});