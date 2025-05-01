// sw.js - Phiên bản đa trình duyệt tối ưu
const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const ALLOWED_USERS = ['azcloud68', 'az1221'];
const CACHE_NAME = 'img-cache-v2';

// Danh sách trình duyệt cần xử lý đặc biệt
const BROWSER_SPECIAL_HANDLING = {
  firefox: {
    cacheOption: 'no-store',
    referrerPolicy: 'no-referrer'
  },
  safari: {
    cacheOption: 'reload'
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll([])) // Precaching nếu cần
      .then(() => self.skipWaiting())
  );
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
    return handleCDNRequest(event);
  }
  
  // Inject retry script cho HTML
  if (event.request.mode === 'navigate') {
    return handleHTMLRequest(event);
  }
});

async function handleCDNRequest(event) {
  const url = new URL(event.request.url);
  const pathParts = url.pathname.replace(CDN_PREFIX, '').split('/');
  const githubUser = pathParts[0];
  
  if (!ALLOWED_USERS.includes(githubUser)) {
    return event.respondWith(new Response('Access Denied', { status: 403 }));
  }

  const browser = detectBrowser();
  const cacheStrategy = getCacheStrategy(browser);
  
  try {
    const response = await applyCacheStrategy(event, cacheStrategy);
    return event.respondWith(response);
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    return event.respondWith(fallbackResponse(event.request));
  }
}

async function applyCacheStrategy(event, strategy) {
  const request = event.request;
  const cache = await caches.open(CACHE_NAME);
  
  // 1. Thử lấy từ cache trước
  if (strategy.cacheFirst) {
    const cached = await cache.match(request);
    if (cached) return cached;
  }
  
  // 2. Thử tải từ mạng
  try {
    const fetchOptions = {
      cache: strategy.cacheOption,
      referrerPolicy: strategy.referrerPolicy
    };
    
    const networkResponse = await fetch(request.url, fetchOptions);
    
    // Cache response nếu thành công
    if (networkResponse.ok) {
      const clone = networkResponse.clone();
      event.waitUntil(cache.put(request, clone));
    }
    
    return networkResponse;
  } catch (error) {
    // 3. Fallback: thử lấy từ cache nếu có
    const cached = await cache.match(request);
    if (cached) return cached;
    
    // 4. Cuối cùng: thử retry
    return retryFetch(request.url, strategy);
  }
}

function getCacheStrategy(browser) {
  // Chiến lược mặc định
  const defaultStrategy = {
    cacheFirst: true,
    cacheOption: 'default',
    referrerPolicy: 'no-referrer-when-downgrade',
    maxRetries: 3
  };
  
  // Áp dụng chiến lược riêng cho từng trình duyệt
  return {
    ...defaultStrategy,
    ...(BROWSER_SPECIAL_HANDLING[browser] || {})
  };
}

async function retryFetch(url, strategy, attempt = 1) {
  try {
    const response = await fetch(url, {
      cache: strategy.cacheOption,
      referrerPolicy: strategy.referrerPolicy
    });
    
    if (response.ok) return response;
    throw new Error('Response not OK');
  } catch (error) {
    if (attempt < strategy.maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 300 * attempt));
      return retryFetch(url, strategy, attempt + 1);
    }
    throw error;
  }
}

function detectBrowser() {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('firefox')) return 'firefox';
  if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'safari';
  if (userAgent.includes('edg')) return 'edge';
  return 'chrome';
}

async function clearOldCaches() {
  const keys = await caches.keys();
  return Promise.all(
    keys.map(key => key !== CACHE_NAME && caches.delete(key))
  );
}

function fallbackResponse(request) {
  // Có thể trả về ảnh placeholder hoặc thông báo
  if (request.headers.get('accept').includes('image')) {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#eee"/><text x="50" y="50" font-family="Arial" font-size="10" text-anchor="middle" fill="#aaa">Image not available</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
  return new Response('Resource not available', { status: 404 });
}

async function handleHTMLRequest(event) {
  try {
    const response = await fetch(event.request);
    
    if (!response.headers.get('content-type').includes('text/html')) {
      return response;
    }
    
    const html = await response.text();
    const modifiedHtml = injectRetryScript(html);
    
    return new Response(modifiedHtml, {
      headers: response.headers
    });
  } catch (error) {
    console.error('[SW] HTML handling failed:', error);
    return fetch(event.request);
  }
}

function injectRetryScript(html) {
  const retryScript = `
    <script>
    (function() {
      function setupImageRetry() {
        var images = document.querySelectorAll('img[src^="${CDN_PREFIX}"]');
        
        images.forEach(function(img) {
          if (!img.dataset.originalSrc) {
            img.dataset.originalSrc = img.src;
            img.loading = 'eager'; // Tối ưu tải ảnh
          }
          
          img.onerror = function() {
            var self = this;
            var retryCount = parseInt(self.dataset.retryCount || 0) + 1;
            self.dataset.retryCount = retryCount;
            
            if (retryCount > 3) return;
            
            // Dùng placeholder trong lúc chờ retry
            self.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlZWUiLz48L3N2Zz4=';
            
            setTimeout(function() {
              self.src = self.dataset.originalSrc + (retryCount > 1 ? '&retry=' + Date.now() : '');
            }, 300 * retryCount);
          };
        });
      }
      
      // Hỗ trợ đa trình duyệt
      function onReady() {
        try {
          setupImageRetry();
          
          // Kiểm tra SW cho trình duyệt WebKit (Safari)
          if ('serviceWorker' in navigator && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)) {
            navigator.serviceWorker.ready.then(function() {
              setTimeout(setupImageRetry, 500);
            });
          }
        } catch(e) { console.error('Retry init error:', e); }
      }
      
      if (document.readyState !== 'loading') {
        onReady();
      } else {
        document.addEventListener('DOMContentLoaded', onReady);
      }
      
      // Polyfill cho các trình duyệt cũ
      if (!('loading' in HTMLImageElement.prototype)) {
        Object.defineProperty(HTMLImageElement.prototype, 'loading', {
          get: function() { return this.getAttribute('loading'); },
          set: function(value) { this.setAttribute('loading', value); }
        });
      }
    })();
    </script>
  `;
  
  return html.replace('</body>', retryScript + '</body>');
}
