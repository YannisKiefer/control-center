/**
 * Account and Proxy Monitoring
 * Integrated with Control Center monitoring system
 */

import { EventBus } from '../eventBus.js';
import { UnifiedMemoryHub } from '../memoryHub.js';
import { AccountProxyManager, HealthCheckResult, Account, Proxy } from './accountProxy.js';

export interface MonitoringConfig {
  healthCheckIntervalMs: number;
  proxyTestIntervalMs: number;
  alertThreshold: number;
  criticalThreshold: number;
  enableAutoFailover: boolean;
  enableAlerts: boolean;
  alertChannels: ('event' | 'log' | 'webhook')[];
}

export interface Alert {
  id: string;
  type: 'proxy_failure' | 'proxy_degraded' | 'account_health_critical' | 'account_suspended' | 'failover_triggered' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  accountId?: string;
  proxyId?: string;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
}

export interface MonitoringStatus {
  isRunning: boolean;
  lastHealthCheck: Date | null;
  lastProxyTest: Date | null;
  totalChecks: number;
  alertsTriggered: number;
  failoversTriggered: number;
}

/**
 * Account and Proxy Monitor
 * Integrated with Control Center for unified monitoring
 */
export class AccountProxyMonitor {
  private manager: AccountProxyManager;
  private eventBus: EventBus;
  private memory: UnifiedMemoryHub;
  private config: MonitoringConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private proxyTestTimer?: NodeJS.Timeout;
  private alerts: Map<string, Alert> = new Map();
  private status: MonitoringStatus = {
    isRunning: false,
    lastHealthCheck: null,
    lastProxyTest: null,
    totalChecks: 0,
    alertsTriggered: 0,
    failoversTriggered: 0
  };

  constructor(
    manager: AccountProxyManager,
    eventBus: EventBus,
    memory: UnifiedMemoryHub,
    config: Partial<MonitoringConfig> = {}
  ) {
    this.manager = manager;
    this.eventBus = eventBus;
    this.memory = memory;
    this.config = {
      healthCheckIntervalMs: 5 * 60 * 1000, // 5 minutes
      proxyTestIntervalMs: 60 * 1000, // 1 minute
      alertThreshold: 50,
      criticalThreshold: 25,
      enableAutoFailover: true,
      enableAlerts: true,
      alertChannels: ['event', 'log'],
      ...config
    };
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.status.isRunning) return;

    console.log('[AccountProxyMonitor] Starting monitoring...');

    this.status.isRunning = true;

