import axios from 'axios';

/**
 * Dynamic Round-Robin & Auto-Failover API Client Engine
 * Configurable Multi-Endpoint Pool with Automatic 5xx/Timeout Retry on Backup Server
 */

// Default endpoint pool: Primary Node + Localhost Replica / Backup Node
const DEFAULT_ENDPOINTS = [
  import.meta.env.VITE_PRIMARY_API_URL || 'http://localhost:5050/api',
  import.meta.env.VITE_REPLICA_API_URL || 'http://localhost:5050/api',
  'http://127.0.0.1:5050/api',
  'http://127.0.0.1:5050/api'
];

class FailoverEngine {
  constructor(endpoints = DEFAULT_ENDPOINTS) {
    this.endpoints = endpoints.filter(Boolean);
    this.currentIndex = 0;
    this.subscribers = new Set();
    this.nodeStats = this.endpoints.map((url, idx) => ({
      id: `node-${idx + 1}`,
      url,
      healthy: true,
      lastLatency: 0,
      totalRequests: 0,
      failedAttempts: 0,
      lastStatus: 'ONLINE'
    }));

    // Create custom Axios instance
    this.client = axios.create({
      timeout: 15000, // 15s timeout for high-concurrency peak load resilience
      headers: {
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  getActiveEndpoint() {
    return this.endpoints[this.currentIndex];
  }

  getActiveNodeStats() {
    return this.nodeStats[this.currentIndex];
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    listener({
      activeEndpoint: this.getActiveEndpoint(),
      activeNode: this.getActiveNodeStats(),
      allNodes: [...this.nodeStats]
    });
    return () => this.subscribers.delete(listener);
  }

  notify() {
    const state = {
      activeEndpoint: this.getActiveEndpoint(),
      activeNode: this.getActiveNodeStats(),
      allNodes: [...this.nodeStats]
    };
    this.subscribers.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {}
    });
  }

  rotateToNextNode() {
    const prevIndex = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
    console.warn(`Auto-Failover: Switching from Node ${prevIndex + 1} (${this.endpoints[prevIndex]}) to Node ${this.currentIndex + 1} (${this.endpoints[this.currentIndex]})`);
    this.notify();
    return this.endpoints[this.currentIndex];
  }

  setupInterceptors() {
    // Request Interceptor
    this.client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };

        // Attach target base URL
        const base = this.getActiveEndpoint();
        if (!config.url.startsWith('http://') && !config.url.startsWith('https://')) {
          config.url = `${base.replace(/\/$/, '')}/${config.url.replace(/^\//, '')}`;
        }

        // Attach admin JWT token if present in localStorage
        const token = localStorage.getItem('agri_admin_token') || localStorage.getItem('adminToken');
        if (token) {
          if (config.headers?.set) {
            config.headers.set('Authorization', `Bearer ${token}`);
          } else {
            config.headers = config.headers || {};
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }

        config.headers['X-Failover-Attempt'] = config._retryCount || 1;
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response Interceptor with Automatic 5xx / Timeout Failover Retry
    this.client.interceptors.response.use(
      (response) => {
        const latency = Date.now() - (response.config.metadata?.startTime || Date.now());
        const stat = this.nodeStats[this.currentIndex];
        if (stat) {
          stat.healthy = true;
          stat.lastLatency = latency;
          stat.totalRequests += 1;
          stat.lastStatus = 'HEALTHY';
        }
        this.notify();
        return response;
      },
      async (error) => {
        const config = error.config;
        if (!config) return Promise.reject(error);

        config._retryCount = config._retryCount || 0;
        const maxRetries = this.endpoints.length;

        const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
        const isNetworkError = !error.response;
        const is5xx = error.response && error.response.status >= 500 && error.response.status <= 599;

        // Mark current node degraded
        const stat = this.nodeStats[this.currentIndex];
        if (stat) {
          stat.healthy = false;
          stat.failedAttempts += 1;
          stat.lastStatus = isTimeout ? 'TIMEOUT' : is5xx ? '5XX_ERR' : 'OFFLINE';
        }

        // Check if failover retry is applicable
        if ((isTimeout || isNetworkError || is5xx) && config._retryCount < maxRetries) {
          config._retryCount += 1;
          
          // Switch to backup server
          this.rotateToNextNode();

          // Reset URL for new node
          const newBase = this.getActiveEndpoint();
          const cleanPath = config.url.replace(/^https?:\/\/[^\/]+(\/api)?/, '');
          config.url = `${newBase.replace(/\/$/, '')}/${cleanPath.replace(/^\//, '')}`;

          console.info(`⚡ Retrying request on failover replica [Attempt ${config._retryCount}/${maxRetries}] -> ${config.url}`);
          return this.client(config);
        }

        this.notify();
        return Promise.reject(error);
      }
    );
  }

  // Helper Methods
  get(url, config = {}) {
    return this.client.get(url, config);
  }

  post(url, data, config = {}) {
    return this.client.post(url, data, config);
  }

  patch(url, data, config = {}) {
    return this.client.patch(url, data, config);
  }

  put(url, data, config = {}) {
    return this.client.put(url, data, config);
  }

  delete(url, config = {}) {
    return this.client.delete(url, config);
  }
}

export const failoverApi = new FailoverEngine();
export default failoverApi;
