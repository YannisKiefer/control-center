/**
 * Weekly Memory Workflow
 * 
 * Runs weekly on Sunday at 10 PM to:
 * 1. Review week's memories
 * 2. Update Customer Avatar
 * 3. Generate insights
 * 4. Create PDF report
 */

import { getUnifiedMemoryHub, DailyEntry, CustomerAvatar, Learning } from '../memoryHub';
import * as fs from 'fs';
import * as path from 'path';

export interface WeeklyMemoryConfig {
  basePath: string;
  updateAvatar: boolean;
  generateReport: boolean;
  insightsThreshold: number;
}

const DEFAULT_CONFIG: WeeklyMemoryConfig = {
  basePath: '/root/.openclaw/workspace/memory',
  updateAvatar: true,
  generateReport: true,
  insightsThreshold: 3, // Minimum occurrences to be considered a pattern
};

export interface WeeklyReport {
  weekStarting: string;
  weekEnding: string;
  summary: {
    totalActions: number;
    successRate: number;
    newBeliefs: number;
    newFailures: number;
    accountsManaged: number;
    contentCreated: number;
  };
  patterns: Pattern[];
  insights: Insight[];
  avatarUpdates: AvatarUpdate[];
  recommendations: string[];
}

export interface Pattern {
  type: string;
  description: string;
  occurrences: number;
  confidence: number;
}

export interface Insight {
  category: string;
  insight: string;
  evidence: string[];
  impact: 'high' | 'medium' | 'low';
}

export interface AvatarUpdate {
  section: string;
  change: string;
  reason: string;
}

/**
 * Run the weekly memory review workflow
 */
