const CACHE_NAME = 'image-cache-v3';
const PROXY_DOMAIN = 'https://azcloud.sbs';
const FALLBACK_DOMAIN = 'https://cdn.jsdelivr.net/gh';
const ALLOWED_USERS = ['azcloud68', 'az1221'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll([
        '/offline.html',
        '/images/placeholder.jpg'
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      clearOldCaches()
    ])
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Xử lý request proxy
  if (url.pathname.startsWith('/proxy/')) {
    event.respondWith(
      handleProxyRequest(event.request)
        .catch(() => fallbackResponse(event.request))
    );
    return;
  }
  
  // Xử lý request khác
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});

async function handleProxyRequest(request) {
  const path = new URL(request.url).pathname.replace('/proxy/', '');
  const [user, repo, branch, ...filePath] = path.split('/');
  
  if (!ALLOWED_USERS.includes(user)) {
    return new Response('Access denied', { status: 403 });
  }

  // Tạo cả 2 URL proxy và fallback
  const proxyUrl = `${PROXY_DOMAIN}/gh/${user}/${repo}@${branch}/${filePath.join('/')}`;
  const fallbackUrl = `${FALLBACK_DOMAIN}/${user}/${repo}@${branch}/${filePath.join('/')}`;
  
  try {
    // Thử tải qua proxy trước
    const res = await fetch(proxyUrl, {
      headers: { 'X-Proxy-Source': 'github-pages' }
    });
    
    if (res.ok) {
      // Cache response nếu thành công
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, res.clone());
      return res;
    }
    throw new Error('Proxy failed');
  } catch (err) {
    // Fallback tải trực tiếp từ jsDelivr
    return fetch(fallbackUrl);
  }
}

async function fallbackResponse(request) {
  // Thử lấy từ cache
  const cached = await caches.match(request);
  if (cached) return cached;
  
  // Trả về placeholder nếu không có cache
  return caches.match('/images/placeholder.jpg');
}

async function clearOldCaches() {
  const keys = await caches.keys();
  return Promise.all(
    keys.filter(key => key !== CACHE_NAME)
      .map(key => caches.delete(key))
  );
}
