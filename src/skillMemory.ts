/**
 * Skill Memory Integration
 * 
 * Helper functions for skills to integrate with the Unified Memory System
 */

import { 
  getUnifiedMemoryHub, 
  ActionEntry,
  CustomerAvatar 
} from './memoryHub.js';

export interface SkillMemoryConfig {
  skillName: string;
  checkInterval: number; // minutes
  trackActions: boolean;
  useAvatar: boolean;
}

const DEFAULT_SKILL_CONFIG: SkillMemoryConfig = {
  skillName: 'unknown-skill',
  checkInterval: 120, // 2 hours default
  trackActions: true,
  useAvatar: true,
};

/**
 * Initialize memory for a skill
 * Call this at skill startup
 */
export async function initializeSkillMemory(
  skillName: string,
  options: Partial<SkillMemoryConfig> = {}
): Promise<{
  success: boolean;
  avatar?: CustomerAvatar;
  lastActions: ActionEntry[];
}> {
  const config = { ...DEFAULT_SKILL_CONFIG, ...options, skillName };
  const hub = getUnifiedMemoryHub();

  console.log(`[SkillMemory:${skillName}] Initializing...`);

  try {
    // Load customer avatar if needed
    let avatar: CustomerAvatar | undefined;
    if (config.useAvatar) {
      avatar = await hub.loadCustomerAvatar();
      console.log(`[SkillMemory:${skillName}] Loaded avatar: ${avatar.modelProfile.name}`);
    }

    // Get recent actions for this skill
    const lastActions = hub.retrieveBySource(skillName, 10)
      .map((e: any) => ({
        id: e.id,
        timestamp: e.timestamp,
        skill: e.source,
        action: e.key,
        input: e.data?.input,
        output: e.data?.output,
        success: e.data?.success ?? true,
        duration: e.data?.duration,
        accountId: e.data?.accountId,
      }));

    console.log(`[SkillMemory:${skillName}] Found ${lastActions.length} recent actions`);

    return {
      success: true,
      avatar,
      lastActions,
    };

  } catch (error) {
    console.error(`[SkillMemory:${skillName}] Initialization failed:`, error);
    return {
      success: false,
      lastActions: [],
    };
  }
}

/**
 * Check if an action should be performed (rate limiting)
 */
export async function shouldPerformAction(
  skillName: string,
  actionType: string,
  accountId?: string,
  minIntervalMinutes?: number
): Promise<{
  allowed: boolean;
  reason: string;
  lastAction?: ActionEntry;
  waitMinutes?: number;
}> {
  const hub = getUnifiedMemoryHub();
  const interval = minIntervalMinutes ?? DEFAULT_SKILL_CONFIG.checkInterval;

  const check = await hub.shouldTakeAction(actionType, accountId, interval);

  if (!check.allowed && check.lastAction) {
    const waitMinutes = Math.ceil(
      (interval * 60000 - (Date.now() - check.lastAction.timestamp.getTime())) / 60000
    );
    return {
      ...check,
      waitMinutes: Math.max(0, waitMinutes),
    };
  }

  return check;
}

/**
 * Record an action in memory
 */
export function recordSkillAction(
  skillName: string,
  action: Omit<ActionEntry, 'id' | 'timestamp'>
): ActionEntry {
  const hub = getUnifiedMemoryHub();

  const entry = hub.recordAction({
    ...action,
    timestamp: new Date(),
    skill: skillName,
  });

  return entry;
}

/**
 * Get the last time a specific action was performed
 */
export function getLastActionTime(
  skillName: string,
  actionType: string,
  accountId?: string
): Date | null {
  const hub = getUnifiedMemoryHub();
  const lastAction = hub.getLastAction(actionType, accountId);
  return lastAction?.timestamp ?? null;
}

/**
 * Check if enough time has passed since last action
 */
export function hasTimePassed(
  lastTime: Date | null,
  intervalMinutes: number
): boolean {
  if (!lastTime) return true;
  return Date.now() - lastTime.getTime() >= intervalMinutes * 60000;
}

/**
 * Get customer avatar for content generation
 */
export async function getAvatarForSkill(): Promise<CustomerAvatar> {
  const hub = getUnifiedMemoryHub();
  return hub.loadCustomerAvatar();
}

/**
 * Create a memory-aware action wrapper
 */
export function createMemoryAwareAction<T extends (...args: any[]) => Promise<any>>(
  skillName: string,
  actionName: string,
  fn: T,
  options: {
    minIntervalMinutes?: number;
    trackResult?: boolean;
    accountIdParamIndex?: number;
  } = {}
): T {
  const { minIntervalMinutes = 120, trackResult = true, accountIdParamIndex = -1 } = options;

  return (async (...args: any[]) => {
    const accountId = accountIdParamIndex >= 0 ? args[accountIdParamIndex] : undefined;

    // Check if we should proceed
    const check = await shouldPerformAction(skillName, actionName, accountId, minIntervalMinutes);
    if (!check.allowed) {
      console.log(`[${skillName}] ${actionName} blocked: ${check.reason}`);
      throw new Error(`Rate limited: ${check.reason}`);
    }

    const startTime = Date.now();
    
    try {
      const result = await fn(...args);

      // Record successful action
      recordSkillAction(skillName, {
        skill: skillName,
        action: actionName,
        input: args,
        output: trackResult ? result : undefined,
        success: true,
        duration: Date.now() - startTime,
        accountId,
      });

      return result;
    } catch (error) {
      // Record failed action
      recordSkillAction(skillName, {
        skill: skillName,
        action: actionName,
        input: args,
        output: { error: error instanceof Error ? error.message : String(error) },
        success: false,
        duration: Date.now() - startTime,
        accountId,
      });

      throw error;
    }
  }) as T;
}

/**
 * Log a learning from this skill
 */
export async function logSkillLearning(
  skillName: string,
  insight: string,
  category: string = 'general'
): Promise<void> {
  const hub = getUnifiedMemoryHub();
  
  // Store as a learning entry
  hub.store(skillName, 'learning', `learning:${Date.now()}`, {
    insight,
    category,
    timestamp: new Date().toISOString(),
  }, {
    tags: [skillName, category, 'learning'],
  });

  console.log(`[${skillName}] Learning logged: ${insight.substring(0, 100)}...`);
}

/**
 * Log a failure from this skill
 */
export async function logSkillFailure(
  skillName: string,
  description: string,
  lesson: string,
  context: string = '',
  category: 'technical' | 'strategic' | 'communication' | 'safety' = 'technical'
): Promise<void> {
  const hub = getUnifiedMemoryHub();
  
  await hub.addFailure({
    description,
    context: context || skillName,
    lesson,
    category,
    resolved: false,
    prevention: '',
  });

  console.log(`[${skillName}] Failure logged: ${description}`);
}

/**
 * Get action statistics for this skill
 */
export function getSkillStats(skillName: string): {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  lastActionTime: Date | null;
  actionTypes: string[];
} {
  const hub = getUnifiedMemoryHub();
  const actions = hub.retrieveBySource(skillName);

  const successful = actions.filter((a: any) => a.data?.success !== false);
  const failed = actions.filter((a: any) => a.data?.success === false);
  const actionTypes: string[] = Array.from(new Set(actions.map((a: any) => a.key)));

  return {
    totalActions: actions.length,
    successfulActions: successful.length,
    failedActions: failed.length,
    lastActionTime: actions.length > 0 ? actions[0].timestamp : null,
    actionTypes,
  };
}
