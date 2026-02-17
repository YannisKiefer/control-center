/**
 * Proxy Failover System
 * Handles automatic proxy switching when failures occur
 * 
 * INTEGRATED: Moved from /management/accountProxy/ to Control Center
 */

import { DatabaseClient } from './database/client';
import { Account, Proxy, Incident } from './database/schema';

export interface FailoverConfig {
  maxRetries: number;
  retryDelayMs: number;
  enableAutoFailover: boolean;
  preserveSession: boolean;
}

export interface FailoverResult {
  success: boolean;
  accountId: string;
  oldProxyId: string;
  newProxyId?: string;
  error?: string;
  incidentId?: string;
}

export class ProxyFailover {
  private db: DatabaseClient;
  private config: FailoverConfig;
  private inProgress: Set<string> = new Set();

  constructor(
    db: DatabaseClient,
    config: Partial<FailoverConfig> = {}
  ) {
    this.db = db;
    this.config = {
      maxRetries: 3,
      retryDelayMs: 5000,
      enableAutoFailover: true,
      preserveSession: true,
      ...config
    };
  }

  /**
   * Handle proxy failure for an account
   * Automatically finds and assigns a new proxy
   */
  async handleProxyFailure(accountId: string, reason?: string): Promise<FailoverResult> {
    // Prevent concurrent failovers for same account
    if (this.inProgress.has(accountId)) {
      return {
        success: false,
        accountId,
        oldProxyId: '',
        error: 'Failover already in progress for this account'
      };
    }

    this.inProgress.add(accountId);

    try {
      const account = this.db.getAccount(accountId);
      if (!account) {
        return {
          success: false,
          accountId,
          oldProxyId: '',
          error: 'Account not found'
        };
      }

      const oldProxyId = account.proxyId;

      // Check if auto-failover is enabled
      if (!this.config.enableAutoFailover) {
        // Create incident but don't auto-switch
        const incident = this.db.createIncident({
          type: 'proxy_failure',
          severity: 'high',
          accountId,
          proxyId: oldProxyId,
          title: `Proxy failure detected for ${accountId}`,
          description: reason || 'Auto-failover disabled',
          status: 'open'
        });

        return {
          success: false,
          accountId,
          oldProxyId,
          error: 'Auto-failover disabled',
          incidentId: incident.id
        };
      }

      // Mark old proxy as failed
      this.db.updateProxy(oldProxyId, { status: 'failed' });

      // Find available proxy
      const newProxy = this.db.findAvailableProxy();
      
      if (!newProxy) {
        // No available proxies - critical incident
        const incident = this.db.createIncident({
          type: 'proxy_failure',
          severity: 'critical',
          accountId,
          proxyId: oldProxyId,
          title: `CRITICAL: No available proxies for ${accountId}`,
          description: `Proxy ${oldProxyId} failed and no backup proxies available.`,
          status: 'open'
        });

        return {
          success: false,
          accountId,
          oldProxyId,
          error: 'No available proxies for failover',
          incidentId: incident.id
        };
      }

      // Perform the switch
      this.db.updateAccountProxy(accountId, newProxy.id, reason || 'proxy_failure');

      // Update AdsPower profile with new proxy (if integration exists)
      await this.updateAdsPowerProxy(account.adspowerProfileId, newProxy);

      // Create incident record
      const incident = this.db.createIncident({
        type: 'failover_triggered',
        severity: 'medium',
        accountId,
        proxyId: oldProxyId,
        oldProxyId,
        newProxyId: newProxy.id,
        title: `Failover completed for ${accountId}`,
        description: `Switched from ${oldProxyId} to ${newProxy.id}. Reason: ${reason || 'proxy_failure'}`,
        status: 'resolved',
        resolution: 'Automatic failover completed successfully'
      });

      // Mark incident as resolved immediately for auto-failover
      this.db.resolveIncident(incident.id, 'Automatic failover completed', 'system');

      return {
        success: true,
        accountId,
        oldProxyId,
        newProxyId: newProxy.id,
        incidentId: incident.id
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        accountId,
        oldProxyId: '',
        error: errorMsg
      };
    } finally {
      this.inProgress.delete(accountId);
    }
  }

  /**
   * Handle proxy degradation (slow but not completely failed)
   */
  async handleProxyDegradation(proxyId: string, metrics: DegradationMetrics): Promise<void> {
    const proxy = this.db.getProxy(proxyId);
    if (!proxy) return;

    // Create incident
    this.db.createIncident({
      type: 'proxy_degraded',
      severity: metrics.severity,
      proxyId,
      title: `Proxy ${proxyId} degraded`,
      description: `Response time: ${metrics.avgResponseTime}ms, Success rate: ${metrics.successRate}%`,
      status: 'open'
    });

    // Reduce health score
    const newHealthScore = Math.max(0, proxy.healthScore - 15);
    this.db.updateProxy(proxyId, { healthScore: newHealthScore });

    // If severely degraded, consider proactive failover
    if (metrics.successRate < 50) {
      const affectedAccounts = this.db.getAccountsByProxy(proxyId);
      
      for (const account of affectedAccounts) {
        await this.handleProxyFailure(account.id, 'proactive_degradation');
      }
    }
  }

