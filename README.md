# Control Center

Central Command Hub for ALL Skills - Making Elias' job easier.

## Overview

Control Center is a centralized monitoring and control system for all OpenClaw skills. It provides:

- **Skill Registry**: Track all skills and their health status
- **Event Bus**: Async message passing between skills (no direct dependencies)
- **Memory Hub**: Centralized storage with search capabilities
- **Documentation Engine**: Auto-documentation from all actions
- **Dashboard**: Real-time web UI for monitoring

## Installation

```bash
cd control-center
npm install
npm run build
```

## Usage

### Basic Setup

```typescript
import { ControlCenterClient, createClient } from '@openclaw/control-center';

// Create a client for your skill
const cc = createClient('my-skill', 'My Skill Name', {
  version: '1.0.0',
  description: 'Does something useful'
});

// Log actions
cc.log('Starting process...');
cc.logAction({
  action: 'process_data',
  input: { file: 'data.csv' },
  output: { records: 100 },
  duration: 1500,
  success: true
});

// Store data
cc.store('result', { data: 'value' }, { tags: ['processed'] });

// Retrieve data
const result = cc.retrieve('result');

// Search memory
const matches = cc.search('processed');

// Publish events
cc.publish('data.processed', { records: 100 });

// Subscribe to events
cc.subscribe('other-skill.*', (event) => {
  console.log('Received:', event);
});

// Report status
cc.healthy();
cc.warning('Low memory');
cc.error('Connection failed', error);
```

### Starting the Dashboard

```bash
npm run dashboard
```

Then open http://localhost:3000

### Starting Control Center

```typescript
import { controlCenter } from '@openclaw/control-center';

controlCenter.start();
```

## API

### SkillRegistry

```typescript
register(skill: Skill): void
unregister(skillId: string): void
getStatus(skillId: string): SkillStatus
getAll(): Skill[]
getFailed(): Skill[]
restartFailed(): void
```

### EventBus

```typescript
subscribe(pattern: string, handler: EventHandler): string
unsubscribe(id: string): boolean
publish(event: Event): void
request<T>(type: string, payload: unknown): Promise<T>
waitFor(type: string): Promise<Event>
```

### MemoryHub

```typescript
store(key: string, data: unknown, options?: StoreOptions): void
retrieve<T>(key: string): T | undefined
search(query: string, options?: SearchOptions): Result[]
getByTag(tag: string): MemoryEntry[]
```

### DocsEngine

```typescript
logAction(action: Action): string
logDecision(skillId, decision, rationale): string
generateDailyReport(): Report
generateDecisionAudit(): Audit
getActionStats(): ActionStats
```

## Dashboard Features

- Real-time skill status monitoring
- Health indicators and alerts
- Event stream visualization
- Memory usage statistics
- Action logs and error tracking
- One-click skill restart

## Architecture

```
┌─────────────────────────────────────────┐
│           Control Center                │
├─────────────┬─────────────┬─────────────┤
│   Skill     │    Event    │   Memory    │
│  Registry   │    Bus      │    Hub      │
├─────────────┴─────────────┴─────────────┤
│        Documentation Engine             │
├─────────────────────────────────────────┤
│      ControlCenterClient (per skill)    │
└─────────────────────────────────────────┘
```

## Cron Jobs

- **Every 1 min**: Check all skill health
- **Every 5 min**: Generate status report
- **Daily**: Compile documentation

## Benefits

- ✅ One place to see everything
- ✅ One place to control everything
- ✅ Auto-documentation (less work)
- ✅ Auto-logging (less work)
- ✅ Auto-restart failed skills
- ✅ Searchable history

## License

MIT
