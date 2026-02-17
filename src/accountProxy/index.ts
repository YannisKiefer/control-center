/**
 * Account + Proxy Management Module
 * Integrated into Control Center
 * 
 * Exports:
 * - Database client and schema
 * - Account-Proxy mapping system
 * - Health monitoring
 * - Failover system
 * - MarsProxies integration
 * - Unified dashboard
 */

// Database
export { DatabaseClient, DashboardStats } from './database/client';
export {
  Account,
  Proxy,
  Mapping,
  Incident,
  IncidentType,
  HealthCheckLog,
  fullSchemaSQL,
  defaultProxiesSQL
} from './database/schema';

// Core Systems
export {
  AccountProxyMapping,
  AccountConfig,
  MappingResult,
  ProxyAccountMapping,
  ValidationResult,
  BulkCreateResult
} from './mapping';

export {
  HealthMonitor,
  HealthCheckConfig,
  HealthCheckResult,
  HealthSummary
} from './health';

export {
  ProxyFailover,
  FailoverConfig,
  FailoverResult,
  FailoverStatus
} from './failover';

// Integrations
export {
  MarsProxiesClient,
  MarsProxyConfig
} from './marsProxies';

// Dashboard
export {
  UnifiedDashboard,
  UnifiedDashboardConfig
} from './dashboard';
