const CryptoJS = require('crypto-js');

// Chuỗi mã hóa từ bước trước
const encryptedRepos = 'U2FsdGVkX1+Fr3a+Acq4sxoDgYAndpfhfLlqtB6srInEXhv8F4mYZGiWTUk0bXLKtOD95id8BFluhz83U45VTA=='; // Thay thế chuỗi mã hóa từ bước trên

// Giải mã danh sách repo
const decryptedBytes = CryptoJS.AES.decrypt(encryptedRepos, 'secret-key');
const ALLOWED_REPOS = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));

// Các biến khác
const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';

// Lắng nghe các yêu cầu fetch
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Kiểm tra nếu đường dẫn bắt đầu với CDN_PREFIX
  if (url.pathname.startsWith(CDN_PREFIX)) {
    // Trích xuất đường dẫn CDN từ yêu cầu
    const cdnPath = url.pathname.replace(CDN_PREFIX, '');
    console.log('cdnPath:', cdnPath);  // Kiểm tra đường dẫn

    // Tách user, repo và đường dẫn file
    const [user, repo, ...path] = cdnPath.split('/');
    console.log('User:', user, 'Repo:', repo, 'Path:', path);  // Kiểm tra các phần

    // Kiểm tra nếu repo hợp lệ (có trong danh sách cho phép)
    if (ALLOWED_REPOS.includes(`${user}/${repo}`)) {
      const jsDelivrURL = JSDELIVR_PREFIX + cdnPath; // Xây dựng URL jsDelivr
      console.log('Fetching:', jsDelivrURL); // Kiểm tra URL xây dựng

      // Tiến hành fetch dữ liệu từ jsDelivr
      event.respondWith(fetch(jsDelivrURL)
        .then(response => {
          if (!response.ok) {
            console.log('Error fetching from jsDelivr:', response.status);
            return new Response('Không thể tải file từ jsDelivr', { status: 500 });
          }
          return response;
        })
        .catch(err => {
          console.log('Error in fetch request:', err);
          return new Response('Lỗi khi lấy dữ liệu từ CDN', { status: 500 });
        })
      );
    } else {
      console.log('Access Denied:', `${user}/${repo}`);
      // Nếu repo không hợp lệ, trả về lỗi 403
      event.respondWith(new Response('Không được phép truy cập repo này', { status: 403 }));
    }
  }
});
