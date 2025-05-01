// sw.js - Phiên bản đặc biệt cho UCMobile & Firefox
const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const ALLOWED_USERS = ['azcloud68', 'az1221'];
const CACHE_NAME = 'img-cache-final-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[SW] Installation complete');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  console.log('[SW] Now controlling clients');
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Xử lý proxy ảnh
  if (url.pathname.startsWith(CDN_PREFIX)) {
    return handleImageProxy(event);
  }
  
  // Xử lý trang HTML
  if (event.request.mode === 'navigate') {
    return handlePageRequest(event);
  }
});

async function handleImageProxy(event) {
  const url = new URL(event.request.url);
  const user = url.pathname.split('/')[2];
  
  if (!ALLOWED_USERS.includes(user)) {
    return event.respondWith(blockedResponse());
  }

  try {
    const response = await universalFetchHandler(event.request);
    return event.respondWith(response);
  } catch (error) {
    console.error('[SW] Proxy failed:', error);
    return event.respondWith(fallbackImage());
  }
}

async function universalFetchHandler(request) {
  // Giải pháp đặc biệt cho UCMobile và Firefox
  const newUrl = convertToJsDelivrUrl(request.url);
  const isFirefox = navigator.userAgent.includes('Firefox');
  const isUCMobile = navigator.userAgent.includes('UCBrowser');

  const fetchOptions = {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: new Headers({
      'Accept': 'image/*',
      'X-Requested-With': 'XMLHttpRequest'
    })
  };

  // Điều chỉnh options cho từng trình duyệt
  if (isUCMobile) {
    fetchOptions.mode = 'no-cors';
    fetchOptions.headers.delete('X-Requested-With');
  }

  if (isFirefox) {
    fetchOptions.integrity = '';
  }

  // Thử tải trực tiếp từ jsDelivr
  try {
    const networkResponse = await fetch(newUrl, fetchOptions);
    
    if (networkResponse.status === 200) {
      // Clone response để cache
      const responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
      
      return networkResponse;
    }
    throw new Error(`HTTP ${networkResponse.status}`);
  } catch (error) {
    // Thử từ cache nếu mạng thất bại
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Cuối cùng: thử phương án dự phòng
    return backupImageFetch(newUrl);
  }
}

function convertToJsDelivrUrl(url) {
  const path = new URL(url).pathname.replace(CDN_PREFIX, '');
  return JSDELIVR_PREFIX + path;
}

async function backupImageFetch(url) {
  // Phương án đặc biệt khi cả mạng và cache đều fail
  try {
    // Thử cách khác để tải ảnh
    const res = await fetch(url, {
      mode: 'no-cors',
      credentials: 'omit',
      redirect: 'follow'
    });
    
    if (res.ok || res.type === 'opaque') {
      return new Response(res.body, {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' }
      });
    }
  } catch (e) {
    console.warn('Backup fetch failed:', e);
  }
  return fallbackImage();
}

async function handlePageRequest(event) {
  try {
    const response = await fetch(event.request);
    
    if (!response.headers.get('content-type')?.includes('text/html')) {
      return response;
    }
    
    const html = await response.text();
    const modified = injectCompatibilityScript(html);
    
    return new Response(modified, {
      headers: response.headers
    });
  } catch (error) {
    console.error('[SW] Page handling failed:', error);
    return fetch(event.request);
  }
}

function injectCompatibilityScript(html) {
  const compatibilityScript = `
    <script>
    /* UC & Firefox Special Handler */
    (function() {
      function retryFailedImages() {
        var images = document.querySelectorAll('img[src^="${CDN_PREFIX}"]');
        
        images.forEach(function(img) {
          // Skip if already processed
          if (img.dataset.proxied) return;
          
          img.dataset.proxied = 'true';
          var originalSrc = img.src;
          
          img.onerror = function() {
            var self = this;
            var retry = parseInt(self.dataset.retry || '0') + 1;
            
            if (retry > 2) {
              // Ultimate fallback - direct jsDelivr link
              self.src = originalSrc.replace('${CDN_PREFIX}', '${JSDELIVR_PREFIX}');
              return;
            }
            
            self.dataset.retry = retry;
            setTimeout(function() {
              // Force refresh with cache busting
              self.src = originalSrc + '?sw-retry=' + Date.now();
            }, 500 * retry);
          };
        });
      }
      
      // UC Browser needs special handling
      if (/UCBrowser|UCMobile/i.test(navigator.userAgent)) {
        setTimeout(retryFailedImages, 1000);
      } 
      // Firefox needs SW ready check
      else if (/Firefox/i.test(navigator.userAgent)) {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(retryFailedImages);
        } else {
          setTimeout(retryFailedImages, 500);
        }
      }
      // Normal browsers
      else {
        document.addEventListener('DOMContentLoaded', retryFailedImages);
      }
    })();
    </script>
  `;
  
  return html.replace('</body>', compatibilityScript + '</body>');
}

function blockedResponse() {
  return new Response('Access to this resource is not allowed', {
    status: 403,
    headers: { 'Content-Type': 'text/plain' }
  });
}

function fallbackImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#eee"/><text x="50" y="50" font-family="Arial" font-size="10" text-anchor="middle" fill="#999">Image unavailable</text></svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store'
    }
  });
}
