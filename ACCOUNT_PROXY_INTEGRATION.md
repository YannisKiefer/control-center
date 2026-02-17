# Account + Proxy Management Integration

## Overview

The Account + Proxy Management system has been fully integrated into the Control Center. This creates a unified command hub for managing:

- **Skills** - X Automation ecosystem skills
- **Accounts** - Twitter accounts with proxy assignments
- **Proxies** - MarsProxies ISP rotation
- **Incidents** - Health issues and failures

## Architecture

```
/control-center/src/
├── index.ts                    # Main Control Center with integrated AP
├── types.ts                    # Extended types (Account, Proxy, Incident)
├── registry.ts                 # Skill registry
├── eventBus.ts                 # Event system
├── memoryHub.ts                # Unified memory
├── accountProxy/               # NEW: Integrated module
│   ├── index.ts               # Module exports
│   ├── mapping.ts             # Account-Proxy mapping
│   ├── health.ts              # Health monitoring
│   ├── failover.ts            # Failover system
│   ├── marsProxies.ts         # MarsProxies integration
│   ├── dashboard.ts           # Unified dashboard
│   └── database/
│       ├── client.ts          # Unified SQLite client
│       └── schema.ts          # Database schema
```

## Unified Database

The system now uses a single SQLite database (`control_center.db`) with tables:

- `proxies` - Proxy configurations
- `accounts` - Account information
- `mappings` - Account-Proxy relationships
- `incidents` - Failure tracking
- `health_check_logs` - Health check history

## API Usage

```typescript
import { ControlCenter } from './control-center/src/index.js';

const cc = new ControlCenter({
  dbPath: './data/control_center.db'
});

// Start the system
cc.start();

// Skills
await cc.registry.start('bioforge');
await cc.registry.stop('bioforge');

// Accounts (NEW)
await cc.accounts.createAccount({
  id: 'ella_001',
  name: 'Ella Sophie',
  twitterHandle: '@ellasophiee',
  adspowerProfileId: 'profile_123'
});

const allAccounts = cc.db.getAllAccounts();
const accountHealth = cc.health.getHealthSummary();

// Proxies (NEW)
const proxies = cc.db.getAllProxies();
await cc.health.checkAllProxies();

// Failover (NEW)
await cc.failover.handleProxyFailure('ella_001');
await cc.failover.recoverProxy('mars_001');

// Dashboard
const html = cc.getDashboardHTML();
const api = cc.getDashboardAPI();

// Stop the system
cc.stop();
```

## Dashboard

The unified dashboard provides tabs for:

1. **Overview** - Combined system status
2. **Skills** - Skill management
3. **Accounts** - Account list with health scores
4. **Proxies** - Proxy status and testing
5. **Incidents** - Open incidents

### Quick Actions

- Run Health Check
- Test All Proxies
- Reset Daily Actions
- Emergency Failover
- Restart All Skills
- Export Data

## Monitoring

The integrated monitoring system checks:

1. **Skills** - Heartbeat, health scores
2. **Accounts** - Status, action limits, spam scores
3. **Proxies** - Connectivity, response time
4. **Mappings** - Validation (2 accounts max per proxy)

Events are published to the EventBus for reactive handling.

## Migration from Separate System

If you were using the separate `/management/accountProxy/` system:

1. **Database**: The new system uses `control_center.db` instead of `account_proxy.db`
2. **Imports**: Update imports from `../accountProxy/` to `../control-center/src/index.js`
3. **API**: The API is compatible but now accessed via `ControlCenter` instance

## Configuration

Environment variables:

```bash
DB_ENCRYPTION_KEY=your-encryption-key  # For proxy password encryption
```

## Success Criteria

- [x] Account+Proxy inside Control Center
- [x] One dashboard for everything
- [x] Unified monitoring
- [x] Single database
- [x] One API for all operations
