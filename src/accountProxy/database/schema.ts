/**
 * Database Schema for Account + Proxy Management System
 * 
 * Tables:
 * - accounts: Twitter account information
 * - proxies: MarsProxies configuration
 * - mappings: Account-proxy relationships
 * - incidents: Failure and event logs
 * 
 * INTEGRATED: Unified with Control Center database
 */

// ============================================================
// PROXIES TABLE
// ============================================================

export interface Proxy {
  id: string;                    // "mars_001"
  name: string;                  // "Mars Proxy 1"
  host: string;                  // "port.marsproxies.com"
  port: number;                  // 5000-5004
  username: string;              // MarsProxies username
  password: string;              // ENCRYPTED - MarsProxies password
  protocol: 'socks5' | 'https';
  
  // Status
  status: 'active' | 'failed' | 'maintenance';
  healthScore: number;           // 0-100
  
  // Capacity (2 accounts max per proxy)
  maxAccounts: number;           // Always 2
  assignedAccounts: number;      // Current count
  
  // Performance metrics
  lastTested: Date;
  avgResponseTime: number;       // ms
  successRate: number;           // 0-100 (last 24h)
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export const createProxiesTableSQL = `
CREATE TABLE IF NOT EXISTS proxies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL, -- ENCRYPTED
  protocol TEXT NOT NULL CHECK(protocol IN ('socks5', 'https')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'failed', 'maintenance')),
  health_score INTEGER DEFAULT 100 CHECK(health_score >= 0 AND health_score <= 100),
  max_accounts INTEGER DEFAULT 2,
  assigned_accounts INTEGER DEFAULT 0,
  avg_response_time INTEGER DEFAULT 0,
  success_rate INTEGER DEFAULT 100,
  last_tested TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding available proxies
CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);
CREATE INDEX IF NOT EXISTS idx_proxies_assigned ON proxies(assigned_accounts);
`;

// ============================================================
// ACCOUNTS TABLE
// ============================================================

export interface Account {
  id: string;                    // "ella_001"
  name: string;                  // "Ella Sophie Main"
  twitterHandle: string;         // "@ellasophiee"
  email?: string;                // Account email
  phone?: string;                // Account phone
  
  // Phase management
  phase: 'warmup' | 'soft' | 'growth' | 'full';
  day: number;                   // Days since creation
  
  // Status
  status: 'active' | 'suspended' | 'banned' | 'paused';
  healthScore: number;           // 0-100
  
  // AdsPower integration
  adspowerProfileId: string;
  adspowerGroupId?: string;
  
  // Proxy assignment (foreign key)
  proxyId: string;
  
  // Metrics
  followers: number;
  following: number;
  posts: number;
  dmConversionRate: number;      // 0-100
  
