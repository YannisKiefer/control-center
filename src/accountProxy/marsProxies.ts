/**
 * MarsProxies Integration Client
 * Handles proxy testing and management
 * 
 * INTEGRATED: Moved from /management/accountProxy/ to Control Center
 */

import { Proxy } from './database/schema';

export interface MarsProxyConfig {
  host: string;
  portRange: { min: number; max: number };
  username: string;
  password: string;
  protocol: 'socks5' | 'https';
}

export class MarsProxiesClient {
  private config: MarsProxyConfig;

  constructor(config: MarsProxyConfig) {
    this.config = config;
  }

  /**
   * Generate proxy configurations for all ports in range
   */
  generateProxies(): Proxy[] {
    const proxies: Proxy[] = [];
    
    for (let port = this.config.portRange.min; port <= this.config.portRange.max; port++) {
      const id = `mars_${String(port - this.config.portRange.min + 1).padStart(3, '0')}`;
      
      proxies.push({
        id,
        name: `Mars ISP ${port - this.config.portRange.min + 1}`,
        host: this.config.host,
        port,
        username: this.config.username,
        password: this.config.password,
        protocol: this.config.protocol,
        status: 'active',
        healthScore: 100,
        maxAccounts: 2,
        assignedAccounts: 0,
        avgResponseTime: 0,
        successRate: 100,
        lastTested: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return proxies;
  }

  /**
   * Test if a proxy is working
   */
  async testProxy(proxy: Proxy, testUrl: string = 'https://twitter.com'): Promise<ProxyTestResult> {
    try {
      const { default: fetch } = await import('node-fetch');
      const { SocksProxyAgent } = await import('socks-proxy-agent');
      
      const proxyUrl = proxy.protocol === 'socks5'
        ? `socks5://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
        : `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;

      const agent = new SocksProxyAgent(proxyUrl);
      const startTime = Date.now();
      
      const response = await fetch(testUrl, {
        agent,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const responseTime = Date.now() - startTime;

      return {
        working: response.ok,
        responseTime,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };

    } catch (error) {
      return {
        working: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test all proxies and return results
   */
  async testAllProxies(proxies: Proxy[]): Promise<ProxyTestReport> {
    const results: ProxyTestResultDetail[] = [];
    
    for (const proxy of proxies) {
      const result = await this.testProxy(proxy);
      results.push({
        proxyId: proxy.id,
        proxyHost: `${proxy.host}:${proxy.port}`,
        ...result
      });
    }

    const working = results.filter(r => r.working);
    const failed = results.filter(r => !r.working);

    return {
      total: results.length,
      working: working.length,
      failed: failed.length,
      results,
      summary: {
        averageResponseTime: working.reduce((sum, r) => sum + r.responseTime, 0) / working.length || 0,
        failedProxies: failed.map(r => r.proxyId)
      }
    };
  }

  /**
   * Get proxy URL for use with libraries
   */
  getProxyUrl(proxy: Proxy): string {
    if (proxy.protocol === 'socks5') {
      return `socks5://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    }
    return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  }

  /**
   * Get proxy configuration for fetch/axios
   */
  getProxyConfig(proxy: Proxy): ProxyConfig {
    return {
      host: proxy.host,
      port: proxy.port,
      auth: {
        username: proxy.username,
        password: proxy.password
      },
      protocol: proxy.protocol
    };
  }
}

// ============================================================
// TYPES
// ============================================================

interface ProxyTestResult {
  working: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
}

interface ProxyTestResultDetail extends ProxyTestResult {
  proxyId: string;
  proxyHost: string;
}

interface ProxyTestReport {
  total: number;
  working: number;
  failed: number;
  results: ProxyTestResultDetail[];
  summary: {
    averageResponseTime: number;
    failedProxies: string[];
  };
}

interface ProxyConfig {
  host: string;
  port: number;
  auth: {
    username: string;
    password: string;
  };
  protocol: 'socks5' | 'https';
}
