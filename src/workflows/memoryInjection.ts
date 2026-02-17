/**
 * Memory Injection System
 * 
 * Handles automatic injection of memory context into agents on startup.
 * Ensures no context loss between sessions.
 */

import { getUnifiedMemoryHub, AgentContext, UnifiedMemory } from '../memoryHub';

export interface InjectionConfig {
  agentId: string;
  includeYesterday: boolean;
  includeLastWeek: boolean;
  includeAvatar: boolean;
  includeBeliefs: boolean;
  includeFailures: boolean;
  maxRecentActions: number;
}

const DEFAULT_CONFIG: InjectionConfig = {
  agentId: 'default-agent',
  includeYesterday: true,
  includeLastWeek: true,
  includeAvatar: true,
  includeBeliefs: true,
  includeFailures: true,
  maxRecentActions: 50,
};

/**
 * Inject memory context into an agent
 * Call this on every agent start
 */
export async function injectMemoryContext(
  agent: any,
  config: Partial<InjectionConfig> = {}
): Promise<{
  success: boolean;
  context: AgentContext;
  injected: string[];
  errors: string[];
}> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const errors: string[] = [];
  const injected: string[] = [];

  console.log(`[MemoryInjection] Injecting context for agent: ${fullConfig.agentId}`);

  try {
    const hub = getUnifiedMemoryHub();
    const context = await hub.getAgentContext(fullConfig.agentId);

    // Inject into agent.context
    if (!agent.context) {
      agent.context = {};
    }

    // Inject yesterday's memory
    if (fullConfig.includeYesterday) {
      agent.context.yesterday = context.yesterday;
      if (context.yesterday) {
        injected.push(`yesterday: ${context.yesterday.actions.length} actions`);
        console.log(`[MemoryInjection] Injected yesterday: ${context.yesterday.actions.length} actions`);
      } else {
        injected.push('yesterday: no data');
        console.log('[MemoryInjection] No yesterday data available');
      }
    }

    // Inject last week's memory
    if (fullConfig.includeLastWeek) {
      agent.context.lastWeek = context.lastWeek;
      injected.push(`lastWeek: ${context.lastWeek.length} days`);
      console.log(`[MemoryInjection] Injected last week: ${context.lastWeek.length} days`);
    }

    // Inject customer avatar
    if (fullConfig.includeAvatar) {
      agent.context.avatar = context.avatar;
      injected.push(`avatar: ${context.avatar.modelProfile.name}`);
      console.log(`[MemoryInjection] Injected avatar: ${context.avatar.modelProfile.name}`);
    }

    // Inject beliefs
    if (fullConfig.includeBeliefs) {
      agent.context.beliefs = context.beliefs;
      injected.push(`beliefs: ${context.beliefs.length} items`);
      console.log(`[MemoryInjection] Injected beliefs: ${context.beliefs.length} items`);
    }

    // Inject failures
    if (fullConfig.includeFailures) {
      agent.context.failures = context.failures;
      injected.push(`failures: ${context.failures.length} items`);
      console.log(`[MemoryInjection] Injected failures: ${context.failures.length} items`);
    }

    // Inject recent actions
    agent.context.recentActions = context.recentActions.slice(0, fullConfig.maxRecentActions);
    injected.push(`recentActions: ${agent.context.recentActions.length} items`);
    console.log(`[MemoryInjection] Injected recent actions: ${agent.context.recentActions.length} items`);

    // Set memory-aware flag
    agent.context.memoryAware = true;
    agent.context.memoryInjectedAt = new Date().toISOString();

    console.log('[MemoryInjection] ✅ Context injection complete');

    return {
      success: true,
      context,
      injected,
      errors,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[MemoryInjection] ❌ Error: ${errorMsg}`);
    errors.push(errorMsg);

    // Return partial context
    return {
      success: false,
      context: {
        yesterday: null,
        lastWeek: [],
        avatar: await getUnifiedMemoryHub().loadCustomerAvatar(),
        beliefs: [],
        failures: [],
        recentActions: [],
      },
      injected,
      errors,
    };
  }
}

/**
 * Check if agent has memory context
 */
export function hasMemoryContext(agent: any): boolean {
  return agent?.context?.memoryAware === true;
}

/**
 * Get memory status for an agent
 */
export async function getMemoryStatus(
  agentId: string
): Promise<{
  hasContext: boolean;
  lastInjected?: string;
  memoryAge?: number; // minutes
  available: {
    yesterday: boolean;
    lastWeek: boolean;
    avatar: boolean;
    beliefs: boolean;
    failures: boolean;
  };
}> {
  const hub = getUnifiedMemoryHub();
  const memory = await hub.loadUnified(agentId);

  return {
    hasContext: true,
    lastInjected: memory.loadedAt.toISOString(),
    memoryAge: Math.floor((Date.now() - memory.loadedAt.getTime()) / 60000),
    available: {
      yesterday: memory.daily.yesterday !== null,
      lastWeek: memory.daily.lastWeek.length > 0,
      avatar: memory.avatar !== null,
      beliefs: memory.context.beliefs.length > 0,
      failures: memory.context.failures.length > 0,
    },
  };
}

/**
 * Refresh memory context (call periodically during long sessions)
 */
export async function refreshMemoryContext(
  agent: any,
  config: Partial<InjectionConfig> = {}
): Promise<{
  success: boolean;
  refreshed: string[];
}> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const refreshed: string[] = [];

  console.log(`[MemoryInjection] Refreshing context for agent: ${fullConfig.agentId}`);

  try {
    const hub = getUnifiedMemoryHub();
    const context = await hub.getAgentContext(fullConfig.agentId);

    // Only refresh data that might have changed
    if (fullConfig.includeBeliefs) {
      const newBeliefs = context.beliefs.filter(b => 
        !agent.context?.beliefs?.some((ob: any) => ob.id === b.id)
      );
      if (newBeliefs.length > 0) {
        agent.context.beliefs = context.beliefs;
        refreshed.push(`beliefs: +${newBeliefs.length} new`);
      }
    }

    if (fullConfig.includeFailures) {
      const newFailures = context.failures.filter(f => 
        !agent.context?.failures?.some((of: any) => of.id === f.id)
      );
      if (newFailures.length > 0) {
        agent.context.failures = context.failures;
        refreshed.push(`failures: +${newFailures.length} new`);
      }
    }

    // Refresh recent actions
    agent.context.recentActions = context.recentActions.slice(0, fullConfig.maxRecentActions);
    refreshed.push('recentActions: refreshed');

    agent.context.memoryRefreshedAt = new Date().toISOString();

    console.log(`[MemoryInjection] ✅ Refreshed: ${refreshed.join(', ')}`);

    return { success: true, refreshed };

  } catch (error) {
    console.error('[MemoryInjection] ❌ Refresh failed:', error);
    return { success: false, refreshed };
  }
}

/**
 * Create a memory-aware wrapper for skill functions
 */
export function withMemoryCheck<T extends (...args: any[]) => any>(
  skillName: string,
  actionType: string,
  fn: T,
  minIntervalMinutes: number = 120
): T {
  return (async (...args: any[]) => {
    const hub = getUnifiedMemoryHub();
    
    // Check if we should proceed
    const check = await hub.shouldTakeAction(actionType, undefined, minIntervalMinutes);
    
    if (!check.allowed) {
      console.log(`[MemoryCheck] ${skillName}.${actionType} blocked: ${check.reason}`);
      throw new Error(`Action blocked: ${check.reason}`);
    }

    // Record the action start
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      
      // Record successful action
      hub.recordAction({
        timestamp: new Date(),
        skill: skillName,
        action: actionType,
        input: args,
        output: result,
        success: true,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      // Record failed action
      hub.recordAction({
        timestamp: new Date(),
        skill: skillName,
        action: actionType,
        input: args,
        output: { error: error instanceof Error ? error.message : String(error) },
        success: false,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }) as T;
}

/**
 * Initialize memory system for a new agent
 */
export async function initializeAgentMemory(
  agentId: string,
  options: {
    createDirectories?: boolean;
    loadExisting?: boolean;
  } = {}
): Promise<{
  success: boolean;
  initialized: string[];
}> {
  const { createDirectories = true, loadExisting = true } = options;
  const initialized: string[] = [];

  console.log(`[MemoryInjection] Initializing memory for agent: ${agentId}`);

  try {
    const hub = getUnifiedMemoryHub();

    if (createDirectories) {
      // Directories are created automatically by the hub
      initialized.push('directory structure');
    }

    if (loadExisting) {
      // Load unified memory to ensure everything works
      await hub.loadUnified(agentId);
      initialized.push('existing memory');
    }

    // Ensure customer avatar exists
    const avatar = await hub.loadCustomerAvatar();
    if (avatar) {
      initialized.push('customer avatar');
    }

    console.log(`[MemoryInjection] ✅ Initialized: ${initialized.join(', ')}`);

    return { success: true, initialized };

  } catch (error) {
    console.error('[MemoryInjection] ❌ Initialization failed:', error);
    return { success: false, initialized };
  }
}

/**
 * CLI entry point for testing
 */
if (require.main === module) {
  const agentId = process.argv[2] || 'test-agent';
  
  // Create a mock agent
  const mockAgent: any = { id: agentId, context: {} };
  
  injectMemoryContext(mockAgent, { agentId })
    .then(result => {
      if (result.success) {
        console.log('✅ Memory injection test successful');
        console.log('Injected:', result.injected);
        console.log('Agent context keys:', Object.keys(mockAgent.context));
        process.exit(0);
      } else {
        console.error('❌ Memory injection test failed:', result.errors);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}
