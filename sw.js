const CACHE_NAME = 'azcloud-proxy-v3';
const JS_DELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const SECRET_KEY = "a3f1c7e08f2540a1b93ed89c5db37a46cdb297db2f4f9cb8e23734c9a6fd1c55";

// Whitelist tạm thời (fallback)
const FALLBACK_WHITELIST = [
  "azcloud68/my-cdn-test",
  "az1221/new1"
];

let ALLOWED_REPOS = [...FALLBACK_WHITELIST];

// Hàm giải mã cải tiến
async function decrypt(encryptedData, ivHex) {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET_KEY),
      { name: "AES-CBC", length: 256 },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { 
        name: "AES-CBC",
        iv: new Uint8Array(Buffer.from(ivHex, 'hex'))
      },
      key,
      new Uint8Array(Buffer.from(encryptedData, 'hex'))
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Giải mã thất bại - Sử dụng fallback", error);
    return JSON.stringify(FALLBACK_WHITELIST);
  }
}

// Tải whitelist (phiên bản bền bỉ)
async function loadWhitelist() {
  try {
    console.log("🔄 Đang tải whitelist...");
    const response = await fetch('/allowed-repos.enc?v=' + Date.now());
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const { iv, encryptedData } = await response.json();
    console.log("🔐 Dữ liệu nhận được:", { iv, encryptedData: encryptedData.substring(0, 30) + "..." });

    const decrypted = await decrypt(encryptedData, iv);
    console.log("📜 Nội dung giải mã:", decrypted);
    
    ALLOWED_REPOS = JSON.parse(decrypted);
    console.log("✅ Whitelist cuối cùng:", ALLOWED_REPOS);
  } catch (error) {
    console.error("❌ Lỗi tải whitelist:", error);
    ALLOWED_REPOS = [...FALLBACK_WHITELIST];
  }
}

// Khởi động mạnh mẽ hơn
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(['/']))
      .then(() => loadWhitelist())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// Xử lý fetch với logic mới
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.startsWith('/gh/')) {
    event.respondWith(handleProxyRequest(event));
  }
});

async function handleProxyRequest(event) {
  const url = new URL(event.request.url);
  const pathParts = url.pathname.slice(4).split('/');
  
  if (pathParts.length < 2) {
    return new Response('Đường dẫn không hợp lệ', { status: 400 });
  }

  const repoId = `${pathParts[0]}/${pathParts[1]}`;
  console.log("🔍 Đang kiểm tra repo:", repoId);

  if (!ALLOWED_REPOS.includes(repoId)) {
    console.warn("⛔ Repo không được phép:", repoId);
    return new Response('Repo không có trong whitelist', { status: 403 });
  }

  const proxyUrl = JS_DELIVR_PREFIX + url.pathname.slice(4);
  console.log("🔄 Đang proxy tới:", proxyUrl);

  try {
    const response = await fetch(proxyUrl);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    // Thêm CORS header nếu cần
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    
    return new Response(response.body, {
      status: response.status,
      headers: headers
    });
  } catch (error) {
    console.error("❌ Lỗi proxy:", error);
    return new Response('Lỗi khi tải tài nguyên', { status: 502 });
  }
}
