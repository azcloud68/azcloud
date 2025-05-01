// sw.js - Phiên bản ổn định đa trình duyệt
const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const ALLOWED_USERS = ['azcloud68', 'az1221'];
const CACHE_NAME = 'img-cache-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[SW] Đã cài đặt');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  console.log('[SW] Đã kích hoạt');
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Xử lý ảnh CDN
  if (url.pathname.startsWith(CDN_PREFIX)) {
    const user = url.pathname.split('/')[2]; // Lấy username từ URL
    if (ALLOWED_USERS.includes(user)) {
      event.respondWith(handleImageRequest(event));
      return;
    }
  }

  // Xử lý trang HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => addRetryScriptToHTML(response))
        .catch(() => fetch(event.request))
    );
  }
});

async function handleImageRequest(event) {
  const requestUrl = new URL(event.request.url);
  const cdnPath = requestUrl.pathname.replace(CDN_PREFIX, '');
  const jsDelivrUrl = JSDELIVR_PREFIX + cdnPath;

  // Chiến lược: Mạng trước, cache sau
  try {
    // Thử tải từ mạng trước
    const networkResponse = await fetch(jsDelivrUrl, {
      cache: 'no-cache',
      referrerPolicy: 'no-referrer'
    });

    if (networkResponse.ok) {
      // Lưu vào cache cho lần sau
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Lỗi tải ảnh từ mạng:', error);
  }

  // Nếu mạng thất bại, thử từ cache
  const cachedResponse = await caches.match(event.request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Nếu không có trong cache, trả về ảnh placeholder
  return createPlaceholderResponse();
}

async function addRetryScriptToHTML(response) {
  if (!response.headers.get('content-type')?.includes('text/html')) {
    return response;
  }

  const html = await response.text();
  const modifiedHtml = injectRetryScript(html);

  return new Response(modifiedHtml, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText
  });
}

function injectRetryScript(html) {
  const retryScript = `
    <script>
    (function() {
      function setupImageRetry() {
        document.querySelectorAll('img').forEach(img => {
          if (img.src.startsWith('${CDN_PREFIX}')) {
            // Lưu URL gốc
            if (!img.dataset.origSrc) {
              img.dataset.origSrc = img.src;
            }
            
            // Thiết lập retry khi lỗi
            img.onerror = function() {
              const self = this;
              const retryCount = parseInt(self.dataset.retryCount || 0) + 1;
              
              if (retryCount > 3) return;
              
              self.dataset.retryCount = retryCount;
              self.src = ''; // Xóa src hiện tại
              
              // Thêm timestamp để tránh cache
              setTimeout(() => {
                self.src = self.dataset.origSrc + '?retry=' + Date.now();
              }, 300 * retryCount);
            };
          }
        });
      }

      // Chạy khi DOM sẵn sàng
      if (document.readyState === 'complete') {
        setupImageRetry();
      } else {
        window.addEventListener('load', setupImageRetry);
        document.addEventListener('DOMContentLoaded', setupImageRetry);
      }
    })();
    </script>
  `;

  return html.replace('</body>', retryScript + '</body>');
}

function createPlaceholderResponse() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#f5f5f5"/>
      <text x="50" y="50" font-family="Arial" font-size="10" text-anchor="middle" fill="#ccc">
        Đang tải ảnh...
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store'
    }
  });
}
