import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Save, RefreshCw, FolderSync, ArrowRight, Boxes, CheckCircle2, XCircle } from 'lucide-react'
import { api, type Credentials } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type SyncResult = {
  synced: number
  failed: number
  results: { name: string; success: boolean; error?: string }[]
}

export function FilesSettings() {
  const queryClient = useQueryClient()

  const { data: credentials, isLoading, error, refetch } = useQuery({
    queryKey: ['credentials'],
    queryFn: api.getCredentials,
  })

  const [files, setFiles] = useState<Array<{ dest: string; source: string }>>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  useEffect(() => {
    if (credentials && !initialized) {
      setFiles(Object.entries(credentials.files).map(([dest, source]) => ({ dest, source })))
      setInitialized(true)
    }
  }, [credentials, initialized])

  const mutation = useMutation({
    mutationFn: (data: Credentials) => api.updateCredentials(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
      setHasChanges(false)
    },
  })

  const syncAllMutation = useMutation({
    mutationFn: () => api.syncAllWorkspaces(),
    onSuccess: (data) => {
      setSyncResult(data)
    },
  })

  const handleSave = () => {
    const filesObj: Record<string, string> = {}
    for (const { dest, source } of files) {
      if (dest.trim() && source.trim()) {
        filesObj[dest.trim()] = source.trim()
      }
    }
    mutation.mutate({ env: credentials?.env || {}, files: filesObj })
  }

  const addFile = () => {
    setFiles([...files, { dest: '', source: '' }])
    setHasChanges(true)
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  const updateFile = (index: number, field: 'dest' | 'source', value: string) => {
    const updated = [...files]
    updated[index] = { ...updated[index], [field]: value }
    setFiles(updated)
    setHasChanges(true)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-destructive mb-4 text-center">
          <p className="font-medium">Failed to load settings</p>
          <p className="text-sm text-muted-foreground mt-1">Please check your connection</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">Files</h1>
          <p className="page-description">Files synced from host to workspaces</p>
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-secondary rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Files</h1>
        <p className="page-description">Files synced from host to workspaces (e.g., SSH keys, config files)</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="section-header flex-1 mb-0 border-b-0">File Mappings</div>
          <div className="flex gap-2">
            <Button onClick={addFile} variant="outline" size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
            <Button
              onClick={handleSave}
              disabled={mutation.isPending || !hasChanges}
              size="sm"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="border border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
            <FolderSync className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No files configured</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Click "Add" to sync files from host to workspaces</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2 sm:items-center group p-3 sm:p-0 bg-muted/30 sm:bg-transparent rounded-lg sm:rounded-none">
                <Input
                  type="text"
                  value={file.source}
                  onChange={(e) => updateFile(index, 'source', e.target.value)}
                  placeholder="~/.ssh/id_rsa (source)"
                  className="flex-1 font-mono text-sm h-11 sm:h-9"
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 rotate-90 sm:rotate-0 self-center" />
                <Input
                  type="text"
                  value={file.dest}
                  onChange={(e) => updateFile(index, 'dest', e.target.value)}
                  placeholder="~/.ssh/id_rsa (dest)"
                  className="flex-1 font-mono text-sm h-11 sm:h-9"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="self-end sm:self-auto opacity-70 sm:opacity-40 group-hover:opacity-100 transition-opacity h-11 w-11 sm:h-9 sm:w-9"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {mutation.error && (
          <div className="mt-4 rounded border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {(mutation.error as Error).message}
            </p>
          </div>
        )}
      </div>

      <div className="border-t pt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="section-header flex-1 mb-0 border-b-0">Sync All Workspaces</div>
            <p className="text-xs text-muted-foreground mt-1">Push environment and file settings to all running workspaces</p>
          </div>
          <Button
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending}
            variant="outline"
            size="sm"
          >
            <Boxes className="mr-1.5 h-3.5 w-3.5" />
            {syncAllMutation.isPending ? 'Syncing...' : 'Sync All'}
          </Button>
        </div>

        {syncResult && (
          <div className="rounded-lg border bg-card/50 p-4 space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                {syncResult.synced} synced
              </span>
              {syncResult.failed > 0 && (
                <span className="text-destructive">
                  {syncResult.failed} failed
                </span>
              )}
            </div>
            {syncResult.results.length > 0 && (
              <div className="space-y-1.5">
                {syncResult.results.map((r) => (
                  <div key={r.name} className="flex items-center gap-2 text-sm">
                    {r.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className={r.success ? 'text-foreground' : 'text-destructive'}>{r.name}</span>
                    {r.error && (
                      <span className="text-xs text-muted-foreground">— {r.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {syncResult.results.length === 0 && (
              <p className="text-sm text-muted-foreground">No running workspaces to sync</p>
            )}
          </div>
        )}

        {syncAllMutation.error && (
          <div className="mt-4 rounded border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {(syncAllMutation.error as Error).message}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
