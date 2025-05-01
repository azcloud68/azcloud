const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';

const ALLOWED_REPOS_BASE64 = [
  'YXpjbG91ZDY4L215LWNkbi10ZXN0',
  'YXoxMjIxL25ldzE='
];

function isAllowed(user, repo) {
  const encoded = btoa(`${user}/${repo}`);
  return ALLOWED_REPOS_BASE64.includes(encoded);
}

self.addEventListener('install', event => {
  // Bỏ qua giai đoạn waiting, active ngay lập tức
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Kiểm soát các clients ngay lập tức
  event.waitUntil(clients.claim());
  console.log('[SW] Activated and claiming clients');
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith(CDN_PREFIX)) {
    const cdnPath = url.pathname.replace(CDN_PREFIX, '');
    const [user, repoBranch, ...rest] = cdnPath.split('/');
    const repo = repoBranch.split('@')[0];

    if (isAllowed(user, repo)) {
      const jsDelivrURL = JSDELIVR_PREFIX + cdnPath;

      event.respondWith(
        fetch(jsDelivrURL).catch(() => {
          // Thử lại sau 100ms nếu lỗi
          return new Promise(resolve => {
            setTimeout(() => {
              resolve(fetch(jsDelivrURL));
            }, 100);
          });
        })
      );
    } else {
      event.respondWith(new Response('Không được phép truy cập repo này', { status: 403 }));
    }
  }
});
