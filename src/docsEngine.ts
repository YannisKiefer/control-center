/**
 * Documentation Engine
 * 
 * Auto-generates documentation from system actions and events.
 * Creates daily reports, decision audit trails, and skill documentation.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import { getMemoryHub } from './memoryHub';
import { getEventBus, SystemEvent } from './eventBus';

export interface DailyReport {
  date: string;
  generatedAt: string;
  summary: {
    totalEvents: number;
    skillsActive: number;
    conversions: number;
    errors: number;
  };
  events: SystemEvent[];
  decisions: DecisionRecord[];
  metrics: Record<string, number>;
}

export interface DecisionRecord {
  timestamp: Date;
  source: string;
  context: string;
  decision: string;
  rationale: string;
  outcome?: string;
}

export class DocumentationEngine extends EventEmitter {
  private docsPath: string;
  private decisions: DecisionRecord[] = [];
  private eventBus = getEventBus();
  private memoryHub = getMemoryHub();

  constructor(docsPath: string = '/root/.openclaw/workspace/docs') {
    super();
    this.docsPath = docsPath;
    this.ensureDirectories();
    this.subscribeToEvents();
  }

  /**
   * Record a decision for audit trail
   */
  recordDecision(
    source: string,
    context: string,
    decision: string,
    rationale: string
  ): DecisionRecord {
    const record: DecisionRecord = {
      timestamp: new Date(),
      source,
      context,
      decision,
      rationale,
    };

    this.decisions.push(record);
    
    // Keep only last 1000 decisions
    if (this.decisions.length > 1000) {
      this.decisions = this.decisions.slice(-1000);
    }

    this.emit('decision:recorded', record);
    
    // Store in memory hub
    this.memoryHub.store(
      'docsEngine',
      'log',
      `decision:${Date.now()}`,
      record,
      { tags: ['decision', source] }
    );

    return record;
  }

  /**
   * Update decision outcome
   */
  updateDecisionOutcome(timestamp: Date, outcome: string): void {
    const decision = this.decisions.find(
      d => d.timestamp.getTime() === timestamp.getTime()
    );
    
    if (decision) {
      decision.outcome = outcome;
      this.emit('decision:updated', decision);
    }
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(date: Date = new Date()): Promise<DailyReport> {
    const dateStr = format(date, 'yyyy-MM-dd');
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    // Get events from event bus
    const events = this.eventBus.getHistory({
      since: startOfDay,
      until: endOfDay,
    });

    // Get decisions from today
    const todaysDecisions = this.decisions.filter(
      d => d.timestamp >= startOfDay && d.timestamp <= endOfDay
    );

    // Calculate metrics
    const conversions = events.filter(
      e => e.type === 'conversion.achieved'
    ).length;
    
    const errors = events.filter(
      e => e.type === 'error' || e.type === 'skill.error'
    ).length;

    const report: DailyReport = {
      date: dateStr,
      generatedAt: new Date().toISOString(),
      summary: {
        totalEvents: events.length,
        skillsActive: new Set(events.map(e => e.source)).size,
        conversions,
        errors,
      },
      events,
      decisions: todaysDecisions,
      metrics: this.calculateMetrics(events),
    };

    // Save report
    await this.saveReport(report);

    this.emit('report:generated', report);

    return report;
  }

  /**
   * Generate skill documentation
   */
  generateSkillDocs(skillId: string, skillData: any): string {
    const doc = `# ${skillData.name} - Skill Documentation

## Overview

**ID:** ${skillId}  
**Version:** ${skillData.version}  
**Type:** ${skillData.type}  
**Status:** ${skillData.status}  

## Description

${skillData.metadata?.description || 'No description available.'}

## Configuration

\`\`\`json
${JSON.stringify(skillData.config || {}, null, 2)}
\`\`\`

## Statistics

- **Total Calls:** ${skillData.stats?.calls || 0}
- **Errors:** ${skillData.stats?.errors || 0}
- **Avg Response Time:** ${skillData.stats?.avgResponseTime?.toFixed(2) || 0}ms
- **Health Score:** ${skillData.health || 100}%

## Dependencies

${skillData.metadata?.dependencies?.map((d: string) => `- ${d}`).join('\n') || '- None'}

## Auto-Generated

This documentation was auto-generated on ${new Date().toISOString()}.
`;

    return doc;
  }

  /**
   * Generate decision audit report
   */
  generateDecisionAudit(since?: Date, until?: Date): string {
    let filtered = this.decisions;

    if (since) {
      filtered = filtered.filter(d => d.timestamp >= since);
    }

    if (until) {
      filtered = filtered.filter(d => d.timestamp <= until);
    }

    const report = `# Decision Audit Report

**Period:** ${since ? format(since, 'yyyy-MM-dd') : 'All time'} to ${until ? format(until, 'yyyy-MM-dd') : 'Now'}  
**Total Decisions:** ${filtered.length}

## Decisions

${filtered.map(d => `
### ${format(d.timestamp, 'yyyy-MM-dd HH:mm:ss')} - ${d.source}

**Context:** ${d.context}

**Decision:** ${d.decision}

**Rationale:** ${d.rationale}

${d.outcome ? `**Outcome:** ${d.outcome}` : ''}
`).join('\n---\n')}

---

*Generated by Documentation Engine*
`;

    return report;
  }

  /**
   * Generate system architecture doc
   */
  generateSystemDoc(components: any[]): string {
    return `# System Architecture

**Generated:** ${new Date().toISOString()}

## Components

${components.map(c => `
### ${c.name}

- **Type:** ${c.type}
- **Status:** ${c.status}
- **Description:** ${c.description}
`).join('\n')}

## Diagram

\`\`\`
${this.generateAsciiDiagram(components)}
\`\`\`

---

*Auto-generated documentation*
`;
  }

  /**
   * Save report to file
   */
  private async saveReport(report: DailyReport): Promise<void> {
    const reportsDir = path.join(this.docsPath, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filePath = path.join(reportsDir, `daily-${report.date}.md`);
    const content = this.formatDailyReport(report);
    
    fs.writeFileSync(filePath, content);

    // Also save as JSON
    const jsonPath = path.join(reportsDir, `daily-${report.date}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  }

  /**
   * Format daily report as markdown
   */
  private formatDailyReport(report: DailyReport): string {
    return `# Daily Report - ${report.date}

**Generated:** ${report.generatedAt}

## Summary

| Metric | Value |
|--------|-------|
| Total Events | ${report.summary.totalEvents} |
| Skills Active | ${report.summary.skillsActive} |
| Conversions | ${report.summary.conversions} |
| Errors | ${report.summary.errors} |

## Metrics

${Object.entries(report.metrics).map(([k, v]) => `- **${k}:** ${v}`).join('\n')}

## Key Events

${report.events.slice(0, 20).map(e => `
- **${format(e.timestamp, 'HH:mm:ss')}** [${e.source}] ${e.type}: ${JSON.stringify(e.payload).substring(0, 100)}
`).join('')}

${report.events.length > 20 ? `\n... and ${report.events.length - 20} more events` : ''}

## Decisions

${report.decisions.map(d => `
- **${format(d.timestamp, 'HH:mm:ss')}** ${d.source}: ${d.decision}
  - *Rationale:* ${d.rationale}
`).join('')}

---

*Generated by Documentation Engine*
`;
  }

  /**
   * Calculate metrics from events
   */
  private calculateMetrics(events: SystemEvent[]): Record<string, number> {
    const metrics: Record<string, number> = {};

    // Count by type
    for (const event of events) {
      metrics[event.type] = (metrics[event.type] || 0) + 1;
    }

    // Calculate rate per hour
    const hours = 24;
    metrics['eventsPerHour'] = events.length / hours;

    return metrics;
  }

  /**
   * Generate ASCII diagram
   */
  private generateAsciiDiagram(components: any[]): string {
    // Simple ASCII representation
    return components.map(c => `[${c.name}]`).join(' --\u003e ');
  }

  /**
   * Subscribe to system events
   */
  private subscribeToEvents(): void {
    // Auto-document important events
    this.eventBus.subscribe({
      eventTypes: ['skill.error', 'conversion.achieved'],
      handler: (event) => {
        this.memoryHub.store(
          'docsEngine',
          'log',
          `event:${event.id}`,
          event,
          { tags: ['auto-documented', event.type] }
        );
      },
    });
  }

  /**
   * Ensure directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      this.docsPath,
      path.join(this.docsPath, 'reports'),
      path.join(this.docsPath, 'skills'),
      path.join(this.docsPath, 'audits'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Schedule daily report generation
   */
  scheduleDailyReports(hour: number = 21, minute: number = 0): void {
    const now = new Date();
    const scheduled = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute
    );

    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    const delay = scheduled.getTime() - now.getTime();

    setTimeout(() => {
      this.generateDailyReport();
      // Schedule next
      setInterval(() => this.generateDailyReport(), 24 * 60 * 60 * 1000);
    }, delay);

    console.log(`[DocsEngine] Daily reports scheduled for ${hour}:${minute.toString().padStart(2, '0')}`);
  }
}

// Singleton instance
let docsEngine: DocumentationEngine | null = null;

export function getDocumentationEngine(): DocumentationEngine {
  if (!docsEngine) {
    docsEngine = new DocumentationEngine();
  }
  return docsEngine;
}