/**
 * Daily Memory Workflow
 * 
 * Runs daily at 11 PM to:
 * 1. Compile all daily actions
 * 2. Generate /memory/YYYY-MM-DD.md
 * 3. Update Context Persistence
 * 4. Extract learnings
 * 5. Update beliefs
 */

import { getUnifiedMemoryHub, DailyEntry, Learning, Belief, Failure } from '../memoryHub';
import * as fs from 'fs';
import * as path from 'path';

export interface DailyMemoryConfig {
  basePath: string;
  extractLearnings: boolean;
  updateBeliefs: boolean;
  minConfidenceForBelief: number;
}

const DEFAULT_CONFIG: DailyMemoryConfig = {
  basePath: '/root/.openclaw/workspace/memory',
  extractLearnings: true,
  updateBeliefs: true,
  minConfidenceForBelief: 0.7,
};

/**
 * Run the daily memory compilation workflow
 */
export async function runDailyMemoryWorkflow(
  date: Date = new Date(),
  config: Partial<DailyMemoryConfig> = {}
): Promise<{
  success: boolean;
  entry: DailyEntry;
  learnings: Learning[];
  newBeliefs: Belief[];
  errors: string[];
}> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const hub = getUnifiedMemoryHub();
  const errors: string[] = [];
  const newBeliefs: Belief[] = [];

  console.log(`[DailyMemory] Starting daily compilation for ${date.toISOString().split('T')[0]}`);

  try {
    // Step 1: Generate daily entry from all actions
    console.log('[DailyMemory] Step 1: Compiling actions...');
    const entry = await hub.generateDailyMemory(date);

    // Step 2: Extract learnings from the day's activities
    console.log('[DailyMemory] Step 2: Extracting learnings...');
    const learnings = await extractLearnings(entry, fullConfig);
    entry.learnings.push(...learnings);

    // Step 3: Update beliefs based on new learnings
    if (fullConfig.updateBeliefs) {
      console.log('[DailyMemory] Step 3: Updating beliefs...');
      const beliefs = await updateBeliefs(learnings, fullConfig);
      newBeliefs.push(...beliefs);
    }

    // Step 4: Save daily memory file
    console.log('[DailyMemory] Step 4: Saving daily memory...');
    await hub.saveDailyMemory(entry);

    // Step 5: Update context persistence
    console.log('[DailyMemory] Step 5: Updating context...');
    await updateContextPersistence(entry, fullConfig);

    // Step 6: Log completion
    console.log('[DailyMemory] Step 6: Logging completion...');
    hub.log('dailyMemory', `Daily memory compiled for ${entry.date}`, 'info');

    console.log(`[DailyMemory] ✅ Completed: ${entry.actions.length} actions, ${entry.learnings.length} learnings, ${newBeliefs.length} new beliefs`);

    return {
      success: true,
      entry,
      learnings,
      newBeliefs,
      errors,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[DailyMemory] ❌ Error: ${errorMsg}`);
    errors.push(errorMsg);
    
    return {
      success: false,
      entry: await hub.generateDailyMemory(date),
      learnings: [],
      newBeliefs: [],
      errors,
    };
  }
}

/**
 * Extract learnings from the day's activities
 */
async function extractLearnings(
  entry: DailyEntry,
  config: DailyMemoryConfig
): Promise<Learning[]> {
  const learnings: Learning[] = [];

  // Analyze failures for lessons
  const failures = entry.learnings.filter(l => l.category === 'failure');
  for (const failure of failures) {
    // Check if we've seen this failure pattern before
    const hub = getUnifiedMemoryHub();
    const existingFailures = await hub.loadFailures();
    const similarFailures = existingFailures.filter(f => 
      f.lesson === failure.insight.split('Lesson: ')[1]
    );

    if (similarFailures.length >= 2) {
      // This is a recurring pattern - create a learning
      learnings.push({
        id: `pattern_${Date.now()}`,
        timestamp: new Date(),
        insight: `Recurring pattern detected: ${failure.insight}. Consider updating protocols.`,
        source: 'pattern_analysis',
        category: 'system_improvement',
        applied: false,
      });
    }
  }

  // Analyze successful actions for best practices
  const successfulActions = entry.actions.filter(a => a.success);
  const highImpactActions = successfulActions.filter(a => {
    // Actions that took significant time or had complex outputs
    return (a.duration && a.duration > 60000) || 
           (a.output && JSON.stringify(a.output).length > 500);
  });

  for (const action of highImpactActions) {
    learnings.push({
      id: `bestpractice_${Date.now()}_${action.id}`,
      timestamp: new Date(),
      insight: `High-impact action: ${action.skill}.${action.action} completed successfully`,
      source: 'success_analysis',
      category: 'best_practice',
      applied: false,
    });
  }

  // Extract content performance insights
  const contentActions = entry.actions.filter(a => 
    a.action.includes('content') || 
    a.action.includes('post') ||
    a.action.includes('caption')
  );

  if (contentActions.length > 0) {
    learnings.push({
      id: `content_${Date.now()}`,
      timestamp: new Date(),
      insight: `Created ${contentActions.length} content pieces today`,
      source: 'content_summary',
      category: 'content',
      applied: true,
    });
  }

  return learnings;
}

/**
 * Update beliefs based on new learnings
 */
async function updateBeliefs(
  learnings: Learning[],
  config: DailyMemoryConfig
): Promise<Belief[]> {
  const newBeliefs: Belief[] = [];
  const hub = getUnifiedMemoryHub();
  const existingBeliefs = await hub.loadBeliefs();

  for (const learning of learnings) {
    // Check if this learning contradicts or reinforces existing beliefs
    for (const belief of existingBeliefs) {
      const similarity = calculateSimilarity(learning.insight, belief.statement);
      
      if (similarity > 0.8) {
        // Reinforces existing belief
        belief.confidence = Math.min(1, belief.confidence + 0.1);
        belief.lastReinforced = new Date();
        belief.evidence.push(learning.insight);
      } else if (similarity > 0.5 && similarity < 0.7) {
        // Potential contradiction
        belief.contradictions++;
        if (belief.contradictions >= 3) {
          // Belief is being challenged
          belief.confidence = Math.max(0, belief.confidence - 0.2);
        }
      }
    }

    // Create new beliefs from high-confidence learnings
    if (learning.category === 'pattern_analysis' || 
        (learning.category === 'best_practice' && learning.insight.includes('success'))) {
      
      const beliefStatement = extractBeliefStatement(learning.insight);
      const isDuplicate = existingBeliefs.some(b => 
        calculateSimilarity(b.statement, beliefStatement) > 0.9
      );

      if (!isDuplicate) {
        const belief = await hub.addBelief({
          statement: beliefStatement,
          confidence: config.minConfidenceForBelief,
          evidence: [learning.insight],
          lastReinforced: new Date(),
          contradictions: 0,
        });
        newBeliefs.push(belief);
      }
    }
  }

  await hub.saveBeliefs(existingBeliefs);
  return newBeliefs;
}

/**
 * Update context persistence files
 */
async function updateContextPersistence(
  entry: DailyEntry,
  config: DailyMemoryConfig
): Promise<void> {
  const contextDir = path.join(config.basePath, 'context');
  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }

  // Update daily context summary
  const contextPath = path.join(contextDir, 'daily_context.json');
  const context = {
    lastUpdated: new Date().toISOString(),
    lastDate: entry.date,
    totalActions: entry.metrics.totalActions,
    successRate: entry.metrics.totalActions > 0 
      ? entry.metrics.successfulActions / entry.metrics.totalActions 
      : 0,
    recentLearnings: entry.learnings.slice(-5).map(l => l.insight),
  };

  fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));

  // Update action history for quick lookup
  const historyPath = path.join(contextDir, 'action_history.json');
  const history = {
    lastUpdated: new Date().toISOString(),
    recentActions: entry.actions.slice(-20).map(a => ({
      skill: a.skill,
      action: a.action,
      success: a.success,
      timestamp: a.timestamp,
    })),
  };

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

/**
 * Calculate similarity between two strings (simple implementation)
 */
function calculateSimilarity(a: string, b: string): number {
  const aWords = new Set(a.toLowerCase().split(/\s+/));
  const bWords = new Set(b.toLowerCase().split(/\s+/));
  
  const intersection = new Set(Array.from(aWords).filter(x => bWords.has(x)));
  const union = new Set(Array.from(aWords).concat(Array.from(bWords)));
  
  return intersection.size / union.size;
}

/**
 * Extract a belief statement from a learning insight
 */
function extractBeliefStatement(insight: string): string {
  // Remove prefixes and clean up
  let statement = insight
    .replace(/^Recurring pattern detected: /, '')
    .replace(/^High-impact action: /, '')
    .replace(/completed successfully$/, 'is effective')
    .replace(/Consider updating protocols\.$/, '');

  // Capitalize first letter
  statement = statement.charAt(0).toUpperCase() + statement.slice(1);

  return statement.trim();
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const date = process.argv[2] ? new Date(process.argv[2]) : new Date();
  
  runDailyMemoryWorkflow(date)
    .then(result => {
      if (result.success) {
        console.log('✅ Daily memory workflow completed successfully');
        process.exit(0);
      } else {
        console.error('❌ Daily memory workflow failed:', result.errors);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}
