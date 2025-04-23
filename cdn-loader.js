class MultiCDN {
  constructor(configUrl) {
    this.config = null;
    this.stats = {
      totalRequests: 0,
      successful: 0,
      failed: 0,
      sources: {},
      cache: {
        hits: 0,
        misses: 0
      }
    };
    this.cache = {
      data: new Map(),
      timers: new Map()
    };
    
    this.init(configUrl);
  }

  async init(configUrl) {
    try {
      const response = await fetch(configUrl, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} loading config`);
      }
      
      this.config = await response.json();
      this.initializeSources();
      console.log('CDN system initialized', this.config);
    } catch (error) {
      console.error('CDN initialization failed:', error);
      this.loadFallbackConfig();
    }
  }

  initializeSources() {
    // Khởi tạo thống kê cho từng nguồn
    this.config.repositories.forEach(repo => {
      this.stats.sources[`jsdelivr:${repo.name}`] = 0;
      this.stats.sources[`github:${repo.name}`] = 0;
    });
  }

  loadFallbackConfig() {
    console.warn('Using fallback configuration');
    this.config = {
      repositories: [
        {
          name: "fallback",
          user: "azcloud68",
          repo: "my-cdn-test",
          branch: "main",
          path: "/images",
          priority: 1
        }
      ],
      imageMap: {
        test1: "test1.jpg",
        test2: "test2.jpg"
      },
      settings: {
        cacheTTL: 300,
        retryAttempts: 1,
        timeout: 3000
      }
    };
    this.initializeSources();
  }

  async getImage(imageKey) {
    this.stats.totalRequests++;
    
    // Kiểm tra cache
    if (this.cache.data.has(imageKey)) {
      this.stats.cache.hits++;
      return this.cache.data.get(imageKey);
    }
    this.stats.cache.misses++;

    const imagePath = this.config?.imageMap?.[imageKey];
    if (!imagePath) {
      this.stats.failed++;
      throw new Error(`Image "${imageKey}" not found in configuration`);
    }

    // Sắp xếp các nguồn theo priority
    const sortedRepos = [...this.config.repositories].sort((a, b) => a.priority - b.priority);
    
    for (const repo of sortedRepos) {
      const sources = [
        {
          type: 'jsdelivr',
          url: `https://cdn.jsdelivr.net/gh/${repo.user}/${repo.repo}@${repo.branch}${repo.path}/${imagePath}`,
          repoName: repo.name
        },
        {
          type: 'github',
          url: `https://${repo.user}.github.io/${repo.repo}${repo.path}/${imagePath}`,
          repoName: repo.name
        }
      ];

      for (const source of sources) {
        try {
          const imgUrl = await this.tryFetch(source);
          this.cacheImage(imageKey, imgUrl);
          this.stats.successful++;
          this.stats.sources[`${source.type}:${source.repoName}`]++;
          return imgUrl;
        } catch (error) {
          console.warn(`Failed to load from ${source.type} (${source.repoName}):`, error);
        }
      }
    }

    this.stats.failed++;
    throw new Error(`All sources failed for image "${imageKey}"`);
  }

  async tryFetch(source) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config?.settings?.timeout || 5000
    );

    try {
      const response = await fetch(source.url, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return source.url;
    } finally {
      clearTimeout(timeout);
    }
  }

  cacheImage(key, url) {
    this.cache.data.set(key, url);
    
    // Tự động xóa cache sau TTL
    const ttl = this.config?.settings?.cacheTTL || 3600;
    const timer = setTimeout(() => {
      this.cache.data.delete(key);
      this.cache.timers.delete(key);
    }, ttl * 1000);
    
    // Clear timer cũ nếu có
    if (this.cache.timers.has(key)) {
      clearTimeout(this.cache.timers.get(key));
    }
    
    this.cache.timers.set(key, timer);
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successful / this.stats.totalRequests * 100).toFixed(2) + '%' 
        : '0%'
    };
  }

  clearCache() {
    this.cache.data.clear();
    this.cache.timers.forEach(timer => clearTimeout(timer));
    this.cache.timers.clear();
  }
}
