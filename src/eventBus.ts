/**
 * Event Bus
 * 
 * Central event messaging system for skill communication.
 * Enables async, decoupled messaging between all components.
 */

import { EventEmitter } from 'events';

export interface SystemEvent {
  id: string;
  timestamp: Date;
  source: string; // Skill ID or system component
  type: string;
  payload: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
  };
}

export interface EventSubscription {
  id: string;
  eventTypes: string[];
  sources?: string[];
  handler: (event: SystemEvent) => void | Promise<void>;
  filter?: (event: SystemEvent) => boolean;
}

export class EventBus extends EventEmitter {
  private events: SystemEvent[] = [];
  private subscriptions: Map<string, EventSubscription> = new Map();
  private maxHistory: number = 10000;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many subscribers
  }

  /**
   * Publish an event to the bus
   */
  publish(event: Omit<SystemEvent, 'id' | 'timestamp'>): SystemEvent {
    const fullEvent: SystemEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date(),
    };

    // Store in history
    this.events.push(fullEvent);
    
    // Trim history if needed
    if (this.events.length > this.maxHistory) {
      this.events = this.events.slice(-this.maxHistory);
    }

    // Emit for internal listeners
    this.emit('event', fullEvent);
    this.emit(`event:${event.type}`, fullEvent);
    this.emit(`source:${event.source}`, fullEvent);

    // Notify matching subscriptions
    this.notifySubscribers(fullEvent);

    return fullEvent;
  }

  /**
   * Subscribe to events
   */
  subscribe(subscription: Omit<EventSubscription, 'id'>): string {
    const id = this.generateId();
    
    this.subscriptions.set(id, {
      ...subscription,
      id,
    });

    return id;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Get event history
   */
  getHistory(options: {
    limit?: number;
    eventTypes?: string[];
    sources?: string[];
    since?: Date;
    until?: Date;
  } = {}): SystemEvent[] {
    let filtered = [...this.events];

    if (options.eventTypes) {
      filtered = filtered.filter(e => options.eventTypes!.includes(e.type));
    }

    if (options.sources) {
      filtered = filtered.filter(e => options.sources!.includes(e.source));
    }

    if (options.since) {
      filtered = filtered.filter(e => e.timestamp >= options.since!);
    }

    if (options.until) {
      filtered = filtered.filter(e => e.timestamp <= options.until!);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get events for a specific skill
   */
  getSkillEvents(skillId: string, limit?: number): SystemEvent[] {
    return this.getHistory({
      sources: [skillId],
      limit,
    });
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string, limit?: number): SystemEvent[] {
    return this.getHistory({
      eventTypes: [type],
      limit,
    });
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.events = [];
  }

  /**
   * Get event statistics
   */
  getStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySource: Record<string, number>;
    avgEventsPerMinute: number;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsBySource: Record<string, number> = {};

    for (const event of this.events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySource[event.source] = (eventsBySource[event.source] || 0) + 1;
    }

    // Calculate average events per minute (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp >= oneHourAgo);
    const avgEventsPerMinute = recentEvents.length / 60;

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsBySource,
      avgEventsPerMinute,
    };
  }

  /**
   * Create a command event (request for action)
   */
  createCommand(
    source: string,
    target: string,
    command: string,
    payload: any = {},
    priority: SystemEvent['priority'] = 'medium'
  ): SystemEvent {
    return this.publish({
      source,
      type: `command.${command}`,
      payload: {
        target,
        command,
        data: payload,
      },
      priority,
      metadata: {
        correlationId: this.generateId(),
      },
    });
  }

  /**
   * Create a response event
   */
  createResponse(
    source: string,
    originalEvent: SystemEvent,
    payload: any = {},
    success: boolean = true
  ): SystemEvent {
    return this.publish({
      source,
      type: `response.${success ? 'success' : 'error'}`,
      payload: {
        originalEventId: originalEvent.id,
        data: payload,
      },
      priority: 'medium',
      metadata: {
        correlationId: originalEvent.metadata.correlationId,
        causationId: originalEvent.id,
      },
    });
  }

  /**
   * Wait for a specific event
   */
  async waitFor(
    eventType: string,
    timeout: number = 5000,
    filter?: (event: SystemEvent) => boolean
  ): Promise<SystemEvent> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(`event:${eventType}`, handler);
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);

      const handler = (event: SystemEvent) => {
        if (!filter || filter(event)) {
          clearTimeout(timer);
          this.off(`event:${eventType}`, handler);
          resolve(event);
        }
      };

      this.on(`event:${eventType}`, handler);
    });
  }

  /**
   * Notify matching subscribers
   */
  private notifySubscribers(event: SystemEvent): void {
    for (const subscription of this.subscriptions.values()) {
      // Check event type match
      if (!subscription.eventTypes.includes(event.type)) {
        continue;
      }

      // Check source match
      if (subscription.sources && !subscription.sources.includes(event.source)) {
        continue;
      }

      // Check custom filter
      if (subscription.filter && !subscription.filter(event)) {
        continue;
      }

      // Call handler
      try {
        const result = subscription.handler(event);
        if (result instanceof Promise) {
          result.catch(err => {
            console.error(`[EventBus] Handler error for ${subscription.id}:`, err);
          });
        }
      } catch (err) {
        console.error(`[EventBus] Handler error for ${subscription.id}:`, err);
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Event type constants
export const EventTypes = {
  // Skill lifecycle
  SKILL_REGISTERED: 'skill.registered',
  SKILL_STARTED: 'skill.started',
  SKILL_STOPPED: 'skill.stopped',
  SKILL_ERROR: 'skill.error',
  
  // Content events
  CONTENT_CREATED: 'content.created',
  CONTENT_POSTED: 'content.posted',
  
  // Engagement events
  COMMENT_POSTED: 'comment.posted',
  DM_SENT: 'dm.sent',
  DM_RECEIVED: 'dm.received',
  
  // XReacher events
  LEAD_GENERATED: 'lead.generated',
  CONVERSION_ACHIEVED: 'conversion.achieved',
  
  // System events
  HEALTH_CHECK: 'health.check',
  ERROR: 'error',
  WARNING: 'warning',
} as const;

// Singleton instance
let eventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!eventBus) {
    eventBus = new EventBus();
  }
  return eventBus;
}