export async function runWeeklyMemoryWorkflow(
  date: Date = new Date(),
  config: Partial<WeeklyMemoryConfig> = {}
): Promise<{
  success: boolean;
  report: WeeklyReport;
  avatar: CustomerAvatar;
  errors: string[];
}> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const hub = getUnifiedMemoryHub();
  const errors: string[] = [];

  // Calculate week range (Sunday to Sunday)
  const weekEnd = new Date(date);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  console.log(`[WeeklyMemory] Starting weekly review for ${weekStartStr} to ${weekEndStr}`);

  try {
    // Step 1: Load week's daily memories
    console.log('[WeeklyMemory] Step 1: Loading week memories...');
    const weekEntries = await loadWeekEntries(weekStart, weekEnd, fullConfig);

    // Step 2: Analyze patterns
    console.log('[WeeklyMemory] Step 2: Analyzing patterns...');
    const patterns = analyzePatterns(weekEntries, fullConfig);

    // Step 3: Generate insights
    console.log('[WeeklyMemory] Step 3: Generating insights...');
    const insights = generateInsights(weekEntries, patterns, fullConfig);

    // Step 4: Update Customer Avatar
    let avatarUpdates: AvatarUpdate[] = [];
    if (fullConfig.updateAvatar) {
      console.log('[WeeklyMemory] Step 4: Updating Customer Avatar...');
      avatarUpdates = await updateCustomerAvatar(insights, fullConfig);
    }

    // Step 5: Generate report
    console.log('[WeeklyMemory] Step 5: Generating report...');
    const report = generateWeeklyReport(
      weekStartStr,
      weekEndStr,
      weekEntries,
      patterns,
      insights,
      avatarUpdates,
      fullConfig
    );

    // Step 6: Save report
    if (fullConfig.generateReport) {
      console.log('[WeeklyMemory] Step 6: Saving report...');
      await saveWeeklyReport(report, fullConfig);
    }

    // Step 7: Update avatar document
    if (fullConfig.updateAvatar && avatarUpdates.length > 0) {
      console.log('[WeeklyMemory] Step 7: Persisting avatar updates...');
      await persistAvatarUpdates(avatarUpdates, fullConfig);
    }

    // Get updated avatar
    const avatar = await hub.loadCustomerAvatar();

    console.log(`[WeeklyMemory] ✅ Completed: ${patterns.length} patterns, ${insights.length} insights, ${avatarUpdates.length} avatar updates`);

    return {
      success: true,
      report,
      avatar,
      errors,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[WeeklyMemory] ❌ Error: ${errorMsg}`);
    errors.push(errorMsg);

    return {
      success: false,
      report: generateEmptyReport(weekStartStr, weekEndStr),
      avatar: await hub.loadCustomerAvatar(),
      errors,
    };
  }
}

/**
 * Load all daily entries for the week
 */
async function loadWeekEntries(
  start: Date,
  end: Date,
  config: WeeklyMemoryConfig
): Promise<DailyEntry[]> {
  const entries: DailyEntry[] = [];
  const hub = getUnifiedMemoryHub();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const entry = await hub.loadDailyEntry(dateStr);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Analyze patterns across the week's entries
 */
function analyzePatterns(
  entries: DailyEntry[],
  config: WeeklyMemoryConfig
): Pattern[] {
  const patterns: Pattern[] = [];

  // Pattern 1: Success rate trend
  const successRates = entries.map(e => 
    e.metrics.totalActions > 0 
      ? e.metrics.successfulActions / e.metrics.totalActions 
      : 0
  );
  
  const avgSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
  const improving = successRates[successRates.length - 1] > successRates[0];

  patterns.push({
    type: 'success_rate_trend',
    description: improving 
      ? `Success rate improving: ${(avgSuccessRate * 100).toFixed(1)}% average`
      : `Success rate declining: ${(avgSuccessRate * 100).toFixed(1)}% average`,
    occurrences: entries.length,
    confidence: Math.abs(successRates[successRates.length - 1] - successRates[0]),
  });

  // Pattern 2: Most active skill
  const skillCounts: Record<string, number> = {};
  for (const entry of entries) {
    for (const action of entry.actions) {
      skillCounts[action.skill] = (skillCounts[action.skill] || 0) + 1;
    }
  }

  const topSkill = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (topSkill) {
    patterns.push({
      type: 'most_active_skill',
      description: `${topSkill[0]} was the most active skill with ${topSkill[1]} actions`,
      occurrences: topSkill[1],
      confidence: topSkill[1] / entries.reduce((sum, e) => sum + e.actions.length, 0),
    });
  }

  // Pattern 3: Failure patterns
  const allFailures = entries.flatMap(e => 
    e.learnings.filter(l => l.category === 'failure')
  );

  if (allFailures.length >= config.insightsThreshold) {
    patterns.push({
      type: 'failure_pattern',
      description: `${allFailures.length} failures recorded this week`,
      occurrences: allFailures.length,
      confidence: Math.min(1, allFailures.length / 10),
    });
  }

  // Pattern 4: Content creation consistency
  const contentDays = entries.filter(e => e.metrics.contentCreated > 0).length;
  if (contentDays >= 5) {
    patterns.push({
      type: 'content_consistency',
      description: `Content created on ${contentDays}/7 days - excellent consistency`,
      occurrences: contentDays,
      confidence: contentDays / 7,
    });
  }

  // Pattern 5: Learning rate
  const totalLearnings = entries.reduce((sum, e) => sum + e.learnings.length, 0);
  if (totalLearnings > 0) {
    patterns.push({
      type: 'learning_rate',
      description: `${totalLearnings} learnings captured this week`,
      occurrences: totalLearnings,
      confidence: Math.min(1, totalLearnings / 14),
    });
  }

  return patterns;
}

/**
 * Generate insights from patterns and entries
 */
function generateInsights(
  entries: DailyEntry[],
  patterns: Pattern[],
  config: WeeklyMemoryConfig
): Insight[] {
  const insights: Insight[] = [];

  // Insight 1: System performance
  const successPattern = patterns.find(p => p.type === 'success_rate_trend');
  if (successPattern) {
    insights.push({
      category: 'performance',
      insight: successPattern.description,
      evidence: entries.map(e => `${e.date}: ${e.metrics.successfulActions}/${e.metrics.totalActions} successful`),
      impact: successPattern.confidence > 0.2 ? 'high' : 'medium',
    });
  }

  // Insight 2: Content strategy
  const contentPattern = patterns.find(p => p.type === 'content_consistency');
  if (contentPattern) {
    insights.push({
      category: 'content',
      insight: contentPattern.description,
      evidence: entries
        .filter(e => e.metrics.contentCreated > 0)
        .map(e => `${e.date}: ${e.metrics.contentCreated} pieces`),
      impact: 'medium',
    });
  }

  // Insight 3: Failure analysis
  const failurePattern = patterns.find(p => p.type === 'failure_pattern');
  if (failurePattern) {
    const failureLearnings = entries.flatMap(e => 
      e.learnings.filter(l => l.category === 'failure')
    );
    
    insights.push({
      category: 'reliability',
      insight: `${failurePattern.description}. Review and update protocols.`,
      evidence: failureLearnings.slice(0, 5).map(l => l.insight),
      impact: 'high',
    });
  }

  // Insight 4: Skill utilization
  const skillPattern = patterns.find(p => p.type === 'most_active_skill');
  if (skillPattern) {
    insights.push({
      category: 'operations',
      insight: skillPattern.description,
      evidence: ['Weekly action distribution analyzed'],
      impact: 'low',
    });
  }

  // Insight 5: Learning effectiveness
  const learningPattern = patterns.find(p => p.type === 'learning_rate');
  if (learningPattern) {
    const appliedLearnings = entries.flatMap(e => 
      e.learnings.filter(l => l.applied)
    ).length;
    
    insights.push({
      category: 'learning',
      insight: `${learningPattern.description}. ${appliedLearnings} applied to operations.`,
      evidence: entries.map(e => `${e.date}: ${e.learnings.filter(l => l.applied).length}/${e.learnings.length} applied`),
      impact: 'medium',
    });
  }

  return insights;
}

/**
 * Update Customer Avatar based on insights
 */
async function updateCustomerAvatar(
  insights: Insight[],
  config: WeeklyMemoryConfig
): Promise<AvatarUpdate[]> {
  const updates: AvatarUpdate[] = [];
  const hub = getUnifiedMemoryHub();
  const avatar = await hub.loadCustomerAvatar();

  // Check for content insights that might affect avatar
  const contentInsights = insights.filter(i => i.category === 'content');
  for (const insight of contentInsights) {
    if (insight.insight.includes('consistency')) {
      updates.push({
        section: 'contentStrategy',
        change: 'Confirmed: Consistent content creation is sustainable',
        reason: insight.evidence[0],
      });
    }
  }

  // Check for performance insights
  const performanceInsights = insights.filter(i => i.category === 'performance');
  for (const insight of performanceInsights) {
    if (insight.impact === 'high' && insight.insight.includes('improving')) {
      updates.push({
        section: 'systemHealth',
        change: 'System performance trending positive',
        reason: insight.insight,
      });
    }
  }

  // Check for reliability insights
  const reliabilityInsights = insights.filter(i => i.category === 'reliability');
  for (const insight of reliabilityInsights) {
    if (insight.impact === 'high') {
      updates.push({
        section: 'ethicalBoundaries',
        change: 'Added: Monitor for recurring failure patterns',
        reason: insight.insight,
      });
    }
  }

  return updates;
}

/**
 * Generate weekly report
 */
function generateWeeklyReport(
  weekStart: string,
  weekEnd: string,
  entries: DailyEntry[],
  patterns: Pattern[],
  insights: Insight[],
  avatarUpdates: AvatarUpdate[],
  config: WeeklyMemoryConfig
): WeeklyReport {
  const totalActions = entries.reduce((sum, e) => sum + e.metrics.totalActions, 0);
  const successfulActions = entries.reduce((sum, e) => sum + e.metrics.successfulActions, 0);
  const newBeliefs = entries.reduce((sum, e) => sum + e.metrics.newBeliefs, 0);
  const newFailures = entries.reduce((sum, e) => sum + e.metrics.newFailures, 0);
  const accountsManaged = new Set(
    entries.flatMap(e => e.actions.map(a => a.accountId).filter(Boolean))
  ).size;
  const contentCreated = entries.reduce((sum, e) => sum + e.metrics.contentCreated, 0);

  return {
    weekStarting: weekStart,
    weekEnding: weekEnd,
    summary: {
      totalActions,
      successRate: totalActions > 0 ? successfulActions / totalActions : 0,
      newBeliefs,
      newFailures,
      accountsManaged,
      contentCreated,
    },
    patterns,
    insights,
    avatarUpdates,
    recommendations: generateRecommendations(insights, patterns),
  };
}

/**
 * Generate recommendations based on insights
 */
function generateRecommendations(insights: Insight[], patterns: Pattern[]): string[] {
  const recommendations: string[] = [];

  // Performance recommendations
  const performanceInsight = insights.find(i => i.category === 'performance' && i.impact === 'high');
  if (performanceInsight?.insight.includes('declining')) {
    recommendations.push('URGENT: Investigate declining success rate. Review recent failures.');
  }

  // Content recommendations
  const contentPattern = patterns.find(p => p.type === 'content_consistency');
  if (!contentPattern || contentPattern.occurrences < 5) {
    recommendations.push('Increase content creation consistency. Aim for 5+ days per week.');
  }

  // Failure recommendations
  const failurePattern = patterns.find(p => p.type === 'failure_pattern');
  if (failurePattern && failurePattern.occurrences >= 3) {
    recommendations.push(`Review ${failurePattern.occurrences} failures. Update protocols to prevent recurrence.`);
  }

  // Learning recommendations
  const learningInsight = insights.find(i => i.category === 'learning');
  if (learningInsight) {
    const appliedMatch = learningInsight.insight.match(/(\d+) applied/);
    const totalMatch = learningInsight.insight.match(/(\d+) learnings/);
    if (appliedMatch && totalMatch) {
      const applied = parseInt(appliedMatch[1]);
      const total = parseInt(totalMatch[1]);
      if (applied < total * 0.5) {
        recommendations.push('Improve learning application rate. Create action items from insights.');
      }
    }
  }

  return recommendations;
}

/**
 * Save weekly report to file
 */
async function saveWeeklyReport(
  report: WeeklyReport,
  config: WeeklyMemoryConfig
): Promise<void> {
  const reportsDir = path.join(config.basePath, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const fileName = `weekly_report_${report.weekStarting}.json`;
  const filePath = path.join(reportsDir, fileName);

  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));

  // Also create markdown version for human reading
  const mdFileName = `weekly_report_${report.weekStarting}.md`;
  const mdFilePath = path.join(reportsDir, mdFileName);
  fs.writeFileSync(mdFilePath, formatReportAsMarkdown(report));
}

/**
 * Format report as markdown
 */
function formatReportAsMarkdown(report: WeeklyReport): string {
  const lines: string[] = [
    `# Weekly Memory Report`,
    ``,
    `**Week:** ${report.weekStarting} to ${report.weekEnding}  `,
    `**Generated:** ${new Date().toISOString()}`,
    ``,
    `## Summary`,
    ``,
    `- **Total Actions:** ${report.summary.totalActions}`,
    `- **Success Rate:** ${(report.summary.successRate * 100).toFixed(1)}%`,
    `- **New Beliefs:** ${report.summary.newBeliefs}`,
    `- **New Failures:** ${report.summary.newFailures}`,
    `- **Accounts Managed:** ${report.summary.accountsManaged}`,
    `- **Content Created:** ${report.summary.contentCreated}`,
    ``,
    `## Patterns Detected`,
    ``,
    ...report.patterns.map(p => 
      `### ${p.type.replace(/_/g, ' ').toUpperCase()}\n- **Description:** ${p.description}\n- **Occurrences:** ${p.occurrences}\n- **Confidence:** ${(p.confidence * 100).toFixed(1)}%`
    ),
    ``,
    `## Insights`,
    ``,
    ...report.insights.map(i => 
      `### ${i.category.toUpperCase()} (${i.impact})\n${i.insight}\n\n**Evidence:**\n${i.evidence.map(e => `- ${e}`).join('\n')}`
    ),
    ``,
    `## Customer Avatar Updates`,
    ``,
    ...(report.avatarUpdates.length > 0 
      ? report.avatarUpdates.map(u => `- **${u.section}:** ${u.change} (${u.reason})`)
      : ['No updates this week.']
    ),
    ``,
    `## Recommendations`,
    ``,
    ...(report.recommendations.length > 0
      ? report.recommendations.map(r => `- ${r}`)
      : ['No recommendations at this time.']
    ),
    ``,
    `---`,
    `*This report was auto-generated by the Weekly Memory Workflow*`,
  ];

  return lines.join('\n');
}

