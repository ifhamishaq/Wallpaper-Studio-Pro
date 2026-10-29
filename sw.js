// Service worker: installable app + offline shell.
// Strategy is network-first for our own files (a deploy is visible on the very next load),
// falling back to the cache when offline. API calls and third-party hosts are never cached.
const CACHE = 'wsp-v2';
const SHELL = [
    '/', '/index.html', '/style.css', '/manifest.webmanifest',
    '/js/main.js', '/js/state.js', '/js/lib.js', '/js/config.js', '/js/cloud.js', '/js/dialogs.js',
    '/js/items.js', '/js/pager.js', '/js/slide.js', '/js/plasma.js', '/js/create.js', '/js/explore.js',
    '/js/library.js', '/js/viewer.js', '/js/account.js', '/js/mixer.js',
    '/fonts/geist-latin.woff2', '/fonts/doto-latin.woff2',
    '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/.netlify/') || url.pathname === '/sw.js') return;

    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/index.html') : Response.error())))
    );
});
