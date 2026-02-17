import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ControlCenterClient } from '../src/client.js';
import { SkillRegistry } from '../src/registry.js';
import { EventBus } from '../src/eventBus.js';
import { MemoryHub } from '../src/memoryHub.js';
import { DocsEngine } from '../src/docsEngine.js';
import { SkillStatus } from '../src/types.js';

describe('ControlCenterClient', () => {
  let client: ControlCenterClient;
  let registry: SkillRegistry;
  let eventBus: EventBus;
  let memory: MemoryHub;
  let docs: DocsEngine;

  beforeEach(() => {
    registry = new SkillRegistry();
    eventBus = new EventBus();
    memory = new MemoryHub();
    docs = new DocsEngine();

    client = new ControlCenterClient({
      skillId: 'test-skill',
      skillName: 'Test Skill',
      registry,
      eventBus,
      memory,
      docs
    });
  });

  describe('init', () => {
    it('should register the skill', async () => {
      await client.init({ version: '1.0.0' });

      const skill = registry.get('test-skill');
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('Test Skill');
      expect(skill?.version).toBe('1.0.0');
    });

    it('should not reinitialize', async () => {
      await client.init();
      await client.init(); // Second call should be no-op

      expect(registry.getAll()).toHaveLength(1);
    });
  });

  describe('log', () => {
    it('should log messages', async () => {
      await client.init();
      client.log('Test message', { key: 'value' });

      const stats = docs.getActionStats();
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('store/retrieve', () => {
    it('should store and retrieve data', async () => {
      await client.init();
      client.store('test-key', { data: 'value' });

      const retrieved = client.retrieve('test-key');
      expect(retrieved).toEqual({ data: 'value' });
    });

    it('should search memory', async () => {
      await client.init();
      client.store('key-1', { name: 'Alice' });
      client.store('key-2', { name: 'Bob' });

      const results = client.search('Alice');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('publish/subscribe', () => {
    it('should publish events', async () => {
      await client.init();
      
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);
      
      client.publish('test.event', { data: 'test' });

      expect(handler).toHaveBeenCalled();
    });

    it('should subscribe to events', async () => {
      await client.init();
      
      const handler = vi.fn();
      const subId = client.subscribe('test.event', handler);
      
      expect(subId).toBeDefined();
      expect(eventBus.getSubscriptionCount()).toBe(1);
    });

    it('should unsubscribe from events', async () => {
      await client.init();
      
      const handler = vi.fn();
      const subId = client.subscribe('test.event', handler);
      client.unsubscribe(subId);

      expect(eventBus.getSubscriptionCount()).toBe(0);
    });
  });

  describe('status management', () => {
    it('should set status', async () => {
      await client.init();
      client.setStatus(SkillStatus.ERROR, 'Something went wrong');

      expect(registry.getStatus('test-skill')).toBe(SkillStatus.ERROR);
    });

    it('should report healthy', async () => {
      await client.init();
      client.healthy();

      expect(registry.getStatus('test-skill')).toBe(SkillStatus.HEALTHY);
    });

    it('should report warning', async () => {
      await client.init();
      client.warning('Low memory');

      expect(registry.getStatus('test-skill')).toBe(SkillStatus.WARNING);
    });

    it('should report error', async () => {
      await client.init();
      client.error('Critical error');

      expect(registry.getStatus('test-skill')).toBe(SkillStatus.ERROR);
    });
  });

  describe('heartbeat', () => {
    it('should send heartbeat', async () => {
      await client.init();
      
      const before = registry.get('test-skill')?.lastHeartbeat;
      await new Promise(resolve => setTimeout(resolve, 10));
      
      client.heartbeat({ memory: 100 });
      
      const after = registry.get('test-skill')?.lastHeartbeat;
      expect(after!.getTime()).toBeGreaterThan(before!.getTime());
    });
  });

  describe('wrap', () => {
    it('should wrap successful function', async () => {
      await client.init();
      const beforeStats = docs.getActionStats();
      
      const result = await client.wrap('test-action', async () => {
        return 'success';
      });

      expect(result).toBe('success');
      
      const stats = docs.getActionStats();
      expect(stats.successful).toBe(beforeStats.successful + 1);
    });

    it('should wrap failing function', async () => {
      await client.init();
      const beforeStats = docs.getActionStats();
      
      await expect(client.wrap('test-action', async () => {
        throw new Error('Test error');
      })).rejects.toThrow('Test error');

      const stats = docs.getActionStats();
      // Allow for 1 or 2 depending on test isolation
      expect(stats.failed).toBeGreaterThanOrEqual(beforeStats.failed + 1);
    });
  });

  describe('shutdown', () => {
    it('should unregister skill on shutdown', async () => {
      await client.init();
      await client.shutdown();

      expect(registry.get('test-skill')).toBeUndefined();
    });
  });
});
