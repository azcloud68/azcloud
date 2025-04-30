const CACHE_NAME = 'azcloud-proxy-cache';
const JS_DELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const WHITELIST_URL = '/allowed-repos.json'; // Đường dẫn đến file whitelist

let ALLOWED_REPOS = [];

// Hàm tải danh sách repo được phép
async function loadWhitelist() {
  try {
    const response = await fetch(WHITELIST_URL);
    ALLOWED_REPOS = await response.json();
    console.log('Whitelist loaded:', ALLOWED_REPOS);
  } catch (error) {
    console.error('Failed to load whitelist:', error);
  }
}

// Khởi động Service Worker và tải whitelist
self.addEventListener('install', (event) => {
  event.waitUntil(loadWhitelist());
});

// Xử lý các request
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Chỉ xử lý các request bắt đầu bằng "/gh/"
  if (requestUrl.pathname.startsWith('/gh/')) {
    event.respondWith(handleProxyRequest(event));
  }
  // Nếu là request tới whitelist, không cache
  else if (requestUrl.pathname === WHITELIST_URL) {
    event.respondWith(fetch(event.request));
  }
  // Các request khác (trang web bình thường)
  else {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
  }
});

// Hàm xử lý proxy request
async function handleProxyRequest(event) {
  const requestUrl = new URL(event.request.url);
  const pathParts = requestUrl.pathname.slice(4).split('/'); // Bỏ "/gh/"
  const repoIdentifier = `${pathParts[0]}/${pathParts[1]}`; // Lấy "user/repo"

  // Kiểm tra repo có trong whitelist không
  if (ALLOWED_REPOS.includes(repoIdentifier)) {
    const cdnUrl = JS_DELIVR_PREFIX + requestUrl.pathname.slice(4);
    
    try {
      const response = await fetch(cdnUrl);
      // Cache lại để tăng tốc độ (tùy chọn)
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      // Nếu fetch thất bại, thử lấy từ cache
      const cached = await caches.match(event.request);
      return cached || new Response('Not Found', { status: 404 });
    }
  } else {
    // Nếu repo không được phép, trả về 403
    return new Response('Forbidden: Repo not allowed', { 
      status: 403,
      statusText: 'Repo not in whitelist'
    });
  }
}
