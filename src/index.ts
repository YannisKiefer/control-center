/**
 * Control Center - Central Command Hub
 * Main entry point for the Control Center system
 * 
 * INTEGRATED: Account + Proxy Management now included
 */

export { SkillRegistry, skillRegistry } from './registry.js';
export { EventBus, eventBus } from './eventBus.js';
export { UnifiedMemoryHub, getUnifiedMemoryHub, getMemoryHub } from './memoryHub.js';
export { DocsEngine, docsEngine } from './docsEngine.js';
export { ControlCenterClient, createClient } from './client.js';
export * from './types.js';
export * from './workflows/index.js';

// Re-export memory types
export type {
  AgentMemory,
  DailyMemory,
  DailyEntry,
  CustomerAvatar,
  AccountMemory,
  SystemMemory,
  UnifiedMemory,
  AgentContext,
  Belief,
  Failure,
  ActionEntry,
  Learning,
} from './memoryHub.js';

// ============================================================
// ACCOUNT + PROXY MANAGEMENT (Integrated)
// ============================================================

export {
  // Database
  DatabaseClient,
  DashboardStats,
  Account,
  Proxy,
  Mapping,
  Incident,
  IncidentType,
  HealthCheckLog,
  fullSchemaSQL,
  defaultProxiesSQL,
  
  // Core Systems
  AccountProxyMapping,
  AccountConfig,
  MappingResult,
  HealthMonitor,
  HealthCheckConfig,
  HealthCheckResult,
  HealthSummary,
  ProxyFailover,
  FailoverConfig,
  FailoverResult,
  FailoverStatus,
  
  // Integrations
  MarsProxiesClient,
  MarsProxyConfig,
  
  // Dashboard
  UnifiedDashboard,
  UnifiedDashboardConfig
} from './accountProxy/index.js';

// ============================================================
// CONTROL CENTER CLASS
// ============================================================

import { SkillRegistry, skillRegistry } from './registry.js';
import { EventBus, eventBus } from './eventBus.js';
import { UnifiedMemoryHub, getUnifiedMemoryHub } from './memoryHub.js';
import { DocsEngine, docsEngine } from './docsEngine.js';
import { SkillStatus, HealthCheck } from './types.js';

// Account + Proxy imports
import {
  DatabaseClient,
  AccountProxyMapping,
  HealthMonitor,
  ProxyFailover,
  UnifiedDashboard
} from './accountProxy/index.js';

export interface ControlCenterOptions {
  healthCheckIntervalMs?: number;
  reportIntervalMs?: number;
  autoRestartFailed?: boolean;
  dbPath?: string;
}

export class ControlCenter {
  registry: SkillRegistry;
  eventBus: EventBus;
  memory: UnifiedMemoryHub;
  docs: DocsEngine;
  
  // Account + Proxy Management (NEW)
  db: DatabaseClient;
  accounts: AccountProxyMapping;
  health: HealthMonitor;
  failover: ProxyFailover;
  dashboard: UnifiedDashboard;
  
  private options: Required<ControlCenterOptions>;
  private healthCheckTimer?: NodeJS.Timeout;
  private reportTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(options: ControlCenterOptions = {}) {
    this.registry = skillRegistry;
    this.eventBus = eventBus;
    this.memory = getUnifiedMemoryHub();
    this.docs = docsEngine;

    this.options = {
      healthCheckIntervalMs: options.healthCheckIntervalMs || 60000,
      reportIntervalMs: options.reportIntervalMs || 300000,
      autoRestartFailed: options.autoRestartFailed ?? true,
      dbPath: options.dbPath || './data/control_center.db'
    };

    // Initialize Account + Proxy systems (NEW)
    this.db = new DatabaseClient(this.options.dbPath);
    this.accounts = new AccountProxyMapping(this.db);
    this.health = new HealthMonitor(this.db);
    this.failover = new ProxyFailover(this.db);
    this.dashboard = new UnifiedDashboard(this.db, this.registry);
  }

  /**
   * Start the Control Center
   */
  start(): void {
    if (this.isRunning) return;

    console.log('[ControlCenter] Starting...');
    this.isRunning = true;

    // Start health check loop
    this.healthCheckTimer = setInterval(
      () => this.runHealthChecks(),
      this.options.healthCheckIntervalMs
    );

    // Start report generation loop
    this.reportTimer = setInterval(
      () => this.generateReport(),
      this.options.reportIntervalMs
    );

    // Initial health check
    this.runHealthChecks();

    console.log('[ControlCenter] Started successfully');
  }

