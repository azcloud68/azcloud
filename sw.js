const CACHE_NAME = 'azcloud-proxy-cache';
const JS_DELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';

// DANH SÁCH REPO ĐƯỢC PHÉP (WHITELIST)
const ALLOWED_REPOS = [
  'azcloud68/my-cdn-test',   // Repo của bạn
  'az1221/new1',            // Repo khác được phép
  // Thêm các repo khác tại đây...
];

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Chỉ xử lý các request bắt đầu bằng "/gh/"
  if (requestUrl.pathname.startsWith('/gh/')) {
    const pathParts = requestUrl.pathname.slice(4).split('/'); // Bỏ "/gh/" và tách thành mảng
    const repoIdentifier = `${pathParts[0]}/${pathParts[1]}`; // Lấy "user/repo"

    // Kiểm tra xem repo có trong danh sách cho phép không
    if (ALLOWED_REPOS.includes(repoIdentifier)) {
      const newUrl = JS_DELIVR_PREFIX + requestUrl.pathname.slice(4);
      
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
    } else {
      // Nếu repo không được phép, trả về lỗi 403 (Forbidden)
      event.respondWith(new Response('Forbidden: Repo not allowed', { status: 403 }));
    }
  }
  // Nếu không phải "/gh/", trả về bình thường (GitHub Pages)
  else {
    event.respondWith(fetch(event.request));
  }
});
