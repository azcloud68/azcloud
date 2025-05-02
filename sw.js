const CACHE_NAME = 'image-cache-v4';
const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const ALLOWED_USERS = ['azcloud68', 'az1221'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Pre-cache một số tài nguyên nếu cần
        return cache.addAll([
          '/',
          '/index.html',
          '/embed.html'
        ]);
      })
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
  
  // Xử lý route embed.html
  if (url.pathname.endsWith('/embed.html')) {
    return handleEmbedRequest(event);
  }
  
  // Xử lý proxy ảnh .jpg
  if (url.pathname.startsWith(CDN_PREFIX) && url.pathname.endsWith('.jpg')) {
    return handleImageProxy(event);
  }
});

async function handleEmbedRequest(event) {
  const url = new URL(event.request.url);
  const imageUrl = url.searchParams.get('url');
  
  if (imageUrl && isValidImageUrl(imageUrl)) {
    event.respondWith(
      fetch(imageUrl)
        .then(networkResponse => {
          // Clone response để cache
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseToCache));
          
          return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>body,html { margin:0; padding:0; height:100%; }</style>
            </head>
            <body>
              <img src="${imageUrl}" 
                   style="width:100%; height:100%; object-fit:contain;"
                   onerror="window.parent.postMessage('embedLoadFailed', '*')">
            </body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cached => cached || fallbackEmbedResponse());
        })
    );
  } else {
    event.respondWith(fallbackEmbedResponse());
  }
}

async function handleImageProxy(event) {
  const path = new URL(event.request.url).pathname.replace(CDN_PREFIX, '');
  const user = path.split('/')[0];
  
  if (!ALLOWED_USERS.includes(user)) {
    return event.respondWith(blockedResponse());
  }

  const jsDelivrUrl = JSDELIVR_PREFIX + path;
  
  try {
    const networkResponse = await fetch(jsDelivrUrl, {
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Accept': 'image/*' }
    });
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, networkResponse.clone());
      return event.respondWith(networkResponse);
    }
    throw new Error('Network response not OK');
  } catch (error) {
    const cached = await caches.match(event.request);
    if (cached) {
      return event.respondWith(cached);
    }
    return event.respondWith(fetch(jsDelivrUrl, { mode: 'no-cors' }));
  }
}

function isValidImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'cdn.jsdelivr.net' && 
           ALLOWED_USERS.includes(parsed.pathname.split('/')[2]);
  } catch {
    return false;
  }
}

async function clearOldCaches() {
  const keys = await caches.keys();
  return Promise.all(
    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
  );
}

function blockedResponse() {
  return new Response('Access denied', { 
    status: 403,
    headers: { 'Content-Type': 'text/plain' }
  });
}

function fallbackEmbedResponse() {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <script>
        window.parent.postMessage('embedLoadFailed', '*');
      </script>
    </head>
    <body></body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}
