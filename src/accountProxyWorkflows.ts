/**
 * Account and Proxy Workflows
 * Onboarding and operational workflows integrated with Control Center
 */

import { EventBus } from '../eventBus.js';
import { UnifiedMemoryHub } from '../memoryHub.js';
import { AccountProxyManager, Account, Proxy, Incident } from './accountProxy.js';

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  output?: any;
}

export interface Workflow {
  id: string;
  type: 'onboarding' | 'maintenance' | 'recovery' | 'bulk_operation';
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: WorkflowStep[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export interface OnboardingConfig {
  accountId: string;
  name: string;
  twitterHandle: string;
  adspowerProfileId: string;
  email?: string;
  phone?: string;
  notes?: string;
  initialPhase?: Account['phase'];
}

export interface BulkOnboardingConfig {
  accounts: OnboardingConfig[];
  autoAssignProxies: boolean;
}

/**
 * Account and Proxy Workflows
 * Handles onboarding, maintenance, and recovery operations
 */
export class AccountProxyWorkflows {
  private manager: AccountProxyManager;
  private eventBus: EventBus;
  private memory: UnifiedMemoryHub;
  private workflows: Map<string, Workflow> = new Map();

  constructor(
    manager: AccountProxyManager,
    eventBus: EventBus,
    memory: UnifiedMemoryHub
  ) {
    this.manager = manager;
    this.eventBus = eventBus;
    this.memory = memory;
  }

  // ============================================================
  // ONBOARDING WORKFLOW
  // ============================================================

  /**
   * Start account onboarding workflow
   */
  async onboardAccount(config: OnboardingConfig): Promise<Workflow> {
    const workflow = this.createWorkflow('onboarding', {
      accountConfig: config
    });

    console.log(`[AccountProxyWorkflows] Starting onboarding for ${config.accountId}`);

    try {
      // Step 1: Validate configuration
      await this.executeStep(workflow, 'validate', async () => {
        if (!config.accountId || !config.name || !config.twitterHandle) {
          throw new Error('Missing required fields: accountId, name, twitterHandle');
        }
        if (!config.adspowerProfileId) {
          throw new Error('Missing required field: adspowerProfileId');
        }
        return { valid: true };
      });

      // Step 2: Check proxy availability
      await this.executeStep(workflow, 'check_proxies', async () => {
        const availableProxy = this.manager.findAvailableProxy();
        if (!availableProxy) {
          throw new Error('No available proxies. All proxies at capacity (2 accounts max).');
        }
        return { availableProxyId: availableProxy.id };
      });

      // Step 3: Create account
      await this.executeStep(workflow, 'create_account', async () => {
        const account = this.manager.createAccount({
          id: config.accountId,
          name: config.name,
          twitterHandle: config.twitterHandle,
          email: config.email,
          phone: config.phone,
          adspowerProfileId: config.adspowerProfileId,
          phase: config.initialPhase || 'warmup',
          day: 1,
          status: 'active',
          healthScore: 100,
          followers: 0,
          following: 0,
          posts: 0,
          dmConversionRate: 0,
          lastAction: new Date(),
          actionsToday: 0,
          spamScore: 0,
          dailyActionLimit: this.getActionLimitForPhase(config.initialPhase || 'warmup'),
          notes: config.notes
        });
        return { account };
      });

      // Step 4: Verify proxy assignment
      await this.executeStep(workflow, 'verify_assignment', async () => {
        const account = this.manager.getAccount(config.accountId);
        if (!account || !account.proxyId) {
          throw new Error('Account created but proxy assignment failed');
        }
        return { proxyId: account.proxyId };
      });

      // Step 5: Initial health check
      await this.executeStep(workflow, 'health_check', async () => {
        const proxy = this.manager.getAllProxies().find(p => 
          this.manager.getAccountsByProxy(p.id).some(a => a.id === config.accountId)
        );
        if (proxy) {
          const testResult = await this.manager.testProxy(proxy.id);
          return { proxyTest: testResult };
        }
        return { skipped: true };
      });

      // Step 6: Setup complete
      await this.executeStep(workflow, 'complete', async () => {
        this.eventBus.publish({
          source: 'account-proxy-workflows',
          type: 'account.onboarded',
          payload: {
            accountId: config.accountId,
            workflowId: workflow.id
          },
          priority: 'medium',
          metadata: {}
        });
        return { completed: true };
      });

      // Mark workflow complete
      this.completeWorkflow(workflow);

      return workflow;

    } catch (error) {
      this.failWorkflow(workflow, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Bulk onboard multiple accounts
   */
  async bulkOnboard(config: BulkOnboardingConfig): Promise<Workflow[]> {
    const workflows: Workflow[] = [];
    const errors: string[] = [];

    console.log(`[AccountProxyWorkflows] Starting bulk onboarding for ${config.accounts.length} accounts`);

    for (const accountConfig of config.accounts) {
      try {
        const workflow = await this.onboardAccount(accountConfig);
        workflows.push(workflow);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${accountConfig.accountId}: ${errorMsg}`);
      }
    }

    // Publish bulk completion event
    this.eventBus.publish({
      source: 'account-proxy-workflows',
      type: 'accounts.bulk-onboarded',
      payload: {
        total: config.accounts.length,
        successful: workflows.filter(w => w.status === 'completed').length,
        failed: errors.length,
        errors
      },
      priority: 'medium',
      metadata: {}
    });

    return workflows;
  }

  // ============================================================
  // MAINTENANCE WORKFLOWS
  // ============================================================

  /**
   * Daily maintenance workflow
   */
  async runDailyMaintenance(): Promise<Workflow> {
    const workflow = this.createWorkflow('maintenance', {
      type: 'daily'
    });

    console.log('[AccountProxyWorkflows] Starting daily maintenance');

    try {
      // Step 1: Reset daily action counters
      await this.executeStep(workflow, 'reset_actions', async () => {
        this.manager.resetDailyActions();
        return { accountsReset: this.manager.getAllAccounts().length };
      });

      // Step 2: Run health checks
      await this.executeStep(workflow, 'health_checks', async () => {
        const results = await this.manager.runHealthCheck();
        return {
          checked: results.length,
          healthy: results.filter(r => r.healthScore >= 50).length,
          issues: results.filter(r => r.healthScore < 50).length
        };
      });

      // Step 3: Test all proxies
      await this.executeStep(workflow, 'test_proxies', async () => {
        const proxies = this.manager.getAllProxies();
        const results = [];
        for (const proxy of proxies) {
          const result = await this.manager.testProxy(proxy.id);
          results.push({ proxyId: proxy.id, ...result });
        }
        return {
          tested: results.length,
          working: results.filter(r => r.working).length,
          failed: results.filter(r => !r.working).length
        };
      });

      // Step 4: Check for incidents
      await this.executeStep(workflow, 'check_incidents', async () => {
        const openIncidents = this.manager.getOpenIncidents();
        return { openIncidents: openIncidents.length };
      });

      this.completeWorkflow(workflow);

      this.eventBus.publish({
        source: 'account-proxy-workflows',
        type: 'maintenance.daily.completed',
        payload: { workflowId: workflow.id },
        priority: 'low',
        metadata: {}
      });

      return workflow;

    } catch (error) {
      this.failWorkflow(workflow, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Weekly maintenance workflow
   */
  async runWeeklyMaintenance(): Promise<Workflow> {
    const workflow = this.createWorkflow('maintenance', {
      type: 'weekly'
    });

    console.log('[AccountProxyWorkflows] Starting weekly maintenance');

    try {
      // Step 1: Comprehensive health check
      await this.executeStep(workflow, 'comprehensive_health_check', async () => {
        const results = await this.manager.runHealthCheck();
        return {
          checked: results.length,
          averageHealth: results.reduce((s, r) => s + r.healthScore, 0) / results.length
        };
      });

      // Step 2: Review proxy performance
      await this.executeStep(workflow, 'proxy_review', async () => {
        const proxies = this.manager.getAllProxies();
        const degradedProxies = proxies.filter(p => 
          p.healthScore < 70 || p.successRate < 90
        );
        return {
          total: proxies.length,
          degraded: degradedProxies.length,
          degradedProxyIds: degradedProxies.map(p => p.id)
        };
      });

      // Step 3: Account phase advancement check
      await this.executeStep(workflow, 'phase_advancement', async () => {
        const accounts = this.manager.getAllAccounts();
        const advancementCandidates = accounts.filter(a => {
          // Simple logic: accounts with good health and activity
          return a.healthScore >= 80 && a.actionsToday > a.dailyActionLimit * 0.5;
        });
        return {
          candidates: advancementCandidates.length,
          accounts: advancementCandidates.map(a => a.id)
        };
      });

      // Step 4: Generate report
      await this.executeStep(workflow, 'generate_report', async () => {
        const stats = this.manager.getStats();
        const healthSummary = this.manager.getHealthSummary();
        return { stats, healthSummary };
      });

      this.completeWorkflow(workflow);

      this.eventBus.publish({
        source: 'account-proxy-workflows',
        type: 'maintenance.weekly.completed',
        payload: { workflowId: workflow.id },
        priority: 'low',
        metadata: {}
      });

      return workflow;

    } catch (error) {
      this.failWorkflow(workflow, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // ============================================================
  // RECOVERY WORKFLOWS
  // ============================================================

  /**
   * Recover failed proxy workflow
   */
  async recoverProxy(proxyId: string): Promise<Workflow> {
    const workflow = this.createWorkflow('recovery', {
      proxyId,
      type: 'proxy_recovery'
    });

    console.log(`[AccountProxyWorkflows] Starting proxy recovery for ${proxyId}`);

    try {
      // Step 1: Verify proxy exists and is failed
      await this.executeStep(workflow, 'verify_proxy', async () => {
        const proxy = this.manager.getProxy(proxyId);
        if (!proxy) {
          throw new Error(`Proxy ${proxyId} not found`);
        }
        return { proxyStatus: proxy.status };
      });

      // Step 2: Test proxy connectivity
      await this.executeStep(workflow, 'test_proxy', async () => {
        const result = await this.manager.testProxy(proxyId);
        return result;
      });

      // Step 3: Attempt recovery
      await this.executeStep(workflow, 'recover', async () => {
        const success = await this.manager.recoverProxy(proxyId);
        if (!success) {
          throw new Error('Proxy recovery failed - still not responding');
        }
        return { recovered: true };
      });

      // Step 4: Verify recovery
      await this.executeStep(workflow, 'verify_recovery', async () => {
        const proxy = this.manager.getProxy(proxyId);
        const testResult = await this.manager.testProxy(proxyId);
        return {
          status: proxy?.status,
          working: testResult.working
        };
      });

      this.completeWorkflow(workflow);

      this.eventBus.publish({
        source: 'account-proxy-workflows',
        type: 'proxy.recovered',
        payload: { proxyId, workflowId: workflow.id },
        priority: 'medium',
        metadata: {}
      });

      return workflow;

    } catch (error) {
      this.failWorkflow(workflow, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Emergency failover workflow
   */
  async emergencyFailover(proxyId?: string): Promise<Workflow> {
    const workflow = this.createWorkflow('recovery', {
      proxyId,
      type: 'emergency_failover'
    });

    console.log(`[AccountProxyWorkflows] Starting emergency failover${proxyId ? ` for ${proxyId}` : ' for all failed proxies'}`);

    try {
      // Step 1: Identify affected accounts
      await this.executeStep(workflow, 'identify_affected', async () => {
        let accounts: Account[];
        if (proxyId) {
          accounts = this.manager.getAccountsByProxy(proxyId);
        } else {
          // Get all accounts on failed proxies
          const failedProxies = this.manager.getAllProxies().filter(p => p.status !== 'active');
          accounts = failedProxies.flatMap(p => this.manager.getAccountsByProxy(p.id));
        }
        return { affectedAccounts: accounts.map(a => a.id) };
      });

      // Step 2: Check available proxies
      await this.executeStep(workflow, 'check_capacity', async () => {
        const availableProxies = this.manager.getAllProxies().filter(p => 
          p.status === 'active' && p.assignedAccounts < p.maxAccounts
        );
        const totalCapacity = availableProxies.reduce((sum, p) => 
          sum + (p.maxAccounts - p.assignedAccounts), 0
        );
        return {
          availableProxies: availableProxies.length,
          totalCapacity
        };
      });

      // Step 3: Execute failover
      await this.executeStep(workflow, 'execute_failover', async () => {
        if (proxyId) {
          const results = await this.manager.handleProxyFailure(proxyId, 'emergency_failover');
          return { results };
        } else {
          // Failover all failed proxies
          const failedProxies = this.manager.getAllProxies().filter(p => p.status !== 'active');
          const allResults = [];
          for (const proxy of failedProxies) {
            const results = await this.manager.handleProxyFailure(proxy.id, 'emergency_failover');
            allResults.push(...results);
          }
          return { results: allResults };
        }
      });

      // Step 4: Verify migrations
      await this.executeStep(workflow, 'verify_migrations', async () => {
        const openIncidents = this.manager.getOpenIncidents();
        return { remainingIncidents: openIncidents.length };
      });

      this.completeWorkflow(workflow);

      this.eventBus.publish({
        source: 'account-proxy-workflows',
        type: 'failover.emergency.completed',
        payload: { workflowId: workflow.id },
        priority: 'high',
        metadata: {}
      });

      return workflow;

    } catch (error) {
      this.failWorkflow(workflow, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // ============================================================
  // WORKFLOW MANAGEMENT
  // ============================================================

  /**
   * Get workflow by ID
   */
  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get workflows by type
   */
  getWorkflowsByType(type: Workflow['type']): Workflow[] {
    return this.getAllWorkflows().filter(w => w.type === type);
  }

  /**
   * Get running workflows
   */
  getRunningWorkflows(): Workflow[] {
    return this.getAllWorkflows().filter(w => w.status === 'running');
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private createWorkflow(type: Workflow['type'], metadata: Record<string, any> = {}): Workflow {
    const workflow: Workflow = {
      id: this.generateId(),
      type,
      status: 'running',
      steps: [],
      createdAt: new Date(),
      startedAt: new Date(),
      metadata
    };

    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  private async executeStep<T>(
    workflow: Workflow,
    stepName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const step: WorkflowStep = {
      id: this.generateId(),
      name: stepName,
      status: 'in_progress',
      startedAt: new Date()
    };

    workflow.steps.push(step);

    try {
      const output = await operation();
      
      step.status = 'completed';
      step.completedAt = new Date();
      step.output = output;

      return output;
    } catch (error) {
      step.status = 'failed';
      step.completedAt = new Date();
      step.error = error instanceof Error ? error.message : 'Unknown error';

      throw error;
    }
  }

  private completeWorkflow(workflow: Workflow): void {
    workflow.status = 'completed';
    workflow.completedAt = new Date();

    // Store in memory
    const existingWorkflows = this.memory.retrieve<Workflow[]>('account-proxy/workflows') || [];
    existingWorkflows.push(workflow);
    this.memory.store('account-proxy/workflows', existingWorkflows, {
      tags: ['workflow', 'completed'],
      source: 'account-proxy-workflows'
    });
  }

  private failWorkflow(workflow: Workflow, error: string): void {
    workflow.status = 'failed';
    workflow.completedAt = new Date();

    // Create incident for failed workflow
    this.manager.createIncident({
      type: 'manual_intervention',
      severity: 'high',
      title: `Workflow ${workflow.type} failed`,
      description: error,
      status: 'open'
    });

    // Store in memory
    const existingWorkflows = this.memory.retrieve<Workflow[]>('account-proxy/workflows') || [];
    existingWorkflows.push(workflow);
    this.memory.store('account-proxy/workflows', existingWorkflows, {
      tags: ['workflow', 'failed'],
      source: 'account-proxy-workflows'
    });

    // Publish failure event
    this.eventBus.publish({
      source: 'account-proxy-workflows',
      type: 'workflow.failed',
      payload: { workflowId: workflow.id, error },
      priority: 'high',
      metadata: {}
    });
  }

  private getActionLimitForPhase(phase: Account['phase']): number {
    const limits = {
      warmup: 10,
      soft: 20,
      growth: 50,
      full: 100
    };
    return limits[phase];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function
export function createAccountProxyWorkflows(
  manager: AccountProxyManager,
  eventBus: EventBus,
  memory: UnifiedMemoryHub
): AccountProxyWorkflows {
  return new AccountProxyWorkflows(manager, eventBus, memory);
}
