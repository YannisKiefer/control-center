import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryHub } from '../src/memoryHub.js';

describe('MemoryHub', () => {
  let memory: MemoryHub;

  beforeEach(() => {
    memory = new MemoryHub();
  });

  describe('store', () => {
    it('should store data', () => {
      memory.store('test-key', { data: 'value' });
      
      expect(memory.retrieve('test-key')).toEqual({ data: 'value' });
    });

    it('should store with tags', () => {
      memory.store('test-key', { data: 'value' }, { tags: ['tag1', 'tag2'] });
      
      const byTag = memory.getByTag('tag1');
      expect(byTag).toHaveLength(1);
      expect(byTag[0].key).toBe('test-key');
    });

    it('should overwrite existing key', () => {
      memory.store('test-key', { data: 'old' });
      memory.store('test-key', { data: 'new' });
      
      expect(memory.retrieve('test-key')).toEqual({ data: 'new' });
    });
  });

  describe('retrieve', () => {
    it('should retrieve stored data', () => {
      memory.store('test-key', { data: 'value' });
      
      expect(memory.retrieve('test-key')).toEqual({ data: 'value' });
    });

    it('should return undefined for missing key', () => {
      expect(memory.retrieve('missing-key')).toBeUndefined();
    });

    it('should respect TTL', async () => {
      memory.store('test-key', { data: 'value' }, { ttl: 50 });
      
      expect(memory.retrieve('test-key')).toEqual({ data: 'value' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(memory.retrieve('test-key')).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete stored data', () => {
      memory.store('test-key', { data: 'value' });
      memory.delete('test-key');
      
      expect(memory.retrieve('test-key')).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      expect(memory.delete('missing-key')).toBe(false);
    });
  });

  describe('search', () => {
    it('should find matching data', () => {
      memory.store('user-1', { name: 'Alice', role: 'admin' });
      memory.store('user-2', { name: 'Bob', role: 'user' });
      memory.store('config', { setting: 'value' });

      const results = memory.search('Alice');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].key).toBe('user-1');
    });

    it('should search in data content', () => {
      memory.store('config', { setting: 'important-value' });

      const results = memory.search('important');
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should filter by tags', () => {
      memory.store('item-1', { data: 'test' }, { tags: ['category-a'] });
      memory.store('item-2', { data: 'test' }, { tags: ['category-b'] });

      const results = memory.search('test', { tags: ['category-a'] });
      
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('item-1');
    });

    it('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        memory.store(`key-${i}`, { data: 'test' });
      }

      const results = memory.search('test', { limit: 5 });
      
      expect(results).toHaveLength(5);
    });
  });

  describe('getByTag', () => {
    it('should return entries with tag', () => {
      memory.store('item-1', { data: '1' }, { tags: ['test'] });
      memory.store('item-2', { data: '2' }, { tags: ['test'] });
      memory.store('item-3', { data: '3' }, { tags: ['other'] });

      const results = memory.getByTag('test');
      
      expect(results).toHaveLength(2);
    });

    it('should return empty array for unknown tag', () => {
      expect(memory.getByTag('unknown')).toEqual([]);
    });
  });

  describe('getBySource', () => {
    it('should return entries from source', () => {
      memory.store('item-1', { data: '1' }, { source: 'skill-a' });
      memory.store('item-2', { data: '2' }, { source: 'skill-a' });
      memory.store('item-3', { data: '3' }, { source: 'skill-b' });

      const results = memory.getBySource('skill-a');
      
      expect(results).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update existing data', () => {
      memory.store('counter', { value: 0 });
      
      const result = memory.update('counter', (current: any) => ({
        value: (current?.value || 0) + 1
      }));

      expect(result.value).toBe(1);
      expect(memory.retrieve('counter').value).toBe(1);
    });

    it('should handle undefined current value', () => {
      const result = memory.update('new-key', (current: any) => ({
        value: (current?.value || 0) + 1
      }));

      expect(result.value).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      memory.store('key-1', { data: '1' }, { tags: ['tag1'] });
      memory.store('key-2', { data: '2' }, { tags: ['tag2'] });

      const stats = memory.getStats();
      
      expect(stats.entries).toBe(2);
      expect(stats.tags).toContain('tag1');
      expect(stats.tags).toContain('tag2');
    });
  });

  describe('keys', () => {
    it('should return all keys', () => {
      memory.store('prefix-key-1', {});
      memory.store('prefix-key-2', {});
      memory.store('other-key', {});

      expect(memory.keys()).toHaveLength(3);
    });

    it('should filter by pattern', () => {
      memory.store('prefix-key-1', {});
      memory.store('prefix-key-2', {});
      memory.store('other-key', {});

      const keys = memory.keys('prefix*');
      
      expect(keys).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      memory.store('key-1', {});
      memory.store('key-2', {});

      memory.clear();

      expect(memory.getStats().entries).toBe(0);
      expect(memory.retrieve('key-1')).toBeUndefined();
    });
  });
});
