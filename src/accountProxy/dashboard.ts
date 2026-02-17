/**
 * Unified Dashboard for Control Center
 * Integrates Skills, Accounts, Proxies, and Cron monitoring
 * 
 * This replaces the separate accountProxy dashboard
 */

import { DatabaseClient, DashboardStats as AccountProxyStats } from './database/client';
import { Account, Proxy, Incident } from './database/schema';
import { SkillRegistry } from '../registry';

export interface UnifiedDashboardConfig {
  title: string;
  refreshIntervalMs: number;
  enableActions: boolean;
}

export class UnifiedDashboard {
  private db: DatabaseClient;
  private skillRegistry: SkillRegistry;
  private config: UnifiedDashboardConfig;

  constructor(
    db: DatabaseClient,
    skillRegistry: SkillRegistry,
    config: Partial<UnifiedDashboardConfig> = {}
  ) {
    this.db = db;
    this.skillRegistry = skillRegistry;
    this.config = {
      title: 'Control Center',
      refreshIntervalMs: 30000,
      enableActions: true,
      ...config
    };
  }

  /**
   * Generate HTML dashboard
   */
  generateHTML(): string {
    const skillStats = this.skillRegistry.getOverview();
    const accountProxyStats = this.db.getDashboardStats();
    const accounts = this.db.getAllAccounts();
    const proxies = this.db.getAllProxies();
    const incidents = this.db.getOpenIncidents();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.config.title}</title>
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎛️ ${this.config.title}</h1>
      <p class="subtitle">Unified Command Center for X Automation Ecosystem</p>
    </header>

    <!-- Navigation Tabs -->
    <nav class="tabs">
      <button class="tab-btn active" onclick="showTab('overview')">Overview</button>
      <button class="tab-btn" onclick="showTab('skills')">Skills (${skillStats.total})</button>
      <button class="tab-btn" onclick="showTab('accounts')">Accounts (${accountProxyStats.totalAccounts})</button>
      <button class="tab-btn" onclick="showTab('proxies')">Proxies (${accountProxyStats.totalProxies})</button>
      <button class="tab-btn" onclick="showTab('incidents')">Incidents (${incidents.length})</button>
    </nav>

    <!-- Overview Tab -->
    <section id="overview" class="tab-content active">
      <div class="stats-grid">
        ${this.renderOverviewCards(skillStats, accountProxyStats)}
      </div>
      <div class="two-column">
        <div class="column">
          <h2>🚀 Skills Status</h2>
          ${this.renderSkillsSummary(skillStats)}
        </div>
        <div class="column">
          <h2>👤 Account Health</h2>
          ${this.renderAccountHealthSummary(accountProxyStats)}
        </div>
      </div>
    </section>

    <!-- Skills Tab -->
    <section id="skills" class="tab-content">
      <h2>🚀 Skills Management</h2>
      ${this.renderSkillsTable()}
    </section>

    <!-- Accounts Tab -->
    <section id="accounts" class="tab-content">
      <h2>👤 Accounts (${accountProxyStats.totalAccounts})</h2>
      ${this.renderAccountTable(accounts)}
    </section>

    <!-- Proxies Tab -->
    <section id="proxies" class="tab-content">
      <h2>🔌 Proxies (${accountProxyStats.totalProxies})</h2>
      ${this.renderProxyTable(proxies)}
    </section>

    <!-- Incidents Tab -->
    <section id="incidents" class="tab-content">
      <h2>🚨 Open Incidents (${incidents.length})</h2>
      ${this.renderIncidentsTable(incidents)}
    </section>

    <section>
      <h2>⚡ Quick Actions</h2>
      ${this.renderQuickActions()}
    </section>
  </div>

