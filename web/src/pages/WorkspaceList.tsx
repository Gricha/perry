import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Boxes, ChevronRight, Sparkles } from 'lucide-react'
import { api, type WorkspaceInfo, type CreateWorkspaceRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function StatCard({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-4 rounded-lg border bg-card/50",
      accent && "border-primary/30 bg-primary/5"
    )}>
      <span className={cn(
        "text-2xl font-bold tabular-nums",
        accent && "text-primary"
      )}>{value}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  )
}

function WorkspaceRow({ workspace, onClick }: { workspace: WorkspaceInfo; onClick: () => void }) {
  const isRunning = workspace.status === 'running'
  const isError = workspace.status === 'error'

  return (
    <button
      onClick={onClick}
      data-testid="workspace-row"
      className="w-full flex items-center gap-4 px-4 py-4 border-b border-border/50 hover:bg-accent/50 transition-colors text-left group"
    >
      <div className="relative">
        <span className={cn(
          "block h-2.5 w-2.5 rounded-full",
          isRunning && "bg-emerald-500",
          isError && "bg-destructive",
          !isRunning && !isError && "bg-muted-foreground/40"
        )} />
        {isRunning && (
          <span className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{workspace.name}</span>
          {isRunning && (
            <span className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-medium">
              Running
            </span>
          )}
          {isError && (
            <span className="text-[10px] uppercase tracking-wider text-destructive font-medium">
              Error
            </span>
          )}
        </div>
        {workspace.repo && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">{workspace.repo}</p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
    </button>
  )
}

export function WorkspaceList() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRepo, setNewRepo] = useState('')

  const { data: workspaces, isLoading, error, refetch } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateWorkspaceRequest) => api.createWorkspace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setShowCreate(false)
      setNewName('')
      setNewRepo('')
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({
      name: newName.trim(),
      clone: newRepo.trim() || undefined,
    })
  }

  const handleRowClick = (ws: WorkspaceInfo) => {
    navigate(`/workspaces/${ws.name}/sessions`)
  }

  const totalCount = workspaces?.length || 0
  const runningCount = workspaces?.filter(ws => ws.status === 'running').length || 0

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-destructive mb-4">Failed to load workspaces</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your development workspaces
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="ghost" size="icon" className="text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Workspace
          </Button>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && totalCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard value={totalCount} label="Workspaces" />
          <StatCard value={runningCount} label="Running" accent={runningCount > 0} />
          <StatCard value={totalCount - runningCount} label="Stopped" />
          <StatCard value="—" label="Sessions" />
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Create Workspace</CardTitle>
            <CardDescription>Set up a new isolated development environment</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="my-project"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repo">Repository <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="repo"
                    type="text"
                    value={newRepo}
                    onChange={(e) => setNewRepo(e.target.value)}
                    placeholder="https://github.com/user/repo"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={createMutation.isPending || !newName.trim()}>
                  {createMutation.isPending ? 'Creating...' : 'Create Workspace'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
              </div>
              {createMutation.error && (
                <p className="text-sm text-destructive">
                  {(createMutation.error as Error).message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* Workspace list */}
      {isLoading ? (
        <div className="rounded-lg border bg-card/50">
          <div className="animate-pulse">
            <div className="h-16 border-b border-border/50 bg-muted/20" />
            <div className="h-16 border-b border-border/50 bg-muted/10" />
            <div className="h-16 bg-muted/5" />
          </div>
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-card/30">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Boxes className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">No workspaces yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Create your first workspace to get started with an isolated development environment.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first workspace
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Workspaces
            </h2>
          </div>
          <div className="rounded-lg border bg-card/50 overflow-hidden">
            {workspaces?.map((ws: WorkspaceInfo) => (
              <WorkspaceRow
                key={ws.name}
                workspace={ws}
                onClick={() => handleRowClick(ws)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick tips */}
      {!isLoading && totalCount > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium">Quick tip:</span>{' '}
              <span className="text-muted-foreground">
                Use <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">workspace shell {'<name>'}</code> from your terminal to SSH directly into any workspace.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
