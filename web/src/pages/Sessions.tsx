import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  Hash,
  Play,
  ChevronRight,
  Bot,
  Loader2,
  Copy,
  Check,
  Settings,
} from 'lucide-react'
import { api, type SessionInfo, type AgentType } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Chat } from '@/components/Chat'
import { Terminal } from '@/components/Terminal'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const AGENT_LABELS: Record<AgentType | 'all', string> = {
  all: 'All Agents',
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
  codex: 'Codex',
}

const AGENT_BADGES: Record<AgentType, string> = {
  'claude-code': 'CC',
  opencode: 'OC',
  codex: 'CX',
}

const AGENT_COLORS: Record<AgentType, string> = {
  'claude-code': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  opencode: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  codex: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Older'

function getDateGroup(dateString: string): DateGroup {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (sessionDate.getTime() >= today.getTime()) return 'Today'
  if (sessionDate.getTime() >= yesterday.getTime()) return 'Yesterday'
  if (sessionDate.getTime() >= weekAgo.getTime()) return 'This Week'
  return 'Older'
}

function groupSessionsByDate(sessions: SessionInfo[]): Record<DateGroup, SessionInfo[]> {
  const groups: Record<DateGroup, SessionInfo[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  }

  for (const session of sessions) {
    const group = getDateGroup(session.lastActivity)
    groups[group].push(session)
  }

  return groups
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function CopyableSessionId({ sessionId, truncate = true }: { sessionId: string; truncate?: boolean }) {
  const [copied, setCopied] = useState(false)
  const displayId = truncate ? sessionId.slice(0, 8) : sessionId

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors group"
      title={`Click to copy: ${sessionId}`}
      data-testid="session-id"
    >
      <span>{displayId}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  )
}

function SessionListItem({
  session,
  onClick,
}: {
  session: SessionInfo
  onClick: () => void
}) {
  const isEmpty = session.messageCount === 0
  const hasPrompt = session.firstPrompt && session.firstPrompt.trim().length > 0
  const displayTitle = session.name || (hasPrompt ? session.firstPrompt : 'No prompt recorded')

  return (
    <button
      onClick={onClick}
      data-testid="session-list-item"
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-accent/50 flex items-center gap-4',
        isEmpty && 'opacity-60'
      )}
    >
      <span
        className={cn(
          'shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded',
          AGENT_COLORS[session.agentType]
        )}
        data-testid="agent-badge"
      >
        [{AGENT_BADGES[session.agentType]}]
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'text-sm font-medium truncate',
              hasPrompt || session.name ? 'text-foreground' : 'text-muted-foreground italic'
            )}
          >
            {displayTitle}
          </p>
          {isEmpty && (
            <Badge variant="secondary" className="text-[10px] font-normal bg-muted text-muted-foreground shrink-0">
              Empty
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <CopyableSessionId sessionId={session.id} />
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {session.messageCount}
          </span>
          <span className="truncate font-mono text-[11px]">{session.projectPath}</span>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>{formatTimeAgo(session.lastActivity)}</span>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  )
}

type ChatMode = { type: 'chat'; sessionId?: string } | { type: 'terminal'; command: string }

export function Sessions() {
  const { name: workspaceName } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const [chatMode, setChatMode] = useState<ChatMode | null>(null)
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all')

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceName],
    queryFn: () => api.getWorkspace(workspaceName!),
    enabled: !!workspaceName,
  })

  const {
    data: sessionsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sessions', workspaceName, agentFilter],
    queryFn: () =>
      api.listSessions(workspaceName!, agentFilter === 'all' ? undefined : agentFilter, 50, 0),
    enabled: !!workspaceName && workspace?.status === 'running',
  })

  const sessions = sessionsData?.sessions || []
  const totalSessions = sessionsData?.total || 0

  const handleResume = (sessionId: string, agentType: AgentType) => {
    if (agentType === 'claude-code') {
      setChatMode({ type: 'chat', sessionId })
    } else {
      const commands: Record<AgentType, string> = {
        'claude-code': `claude -r ${sessionId}`,
        opencode: `opencode --resume ${sessionId}`,
        codex: `codex resume ${sessionId}`,
      }
      setChatMode({ type: 'terminal', command: commands[agentType] })
    }
  }

  const handleNewChat = (agentType: AgentType = 'claude-code') => {
    if (agentType === 'claude-code') {
      setChatMode({ type: 'chat' })
    } else {
      const commands: Record<AgentType, string> = {
        'claude-code': 'claude',
        opencode: 'opencode',
        codex: 'codex',
      }
      setChatMode({ type: 'terminal', command: commands[agentType] })
    }
  }

  if (!workspaceName) {
    return null
  }

  if (workspace?.status !== 'running') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/workspaces/${workspaceName}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Sessions</h1>
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Workspace is not running</p>
            <p className="text-sm text-muted-foreground mb-4">
              Start the workspace to view and create sessions
            </p>
            <Button onClick={() => navigate(`/workspaces/${workspaceName}`)}>
              Go to Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (chatMode) {
    if (chatMode.type === 'chat') {
      return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" onClick={() => setChatMode(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sessions
            </Button>
            <h1 className="text-2xl font-bold">Claude Code</h1>
          </div>
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-0 h-full">
              <Chat
                workspaceName={workspaceName}
                sessionId={chatMode.sessionId}
              />
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setChatMode(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Button>
          <h1 className="text-2xl font-bold">Agent Terminal</h1>
        </div>
        <Card>
          <CardContent className="p-0">
            <Terminal workspaceName={workspaceName} initialCommand={chatMode.command} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/workspaces')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Sessions</h1>
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/workspaces/${workspaceName}`)}
            title="Workspace settings"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Bot className="mr-2 h-4 w-4" />
                {AGENT_LABELS[agentFilter]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={agentFilter}
                onValueChange={(value) => setAgentFilter(value as AgentType | 'all')}
              >
                <DropdownMenuRadioItem value="all">All Agents</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="claude-code">Claude Code</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="opencode">OpenCode</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="codex">Codex</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Play className="mr-2 h-4 w-4" />
                New Chat
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleNewChat('claude-code')}>
                <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                Claude Code
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewChat('opencode')}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                OpenCode
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewChat('codex')}>
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                Codex
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">{(error as Error).message}</p>
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No sessions found</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Play className="mr-2 h-4 w-4" />
                  Start a new chat
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleNewChat('claude-code')}>
                  <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                  Claude Code
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNewChat('opencode')}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                  OpenCode
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNewChat('codex')}>
                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                  Codex
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            {totalSessions} session{totalSessions !== 1 && 's'}
            {sessions.length < totalSessions && ` (showing ${sessions.length})`}
          </p>
          <div className="border rounded-lg overflow-hidden" data-testid="sessions-list">
            {(['Today', 'Yesterday', 'This Week', 'Older'] as DateGroup[]).map((group) => {
              const groupedSessions = groupSessionsByDate(sessions)
              const groupSessions = groupedSessions[group]
              if (groupSessions.length === 0) return null
              return (
                <div key={group} data-testid={`date-group-${group.toLowerCase().replace(' ', '-')}`}>
                  <div className="px-4 py-2 bg-muted/50 border-b border-border/50 sticky top-0">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {group}
                    </span>
                  </div>
                  {groupSessions.map((session) => (
                    <SessionListItem
                      key={session.id}
                      session={session}
                      onClick={() => handleResume(session.id, session.agentType)}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
