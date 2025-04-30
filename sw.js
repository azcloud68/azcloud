const CACHE_NAME = 'azcloud-proxy-cache';
const JS_DELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Chỉ xử lý các request bắt đầu bằng "/gh/"
  if (requestUrl.pathname.startsWith('/gh/')) {
    const newUrl = JS_DELIVR_PREFIX + requestUrl.pathname.slice(4); // Bỏ "/gh/"
    
    event.respondWith(
      fetch(newUrl)
        .then((response) => {
          // Cache lại để tăng tốc độ (tùy chọn)
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
          return response;
        })
        .catch(() => {
          // Nếu fetch thất bại, thử lấy từ cache
          return caches.match(event.request);
        })
    );
  }
  // Nếu không phải "/gh/", trả về bình thường (GitHub Pages)
  else {
    event.respondWith(fetch(event.request));
  }
});
