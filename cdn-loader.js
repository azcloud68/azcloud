class CDNBalancer {
  constructor() {
    this.cdnSources = [
      'https://cdn.jsdelivr.net/gh/azcloud68/my-cdn-test@main',
      'https://azcloud68.github.io/my-cdn-test'
    ];
    this.stats = {
      jsdelivr: 0,
      github: 0,
      errors: 0
    };
    this.debug = true;
  }

  log(message) {
    if (this.debug) console.log('[CDN]', message);
  }

  async getImage(path) {
    // Thử tải từ cả 2 nguồn song song
    const results = await Promise.allSettled(
      this.cdnSources.map(baseUrl => this.tryFetch(baseUrl + path))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value.ok) {
        const cdnName = i === 0 ? 'jsdelivr' : 'github';
        this.stats[cdnName]++;
        this.log(`Success from ${cdnName}: ${path}`);
        return this.cdnSources[i] + path;
      }
    }

    this.stats.errors++;
    this.log(`All CDNs failed for: ${path}`);
    throw new Error(`Cannot load image from any CDN: ${path}`);
  }

  async tryFetch(url) {
    try {
      // Thêm random param để tránh cache
      const testUrl = url + `?nocache=${Math.random().toString(36).substring(2)}`;
      this.log(`Trying: ${testUrl}`);
      return await fetch(testUrl, { method: 'HEAD' });
    } catch (error) {
      this.log(`Fetch error: ${error.message}`);
      throw error;
    }
  }

  getStats() {
    return this.stats;
  }
}