  <script>
    ${this.getScripts()}
  </script>
</body>
</html>
    `;
  }

  /**
   * Generate JSON API response
   */
  generateAPIResponse(): UnifiedDashboardAPIResponse {
    return {
      skills: this.skillRegistry.getOverview(),
      accounts: {
        stats: this.db.getDashboardStats(),
        list: this.db.getAllAccounts()
      },
      proxies: {
        list: this.db.getAllProxies(),
        health: this.getProxyHealthSummary()
      },
      incidents: {
        open: this.db.getOpenIncidents(),
        recent: this.db.getAllIncidents(10)
      },
      mappings: this.getMappingOverview(),
      timestamp: new Date().toISOString()
    };
  }

  // ============================================================
  // HTML RENDERING
  // ============================================================

  private renderOverviewCards(skillStats: any, accountStats: AccountProxyStats): string {
    return `
      <div class="stat-card">
        <div class="stat-value" style="color: ${skillStats.avgHealth > 70 ? '#22c55e' : '#f59e0b'}">${skillStats.running}</div>
        <div class="stat-label">Running Skills</div>
        <div class="stat-sublabel">of ${skillStats.total} total</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">${accountStats.totalAccounts}</div>
        <div class="stat-label">Total Accounts</div>
        <div class="stat-sublabel">${accountStats.activeAccounts} active</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">${accountStats.totalProxies}</div>
        <div class="stat-label">Total Proxies</div>
        <div class="stat-sublabel">${accountStats.activeProxies} active</div>
      </div>
      
