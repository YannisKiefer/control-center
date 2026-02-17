/**
 * Unified Memory System
 * 
 * Central hub integrating ALL memory sources:
 * - Context Persistence (short/medium/long-term, beliefs, failures)
 * - Daily Memory Files (/memory/YYYY-MM-DD.md)
 * - Customer Avatar Memory (/memory/CUSTOMER_AVATAR_MASTER.md)
 * - Account-Specific Memory (/memory/accounts/)
 * - System Memory (/memory/system/)
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// INTERFACES
// ============================================================================

export interface AgentMemory {
  shortTerm: ActionEntry[];      // 24h
  mediumTerm: ActionEntry[];     // 7d
  longTerm: ActionEntry[];       // Forever
  beliefs: Belief[];
  failures: Failure[];
}

export interface DailyMemory {
  today: DailyEntry;
  yesterday: DailyEntry | null;
  lastWeek: DailyEntry[];
  history: Map<string, DailyEntry>;
}

export interface DailyEntry {
  date: string;
  actions: ActionEntry[];
  learnings: Learning[];
  metrics: DailyMetrics;
  summary: string;
}

export interface CustomerAvatar {
  modelProfile: ModelProfile;
  archetypes: CustomerArchetype[];
  contentStrategy: ContentStrategy;
  dmScripts: DMScripts;
  visualGuidelines: VisualGuidelines;
  ethicalBoundaries: EthicalBoundaries;
  lastUpdated: Date;
}

export interface AccountMemory {
  accountId: string;
  dailyMetrics: AccountMetrics[];
  abTests: ABTest[];
  learnings: AccountLearning[];
  contentHistory: ContentEntry[];
  dmHistory: DMEntry[];
  healthStatus: HealthStatus;
}

export interface SystemMemory {
  cronHistory: CronEntry[];
  errorLogs: ErrorEntry[];
  performanceTrends: PerformanceEntry[];
  skillStatuses: Map<string, SkillStatus>;
  lastMaintenance: Date;
}

export interface UnifiedMemory {
  context: AgentMemory;
  daily: DailyMemory;
  avatar: CustomerAvatar;
  accounts: Map<string, AccountMemory>;
  system: SystemMemory;
  loadedAt: Date;
  agentId: string;
}

// Supporting interfaces
export interface MemoryEntry {
  id: string;
  timestamp: Date;
  source: string;
  type: 'file' | 'database' | 'cache' | 'log' | 'action' | 'learning';
  key: string;
  data: any;
  metadata: {
    size?: number;
    format?: string;
    tags?: string[];
    ttl?: number;
  };
}

export interface Belief {
  id: string;
  statement: string;
  confidence: number; // 0-1
  evidence: string[];
  formedAt: Date;
  lastReinforced: Date;
  contradictions: number;
}

export interface Failure {
  id: string;
  description: string;
  context: string;
  lesson: string;
  occurredAt: Date;
  category: 'technical' | 'strategic' | 'communication' | 'safety';
  resolved: boolean;
  prevention: string;
}

export interface ActionEntry {
  id: string;
  timestamp: Date;
  skill: string;
  action: string;
  input?: any;
  output?: any;
  success: boolean;
  duration?: number;
  accountId?: string;
}

export interface Learning {
  id: string;
  timestamp: Date;
  insight: string;
  source: string;
  category: string;
  applied: boolean;
}

export interface DailyMetrics {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  newBeliefs: number;
  newFailures: number;
  accountsManaged: number;
  contentCreated: number;
  engagementRate: number;
}

export interface ModelProfile {
  name: string;
  type: string;
  look: string;
  keyElement: string;
  setting: string;
  style: string;
  vibe: string;
  niche: string;
}

export interface CustomerArchetype {
  name: string;
  percentage: string;
  psychology: string;
  triggers: string[];
  messaging: string;
  spending: string;
}

export interface ContentStrategy {
  wheelchairBalance: string;
  accidentallySexyFramework: string[];
  innocenceVulnerabilitySpectrum: {
    innocence: number;
    vulnerability: number;
    desire: number;
  };
}

export interface DMScripts {
  openingHooks: Record<string, string>;
  relationshipBuilding: Record<string, string>;
  keyAngle: string;
}

export interface VisualGuidelines {
  colors: string[];
  setting: string[];
  clothing: string[];
}

export interface EthicalBoundaries {
  never: string[];
  always: string[];
  redFlags: string[];
  safetyProtocols: string[];
}

export interface AccountMetrics {
  date: string;
  followers: number;
  following: number;
  posts: number;
  engagement: number;
  dmsSent: number;
  dmsReplied: number;
  conversions: number;
  revenue: number;
  spamScore: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export interface ABTest {
  id: string;
  name: string;
  variantA: string;
  variantB: string;
  startDate: string;
  endDate?: string;
  winner?: string;
  improvement?: number;
}

export interface AccountLearning {
  id: string;
  date: string;
  insight: string;
  impact: 'high' | 'medium' | 'low';
  applied: boolean;
}

export interface ContentEntry {
  id: string;
  date: string;
  type: string;
  content: string;
  engagement: number;
  viral: boolean;
}

export interface DMEntry {
  id: string;
  date: string;
  fanId: string;
  stage: string;
  messageCount: number;
  converted: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  lastCheck: Date;
  issues: string[];
  spamScore: number;
  daysSinceCreation: number;
  warmupPhase: string;
}

export interface CronEntry {
  id: string;
  timestamp: Date;
  jobName: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

export interface ErrorEntry {
  id: string;
  timestamp: Date;
  source: string;
  error: string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolution?: string;
}

export interface PerformanceEntry {
  timestamp: Date;
  metric: string;
  value: number;
  unit: string;
}

export interface SkillStatus {
  skillId: string;
  status: 'healthy' | 'warning' | 'error' | 'offline';
  lastHeartbeat: Date;
  actionCount: number;
  errorCount: number;
}

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
  highlights: string[];
}

export interface AgentContext {
  yesterday: DailyEntry | null;
  lastWeek: DailyEntry[];
  avatar: CustomerAvatar;
  beliefs: Belief[];
  failures: Failure[];
  recentActions: ActionEntry[];
}

// ============================================================================
// UNIFIED MEMORY HUB
// ============================================================================

export class UnifiedMemoryHub extends EventEmitter {
  private entries: MemoryEntry[] = [];
  private basePath: string;
  private maxEntries: number = 50000;
  private unifiedCache: Map<string, UnifiedMemory> = new Map();

  constructor(basePath: string = '/root/.openclaw/workspace/memory') {
    super();
    this.basePath = basePath;
    this.ensureDirectories();
  }

  // ========================================================================
  // UNIFIED MEMORY LOADING
  // ========================================================================

  /**
   * Load unified memory for an agent
   * This is the main entry point - call this on every agent start
   */
  async loadUnified(agentId: string): Promise<UnifiedMemory> {
    const cached = this.unifiedCache.get(agentId);
    if (cached && Date.now() - cached.loadedAt.getTime() < 60000) {
      return cached; // Return cached if less than 1 minute old
    }

    const unified: UnifiedMemory = {
      context: await this.loadAgentMemory(),
      daily: await this.loadDailyMemory(),
      avatar: await this.loadCustomerAvatar(),
      accounts: await this.loadAllAccounts(),
      system: await this.loadSystemMemory(),
      loadedAt: new Date(),
      agentId,
    };

    this.unifiedCache.set(agentId, unified);
    this.emit('unifiedLoaded', { agentId, timestamp: unified.loadedAt });
    
    return unified;
  }

  /**
   * Get agent context for injection
   * Use this to populate agent.context on start
   */
  async getAgentContext(agentId: string): Promise<AgentContext> {
    const unified = await this.loadUnified(agentId);
    
    return {
      yesterday: unified.daily.yesterday,
      lastWeek: unified.daily.lastWeek,
      avatar: unified.avatar,
      beliefs: unified.context.beliefs,
      failures: unified.context.failures,
      recentActions: unified.context.shortTerm.slice(0, 50),
    };
  }

  // ========================================================================
  // AGENT MEMORY (Context Persistence)
  // ========================================================================

  async loadAgentMemory(): Promise<AgentMemory> {
    const memory: AgentMemory = {
      shortTerm: this.getEntriesSince(hoursAgo(24)).map(e => this.toActionEntry(e)),
      mediumTerm: this.getEntriesBetween(hoursAgo(24 * 7), hoursAgo(24)).map(e => this.toActionEntry(e)),
      longTerm: this.getEntriesBefore(hoursAgo(24 * 7)).map(e => this.toActionEntry(e)),
      beliefs: await this.loadBeliefs(),
      failures: await this.loadFailures(),
    };

    return memory;
  }

  /**
   * Convert MemoryEntry to ActionEntry
   */
  private toActionEntry(entry: MemoryEntry): ActionEntry {
    return {
      id: entry.id,
      timestamp: entry.timestamp,
      skill: entry.source,
      action: entry.key,
      input: entry.data?.input,
      output: entry.data?.output,
      success: entry.data?.success ?? true,
      duration: entry.data?.duration,
      accountId: entry.data?.accountId,
    };
  }

  async loadBeliefs(): Promise<Belief[]> {
    const filePath = path.join(this.basePath, 'context', 'beliefs.json');
    if (!fs.existsSync(filePath)) return [];
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data.beliefs || [];
    } catch {
      return [];
    }
  }

  async saveBeliefs(beliefs: Belief[]): Promise<void> {
    const dir = path.join(this.basePath, 'context');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(
      path.join(dir, 'beliefs.json'),
      JSON.stringify({ beliefs, updatedAt: new Date().toISOString() }, null, 2)
    );
  }

  async addBelief(belief: Omit<Belief, 'id' | 'formedAt'>): Promise<Belief> {
    const beliefs = await this.loadBeliefs();
    const newBelief: Belief = {
      ...belief,
      id: generateId(),
      formedAt: new Date(),
    };
    beliefs.push(newBelief);
    await this.saveBeliefs(beliefs);
    this.emit('beliefAdded', newBelief);
    return newBelief;
  }

  async loadFailures(): Promise<Failure[]> {
    const filePath = path.join(this.basePath, 'context', 'failures.json');
    if (!fs.existsSync(filePath)) return [];
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data.failures || [];
    } catch {
      return [];
    }
  }

  async saveFailures(failures: Failure[]): Promise<void> {
    const dir = path.join(this.basePath, 'context');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(
      path.join(dir, 'failures.json'),
      JSON.stringify({ failures, updatedAt: new Date().toISOString() }, null, 2)
    );
  }

  async addFailure(failure: Omit<Failure, 'id' | 'occurredAt'>): Promise<Failure> {
    const failures = await this.loadFailures();
    const newFailure: Failure = {
      ...failure,
      id: generateId(),
      occurredAt: new Date(),
    };
    failures.push(newFailure);
    await this.saveFailures(failures);
    this.emit('failureAdded', newFailure);
    return newFailure;
  }

  // ========================================================================
  // DAILY MEMORY
  // ========================================================================

  async loadDailyMemory(): Promise<DailyMemory> {
    const today = formatDate(new Date());
    const yesterday = formatDate(daysAgo(1));
    
    const daily: DailyMemory = {
      today: await this.loadDailyEntry(today) || this.createEmptyDailyEntry(today),
      yesterday: await this.loadDailyEntry(yesterday),
      lastWeek: [],
      history: new Map(),
    };

    // Load last 7 days
    for (let i = 2; i <= 7; i++) {
      const entry = await this.loadDailyEntry(formatDate(daysAgo(i)));
      if (entry) daily.lastWeek.push(entry);
    }

    return daily;
  }

  /**
   * Create an empty daily entry
   */
  private createEmptyDailyEntry(date: string): DailyEntry {
    return {
      date,
      actions: [],
      learnings: [],
      metrics: {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        newBeliefs: 0,
        newFailures: 0,
        accountsManaged: 0,
        contentCreated: 0,
        engagementRate: 0,
      },
      summary: '',
    };
  }

  async loadDailyEntry(date: string): Promise<DailyEntry | null> {
    const filePath = path.join(this.basePath, `${date}.md`);
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseDailyMarkdown(date, content);
  }

  parseDailyMarkdown(date: string, content: string): DailyEntry {
    // Parse the markdown structure
    const entry: DailyEntry = {
      date,
      actions: [],
      learnings: [],
      metrics: {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        newBeliefs: 0,
        newFailures: 0,
        accountsManaged: 0,
        contentCreated: 0,
        engagementRate: 0,
      },
      summary: '',
    };

    // Extract actions
    const actionMatch = content.match(/## Actions[\s\S]*?(?=##|$)/);
    if (actionMatch) {
      const actionLines = actionMatch[0].split('\n').filter(l => l.startsWith('- '));
      entry.actions = actionLines.map(line => ({
        id: generateId(),
        timestamp: new Date(),
        skill: 'unknown',
        action: line.replace('- ', ''),
        success: true,
      }));
    }

    // Extract learnings
    const learningMatch = content.match(/## Learnings[\s\S]*?(?=##|$)/);
    if (learningMatch) {
      const learningLines = learningMatch[0].split('\n').filter(l => l.startsWith('- '));
      entry.learnings = learningLines.map((line, i) => ({
        id: `learn_${date}_${i}`,
        timestamp: new Date(),
        insight: line.replace('- ', ''),
        source: 'daily_notes',
        category: 'general',
        applied: false,
      }));
    }

    // Extract summary
    const summaryMatch = content.match(/## Summary[\s\S]*?(?=##|$)/);
    if (summaryMatch) {
      entry.summary = summaryMatch[0].replace('## Summary', '').trim();
    }

    entry.metrics.totalActions = entry.actions.length;
    (entry.metrics as any).newLearnings = entry.learnings.length;

    return entry;
  }

  async generateDailyMemory(date: Date = new Date()): Promise<DailyEntry> {
    const dateStr = formatDate(date);
    const yesterday = formatDate(daysAgo(1, date));
    
    // Get all actions from today
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const todayActions = this.entries.filter(e => 
      e.timestamp >= startOfDay && e.timestamp <= endOfDay
    );

    // Get learnings from beliefs and failures
    const beliefs = await this.loadBeliefs();
    const failures = await this.loadFailures();
    
    const todayBeliefs = beliefs.filter(b => 
      formatDate(b.formedAt) === dateStr
    );
    
    const todayFailures = failures.filter(f => 
      formatDate(f.occurredAt) === dateStr
    );

    const entry: DailyEntry = {
      date: dateStr,
      actions: todayActions.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        skill: e.source,
        action: e.key,
        input: e.data?.input,
        output: e.data?.output,
        success: e.data?.success ?? true,
        duration: e.data?.duration,
        accountId: e.data?.accountId,
      })),
      learnings: [
        ...todayBeliefs.map(b => ({
          id: b.id,
          timestamp: b.formedAt,
          insight: `Belief: ${b.statement} (confidence: ${b.confidence})`,
          source: 'belief_formation',
          category: 'belief',
          applied: true,
        })),
        ...todayFailures.map(f => ({
          id: f.id,
          timestamp: f.occurredAt,
          insight: `Failure: ${f.description} - Lesson: ${f.lesson}`,
          source: 'failure_analysis',
          category: 'failure',
          applied: f.resolved,
        })),
      ],
      metrics: {
        totalActions: todayActions.length,
        successfulActions: todayActions.filter(e => e.data?.success !== false).length,
        failedActions: todayActions.filter(e => e.data?.success === false).length,
        newBeliefs: todayBeliefs.length,
        newFailures: todayFailures.length,
        accountsManaged: new Set(todayActions.map(e => e.data?.accountId).filter(Boolean)).size,
        contentCreated: todayActions.filter(e => e.key.includes('content') || e.key.includes('post')).length,
        engagementRate: 0, // Calculated from account metrics
      },
      summary: '',
    };

    // Generate AI summary if we have actions
    if (entry.actions.length > 0) {
      entry.summary = this.generateDailySummary(entry);
    }

    return entry;
  }

  generateDailySummary(entry: DailyEntry): string {
    const parts: string[] = [];
    
    if (entry.actions.length > 0) {
      parts.push(`Completed ${entry.actions.length} actions`);
    }
    if (entry.learnings.length > 0) {
      parts.push(`Learned ${entry.learnings.length} new insights`);
    }
    if (entry.metrics.newBeliefs > 0) {
      parts.push(`Formed ${entry.metrics.newBeliefs} new beliefs`);
    }
    if (entry.metrics.newFailures > 0) {
      parts.push(`Recorded ${entry.metrics.newFailures} failures with lessons`);
    }

    return parts.join('. ') + '.';
  }

  async saveDailyMemory(entry: DailyEntry): Promise<void> {
    const filePath = path.join(this.basePath, `${entry.date}.md`);
    const content = this.formatDailyMarkdown(entry);
    fs.writeFileSync(filePath, content);
    this.emit('dailySaved', entry);
  }

  formatDailyMarkdown(entry: DailyEntry): string {
    const lines: string[] = [
      `# Memory Log - ${entry.date}`,
      '',
      '## Summary',
      entry.summary || 'No significant activity recorded.',
      '',
      '## Metrics',
      `- Total Actions: ${entry.metrics.totalActions}`,
      `- Successful: ${entry.metrics.successfulActions}`,
      `- Failed: ${entry.metrics.failedActions}`,
      `- New Beliefs: ${entry.metrics.newBeliefs}`,
      `- New Failures: ${entry.metrics.newFailures}`,
      `- Accounts Managed: ${entry.metrics.accountsManaged}`,
      `- Content Created: ${entry.metrics.contentCreated}`,
      '',
      '## Actions',
      ...entry.actions.map(a => `- [${a.success ? '✓' : '✗'}] ${a.skill}: ${a.action}`),
      '',
      '## Learnings',
      ...entry.learnings.map(l => `- ${l.insight}`),
      '',
      '---',
      `Generated at: ${new Date().toISOString()}`,
    ];

    return lines.join('\n');
  }

  // ========================================================================
  // CUSTOMER AVATAR MEMORY
  // ========================================================================

  async loadCustomerAvatar(): Promise<CustomerAvatar> {
    const filePath = path.join(this.basePath, 'CUSTOMER_AVATAR_MASTER.md');
    
    if (!fs.existsSync(filePath)) {
      // Return default structure
      return this.getDefaultCustomerAvatar();
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseCustomerAvatarMarkdown(content);
  }

  getDefaultCustomerAvatar(): CustomerAvatar {
    return {
      modelProfile: {
        name: 'Ella Sophie',
        type: 'Young blonde woman (18+)',
        look: 'Perfect body, attractive, innocent face',
        keyElement: 'Wheelchair user (disabled)',
        setting: "Girl's bedroom (teddy bear, pastel colors, youthful decor)",
        style: 'Crop tops, tight clothing, mirror selfies',
        vibe: '"Innocent disabled angel", unaware of her effect',
        niche: '"Disabled girl next door discovering her sexuality"',
      },
      archetypes: [
        {
          name: 'White Knight',
          percentage: '40-50%',
          psychology: 'Needs to rescue, save, protect',
          triggers: ['Vulnerability', 'gratitude', 'dependency'],
          messaging: "I don't know what I'd do without you",
          spending: 'Consistent, emotional purchases',
        },
        {
          name: 'Devotee',
          percentage: '20-30%',
          psychology: 'Disability appreciation fetish',
          triggers: ['Wheelchair presence', 'overcoming adversity'],
          messaging: "I've never been with someone like you",
          spending: 'High, dedicated followers',
        },
      ],
      contentStrategy: {
        wheelchairBalance: 'Present but NOT central',
        accidentallySexyFramework: [
          'Crop top while doing normal activities',
          'Bending over "unintentionally"',
          '"Didn\'t realize this angle shows..."',
        ],
        innocenceVulnerabilitySpectrum: {
          innocence: 60,
          vulnerability: 30,
          desire: 10,
        },
      },
      dmScripts: {
        openingHooks: {
          whiteKnight: "Hey, I don't usually message first but you seem really sweet... I get lonely sometimes in my village 😔",
          devotee: 'Hi! I saw you liked my post. Not many people are nice to me because of my... situation. Thank you 💕',
        },
        relationshipBuilding: {
          week1: "You're so different from other guys... you actually listen",
          week3: "I don't tell many people this but... I feel like I can trust you",
          week5: 'I made something special just for you... but its private 🙈',
        },
        keyAngle: 'Most people just see the wheelchair... but you see ME.',
      },
      visualGuidelines: {
        colors: ['White', 'soft pink', 'pastel blue', 'lavender'],
        setting: ['Teddy bears', 'heart decorations', 'soft lighting'],
        clothing: ['Crop tops', 'tight leggings', 'lingerie (PPV only)'],
      },
      ethicalBoundaries: {
        never: ['Fake helplessness', 'Exploit disability for pity', 'Promise things you won\'t deliver'],
        always: ['Show strength and overcoming', 'Maintain clear boundaries', 'Protect mental health'],
        redFlags: ['Location seeking', 'Extreme savior complex', 'Entitlement', 'Stalking behavior'],
        safetyProtocols: ['Never share real location', 'Use stage name only', 'VPN for all logins'],
      },
      lastUpdated: new Date(),
    };
  }

  parseCustomerAvatarMarkdown(content: string): CustomerAvatar {
    // Parse the markdown to extract structured data
    const avatar = this.getDefaultCustomerAvatar();
    
    // Extract last updated
    const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\* (.+)/);
    if (lastUpdatedMatch) {
      avatar.lastUpdated = new Date(lastUpdatedMatch[1]);
    }

    // This is a simplified parser - in production, use a proper markdown parser
    return avatar;
  }

  async updateCustomerAvatar(updates: Partial<CustomerAvatar>): Promise<CustomerAvatar> {
    const current = await this.loadCustomerAvatar();
    const updated = { ...current, ...updates, lastUpdated: new Date() };
    
    // Save back to markdown
    const content = this.formatCustomerAvatarMarkdown(updated);
    fs.writeFileSync(path.join(this.basePath, 'CUSTOMER_AVATAR_MASTER.md'), content);
    
    this.emit('avatarUpdated', updated);
    return updated;
  }

  formatCustomerAvatarMarkdown(avatar: CustomerAvatar): string {
    // Format the avatar back to markdown
    return `# CUSTOMER AVATAR MASTER DOCUMENT
## OnlyFans Model: Disabled Angel Niche

**Last Updated:** ${avatar.lastUpdated.toISOString().split('T')[0]}  
**Status:** ACTIVE - All Sub-Agents Must Reference This

---

## MODEL PROFILE
- **Type:** ${avatar.modelProfile.type}
- **Look:** ${avatar.modelProfile.look}
- **Key Element:** ${avatar.modelProfile.keyElement}
- **Setting:** ${avatar.modelProfile.setting}
- **Style:** ${avatar.modelProfile.style}
- **Vibe:** ${avatar.modelProfile.vibe}
- **Niche:** ${avatar.modelProfile.niche}

---

## CUSTOMER ARCHETYPES

${avatar.archetypes.map(a => `
### ${a.name.toUpperCase()} (${a.percentage})
**Psychology:** ${a.psychology}  
**Triggers:** ${a.triggers.join(', ')}  
**Messaging:** "${a.messaging}"  
**Spending:** ${a.spending}
`).join('\n')}

---

*This document is LIVING - update as we learn*
`;
  }

  // ========================================================================
  // ACCOUNT-SPECIFIC MEMORY
  // ========================================================================

  async loadAllAccounts(): Promise<Map<string, AccountMemory>> {
    const accountsDir = path.join(this.basePath, 'accounts');
    const accounts = new Map<string, AccountMemory>();

    if (!fs.existsSync(accountsDir)) {
      fs.mkdirSync(accountsDir, { recursive: true });
      return accounts;
    }

    const entries = fs.readdirSync(accountsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const account = await this.loadAccount(entry.name);
        if (account) accounts.set(entry.name, account);
      }
    }

    return accounts;
  }

  async loadAccount(accountId: string): Promise<AccountMemory | null> {
    const accountDir = path.join(this.basePath, 'accounts', accountId);
    if (!fs.existsSync(accountDir)) return null;

    const account: AccountMemory = {
      accountId,
      dailyMetrics: [],
      abTests: [],
      learnings: [],
      contentHistory: [],
      dmHistory: [],
      healthStatus: {
        status: 'healthy',
        lastCheck: new Date(),
        issues: [],
        spamScore: 0,
        daysSinceCreation: 0,
        warmupPhase: '1-7',
      },
    };

    // Load metrics
    const metricsPath = path.join(accountDir, 'metrics.json');
    if (fs.existsSync(metricsPath)) {
      account.dailyMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    }

    // Load AB tests
    const abTestsPath = path.join(accountDir, 'ab_tests.json');
    if (fs.existsSync(abTestsPath)) {
      account.abTests = JSON.parse(fs.readFileSync(abTestsPath, 'utf-8'));
    }

    // Load learnings
    const learningsPath = path.join(accountDir, 'learnings.json');
    if (fs.existsSync(learningsPath)) {
      account.learnings = JSON.parse(fs.readFileSync(learningsPath, 'utf-8'));
    }

    // Load health status
    const healthPath = path.join(accountDir, 'health.json');
    if (fs.existsSync(healthPath)) {
      account.healthStatus = JSON.parse(fs.readFileSync(healthPath, 'utf-8'));
    }

    return account;
  }

  async saveAccount(account: AccountMemory): Promise<void> {
    const accountDir = path.join(this.basePath, 'accounts', account.accountId);
    if (!fs.existsSync(accountDir)) {
      fs.mkdirSync(accountDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(accountDir, 'metrics.json'),
      JSON.stringify(account.dailyMetrics, null, 2)
    );
    fs.writeFileSync(
      path.join(accountDir, 'ab_tests.json'),
      JSON.stringify(account.abTests, null, 2)
    );
    fs.writeFileSync(
      path.join(accountDir, 'learnings.json'),
      JSON.stringify(account.learnings, null, 2)
    );
    fs.writeFileSync(
      path.join(accountDir, 'health.json'),
      JSON.stringify(account.healthStatus, null, 2)
    );

    this.emit('accountSaved', account);
  }

  async updateAccountMetrics(accountId: string, metrics: AccountMetrics): Promise<void> {
    const account = await this.loadAccount(accountId) || {
      accountId,
      dailyMetrics: [],
      abTests: [],
      learnings: [],
      contentHistory: [],
      dmHistory: [],
      healthStatus: {
        status: 'healthy',
        lastCheck: new Date(),
        issues: [],
        spamScore: 0,
        daysSinceCreation: 0,
        warmupPhase: '1-7',
      },
    };

    // Add or update metrics for this date
    const existingIndex = account.dailyMetrics.findIndex(m => m.date === metrics.date);
    if (existingIndex >= 0) {
      account.dailyMetrics[existingIndex] = metrics;
    } else {
      account.dailyMetrics.push(metrics);
    }

    await this.saveAccount(account);
  }

  // ========================================================================
  // SYSTEM MEMORY
  // ========================================================================

  async loadSystemMemory(): Promise<SystemMemory> {
    const systemDir = path.join(this.basePath, 'system');
    if (!fs.existsSync(systemDir)) {
      fs.mkdirSync(systemDir, { recursive: true });
    }

    const system: SystemMemory = {
      cronHistory: [],
      errorLogs: [],
      performanceTrends: [],
      skillStatuses: new Map(),
      lastMaintenance: new Date(),
    };

    // Load cron history
    const cronPath = path.join(systemDir, 'cron_history.json');
    if (fs.existsSync(cronPath)) {
      system.cronHistory = JSON.parse(fs.readFileSync(cronPath, 'utf-8'));
    }

    // Load error logs
    const errorsPath = path.join(systemDir, 'error_logs.json');
    if (fs.existsSync(errorsPath)) {
      system.errorLogs = JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));
    }

    // Load performance trends
    const perfPath = path.join(systemDir, 'performance.json');
    if (fs.existsSync(perfPath)) {
      system.performanceTrends = JSON.parse(fs.readFileSync(perfPath, 'utf-8'));
    }

    // Load skill statuses
    const skillsPath = path.join(systemDir, 'skill_statuses.json');
    if (fs.existsSync(skillsPath)) {
      const statuses = JSON.parse(fs.readFileSync(skillsPath, 'utf-8'));
      system.skillStatuses = new Map(Object.entries(statuses));
    }

    // Load last maintenance
    const maintPath = path.join(systemDir, 'last_maintenance.txt');
    if (fs.existsSync(maintPath)) {
      system.lastMaintenance = new Date(fs.readFileSync(maintPath, 'utf-8'));
    }

    return system;
  }

  async saveSystemMemory(system: SystemMemory): Promise<void> {
    const systemDir = path.join(this.basePath, 'system');
    if (!fs.existsSync(systemDir)) {
      fs.mkdirSync(systemDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(systemDir, 'cron_history.json'),
      JSON.stringify(system.cronHistory.slice(-1000), null, 2) // Keep last 1000
    );
    fs.writeFileSync(
      path.join(systemDir, 'error_logs.json'),
      JSON.stringify(system.errorLogs.slice(-500), null, 2) // Keep last 500
    );
    fs.writeFileSync(
      path.join(systemDir, 'performance.json'),
      JSON.stringify(system.performanceTrends.slice(-1000), null, 2)
    );
    fs.writeFileSync(
      path.join(systemDir, 'skill_statuses.json'),
      JSON.stringify(Object.fromEntries(system.skillStatuses), null, 2)
    );
    fs.writeFileSync(
      path.join(systemDir, 'last_maintenance.txt'),
      system.lastMaintenance.toISOString()
    );

    this.emit('systemSaved', system);
  }

  async logCronEntry(entry: Omit<CronEntry, 'id'>): Promise<void> {
    const system = await this.loadSystemMemory();
    const cronEntry: CronEntry = {
      ...entry,
      id: generateId(),
    };
    system.cronHistory.push(cronEntry);
    await this.saveSystemMemory(system);
    this.emit('cronLogged', cronEntry);
  }

  async logError(error: Omit<ErrorEntry, 'id'>): Promise<void> {
    const system = await this.loadSystemMemory();
    const errorEntry: ErrorEntry = {
      ...error,
      id: generateId(),
    };
    system.errorLogs.push(errorEntry);
    await this.saveSystemMemory(system);
    this.emit('errorLogged', errorEntry);
  }

  async updateSkillStatus(status: SkillStatus): Promise<void> {
    const system = await this.loadSystemMemory();
    system.skillStatuses.set(status.skillId, status);
    await this.saveSystemMemory(system);
    this.emit('skillStatusUpdated', status);
  }

  // ========================================================================
  // MEMORY CHECKS FOR SKILLS
  // ========================================================================

  /**
   * Check if an action should be taken based on memory
   * Example: Check last post time before posting
   */
  async shouldTakeAction(
    actionType: string,
    accountId?: string,
    minIntervalMinutes: number = 120
  ): Promise<{ allowed: boolean; reason: string; lastAction?: ActionEntry }> {
    const cutoff = new Date(Date.now() - minIntervalMinutes * 60 * 1000);
    
    const recentActions = this.entries.filter(e => 
      e.key === actionType &&
      e.timestamp > cutoff &&
      (!accountId || e.data?.accountId === accountId)
    );

    if (recentActions.length > 0) {
      const lastAction = recentActions[recentActions.length - 1];
      const minutesAgo = Math.floor((Date.now() - lastAction.timestamp.getTime()) / 60000);
      return {
        allowed: false,
        reason: `Last ${actionType} was ${minutesAgo} minutes ago (min: ${minIntervalMinutes})`,
        lastAction: {
          id: lastAction.id,
          timestamp: lastAction.timestamp,
          skill: lastAction.source,
          action: lastAction.key,
          success: lastAction.data?.success ?? true,
          accountId: lastAction.data?.accountId,
        },
      };
    }

    return { allowed: true, reason: 'No recent actions found' };
  }

  /**
   * Get the last action of a specific type
   */
  getLastAction(actionType: string, accountId?: string): ActionEntry | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.key === actionType &&
          (!accountId || entry.data?.accountId === accountId)) {
        return {
          id: entry.id,
          timestamp: entry.timestamp,
          skill: entry.source,
          action: entry.key,
          input: entry.data?.input,
          output: entry.data?.output,
          success: entry.data?.success ?? true,
          duration: entry.data?.duration,
          accountId: entry.data?.accountId,
        };
      }
    }
    return undefined;
  }

  /**
   * Record an action for memory tracking
   */
  recordAction(action: Omit<ActionEntry, 'id'>): ActionEntry {
    const entry: ActionEntry = {
      ...action,
      id: generateId(),
    };

    this.store(entry.skill, 'action', entry.action, {
      input: entry.input,
      output: entry.output,
      success: entry.success,
      duration: entry.duration,
      accountId: entry.accountId,
    });

    return entry;
  }

  // ========================================================================
  // CORE MEMORY OPERATIONS (from original MemoryHub)
  // ========================================================================

  store(
    source: string,
    type: MemoryEntry['type'],
    key: string,
    data: any,
    metadata: MemoryEntry['metadata'] = {}
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: generateId(),
      timestamp: new Date(),
      source,
      type,
      key,
      data,
      metadata: {
        ...metadata,
        size: this.calculateSize(data),
      },
    };

    this.entries.push(entry);

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    this.emit('stored', entry);

    if (type === 'file') {
      this.persistFile(key, data);
    }

    return entry;
  }

  retrieve(key: string): MemoryEntry | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].key === key) {
        return this.entries[i];
      }
    }
    return undefined;
  }

  retrieveBySource(source: string, limit?: number): MemoryEntry[] {
    const results = this.entries
      .filter(e => e.source === source)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? results.slice(0, limit) : results;
  }

  retrieveByType(type: MemoryEntry['type'], limit?: number): MemoryEntry[] {
    const results = this.entries
      .filter(e => e.type === type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? results.slice(0, limit) : results;
  }

  search(query: string, options: {
    sources?: string[];
    types?: MemoryEntry['type'][];
    since?: Date;
    until?: Date;
    limit?: number;
  } = {}): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const entry of this.entries) {
      if (options.sources && !options.sources.includes(entry.source)) continue;
      if (options.types && !options.types.includes(entry.type)) continue;
      if (options.since && entry.timestamp < options.since) continue;
      if (options.until && entry.timestamp > options.until) continue;

      let score = 0;
      const highlights: string[] = [];

      if (entry.key.toLowerCase().includes(queryLower)) {
        score += 10;
        highlights.push(`key: ${entry.key}`);
      }

      const dataStr = JSON.stringify(entry.data).toLowerCase();
      if (dataStr.includes(queryLower)) {
        score += 5;
        const index = dataStr.indexOf(queryLower);
        const start = Math.max(0, index - 30);
        const end = Math.min(dataStr.length, index + query.length + 30);
        highlights.push(`data: ...${dataStr.slice(start, end)}...`);
      }

      if (score > 0) {
        results.push({ entry, score, highlights });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return options.limit ? results.slice(0, options.limit) : results;
  }

  async storeFile(
    source: string,
    filePath: string,
    data: string | Buffer,
    metadata: MemoryEntry['metadata'] = {}
  ): Promise<MemoryEntry> {
    const fullPath = path.join(this.basePath, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, data);
    return this.store(source, 'file', filePath, data, metadata);
  }

  readFile(filePath: string): string | null {
    const cached = this.retrieve(filePath);
    if (cached && cached.type === 'file') {
      return cached.data;
    }
    const fullPath = path.join(this.basePath, filePath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf-8');
  }

  storeJSON(source: string, key: string, data: any, metadata: MemoryEntry['metadata'] = {}): MemoryEntry {
    return this.store(source, 'database', key, data, { ...metadata, format: 'json' });
  }

  retrieveJSON(key: string): any | undefined {
    return this.retrieve(key)?.data;
  }

  log(source: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): MemoryEntry {
    return this.store(source, 'log', `log:${Date.now()}`, {
      message,
      level,
      timestamp: new Date().toISOString(),
    }, { tags: [level, source] });
  }

  getLogs(options: {
    source?: string;
    level?: 'info' | 'warn' | 'error';
    limit?: number;
    since?: Date;
  } = {}): MemoryEntry[] {
    let logs = this.entries.filter(e => e.type === 'log');
    if (options.source) logs = logs.filter(e => e.source === options.source);
    if (options.level) logs = logs.filter(e => e.data.level === options.level);
    if (options.since) logs = logs.filter(e => e.timestamp >= options.since!);
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return options.limit ? logs.slice(0, options.limit) : logs;
  }

  getStats() {
    const byType: Record<MemoryEntry['type'], number> = { file: 0, database: 0, cache: 0, log: 0, action: 0, learning: 0 };
    const bySource: Record<string, number> = {};

    for (const entry of this.entries) {
      byType[entry.type]++;
      bySource[entry.source] = (bySource[entry.source] || 0) + 1;
    }

    const timestamps = this.entries.map(e => e.timestamp.getTime());

    return {
      totalEntries: this.entries.length,
      byType,
      bySource,
      oldestEntry: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
      newestEntry: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
    };
  }

  export(): string {
    return JSON.stringify({ entries: this.entries, exportedAt: new Date().toISOString() }, null, 2);
  }

  import(json: string): void {
    const data = JSON.parse(json);
    this.entries = data.entries || [];
    this.emit('imported', { count: this.entries.length });
  }

  clear(): void {
    this.entries = [];
    this.emit('cleared');
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private getEntriesSince(date: Date): MemoryEntry[] {
    return this.entries.filter(e => e.timestamp >= date);
  }

  private getEntriesBefore(date: Date): MemoryEntry[] {
    return this.entries.filter(e => e.timestamp < date);
  }

  private getEntriesBetween(start: Date, end: Date): MemoryEntry[] {
    return this.entries.filter(e => e.timestamp >= start && e.timestamp < end);
  }

  private ensureDirectories(): void {
    const dirs = [
      this.basePath,
      path.join(this.basePath, 'context'),
      path.join(this.basePath, 'accounts'),
      path.join(this.basePath, 'system'),
      path.join(this.basePath, 'calendar'),
      path.join(this.basePath, 'logs'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private persistFile(key: string, data: any): void {
    const fullPath = path.join(this.basePath, key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(fullPath, content);
  }

  private calculateSize(data: any): number {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return Buffer.byteLength(str, 'utf8');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function daysAgo(n: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let unifiedMemoryHub: UnifiedMemoryHub | null = null;

export function getUnifiedMemoryHub(): UnifiedMemoryHub {
  if (!unifiedMemoryHub) {
    unifiedMemoryHub = new UnifiedMemoryHub();
  }
  return unifiedMemoryHub;
}

// Backward compatibility
export function getMemoryHub(): UnifiedMemoryHub {
  return getUnifiedMemoryHub();
}

// Re-export types
export * from './types';
