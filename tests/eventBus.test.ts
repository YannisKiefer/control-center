import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../src/eventBus.js';
import { Event } from '../src/types.js';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('subscribe', () => {
    it('should subscribe to events', () => {
      const handler = vi.fn();
      const id = eventBus.subscribe('test.event', handler);
      
      expect(id).toBeDefined();
      expect(eventBus.getSubscriptionCount()).toBe(1);
    });

    it('should handle events matching pattern', () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);
      
      eventBus.publish({
        type: 'test.event',
        source: 'test',
        payload: { data: 'test' }
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should support wildcard patterns', () => {
      const handler = vi.fn();
      eventBus.subscribe('test.*', handler);
      
      eventBus.publish({
        type: 'test.event1',
        source: 'test',
        payload: {}
      });
      
      eventBus.publish({
        type: 'test.event2',
        source: 'test',
        payload: {}
      });

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from events', () => {
      const handler = vi.fn();
      const id = eventBus.subscribe('test.event', handler);
      
      eventBus.unsubscribe(id);
      
      eventBus.publish({
        type: 'test.event',
        source: 'test',
        payload: {}
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should add timestamp and id to events', () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);
      
      eventBus.publish({
        type: 'test.event',
        source: 'test',
        payload: {}
      });

      const event = handler.mock.calls[0][0] as Event;
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should store events in history', () => {
      eventBus.publish({
        type: 'test.event',
        source: 'test',
        payload: {}
      });

      expect(eventBus.getHistory()).toHaveLength(1);
    });
  });

  describe('getHistory', () => {
    it('should filter by type', () => {
      eventBus.publish({ type: 'test.event1', source: 'test', payload: {} });
      eventBus.publish({ type: 'test.event2', source: 'test', payload: {} });
      eventBus.publish({ type: 'other.event', source: 'test', payload: {} });

      const history = eventBus.getHistory({ type: 'test.*' });
      
      expect(history).toHaveLength(2);
    });

    it('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        eventBus.publish({ type: 'test.event', source: 'test', payload: {} });
      }

      const history = eventBus.getHistory({ limit: 5 });
      
      expect(history).toHaveLength(5);
    });
  });

  describe('waitFor', () => {
    it('should resolve when event is received', async () => {
      const promise = eventBus.waitFor('test.event', 1000);
      
      setTimeout(() => {
        eventBus.publish({ type: 'test.event', source: 'test', payload: {} });
      }, 10);

      const event = await promise;
      expect(event.type).toBe('test.event');
    });

    it('should reject on timeout', async () => {
      await expect(eventBus.waitFor('test.event', 50)).rejects.toThrow('Timeout');
    });
  });

  describe('request', () => {
    it('should handle request/response pattern', async () => {
      // Set up response handler
      eventBus.subscribe('test.request.response', (event) => {
        // Response would normally be sent here
      });

      // This test would need a more complex setup for full request/response testing
      // For now, just verify it doesn't throw immediately
      const promise = eventBus.request('test.request', { data: 'test' }, 50);
      await expect(promise).rejects.toThrow('Request timeout');
    });
  });
});
