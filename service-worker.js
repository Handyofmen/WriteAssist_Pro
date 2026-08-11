// WriteAssist Pro — service worker
//
// What this does: caches the app itself (this HTML file + manifest) so it
// opens instantly and still loads with no internet connection at all —
// enough to keep using "local-only" writing/editing offline.
//
// What this does NOT do: make grammar checking work offline. That still
// needs a live connection to LanguageTool (and Datamuse for synonyms, and
// Supabase if you're using cloud sync). Offline, the app falls back to its
// built-in local spelling/style rules automatically — same fallback used
// when the API is rate-limited.

// Bump this version string every time index.html changes. It's the only
// thing that forces browsers to fetch a fresh copy instead of serving a
// stale cached version indefinitely — without this, updating the app on
// GitHub would silently do nothing for anyone who'd already loaded it once.
const CACHE_NAME = 'writeassist-shell-v2';
const SHELL_FILES = [
    './',
    './index.html',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle same-origin GET requests for the app shell itself.
    // Everything else (LanguageTool, Datamuse, Supabase) goes straight to
    // the network, untouched — we never want to serve a stale cached
    // response for a grammar check or a login request.
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    // Network-first for the app shell: always try to get the latest version
    // when there's a connection (so updates show up on next load, not just
    // after a manual cache-bust), and only serve the cached copy when
    // there's truly no network — that's the actual offline scenario this
    // is meant to cover.
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
