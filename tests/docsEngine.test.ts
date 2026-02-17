import { describe, it, expect, beforeEach } from 'vitest';
import { DocsEngine } from '../src/docsEngine.js';
import { SkillStatus } from '../src/types.js';

describe('DocsEngine', () => {
  let docs: DocsEngine;

  beforeEach(() => {
    docs = new DocsEngine();
  });

  describe('logAction', () => {
    it('should log an action', () => {
      const id = docs.logAction({
        skillId: 'test-skill',
        action: 'test-action',
        input: { data: 'test' },
        output: { result: 'success' },
        duration: 100,
        success: true
      });

      expect(id).toBeDefined();
      
      const stats = docs.getActionStats();
      expect(stats.total).toBe(1);
      expect(stats.successful).toBe(1);
    });

    it('should log failed actions', () => {
      docs.logAction({
        skillId: 'test-skill',
        action: 'test-action',
        success: false,
        error: 'Something went wrong'
      });

      const stats = docs.getActionStats();
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('logDecision', () => {
    it('should log a decision', () => {
      const id = docs.logDecision(
        'test-skill',
        'Approve request',
        'Request meets all criteria',
        { outcome: 'approved' }
      );

      expect(id).toBeDefined();
      
      const audit = docs.generateDecisionAudit();
      expect(audit.decisions).toHaveLength(1);
      expect(audit.decisions[0].decision).toBe('Approve request');
    });
  });

  describe('generateDailyReport', () => {
    it('should generate a daily report', () => {
      docs.logAction({
        skillId: 'skill-1',
        action: 'action-1',
        success: true
      });

      const report = docs.generateDailyReport();

      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.period.start).toBeInstanceOf(Date);
      expect(report.period.end).toBeInstanceOf(Date);
      expect(report.skills).toHaveLength(1);
      expect(report.actions.total).toBe(1);
    });
  });

  describe('generateDecisionAudit', () => {
    it('should generate decision audit', () => {
      docs.logDecision('skill-1', 'Decision 1', 'Rationale 1');
      docs.logDecision('skill-2', 'Decision 2', 'Rationale 2');

      const audit = docs.generateDecisionAudit();

      expect(audit.decisions).toHaveLength(2);
    });

    it('should filter by date range', () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-06-01');

      docs.logDecision('skill-1', 'Old Decision', 'Old', { outcome: {} });
      
      // Manually modify timestamp (hack for testing)
      const decisions = (docs as any).decisions;
      decisions[0].timestamp = oldDate;

      docs.logDecision('skill-1', 'New Decision', 'New');

      const audit = docs.generateDecisionAudit({ startDate: newDate });
      
      expect(audit.decisions).toHaveLength(1);
      expect(audit.decisions[0].decision).toBe('New Decision');
    });
  });

  describe('getActionsBySkill', () => {
    it('should return actions for specific skill', () => {
      docs.logAction({ skillId: 'skill-1', action: 'action-1', success: true });
      docs.logAction({ skillId: 'skill-2', action: 'action-2', success: true });
      docs.logAction({ skillId: 'skill-1', action: 'action-3', success: true });

      const actions = docs.getActionsBySkill('skill-1');

      expect(actions).toHaveLength(2);
    });

    it('should respect limit', () => {
      for (let i = 0; i < 10; i++) {
        docs.logAction({ skillId: 'skill-1', action: `action-${i}`, success: true });
      }

      const actions = docs.getActionsBySkill('skill-1', 5);

      expect(actions).toHaveLength(5);
    });
  });

  describe('getRecentErrors', () => {
    it('should return recent errors', () => {
      docs.logAction({ skillId: 'skill-1', action: 'action-1', success: true });
      docs.logAction({ skillId: 'skill-1', action: 'action-2', success: false, error: 'Error 1' });
      docs.logAction({ skillId: 'skill-1', action: 'action-3', success: false, error: 'Error 2' });

      const errors = docs.getRecentErrors();

      expect(errors).toHaveLength(2);
    });
  });

  describe('getActionStats', () => {
    it('should calculate correct stats', () => {
      docs.logAction({ skillId: 'skill-1', action: 'a1', success: true, duration: 100 });
      docs.logAction({ skillId: 'skill-1', action: 'a2', success: true, duration: 200 });
      docs.logAction({ skillId: 'skill-2', action: 'a3', success: false, duration: 50 });

      const stats = docs.getActionStats();

      expect(stats.total).toBe(3);
      expect(stats.successful).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 0);
      expect(stats.averageDuration).toBe(117); // (100+200+50)/3 rounded
      expect(stats.bySkill['skill-1']).toBe(2);
      expect(stats.bySkill['skill-2']).toBe(1);
    });
  });

  describe('export', () => {
    it('should export all data', () => {
      docs.logAction({ skillId: 'skill-1', action: 'action-1', success: true });
      docs.logDecision('skill-1', 'Decision 1', 'Rationale 1');

      const exported = docs.export();

      expect(exported.actions).toHaveLength(1);
      expect(exported.decisions).toHaveLength(1);
      expect(exported.exportedAt).toBeInstanceOf(Date);
    });
  });

  describe('clear', () => {
    it('should clear all logs', () => {
      docs.logAction({ skillId: 'skill-1', action: 'action-1', success: true });
      docs.logDecision('skill-1', 'Decision 1', 'Rationale 1');

      docs.clear();

      expect(docs.getActionStats().total).toBe(0);
      expect(docs.generateDecisionAudit().decisions).toHaveLength(0);
    });
  });
});
