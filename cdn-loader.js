class MultiCDN {
  constructor(configUrl) {
    this.config = {};
    this.stats = {
      requests: 0,
      jsdelivr: 0,
      github: 0,
      errors: 0,
      cacheHits: 0
    };
    this.cache = new Map();
    this.loadConfig(configUrl);
  }

  async loadConfig(configUrl) {
    try {
      const response = await fetch(`${configUrl}?t=${Date.now()}`);
      this.config = await response.json();
      console.log('CDN config loaded:', this.config);
    } catch (error) {
      console.error('Failed to load CDN config:', error);
    }
  }

  async getImage(imageKey) {
    this.stats.requests++;
    
    // Kiểm tra cache trước
    if (this.cache.has(imageKey)) {
      this.stats.cacheHits++;
      return this.cache.get(imageKey);
    }

    const imagePath = this.config.imageMap?.[imageKey];
    if (!imagePath) {
      throw new Error(`Image key '${imageKey}' not found in config`);
    }

    // Thử tải từ tất cả nguồn
    const sources = this.generateSources(imagePath);
    for (const source of sources) {
      try {
        const imgUrl = await this.trySource(source);
        this.cache.set(imageKey, imgUrl); // Cache kết quả
        return imgUrl;
      } catch (error) {
        console.warn(`Failed from ${source.type}:`, error);
      }
    }

    this.stats.errors++;
    throw new Error(`All sources failed for image ${imageKey}`);
  }

  generateSources(imagePath) {
    const sources = [];
    this.config.repositories?.forEach(repo => {
      sources.push(
        {
          type: 'jsdelivr',
          url: `https://cdn.jsdelivr.net/gh/${repo.user}/${repo.repo}@${repo.branch}${repo.path}/${imagePath}`
        },
        {
          type: 'github',
          url: `https://${repo.user}.github.io/${repo.repo}${repo.path}/${imagePath}`
        }
      );
    });
    return sources;
  }

  async trySource(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.stats[source.type]++;
        resolve(source.url);
      };
      img.onerror = () => reject(new Error(`Failed to load from ${source.type}`));
      img.src = `${source.url}?t=${Date.now()}`;
    });
  }

  getStats() {
    return this.stats;
  }

  clearCache() {
    this.cache.clear();
  }
}
