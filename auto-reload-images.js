// Tự động reload ảnh bị lỗi sau khi SW sẵn sàng (chỉ reload 1 lần)
navigator.serviceWorker.ready.then(() => {
  document.querySelectorAll('img').forEach(img => {
    if (!img.complete || img.naturalWidth === 0) {
      const src = img.src;
      img.onerror = () => {
        console.log('[CDN-Proxy] Ảnh lỗi, thử tải lại:', src);
        setTimeout(() => img.src = src + '?retry=' + Date.now(), 300); // tránh cache
      };
      // Gắn lại để kích hoạt onerror nếu ảnh đã fail
      img.src = src;
    }
  });
});