      <div class="stat-card ${accountStats.openIncidents > 0 ? 'alert' : ''}">
        <div class="stat-value" style="color: ${accountStats.openIncidents > 0 ? '#ef4444' : '#22c55e'}">${accountStats.openIncidents}</div>
        <div class="stat-label">Open Incidents</div>
        <div class="stat-sublabel">Need attention</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value" style="color: ${accountStats.averageHealthScore > 70 ? '#22c55e' : accountStats.averageHealthScore > 40 ? '#f59e0b' : '#ef4444'}">
          ${accountStats.averageHealthScore}%
        </div>
        <div class="stat-label">Avg Health</div>
        <div class="stat-sublabel">System health</div>
      </div>
    `;
  }

  private renderSkillsSummary(skillStats: any): string {
    return `
      <div class="summary-box">
        <div class="summary-row">
          <span class="status-dot running"></span>
          <span>Running: ${skillStats.running}</span>
        </div>
        <div class="summary-row">
          <span class="status-dot paused"></span>
          <span>Paused: ${skillStats.paused}</span>
        </div>
        <div class="summary-row">
          <span class="status-dot error"></span>
          <span>Error: ${skillStats.error}</span>
        </div>
        <div class="summary-row">
          <span class="status-dot stopped"></span>
          <span>Stopped: ${skillStats.stopped}</span>
        </div>
        <hr>
        <div class="summary-row">
          <strong>Avg Health: ${Math.round(skillStats.avgHealth)}%</strong>
        </div>
      </div>
    `;
  }

  private renderAccountHealthSummary(stats: AccountProxyStats): string {
    const phases = stats.phaseDistribution || {};
    return `
      <div class="summary-box">
        <div class="summary-row">
          <span class="badge phase-warmup">warmup</span>
          <span>${phases.warmup || 0} accounts</span>
        </div>
        <div class="summary-row">
          <span class="badge phase-soft">soft</span>
          <span>${phases.soft || 0} accounts</span>
        </div>
        <div class="summary-row">
          <span class="badge phase-growth">growth</span>
          <span>${phases.growth || 0} accounts</span>
        </div>
        <div class="summary-row">
          <span class="badge phase-full">full</span>
          <span>${phases.full || 0} accounts</span>
        </div>
        <hr>
        <div class="summary-row">
          <strong>Avg Health: ${stats.averageHealthScore}%</strong>
        </div>
      </div>
    `;
  }

  private renderSkillsTable(): string {
    const skills = this.skillRegistry.getAll();
    
    const rows = skills.map(s => `
      <tr class="${s.status}">
        <td>${s.id}</td>
        <td>${s.name}</td>
        <td><span class="badge type-${s.type}">${s.type}</span></td>
        <td><span class="badge status-${s.status}">${s.status}</span></td>
        <td>${s.health}%</td>
        <td>${s.stats.calls}</td>
        <td>${s.stats.errors}</td>
        <td>
          <button onclick="restartSkill('${s.id}')">Restart</button>
          ${s.status === 'running' ? `<button onclick="stopSkill('${s.id}')">Stop</button>` : `<button onclick="startSkill('${s.id}')">Start</button>`}
        </td>
      </tr>
    `).join('');

    return `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Health</th>
            <th>Calls</th>
            <th>Errors</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="8" class="empty">No skills registered</td></tr>'}
        </tbody>
      </table>
    `;
  }

  private renderProxyTable(proxies: Proxy[]): string {
    const rows = proxies.map(p => `
      <tr class="${p.status !== 'active' ? 'warning' : ''}">
        <td>${p.id}</td>
        <td>${p.host}:${p.port}</td>
        <td><span class="badge ${p.status}">${p.status}</span></td>
        <td>${p.assignedAccounts}/${p.maxAccounts}</td>
        <td>${p.healthScore}%</td>
        <td>${p.avgResponseTime}ms</td>
        <td>
          <button onclick="testProxy('${p.id}')">Test</button>
          ${p.status !== 'active' ? `<button onclick="recoverProxy('${p.id}')">Recover</button>` : ''}
        </td>
      </tr>
    `).join('');

    return `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Host</th>
            <th>Status</th>
            <th>Accounts</th>
            <th>Health</th>
            <th>Latency</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" class="empty">No proxies configured</td></tr>'}
        </tbody>
      </table>
    `;
  }

  private renderAccountTable(accounts: Account[]): string {
    const rows = accounts.map(a => `
      <tr class="${a.status !== 'active' ? 'warning' : ''} ${a.healthScore < 50 ? 'critical' : ''}">
        <td>${a.id}</td>
        <td>${a.name}</td>
        <td>${a.twitterHandle}</td>
        <td><span class="badge phase-${a.phase}">${a.phase}</span></td>
        <td>${a.proxyId}</td>
        <td>${a.healthScore}%</td>
        <td>${a.actionsToday}/${a.dailyActionLimit}</td>
        <td>
          <button onclick="checkAccount('${a.id}')">Check</button>
          <button onclick="changeProxy('${a.id}')">Move</button>
        </td>
      </tr>
    `).join('');

    return `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Twitter</th>
            <th>Phase</th>
            <th>Proxy</th>
            <th>Health</th>
            <th>Actions</th>
            <th>Quick Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="8" class="empty">No accounts created</td></tr>'}
        </tbody>
      </table>
    `;
  }

  private renderIncidentsTable(incidents: Incident[]): string {
    if (incidents.length === 0) {
      return '<p class="empty-state">✅ No open incidents</p>';
    }

    const rows = incidents.map(i => `
      <tr class="severity-${i.severity}">
        <td>${new Date(i.createdAt).toLocaleString()}</td>
        <td><span class="badge severity-${i.severity}">${i.severity}</span></td>
        <td>${i.type}</td>
        <td>${i.accountId || '-'}</td>
        <td>${i.proxyId || '-'}</td>
        <td>${i.title}</td>
        <td>
          <button onclick="resolveIncident('${i.id}')">Resolve</button>
          <button onclick="acknowledgeIncident('${i.id}')">Ack</button>
        </td>
      </tr>
    `).join('');

    return `
      <table class="incidents">
        <thead>
          <tr>
            <th>Time</th>
            <th>Severity</th>
            <th>Type</th>
            <th>Account</th>
            <th>Proxy</th>
            <th>Title</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private renderQuickActions(): string {
    return `
      <div class="action-grid">
        <button class="action-btn primary" onclick="runHealthCheck()">
          🏥 Run Health Check
        </button>
        <button class="action-btn" onclick="testAllProxies()">
          🔌 Test All Proxies
        </button>
        <button class="action-btn" onclick="resetDailyActions()">
          🔄 Reset Daily Actions
        </button>
        <button class="action-btn warning" onclick="bulkFailover()">
          ⚠️ Emergency Failover
        </button>
        <button class="action-btn" onclick="restartAllSkills()">
          🚀 Restart All Skills
        </button>
        <button class="action-btn" onclick="exportData()">
          📥 Export Data
        </button>
      </div>
    `;
  }

