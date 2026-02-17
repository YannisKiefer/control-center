/**
 * Account-Proxy Mapping System
 * Manages the relationship between accounts and proxies
 * Ensures 2 accounts per proxy limit
 * 
 * INTEGRATED: Moved from /management/accountProxy/ to Control Center
 */

import { DatabaseClient } from './database/client';
import { Account, Proxy } from './database/schema';

export interface AccountConfig {
  id: string;                    // "ella_001"
  name: string;                  // "Ella Sophie Main"
  twitterHandle: string;         // "@ellasophiee"
  email?: string;
  phone?: string;
  adspowerProfileId: string;
  adspowerGroupId?: string;
  notes?: string;
}

export interface MappingResult {
  success: boolean;
  account?: Account;
  proxy?: Proxy;
  error?: string;
}

export class AccountProxyMapping {
  private db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /**
   * Create a new account and assign it to an available proxy
   * Ensures 2 accounts per proxy limit
   */
  async createAccount(config: AccountConfig): Promise<MappingResult> {
    try {
      // 1. Find available proxy (less than 2 accounts)
      const proxy = this.db.findAvailableProxy();
      
      if (!proxy) {
        return {
          success: false,
          error: 'No available proxies. All proxies have 2 accounts assigned.'
        };
      }

      // 2. Validate proxy has capacity
      if (proxy.assignedAccounts >= proxy.maxAccounts) {
        return {
          success: false,
          error: `Proxy ${proxy.id} is at capacity (${proxy.assignedAccounts}/${proxy.maxAccounts})`
        };
      }

      // 3. Create account with proxy assignment
      const account = this.db.createAccount({
        id: config.id,
        name: config.name,
        twitterHandle: config.twitterHandle,
        email: config.email,
        phone: config.phone,
        phase: 'warmup',
        day: 1,
        status: 'active',
        healthScore: 100,
        adspowerProfileId: config.adspowerProfileId,
        adspowerGroupId: config.adspowerGroupId,
        proxyId: proxy.id,
        followers: 0,
        following: 0,
        posts: 0,
        dmConversionRate: 0,
        lastAction: new Date(),
        actionsToday: 0,
        spamScore: 0,
        dailyActionLimit: this.getActionLimitForPhase('warmup'),
        notes: config.notes
      });

      return {
        success: true,
        account,
        proxy: this.db.getProxy(proxy.id)!
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating account'
      };
    }
  }

  /**
   * Get the current mapping of all proxies to their accounts
   */
  getProxyMapping(): Record<string, string[]> {
    const proxies = this.db.getAllProxies();
    const mapping: Record<string, string[]> = {};

    for (const proxy of proxies) {
      const accounts = this.db.getAccountsByProxy(proxy.id);
      mapping[proxy.id] = accounts.map(a => a.id);
    }

    return mapping;
  }

  /**
   * Get detailed mapping with full account and proxy info
   */
  getDetailedMapping(): ProxyAccountMapping[] {
    const proxies = this.db.getAllProxies();
    
    return proxies.map(proxy => {
      const accounts = this.db.getAccountsByProxy(proxy.id);
      return {
        proxy,
        accounts,
        utilization: accounts.length / proxy.maxAccounts,
        isFull: accounts.length >= proxy.maxAccounts
      };
    });
  }

