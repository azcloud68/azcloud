// sw.js - Phiên bản hoạt động trên mọi trình duyệt
const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const ALLOWED_USERS = ['azcloud68', 'az1221'];
const CACHE_NAME = 'universal-img-cache-v1';

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
    const response = await universalImageFetch(event.request);
    return event.respondWith(response);
  } catch (error) {
    console.error('[SW] Proxy failed:', error);
    return event.respondWith(fallbackImage());
  }
}

async function universalImageFetch(request) {
  const newUrl = convertToJsDelivrUrl(request.url);
  
  // Chiến lược: Network First với Cache Fallback
  try {
    const networkResponse = await fetch(newUrl, {
      mode: 'cors',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: new Headers({
        'Accept': 'image/*',
        'X-Requested-With': 'XMLHttpRequest'
      })
    });
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not OK');
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Fallback cuối cùng: tải trực tiếp không qua proxy
    return fetch(newUrl, { mode: 'no-cors' });
  }
}

function convertToJsDelivrUrl(url) {
  const path = new URL(url).pathname.replace(CDN_PREFIX, '');
  return JSDELIVR_PREFIX + path;
}

async function clearOldCaches() {
  const keys = await caches.keys();
  return Promise.all(
    keys.map(key => key !== CACHE_NAME && caches.delete(key))
  );
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
  const retryScript = `
    <script>
    /* Universal Image Retry Handler */
    document.addEventListener('DOMContentLoaded', function() {
      function setupImageRetry() {
        document.querySelectorAll('img[src^="${CDN_PREFIX}"]').forEach(img => {
          if (img.dataset.origSrc) return;
          
          img.dataset.origSrc = img.src;
          img.loading = 'eager';
          
          img.onerror = function() {
            const self = this;
            const retryCount = parseInt(self.dataset.retryCount || '0') + 1;
            
            if (retryCount > 3) {
              // Fallback cuối cùng: dùng link trực tiếp
              self.src = self.dataset.origSrc.replace('${CDN_PREFIX}', '${JSDELIVR_PREFIX}');
              return;
            }
            
            self.dataset.retryCount = retryCount;
            setTimeout(() => {
              self.src = self.dataset.origSrc + '?retry=' + Date.now();
            }, 500 * retryCount);
          };
        });
      }
      
      // Kiểm tra trình duyệt đặc biệt
      if (/UCBrowser|UCMobile/i.test(navigator.userAgent)) {
        setTimeout(setupImageRetry, 1000);
      } else if (/Firefox/i.test(navigator.userAgent)) {
        if (navigator.serviceWorker?.ready) {
          navigator.serviceWorker.ready.then(setupImageRetry);
        } else {
          setTimeout(setupImageRetry, 500);
        }
      } else {
        setupImageRetry();
      }
    });
    </script>
  `;
  
  return html.replace('</body>', retryScript + '</body>');
}

function blockedResponse() {
  return new Response('Access denied', { status: 403 });
}

function fallbackImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#eee"/></svg>`;
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' }
  });
}
