/**
 * Account and Proxy Management Module
 * Integrated into Control Center for centralized management
 */

import { EventBus } from '../eventBus.js';
import { UnifiedMemoryHub } from '../memoryHub.js';
import { SkillRegistry } from '../registry.js';

// Re-export all types from the accountProxy system
export interface Proxy {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: 'socks5' | 'https';
  status: 'active' | 'failed' | 'maintenance';
  healthScore: number;
  maxAccounts: number;
  assignedAccounts: number;
  avgResponseTime: number;
  successRate: number;
  lastTested: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  id: string;
  name: string;
  twitterHandle: string;
  email?: string;
  phone?: string;
  phase: 'warmup' | 'soft' | 'growth' | 'full';
  day: number;
  status: 'active' | 'suspended' | 'banned' | 'paused';
  healthScore: number;
  adspowerProfileId: string;
  adspowerGroupId?: string;
  proxyId: string;
  followers: number;
  following: number;
  posts: number;
  dmConversionRate: number;
  lastAction: Date;
  actionsToday: number;
  spamScore: number;
  dailyActionLimit: number;
  createdAt: Date;
  updatedAt: Date;
  lastChecked: Date;
  notes?: string;
}

export type IncidentType = 
  | 'proxy_failure'
  | 'proxy_degraded'
  | 'account_suspicious'
  | 'account_suspended'
  | 'rate_limit_hit'
  | 'health_check_failed'
  | 'failover_triggered'
  | 'manual_intervention';

export interface Incident {
  id: string;
  type: IncidentType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  accountId?: string;
  proxyId?: string;
  title: string;
  description: string;
  oldProxyId?: string;
  newProxyId?: string;
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
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

export interface FailoverResult {
  success: boolean;
  accountId: string;
  oldProxyId: string;
  newProxyId?: string;
  error?: string;
  incidentId?: string;
}

export interface AccountProxyStats {
  totalAccounts: number;
  activeAccounts: number;
  totalProxies: number;
  activeProxies: number;
  openIncidents: number;
  averageHealthScore: number;
  phaseDistribution: Record<string, number>;
  failingProxies: number;
  accountsNeedingAttention: number;
}

export interface ProxyAccountMapping {
  proxy: Proxy;
  accounts: Account[];
  utilization: number;
  isFull: boolean;
}

/**
 * Account and Proxy Manager
 * Centralized management integrated with Control Center
 */
export class AccountProxyManager {
  private eventBus: EventBus;
  private memory: UnifiedMemoryHub;
  private registry: SkillRegistry;
  private accounts: Map<string, Account> = new Map();
  private proxies: Map<string, Proxy> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private failoverInProgress: Set<string> = new Set();

