// Danh sách repo được phép
const ALLOWED_REPOS = [
  "azcloud68/my-cdn-test",
  "az1221/new1"
];

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Chỉ xử lý đường dẫn /gh/
  if (url.pathname.startsWith('/gh/')) {
    const pathParts = url.pathname.slice(4).split('/');
    const repoId = `${pathParts[0]}/${pathParts[1]}`;
    
    // Kiểm tra repo có trong danh sách cho phép
    if (ALLOWED_REPOS.includes(repoId)) {
      const proxyUrl = `https://cdn.jsdelivr.net/gh${url.pathname.slice(3)}`;
      event.respondWith(fetch(proxyUrl));
    } else {
      event.respondWith(new Response('Repo không được phép', { status: 403 }));
    }
  }
});

// Bắt buộc Service Worker active ngay
self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});
