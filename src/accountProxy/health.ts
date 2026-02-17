/**
 * Health Monitoring System
 * Daily health checks for accounts and proxies
 * 
 * INTEGRATED: Moved from /management/accountProxy/ to Control Center
 */

import { DatabaseClient } from './database/client';
import { Account, Proxy, Incident } from './database/schema';

export interface HealthCheckConfig {
  proxyTestUrl: string;
  proxyTimeoutMs: number;
  accountCheckEnabled: boolean;
  alertThreshold: number;        // Health score below this triggers alert
  criticalThreshold: number;     // Health score below this is critical
}

export interface HealthCheckResult {
  accountId: string;
  proxyId: string;
  timestamp: Date;
  proxyWorking: boolean;
  proxyResponseTime: number;
  accountStatus: 'active' | 'suspended' | 'banned' | 'unknown';
  healthScore: number;
  issues: string[];
  alerts: string[];
}

export class HealthMonitor {
  private db: DatabaseClient;
  private config: HealthCheckConfig;
  private alertCallbacks: ((message: string) => void)[] = [];

  constructor(
    db: DatabaseClient,
    config: Partial<HealthCheckConfig> = {}
  ) {
    this.db = db;
    this.config = {
      proxyTestUrl: 'https://twitter.com',
      proxyTimeoutMs: 10000,
      accountCheckEnabled: true,
      alertThreshold: 50,
      criticalThreshold: 25,
      ...config
    };
  }

  onAlert(callback: (message: string) => void): void {
    this.alertCallbacks.push(callback);
  }

  private async sendAlert(message: string): Promise<void> {
    for (const callback of this.alertCallbacks) {
      try {
        callback(message);
      } catch (error) {
        console.error('Alert callback failed:', error);
      }
    }
  }

  /**
   * Run full health check on all accounts
   */
  async runDailyHealthCheck(): Promise<HealthCheckResult[]> {
    const accounts = this.db.getActiveAccounts();
    const results: HealthCheckResult[] = [];

    for (const account of accounts) {
      const result = await this.checkAccountHealth(account);
      results.push(result);
      
      // Log the check
      this.db.logHealthCheck({
        accountId: account.id,
        proxyId: account.proxyId,
        checkType: 'full',
        proxyWorking: result.proxyWorking,
        proxyResponseTime: result.proxyResponseTime,
        accountStatus: result.accountStatus,
        healthScore: result.healthScore,
        issues: result.issues
      });

      // Update account health score
      this.db.updateAccount(account.id, {
        healthScore: result.healthScore,
        lastChecked: new Date()
      });

      // Send alerts if needed
      if (result.healthScore < this.config.criticalThreshold) {
        await this.sendAlert(`🚨 CRITICAL: Account ${account.id} health is ${result.healthScore}`);
        this.createIncident('health_check_failed', account, result);
      } else if (result.healthScore < this.config.alertThreshold) {
        await this.sendAlert(`⚠️ WARNING: Account ${account.id} health is ${result.healthScore}`);
      }
    }

    return results;
  }

  /**
   * Check health of a single account
   */
  async checkAccountHealth(account: Account): Promise<HealthCheckResult> {
    const proxy = this.db.getProxy(account.proxyId);
    const issues: string[] = [];
    const alerts: string[] = [];

    // 1. Test proxy connectivity
    const proxyTest = await this.testProxy(proxy!);
    if (!proxyTest.working) {
      issues.push(`Proxy failed: ${proxyTest.error}`);
      alerts.push('Proxy connectivity issue');
    }

    // 2. Check account status (via AdsPower or direct check)
    const accountStatus = await this.checkAccountStatus(account);
    if (accountStatus !== 'active') {
      issues.push(`Account status: ${accountStatus}`);
      alerts.push('Account not active');
    }

    // 3. Check action limits
    if (account.actionsToday >= account.dailyActionLimit) {
      issues.push('Daily action limit reached');
    }

    // 4. Check spam score
    if (account.spamScore > 70) {
      issues.push(`High spam score: ${account.spamScore}`);
      alerts.push('Elevated spam risk');
    }

    // 5. Check last action time
    const hoursSinceLastAction = (Date.now() - account.lastAction.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastAction > 48) {
      issues.push(`No activity for ${Math.round(hoursSinceLastAction)} hours`);
    }

    // Calculate health score
    const healthScore = this.calculateHealthScore({
      proxyWorking: proxyTest.working,
      accountStatus,
      actionRatio: account.actionsToday / account.dailyActionLimit,
      spamScore: account.spamScore,
      issues: issues.length
    });

    return {
      accountId: account.id,
      proxyId: account.proxyId,
      timestamp: new Date(),
      proxyWorking: proxyTest.working,
      proxyResponseTime: proxyTest.responseTime,
      accountStatus,
      healthScore,
      issues,
      alerts
    };
  }

