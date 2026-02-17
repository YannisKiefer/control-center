/**
 * Core types for Control Center
 */

export type SkillId = string;
export type EventType = string;
export type MemoryKey = string;

export enum SkillStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  ERROR = 'error',
  OFFLINE = 'offline',
  STARTING = 'starting',
  STOPPING = 'stopping'
}

export interface Skill {
  id: SkillId;
  name: string;
  version: string;
  description?: string;
  status: SkillStatus;
  lastHeartbeat: Date;
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface SkillRegistration {
  skill: Skill;
  registeredAt: Date;
  restartCount: number;
  lastError?: string;
}

export interface Event {
  id: string;
  type: EventType;
  source: SkillId;
  timestamp: Date;
  payload: unknown;
  correlationId?: string;
}

export type EventHandler = (event: Event) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  pattern: string;
  handler: EventHandler;
  regex: RegExp;
}

export interface MemoryEntry {
  key: MemoryKey;
  data: unknown;
  storedAt: Date;
  ttl?: number;
  tags?: string[];
  source: SkillId;
}

export interface MemorySearchResult {
  key: MemoryKey;
  data: unknown;
  score: number;
  storedAt: Date;
}

export interface Action {
  id: string;
  skillId: SkillId;
  action: string;
  timestamp: Date;
  input?: unknown;
  output?: unknown;
  duration?: number;
  success: boolean;
  error?: string;
}

export interface Report {
  generatedAt: Date;
  period: { start: Date; end: Date };
  skills: SkillSummary[];
  events: EventSummary;
  actions: ActionSummary;
  errors: ErrorEntry[];
}

export interface SkillSummary {
  id: SkillId;
  name: string;
  status: SkillStatus;
  uptime: number;
  actionCount: number;
  errorCount: number;
}

export interface EventSummary {
  total: number;
  byType: Record<EventType, number>;
  bySource: Record<SkillId, number>;
}

export interface ActionSummary {
  total: number;
  successful: number;
  failed: number;
  averageDuration: number;
}

export interface ErrorEntry {
  timestamp: Date;
  skillId: SkillId;
  error: string;
  context?: unknown;
}

export interface Audit {
  generatedAt: Date;
  decisions: DecisionEntry[];
}

export interface DecisionEntry {
  id: string;
  timestamp: Date;
  skillId: SkillId;
  decision: string;
  rationale: string;
  outcome?: unknown;
  relatedActions: string[];
}

export interface HealthCheck {
  skillId: SkillId;
  status: SkillStatus;
  checkedAt: Date;
  responseTime: number;
  message?: string;
}

// ============================================================
// ACCOUNT + PROXY TYPES (Integrated)
// ============================================================

export interface Account {
  id: string;
  name: string;
  twitterHandle: string;
  email?: string;
  phone?: string;
  phase: 'warmup' | 'soft' | 'growth' | 'full';
  day: number;
  status: 'active' | 'suspended' | 'banned' | 'paused';
  healthScore: number;
  adspowerProfileId: string;
  adspowerGroupId?: string;
  proxyId: string;
  followers: number;
  following: number;
  posts: number;
  dmConversionRate: number;
  lastAction: Date;
  actionsToday: number;
  spamScore: number;
  dailyActionLimit: number;
  createdAt: Date;
  updatedAt: Date;
  lastChecked: Date;
  notes?: string;
}

export interface Proxy {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: 'socks5' | 'https';
  status: 'active' | 'failed' | 'maintenance';
  healthScore: number;
  maxAccounts: number;
  assignedAccounts: number;
  lastTested: Date;
  avgResponseTime: number;
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export type IncidentType = 
  | 'proxy_failure'
  | 'proxy_degraded'
  | 'account_suspicious'
  | 'account_suspended'
  | 'rate_limit_hit'
  | 'health_check_failed'
  | 'failover_triggered'
  | 'manual_intervention';

export interface Incident {
  id: string;
  type: IncidentType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  accountId?: string;
  proxyId?: string;
  title: string;
  description: string;
  oldProxyId?: string;
  newProxyId?: string;
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface AccountProxyMappingInfo {
  proxy: Proxy;
  accounts: Account[];
  utilization: number;
  isFull: boolean;
}
