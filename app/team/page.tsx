'use client'

import { useState, useEffect } from 'react'
import { 
  Crown, 
  BarChart3, 
  Search, 
  FileText, 
  MessageSquare, 
  Palette, 
  Link2, 
  Mail, 
  Rocket, 
  Heart, 
  Twitter, 
  Shield, 
  CheckCircle, 
  Brain, 
  Zap, 
  Image, 
  UserPlus, 
  Server,
  Clock,
  Activity,
  Users,
  Calendar,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react'

// Agent data structure
const teamData = {
  leadership: [
    {
      id: 'coo',
      name: 'COO Agent',
      icon: Crown,
      schedule: '24/7',
      scheduleType: 'always',
      color: 'from-yellow-500 to-amber-600',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      responsibilities: [
        'Strategic decisions',
        'Resource allocation',
        'Goal setting',
        'Performance review'
      ]
    },
    {
      id: 'executive',
      name: 'Executive Agent',
      icon: BarChart3,
      schedule: 'Every 15 min',
      scheduleType: 'frequent',
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      responsibilities: [
        'Priority queue management',
        'Task distribution',
        'Resource optimization'
      ]
    }
  ],
  skillAgents: [
    {
      id: 'researcher',
      name: 'ResearcherAgent',
      icon: Search,
      schedule: 'Daily 6:00 AM',
      scheduleType: 'daily',
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      responsibilities: [
        'Find 10,000 leads daily',
        'Viral content detection',
        'Competitor analysis'
      ]
    },
    {
      id: 'postArchitect',
      name: 'PostArchitectAgent',
      icon: FileText,
      schedule: 'Daily 9:00 AM',
      scheduleType: 'daily',
      color: 'from-indigo-500 to-blue-600',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/30',
      responsibilities: [
        'Content calendar creation',
        'Post scheduling',
        'Viral opportunity integration'
      ]
    },
    {
      id: 'captionWiz',
      name: 'CaptionWizAgent',
      icon: MessageSquare,
      schedule: 'On-demand',
      scheduleType: 'ondemand',
      color: 'from-pink-500 to-rose-600',
      bgColor: 'bg-pink-500/10',
      borderColor: 'border-pink-500/30',
      responsibilities: [
        'Scroll-stopping captions',
        'Hook generation',
        'Emoji optimization'
      ]
    },
    {
      id: 'commentCraft',
      name: 'CommentCraftAgent',
      icon: MessageSquare,
      schedule: 'Every 2 hours',
      scheduleType: 'frequent',
      color: 'from-cyan-500 to-teal-600',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      responsibilities: [
        'Viral comment creation',
        'Engagement strategy',
        'Reply management'
      ]
    },
    {
      id: 'bioForge',
      name: 'BioForgeAgent',
      icon: Palette,
      schedule: 'Weekly (Sun)',
      scheduleType: 'weekly',
      color: 'from-emerald-500 to-green-600',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      responsibilities: [
        'Profile optimization',
        'A/B testing',
        'Conversion tracking'
      ]
    },
    {
      id: 'threadSmith',
      name: 'ThreadSmithAgent',
      icon: Link2,
      schedule: 'Tue/Thu 10:00 AM',
      scheduleType: 'scheduled',
      color: 'from-orange-500 to-amber-600',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      responsibilities: [
        'Viral thread creation',
        'Story arc development',
        'Engagement optimization'
      ]
    },
    {
      id: 'dmDancer',
      name: 'DMDancerAgent',
      icon: Mail,
      schedule: 'Daily 3:00 PM',
      scheduleType: 'daily',
      color: 'from-rose-500 to-pink-600',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      responsibilities: [
        'DM conversation flow',
        'Conversion optimization',
        'Objection handling'
      ]
    },
    {
      id: 'xReacher',
      name: 'XReacherAgent',
      icon: Rocket,
      schedule: 'Daily 7:00 AM',
      scheduleType: 'daily',
      color: 'from-violet-500 to-purple-600',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/30',
      responsibilities: [
        'Mass DM campaigns',
        'Lead list upload',
        'Campaign monitoring'
      ]
    },
    {
      id: 'cupidBot',
      name: 'CupidBotAgent',
      icon: Heart,
      schedule: 'Daily 6:00 PM',
      scheduleType: 'daily',
      color: 'from-red-500 to-rose-600',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      responsibilities: [
        'Script optimization',
        'Conversion analysis',
        'A/B test deployment'
      ]
    },
    {
      id: 'adsPower',
      name: 'AdsPowerAgent',
      icon: Twitter,
      schedule: 'Every hour',
      scheduleType: 'frequent',
      color: 'from-sky-500 to-blue-600',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/30',
      responsibilities: [
        'Twitter posting',
        'Liking & commenting',
        'Browser automation'
      ]
    },
    {
      id: 'ctoGuardian',
      name: 'CTOGuardianAgent',
      icon: Shield,
      schedule: 'Every 15 min',
      scheduleType: 'frequent',
      color: 'from-slate-500 to-gray-600',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      responsibilities: [
        'Health monitoring',
        'Bug detection & fixing',
        'Performance reporting'
      ]
    }
  ],
  qualityAgents: [
    {
      id: 'qualityAssurance',
      name: 'QualityAssuranceAgent',
      icon: CheckCircle,
      schedule: 'Real-time',
      scheduleType: 'realtime',
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      responsibilities: [
        '10/10 quality enforcement',
        'Content review',
        'Retry logic'
      ]
    },
    {
      id: 'contextPersistence',
      name: 'ContextPersistenceAgent',
      icon: Brain,
      schedule: 'Hourly',
      scheduleType: 'frequent',
      color: 'from-teal-500 to-cyan-600',
      bgColor: 'bg-teal-500/10',
      borderColor: 'border-teal-500/30',
      responsibilities: [
        'Memory management',
        'Context injection',
        'Belief updates'
      ]
    },
    {
      id: 'realTimeFeedback',
      name: 'RealTimeFeedbackAgent',
      icon: Zap,
      schedule: 'Real-time',
      scheduleType: 'realtime',
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-400/10',
      borderColor: 'border-yellow-400/30',
      responsibilities: [
        'Instant learning',
        'Adjustment application',
        'Performance tracking'
      ]
    }
  ],
  supportAgents: [
    {
      id: 'imageAnalyzer',
      name: 'ImageAnalyzerAgent',
      icon: Image,
      schedule: 'Daily 5:00 AM',
      scheduleType: 'daily',
      color: 'from-fuchsia-500 to-pink-600',
      bgColor: 'bg-fuchsia-500/10',
      borderColor: 'border-fuchsia-500/30',
      responsibilities: [
        'Image analysis (Drive)',
        'Engagement scoring',
        'Caption suggestions'
      ]
    },
    {
      id: 'accountOnboarding',
      name: 'AccountOnboardingAgent',
      icon: UserPlus,
      schedule: 'On-demand',
      scheduleType: 'ondemand',
      color: 'from-lime-500 to-green-600',
      bgColor: 'bg-lime-500/10',
      borderColor: 'border-lime-500/30',
      responsibilities: [
        'Account import',
        'Email/password change',
        'Proxy assignment'
      ]
    },
    {
      id: 'proxyManager',
      name: 'ProxyManagerAgent',
      icon: Server,
      schedule: 'Daily',
      scheduleType: 'daily',
      color: 'from-blue-600 to-indigo-700',
      bgColor: 'bg-blue-600/10',
      borderColor: 'border-blue-600/30',
      responsibilities: [
        'Health checks',
        'Failover management',
        'Assignment tracking'
      ]
    }
  ]
}

// Cron schedule timeline data
const cronTimeline = [
  { time: '00:00', task: 'Account Tracker', detail: 'Day +1 rollover' },
  { time: '00:15', task: 'Health Check', detail: 'System diagnostics' },
  { time: '00:30', task: 'Metrics Collector', detail: 'Performance data' },
  { time: '01:00', task: 'A/B Test Analyzer', detail: 'Statistical analysis' },
  { time: '02:00', task: 'Improvement Suggester', detail: 'Optimization ideas' },
  { time: '05:00', task: 'Image Analyzer', detail: 'Drive scan' },
  { time: '06:00', task: 'ResearcherAgent', detail: '10k leads generation' },
  { time: '07:00', task: 'XReacherAgent', detail: 'Campaign start' },
  { time: '08:00', task: 'Proxy Health Check', detail: 'Infrastructure check' },
  { time: '09:00', task: 'PostArchitectAgent', detail: 'Content planning' },
  { time: '10:00', task: 'ThreadSmithAgent', detail: 'Tue/Thu only' },
  { time: '12:00', task: 'Midday Check', detail: 'Status review' },
  { time: '15:00', task: 'DMDancerAgent', detail: 'DM phase' },
  { time: '18:00', task: 'CupidBotAgent', detail: 'Analysis phase' },
  { time: '21:00', task: 'Daily Report', detail: 'Summary generation' },
  { time: '23:00', task: 'Daily Memory', detail: 'Compilation & archive' }
]

// Status types
const statusTypes = {
  healthy: { color: 'bg-green-500', label: 'Healthy', textColor: 'text-green-400' },
  running: { color: 'bg-blue-500', label: 'Running', textColor: 'text-blue-400' },
  standby: { color: 'bg-yellow-500', label: 'Standby', textColor: 'text-yellow-400' },
  offline: { color: 'bg-gray-500', label: 'Offline', textColor: 'text-gray-400' }
}

export default function TeamDashboard() {
  const [expandedSections, setExpandedSections] = useState({
    leadership: true,
    skillAgents: true,
    qualityAgents: true,
    supportAgents: true
  })
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [agentStatuses, setAgentStatuses] = useState<Record<string, keyof typeof statusTypes>>({})

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Initialize random statuses for demo
  useEffect(() => {
    const statuses: Record<string, keyof typeof statusTypes> = {}
    const allAgents = [
      ...teamData.leadership,
      ...teamData.skillAgents,
      ...teamData.qualityAgents,
      ...teamData.supportAgents
    ]
    allAgents.forEach(agent => {
      const rand = Math.random()
      if (rand > 0.9) statuses[agent.id] = 'standby'
      else if (rand > 0.95) statuses[agent.id] = 'offline'
      else if (agent.scheduleType === 'realtime' || agent.scheduleType === 'always') statuses[agent.id] = 'running'
      else statuses[agent.id] = 'healthy'
    })
    setAgentStatuses(statuses)
  }, [])

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const getScheduleBadgeColor = (type: string) => {
    switch (type) {
      case 'always': return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      case 'realtime': return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'frequent': return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'daily': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
      case 'weekly': return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      case 'scheduled': return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
      case 'ondemand': return 'bg-pink-500/20 text-pink-300 border-pink-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  const AgentCard = ({ agent, category }: { agent: typeof teamData.skillAgents[0], category: string }) => {
    const Icon = agent.icon
    const status = agentStatuses[agent.id] || 'healthy'
    const statusInfo = statusTypes[status]
    const isSelected = selectedAgent === agent.id

    return (
      <div
        onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
        className={`relative rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden ${
          isSelected 
            ? `${agent.bgColor} ${agent.borderColor} ring-2 ring-opacity-50` 
            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
        }`}
        style={{ 
          boxShadow: isSelected ? `0 0 30px -5px ${agent.color.includes('from-') ? agent.color.split(' ')[0].replace('from-', '') : agent.color}` : undefined 
        }}
      >
        {/* Status indicator */}
        <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${statusInfo.color} animate-pulse`} />
        
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${agent.color} shadow-lg`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{agent.name}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border mt-1 ${getScheduleBadgeColor(agent.scheduleType)}`}>
                <Clock className="w-3 h-3 mr-1" />
                {agent.schedule}
              </span>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-medium ${statusInfo.textColor}`}>
              ● {statusInfo.label}
            </span>
            <span className="text-xs text-gray-500">• {category}</span>
          </div>

          {/* Responsibilities */}
          <div className={`space-y-1.5 transition-all duration-300 ${isSelected ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Responsibilities</p>
            {agent.responsibilities.map((resp, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-gray-500 mt-1">├─</span>
                <span>{resp}</span>
              </div>
            ))}
          </div>

          {/* Collapsed view hint */}
          {!isSelected && (
            <div className="text-xs text-gray-500 mt-2">
              {agent.responsibilities.length} responsibilities
            </div>
          )}
        </div>

        {/* Gradient border effect when selected */}
        {isSelected && (
          <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${agent.color} opacity-10 pointer-events-none`} />
        )}
      </div>
    )
  }

  const SectionHeader = ({ 
    title, 
    icon: Icon, 
    section, 
    count 
  }: { 
    title: string, 
    icon: React.ElementType, 
    section: keyof typeof expandedSections,
    count: number
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-gray-800/80 border border-gray-700 rounded-xl mb-4 hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-700 rounded-lg">
          <Icon className="w-5 h-5 text-gray-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <span className="text-sm text-gray-400">{count} agents</span>
        </div>
      </div>
      {expandedSections[section] ? (
        <ChevronDown className="w-5 h-5 text-gray-400" />
      ) : (
        <ChevronRight className="w-5 h-5 text-gray-400" />
      )}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Team Dashboard
                </h1>
                <p className="text-sm text-gray-400">Autonomous Agent Ecosystem Overview</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 rounded-lg">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300">19 Active Agents</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-mono text-gray-200">{currentTime.toLocaleTimeString()}</p>
                <p className="text-xs text-gray-500">{currentTime.toLocaleDateString()}</p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Navigation */}
        <aside className="w-64 bg-gray-800/50 border-r border-gray-700 min-h-screen p-4">
          <nav className="space-y-2">
            <a href="/" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors">
              <Activity className="w-5 h-5" />
              Overview
            </a>
            <a href="/team" className="flex items-center gap-3 px-4 py-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg">
              <Users className="w-5 h-5" />
              Team
            </a>
            <a href="/schedule" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors">
              <Calendar className="w-5 h-5" />
              Schedule
            </a>
            <a href="/logs" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors">
              <BarChart3 className="w-5 h-5" />
              Analytics
            </a>
          </nav>

          {/* Quick Stats */}
          <div className="mt-8 p-4 bg-gray-800 rounded-xl border border-gray-700">
            <h3 className="text-sm font-medium text-gray-300 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total Agents</span>
                <span className="text-sm font-semibold text-white">19</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Active</span>
                <span className="text-sm font-semibold text-green-400">17</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Standby</span>
                <span className="text-sm font-semibold text-yellow-400">2</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Offline</span>
                <span className="text-sm font-semibold text-gray-500">0</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Leadership Section */}
            <section>
              <SectionHeader 
                title="Leadership" 
                icon={Crown} 
                section="leadership" 
                count={teamData.leadership.length} 
              />
              {expandedSections.leadership && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamData.leadership.map(agent => (
                    <AgentCard key={agent.id} agent={agent} category="Leadership" />
                  ))}
                </div>
              )}
            </section>

            {/* Skill Agents Section */}
            <section>
              <SectionHeader 
                title="Skill Agents" 
                icon={Zap} 
                section="skillAgents" 
                count={teamData.skillAgents.length} 
              />
              {expandedSections.skillAgents && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {teamData.skillAgents.map(agent => (
                    <AgentCard key={agent.id} agent={agent} category="Skill" />
                  ))}
                </div>
              )}
            </section>

            {/* Quality Agents Section */}
            <section>
              <SectionHeader 
                title="Quality Agents" 
                icon={CheckCircle} 
                section="qualityAgents" 
                count={teamData.qualityAgents.length} 
              />
              {expandedSections.qualityAgents && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {teamData.qualityAgents.map(agent => (
                    <AgentCard key={agent.id} agent={agent} category="Quality" />
                  ))}
                </div>
              )}
            </section>

            {/* Support Agents Section */}
            <section>
              <SectionHeader 
                title="Support Agents" 
                icon={Server} 
                section="supportAgents" 
                count={teamData.supportAgents.length} 
              />
              {expandedSections.supportAgents && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {teamData.supportAgents.map(agent => (
                    <AgentCard key={agent.id} agent={agent} category="Support" />
                  ))}
                </div>
              )}
            </section>

            {/* Cron Schedule Timeline */}
            <section className="mt-8">
              <div className="p-4 bg-gray-800/80 border border-gray-700 rounded-xl mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-700 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Cron Schedule Timeline</h2>
                    <span className="text-sm text-gray-400">Daily automation schedule</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800 border-b border-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Agent/Task</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {cronTimeline.map((item, idx) => {
                        const hour = parseInt(item.time.split(':')[0])
                        const currentHour = currentTime.getHours()
                        const isPast = hour < currentHour
                        const isCurrent = hour === currentHour
                        
                        return (
                          <tr 
                            key={idx} 
                            className={`transition-colors ${
                              isCurrent ? 'bg-blue-500/10 border-l-4 border-blue-500' : 
                              isPast ? 'opacity-50' : 'hover:bg-gray-800'
                            }`}
                          >
                            <td className="px-6 py-3 whitespace-nowrap">
                              <span className={`font-mono text-sm ${isCurrent ? 'text-blue-400 font-semibold' : 'text-gray-400'}`}>
                                {item.time}
                              </span>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              <span className={`text-sm font-medium ${isCurrent ? 'text-white' : 'text-gray-300'}`}>
                                {item.task}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <span className="text-sm text-gray-400">{item.detail}</span>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              {isCurrent ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1.5 animate-pulse" />
                                  Current
                                </span>
                              ) : isPast ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Completed
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400 border border-gray-600">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Scheduled
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Legend */}
            <section className="mt-8 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Status Legend</h3>
              <div className="flex flex-wrap gap-4">
                {Object.entries(statusTypes).map(([key, info]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${info.color}`} />
                    <span className="text-sm text-gray-400">{info.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