  /**
   * Test proxy connectivity
   */
  async testProxy(proxy: Proxy): Promise<ProxyTestResult> {
    const startTime = Date.now();
    
    try {
      // Use node-fetch with proxy agent
      const { default: fetch } = await import('node-fetch');
      const { SocksProxyAgent } = await import('socks-proxy-agent');
      
      const proxyUrl = proxy.protocol === 'socks5'
        ? `socks5://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
        : `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;

      const agent = new SocksProxyAgent(proxyUrl);
      
      const response = await fetch(this.config.proxyTestUrl, {
        agent,
        timeout: this.config.proxyTimeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const responseTime = Date.now() - startTime;

      // Update proxy metrics
      this.db.updateProxy(proxy.id, {
        lastTested: new Date(),
        avgResponseTime: responseTime,
        successRate: response.ok ? 100 : 0
      });

      if (response.ok) {
        return {
          working: true,
          responseTime,
          statusCode: response.status
        };
      } else {
        return {
          working: false,
          responseTime,
          statusCode: response.status,
          error: `HTTP ${response.status}`
        };
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Update proxy as potentially failed
      this.db.updateProxy(proxy.id, {
        lastTested: new Date(),
        successRate: 0
      });

      return {
        working: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check all proxies (without account context)
   */
  async checkAllProxies(): Promise<ProxyHealthResult[]> {
    const proxies = this.db.getAllProxies();
    const results: ProxyHealthResult[] = [];

    for (const proxy of proxies) {
      const testResult = await this.testProxy(proxy);
      
      results.push({
        proxyId: proxy.id,
        ...testResult
      });

      // Update proxy status
      if (!testResult.working) {
        this.db.updateProxy(proxy.id, {
          status: 'failed',
          healthScore: Math.max(0, proxy.healthScore - 20)
        });

        // Create incident
        this.db.createIncident({
          type: 'proxy_failure',
          severity: 'high',
          proxyId: proxy.id,
          title: `Proxy ${proxy.id} failed health check`,
          description: testResult.error || 'Unknown error',
          status: 'open'
        });
      } else {
        // Recovering proxy
        if (proxy.status === 'failed') {
          this.db.updateProxy(proxy.id, {
            status: 'active',
            healthScore: Math.min(100, proxy.healthScore + 10)
          });
        }
      }

      // Log health check
      this.db.logHealthCheck({
        proxyId: proxy.id,
        checkType: 'proxy',
        proxyWorking: testResult.working,
        proxyResponseTime: testResult.responseTime,
        healthScore: testResult.working ? 100 : 0,
        issues: testResult.error ? [testResult.error] : []
      });
    }

    return results;
  }

  /**
   * Check account status via AdsPower or other methods
   */
  private async checkAccountStatus(account: Account): Promise<'active' | 'suspended' | 'banned' | 'unknown'> {
    // This would integrate with AdsPower API or Twitter directly
    // For now, return the stored status
    return account.status;
  }

  /**
   * Calculate health score based on various factors
   */
  private calculateHealthScore(factors: HealthFactors): number {
    let score = 100;

    // Proxy health (40% weight)
    if (!factors.proxyWorking) score -= 40;

    // Account status (30% weight)
    if (factors.accountStatus === 'suspended') score -= 30;
    if (factors.accountStatus === 'banned') score -= 50;

    // Action ratio (10% weight)
    if (factors.actionRatio > 0.9) score -= 10;

    // Spam score (10% weight)
    score -= Math.floor(factors.spamScore / 10);

    // Issues (10% weight, -2 per issue)
    score -= factors.issues * 2;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Create incident for health issues
   */
  private createIncident(
    type: Incident['type'],
    account: Account,
    result: HealthCheckResult
  ): void {
    this.db.createIncident({
      type,
      severity: result.healthScore < 25 ? 'critical' : 'high',
      accountId: account.id,
      proxyId: account.proxyId,
      title: `Health check failed for ${account.id}`,
      description: result.issues.join('\n'),
      status: 'open'
    });
  }

  /**
   * Get health summary for dashboard
   */
  getHealthSummary(): HealthSummary {
    const accounts = this.db.getAllAccounts();
    const proxies = this.db.getAllProxies();

    const healthDistribution = {
      excellent: accounts.filter(a => a.healthScore >= 80).length,
      good: accounts.filter(a => a.healthScore >= 60 && a.healthScore < 80).length,
      warning: accounts.filter(a => a.healthScore >= 40 && a.healthScore < 60).length,
      critical: accounts.filter(a => a.healthScore < 40).length
    };

    const proxyHealth = proxies.map(p => ({
      id: p.id,
      status: p.status,
      healthScore: p.healthScore,
      responseTime: p.avgResponseTime,
      successRate: p.successRate
    }));

    return {
      totalAccounts: accounts.length,
      averageHealth: Math.round(
        accounts.reduce((sum, a) => sum + a.healthScore, 0) / accounts.length
      ),
      healthDistribution,
      proxyHealth,
      failingProxies: proxies.filter(p => p.status !== 'active').length,
      accountsNeedingAttention: accounts.filter(a => a.healthScore < 50).length
    };
  }

  /**
   * Reset daily action counters
   */
  resetDailyActions(): void {
    this.db.resetDailyActions();
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

interface ProxyHealthResult extends ProxyTestResult {
  proxyId: string;
}

interface HealthFactors {
  proxyWorking: boolean;
  accountStatus: string;
  actionRatio: number;
  spamScore: number;
  issues: number;
}

export interface HealthSummary {
  totalAccounts: number;
  averageHealth: number;
  healthDistribution: {
    excellent: number;
    good: number;
    warning: number;
    critical: number;
  };
  proxyHealth: {
    id: string;
    status: string;
    healthScore: number;
    responseTime: number;
    successRate: number;
  }[];
  failingProxies: number;
  accountsNeedingAttention: number;
}
