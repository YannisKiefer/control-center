import { SkillRegistry, skillRegistry } from './registry.js';
import { EventBus, eventBus } from './eventBus.js';
import { MemoryHub, memoryHub } from './memoryHub.js';
import { DocsEngine, docsEngine } from './docsEngine.js';
import {
  Skill,
  SkillId,
  SkillStatus,
  Event,
  Action,
  MemoryKey
} from './types.js';

/**
 * Control Center Client - Used by all skills to interact with Control Center
 * Provides unified interface for logging, storage, events, and status
 */
export class ControlCenterClient {
  private skillId: SkillId;
  private skillName: string;
  private registry: SkillRegistry;
  private eventBus: EventBus;
  private memory: MemoryHub;
  private docs: DocsEngine;
  private initialized = false;

  constructor(options: {
    skillId: SkillId;
    skillName: string;
    registry?: SkillRegistry;
    eventBus?: EventBus;
    memory?: MemoryHub;
    docs?: DocsEngine;
  }) {
    this.skillId = options.skillId;
    this.skillName = options.skillName;
    this.registry = options.registry || skillRegistry;
    this.eventBus = options.eventBus || eventBus;
    this.memory = options.memory || memoryHub;
    this.docs = options.docs || docsEngine;
  }

  /**
   * Initialize and register the skill
   */
  async init(config?: Record<string, unknown>): Promise<void> {
    if (this.initialized) return;

    const skill: Skill = {
      id: this.skillId,
      name: this.skillName,
      version: config?.version as string || '1.0.0',
      description: config?.description as string,
      status: SkillStatus.STARTING,
      lastHeartbeat: new Date(),
      config
    };

    this.registry.register(skill);
    this.initialized = true;

    // Auto-heartbeat every 30 seconds
    setInterval(() => this.heartbeat(), 30000);

    this.log('Skill initialized', { config });
  }

  /**
   * Log a message (goes to docs engine)
   */
  log(message: string, metadata?: Record<string, unknown>): void {
    console.log(`[${this.skillName}] ${message}`, metadata || '');
    
    this.docs.logAction({
      skillId: this.skillId,
      action: 'log',
      input: { message, metadata },
      success: true
    });
  }

  /**
   * Log an action with full details
   */
  logAction(action: Omit<Action, 'id' | 'timestamp' | 'skillId'>): string {
    return this.docs.logAction({
      ...action,
      skillId: this.skillId
    });
  }

  /**
   * Log a decision for audit trail
   */
  logDecision(
    decision: string,
    rationale: string,
    options?: { outcome?: unknown; relatedActions?: string[] }
  ): string {
    return this.docs.logDecision(
      this.skillId,
      decision,
      rationale,
      options
    );
  }

  /**
   * Store data in memory hub
   */
  store(key: MemoryKey, data: unknown, options?: {
    ttl?: number;
    tags?: string[];
  }): void {
    this.memory.store(key, data, {
      ...options,
      source: this.skillId
    });
  }

  /**
   * Retrieve data from memory hub
   */
  retrieve<T>(key: MemoryKey): T | undefined {
    return this.memory.retrieve<T>(key);
  }

  /**
   * Search memory
   */
  search(query: string, options?: { limit?: number; tags?: string[] }) {
    return this.memory.search(query, options);
  }

  /**
   * Publish an event
   */
  publish(eventType: string, payload: unknown, options?: {
    correlationId?: string;
  }): void {
    this.eventBus.publish({
      type: eventType,
      source: this.skillId,
      payload,
      correlationId: options?.correlationId
    });
  }

  /**
   * Subscribe to events
   */
  subscribe(pattern: string, handler: (event: Event) => void | Promise<void>): string {
    return this.eventBus.subscribe(pattern, handler);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.eventBus.unsubscribe(subscriptionId);
  }

  /**
   * Request/response pattern
   */
  async request<T>(eventType: string, payload: unknown, timeoutMs?: number): Promise<T> {
    return this.eventBus.request<T>(eventType, payload, timeoutMs);
  }

  /**
   * Send heartbeat
   */
  heartbeat(metadata?: Record<string, unknown>): void {
    this.registry.heartbeat(this.skillId, metadata);
  }

  /**
   * Update skill status
   */
  setStatus(status: SkillStatus, message?: string): void {
    this.registry.updateStatus(this.skillId, status, message);
  }

  /**
   * Report skill as healthy
   */
  healthy(): void {
    this.setStatus(SkillStatus.HEALTHY);
  }

  /**
   * Report skill warning
   */
  warning(message: string): void {
    this.setStatus(SkillStatus.WARNING, message);
    this.log('Warning', { message });
  }

  /**
   * Report skill error
   */
  error(message: string, error?: Error): void {
    this.setStatus(SkillStatus.ERROR, message);
    this.logAction({
      action: 'error',
      input: { message, error: error?.message, stack: error?.stack },
      success: false,
      error: message
    });
  }

  /**
   * Shutdown the skill
   */
  async shutdown(): Promise<void> {
    this.setStatus(SkillStatus.STOPPING);
    this.log('Shutting down...');
    this.registry.unregister(this.skillId);
    this.initialized = false;
  }

  /**
   * Get skill info
   */
  getInfo() {
    return this.registry.get(this.skillId);
  }

  /**
   * Wrap a function with logging and error handling
   */
  async wrap<T>(
    name: string,
    fn: () => Promise<T>,
    options?: { logInput?: boolean; logOutput?: boolean }
  ): Promise<T> {
    const start = Date.now();
    const actionId = this.logAction({
      action: name,
      input: options?.logInput ? undefined : '[redacted]',
      success: false // Will update
    });

    try {
      const result = await fn();
      const duration = Date.now() - start;

      this.docs.logAction({
        skillId: this.skillId,
        action: name,
        input: options?.logInput ? undefined : '[redacted]',
        output: options?.logOutput ? result : '[redacted]',
        duration,
        success: true
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.docs.logAction({
        skillId: this.skillId,
        action: name,
        input: options?.logInput ? undefined : '[redacted]',
        duration,
        success: false,
        error: errorMessage
      });

      throw error;
    }
  }
}

/**
 * Create a new Control Center client for a skill
 */
export function createClient(skillId: SkillId, skillName: string, config?: Record<string, unknown>) {
  const client = new ControlCenterClient({ skillId, skillName });
  client.init(config);
  return client;
}

// Re-export singletons for direct access
export { skillRegistry, eventBus, memoryHub, docsEngine };
