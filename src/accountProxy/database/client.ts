/**
 * Database Client for Account + Proxy Management System
 * Uses SQLite for simplicity and portability
 * 
 * INTEGRATED: Unified with Control Center database
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import {
  fullSchemaSQL,
  defaultProxiesSQL,
  Account,
  Proxy,
  Mapping,
  Incident,
  IncidentType,
  HealthCheckLog
} from './schema';

export class DatabaseClient {
  private db: Database.Database;
  private encryptionKey: string;

  constructor(dbPath?: string, encryptionKey?: string) {
    const path = dbPath || join(process.cwd(), 'data', 'control_center.db');
    this.encryptionKey = encryptionKey || process.env.DB_ENCRYPTION_KEY || 'default-key-change-me';
    
    // Ensure directory exists
    const fs = require('fs');
    const dir = require('path').dirname(path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(fullSchemaSQL);
  }

  // ============================================================
  // PROXY OPERATIONS
  // ============================================================

  createProxy(proxy: Omit<Proxy, 'createdAt' | 'updatedAt'>): Proxy {
    const stmt = this.db.prepare(`
      INSERT INTO proxies (id, name, host, port, username, password, protocol, status, health_score, max_accounts, assigned_accounts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      proxy.id,
      proxy.name,
      proxy.host,
      proxy.port,
      proxy.username,
      this.encrypt(proxy.password),
      proxy.protocol,
      proxy.status,
      proxy.healthScore,
      proxy.maxAccounts,
      proxy.assignedAccounts
    );
    
    return this.getProxy(proxy.id)!;
  }

  getProxy(id: string): Proxy | null {
    const row = this.db.prepare('SELECT * FROM proxies WHERE id = ?').get(id) as any;
    return row ? this.decryptProxy(row) : null;
  }

  getAllProxies(): Proxy[] {
    const rows = this.db.prepare('SELECT * FROM proxies ORDER BY id').all() as any[];
    return rows.map(r => this.decryptProxy(r));
  }

  getActiveProxies(): Proxy[] {
    const rows = this.db.prepare("SELECT * FROM proxies WHERE status = 'active' ORDER BY assigned_accounts").all() as any[];
    return rows.map(r => this.decryptProxy(r));
  }

  findAvailableProxy(): Proxy | null {
    const row = this.db.prepare(`
      SELECT * FROM proxies 
      WHERE status = 'active' 
      AND assigned_accounts < max_accounts 
      ORDER BY assigned_accounts ASC, health_score DESC 
      LIMIT 1
    `).get() as any;
    
    return row ? this.decryptProxy(row) : null;
  }

  updateProxy(id: string, updates: Partial<Proxy>): void {
    const sets: string[] = [];
    const values: any[] = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'password') {
        sets.push('password = ?');
        values.push(this.encrypt(value as string));
      } else {
        sets.push(`${this.toSnakeCase(key)} = ?`);
        values.push(value);
      }
    }
    
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    this.db.prepare(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  incrementProxyAccountCount(proxyId: string): void {
    this.db.prepare(`
      UPDATE proxies 
      SET assigned_accounts = assigned_accounts + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(proxyId);
  }

  decrementProxyAccountCount(proxyId: string): void {
    this.db.prepare(`
      UPDATE proxies 
      SET assigned_accounts = MAX(0, assigned_accounts - 1), updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(proxyId);
  }

  // ============================================================
  // ACCOUNT OPERATIONS
  // ============================================================

  createAccount(account: Omit<Account, 'createdAt' | 'updatedAt' | 'lastChecked'>): Account {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (
        id, name, twitter_handle, email, phone, phase, day, status, health_score,
        adspower_profile_id, adspower_group_id, proxy_id, followers, following, posts,
        dm_conversion_rate, last_action, actions_today, spam_score, daily_action_limit, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      account.id,
      account.name,
      account.twitterHandle,
      account.email || null,
      account.phone || null,
      account.phase,
      account.day,
      account.status,
      account.healthScore,
      account.adspowerProfileId,
      account.adspowerGroupId || null,
      account.proxyId,
      account.followers,
      account.following,
      account.posts,
      account.dmConversionRate,
      account.lastAction?.toISOString() || null,
      account.actionsToday,
      account.spamScore,
      account.dailyActionLimit,
      account.notes || null
    );
    
    // Increment proxy count
    this.incrementProxyAccountCount(account.proxyId);
    
    // Create mapping
    this.createMapping({
      id: crypto.randomUUID(),
      accountId: account.id,
      proxyId: account.proxyId,
      assignedAt: new Date(),
      isActive: true
    });
    
    return this.getAccount(account.id)!;
  }

  getAccount(id: string): Account | null {
    const row = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
    return row ? this.mapAccount(row) : null;
  }

  getAccountByTwitterHandle(handle: string): Account | null {
    const row = this.db.prepare('SELECT * FROM accounts WHERE twitter_handle = ?').get(handle) as any;
    return row ? this.mapAccount(row) : null;
  }

  getAllAccounts(): Account[] {
    const rows = this.db.prepare('SELECT * FROM accounts ORDER BY id').all() as any[];
    return rows.map(r => this.mapAccount(r));
  }

  getAccountsByProxy(proxyId: string): Account[] {
    const rows = this.db.prepare('SELECT * FROM accounts WHERE proxy_id = ? ORDER BY id').all(proxyId) as any[];
    return rows.map(r => this.mapAccount(r));
  }

  getAccountsByPhase(phase: Account['phase']): Account[] {
    const rows = this.db.prepare('SELECT * FROM accounts WHERE phase = ? ORDER BY id').all(phase) as any[];
    return rows.map(r => this.mapAccount(r));
  }

  getActiveAccounts(): Account[] {
    const rows = this.db.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY id").all() as any[];
    return rows.map(r => this.mapAccount(r));
  }

  updateAccount(id: string, updates: Partial<Account>): void {
    const sets: string[] = [];
    const values: any[] = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        sets.push(`${this.toSnakeCase(key)} = ?`);
        values.push(value instanceof Date ? value.toISOString() : value);
      }
    }
    
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    this.db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  updateAccountProxy(accountId: string, newProxyId: string, reason?: string): void {
    const account = this.getAccount(accountId);
    if (!account) throw new Error(`Account ${accountId} not found`);
    
    const oldProxyId = account.proxyId;
    
    // Update account
    this.updateAccount(accountId, { proxyId: newProxyId });
    
    // Update proxy counts
    this.decrementProxyAccountCount(oldProxyId);
    this.incrementProxyAccountCount(newProxyId);
    
    // Deactivate old mapping
    this.db.prepare(`
      UPDATE mappings SET is_active = 0 WHERE account_id = ? AND proxy_id = ?
    `).run(accountId, oldProxyId);
    
    // Create new mapping
    this.createMapping({
      id: crypto.randomUUID(),
      accountId,
      proxyId: newProxyId,
      assignedAt: new Date(),
      isActive: true,
      previousProxyId: oldProxyId,
      reassignedAt: new Date(),
      reassignmentReason: reason
    });
  }

  resetDailyActions(): void {
    this.db.prepare(`
      UPDATE accounts 
      SET actions_today = 0, updated_at = CURRENT_TIMESTAMP
    `).run();
  }

  // ============================================================
  // MAPPING OPERATIONS
  // ============================================================

  createMapping(mapping: Omit<Mapping, 'assignedAt'> & { assignedAt: Date }): void {
    this.db.prepare(`
      INSERT INTO mappings (id, account_id, proxy_id, assigned_at, is_active, previous_proxy_id, reassigned_at, reassignment_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      mapping.id,
      mapping.accountId,
      mapping.proxyId,
      mapping.assignedAt.toISOString(),
      mapping.isActive ? 1 : 0,
      mapping.previousProxyId || null,
      mapping.reassignedAt?.toISOString() || null,
      mapping.reassignmentReason || null
    );
  }

  getMappingHistory(accountId: string): Mapping[] {
    const rows = this.db.prepare(`
      SELECT * FROM mappings WHERE account_id = ? ORDER BY assigned_at DESC
    `).all(accountId) as any[];
    
    return rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      proxyId: r.proxy_id,
      assignedAt: new Date(r.assigned_at),
      isActive: r.is_active === 1,
      previousProxyId: r.previous_proxy_id,
      reassignedAt: r.reassigned_at ? new Date(r.reassigned_at) : undefined,
      reassignmentReason: r.reassignment_reason
    }));
  }

  // ============================================================
  // INCIDENT OPERATIONS
  // ============================================================

  createIncident(incident: Omit<Incident, 'id' | 'createdAt'>): Incident {
    const id = crypto.randomUUID();
    
    this.db.prepare(`
      INSERT INTO incidents (id, type, severity, account_id, proxy_id, title, description, old_proxy_id, new_proxy_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      incident.type,
      incident.severity,
      incident.accountId || null,
      incident.proxyId || null,
      incident.title,
      incident.description || null,
      incident.oldProxyId || null,
      incident.newProxyId || null,
      incident.status
    );
    
    return this.getIncident(id)!;
  }

  getIncident(id: string): Incident | null {
    const row = this.db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as any;
    return row ? this.mapIncident(row) : null;
  }

  getAllIncidents(limit: number = 100): Incident[] {
    const rows = this.db.prepare(`
      SELECT * FROM incidents ORDER BY created_at DESC LIMIT ?
    `).all(limit) as any[];
    return rows.map(r => this.mapIncident(r));
  }

  getOpenIncidents(): Incident[] {
    const rows = this.db.prepare(`
      SELECT * FROM incidents WHERE status = 'open' ORDER BY created_at DESC
    `).all() as any[];
    return rows.map(r => this.mapIncident(r));
  }

  getIncidentsByAccount(accountId: string): Incident[] {
    const rows = this.db.prepare(`
      SELECT * FROM incidents WHERE account_id = ? ORDER BY created_at DESC
    `).all(accountId) as any[];
    return rows.map(r => this.mapIncident(r));
  }

  getIncidentsByProxy(proxyId: string): Incident[] {
    const rows = this.db.prepare(`
      SELECT * FROM incidents WHERE proxy_id = ? OR old_proxy_id = ? ORDER BY created_at DESC
    `).all(proxyId, proxyId) as any[];
    return rows.map(r => this.mapIncident(r));
  }

  updateIncident(id: string, updates: Partial<Incident>): void {
    const sets: string[] = [];
    const values: any[] = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        sets.push(`${this.toSnakeCase(key)} = ?`);
        values.push(value instanceof Date ? value.toISOString() : value);
      }
    }
    
    values.push(id);
    this.db.prepare(`UPDATE incidents SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  resolveIncident(id: string, resolution: string, resolvedBy: string): void {
    this.db.prepare(`
      UPDATE incidents 
      SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(resolution, resolvedBy, id);
  }

  // ============================================================
  // HEALTH CHECK LOG OPERATIONS
  // ============================================================

  logHealthCheck(log: Omit<HealthCheckLog, 'id' | 'checkedAt'>): void {
    this.db.prepare(`
      INSERT INTO health_check_logs (account_id, proxy_id, check_type, proxy_working, proxy_response_time, account_status, health_score, issues)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.accountId || null,
      log.proxyId || null,
      log.checkType,
      log.proxyWorking ? 1 : 0,
      log.proxyResponseTime || null,
      log.accountStatus || null,
      log.healthScore,
      JSON.stringify(log.issues)
    );
  }

  getHealthCheckHistory(accountId?: string, limit: number = 100): HealthCheckLog[] {
    let rows: any[];
    
    if (accountId) {
      rows = this.db.prepare(`
        SELECT * FROM health_check_logs WHERE account_id = ? ORDER BY checked_at DESC LIMIT ?
      `).all(accountId, limit) as any[];
    } else {
      rows = this.db.prepare(`
        SELECT * FROM health_check_logs ORDER BY checked_at DESC LIMIT ?
      `).all(limit) as any[];
    }
    
    return rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      proxyId: r.proxy_id,
      checkType: r.check_type,
      proxyWorking: r.proxy_working === 1,
      proxyResponseTime: r.proxy_response_time,
      accountStatus: r.account_status,
      healthScore: r.health_score,
      issues: JSON.parse(r.issues || '[]'),
      checkedAt: new Date(r.checked_at)
    }));
  }

  // ============================================================
  // STATS & DASHBOARD
  // ============================================================

  getDashboardStats(): DashboardStats {
    const totalAccounts = this.db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    const activeAccounts = this.db.prepare("SELECT COUNT(*) as count FROM accounts WHERE status = 'active'").get() as { count: number };
    const totalProxies = this.db.prepare('SELECT COUNT(*) as count FROM proxies').get() as { count: number };
    const activeProxies = this.db.prepare("SELECT COUNT(*) as count FROM proxies WHERE status = 'active'").get() as { count: number };
    const openIncidents = this.db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'open'").get() as { count: number };
    
    const avgHealth = this.db.prepare('SELECT AVG(health_score) as score FROM accounts').get() as { score: number };
    
    const phaseDistribution = this.db.prepare(`
      SELECT phase, COUNT(*) as count FROM accounts GROUP BY phase
    `).all() as { phase: string; count: number }[];
    
    return {
      totalAccounts: totalAccounts.count,
      activeAccounts: activeAccounts.count,
      totalProxies: totalProxies.count,
      activeProxies: activeProxies.count,
      openIncidents: openIncidents.count,
      averageHealthScore: Math.round(avgHealth.score || 0),
      phaseDistribution: phaseDistribution.reduce((acc, { phase, count }) => {
        acc[phase] = count;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private encrypt(text: string): string {
    // Simple XOR encryption - replace with proper encryption in production
    // Consider using crypto.createCipheriv or a library like crypto-js
    const key = this.encryptionKey;
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return Buffer.from(result).toString('base64');
  }

  private decrypt(encrypted: string): string {
    const key = this.encryptionKey;
    const text = Buffer.from(encrypted, 'base64').toString();
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  }

  private decryptProxy(row: any): Proxy {
    return {
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      username: row.username,
      password: this.decrypt(row.password),
      protocol: row.protocol,
      status: row.status,
      healthScore: row.health_score,
      maxAccounts: row.max_accounts,
      assignedAccounts: row.assigned_accounts,
      avgResponseTime: row.avg_response_time,
      successRate: row.success_rate,
      lastTested: row.last_tested ? new Date(row.last_tested) : new Date(),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapAccount(row: any): Account {
    return {
      id: row.id,
      name: row.name,
      twitterHandle: row.twitter_handle,
      email: row.email,
      phone: row.phone,
      phase: row.phase,
      day: row.day,
      status: row.status,
      healthScore: row.health_score,
      adspowerProfileId: row.adspower_profile_id,
      adspowerGroupId: row.adspower_group_id,
      proxyId: row.proxy_id,
      followers: row.followers,
      following: row.following,
      posts: row.posts,
      dmConversionRate: row.dm_conversion_rate,
      lastAction: row.last_action ? new Date(row.last_action) : new Date(),
      actionsToday: row.actions_today,
      spamScore: row.spam_score,
      dailyActionLimit: row.daily_action_limit,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastChecked: row.last_checked ? new Date(row.last_checked) : new Date(),
      notes: row.notes
    };
  }

  private mapIncident(row: any): Incident {
    return {
      id: row.id,
      type: row.type as IncidentType,
      severity: row.severity,
      accountId: row.account_id,
      proxyId: row.proxy_id,
      title: row.title,
      description: row.description,
      oldProxyId: row.old_proxy_id,
      newProxyId: row.new_proxy_id,
      status: row.status,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolvedBy: row.resolved_by,
      resolution: row.resolution,
      createdAt: new Date(row.created_at),
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      acknowledgedBy: row.acknowledged_by
    };
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  close(): void {
    this.db.close();
  }
}

export interface DashboardStats {
  totalAccounts: number;
  activeAccounts: number;
  totalProxies: number;
  activeProxies: number;
  openIncidents: number;
  averageHealthScore: number;
  phaseDistribution: Record<string, number>;
}