  /**
   * Stop the Control Center
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('[ControlCenter] Stopping...');
    this.isRunning = false;

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = undefined;
    }

    // Close database connection
    this.db.close();

    console.log('[ControlCenter] Stopped');
  }

  /**
   * Get system status
   */
  getStatus(): {
    running: boolean;
    skills: ReturnType<SkillRegistry['getStats']>;
    memory: ReturnType<UnifiedMemoryHub['getStats']>;
    events: { subscriptions: number; history: number };
    actions: ReturnType<DocsEngine['getActionStats']>;
    accounts: {
      total: number;
      active: number;
      averageHealth: number;
    };
    proxies: {
      total: number;
      active: number;
      failing: number;
    };
  } {
    const accountStats = this.db.getDashboardStats();
    
    return {
      running: this.isRunning,
      skills: this.registry.getStats(),
      memory: this.memory.getStats(),
      events: {
        subscriptions: this.eventBus.getSubscriptionCount(),
        history: this.eventBus.getHistory().length
      },
      actions: this.docs.getActionStats(),
      accounts: {
        total: accountStats.totalAccounts,
        active: accountStats.activeAccounts,
        averageHealth: accountStats.averageHealthScore
      },
      proxies: {
        total: accountStats.totalProxies,
        active: accountStats.activeProxies,
        failing: accountStats.totalProxies - accountStats.activeProxies
      }
    };
  }

  /**
   * Generate and store status report
   */
  generateReport(): void {
    const report = this.docs.generateDailyReport();
    const key = `reports/daily/${new Date().toISOString().split('T')[0]}`;
    
    this.memory.store(key, report, {
      tags: ['report', 'daily', 'auto-generated'],
      source: 'control-center'
    });

    // Publish report event
    this.eventBus.publish({
      type: 'control-center.report.generated',
      source: 'control-center',
      payload: { reportKey: key, stats: report.skills }
    });

    console.log('[ControlCenter] Daily report generated:', key);
  }

  /**
   * Run health checks on all systems
   * INTEGRATED: Now includes Account + Proxy checks
   */
  private async runHealthChecks(): Promise<void> {
    const now = new Date();

    // 1. Check Skills
    const skills = this.registry.getAll();
    for (const skill of skills) {
      const lastHeartbeat = now.getTime() - skill.lastHeartbeat.getTime();
      const isResponsive = lastHeartbeat < 120000; // 2 minutes

      const check: HealthCheck = {
        skillId: skill.id,
        status: isResponsive ? skill.status : SkillStatus.OFFLINE,
        checkedAt: now,
        responseTime: lastHeartbeat,
        message: isResponsive ? undefined : 'No heartbeat received'
      };

      this.registry.recordHealthCheck(check);
    }

    // Auto-restart failed skills if enabled
    if (this.options.autoRestartFailed) {
      this.registry.restartFailed();
    }

    // 2. Check Accounts + Proxies (NEW)
    try {
      await this.health.runDailyHealthCheck();
      await this.health.checkAllProxies();
      
      // Check mappings
      const mappingValidation = this.accounts.validateMappings();
      if (!mappingValidation.isValid) {
        console.warn('[ControlCenter] Mapping violations:', mappingValidation.violations);
        
        // Publish mapping violation event
        this.eventBus.publish({
          type: 'control-center.mapping.violation',
          source: 'control-center',
          payload: { violations: mappingValidation.violations }
        });
      }
    } catch (error) {
      console.error('[ControlCenter] Account/Proxy health check failed:', error);
    }

    // Publish health check event
    this.eventBus.publish({
      type: 'control-center.health-check.completed',
      source: 'control-center',
      payload: { 
        checked: skills.length, 
        timestamp: now,
        accounts: this.db.getDashboardStats().totalAccounts,
        proxies: this.db.getDashboardStats().totalProxies
      }
    });
  }

  /**
   * Get unified dashboard HTML
   */
  getDashboardHTML(): string {
    return this.dashboard.generateHTML();
  }

  /**
   * Get unified dashboard API response
   */
  getDashboardAPI(): any {
    return this.dashboard.generateAPIResponse();
  }
}

// Singleton instance
export const controlCenter = new ControlCenter();
