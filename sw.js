const CACHE_NAME = 'image-cache-v3';
const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const ALLOWED_USERS = ['azcloud68', 'az1221'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll([]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      clearOldCaches()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Xử lý redirect ảnh
  if (url.pathname.includes('/gh/redirect.html')) {
    const imgPath = url.searchParams.get('img');
    if (imgPath && ALLOWED_USERS.includes(imgPath.split('/')[0])) {
      return event.respondWith(handleImageRedirect(imgPath));
    }
  }
  
  // Xử lý proxy ảnh thông thường
  if (url.pathname.startsWith(CDN_PREFIX)) {
    const user = url.pathname.split('/')[2];
    if (ALLOWED_USERS.includes(user)) {
      return event.respondWith(handleImageProxy(event.request));
    }
  }
});

async function handleImageRedirect(imgPath) {
  const jsDelivrUrl = JSDELIVR_PREFIX + imgPath;
  
  try {
    const response = await fetch(jsDelivrUrl, {
      mode: 'cors',
      cache: 'no-store'
    });
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(new Request(CDN_PREFIX + imgPath), response.clone());
      return response;
    }
    throw new Error('Network response not OK');
  } catch (error) {
    const cached = await caches.match(CDN_PREFIX + imgPath);
    return cached || fetch(jsDelivrUrl, { mode: 'no-cors' });
  }
}

async function handleImageProxy(request) {
  const path = new URL(request.url).pathname.replace(CDN_PREFIX, '');
  const jsDelivrUrl = JSDELIVR_PREFIX + path;
  
  try {
    const networkResponse = await fetch(jsDelivrUrl, {
      mode: 'cors',
      cache: 'no-store'
    });
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not OK');
  } catch (error) {
    const cached = await caches.match(request);
    return cached || fetch(jsDelivrUrl, { mode: 'no-cors' });
  }
}

async function clearOldCaches() {
  const keys = await caches.keys();
  return Promise.all(
    keys.map(key => key !== CACHE_NAME && caches.delete(key))
  );
}