  private getStyles(): string {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #0f172a;
        color: #e2e8f0;
        line-height: 1.6;
      }
      .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
      header { margin-bottom: 30px; }
      h1 { font-size: 2rem; color: #f8fafc; margin-bottom: 5px; }
      .subtitle { color: #94a3b8; }
      
      /* Tabs */
      .tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 30px;
        border-bottom: 1px solid #334155;
        padding-bottom: 10px;
      }
      .tab-btn {
        background: #1e293b;
        border: 1px solid #334155;
        color: #94a3b8;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s;
      }
      .tab-btn:hover { background: #334155; color: #f8fafc; }
      .tab-btn.active { background: #3b82f6; border-color: #3b82f6; color: white; }
      
      /* Tab Content */
      .tab-content { display: none; }
      .tab-content.active { display: block; }
      
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }
      .stat-card {
        background: #1e293b;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #334155;
      }
      .stat-card.alert { border-color: #ef4444; background: #7f1d1d20; }
      .stat-value { font-size: 2.5rem; font-weight: bold; color: #3b82f6; }
      .stat-label { color: #94a3b8; font-size: 0.9rem; }
      .stat-sublabel { color: #64748b; font-size: 0.8rem; margin-top: 5px; }
      
      .two-column {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-bottom: 30px;
      }
      @media (max-width: 1024px) { .two-column { grid-template-columns: 1fr; } }
      
      section { margin-bottom: 30px; }
      h2 { font-size: 1.3rem; margin-bottom: 15px; color: #f8fafc; }
      
      /* Summary Box */
      .summary-box {
        background: #1e293b;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #334155;
      }
      .summary-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .summary-row:last-child { margin-bottom: 0; }
      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
      }
      .status-dot.running { background: #22c55e; }
      .status-dot.paused { background: #f59e0b; }
      .status-dot.error { background: #ef4444; }
      .status-dot.stopped { background: #64748b; }
      
      table {
        width: 100%;
        background: #1e293b;
        border-radius: 12px;
        overflow: hidden;
        border-collapse: collapse;
      }
      th, td { padding: 12px 15px; text-align: left; }
      th { background: #334155; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; }
      tr { border-bottom: 1px solid #334155; }
      tr:last-child { border-bottom: none; }
      tr:hover { background: #33415550; }
      tr.warning { background: #f59e0b20; }
      tr.critical { background: #ef444420; }
      tr.running { background: #22c55e10; }
      tr.error { background: #ef444420; }
      
      .badge {
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
      }
      .badge.active, .badge.running { background: #22c55e30; color: #22c55e; }
      .badge.failed, .badge.error { background: #ef444430; color: #ef4444; }
      .badge.maintenance { background: #f59e0b30; color: #f59e0b; }
      .badge.paused { background: #64748b30; color: #94a3b8; }
      .badge.stopped { background: #64748b30; color: #64748b; }
      .badge.warmup { background: #3b82f630; color: #3b82f6; }
      .badge.soft { background: #8b5cf630; color: #8b5cf6; }
      .badge.growth { background: #10b98130; color: #10b981; }
      .badge.full { background: #f59e0b30; color: #f59e0b; }
      .badge.severity-critical { background: #ef444430; color: #ef4444; }
      .badge.severity-high { background: #f9731630; color: #f97316; }
      .badge.severity-medium { background: #f59e0b30; color: #f59e0b; }
      .badge.severity-low { background: #3b82f630; color: #3b82f6; }
      .badge.type-content { background: #8b5cf630; color: #8b5cf6; }
      .badge.type-engagement { background: #06b6d430; color: #06b6d4; }
      .badge.type-xreacher { background: #f59e0b30; color: #f59e0b; }
      .badge.type-autonomous { background: #ec489930; color: #ec4899; }
      
      button {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
        margin-right: 5px;
      }
      button:hover { background: #2563eb; }
      
      .action-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
      }
      .action-btn {
        padding: 15px 20px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 10px;
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.2s;
        color: #e2e8f0;
      }
      .action-btn:hover { background: #334155; }
      .action-btn.primary { background: #3b82f6; border-color: #3b82f6; }
      .action-btn.primary:hover { background: #2563eb; }
      .action-btn.warning { background: #f59e0b; border-color: #f59e0b; color: #000; }
      .action-btn.warning:hover { background: #d97706; }
      
      .empty { text-align: center; color: #64748b; padding: 40px; }
      .empty-state { text-align: center; color: #22c55e; padding: 30px; background: #1e293b; border-radius: 12px; }
    `;
  }

  private getScripts(): string {
    return `
      // Tab switching
      function showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        event.target.classList.add('active');
      }

      async function apiCall(endpoint, method = 'GET', data = null) {
        try {
          const options = { method, headers: { 'Content-Type': 'application/json' } };
          if (data) options.body = JSON.stringify(data);
          const res = await fetch('/api/' + endpoint, options);
          return await res.json();
        } catch (e) {
          alert('Error: ' + e.message);
        }
      }

      // Skill actions
      async function restartSkill(id) {
        await apiCall('skills/' + id + '/restart', 'POST');
        location.reload();
      }

      async function startSkill(id) {
        await apiCall('skills/' + id + '/start', 'POST');
        location.reload();
      }

      async function stopSkill(id) {
        await apiCall('skills/' + id + '/stop', 'POST');
        location.reload();
      }

      async function restartAllSkills() {
        await apiCall('skills/restart-all', 'POST');
        location.reload();
      }

      // Proxy actions
      async function testProxy(id) {
        const result = await apiCall('proxies/' + id + '/test', 'POST');
        alert(result.working ? '✅ Proxy working' : '❌ Proxy failed: ' + result.error);
        location.reload();
      }

      async function recoverProxy(id) {
        await apiCall('proxies/' + id + '/recover', 'POST');
        location.reload();
      }

      async function testAllProxies() {
        await apiCall('proxies/test-all', 'POST');
        alert('All proxies tested');
        location.reload();
      }

      // Account actions
      async function checkAccount(id) {
        await apiCall('accounts/' + id + '/check', 'POST');
        location.reload();
      }

      async function changeProxy(accountId) {
        const proxyId = prompt('Enter new proxy ID:');
        if (proxyId) {
          await apiCall('accounts/' + accountId + '/move', 'POST', { proxyId });
          location.reload();
        }
      }

      // Incident actions
      async function resolveIncident(id) {
        await apiCall('incidents/' + id + '/resolve', 'POST', { resolution: 'Resolved via dashboard' });
        location.reload();
      }

      async function acknowledgeIncident(id) {
        await apiCall('incidents/' + id + '/acknowledge', 'POST');
        location.reload();
      }

      // System actions
      async function runHealthCheck() {
        await apiCall('health-check', 'POST');
        alert('Health check completed');
        location.reload();
      }

      async function resetDailyActions() {
        await apiCall('reset-actions', 'POST');
        alert('Daily actions reset');
        location.reload();
      }

      async function bulkFailover() {
        if (confirm('Emergency failover? This will move all accounts from failed proxies.')) {
          await apiCall('failover/bulk', 'POST');
          location.reload();
        }
      }

      async function exportData() {
        const data = await apiCall('export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'control-center-export.json';
        a.click();
      }

      // Auto-refresh
      setTimeout(() => location.reload(), ${this.config.refreshIntervalMs});
    `;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private getProxyHealthSummary() {
    const proxies = this.db.getAllProxies();
    return proxies.map(p => ({
      id: p.id,
      status: p.status,
      healthScore: p.healthScore,
      utilization: p.assignedAccounts / p.maxAccounts
    }));
  }

  private getMappingOverview() {
    const proxies = this.db.getAllProxies();
    
    return proxies.map(proxy => {
      const accounts = this.db.getAccountsByProxy(proxy.id);
      return {
        proxyId: proxy.id,
        accounts: accounts.map(a => ({
          id: a.id,
          name: a.name,
          twitterHandle: a.twitterHandle,
          phase: a.phase,
          healthScore: a.healthScore
        })),
        isFull: accounts.length >= proxy.maxAccounts
      };
    });
  }
}

// ============================================================
// TYPES
// ============================================================

interface UnifiedDashboardAPIResponse {
  skills: any;
  accounts: {
    stats: AccountProxyStats;
    list: Account[];
  };
  proxies: {
    list: Proxy[];
    health: {
      id: string;
      status: string;
      healthScore: number;
      utilization: number;
    }[];
  };
  incidents: {
    open: Incident[];
    recent: Incident[];
  };
  mappings: {
    proxyId: string;
    accounts: {
      id: string;
      name: string;
      twitterHandle: string;
      phase: string;
      healthScore: number;
    }[];
    isFull: boolean;
  }[];
  timestamp: string;
}
