// sw.js - Phiên bản tương thích toàn diện
const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const ALLOWED_USERS = ['azcloud68', 'az1221'];
const CACHE_NAME = 'img-cache-ultimate-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[SW] Installed');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      clearOldCaches()
    ])
  );
  console.log('[SW] Activated');
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Xử lý ảnh CDN
  if (url.pathname.startsWith(CDN_PREFIX)) {
    return handleCDNImage(event);
  }
  
  // Xử lý HTML
  if (event.request.mode === 'navigate') {
    return handleHTMLRequest(event);
  }
});

async function handleCDNImage(event) {
  const url = new URL(event.request.url);
  const user = url.pathname.split('/')[2];
  
  if (!ALLOWED_USERS.includes(user)) {
    return event.respondWith(new Response('Access Denied', { status: 403 }));
  }

  try {
    // Chiến lược: Network First với fallback Cache
    const response = await fetchWithRetry(event.request);
    return event.respondWith(response);
  } catch (error) {
    console.error('[SW] Image fetch failed:', error);
    return event.respondWith(createFallbackImage());
  }
}

async function fetchWithRetry(request, retries = 3) {
  try {
    // UCMobile cần headers đặc biệt
    const modifiedHeaders = new Headers(request.headers);
    modifiedHeaders.set('Accept', 'image/*');
    modifiedHeaders.set('Sec-Fetch-Dest', 'image');
    
    const modifiedRequest = new Request(request.url, {
      headers: modifiedHeaders,
      mode: 'no-cors', // Quan trọng cho UCMobile
      cache: 'no-store',
      referrerPolicy: 'no-referrer'
    });

    const networkResponse = await fetch(modifiedRequest);
    
    if (networkResponse.ok) {
      // Cache response cho lần sau
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not OK');
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return fetchWithRetry(request, retries - 1);
    }
    
    // Thử từ cache khi mạng thất bại
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    
    throw error;
  }
}

async function handleHTMLRequest(event) {
  try {
    const response = await fetch(event.request);
    
    if (!response.headers.get('content-type')?.includes('text/html')) {
      return response;
    }
    
    const html = await response.text();
    const modifiedHtml = injectUniversalRetryScript(html);
    
    return new Response(modifiedHtml, {
      headers: response.headers
    });
  } catch (error) {
    console.error('[SW] HTML handling error:', error);
    return fetch(event.request);
  }
}

function injectUniversalRetryScript(html) {
  const retryScript = `
    <script>
    (function() {
      function setupImageRetry() {
        var images = document.querySelectorAll('img[src^="${CDN_PREFIX}"]');
        
        images.forEach(function(img) {
          if (!img.dataset.origSrc) {
            img.dataset.origSrc = img.src;
            img.loading = 'eager';
          }
          
          img.onerror = function() {
            var self = this;
            var retryCount = parseInt(self.dataset.retryCount || 0) + 1;
            
            if (retryCount > 3) {
              self.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2NjYyI+RW1wdHk8L3RleHQ+PC9zdmc+';
              return;
            }
            
            self.dataset.retryCount = retryCount;
            self.src = '';
            
            setTimeout(function() {
              // Thêm random param để tránh cache
              self.src = self.dataset.origSrc + '&sw-retry=' + Date.now() + Math.random().toString(36).substring(2);
            }, 500 * retryCount);
          };
        });
      }
      
      // UCMobile cần timeout để đảm bảo DOM sẵn sàng
      function init() {
        try {
          if (/UCBrowser|UCMobile/i.test(navigator.userAgent)) {
            setTimeout(setupImageRetry, 300);
          } else if (document.readyState === 'complete') {
            setupImageRetry();
          } else {
            document.addEventListener('DOMContentLoaded', setupImageRetry);
            window.addEventListener('load', setupImageRetry);
          }
        } catch(e) { console.error('Retry init error:', e); }
      }
      
      // Firefox cần kiểm tra SW trước
      if ('serviceWorker' in navigator && /Firefox/i.test(navigator.userAgent)) {
        navigator.serviceWorker.ready.then(init);
      } else {
        init();
      }
    })();
    </script>
  `;
  
  return html.replace('</body>', retryScript + '</body>');
}

async function clearOldCaches() {
  const keys = await caches.keys();
  return Promise.all(
    keys.map(key => key !== CACHE_NAME && caches.delete(key))
  );
}

function createFallbackImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f5f5f5"/><text x="50" y="50" font-family="Arial" font-size="10" text-anchor="middle" fill="#ccc">Image not available</text></svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store'
    }
  });
}
