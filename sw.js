// Tên cache
const CACHE_NAME = 'image-cache-v1';
// Tên miền proxy
const PROXY_DOMAIN = 'https://azcloud.sbs';
// Danh sách user được phép
const ALLOWED_USERS = ['azcloud68', 'az1221'];

// Sự kiện cài đặt Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache đã được mở');
                return cache.addAll([
                    '/',
                    '/index.html'
                ]);
            })
            .then(() => self.skipWaiting())
    );
});

// Sự kiện kích hoạt Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            clients.claim(),
            clearOldCaches()
        ]).then(() => {
            console.log('Service Worker đã kích hoạt');
        })
    );
});

// Sự kiện intercept request
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Xử lý các request ảnh proxy
    if (url.pathname.startsWith('/proxy/')) {
        event.respondWith(
            handleImageProxyRequest(event.request)
        );
    }
});

// Xử lý request proxy ảnh
async function handleImageProxyRequest(request) {
    const path = new URL(request.url).pathname.replace('/proxy/', '');
    const user = path.split('/')[0];
    
    // Kiểm tra user có được phép không
    if (!ALLOWED_USERS.includes(user)) {
        return new Response('Truy cập bị từ chối', { 
            status: 403,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
    
    // Tạo URL thực tế đến azcloud.sbs
    const actualUrl = `${PROXY_DOMAIN}/gh/${path}`;
    
    try {
        // Thử tải từ mạng trước
        const networkResponse = await fetch(actualUrl, {
            headers: {
                'Accept': 'image/*',
                'X-Proxy-Source': 'github-pages'
            }
        });
        
        if (networkResponse.ok) {
            // Lưu vào cache
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        throw new Error('Network response not OK');
    } catch (error) {
        console.error('Lỗi tải ảnh từ proxy:', error);
        
        // Thử lấy từ cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback: trả về ảnh placeholder
        return createPlaceholderResponse();
    }
}

// Tạo ảnh placeholder khi có lỗi
function createPlaceholderResponse() {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <rect width="200" height="200" fill="#f5f5f5"/>
            <text x="100" y="110" font-family="Arial" font-size="16" text-anchor="middle" fill="#999">
                Không thể tải ảnh
            </text>
        </svg>
    `;
    
    return new Response(svg, {
        headers: { 'Content-Type': 'image/svg+xml' }
    });
}

// Xóa cache cũ
async function clearOldCaches() {
    const keys = await caches.keys();
    return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
    );
}
