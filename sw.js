const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';

// Danh sách repo được mã hóa base64 (user/repo)
const ALLOWED_REPOS_BASE64 = [
  'YXpjbG91ZDY4L215LWNkbi10ZXN0', // azcloud68/my-cdn-test
  'YXoxMjIxL25ldzE='              // az1221/new1
];

// Kiểm tra repo có trong danh sách được phép
function isAllowed(user, repo) {
  const encoded = btoa(`${user}/${repo}`);
  return ALLOWED_REPOS_BASE64.includes(encoded);
}

// Theo dõi trạng thái đã activate chưa
let swActivated = false;

self.addEventListener('activate', event => {
  swActivated = true;
  console.log('[SW] Activated');
});

// Bắt sự kiện fetch
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Chỉ xử lý các đường dẫn bắt đầu bằng /gh/
  if (url.pathname.startsWith(CDN_PREFIX)) {
    const cdnPath = url.pathname.replace(CDN_PREFIX, '');
    const [user, repoBranch, ...rest] = cdnPath.split('/');
    const repo = repoBranch.split('@')[0]; // Lấy repo (bỏ @branch)

    // Kiểm tra quyền truy cập repo
    if (isAllowed(user, repo)) {
      const jsDelivrURL = JSDELIVR_PREFIX + cdnPath;

      event.respondWith(
        fetch(jsDelivrURL).catch(() => {
          // Nếu lần đầu SW chưa sẵn sàng → thử lại sau 300ms
          if (!swActivated) {
            return new Promise(resolve => {
              setTimeout(() => {
                resolve(fetch(jsDelivrURL));
              }, 300);
            });
          } else {
            return new Response('Không thể tải nội dung', { status: 408 });
          }
        })
      );
    } else {
      event.respondWith(new Response('Không được phép truy cập repo này', { status: 403 }));
    }
  }
});
