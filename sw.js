// sw.js
const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const ALLOWED_USERS = ['azcloud68', 'az1221']; // Chỉ cần list tài khoản GitHub

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Kích hoạt ngay lập tức
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Kiểm soát tất cả clients
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Xử lý ảnh CDN
  if (url.pathname.startsWith(CDN_PREFIX)) {
    const pathParts = url.pathname.replace(CDN_PREFIX, '').split('/');
    const githubUser = pathParts[0]; // Lấy tên tài khoản GitHub
    
    if (ALLOWED_USERS.includes(githubUser)) {
      return event.respondWith(handleImageFetch(event));
    } else {
      return event.respondWith(new Response('Tài khoản GitHub không được phép', { 
        status: 403 
      }));
    }
  }
  
  // Tự động inject retry script vào HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(async (response) => {
        if (response.headers.get('content-type')?.includes('text/html')) {
          const html = await response.text();
          const modifiedHtml = injectRetryScript(html);
          return new Response(modifiedHtml, {
            headers: response.headers
          });
        }
        return response;
      })
    );
  }
});

function handleImageFetch(event) {
  const cdnPath = new URL(event.request.url).pathname.replace(CDN_PREFIX, '');
  const jsDelivrURL = JSDELIVR_PREFIX + cdnPath;
  
  return fetch(jsDelivrURL).catch(() => {
    // Cache fallback + retry logic
    return caches.match(event.request).then(cachedResponse => {
      return cachedResponse || retryFetch(jsDelivrURL);
    });
  });
}

function retryFetch(url, attempts = 3) {
  return new Promise((resolve, reject) => {
    const retry = (attempt) => {
      fetch(url)
        .then(resolve)
        .catch(() => {
          if (attempt < attempts) {
            setTimeout(() => retry(attempt + 1), 300 * attempt);
          } else {
            reject(new Error('Max retries reached'));
          }
        });
    };
    retry(1);
  });
}

function injectRetryScript(html) {
  const retryScript = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Hàm retry cho ảnh
      function retryImages() {
        document.querySelectorAll('img').forEach(img => {
          if (img.src.startsWith('${CDN_PREFIX}')) {
            img.onerror = function() {
              var originalSrc = this.src;
              this.src = '';
              setTimeout(() => this.src = originalSrc, 300);
            };
          }
        });
      }
      
      // Kiểm tra SW đã sẵn sàng
      if (navigator.serviceWorker?.controller) {
        retryImages();
      } else {
        navigator.serviceWorker.ready.then(retryImages);
      }
    });
    </script>
  `;
  
  return html.replace('</body>', retryScript + '</body>');
}
