// Tên cache
const CACHE_NAME = 'image-cache-v2';
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
                // Pre-cache các tài nguyên quan trọng
                return cache.addAll([
                    '/',
                    '/index.html',
                    '/assets/css/style.css',
                    '/assets/js/app.js',
                    '/images/placeholder.svg'
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
            this.clearOldCaches()
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
            this.handleImageProxyRequest(event.request)
        );
        return;
    }
    
    // Xử lý các request khác (cache first)
    event.respondWith(
        this.handleOtherRequests(event.request)
    );
});

// Xử lý request proxy ảnh
async function handleImageProxyRequest(request) {
    const path = new URL(request.url).pathname.replace('/proxy/', '');
    const user = path.split('/')[0];
    
    // Kiểm tra user có được phép không
    if (!ALLOWED_USERS.includes(user)) {
        return this.createErrorResponse('Truy cập bị từ chối', 403);
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
        return this.createPlaceholderResponse();
    }
}

// Xử lý các request khác (cache first)
async function handleOtherRequests(request) {
    try {
        // Thử lấy từ cache trước
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        
        // Nếu không có trong cache, tải từ mạng
        const networkResponse = await fetch(request);
        
        // Cache response nếu cần
        if (networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Fallback cho các request HTML
        if (request.headers.get('Accept').includes('text/html')) {
            return caches.match('/offline.html');
        }
        throw error;
    }
}

// Tạo ảnh placeholder khi có lỗi
function createPlaceholderResponse() {
    return caches.match('/images/placeholder.svg')
        .then(response => response || this.createErrorResponse());
}

// Tạo response lỗi
function createErrorResponse(message = 'Lỗi tải ảnh', status = 500) {
    return new Response(message, { 
        status: status,
        headers: { 'Content-Type': 'text/plain' }
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
