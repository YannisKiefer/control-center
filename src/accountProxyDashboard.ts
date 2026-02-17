/**
 * Account and Proxy Dashboard
 * Integrated Control Center Dashboard Component
 */

import { AccountProxyManager, Account, Proxy, Incident, AccountProxyStats, ProxyAccountMapping } from './accountProxy.js';

export interface DashboardConfig {
  title: string;
  refreshIntervalMs: number;
  enableActions: boolean;
  theme: 'dark' | 'light';
}

export class AccountProxyDashboard {
  private manager: AccountProxyManager;
  private config: DashboardConfig;

  constructor(
    manager: AccountProxyManager,
    config: Partial<DashboardConfig> = {}
  ) {
    this.manager = manager;
    this.config = {
      title: 'Account + Proxy Management',
      refreshIntervalMs: 30000,
      enableActions: true,
      theme: 'dark',
      ...config
    };
  }

  /**
   * Generate HTML dashboard for embedding in Control Center
   */
  generateHTML(): string {
    const stats = this.manager.getStats();
    const accounts = this.manager.getAllAccounts();
    const proxies = this.manager.getAllProxies();
    const incidents = this.manager.getOpenIncidents();
    const mappings = this.manager.getMappings();
    const healthSummary = this.manager.getHealthSummary();

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
<body class="${this.config.theme}">
  <div class="ap-container">
    <header class="ap-header">
      <h1>🔄 ${this.config.title}</h1>
      <p class="ap-subtitle">Account-Proxy Management System</p>
    </header>

    <!-- Stats Grid -->
    <section class="ap-stats-grid">
      ${this.renderStatsCards(stats)}
    </section>

    <!-- Health Overview -->
    <section class="ap-section">
      <h2>🏥 Health Overview</h2>
      <div class="ap-health-grid">
        <div class="ap-health-card">
          <h3>Account Health Distribution</h3>
          ${this.renderHealthDistribution(healthSummary.accountHealth.distribution)}
        </div>
        <div class="ap-health-card">
          <h3>Proxy Status</h3>
          ${this.renderProxyHealthSummary(healthSummary.proxyHealth)}
        </div>
      </div>
    </section>

    <!-- Two Column Layout -->
    <section class="ap-two-column">
      <div class="ap-column">
        <h2>📊 Proxy Status (${proxies.length})</h2>
        ${this.renderProxyTable(proxies)}
      </div>
      <div class="ap-column">
        <h2>👤 Account Overview (${accounts.length})</h2>
        ${this.renderAccountTable(accounts)}
      </div>
    </section>

    <!-- Account-Proxy Mappings -->
    <section class="ap-section">
      <h2>🔗 Account-Proxy Mappings</h2>
      ${this.renderMappings(mappings)}
    </section>

    <!-- Open Incidents -->
    <section class="ap-section">
      <h2>🚨 Open Incidents (${incidents.length})</h2>
      ${this.renderIncidentsTable(incidents)}
    </section>

    <!-- Quick Actions -->
    <section class="ap-section">
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
  generateAPIResponse(): {
    stats: AccountProxyStats;
    accounts: Account[];
    proxies: Proxy[];
    incidents: { open: Incident[]; all: Incident[] };
    health: ReturnType<AccountProxyManager['getHealthSummary']>;
    mappings: ProxyAccountMapping[];
  } {
    return {
      stats: this.manager.getStats(),
      accounts: this.manager.getAllAccounts(),
      proxies: this.manager.getAllProxies(),
      incidents: {
        open: this.manager.getOpenIncidents(),
        all: this.manager.getAllIncidents()
      },
      health: this.manager.getHealthSummary(),
      mappings: this.manager.getMappings()
    };
  }

  // ============================================================
  // RENDERING
  // ============================================================

  private renderStatsCards(stats: AccountProxyStats): string {
    return `
      <div class="ap-stat-card">
        <div class="ap-stat-value" style="color: ${this.getHealthColor(stats.averageHealthScore)}">${stats.totalAccounts}</div>
        <div class="ap-stat-label">Total Accounts</div>
        <div class="ap-stat-sublabel">${stats.activeAccounts} active</div>
      </div>
      
      <div class="ap-stat-card">
        <div class="ap-stat-value">${stats.totalProxies}</div>
        <div class="ap-stat-label">Total Proxies</div>
        <div class="ap-stat-sublabel">${stats.activeProxies} active</div>
      </div>
      
      <div class="ap-stat-card">
        <div class="ap-stat-value" style="color: ${this.getHealthColor(stats.averageHealthScore)}">
          ${stats.averageHealthScore}%
        </div>
        <div class="ap-stat-label">Avg Health</div>
        <div class="ap-stat-sublabel">System health</div>
      </div>
      
      <div class="ap-stat-card ${stats.openIncidents > 0 ? 'ap-alert' : ''}">
        <div class="ap-stat-value" style="color: ${stats.openIncidents > 0 ? '#ef4444' : '#22c55e'}">
          ${stats.openIncidents}
        </div>
        <div class="ap-stat-label">Open Incidents</div>
        <div class="ap-stat-sublabel">${stats.accountsNeedingAttention} need attention</div>
      </div>
      
      <div class="ap-stat-card">
        <div class="ap-stat-value" style="color: ${stats.failingProxies > 0 ? '#ef4444' : '#22c55e'}">
          ${stats.failingProxies}
        </div>
        <div class="ap-stat-label">Failing Proxies</div>
        <div class="ap-stat-sublabel">Need recovery</div>
      </div>
    `;
  }

  private renderHealthDistribution(distribution: { excellent: number; good: number; warning: number; critical: number }): string {
    const total = distribution.excellent + distribution.good + distribution.warning + distribution.critical;
    if (total === 0) return '<p class="ap-empty">No accounts</p>';

    return `
      <div class="ap-health-bars">
        <div class="ap-health-bar">
          <span class="ap-health-label">Excellent (80-100%)</span>
          <div class="ap-health-progress">
            <div class="ap-health-fill ap-excellent" style="width: ${(distribution.excellent / total * 100)}%"></div>
          </div>
          <span class="ap-health-count">${distribution.excellent}</span>
        </div>
        <div class="ap-health-bar">
          <span class="ap-health-label">Good (60-79%)</span>
          <div class="ap-health-progress">
            <div class="ap-health-fill ap-good" style="width: ${(distribution.good / total * 100)}%"></div>
          </div>
          <span class="ap-health-count">${distribution.good}</span>
        </div>
        <div class="ap-health-bar">
          <span class="ap-health-label">Warning (40-59%)</span>
          <div class="ap-health-progress">
            <div class="ap-health-fill ap-warning" style="width: ${(distribution.warning / total * 100)}%"></div>
          </div>
          <span class="ap-health-count">${distribution.warning}</span>
        </div>
        <div class="ap-health-bar">
          <span class="ap-health-label">Critical (<40%)</span>
          <div class="ap-health-progress">
            <div class="ap-health-fill ap-critical" style="width: ${(distribution.critical / total * 100)}%"></div>
          </div>
          <span class="ap-health-count">${distribution.critical}</span>
        </div>
      </div>
    `;
  }

  private renderProxyHealthSummary(proxyHealth: { id: string; status: string; healthScore: number; utilization: number }[]): string {
    if (proxyHealth.length === 0) return '<p class="ap-empty">No proxies</p>';

    return `
      <div class="ap-proxy-health-list">
        ${proxyHealth.map(p => `
          <div class="ap-proxy-health-item ${p.status !== 'active' ? 'ap-warning' : ''}">
            <span class="ap-proxy-id">${p.id}</span>
            <span class="ap-badge ap-status-${p.status}">${p.status}</span>
            <div class="ap-mini-progress">
              <div class="ap-mini-fill" style="width: ${p.healthScore}%; background: ${this.getHealthColor(p.healthScore)}"></div>
            </div>
            <span class="ap-utilization">${Math.round(p.utilization * 100)}%</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderProxyTable(proxies: Proxy[]): string {
    const rows = proxies.map(p => `
      <tr class="${p.status !== 'active' ? 'ap-warning' : ''}">
        <td>${p.id}</td>
        <td>${p.host}:${p.port}</td>
        <td><span class="ap-badge ap-status-${p.status}">${p.status}</span></td>
        <td>${p.assignedAccounts}/${p.maxAccounts}</td>
        <td style="color: ${this.getHealthColor(p.healthScore)}">${p.healthScore}%</td>
        <td>${p.avgResponseTime}ms</td>
        <td>${p.successRate}%</td>
        <td>
          <button onclick="testProxy('${p.id}')">Test</button>
          ${p.status !== 'active' ? `<button onclick="recoverProxy('${p.id}')" class="ap-btn-recover">Recover</button>` : ''}
        </td>
      </tr>
    `).join('');

    return `
      <div class="ap-table-wrapper">
        <table class="ap-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Host</th>
              <th>Status</th>
              <th>Accounts</th>
              <th>Health</th>
              <th>Latency</th>
              <th>Success</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="8" class="ap-empty">No proxies configured</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderAccountTable(accounts: Account[]): string {
    const rows = accounts.map(a => `
      <tr class="${a.status !== 'active' ? 'ap-warning' : ''} ${a.healthScore < 50 ? 'ap-critical' : ''}">
        <td>${a.id}</td>
        <td>${a.name}</td>
        <td>${a.twitterHandle}</td>
        <td><span class="ap-badge ap-phase-${a.phase}">${a.phase}</span></td>
        <td>${a.proxyId}</td>
        <td style="color: ${this.getHealthColor(a.healthScore)}">${a.healthScore}%</td>
        <td>${a.actionsToday}/${a.dailyActionLimit}</td>
        <td>
          <button onclick="checkAccount('${a.id}')">Check</button>
          <button onclick="changeProxy('${a.id}')">Move</button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="ap-table-wrapper">
        <table class="ap-table">
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
            ${rows || '<tr><td colspan="8" class="ap-empty">No accounts created</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderMappings(mappings: ProxyAccountMapping[]): string {
    if (mappings.length === 0) {
      return '<p class="ap-empty-state">No mappings configured</p>';
    }

    return `
      <div class="ap-mappings-grid">
        ${mappings.map(m => `
          <div class="ap-mapping-card ${m.isFull ? 'ap-full' : ''} ${m.proxy.status !== 'active' ? 'ap-inactive' : ''}">
            <div class="ap-mapping-header">
              <span class="ap-proxy-name">${m.proxy.id}</span>
              <span class="ap-badge ap-status-${m.proxy.status}">${m.proxy.status}</span>
              <span class="ap-utilization-badge ${m.isFull ? 'ap-full' : ''}">${m.accounts.length}/${m.proxy.maxAccounts}</span>
            </div>
            <div class="ap-mapping-accounts">
              ${m.accounts.length === 0 ? '<span class="ap-no-accounts">No accounts</span>' : 
                m.accounts.map(a => `
                  <div class="ap-account-chip ${a.status !== 'active' ? 'ap-inactive' : ''}">
                    <span class="ap-account-name">${a.id}</span>
                    <span class="ap-badge ap-phase-${a.phase}">${a.phase}</span>
                    <span class="ap-health-dot" style="background: ${this.getHealthColor(a.healthScore)}"></span>
                  </div>
                `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderIncidentsTable(incidents: Incident[]): string {
    if (incidents.length === 0) {
      return '<p class="ap-empty-state ap-success">✅ No open incidents</p>';
    }

    const rows = incidents.map(i => `
      <tr class="ap-severity-${i.severity}">
        <td>${new Date(i.createdAt).toLocaleString()}</td>
        <td><span class="ap-badge ap-severity-${i.severity}">${i.severity}</span></td>
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
      <div class="ap-table-wrapper">
        <table class="ap-table ap-incidents">
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
      </div>
    `;
  }

  private renderQuickActions(): string {
    return `
      <div class="ap-action-grid">
        <button class="ap-action-btn ap-primary" onclick="runHealthCheck()">
          🏥 Run Health Check
        </button>
        <button class="ap-action-btn" onclick="resetDailyActions()">
          🔄 Reset Daily Actions
        </button>
        <button class="ap-action-btn" onclick="testAllProxies()">
          🔌 Test All Proxies
        </button>
        <button class="ap-action-btn ap-warning" onclick="bulkFailover()">
          ⚠️ Emergency Failover
        </button>
        <button class="ap-action-btn" onclick="exportData()">
          📥 Export Data
        </button>
        <button class="ap-action-btn" onclick="refreshDashboard()">
          🔄 Refresh
        </button>
      </div>
    `;
  }

  // ============================================================
  // STYLES
  // ============================================================

  private getStyles(): string {
    return `
      /* Base Styles */
      * { box-sizing: border-box; margin: 0; padding: 0; }
      
      body.dark {
        --bg-primary: #0f172a;
        --bg-secondary: #1e293b;
        --bg-tertiary: #334155;
        --text-primary: #f8fafc;
        --text-secondary: #e2e8f0;
        --text-muted: #94a3b8;
        --border-color: #334155;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg-primary, #0f172a);
        color: var(--text-secondary, #e2e8f0);
        line-height: 1.6;
      }
      
      .ap-container { max-width: 1400px; margin: 0 auto; padding: 20px; }
      
      /* Header */
      .ap-header { margin-bottom: 30px; }
      .ap-header h1 { font-size: 2rem; color: var(--text-primary, #f8fafc); margin-bottom: 5px; }
      .ap-subtitle { color: var(--text-muted, #94a3b8); }
      
      /* Stats Grid */
      .ap-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
      }
      .ap-stat-card {
        background: var(--bg-secondary, #1e293b);
        padding: 20px;
        border-radius: 12px;
        border: 1px solid var(--border-color, #334155);
        transition: transform 0.2s;
      }
      .ap-stat-card:hover { transform: translateY(-2px); }
      .ap-stat-card.ap-alert { border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }
      .ap-stat-value { font-size: 2.2rem; font-weight: bold; color: #3b82f6; }
      .ap-stat-label { color: var(--text-muted, #94a3b8); font-size: 0.9rem; }
      .ap-stat-sublabel { color: #64748b; font-size: 0.8rem; margin-top: 5px; }
      
      /* Sections */
      .ap-section { margin-bottom: 30px; }
      .ap-section h2 { font-size: 1.3rem; margin-bottom: 15px; color: var(--text-primary, #f8fafc); }
      
      /* Health Grid */
      .ap-health-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
      }
      .ap-health-card {
        background: var(--bg-secondary, #1e293b);
        padding: 20px;
        border-radius: 12px;
        border: 1px solid var(--border-color, #334155);
      }
      .ap-health-card h3 { margin-bottom: 15px; color: var(--text-primary, #f8fafc); }
      
      /* Health Bars */
      .ap-health-bars { display: flex; flex-direction: column; gap: 12px; }
      .ap-health-bar {
        display: grid;
        grid-template-columns: 120px 1fr 40px;
        align-items: center;
        gap: 10px;
      }
      .ap-health-label { font-size: 0.85rem; color: var(--text-muted, #94a3b8); }
      .ap-health-progress {
        height: 8px;
        background: var(--bg-tertiary, #334155);
        border-radius: 4px;
        overflow: hidden;
      }
      .ap-health-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
      .ap-health-fill.ap-excellent { background: #22c55e; }
      .ap-health-fill.ap-good { background: #3b82f6; }
      .ap-health-fill.ap-warning { background: #f59e0b; }
      .ap-health-fill.ap-critical { background: #ef4444; }
      .ap-health-count { font-size: 0.9rem; font-weight: 600; text-align: right; }
      
      /* Two Column */
      .ap-two-column {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-bottom: 30px;
      }
      @media (max-width: 1024px) { .ap-two-column { grid-template-columns: 1fr; } }
      
      /* Tables */
      .ap-table-wrapper { overflow-x: auto; }
      .ap-table {
        width: 100%;
        background: var(--bg-secondary, #1e293b);
        border-radius: 12px;
        overflow: hidden;
        border-collapse: collapse;
      }
      .ap-table th, .ap-table td { padding: 12px 15px; text-align: left; }
      .ap-table th {
        background: var(--bg-tertiary, #334155);
        font-weight: 600;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .ap-table tr { border-bottom: 1px solid var(--border-color, #334155); }
      .ap-table tr:last-child { border-bottom: none; }
      .ap-table tr:hover { background: rgba(51, 65, 85, 0.3); }
      .ap-table tr.ap-warning { background: rgba(245, 158, 11, 0.1); }
      .ap-table tr.ap-critical { background: rgba(239, 68, 68, 0.1); }
      
      /* Badges */
      .ap-badge {
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
      }
      .ap-badge.ap-status-active { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
      .ap-badge.ap-status-failed { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
      .ap-badge.ap-status-maintenance { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
      .ap-badge.ap-phase-warmup { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
      .ap-badge.ap-phase-soft { background: rgba(139, 92, 246, 0.2); color: #8b5cf6; }
      .ap-badge.ap-phase-growth { background: rgba(16, 185, 129, 0.2); color: #10b981; }
      .ap-badge.ap-phase-full { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
      .ap-badge.ap-severity-critical { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
      .ap-badge.ap-severity-high { background: rgba(249, 115, 22, 0.2); color: #f97316; }
      .ap-badge.ap-severity-medium { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
      .ap-badge.ap-severity-low { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
      
      /* Buttons */
      .ap-table button, .ap-action-btn {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
        margin-right: 5px;
        transition: all 0.2s;
      }
      .ap-table button:hover { background: #2563eb; }
      .ap-btn-recover { background: #22c55e !important; }
      .ap-btn-recover:hover { background: #16a34a !important; }
      
      /* Action Grid */
      .ap-action-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 15px;
      }
      .ap-action-btn {
        padding: 15px 20px;
        background: var(--bg-secondary, #1e293b);
        border: 1px solid var(--border-color, #334155);
        border-radius: 10px;
        cursor: pointer;
        font-size: 0.95rem;
        transition: all 0.2s;
      }
      .ap-action-btn:hover { background: var(--bg-tertiary, #334155); transform: translateY(-1px); }
      .ap-action-btn.ap-primary { background: #3b82f6; border-color: #3b82f6; }
      .ap-action-btn.ap-primary:hover { background: #2563eb; }
      .ap-action-btn.ap-warning { background: #f59e0b; border-color: #f59e0b; color: #000; }
      .ap-action-btn.ap-warning:hover { background: #d97706; }
      
      /* Mappings */
      .ap-mappings-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 15px;
      }
      .ap-mapping-card {
        background: var(--bg-secondary, #1e293b);
        border: 1px solid var(--border-color, #334155);
        border-radius: 12px;
        padding: 15px;
        transition: all 0.2s;
      }
      .ap-mapping-card.ap-full { border-color: #f59e0b; }
      .ap-mapping-card.ap-inactive { opacity: 0.6; }
      .ap-mapping-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color, #334155);
      }
      .ap-proxy-name { font-weight: 600; color: var(--text-primary, #f8fafc); }
      .ap-utilization-badge {
        margin-left: auto;
        padding: 2px 8px;
        background: var(--bg-tertiary, #334155);
        border-radius: 12px;
        font-size: 0.8rem;
      }
      .ap-utilization-badge.ap-full { background: #f59e0b; color: #000; }
      .ap-mapping-accounts { display: flex; flex-direction: column; gap: 8px; }
      .ap-account-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--bg-tertiary, #334155);
        border-radius: 8px;
      }
      .ap-account-chip.ap-inactive { opacity: 0.5; }
      .ap-account-name { font-weight: 500; flex: 1; }
      .ap-health-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .ap-no-accounts { color: var(--text-muted, #94a3b8); font-style: italic; }
      
      /* Proxy Health Summary */
      .ap-proxy-health-list { display: flex; flex-direction: column; gap: 10px; }
      .ap-proxy-health-item {
        display: grid;
        grid-template-columns: 80px 70px 1fr 40px;
        align-items: center;
        gap: 10px;
        padding: 8px;
        background: var(--bg-tertiary, #334155);
        border-radius: 8px;
      }
      .ap-proxy-health-item.ap-warning { background: rgba(245, 158, 11, 0.2); }
      .ap-proxy-id { font-weight: 500; }
      .ap-mini-progress {
        height: 6px;
        background: var(--bg-secondary, #1e293b);
        border-radius: 3px;
        overflow: hidden;
      }
      .ap-mini-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
      .ap-utilization { text-align: right; font-size: 0.85rem; }
      
      /* Empty States */
      .ap-empty { text-align: center; color: var(--text-muted, #94a3b8); padding: 40px; }
      .ap-empty-state {
        text-align: center;
        color: var(--text-muted, #94a3b8);
        padding: 30px;
        background: var(--bg-secondary, #1e293b);
        border-radius: 12px;
      }
      .ap-empty-state.ap-success { color: #22c55e; }
      
      /* Severity Row Colors */
      .ap-table tr.ap-severity-critical { background: rgba(239, 68, 68, 0.1); }
      .ap-table tr.ap-severity-high { background: rgba(249, 115, 22, 0.1); }
      .ap-table tr.ap-severity-medium { background: rgba(245, 158, 11, 0.1); }
      .ap-table tr.ap-severity-low { background: rgba(59, 130, 246, 0.1); }
    `;
  }

  // ============================================================
  // SCRIPTS
  // ============================================================

  private getScripts(): string {
    return `
      async function apiCall(endpoint, method = 'GET', data = null) {
        try {
          const options = { 
            method, 
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
          };
          if (data) options.body = JSON.stringify(data);
          const res = await fetch('/api/account-proxy/' + endpoint, options);
          if (!res.ok) throw new Error('API call failed: ' + res.status);
          return await res.json();
        } catch (e) {
          alert('Error: ' + e.message);
          throw e;
        }
      }

      async function testProxy(id) {
        const result = await apiCall('proxies/' + id + '/test', 'POST');
        alert(result.working ? '✅ Proxy working (' + result.responseTime + 'ms)' : '❌ Proxy failed: ' + result.error);
        location.reload();
      }

      async function recoverProxy(id) {
        if (confirm('Attempt to recover proxy ' + id + '?')) {
          const result = await apiCall('proxies/' + id + '/recover', 'POST');
          alert(result.success ? '✅ Proxy recovered' : '❌ Recovery failed');
          location.reload();
        }
      }

      async function checkAccount(id) {
        await apiCall('accounts/' + id + '/check', 'POST');
        alert('Health check completed');
        location.reload();
      }

      async function changeProxy(accountId) {
        const proxyId = prompt('Enter new proxy ID:');
        if (proxyId) {
          const result = await apiCall('accounts/' + accountId + '/move', 'POST', { proxyId });
          if (result.success) {
            alert('✅ Account moved to ' + proxyId);
          } else {
            alert('❌ Failed: ' + result.error);
          }
          location.reload();
        }
      }

      async function resolveIncident(id) {
        const resolution = prompt('Resolution notes:');
        if (resolution) {
          await apiCall('incidents/' + id + '/resolve', 'POST', { resolution });
          location.reload();
        }
      }

      async function acknowledgeIncident(id) {
        await apiCall('incidents/' + id + '/acknowledge', 'POST');
        location.reload();
      }

      async function runHealthCheck() {
        const btn = document.querySelector('button[onclick="runHealthCheck()"]');
        btn.disabled = true;
        btn.textContent = '🏥 Running...';
        
        try {
          await apiCall('health-check', 'POST');
          alert('✅ Health check completed');
          location.reload();
        } catch (e) {
          btn.disabled = false;
          btn.textContent = '🏥 Run Health Check';
        }
      }

      async function resetDailyActions() {
        if (confirm('Reset daily action counters for all accounts?')) {
          await apiCall('reset-actions', 'POST');
          alert('✅ Daily actions reset');
          location.reload();
        }
      }

      async function testAllProxies() {
        const btn = document.querySelector('button[onclick="testAllProxies()"]');
        btn.disabled = true;
        btn.textContent = '🔌 Testing...';
        
        try {
          await apiCall('proxies/test-all', 'POST');
          alert('✅ All proxies tested');
          location.reload();
        } catch (e) {
          btn.disabled = false;
          btn.textContent = '🔌 Test All Proxies';
        }
      }

      async function bulkFailover() {
        if (confirm('⚠️ Emergency failover? This will move all accounts from failed proxies.\n\nContinue?')) {
          const result = await apiCall('failover/bulk', 'POST');
          alert('✅ Failover completed: ' + result.successful + ' accounts moved');
          location.reload();
        }
      }

      async function exportData() {
        const data = await apiCall('export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'account-proxy-data-' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        URL.revokeObjectURL(url);
      }

      function refreshDashboard() {
        location.reload();
      }

      // Auto-refresh every 30 seconds
      setInterval(refreshDashboard, ${this.config.refreshIntervalMs});
      
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
          switch(e.key) {
            case 'r':
              e.preventDefault();
              refreshDashboard();
              break;
            case 'h':
              e.preventDefault();
              runHealthCheck();
              break;
          }
        }
      });
    `;
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  private getHealthColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  }
}

// Factory function
export function createAccountProxyDashboard(
  manager: AccountProxyManager,
  config?: Partial<DashboardConfig>
): AccountProxyDashboard {
  return new AccountProxyDashboard(manager, config);
}