  /**
   * Recover a previously failed proxy
   */
  async recoverProxy(proxyId: string): Promise<boolean> {
    const proxy = this.db.getProxy(proxyId);
    if (!proxy) return false;

    // Test the proxy
    const { HealthMonitor } = await import('./health');
    const healthMonitor = new HealthMonitor(this.db);
    const testResult = await healthMonitor.testProxy(proxy);

    if (testResult.working) {
      this.db.updateProxy(proxyId, {
        status: 'active',
        healthScore: Math.min(100, proxy.healthScore + 20),
        lastTested: new Date()
      });

      // Resolve any open incidents for this proxy
      const incidents = this.db.getIncidentsByProxy(proxyId);
      for (const incident of incidents) {
        if (incident.status === 'open') {
          this.db.resolveIncident(
            incident.id,
            'Proxy recovered and passed health check',
            'system'
          );
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Bulk failover - move all accounts from one proxy to others
   */
  async bulkFailover(fromProxyId: string, reason?: string): Promise<BulkFailoverResult> {
    const accounts = this.db.getAccountsByProxy(fromProxyId);
    const results: FailoverResult[] = [];

    // Mark proxy as failed
    this.db.updateProxy(fromProxyId, { status: 'failed' });

    for (const account of accounts) {
      const result = await this.handleProxyFailure(account.id, reason || 'bulk_failover');
      results.push(result);
    }

    return {
      total: accounts.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Schedule a proxy for maintenance
   */
  async scheduleMaintenance(proxyId: string, durationMinutes: number): Promise<void> {
    const proxy = this.db.getProxy(proxyId);
    if (!proxy) throw new Error(`Proxy ${proxyId} not found`);

    // Mark proxy as maintenance
    this.db.updateProxy(proxyId, { status: 'maintenance' });

    // Move all accounts
    await this.bulkFailover(proxyId, 'scheduled_maintenance');

    // Create incident for tracking
    this.db.createIncident({
      type: 'manual_intervention',
      severity: 'low',
      proxyId,
      title: `Proxy ${proxyId} scheduled for maintenance`,
      description: `Duration: ${durationMinutes} minutes`,
      status: 'resolved',
      resolution: 'Accounts moved to other proxies'
    });
  }

  /**
   * Get failover status for all accounts
   */
  getFailoverStatus(): FailoverStatus {
    const accounts = this.db.getAllAccounts();
    const proxies = this.db.getAllProxies();
    
    const proxyStatus = proxies.map(p => ({
      id: p.id,
      status: p.status,
      assignedAccounts: p.assignedAccounts,
      canAcceptMore: p.assignedAccounts < p.maxAccounts
    }));

    const vulnerableAccounts = accounts.filter(a => {
      const proxy = proxies.find(p => p.id === a.proxyId);
      return proxy?.status !== 'active';
    });

    return {
      totalAccounts: accounts.length,
      protectedAccounts: accounts.length - vulnerableAccounts.length,
      vulnerableAccounts: vulnerableAccounts.length,
      proxyStatus,
      canFailover: proxyStatus.some(p => p.canAcceptMore),
      inProgress: Array.from(this.inProgress)
    };
  }

  /**
   * Update AdsPower profile with new proxy settings
   */
  private async updateAdsPowerProxy(profileId: string, proxy: Proxy): Promise<void> {
    // This would integrate with AdsPower API
    // For now, just log the intent
    console.log(`[AdsPower] Would update profile ${profileId} with proxy ${proxy.id}`);
    
    // Example integration:
    // await adspower.updateProfile(profileId, {
    //   proxy: {
    //     type: proxy.protocol,
    //     host: proxy.host,
    //     port: proxy.port,
    //     username: proxy.username,
    //     password: proxy.password
    //   }
    // });
  }

  /**
   * Retry a failed operation with exponential backoff
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          console.log(`[${context}] Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// TYPES
// ============================================================

interface DegradationMetrics {
  avgResponseTime: number;
  successRate: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface BulkFailoverResult {
  total: number;
  successful: number;
  failed: number;
  results: FailoverResult[];
}

export interface FailoverStatus {
  totalAccounts: number;
  protectedAccounts: number;
  vulnerableAccounts: number;
  proxyStatus: {
    id: string;
    status: string;
    assignedAccounts: number;
    canAcceptMore: boolean;
  }[];
  canFailover: boolean;
  inProgress: string[];
}
