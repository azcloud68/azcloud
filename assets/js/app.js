// Khởi tạo ứng dụng
class ImageProxyApp {
    constructor() {
        this.initServiceWorker();
        this.setupImageLoading();
        this.log('Ứng dụng đã khởi tạo');
    }

    // Đăng ký Service Worker
    initServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(registration => {
                    this.log('Service Worker đã đăng ký thành công');
                    
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                this.log('Service Worker mới đã kích hoạt');
                                window.location.reload();
                            }
                        });
                    });
                })
                .catch(error => {
                    this.error('Lỗi đăng ký Service Worker:', error);
                    this.loadImagesDirect(); // Fallback
                });
        } else {
            this.warn('Trình duyệt không hỗ trợ Service Worker');
            this.loadImagesDirect(); // Fallback
        }
    }

    // Thiết lập tải ảnh
    setupImageLoading() {
        document.querySelectorAll('.proxy-image[data-src]').forEach(img => {
            const loadingElement = document.getElementById(`loading-${img.id.split('-')[1]}`);
            this.loadImageWithProxy(img, loadingElement);
        });
    }

    // Tải ảnh qua proxy
    loadImageWithProxy(imgElement, loadingElement) {
        const imageUrl = imgElement.dataset.src;
        this.log(`Bắt đầu tải ảnh: ${imageUrl}`);
        
        // Tạo URL proxy
        const proxyUrl = `https://azcloud.sbs/proxy?url=${encodeURIComponent(imageUrl)}`;
        this.log(`Proxy URL: ${proxyUrl}`);

        // Thêm sự kiện load/error
        imgElement.onload = () => this.handleImageLoad(imgElement, loadingElement);
        imgElement.onerror = () => this.handleImageError(imgElement, loadingElement);
        
        // Bắt đầu tải
        imgElement.src = proxyUrl;
    }

    // Xử lý khi ảnh tải thành công
    handleImageLoad(imgElement, loadingElement) {
        imgElement.classList.add('loaded');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        this.log(`Tải ảnh thành công: ${imgElement.dataset.src}`);
    }

    // Xử lý khi ảnh tải thất bại
    handleImageError(imgElement, loadingElement, attempt = 1) {
        const maxAttempts = 3;
        this.error(`Lỗi tải ảnh (lần ${attempt}): ${imgElement.dataset.src}`);

        if (attempt > maxAttempts) {
            this.warn(`Đã thử tải lại ${maxAttempts} lần nhưng không thành công`);
            if (loadingElement) {
                loadingElement.classList.add('failed');
                loadingElement.querySelector('span').textContent = 'Không thể tải ảnh';
            }
            this.loadImageDirect(imgElement, loadingElement);
            return;
        }

        if (loadingElement) {
            loadingElement.classList.add('retrying');
            loadingElement.querySelector('span').textContent = `Đang thử tải lại (lần ${attempt})...`;
        }

        // Exponential backoff
        const delay = 1000 * Math.pow(2, attempt - 1);
        this.log(`Sẽ thử lại sau ${delay}ms`);

        setTimeout(() => {
            this.loadImageWithProxy(imgElement, loadingElement);
        }, delay);
    }

    // Tải ảnh trực tiếp (fallback)
    loadImageDirect(imgElement, loadingElement) {
        const directUrl = this.convertToDirectUrl(imgElement.dataset.src);
        this.warn(`Fallback: Tải trực tiếp từ ${directUrl}`);
        
        imgElement.onerror = null; // Vô hiệu hóa xử lý lỗi
        imgElement.src = directUrl;
        
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    // Chuyển đổi URL proxy thành URL trực tiếp
    convertToDirectUrl(proxyUrl) {
        const path = proxyUrl.replace('/proxy/', '');
        return `https://cdn.jsdelivr.net/gh/${path}`;
    }

    // Ghi log
    log(message) {
        this.addLogEntry(message, 'log');
        console.log(message);
    }

    warn(message) {
        this.addLogEntry(message, 'warn');
        console.warn(message);
    }

    error(message) {
        this.addLogEntry(message, 'error');
        console.error(message);
    }

    // Thêm entry vào log
    addLogEntry(message, type = 'log') {
        const logEntries = document.getElementById('log-entries');
        if (!logEntries) return;

        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logEntries.appendChild(entry);
        logEntries.scrollTop = logEntries.scrollHeight;
    }
}

// Khởi động ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    new ImageProxyApp();
});