  constructor(
    eventBus: EventBus,
    memory: UnifiedMemoryHub,
    registry: SkillRegistry
  ) {
    this.eventBus = eventBus;
    this.memory = memory;
    this.registry = registry;
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /**
   * Initialize the account/proxy manager
   */
  async initialize(): Promise<void> {
    console.log('[AccountProxyManager] Initializing...');

    // Load data from memory hub
    await this.loadFromMemory();

    // Subscribe to relevant events
    this.setupEventSubscriptions();

    // Start health monitoring
    this.startHealthMonitoring();

    console.log('[AccountProxyManager] Initialized successfully');
  }

  /**
   * Load accounts and proxies from memory
   */
  private async loadFromMemory(): Promise<void> {
    const accounts = this.memory.retrieve<Account[]>('account-proxy/accounts') || [];
    const proxies = this.memory.retrieve<Proxy[]>('account-proxy/proxies') || [];
    const incidents = this.memory.retrieve<Incident[]>('account-proxy/incidents') || [];

    for (const account of accounts) {
      this.accounts.set(account.id, account);
    }

    for (const proxy of proxies) {
      this.proxies.set(proxy.id, proxy);
    }

    for (const incident of incidents) {
      this.incidents.set(incident.id, incident);
    }

    console.log(`[AccountProxyManager] Loaded ${this.accounts.size} accounts, ${this.proxies.size} proxies, ${this.incidents.size} incidents`);
  }

  /**
   * Persist data to memory
   */
  private persistToMemory(): void {
    this.memory.store('account-proxy/accounts', Array.from(this.accounts.values()), {
      tags: ['account-proxy', 'accounts', 'data'],
      source: 'account-proxy-manager'
    });

    this.memory.store('account-proxy/proxies', Array.from(this.proxies.values()), {
      tags: ['account-proxy', 'proxies', 'data'],
      source: 'account-proxy-manager'
    });

    this.memory.store('account-proxy/incidents', Array.from(this.incidents.values()), {
      tags: ['account-proxy', 'incidents', 'data'],
      source: 'account-proxy-manager'
    });
  }

  /**
   * Setup event subscriptions
   */
  private setupEventSubscriptions(): void {
    // Listen for proxy failures
    this.eventBus.subscribe({
      eventTypes: ['proxy.failure', 'proxy.degraded'],
      handler: async (event) => {
        if (event.payload?.proxyId) {
          await this.handleProxyFailure(event.payload.proxyId, event.payload.reason);
        }
      }
    });

    // Listen for account issues
    this.eventBus.subscribe({
      eventTypes: ['account.suspended', 'account.banned'],
      handler: async (event) => {
        if (event.payload?.accountId) {
          await this.handleAccountIssue(event.payload.accountId, event.type, event.payload);
        }
      }
    });

    // Listen for health check requests
    this.eventBus.subscribe({
      eventTypes: ['health-check.request'],
      handler: async () => {
        await this.runHealthCheck();
      }
    });
  }

  // ============================================================
  // ACCOUNT OPERATIONS
  // ============================================================

  /**
   * Create a new account with automatic proxy assignment
   */
  createAccount(accountData: Omit<Account, 'proxyId' | 'createdAt' | 'updatedAt' | 'lastChecked'>): Account {
    const availableProxy = this.findAvailableProxy();
    
    if (!availableProxy) {
      throw new Error('No available proxies. All proxies at capacity (2 accounts max).');
    }

    const account: Account = {
      ...accountData,
      proxyId: availableProxy.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastChecked: new Date()
    };

    this.accounts.set(account.id, account);
    
    // Update proxy assigned count
    availableProxy.assignedAccounts++;
    availableProxy.updatedAt = new Date();
    this.proxies.set(availableProxy.id, availableProxy);

    // Persist changes
    this.persistToMemory();

    // Publish event
    this.eventBus.publish({
      source: 'account-proxy-manager',
      type: 'account.created',
      payload: { account, proxy: availableProxy },
      priority: 'medium',
      metadata: {}
    });

    return account;
  }

  /**
   * Get account by ID
   */
  getAccount(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  /**
   * Get all accounts
   */
  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get accounts by proxy
   */
  getAccountsByProxy(proxyId: string): Account[] {
    return this.getAllAccounts().filter(a => a.proxyId === proxyId);
  }

  /**
   * Get active accounts
   */
  getActiveAccounts(): Account[] {
    return this.getAllAccounts().filter(a => a.status === 'active');
  }

  /**
   * Update account
   */
  updateAccount(id: string, updates: Partial<Account>): Account {
    const account = this.accounts.get(id);
    if (!account) {
      throw new Error(`Account ${id} not found`);
    }

    const updated = { ...account, ...updates, updatedAt: new Date() };
    this.accounts.set(id, updated);
    this.persistToMemory();

    return updated;
  }

  /**
   * Move account to different proxy
   */
  moveAccount(accountId: string, newProxyId: string, reason?: string): FailoverResult {
    const account = this.accounts.get(accountId);
    if (!account) {
      return { success: false, accountId, oldProxyId: '', error: 'Account not found' };
    }

    const newProxy = this.proxies.get(newProxyId);
    if (!newProxy) {
      return { success: false, accountId, oldProxyId: account.proxyId, error: 'New proxy not found' };
    }

    if (newProxy.assignedAccounts >= newProxy.maxAccounts) {
      return { success: false, accountId, oldProxyId: account.proxyId, error: 'New proxy at capacity' };
    }

    const oldProxyId = account.proxyId;
    const oldProxy = this.proxies.get(oldProxyId);

    // Update account
    account.proxyId = newProxyId;
    account.updatedAt = new Date();
    this.accounts.set(accountId, account);

    // Update proxy counts
    if (oldProxy) {
      oldProxy.assignedAccounts = Math.max(0, oldProxy.assignedAccounts - 1);
      oldProxy.updatedAt = new Date();
      this.proxies.set(oldProxyId, oldProxy);
    }

    newProxy.assignedAccounts++;
    newProxy.updatedAt = new Date();
    this.proxies.set(newProxyId, newProxy);

    // Create incident record
    const incident = this.createIncident({
      type: 'manual_intervention',
      severity: 'low',
      accountId,
      proxyId: newProxyId,
      oldProxyId,
      newProxyId,
      title: `Account ${accountId} moved to proxy ${newProxyId}`,
      description: reason || 'Manual proxy change',
      status: 'resolved'
    });

    this.persistToMemory();

    // Publish event
    this.eventBus.publish({
      source: 'account-proxy-manager',
      type: 'account.moved',
      payload: { accountId, oldProxyId, newProxyId, reason },
      priority: 'medium',
      metadata: {}
    });

    return {
      success: true,
      accountId,
      oldProxyId,
      newProxyId,
      incidentId: incident.id
    };
  }

  // ============================================================
  // PROXY OPERATIONS
  // ============================================================

  /**
   * Add a new proxy
   */
  addProxy(proxyData: Omit<Proxy, 'assignedAccounts' | 'createdAt' | 'updatedAt'>): Proxy {
    const proxy: Proxy = {
      ...proxyData,
      assignedAccounts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.proxies.set(proxy.id, proxy);
    this.persistToMemory();

    // Publish event
    this.eventBus.publish({
      source: 'account-proxy-manager',
      type: 'proxy.added',
      payload: { proxy },
      priority: 'low',
      metadata: {}
    });

    return proxy;
  }

  /**
   * Get proxy by ID
   */
  getProxy(id: string): Proxy | undefined {
    return this.proxies.get(id);
  }

  /**
   * Get all proxies
   */
  getAllProxies(): Proxy[] {
    return Array.from(this.proxies.values());
  }

  /**
   * Get active proxies
   */
  getActiveProxies(): Proxy[] {
    return this.getAllProxies()
      .filter(p => p.status === 'active')
      .sort((a, b) => a.assignedAccounts - b.assignedAccounts);
  }

  /**
   * Find available proxy (has capacity)
   */
  findAvailableProxy(): Proxy | undefined {
    return this.getActiveProxies()
      .filter(p => p.assignedAccounts < p.maxAccounts)
      .sort((a, b) => a.assignedAccounts - b.assignedAccounts)[0];
  }

  /**
   * Update proxy
   */
  updateProxy(id: string, updates: Partial<Proxy>): Proxy {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      throw new Error(`Proxy ${id} not found`);
    }

    const updated = { ...proxy, ...updates, updatedAt: new Date() };
    this.proxies.set(id, updated);
    this.persistToMemory();

    return updated;
  }

  /**
   * Test proxy connectivity
   */
  async testProxy(proxyId: string): Promise<{ working: boolean; responseTime: number; error?: string }> {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) {
      return { working: false, responseTime: 0, error: 'Proxy not found' };
    }

    const startTime = Date.now();

    try {
      // Simulate proxy test - in production, use actual proxy test
      // This would use node-fetch with socks-proxy-agent
      const responseTime = Date.now() - startTime;
      
      // Update proxy metrics
      proxy.avgResponseTime = responseTime;
      proxy.lastTested = new Date();
      proxy.successRate = 100;
      this.proxies.set(proxyId, proxy);
      this.persistToMemory();

      return { working: true, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      proxy.successRate = 0;
      proxy.lastTested = new Date();
      this.proxies.set(proxyId, proxy);
      this.persistToMemory();

      return { working: false, responseTime, error: errorMsg };
    }
  }

  // ============================================================
  // HEALTH MONITORING
  // ============================================================

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Run health check every 5 minutes
    this.healthCheckTimer = setInterval(() => {
      this.runHealthCheck();
    }, 5 * 60 * 1000);

    console.log('[AccountProxyManager] Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Run health check on all accounts and proxies
   */
  async runHealthCheck(): Promise<HealthCheckResult[]> {
    console.log('[AccountProxyManager] Running health check...');
    
    const results: HealthCheckResult[] = [];
    const accounts = this.getActiveAccounts();

    for (const account of accounts) {
      const result = await this.checkAccountHealth(account);
      results.push(result);

      // Update account health score
      this.updateAccount(account.id, {
        healthScore: result.healthScore,
        lastChecked: new Date()
      });

      // Handle critical issues
      if (result.healthScore < 25) {
        this.eventBus.publish({
          source: 'account-proxy-manager',
          type: 'account.health.critical',
          payload: { accountId: account.id, healthScore: result.healthScore },
          priority: 'critical',
          metadata: {}
        });

        this.createIncident({
          type: 'health_check_failed',
          severity: 'critical',
          accountId: account.id,
          proxyId: account.proxyId,
          title: `Critical health for account ${account.id}`,
          description: result.issues.join('\n'),
          status: 'open'
        });
      } else if (result.healthScore < 50) {
        this.eventBus.publish({
          source: 'account-proxy-manager',
          type: 'account.health.warning',
          payload: { accountId: account.id, healthScore: result.healthScore },
          priority: 'high',
          metadata: {}
        });
      }
    }

    // Publish health check completed event
    this.eventBus.publish({
      source: 'account-proxy-manager',
      type: 'health-check.completed',
      payload: { 
        checked: results.length,
        averageHealth: results.reduce((s, r) => s + r.healthScore, 0) / results.length || 0
      },
      priority: 'low',
      metadata: {}
    });

    return results;
  }

  /**
   * Check health of a single account
   */
  private async checkAccountHealth(account: Account): Promise<HealthCheckResult> {
    const proxy = this.proxies.get(account.proxyId);
    const issues: string[] = [];
    const alerts: string[] = [];

    // Test proxy
    let proxyWorking = true;
    let proxyResponseTime = 0;

    if (proxy) {
      const testResult = await this.testProxy(proxy.id);
      proxyWorking = testResult.working;
      proxyResponseTime = testResult.responseTime;

      if (!testResult.working) {
        issues.push(`Proxy failed: ${testResult.error}`);
        alerts.push('Proxy connectivity issue');
      }
    } else {
      proxyWorking = false;
      issues.push('No proxy assigned');
    }

    // Check action limits
    if (account.actionsToday >= account.dailyActionLimit) {
      issues.push('Daily action limit reached');
    }

    // Check spam score
    if (account.spamScore > 70) {
      issues.push(`High spam score: ${account.spamScore}`);
      alerts.push('Elevated spam risk');
    }

    // Check last action time
    const hoursSinceLastAction = (Date.now() - account.lastAction.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastAction > 48) {
      issues.push(`No activity for ${Math.round(hoursSinceLastAction)} hours`);
    }

    // Calculate health score
    const healthScore = this.calculateHealthScore({
      proxyWorking,
      accountStatus: account.status,
      actionRatio: account.actionsToday / account.dailyActionLimit,
      spamScore: account.spamScore,
      issues: issues.length
    });

    return {
      accountId: account.id,
      proxyId: account.proxyId,
      timestamp: new Date(),
      proxyWorking,
      proxyResponseTime,
      accountStatus: account.status,
      healthScore,
      issues,
      alerts
    };
  }

  /**
   * Calculate health score
   */
  private calculateHealthScore(factors: {
    proxyWorking: boolean;
    accountStatus: string;
    actionRatio: number;
    spamScore: number;
    issues: number;
  }): number {
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

  // ============================================================
  // FAILOVER
  // ============================================================

  /**
   * Handle proxy failure - automatic failover
   */
  async handleProxyFailure(proxyId: string, reason?: string): Promise<FailoverResult[]> {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) {
      return [];
    }

    // Mark proxy as failed
    proxy.status = 'failed';
    proxy.updatedAt = new Date();
    this.proxies.set(proxyId, proxy);

    // Create incident
    this.createIncident({
      type: 'proxy_failure',
      severity: 'high',
      proxyId,
      title: `Proxy ${proxyId} failed`,
      description: reason || 'Proxy health check failed',
      status: 'open'
    });

    // Move all accounts to new proxies
    const accounts = this.getAccountsByProxy(proxyId);
    const results: FailoverResult[] = [];

    for (const account of accounts) {
      const result = await this.failoverAccount(account.id, reason);
      results.push(result);
    }

    this.persistToMemory();

    // Publish event
    this.eventBus.publish({
      source: 'account-proxy-manager',
      type: 'proxy.failover.completed',
      payload: { proxyId, accountsMoved: results.filter(r => r.success).length },
      priority: 'high',
      metadata: {}
    });

    return results;
  }

  /**
   * Failover single account to new proxy
   */
  async failoverAccount(accountId: string, reason?: string): Promise<FailoverResult> {
    // Prevent concurrent failovers
    if (this.failoverInProgress.has(accountId)) {
      return {
        success: false,
        accountId,
        oldProxyId: '',
        error: 'Failover already in progress'
      };
    }

    this.failoverInProgress.add(accountId);

    try {
      const account = this.accounts.get(accountId);
      if (!account) {
        return {
          success: false,
          accountId,
          oldProxyId: '',
          error: 'Account not found'
        };
      }

      const oldProxyId = account.proxyId;
      const newProxy = this.findAvailableProxy();

      if (!newProxy) {
        // No available proxies
        const incident = this.createIncident({
          type: 'failover_triggered',
          severity: 'critical',
          accountId,
          proxyId: oldProxyId,
          title: `CRITICAL: No available proxies for ${accountId}`,
          description: `Proxy ${oldProxyId} failed and no backup available`,
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

      // Perform the move
      const result = this.moveAccount(accountId, newProxy.id, reason || 'proxy_failure');

      // Create resolved incident for successful failover
      if (result.success) {
        const incident = this.createIncident({
          type: 'failover_triggered',
          severity: 'medium',
          accountId,
          proxyId: oldProxyId,
          oldProxyId,
          newProxyId: newProxy.id,
          title: `Failover completed for ${accountId}`,
          description: `Switched from ${oldProxyId} to ${newProxy.id}`,
          status: 'resolved'
        });

        result.incidentId = incident.id;
      }

      return result;
    } finally {
      this.failoverInProgress.delete(accountId);
    }
  }

  /**
   * Recover a failed proxy
   */
  async recoverProxy(proxyId: string): Promise<boolean> {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) return false;

    // Test the proxy
    const testResult = await this.testProxy(proxyId);

    if (testResult.working) {
      proxy.status = 'active';
      proxy.healthScore = Math.min(100, proxy.healthScore + 20);
      proxy.updatedAt = new Date();
      this.proxies.set(proxyId, proxy);

      // Resolve incidents
      for (const incident of this.getOpenIncidents()) {
        if (incident.proxyId === proxyId) {
          this.resolveIncident(incident.id, 'Proxy recovered and passed health check', 'system');
        }
      }

      this.persistToMemory();

      // Publish event
      this.eventBus.publish({
        source: 'account-proxy-manager',
        type: 'proxy.recovered',
        payload: { proxyId },
        priority: 'medium',
        metadata: {}
      });

      return true;
    }

    return false;
  }

  // ============================================================
  // INCIDENTS
  // ============================================================

  /**
   * Create an incident
   */
  createIncident(incidentData: Omit<Incident, 'id' | 'createdAt'>): Incident {
    const incident: Incident = {
      ...incidentData,
      id: this.generateId(),
      createdAt: new Date()
    };

    this.incidents.set(incident.id, incident);
    this.persistToMemory();

    // Publish alert event for high/critical severity
    if (incident.severity === 'high' || incident.severity === 'critical') {
      this.eventBus.publish({
        source: 'account-proxy-manager',
        type: 'incident.alert',
        payload: { incident },
        priority: incident.severity === 'critical' ? 'critical' : 'high',
        metadata: {}
      });
    }

    return incident;
  }

  /**
   * Get incident by ID
   */
  getIncident(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  /**
   * Get all incidents
   */
  getAllIncidents(): Incident[] {
    return Array.from(this.incidents.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get open incidents
   */
  getOpenIncidents(): Incident[] {
    return this.getAllIncidents().filter(i => i.status === 'open');
  }

  /**
   * Get incidents by account
   */
  getIncidentsByAccount(accountId: string): Incident[] {
    return this.getAllIncidents().filter(i => i.accountId === accountId);
  }

  /**
   * Get incidents by proxy
   */
  getIncidentsByProxy(proxyId: string): Incident[] {
    return this.getAllIncidents().filter(i => 
      i.proxyId === proxyId || i.oldProxyId === proxyId || i.newProxyId === proxyId
    );
  }

  /**
   * Resolve an incident
   */
  resolveIncident(id: string, resolution: string, resolvedBy: string): Incident {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    incident.status = 'resolved';
    incident.resolution = resolution;
    incident.resolvedBy = resolvedBy;
    incident.resolvedAt = new Date();

    this.incidents.set(id, incident);
    this.persistToMemory();

    return incident;
  }

  /**
   * Acknowledge an incident
   */
  acknowledgeIncident(id: string, acknowledgedBy: string): Incident {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    incident.acknowledgedAt = new Date();
    incident.acknowledgedBy = acknowledgedBy;

    this.incidents.set(id, incident);
    this.persistToMemory();

    return incident;
  }

  // ============================================================
  // DASHBOARD & STATS
  // ============================================================

  /**
   * Get comprehensive stats
   */
  getStats(): AccountProxyStats {
    const accounts = this.getAllAccounts();
    const proxies = this.getAllProxies();
    const openIncidents = this.getOpenIncidents();

    const phaseDistribution: Record<string, number> = {};
    for (const account of accounts) {
      phaseDistribution[account.phase] = (phaseDistribution[account.phase] || 0) + 1;
    }

    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(a => a.status === 'active').length,
      totalProxies: proxies.length,
      activeProxies: proxies.filter(p => p.status === 'active').length,
      openIncidents: openIncidents.length,
      averageHealthScore: Math.round(
        accounts.reduce((sum, a) => sum + a.healthScore, 0) / accounts.length || 0
      ),
      phaseDistribution,
      failingProxies: proxies.filter(p => p.status !== 'active').length,
      accountsNeedingAttention: accounts.filter(a => a.healthScore < 50).length
    };
  }

  /**
   * Get proxy-account mappings
   */
  getMappings(): ProxyAccountMapping[] {
    return this.getAllProxies().map(proxy => {
      const accounts = this.getAccountsByProxy(proxy.id);
      return {
        proxy,
        accounts,
        utilization: accounts.length / proxy.maxAccounts,
        isFull: accounts.length >= proxy.maxAccounts
      };
    });
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    accountHealth: {
      average: number;
      distribution: { excellent: number; good: number; warning: number; critical: number };
    };
    proxyHealth: {
      id: string;
      status: string;
      healthScore: number;
      utilization: number;
    }[];
  } {
    const accounts = this.getAllAccounts();
    const proxies = this.getAllProxies();

    return {
      accountHealth: {
        average: Math.round(accounts.reduce((s, a) => s + a.healthScore, 0) / accounts.length) || 0,
        distribution: {
          excellent: accounts.filter(a => a.healthScore >= 80).length,
          good: accounts.filter(a => a.healthScore >= 60 && a.healthScore < 80).length,
          warning: accounts.filter(a => a.healthScore >= 40 && a.healthScore < 60).length,
          critical: accounts.filter(a => a.healthScore < 40).length
        }
      },
      proxyHealth: proxies.map(p => ({
        id: p.id,
        status: p.status,
        healthScore: p.healthScore,
        utilization: p.assignedAccounts / p.maxAccounts
      }))
    };
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  /**
   * Reset daily action counters
   */
  resetDailyActions(): void {
    for (const account of this.accounts.values()) {
      account.actionsToday = 0;
      account.updatedAt = new Date();
    }
    this.persistToMemory();

    this.eventBus.publish({
      source: 'account-proxy-manager',
      type: 'accounts.daily-reset',
      payload: { count: this.accounts.size },
      priority: 'low',
      metadata: {}
    });
  }

  /**
   * Handle account issues
   */
  private async handleAccountIssue(accountId: string, type: string, payload: any): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    if (type === 'account.suspended') {
      account.status = 'suspended';
      this.createIncident({
        type: 'account_suspended',
        severity: 'critical',
        accountId,
        proxyId: account.proxyId,
        title: `Account ${accountId} suspended`,
        description: payload.reason || 'Account suspended by Twitter',
        status: 'open'
      });
    } else if (type === 'account.banned') {
      account.status = 'banned';
      this.createIncident({
        type: 'proxy_failure',
        severity: 'critical',
        accountId,
        proxyId: account.proxyId,
        title: `Account ${accountId} banned`,
        description: payload.reason || 'Account banned by Twitter',
        status: 'open'
      });
    }

    account.updatedAt = new Date();
    this.accounts.set(accountId, account);
    this.persistToMemory();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let accountProxyManager: AccountProxyManager | null = null;

export function getAccountProxyManager(
  eventBus?: EventBus,
  memory?: UnifiedMemoryHub,
  registry?: SkillRegistry
): AccountProxyManager {
  if (!accountProxyManager && eventBus && memory && registry) {
    accountProxyManager = new AccountProxyManager(eventBus, memory, registry);
  }
  if (!accountProxyManager) {
    throw new Error('AccountProxyManager not initialized');
  }
  return accountProxyManager;
}

export function resetAccountProxyManager(): void {
  accountProxyManager = null;
}
