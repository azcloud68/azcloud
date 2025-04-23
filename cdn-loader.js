class CDNBalancer {
  constructor() {
    this.cdnSources = [
      'https://cdn.jsdelivr.net/gh/[username]/my-cdn-test@main',
      'https://[username].github.io/my-cdn-test'
    ];
    this.currentCDN = 0;
    this.stats = {
      jsdelivr: 0,
      github: 0,
      errors: 0
    };
  }

  async getImage(path) {
    const cdnUrl = `${this.cdnSources[this.currentCDN]}${path}`;
    
    try {
      // Kiểm tra ảnh có tồn tại không
      const test = await fetch(cdnUrl, { method: 'HEAD' });
      if (!test.ok) throw new Error('Image not found');
      
      // Ghi nhận thống kê
      this.stats[this.currentCDN === 0 ? 'jsdelivr' : 'github']++;
      this.saveStats();
      
      return cdnUrl;
    } catch (error) {
      this.stats.errors++;
      this.saveStats();
      
      // Chuyển sang CDN dự phòng
      this.currentCDN = (this.currentCDN + 1) % this.cdnSources.length;
      return this.getImage(path);
    }
  }

  saveStats() {
    // Lưu vào localStorage để hiển thị trên trang thống kê
    localStorage.setItem('cdnStats', JSON.stringify(this.stats));
  }

  getStats() {
    return this.stats;
  }
}

// Khởi tạo với username GitHub của bạn
const cdn = new CDNBalancer();
