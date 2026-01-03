import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MessageSquare, Clock, Hash, Play, ChevronRight } from 'lucide-react'
import { api, type SessionInfo, type SessionMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Terminal } from '@/components/Terminal'
import { cn } from '@/lib/utils'

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

function SessionListItem({
  session,
  isSelected,
  onClick,
}: {
  session: SessionInfo
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent',
        isSelected && 'bg-accent border-primary/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-normal">
              {session.agentType}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(session.lastActivity)}
            </span>
          </div>
          <p className="text-sm truncate text-muted-foreground">
            {session.firstPrompt || 'No prompt'}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {session.messageCount} messages
            </span>
            <span className="truncate">{session.projectPath}</span>
          </div>
        </div>
        <ChevronRight
          className={cn('h-4 w-4 text-muted-foreground flex-shrink-0 mt-1', isSelected && 'text-primary')}
        />
      </div>
    </button>
  )
}

function MessageBubble({ message }: { message: SessionMessage }) {
  const isUser = message.type === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content || '(empty)'}</p>
        {message.timestamp && (
          <p className={cn('text-xs mt-1', isUser ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}

export function Sessions() {
  const { name: workspaceName } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [showTerminal, setShowTerminal] = useState(false)
  const [terminalCommand, setTerminalCommand] = useState<string | null>(null)

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
    queryKey: ['sessions', workspaceName],
    queryFn: () => api.listSessions(workspaceName!),
    enabled: !!workspaceName && workspace?.status === 'running',
  })

  const { data: sessionDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['session', workspaceName, selectedSessionId],
    queryFn: () => api.getSession(workspaceName!, selectedSessionId!),
    enabled: !!workspaceName && !!selectedSessionId,
  })

  const sessions = sessionsData?.sessions || []

  const handleResume = (sessionId: string) => {
    setTerminalCommand(`claude -r ${sessionId}`)
    setShowTerminal(true)
  }

  const handleNewChat = () => {
    setTerminalCommand('claude')
    setShowTerminal(true)
  }

  if (!workspaceName) {
    return null
  }

  if (workspace?.status !== 'running') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/workspaces/${workspaceName}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Sessions</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Workspace is not running</p>
            <Button onClick={() => navigate(`/workspaces/${workspaceName}`)}>Go to Workspace</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showTerminal) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setShowTerminal(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Button>
          <h1 className="text-2xl font-bold">Claude Code</h1>
        </div>
        <Card>
          <CardContent className="p-0">
            <Terminal workspaceName={workspaceName} initialCommand={terminalCommand || undefined} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/workspaces/${workspaceName}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Sessions</h1>
        </div>
        <Button onClick={handleNewChat}>
          <Play className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
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
            <Button onClick={handleNewChat}>
              <Play className="mr-2 h-4 w-4" />
              Start a new chat
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              {sessions.length} session{sessions.length !== 1 && 's'}
            </h2>
            {sessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                isSelected={selectedSessionId === session.id}
                onClick={() => setSelectedSessionId(session.id)}
              />
            ))}
          </div>

          <div>
            {selectedSessionId ? (
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">Session Preview</CardTitle>
                    <CardDescription>
                      {sessions.find((s) => s.id === selectedSessionId)?.projectPath}
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={() => handleResume(selectedSessionId)}>
                    <Play className="mr-2 h-3 w-3" />
                    Resume
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoadingDetail ? (
                    <div className="animate-pulse space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-muted rounded-lg" />
                      ))}
                    </div>
                  ) : sessionDetail?.messages && sessionDetail.messages.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {sessionDetail.messages.slice(0, 20).map((msg, idx) => (
                        <MessageBubble key={idx} message={msg} />
                      ))}
                      {sessionDetail.messages.length > 20 && (
                        <p className="text-center text-sm text-muted-foreground py-2">
                          ... and {sessionDetail.messages.length - 20} more messages
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No messages in this session</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Select a session to preview</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
