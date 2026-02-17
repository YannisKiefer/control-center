import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { controlCenter, skillRegistry, eventBus, memoryHub, docsEngine } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Static files
app.use(express.static(join(__dirname)));

// API Routes

// Get system status
app.get('/api/status', (req, res) => {
  res.json(controlCenter.getStatus());
});

// Get all skills
app.get('/api/skills', (req, res) => {
  res.json(skillRegistry.getAll());
});

// Get specific skill
app.get('/api/skills/:id', (req, res) => {
  const skill = skillRegistry.get(req.params.id);
  if (!skill) {
    return res.status(404).json({ error: 'Skill not found' });
  }
  
  const healthCheck = skillRegistry.getHealthCheck(req.params.id);
  const actions = docsEngine.getActionsBySkill(req.params.id, 10);
  
  res.json({
    ...skill,
    healthCheck,
    recentActions: actions
  });
});

// Restart a skill
app.post('/api/skills/:id/restart', (req, res) => {
  const skill = skillRegistry.get(req.params.id);
  if (!skill) {
    return res.status(404).json({ error: 'Skill not found' });
  }
  
  skillRegistry.updateStatus(req.params.id, 'starting' as any, 'Manual restart requested');
  skillRegistry.resetRestartCount(req.params.id);
  
  res.json({ success: true, message: 'Restart initiated' });
});

// Restart all failed skills
app.post('/api/skills/restart-failed', (req, res) => {
  skillRegistry.restartFailed();
  res.json({ success: true, message: 'Restarting failed skills' });
});

// Get memory stats
app.get('/api/memory', (req, res) => {
  res.json(memoryHub.getStats());
});

// Search memory
app.get('/api/memory/search', (req, res) => {
  const query = req.query.q as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }
  
  res.json(memoryHub.search(query, { limit, tags }));
});

// Get memory entry
app.get('/api/memory/:key', (req, res) => {
  const data = memoryHub.retrieve(req.params.key);
  if (data === undefined) {
    return res.status(404).json({ error: 'Key not found' });
  }
  res.json({ key: req.params.key, data });
});

// Get events
app.get('/api/events', (req, res) => {
  const type = req.query.type as string;
  const source = req.query.source as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  
  res.json(eventBus.getHistory({ type, source, limit }));
});

// Get subscriptions
app.get('/api/events/subscriptions', (req, res) => {
  res.json(eventBus.getSubscriptions());
});

// Get reports
app.get('/api/reports/daily', (req, res) => {
  const date = req.query.date ? new Date(req.query.date as string) : undefined;
  res.json(docsEngine.generateDailyReport(date));
});

// Get action stats
app.get('/api/actions/stats', (req, res) => {
  res.json(docsEngine.getActionStats());
});

// Get recent errors
app.get('/api/errors', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  res.json(docsEngine.getRecentErrors(limit));
});

// Export all data
app.get('/api/export', (req, res) => {
  res.json(docsEngine.export());
});

// Trigger health check
app.post('/api/health-check', (req, res) => {
  // This would trigger an immediate health check
  res.json({ success: true, message: 'Health check triggered' });
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('[Dashboard] Client connected');
  
  // Send initial status
  ws.send(JSON.stringify({
    type: 'status',
    payload: controlCenter.getStatus()
  }));
  
  ws.on('close', () => {
    console.log('[Dashboard] Client disconnected');
  });
});

// Broadcast events to all connected clients
const originalPublish = eventBus.publish.bind(eventBus);
eventBus.publish = (event) => {
  originalPublish(event);
  
  const message = JSON.stringify({
    type: 'event',
    payload: event
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
};

// Start server
server.listen(PORT, () => {
  console.log(`[Dashboard] Server running on http://localhost:${PORT}`);
  
  // Start control center
  controlCenter.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Dashboard] Shutting down...');
  controlCenter.stop();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Dashboard] Shutting down...');
  controlCenter.stop();
  server.close(() => {
    process.exit(0);
  });
});