    // Start health check loop
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);

    // Start proxy test loop
    this.proxyTestTimer = setInterval(() => {
      this.testAllProxies();
    }, this.config.proxyTestIntervalMs);

    // Initial checks
    this.performHealthCheck();
    this.testAllProxies();

    // Subscribe to events
    this.setupEventSubscriptions();

    console.log('[AccountProxyMonitor] Monitoring started');

    // Publish monitoring started event
    this.eventBus.publish({
      source: 'account-proxy-monitor',
      type: 'monitoring.started',
      payload: { config: this.config },
      priority: 'low',
      metadata: {}
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.status.isRunning) return;

    console.log('[AccountProxyMonitor] Stopping monitoring...');

    this.status.isRunning = false;

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    if (this.proxyTestTimer) {
      clearInterval(this.proxyTestTimer);
      this.proxyTestTimer = undefined;
    }

    console.log('[AccountProxyMonitor] Monitoring stopped');

    this.eventBus.publish({
      source: 'account-proxy-monitor',
      type: 'monitoring.stopped',
      payload: {},
      priority: 'low',
      metadata: {}
    });
  }

  /**
   * Get monitoring status
   */
  getStatus(): MonitoringStatus {
    return { ...this.status };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart if running to apply new intervals
    if (this.status.isRunning) {
      this.stop();
      this.start();
    }
  }

  // ============================================================
  // HEALTH CHECKS
  // ============================================================

  /**
   * Perform health check on all accounts
   */
  async performHealthCheck(): Promise<HealthCheckResult[]> {
    console.log('[AccountProxyMonitor] Performing health check...');

    const results = await this.manager.runHealthCheck();
    this.status.lastHealthCheck = new Date();
    this.status.totalChecks += results.length;

    // Process results and trigger alerts
    for (const result of results) {
      if (result.healthScore < this.config.criticalThreshold) {
        this.triggerAlert({
          type: 'account_health_critical',
          severity: 'critical',
          title: `Critical Health: ${result.accountId}`,
          message: `Account health is ${result.healthScore}. Issues: ${result.issues.join(', ')}`,
          accountId: result.accountId,
          proxyId: result.proxyId
        });
      } else if (result.healthScore < this.config.alertThreshold) {
        this.triggerAlert({
          type: 'account_health_critical',
          severity: 'high',
          title: `Low Health: ${result.accountId}`,
          message: `Account health is ${result.healthScore}. Issues: ${result.issues.join(', ')}`,
          accountId: result.accountId,
          proxyId: result.proxyId
        });
      }

      // Check for proxy failures
      if (!result.proxyWorking) {
        this.triggerAlert({
          type: 'proxy_failure',
          severity: 'high',
          title: `Proxy Failure: ${result.proxyId}`,
          message: `Proxy failed health check for account ${result.accountId}`,
          accountId: result.accountId,
          proxyId: result.proxyId
        });

        // Auto-failover if enabled
        if (this.config.enableAutoFailover) {
          await this.handleAutoFailover(result.accountId, result.proxyId);
        }
      }
    }

    // Store results in memory
    this.memory.store('account-proxy/health-checks/latest', results, {
      tags: ['health-check', 'monitoring'],
      source: 'account-proxy-monitor'
    });

    // Publish event
    this.eventBus.publish({
      source: 'account-proxy-monitor',
      type: 'health-check.completed',
      payload: {
        checked: results.length,
        critical: results.filter(r => r.healthScore < this.config.criticalThreshold).length,
        warnings: results.filter(r => r.healthScore < this.config.alertThreshold).length
      },
      priority: 'low',
      metadata: {}
    });

    return results;
  }

  /**
   * Check health of specific account
   */
  async checkAccount(accountId: string): Promise<HealthCheckResult | null> {
    const account = this.manager.getAccount(accountId);
    if (!account) return null;

    // This would perform a detailed health check
    const result: HealthCheckResult = {
      accountId,
      proxyId: account.proxyId,
      timestamp: new Date(),
      proxyWorking: true,
      proxyResponseTime: 0,
      accountStatus: account.status,
      healthScore: account.healthScore,
      issues: [],
      alerts: []
    };

    // Test proxy
    const proxyTest = await this.manager.testProxy(account.proxyId);
    result.proxyWorking = proxyTest.working;
    result.proxyResponseTime = proxyTest.responseTime;

    if (!proxyTest.working) {
      result.issues.push(`Proxy failed: ${proxyTest.error}`);
    }

    return result;
  }

  // ============================================================
  // PROXY TESTING
  // ============================================================

  /**
   * Test all proxies
   */
  async testAllProxies(): Promise<void> {
    const proxies = this.manager.getAllProxies();
    
    for (const proxy of proxies) {
      const result = await this.manager.testProxy(proxy.id);
      
      if (!result.working && proxy.status === 'active') {
        // Proxy failed test but marked as active
        this.triggerAlert({
          type: 'proxy_failure',
          severity: 'high',
          title: `Proxy Test Failed: ${proxy.id}`,
          message: `Proxy ${proxy.id} failed connectivity test: ${result.error}`,
          proxyId: proxy.id
        });

        // Update proxy status
        this.manager.updateProxy(proxy.id, {
          status: 'failed',
          healthScore: Math.max(0, proxy.healthScore - 20)
        });

        // Auto-failover accounts on this proxy
        if (this.config.enableAutoFailover) {
          const accounts = this.manager.getAccountsByProxy(proxy.id);
          for (const account of accounts) {
            await this.handleAutoFailover(account.id, proxy.id);
          }
        }
      }
    }

    this.status.lastProxyTest = new Date();

    this.eventBus.publish({
      source: 'account-proxy-monitor',
      type: 'proxy-test.completed',
      payload: { tested: proxies.length },
      priority: 'low',
      metadata: {}
    });
  }

  /**
   * Test specific proxy
   */
  async testProxy(proxyId: string): Promise<{ working: boolean; responseTime: number; error?: string }> {
    return this.manager.testProxy(proxyId);
  }

  // ============================================================
  // ALERTS
  // ============================================================

  /**
   * Trigger an alert
   */
  private triggerAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): Alert {
    const alert: Alert = {
      ...alertData,
      id: this.generateId(),
      timestamp: new Date(),
      acknowledged: false,
      resolved: false
    };

    this.alerts.set(alert.id, alert);
    this.status.alertsTriggered++;

    // Store in memory
    const existingAlerts = this.memory.retrieve<Alert[]>('account-proxy/alerts') || [];
    existingAlerts.push(alert);
    this.memory.store('account-proxy/alerts', existingAlerts, {
      tags: ['alert', 'monitoring'],
      source: 'account-proxy-monitor'
    });

    // Send through configured channels
    if (this.config.enableAlerts) {
      for (const channel of this.config.alertChannels) {
        this.sendAlert(alert, channel);
      }
    }

    return alert;
  }

  /**
   * Send alert through specific channel
   */
  private sendAlert(alert: Alert, channel: string): void {
    switch (channel) {
      case 'event':
        this.eventBus.publish({
          source: 'account-proxy-monitor',
          type: `alert.${alert.type}`,
          payload: alert,
          priority: alert.severity === 'critical' ? 'critical' : alert.severity === 'high' ? 'high' : 'medium',
          metadata: {}
        });
        break;

      case 'log':
        const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : 'ℹ️';
        console.log(`${emoji} [AccountProxyMonitor] ${alert.title}: ${alert.message}`);
        break;

      case 'webhook':
        // Webhook implementation would go here
        break;
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(options: { 
    severity?: string; 
    type?: string; 
    acknowledged?: boolean;
    limit?: number;
  } = {}): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (options.severity) {
      alerts = alerts.filter(a => a.severity === options.severity);
    }

    if (options.type) {
      alerts = alerts.filter(a => a.type === options.type);
    }

    if (options.acknowledged !== undefined) {
      alerts = alerts.filter(a => a.acknowledged === options.acknowledged);
    }

    // Sort by timestamp descending
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  /**
   * Get active (unresolved) alerts
   */
  getActiveAlerts(): Alert[] {
    return this.getAlerts({ acknowledged: false }).filter(a => !a.resolved);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): Alert | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.acknowledged = true;
    this.alerts.set(alertId, alert);

    return alert;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): Alert | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.resolved = true;
    this.alerts.set(alertId, alert);

    return alert;
  }

  // ============================================================
  // AUTO-FAILOVER
  // ============================================================

  /**
   * Handle automatic failover
   */
  private async handleAutoFailover(accountId: string, proxyId: string): Promise<void> {
    console.log(`[AccountProxyMonitor] Auto-failover for ${accountId} from ${proxyId}`);

    this.status.failoversTriggered++;

    // Trigger failover through manager
    const result = await this.manager.failoverAccount(accountId, 'auto_failover_proxy_failure');

    if (result.success) {
      this.triggerAlert({
        type: 'failover_triggered',
        severity: 'medium',
        title: `Auto-Failover: ${accountId}`,
        message: `Account ${accountId} automatically moved from ${proxyId} to ${result.newProxyId}`,
        accountId,
        proxyId
      });
    } else {
      this.triggerAlert({
        type: 'failover_triggered',
        severity: 'critical',
        title: `Auto-Failover Failed: ${accountId}`,
        message: `Failed to failover account ${accountId}: ${result.error}`,
        accountId,
        proxyId
      });
    }
  }

  // ============================================================
  // EVENT SUBSCRIPTIONS
  // ============================================================

  /**
   * Setup event subscriptions
   */
  private setupEventSubscriptions(): void {
    // Listen for manual health check requests
    this.eventBus.subscribe({
      eventTypes: ['command.health-check'],
      handler: async (event) => {
        if (event.payload?.target === 'account-proxy') {
          await this.performHealthCheck();
        }
      }
    });

    // Listen for proxy test requests
    this.eventBus.subscribe({
      eventTypes: ['command.test-proxies'],
      handler: async () => {
        await this.testAllProxies();
      }
    });

    // Listen for configuration updates
    this.eventBus.subscribe({
      eventTypes: ['config.updated'],
      handler: (event) => {
        if (event.payload?.component === 'account-proxy-monitor') {
          this.updateConfig(event.payload.config);
        }
      }
    });
  }

  // ============================================================
  // REPORTING
  // ============================================================

  /**
   * Generate monitoring report
   */
  generateReport(): {
    status: MonitoringStatus;
    stats: ReturnType<AccountProxyManager['getStats']>;
    activeAlerts: Alert[];
    recentHealthChecks: HealthCheckResult[];
  } {
    return {
      status: this.getStatus(),
      stats: this.manager.getStats(),
      activeAlerts: this.getActiveAlerts(),
      recentHealthChecks: this.memory.retrieve<HealthCheckResult[]>('account-proxy/health-checks/latest') || []
    };
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function
export function createAccountProxyMonitor(
  manager: AccountProxyManager,
  eventBus: EventBus,
  memory: UnifiedMemoryHub,
  config?: Partial<MonitoringConfig>
): AccountProxyMonitor {
  return new AccountProxyMonitor(manager, eventBus, memory, config);
}
