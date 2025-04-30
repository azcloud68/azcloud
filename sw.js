const CACHE_NAME = 'azcloud-proxy';
const JS_DELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';
const SECRET_KEY = "a3f1c7e08f2540a1b93ed89c5db37a46cdb297db2f4f9cb8e23734c9a6fd1c55";

let ALLOWED_REPOS = [];

// Hàm giải mã (Web Crypto API)
async function decrypt(encryptedData, ivHex) {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      Buffer.from(SECRET_KEY, 'hex'),
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: Buffer.from(ivHex, 'hex') },
      key,
      Buffer.from(encryptedData, 'hex')
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Giải mã thất bại:", error);
    return "[]";
  }
}

// Tải whitelist
async function loadWhitelist() {
  try {
    const response = await fetch('/allowed-repos.enc');
    const { iv, encryptedData } = await response.json();
    const decrypted = await decrypt(encryptedData, iv);
    ALLOWED_REPOS = JSON.parse(decrypted);
    console.log("Whitelist:", ALLOWED_REPOS);
  } catch (error) {
    console.error("Lỗi tải whitelist:", error);
    ALLOWED_REPOS = [];
  }
}

// Khởi động
self.addEventListener('install', (event) => {
  event.waitUntil(loadWhitelist());
});

// Xử lý request
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/gh/')) {
    const path = url.pathname.slice(4).split('/');
    const repoId = `${path[0]}/${path[1]}`;

    if (ALLOWED_REPOS.includes(repoId)) {
      const proxyUrl = JS_DELIVR_PREFIX + url.pathname.slice(4);
      event.respondWith(fetch(proxyUrl));
    } else {
      event.respondWith(new Response(
        'Repo không được phép', 
        { status: 403 }
      ));
    }
  }
});