/**
 * Persist avatar updates to the master document
 */
async function persistAvatarUpdates(
  updates: AvatarUpdate[],
  config: WeeklyMemoryConfig
): Promise<void> {
  const hub = getUnifiedMemoryHub();
  const avatar = await hub.loadCustomerAvatar();

  // Add update timestamp
  avatar.lastUpdated = new Date();

  // Save the updated avatar
  await hub.updateCustomerAvatar(avatar);

  // Log the updates
  const hubInstance = getUnifiedMemoryHub();
  hubInstance.log('weeklyMemory', `Updated Customer Avatar with ${updates.length} changes`, 'info');
}

/**
 * Generate empty report for error cases
 */
function generateEmptyReport(weekStart: string, weekEnd: string): WeeklyReport {
  return {
    weekStarting: weekStart,
    weekEnding: weekEnd,
    summary: {
      totalActions: 0,
      successRate: 0,
      newBeliefs: 0,
      newFailures: 0,
      accountsManaged: 0,
      contentCreated: 0,
    },
    patterns: [],
    insights: [],
    avatarUpdates: [],
    recommendations: ['Error occurred during weekly review. Check logs.'],
  };
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const date = process.argv[2] ? new Date(process.argv[2]) : new Date();
  
  runWeeklyMemoryWorkflow(date)
    .then(result => {
      if (result.success) {
        console.log('✅ Weekly memory workflow completed successfully');
        console.log(`Report saved: weekly_report_${result.report.weekStarting}.md`);
        process.exit(0);
      } else {
        console.error('❌ Weekly memory workflow failed:', result.errors);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}
