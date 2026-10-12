/**
 * In-Memory Response Caching Middleware
 * Configurable 1.5s - 3s TTL to protect MongoDB / storage against burst queries & high-frequency polling
 */

class MemoryCache {
  constructor(defaultTtlMs = 2000) {
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key, data, ttlMs = this.defaultTtlMs) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs
    });
  }

  invalidate(pattern = null) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new MemoryCache(2000); // 2.0s TTL default

export function cacheMiddleware(ttlMs = 2000) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `__cache__${req.originalUrl || req.url}`;
    const cachedResponse = memoryCache.get(key);

    if (cachedResponse) {
      res.setHeader('X-Cache-Status', 'HIT');
      return res.json(cachedResponse);
    }

    // Intercept res.json to store in memory
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.setHeader('X-Cache-Status', 'MISS');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        memoryCache.set(key, body, ttlMs);
      }
      return originalJson(body);
    };

    next();
  };
}
