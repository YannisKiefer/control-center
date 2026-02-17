'use client'

import { useState, useEffect } from 'react'
import { 
  Cpu, 
  Activity, 
  Zap, 
  Shield, 
  MessageSquare, 
  FileText, 
  Search,
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Clock,
  Terminal,
  Database,
  Radio,
  Settings,
  LogOut,
  LayoutDashboard,
  BookOpen,
  History,
  BarChart3,
  Bell,
  Users
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

// WebSocket connection for real-time updates
const WS_URL = 'ws://localhost:3002'

// Mock data - will be replaced with WebSocket data
const mockSkills = [
  { id: 'postArchitect', name: 'PostArchitect', status: 'running', health: 98, lastActivity: '2 min ago', type: 'content' },
  { id: 'captionWiz', name: 'CaptionWiz', status: 'running', health: 97, lastActivity: '5 min ago', type: 'content' },
  { id: 'threadSmith', name: 'ThreadSmith', status: 'running', health: 95, lastActivity: '12 min ago', type: 'content' },
  { id: 'bioForge', name: 'BioForge', status: 'running', health: 99, lastActivity: '1 hour ago', type: 'content' },
  { id: 'commentCraft', name: 'CommentCraft', status: 'running', health: 94, lastActivity: '3 min ago', type: 'engagement' },
  { id: 'researcher', name: 'Researcher', status: 'running', health: 96, lastActivity: '15 min ago', type: 'engagement' },
  { id: 'dmDancer', name: 'DMDancer', status: 'running', health: 92, lastActivity: '8 min ago', type: 'engagement' },
  { id: 'leadGenerator', name: 'LeadGenerator', status: 'running', health: 98, lastActivity: '30 min ago', type: 'xreacher' },
  { id: 'conversionAnalyzer', name: 'ConversionAnalyzer', status: 'running', health: 97, lastActivity: '45 min ago', type: 'xreacher' },
  { id: 'cupidBotOptimizer', name: 'CupidBotOptimizer', status: 'running', health: 93, lastActivity: '2 hours ago', type: 'xreacher' },
  { id: 'xreacherConnector', name: 'XReacherConnector', status: 'running', health: 95, lastActivity: '5 min ago', type: 'xreacher' },
]

const mockEvents = [
  { id: 1, timestamp: '16:02:34', skill: 'PostArchitect', event: 'content.created', data: 'Generated 3 posts', severity: 'info' },
  { id: 2, timestamp: '16:01:12', skill: 'CommentCraft', event: 'comment.posted', data: '@ella_001: 5 comments', severity: 'info' },
  { id: 3, timestamp: '16:00:45', skill: 'XReacherConnector', event: 'dm.sent', data: 'Batch 42: 1,234 DMs', severity: 'info' },
  { id: 4, timestamp: '15:58:22', skill: 'Researcher', event: 'viral.detected', data: '@wheelchair_influencer post trending', severity: 'warning' },
  { id: 5, timestamp: '15:55:01', skill: 'DMDancer', event: 'dm.received', data: '@ella_003: 12 new replies', severity: 'info' },
  { id: 6, timestamp: '15:52:18', skill: 'ConversionAnalyzer', event: 'conversion.achieved', data: '+3 OnlyFans subs', severity: 'success' },
  { id: 7, timestamp: '15:50:33', skill: 'CTOGuardian', event: 'health.check', data: 'All systems healthy', severity: 'info' },
  { id: 8, timestamp: '15:45:12', skill: 'BioForge', event: 'ab.test.completed', data: 'Variant B wins (+15%)', severity: 'success' },
]

const mockMetrics = [
  { time: '15:00', events: 45, skills: 11, errors: 0 },
  { time: '15:15', events: 52, skills: 11, errors: 1 },
  { time: '15:30', events: 48, skills: 11, errors: 0 },
  { time: '15:45', events: 61, skills: 11, errors: 0 },
  { time: '16:00', events: 58, skills: 11, errors: 0 },
]

const mockLogs = `
[16:02:34] INFO: PostArchitect - Generated 3 posts for @ella_sophie_village
[16:01:45] INFO: CaptionWiz - Optimized captions with 94% hook score
[16:01:12] INFO: CommentCraft - Posted 5 comments, 2 viral targets
[16:00:45] INFO: XReacherConnector - Sent batch 42 (1,234 DMs)
[15:58:22] WARN: Researcher - Viral opportunity detected
[15:55:01] INFO: DMDancer - Processing 12 new DM replies
[15:52:18] SUCCESS: ConversionAnalyzer - 3 new conversions tracked
[15:50:33] INFO: CTOGuardian - Health check passed (98% avg)
[15:45:12] SUCCESS: BioForge - A/B test winner: Variant B
[15:30:22] INFO: LeadGenerator - Generated 10,000 leads for tomorrow
`

export default function ControlCenter() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // WebSocket connection (mock for now)
  useEffect(() => {
    // const ws = new WebSocket(WS_URL)
    // ws.onopen = () => setWsConnected(true)
    // ws.onclose = () => setWsConnected(false)
    setWsConnected(true) // Mock connected
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'paused': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      case 'stopped': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-blue-600 bg-blue-100'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'content': return FileText
      case 'engagement': return MessageSquare
      case 'xreacher': return Zap
      default: return Cpu
    }
  }

  const filteredSkills = mockSkills.filter(skill => 
    skill.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredEvents = mockEvents.filter(event =>
    event.skill.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.event.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="relative">
                <Cpu className="h-10 w-10 text-blue-500 mr-4" />
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Control Center</h1>
                <p className="text-sm text-gray-400">X Automation Ecosystem | Elias Command Hub</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 bg-gray-700 rounded-lg px-4 py-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search skills, events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-64"
                />
              </div>
              
              <div className="text-right">
                <p className="text-lg font-mono">{currentTime.toLocaleTimeString()}</p>
                <p className="text-xs text-gray-400">{currentTime.toLocaleDateString()}</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-400">{wsConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 border-r border-gray-700 min-h-screen">
          <nav className="p-4 space-y-2">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'skills', label: 'Skill Registry', icon: Cpu },
              { id: 'events', label: 'Event Bus', icon: Radio },
              { id: 'memory', label: 'Memory Hub', icon: Database },
              { id: 'docs', label: 'Documentation', icon: BookOpen },
              { id: 'logs', label: 'System Logs', icon: Terminal },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            ))}
            <a 
              href="/team" 
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors text-gray-300 hover:bg-gray-700"
            >
              <Users className="w-5 h-5 mr-3" />
              Team Dashboard
            </a>
          </nav>
          
          <div className="absolute bottom-0 w-64 p-4 border-t border-gray-700">
            <button className="w-full flex items-center px-4 py-3 text-gray-400 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Active Skills</p>
                      <p className="text-3xl font-bold">{mockSkills.filter(s => s.status === 'running').length}/11</p>
                    </div>
                    <Cpu className="h-10 w-10 text-blue-500" />
                  </div>
                  <div className="mt-4 flex items-center">
                    <div className="w-full bg-gray-700 rounded-full h-2 mr-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }} />
                    </div>
                    <span className="text-sm text-green-400">100%</span>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Events/Min</p>
                      <p className="text-3xl font-bold">48</p>
                    </div>
                    <Activity className="h-10 w-10 text-purple-500" />
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <TrendUp className="w-4 h-4 text-green-400 mr-1" />
                    <span className="text-green-400">+12%</span>
                    <span className="text-gray-500 ml-1">vs last hour</span>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Avg Health</p>
                      <p className="text-3xl font-bold">95%</p>
                    </div>
                    <Shield className="h-10 w-10 text-green-500" />
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400 mr-1" />
                    <span className="text-green-400">All healthy</span>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Conversions</p>
                      <p className="text-3xl font-bold">+12</p>
                    </div>
                    <Zap className="h-10 w-10 text-yellow-500" />
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <span className="text-gray-400">Today: 0.8% rate</span>
                  </div>
                </div>
              </div>

              {/* Charts & Live Feed */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-lg font-medium mb-4">System Activity</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mockMetrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="time" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="events" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="Events" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Live Event Stream</h3>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
                      <span className="text-sm text-gray-400">Live</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {mockEvents.map((event) => (
                      <div key={event.id} className="flex items-center p-3 bg-gray-700/50 rounded-lg">
                        <span className="text-xs text-gray-400 font-mono w-20">{event.timestamp}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium mr-3 ${getSeverityColor(event.severity)}`}>
                          {event.skill}
                        </span>
                        <span className="text-sm text-gray-300 flex-1">{event.data}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
                <div className="flex flex-wrap gap-4">
                  <button className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start All Skills
                  </button>
                  <button className="flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Pause All
                  </button>
                  <button className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restart Failed
                  </button>
                  <button className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Report
                  </button>
                  <button className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Backup Memory
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Skill Registry</h2>
                <div className="flex space-x-2">
                  <span className="px-3 py-1 bg-green-900 text-green-300 rounded-full text-sm">11 Running</span>
                  <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm">0 Paused</span>
                  <span className="px-3 py-1 bg-red-900 text-red-300 rounded-full text-sm">0 Error</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSkills.map((skill) => {
                  const Icon = getTypeIcon(skill.type)
                  return (
                    <div 
                      key={skill.id}
                      className={`bg-gray-800 rounded-lg p-6 border cursor-pointer transition-all hover:border-blue-500 ${
                        selectedSkill === skill.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-700'
                      }`}
                      onClick={() => setSelectedSkill(skill.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center">
                          <div className="p-3 bg-gray-700 rounded-lg mr-4">
                            <Icon className="w-6 h-6 text-blue-400" />
                          </div>
                          <div>
                            <h3 className="font-medium">{skill.name}</h3>
                            <p className="text-sm text-gray-400 capitalize">{skill.type}</p>
                          </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(skill.status)}`} />
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Health</span>
                          <span className={skill.health >= 90 ? 'text-green-400' : skill.health >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                            {skill.health}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${skill.health >= 90 ? 'bg-green-500' : skill.health >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${skill.health}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="mt-4 flex justify-between items-center">
                        <span className="text-xs text-gray-500">Last: {skill.lastActivity}</span>
                        <div className="flex space-x-2">
                          <button className="p-1 hover:bg-gray-700 rounded">
                            <Play className="w-4 h-4" />
                          </button>
                          <button className="p-1 hover:bg-gray-700 rounded">
                            <Pause className="w-4 h-4" />
                          </button>
                          <button className="p-1 hover:bg-gray-700 rounded">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Event Bus</h2>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
                    <span className="text-sm text-gray-400">Processing: 48 events/min</span>
                  </div>
                  <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                  >
                    Clear Filter
                  </button>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Skill</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Event</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {filteredEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-700/50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-400">{event.timestamp}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-gray-700 rounded text-sm">{event.skill}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-blue-400">{event.event}</td>
                        <td className="px-6 py-4 text-sm text-gray-300">{event.data}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(event.severity)}`}>
                            {event.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Memory Hub</h2>
                <div className="flex space-x-2">
                  <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                  >
                    Export All
                  </button>
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                  >
                    Search Memory
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center mb-4">
                    <Database className="w-8 h-8 text-blue-500 mr-3" />
                    <div>
                      <h3 className="font-medium">Calendar Store</h3>
                      <p className="text-sm text-gray-400">Daily plans</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold">47 files</p>
                  <p className="text-sm text-gray-500">2.3 MB total</p>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center mb-4">
                    <History className="w-8 h-8 text-purple-500 mr-3" />
                    <div>
                      <h3 className="font-medium">Daily Logs</h3>
                      <p className="text-sm text-gray-400">Activity history</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold">156 entries</p>
                  <p className="text-sm text-gray-500">45 days retained</p>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center mb-4">
                    <FileText className="w-8 h-8 text-green-500 mr-3" />
                    <div>
                      <h3 className="font-medium">Reports</h3>
                      <p className="text-sm text-gray-400">Generated docs</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold">23 reports</p>
                  <p className="text-sm text-gray-500">12 PDFs, 11 MD</p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-medium mb-4">Recent Memory Access</h3>
                <div className="space-y-3">
                  {[
                    { file: 'calendar/2026-02-17.json', action: 'READ', time: '2 min ago', size: '45 KB' },
                    { file: '2026-02-16.md', action: 'WRITE', time: '5 min ago', size: '12 KB' },
                    { file: 'skills/postArchitect/config.json', action: 'READ', time: '8 min ago', size: '3 KB' },
                    { file: 'analytics/conversions.db', action: 'WRITE', time: '12 min ago', size: '1.2 MB' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 text-gray-400 mr-3" />
                        <span className="text-sm font-mono">{item.file}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`px-2 py-1 rounded text-xs ${item.action === 'WRITE' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>
                          {item.action}
                        </span>
                        <span className="text-sm text-gray-400">{item.size}</span>
                        <span className="text-sm text-gray-500">{item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">System Logs</h2>
                <div className="flex space-x-2">
                  <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                  >
                    Download
                  </button>
                  <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                  >
                    Clear Logs
                  </button>
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 font-mono text-sm overflow-auto max-h-96">
                <pre className="text-gray-300">{mockLogs}</pre>
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Documentation Engine</h2>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                  Generate Daily Report
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-lg font-medium mb-4">Auto-Generated Reports</h3>
                  <div className="space-y-3">
                    {[
                      { name: 'Daily Summary - Feb 16', type: 'PDF', time: 'Today 9:00 PM', status: 'ready' },
                      { name: 'Weekly Optimization - Week 7', type: 'PDF', time: 'Yesterday', status: 'ready' },
                      { name: 'A/B Test Results - Bio Hook', type: 'MD', time: '2 days ago', status: 'ready' },
                      { name: 'Conversion Funnel Analysis', type: 'PDF', time: '3 days ago', status: 'ready' },
                    ].map((report, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div>
                          <p className="font-medium">{report.name}</p>
                          <p className="text-sm text-gray-400">{report.time}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 bg-gray-600 rounded text-xs">{report.type}</span>
                          <button className="p-1 hover:bg-gray-600 rounded">
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-lg font-medium mb-4">Documentation Status</h3>
                  <div className="space-y-4">
                    {[
                      { name: 'System Architecture', status: 'current', lastUpdate: 'Today' },
                      { name: 'Skill Documentation', status: 'current', lastUpdate: 'Today' },
                      { name: 'API Reference', status: 'current', lastUpdate: 'Today' },
                      { name: 'Deployment Guide', status: 'current', lastUpdate: 'Today' },
                    ].map((doc, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-gray-300">{doc.name}</span>
                        <div className="flex items-center">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-400">{doc.lastUpdate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">System Analytics</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-lg font-medium mb-4">Event Processing Rate</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mockMetrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="time" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                        <Line type="monotone" dataKey="events" stroke="#3B82F6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-lg font-medium mb-4">Skill Health Over Time</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mockMetrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="time" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                        <Area type="monotone" dataKey="skills" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Control Center Settings</h2>
              
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-medium mb-4">System Configuration</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-gray-700">
                    <div>
                      <p className="font-medium">Auto-Restart Failed Skills</p>
                      <p className="text-sm text-gray-400">Automatically restart skills that crash</p>
                    </div>
                    <div className="w-12 h-6 bg-green-600 rounded-full relative cursor-pointer">
                      <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b border-gray-700">
                    <div>
                      <p className="font-medium">Real-Time Event Streaming</p>
                      <p className="text-sm text-gray-400">Stream events to dashboard via WebSocket</p>
                    </div>
                    <div className="w-12 h-6 bg-green-600 rounded-full relative cursor-pointer">
                      <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b border-gray-700">
                    <div>
                      <p className="font-medium">Auto-Documentation</p>
                      <p className="text-sm text-gray-400">Generate daily reports automatically</p>
                    </div>
                    <div className="w-12 h-6 bg-green-600 rounded-full relative cursor-pointer">
                      <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center py-3">
                    <div>
                      <p className="font-medium">Debug Mode</p>
                      <p className="text-sm text-gray-400">Enable verbose logging</p>
                    </div>
                    <div className="w-12 h-6 bg-gray-600 rounded-full relative cursor-pointer">
                      <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// Helper component for trend indicator
function TrendUp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}