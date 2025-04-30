const ALLOWED_REPOS = new Set([
  "azcloud68/my-cdn-test",
  "az1221/new1"
]);

const JS_DELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.startsWith('/gh/')) {
    const path = url.pathname.slice(4).split('/');
    if (path.length < 2) return;
    
    const repoId = `${path[0]}/${path[1]}`;
    console.log('Checking repo:', repoId);
    
    if (ALLOWED_REPOS.has(repoId)) {
      const proxyUrl = JS_DELIVR_PREFIX + url.pathname.slice(4);
      console.log('Proxying to:', proxyUrl);
      event.respondWith(fetch(proxyUrl));
    } else {
      console.warn('Blocked repo:', repoId);
      event.respondWith(new Response('Forbidden', { status: 403 }));
    }
  }
});

// Đảm bảo SW active ngay lập tức
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));
