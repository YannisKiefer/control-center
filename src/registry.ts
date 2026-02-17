/**
 * Skill Registry
 * 
 * Central registry for all skills in the X Automation Ecosystem.
 * Provides auto-discovery, health monitoring, and lifecycle management.
 */

import { EventEmitter } from 'events';

export interface Skill {
  id: string;
  name: string;
  version: string;
  type: 'content' | 'engagement' | 'xreacher' | 'autonomous';
  status: 'running' | 'paused' | 'error' | 'stopped';
  health: number; // 0-100
  lastActivity: Date;
  metadata: {
    description: string;
    author: string;
    dependencies: string[];
  };
  config: Record<string, any>;
  stats: {
    calls: number;
    errors: number;
    avgResponseTime: number;
  };
}

export interface SkillRegistration {
  id: string;
  name: string;
  version: string;
  type: Skill['type'];
  metadata: Skill['metadata'];
  config?: Record<string, any>;
}

export class SkillRegistry extends EventEmitter {
  private skills: Map<string, Skill> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHealthChecks();
  }

  /**
   * Register a new skill
   */
  register(registration: SkillRegistration): Skill {
    const skill: Skill = {
      ...registration,
      status: 'stopped',
      health: 100,
      lastActivity: new Date(),
      config: registration.config || {},
      stats: {
        calls: 0,
        errors: 0,
        avgResponseTime: 0,
      },
    };

    this.skills.set(registration.id, skill);
    this.emit('skill:registered', skill);
    
    console.log(`[SkillRegistry] Registered: ${skill.name} v${skill.version}`);
    
    return skill;
  }

  /**
   * Unregister a skill
   */
  unregister(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    this.skills.delete(skillId);
    this.emit('skill:unregistered', skill);
    
    console.log(`[SkillRegistry] Unregistered: ${skill.name}`);
    
    return true;
  }

  /**
   * Get a skill by ID
   */
  get(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Get all skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by type
   */
  getByType(type: Skill['type']): Skill[] {
    return this.getAll().filter(skill => skill.type === type);
  }

  /**
   * Get skills by status
   */
  getByStatus(status: Skill['status']): Skill[] {
    return this.getAll().filter(skill => skill.status === status);
  }

  /**
   * Start a skill
   */
  start(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.status = 'running';
    skill.lastActivity = new Date();
    
    this.emit('skill:started', skill);
    console.log(`[SkillRegistry] Started: ${skill.name}`);
    
    return true;
  }

  /**
   * Stop a skill
   */
  stop(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.status = 'stopped';
    skill.lastActivity = new Date();
    
    this.emit('skill:stopped', skill);
    console.log(`[SkillRegistry] Stopped: ${skill.name}`);
    
    return true;
  }

  /**
   * Pause a skill
   */
  pause(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.status = 'paused';
    skill.lastActivity = new Date();
    
    this.emit('skill:paused', skill);
    console.log(`[SkillRegistry] Paused: ${skill.name}`);
    
    return true;
  }

  /**
   * Mark a skill as error
   */
  setError(skillId: string, error: Error): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.status = 'error';
    skill.health = Math.max(0, skill.health - 20);
    skill.stats.errors++;
    skill.lastActivity = new Date();
    
    this.emit('skill:error', { skill, error });
    console.error(`[SkillRegistry] Error in ${skill.name}:`, error.message);
    
    return true;
  }

  /**
   * Update skill health
   */
  updateHealth(skillId: string, health: number): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.health = Math.max(0, Math.min(100, health));
    
    if (skill.health < 50 && skill.status === 'running') {
      this.emit('skill:unhealthy', skill);
    }
    
    return true;
  }

  /**
   * Record a skill call
   */
  recordCall(skillId: string, responseTime: number, error?: Error): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.stats.calls++;
    skill.lastActivity = new Date();
    
    // Update average response time
    const total = skill.stats.calls;
    skill.stats.avgResponseTime = 
      (skill.stats.avgResponseTime * (total - 1) + responseTime) / total;
    
    if (error) {
      skill.stats.errors++;
      skill.health = Math.max(0, skill.health - 5);
    }
    
    return true;
  }

  /**
   * Start all skills
   */
  startAll(): void {
    for (const skill of this.skills.values()) {
      this.start(skill.id);
    }
  }

  /**
   * Stop all skills
   */
  stopAll(): void {
    for (const skill of this.skills.values()) {
      this.stop(skill.id);
    }
  }

  /**
   * Restart failed skills
   */
  restartFailed(): string[] {
    const failed = this.getByStatus('error');
    const restarted: string[] = [];
    
    for (const skill of failed) {
      skill.health = 100;
      this.start(skill.id);
      restarted.push(skill.id);
    }
    
    return restarted;
  }

  /**
   * Auto-discover skills from filesystem
   */
  async autoDiscover(skillsPath: string): Promise<Skill[]> {
    const fs = require('fs');
    const path = require('path');
    
    const discovered: Skill[] = [];
    
    try {
      const entries = fs.readdirSync(skillsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(skillsPath, entry.name);
          const skillFile = path.join(skillPath, 'SKILL.md');
          
          if (fs.existsSync(skillFile)) {
            // Parse SKILL.md for metadata
            const content = fs.readFileSync(skillFile, 'utf-8');
            const name = this.extractFromMarkdown(content, 'Name:') || entry.name;
            const type = this.inferType(entry.name);
            
            const skill = this.register({
              id: entry.name.toLowerCase(),
              name,
              version: '1.0.0',
              type,
              metadata: {
                description: this.extractFromMarkdown(content, '## Overview') || '',
                author: 'Elias',
                dependencies: [],
              },
            });
            
            discovered.push(skill);
          }
        }
      }
    } catch (error) {
      console.error('[SkillRegistry] Auto-discovery failed:', error);
    }
    
    return discovered;
  }

  /**
   * Get system overview
   */
  getOverview() {
    const all = this.getAll();
    
    return {
      total: all.length,
      running: all.filter(s => s.status === 'running').length,
      paused: all.filter(s => s.status === 'paused').length,
      error: all.filter(s => s.status === 'error').length,
      stopped: all.filter(s => s.status === 'stopped').length,
      avgHealth: all.reduce((sum, s) => sum + s.health, 0) / all.length || 0,
      byType: {
        content: this.getByType('content').length,
        engagement: this.getByType('engagement').length,
        xreacher: this.getByType('xreacher').length,
        autonomous: this.getByType('autonomous').length,
      },
    };
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      for (const skill of this.skills.values()) {
        if (skill.status === 'running') {
          // Simulate health check
          const healthDrop = Math.random() > 0.9 ? Math.floor(Math.random() * 5) : 0;
          
          if (healthDrop > 0) {
            this.updateHealth(skill.id, skill.health - healthDrop);
          }
          
          // Auto-restart if health is critical
          if (skill.health < 20 && skill.status !== 'error') {
            console.log(`[SkillRegistry] Auto-restarting ${skill.name} due to low health`);
            this.setError(skill.id, new Error('Health critical'));
            setTimeout(() => this.restartFailed(), 5000);
          }
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Extract value from markdown
   */
  private extractFromMarkdown(content: string, key: string): string | null {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes(key)) {
        return line.split(key)[1]?.trim() || null;
      }
    }
    return null;
  }

  /**
   * Infer skill type from name
   */
  private inferType(name: string): Skill['type'] {
    const contentSkills = ['post', 'caption', 'thread', 'bio', 'content'];
    const engagementSkills = ['comment', 'research', 'dm', 'engagement'];
    const xreacherSkills = ['lead', 'conversion', 'cupid', 'xreacher'];
    
    const lowerName = name.toLowerCase();
    
    if (contentSkills.some(s => lowerName.includes(s))) return 'content';
    if (engagementSkills.some(s => lowerName.includes(s))) return 'engagement';
    if (xreacherSkills.some(s => lowerName.includes(s))) return 'xreacher';
    
    return 'autonomous';
  }
}

// Singleton instance
let registry: SkillRegistry | null = null;

export function getSkillRegistry(): SkillRegistry {
  if (!registry) {
    registry = new SkillRegistry();
  }
  return registry;
}