  /**
   * Validate all mappings are correct (2 accounts max per proxy)
   */
  validateMappings(): ValidationResult {
    const proxies = this.db.getAllProxies();
    const violations: string[] = [];
    const summary: ProxyValidation[] = [];

    for (const proxy of proxies) {
      const accounts = this.db.getAccountsByProxy(proxy.id);
      const isValid = accounts.length <= proxy.maxAccounts;
      
      summary.push({
        proxyId: proxy.id,
        accountCount: accounts.length,
        maxAllowed: proxy.maxAccounts,
        isValid,
        accounts: accounts.map(a => a.id)
      });

      if (!isValid) {
        violations.push(
          `Proxy ${proxy.id} has ${accounts.length} accounts (max: ${proxy.maxAccounts})`
        );
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      summary
    };
  }

  /**
   * Rebalance accounts if needed (rarely used with static assignment)
   */
  async rebalanceMappings(): Promise<RebalanceResult> {
    const validation = this.validateMappings();
    const moves: MoveResult[] = [];

    if (validation.isValid) {
      return { success: true, moves, message: 'No rebalancing needed' };
    }

    // Handle violations (proxies with > 2 accounts)
    for (const proxy of validation.summary) {
      if (!proxy.isValid) {
        const excessAccounts = proxy.accountCount - proxy.maxAllowed;
        const accountsToMove = proxy.accounts.slice(-excessAccounts);

        for (const accountId of accountsToMove) {
          const newProxy = this.db.findAvailableProxy();
          
          if (newProxy) {
            this.db.updateAccountProxy(accountId, newProxy.id, 'rebalancing');
            moves.push({
              accountId,
              fromProxy: proxy.proxyId,
              toProxy: newProxy.id,
              success: true
            });
          } else {
            moves.push({
              accountId,
              fromProxy: proxy.proxyId,
              toProxy: null,
              success: false,
              error: 'No available proxies for rebalancing'
            });
          }
        }
      }
    }

    return {
      success: moves.every(m => m.success),
      moves,
      message: `Rebalanced ${moves.filter(m => m.success).length} accounts`
    };
  }

  /**
   * Get accounts that can be assigned to a specific proxy
   */
  getAssignableAccounts(proxyId: string): Account[] {
    const proxy = this.db.getProxy(proxyId);
    if (!proxy) return [];

    const currentAccounts = this.db.getAccountsByProxy(proxyId);
    const availableSlots = proxy.maxAccounts - currentAccounts.length;

    if (availableSlots <= 0) return [];

    // Get unassigned or reassignable accounts
    const allAccounts = this.db.getAllAccounts();
    return allAccounts.filter(a => a.proxyId !== proxyId).slice(0, availableSlots);
  }

  /**
   * Move account to a different proxy
   */
  async moveAccount(accountId: string, targetProxyId: string, reason?: string): Promise<MappingResult> {
    try {
      const account = this.db.getAccount(accountId);
      if (!account) {
        return { success: false, error: `Account ${accountId} not found` };
      }

      const targetProxy = this.db.getProxy(targetProxyId);
      if (!targetProxy) {
        return { success: false, error: `Proxy ${targetProxyId} not found` };
      }

      if (targetProxy.assignedAccounts >= targetProxy.maxAccounts) {
        return {
          success: false,
          error: `Target proxy ${targetProxyId} is at capacity`
        };
      }

      this.db.updateAccountProxy(accountId, targetProxyId, reason || 'manual_move');

      return {
        success: true,
        account: this.db.getAccount(accountId)!,
        proxy: this.db.getProxy(targetProxyId)!
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error moving account'
      };
    }
  }

  /**
   * Get action limit based on account phase
   */
  private getActionLimitForPhase(phase: Account['phase']): number {
    const limits = {
      warmup: 10,      // Day 1-7: Very limited
      soft: 20,        // Day 8-14: Soft limits
      growth: 50,      // Day 15-30: Growing
      full: 100        // Day 30+: Full activity
    };
    return limits[phase];
  }

  /**
   * Advance account to next phase
   */
  advancePhase(accountId: string): Account | null {
    const account = this.db.getAccount(accountId);
    if (!account) return null;

    const phases: Account['phase'][] = ['warmup', 'soft', 'growth', 'full'];
    const currentIndex = phases.indexOf(account.phase);
    
    if (currentIndex < phases.length - 1) {
      const newPhase = phases[currentIndex + 1];
      this.db.updateAccount(accountId, {
        phase: newPhase,
        dailyActionLimit: this.getActionLimitForPhase(newPhase)
      });
      return this.db.getAccount(accountId);
    }

    return account;
  }

  /**
   * Bulk create accounts with automatic proxy distribution
   */
  async bulkCreateAccounts(configs: AccountConfig[]): Promise<BulkCreateResult> {
    const results: MappingResult[] = [];
    const errors: string[] = [];

    for (const config of configs) {
      const result = await this.createAccount(config);
      results.push(result);
      
      if (!result.success) {
        errors.push(`${config.id}: ${result.error}`);
      }
    }

    return {
      total: configs.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      errors
    };
  }
}

// ============================================================
// TYPES
// ============================================================

export interface ProxyAccountMapping {
  proxy: Proxy;
  accounts: Account[];
  utilization: number;
  isFull: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  summary: ProxyValidation[];
}

export interface ProxyValidation {
  proxyId: string;
  accountCount: number;
  maxAllowed: number;
  isValid: boolean;
  accounts: string[];
}

export interface RebalanceResult {
  success: boolean;
  moves: MoveResult[];
  message: string;
}

export interface MoveResult {
  accountId: string;
  fromProxy: string;
  toProxy: string | null;
  success: boolean;
  error?: string;
}

export interface BulkCreateResult {
  total: number;
  successful: number;
  failed: number;
  results: MappingResult[];
  errors: string[];
}
