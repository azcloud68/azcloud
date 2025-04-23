class CDNBalancer {
  constructor() {
    this.cdnSources = [
      'https://cdn.jsdelivr.net/gh/azcloud68/my-cdn-test@main',
      'https://azcloud68.github.io/my-cdn-test'
    ];
    this.currentCDN = 0;
    this.stats = {
      jsdelivr: 0,
      github: 0,
      errors: 0
    };
    this.maxRetries = 2;
  }

  async getImage(path) {
    let retries = 0;
    
    while (retries <= this.maxRetries) {
      const cdnUrl = `${this.cdnSources[this.currentCDN]}${path}`;
      
      try {
        // Kiểm tra ảnh có tồn tại không
        const test = await fetch(`${cdnUrl}?t=${Date.now()}`, { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        
        if (test.ok) {
          // Ghi nhận thống kê
          const cdnName = this.currentCDN === 0 ? 'jsdelivr' : 'github';
          this.stats[cdnName]++;
          this.saveStats();
          return cdnUrl;
        }
        
        throw new Error(`HTTP ${test.status}`);
      } catch (error) {
        console.warn(`CDN ${this.currentCDN === 0 ? 'jsDelivr' : 'GitHub'} failed: ${error.message}`);
        this.stats.errors++;
        this.saveStats();
        
        // Chuyển sang CDN khác
        this.currentCDN = (this.currentCDN + 1) % this.cdnSources.length;
        retries++;
      }
    }
    
    throw new Error('All CDN sources failed');
  }

  saveStats() {
    try {
      localStorage.setItem('cdnStats', JSON.stringify(this.stats));
    } catch (e) {
      console.warn('Failed to save stats to localStorage');
    }
  }

  getStats() {
    return this.stats;
  }
}