  // Safety tracking
  lastAction: Date;
  actionsToday: number;
  spamScore: number;             // 0-100 (higher = more risky)
  dailyActionLimit: number;      // Current limit based on phase
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastChecked: Date;
  notes?: string;
}

export const createAccountsTableSQL = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  twitter_handle TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  phase TEXT DEFAULT 'warmup' CHECK(phase IN ('warmup', 'soft', 'growth', 'full')),
  day INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'banned', 'paused')),
  health_score INTEGER DEFAULT 100 CHECK(health_score >= 0 AND health_score <= 100),
  adspower_profile_id TEXT NOT NULL,
  adspower_group_id TEXT,
  proxy_id TEXT NOT NULL,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  posts INTEGER DEFAULT 0,
  dm_conversion_rate REAL DEFAULT 0,
  last_action TIMESTAMP,
  actions_today INTEGER DEFAULT 0,
  spam_score INTEGER DEFAULT 0 CHECK(spam_score >= 0 AND spam_score <= 100),
  daily_action_limit INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_checked TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (proxy_id) REFERENCES proxies(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_proxy ON accounts(proxy_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_phase ON accounts(phase);
CREATE INDEX IF NOT EXISTS idx_accounts_adspower ON accounts(adspower_profile_id);
`;

// ============================================================
// MAPPINGS TABLE (Explicit account-proxy relationships)
// ============================================================

export interface Mapping {
  id: string;                    // Auto-generated
  accountId: string;
  proxyId: string;
  assignedAt: Date;
  isActive: boolean;
  
  // History tracking
  previousProxyId?: string;
  reassignedAt?: Date;
  reassignmentReason?: string;
}

export const createMappingsTableSQL = `
CREATE TABLE IF NOT EXISTS mappings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL,
  proxy_id TEXT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  previous_proxy_id TEXT,
  reassigned_at TIMESTAMP,
  reassignment_reason TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (proxy_id) REFERENCES proxies(id),
  FOREIGN KEY (previous_proxy_id) REFERENCES proxies(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mappings_account ON mappings(account_id);
CREATE INDEX IF NOT EXISTS idx_mappings_proxy ON mappings(proxy_id);
CREATE INDEX IF NOT EXISTS idx_mappings_active ON mappings(is_active);
`;

// ============================================================
// INCIDENTS TABLE (Failure tracking)
// ============================================================

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
  id: string;                    // Auto-generated
  type: IncidentType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Related entities
  accountId?: string;
  proxyId?: string;
  
  // Details
  title: string;
  description: string;
  
  // For proxy failures
  oldProxyId?: string;
  newProxyId?: string;
  
  // Resolution
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  
  // Metadata
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export const createIncidentsTableSQL = `
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  account_id TEXT,
  proxy_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  old_proxy_id TEXT,
  new_proxy_id TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'resolved', 'ignored')),
  resolved_at TIMESTAMP,
  resolved_by TEXT,
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP,
  acknowledged_by TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (proxy_id) REFERENCES proxies(id),
  FOREIGN KEY (old_proxy_id) REFERENCES proxies(id),
  FOREIGN KEY (new_proxy_id) REFERENCES proxies(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_account ON incidents(account_id);
CREATE INDEX IF NOT EXISTS idx_incidents_proxy ON incidents(proxy_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at);
`;

// ============================================================
// HEALTH CHECK LOGS TABLE
// ============================================================

export interface HealthCheckLog {
  id: string;
  accountId?: string;
  proxyId?: string;
  checkType: 'proxy' | 'account' | 'full';
  
  // Results
  proxyWorking: boolean;
  proxyResponseTime?: number;
  accountStatus?: string;
  healthScore: number;
  
  // Issues found
  issues: string[];
  
  // Metadata
  checkedAt: Date;
}

export const createHealthCheckLogsTableSQL = `
CREATE TABLE IF NOT EXISTS health_check_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT,
  proxy_id TEXT,
  check_type TEXT NOT NULL CHECK(check_type IN ('proxy', 'account', 'full')),
  proxy_working BOOLEAN,
  proxy_response_time INTEGER,
  account_status TEXT,
  health_score INTEGER,
  issues TEXT, -- JSON array
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (proxy_id) REFERENCES proxies(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_logs_account ON health_check_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_proxy ON health_check_logs(proxy_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_checked ON health_check_logs(checked_at);
`;

// ============================================================
// ALL SCHEMA SQL
// ============================================================

export const fullSchemaSQL = `
${createProxiesTableSQL}

${createAccountsTableSQL}

${createMappingsTableSQL}

${createIncidentsTableSQL}

${createHealthCheckLogsTableSQL}
`;

// ============================================================
// DEFAULT DATA (5 MarsProxies for 10 accounts)
// ============================================================

export const defaultProxiesSQL = `
-- Insert 5 MarsProxies placeholders
-- Replace with actual credentials from MarsProxies dashboard
INSERT OR IGNORE INTO proxies (id, name, host, port, username, password, protocol, max_accounts) VALUES
('mars_001', 'Mars ISP 1', 'port.marsproxies.com', 5000, 'YOUR_MARS_USERNAME', 'ENCRYPTED_PASSWORD', 'socks5', 2),
('mars_002', 'Mars ISP 2', 'port.marsproxies.com', 5001, 'YOUR_MARS_USERNAME', 'ENCRYPTED_PASSWORD', 'socks5', 2),
('mars_003', 'Mars ISP 3', 'port.marsproxies.com', 5002, 'YOUR_MARS_USERNAME', 'ENCRYPTED_PASSWORD', 'socks5', 2),
('mars_004', 'Mars ISP 4', 'port.marsproxies.com', 5003, 'YOUR_MARS_USERNAME', 'ENCRYPTED_PASSWORD', 'socks5', 2),
('mars_005', 'Mars ISP 5', 'port.marsproxies.com', 5004, 'YOUR_MARS_USERNAME', 'ENCRYPTED_PASSWORD', 'socks5', 2);
`;
