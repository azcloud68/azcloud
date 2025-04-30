const JS_DELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Nếu URL bắt đầu bằng "/gh/" → Proxy sang jsDelivr
  if (url.pathname.startsWith('/gh/')) {
    const cdnUrl = JS_DELIVR_PREFIX + url.pathname.slice(4); // Bỏ "/gh/"
    event.respondWith(fetch(cdnUrl));
  }
  
  // Nếu không, trả về trang GitHub Pages bình thường
  else {
    event.respondWith(fetch(event.request));
  }
});
