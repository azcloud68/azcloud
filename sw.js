// Sử dụng CryptoJS để giải mã
const CryptoJS = require('crypto-js');

// Chuỗi mã hóa từ bước trên
const encryptedRepos = 'U2FsdGVkX1+Fr3a+Acq4sxoDgYAndpfhfLlqtB6srInEXhv8F4mYZGiWTUk0bXLKtOD95id8BFluhz83U45VTA=='; // Thay thế chuỗi mã hóa từ bước trên

// Giải mã danh sách repo
const decryptedBytes = CryptoJS.AES.decrypt(encryptedRepos, 'secret-key');
const ALLOWED_REPOS = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));

// Các biến khác
const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith(CDN_PREFIX)) {
    const cdnPath = url.pathname.replace(CDN_PREFIX, '');
    const [user, repo] = cdnPath.split('/');
    
    // Kiểm tra xem repo có trong danh sách cho phép không
    if (ALLOWED_REPOS.includes(`${user}/${repo}`)) {
      const jsDelivrURL = JSDELIVR_PREFIX + cdnPath;
      event.respondWith(fetch(jsDelivrURL));
    } else {
      event.respondWith(new Response('Không được phép truy cập repo này', { status: 403 }));
    }
  }
});
