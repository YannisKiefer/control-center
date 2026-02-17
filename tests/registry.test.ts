import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillRegistry } from '../src/registry.js';
import { Skill, SkillStatus } from '../src/types.js';

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  describe('register', () => {
    it('should register a new skill', () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        version: '1.0.0',
        status: SkillStatus.HEALTHY,
        lastHeartbeat: new Date()
      };

      registry.register(skill);
      
      expect(registry.get('test-skill')).toBeDefined();
      expect(registry.get('test-skill')?.name).toBe('Test Skill');
    });

    it('should throw when registering duplicate skill', () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        version: '1.0.0',
        status: SkillStatus.HEALTHY,
        lastHeartbeat: new Date()
      };

      registry.register(skill);
      
      expect(() => registry.register(skill)).toThrow('already registered');
    });
  });

  describe('unregister', () => {
    it('should unregister a skill', () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        version: '1.0.0',
        status: SkillStatus.HEALTHY,
        lastHeartbeat: new Date()
      };

      registry.register(skill);
      registry.unregister('test-skill');
      
      expect(registry.get('test-skill')).toBeUndefined();
    });

    it('should throw when unregistering non-existent skill', () => {
      expect(() => registry.unregister('non-existent')).toThrow('not found');
    });
  });

  describe('getStatus', () => {
    it('should return skill status', () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        version: '1.0.0',
        status: SkillStatus.WARNING,
        lastHeartbeat: new Date()
      };

      registry.register(skill);
      
      expect(registry.getStatus('test-skill')).toBe(SkillStatus.WARNING);
    });
  });

  describe('getAll', () => {
    it('should return all registered skills', () => {
      registry.register({
        id: 'skill-1',
        name: 'Skill 1',
        version: '1.0.0',
        status: SkillStatus.HEALTHY,
        lastHeartbeat: new Date()
      });
      
      registry.register({
        id: 'skill-2',
        name: 'Skill 2',
        version: '1.0.0',
        status: SkillStatus.HEALTHY,
        lastHeartbeat: new Date()
      });

      expect(registry.getAll()).toHaveLength(2);
    });
  });

  describe('updateStatus', () => {
    it('should update skill status', () => {
      registry.register({
        id: 'test-skill',
        name: 'Test Skill',
        version: '1.0.0',
        status: SkillStatus.HEALTHY,
        lastHeartbeat: new Date()
      });

      registry.updateStatus('test-skill', SkillStatus.ERROR, 'Something went wrong');
      
      expect(registry.getStatus('test-skill')).toBe(SkillStatus.ERROR);
    });
  });

  describe('getFailed', () => {
    it('should return only failed skills', () => {
      registry.register({
        id: 'healthy-skill',
        name: 'Healthy',
        version: '1.0.0',
        status: SkillStatus.HEALTHY,
        lastHeartbeat: new Date()
      });
      
      registry.register({
        id: 'error-skill',
        name: 'Error',
        version: '1.0.0',
        status: SkillStatus.ERROR,
        lastHeartbeat: new Date()
      });

      const failed = registry.getFailed();
      
      expect(failed).toHaveLength(1);
      expect(failed[0].id).toBe('error-skill');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      registry.register({
        id: 'skill-1',
        name: 'Skill 1',
        version: '1.0.0',
        status: SkillStatus.HEALTHY,
        lastHeartbeat: new Date()
      });
      
      registry.register({
        id: 'skill-2',
        name: 'Skill 2',
        version: '1.0.0',
        status: SkillStatus.ERROR,
        lastHeartbeat: new Date()
      });

      const stats = registry.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.healthy).toBe(1);
      expect(stats.error).toBe(1);
    });
  });

  describe('isHealthy', () => {
    it('should return true when all skills are healthy', () => {
      registry.register({
        id: 'skill-1',
        name: 'Skill 1',
        version: '1.0.0',
        status: SkillStatus.HEALTHY,
        lastHeartbeat: new Date()
      });

      expect(registry.isHealthy()).toBe(true);
    });

    it('should return false when any skill has error', () => {
      registry.register({
        id: 'skill-1',
        name: 'Skill 1',
        version: '1.0.0',
        status: SkillStatus.HEALTHY,
        lastHeartbeat: new Date()
      });
      
      registry.register({
        id: 'skill-2',
        name: 'Skill 2',
        version: '1.0.0',
        status: SkillStatus.ERROR,
        lastHeartbeat: new Date()
      });

      expect(registry.isHealthy()).toBe(false);
    });
  });
});
