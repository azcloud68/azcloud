class ImageLoader {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.init();
  }

  init() {
    this.registerSW();
    this.loadImages();
    this.setupObservers();
  }

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('SW registered');
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                window.location.reload();
              }
            });
          });
        })
        .catch(err => console.error('SW registration failed:', err));
    }
  }

  loadImages() {
    document.querySelectorAll('[data-proxy-src]').forEach(img => {
      this.loadImage(img);
    });
  }

  async loadImage(img, attempt = 1) {
    const loadingEl = document.getElementById(img.dataset.loadingEl);
    
    try {
      if (loadingEl) {
        loadingEl.textContent = `Đang tải ảnh... ${attempt > 1 ? `(Thử lại lần ${attempt})` : ''}`;
        loadingEl.style.display = 'block';
      }

      img.src = img.dataset.proxySrc;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      if (loadingEl) loadingEl.style.display = 'none';
    } catch (err) {
      if (attempt < this.maxRetries) {
        setTimeout(() => this.loadImage(img, attempt + 1), this.retryDelay);
      } else {
        this.fallbackLoad(img, loadingEl);
      }
    }
  }

  fallbackLoad(img, loadingEl) {
    if (loadingEl) {
      loadingEl.textContent = 'Đang tải trực tiếp...';
    }
    
    img.src = img.dataset.fallbackSrc;
    img.onerror = () => {
      if (loadingEl) {
        loadingEl.textContent = 'Không thể tải ảnh';
        loadingEl.style.color = 'red';
      }
    };
  }

  setupObservers() {
    // Intersection Observer cho lazy loading
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          this.loadImage(img);
          observer.unobserve(img);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-lazy]').forEach(img => {
      observer.observe(img);
    });
  }
}

// Khởi động khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new ImageLoader();
});
