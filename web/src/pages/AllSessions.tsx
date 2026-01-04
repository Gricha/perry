import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare,
  Clock,
  Hash,
  ChevronRight,
  Bot,
  ChevronLeft,
  Loader2,
  Copy,
  Check,
  Pencil,
  X,
  FolderOpen,
  Calendar,
  Folder,
} from 'lucide-react'
import Markdown from 'react-markdown'
import { api, type SessionInfoWithWorkspace, type SessionMessage, type AgentType } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
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

function groupSessionsByDate(sessions: SessionInfoWithWorkspace[]): Record<DateGroup, SessionInfoWithWorkspace[]> {
  const groups: Record<DateGroup, SessionInfoWithWorkspace[]> = {
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
  isSelected,
  onClick,
}: {
  session: SessionInfoWithWorkspace
  isSelected: boolean
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
        isSelected && 'bg-accent',
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
          <span className="flex items-center gap-1">
            <Folder className="h-3 w-3" />
            {session.workspaceName}
          </span>
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

      <ChevronRight
        className={cn(
          'h-4 w-4 text-muted-foreground shrink-0',
          isSelected && 'text-primary'
        )}
      />
    </button>
  )
}

function SessionMetadataHeader({ session }: { session: SessionInfoWithWorkspace }) {
  const formattedDate = new Date(session.lastActivity).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const formattedTime = new Date(session.lastActivity).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex items-center gap-4 flex-wrap text-sm">
      <Badge
        variant="outline"
        className={cn('text-xs font-medium', AGENT_COLORS[session.agentType])}
      >
        {AGENT_LABELS[session.agentType]}
      </Badge>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Folder className="h-3.5 w-3.5" />
        <span>{session.workspaceName}</span>
      </div>
      <CopyableSessionId sessionId={session.id} truncate={false} />
      <div className="flex items-center gap-1 text-muted-foreground">
        <Hash className="h-3.5 w-3.5" />
        <span>{session.messageCount} messages</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <FolderOpen className="h-3.5 w-3.5" />
        <span className="font-mono text-xs">{session.projectPath}</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>
          {formattedDate} at {formattedTime}
        </span>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: SessionMessage }) {
  const isUser = message.type === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary/10 text-primary'
            : 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-600'
        )}
      >
        {isUser ? <span className="text-sm">👤</span> : <span className="text-sm">✨</span>}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted/50 border border-border/50 rounded-tl-sm'
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content || '(empty)'}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:bg-background/50 prose-pre:border prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
            <Markdown>{message.content || '(empty)'}</Markdown>
          </div>
        )}
        {message.timestamp && (
          <p
            className={cn('text-[10px] mt-2 opacity-60', isUser ? 'text-right' : 'text-left')}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  )
}

function SessionDetailView({
  session,
  onBack,
  onRename,
}: {
  session: SessionInfoWithWorkspace
  onBack: () => void
  onRename: (workspaceName: string, sessionId: string, name: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(session.name || '')
  const navigate = useNavigate()

  const { data: sessionDetail, isLoading } = useQuery({
    queryKey: ['session', session.workspaceName, session.id],
    queryFn: () => api.getSession(session.workspaceName, session.id),
  })

  const handleSave = () => {
    if (editName.trim()) {
      onRename(session.workspaceName, session.id, editName.trim())
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditName(session.name || '')
    setIsEditing(false)
  }

  const displayTitle = session.name || session.firstPrompt?.slice(0, 80) || 'Untitled Session'

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="border-l pl-3">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 w-64"
                  placeholder="Session name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave()
                    if (e.key === 'Escape') handleCancel()
                  }}
                  data-testid="session-name-input"
                />
                <Button variant="ghost" size="sm" onClick={handleSave}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg">
                  {displayTitle}
                  {!session.name && (session.firstPrompt?.length || 0) > 80 && '...'}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditName(session.name || session.firstPrompt?.slice(0, 80) || '')
                    setIsEditing(true)
                  }}
                  className="h-6 w-6 p-0"
                  data-testid="rename-session-button"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
            <SessionMetadataHeader session={session} />
          </div>
        </div>
        <Button onClick={() => navigate(`/workspaces/${session.workspaceName}/sessions`)}>
          Open in Workspace
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessionDetail?.messages && sessionDetail.messages.length > 0 ? (
            <div className="space-y-6">
              {sessionDetail.messages
                .filter((msg) => msg.type === 'user' || msg.type === 'assistant')
                .map((msg, idx) => (
                  <MessageBubble key={idx} message={msg} />
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No messages in this session</p>
              <p className="text-sm mt-1">This session may have been created but not used</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AllSessions() {
  const queryClient = useQueryClient()
  const [selectedSession, setSelectedSession] = useState<SessionInfoWithWorkspace | null>(null)
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all')

  const {
    data: sessionsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['allSessions', agentFilter],
    queryFn: () =>
      api.listAllSessions(agentFilter === 'all' ? undefined : agentFilter, 100, 0),
  })

  const renameMutation = useMutation({
    mutationFn: ({ workspaceName, sessionId, name }: { workspaceName: string; sessionId: string; name: string }) =>
      api.renameSession(workspaceName, sessionId, name),
    onSuccess: (_, { sessionId, name }) => {
      queryClient.invalidateQueries({ queryKey: ['allSessions'] })
      if (selectedSession?.id === sessionId) {
        setSelectedSession({ ...selectedSession, name })
      }
    },
  })

  const sessions = sessionsData?.sessions || []
  const totalSessions = sessionsData?.total || 0

  const handleRename = (workspaceName: string, sessionId: string, name: string) => {
    renameMutation.mutate({ workspaceName, sessionId, name })
  }

  if (selectedSession) {
    return (
      <SessionDetailView
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
        onRename={handleRename}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All Sessions</h1>
          <p className="text-sm text-muted-foreground">Sessions from all running workspaces</p>
        </div>
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
              onValueChange={(value) => {
                setAgentFilter(value as AgentType | 'all')
                setSelectedSession(null)
              }}
            >
              <DropdownMenuRadioItem value="all">All Agents</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="claude-code">Claude Code</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="opencode">OpenCode</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="codex">Codex</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
            <p className="text-muted-foreground">No sessions found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sessions will appear here when you run coding agents in your workspaces
            </p>
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
                      key={`${session.workspaceName}-${session.id}`}
                      session={session}
                      isSelected={false}
                      onClick={() => setSelectedSession(session)}
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
