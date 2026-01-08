import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, Plus, X } from 'lucide-react'
import { api, type Scripts } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useSyncNotification } from '@/contexts/SyncContext'

const DEFAULT_SCRIPT_PATH = '~/.perry/userscripts'

export function ScriptsSettings() {
  const queryClient = useQueryClient()
  const showSyncNotification = useSyncNotification()

  const { data: scripts, isLoading, error, refetch } = useQuery({
    queryKey: ['scripts'],
    queryFn: api.getScripts,
  })

  const [scriptPaths, setScriptPaths] = useState<string[]>([DEFAULT_SCRIPT_PATH])
  const [failOnError, setFailOnError] = useState(false)
  const [newPath, setNewPath] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (scripts && !initialized) {
      const paths = scripts.post_start && scripts.post_start.length > 0
        ? scripts.post_start
        : [DEFAULT_SCRIPT_PATH]
      setScriptPaths(paths)
      setFailOnError(scripts.fail_on_error ?? false)
      setInitialized(true)
    }
  }, [scripts, initialized])

  const mutation = useMutation({
    mutationFn: (data: Scripts) => api.updateScripts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] })
      setHasChanges(false)
      showSyncNotification()
    },
  })

  const handleSave = () => {
    mutation.mutate({
      post_start: scriptPaths.filter(p => p.trim()),
      fail_on_error: failOnError,
    })
  }

  const handleAddPath = () => {
    const trimmed = newPath.trim()
    if (trimmed && !scriptPaths.includes(trimmed)) {
      setScriptPaths([...scriptPaths, trimmed])
      setNewPath('')
      setHasChanges(true)
    }
  }

  const handleRemovePath = (index: number) => {
    setScriptPaths(scriptPaths.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddPath()
    }
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
          <h1 className="page-title">Scripts</h1>
          <p className="page-description">Custom scripts executed during workspace lifecycle</p>
        </div>
        <div className="h-10 bg-secondary rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Scripts</h1>
        <p className="page-description">Custom scripts executed during workspace lifecycle</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="section-header flex-1 mb-0 border-b-0">Post-Start Scripts</div>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !hasChanges}
            size="sm"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            {scriptPaths.map((path, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm bg-secondary/50 rounded px-3 py-2 border">
                  {path}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePath(index)}
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              type="text"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="~/scripts/my-script.sh"
              className="font-mono text-sm h-11 sm:h-9"
            />
            <Button
              onClick={handleAddPath}
              disabled={!newPath.trim()}
              variant="outline"
              size="sm"
              className="h-11 sm:h-9 px-3"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Paths to scripts or directories on the worker machine. Scripts are executed after workspace starts.
            Directories run all .sh files in sorted order.
          </p>
        </div>
      </div>

      <div>
        <div className="section-header">Error Handling</div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Stop on script error</p>
            <p className="text-xs text-muted-foreground">
              If enabled, workspace startup fails when a script exits with non-zero status
            </p>
          </div>
          <Switch
            checked={failOnError}
            onCheckedChange={(checked: boolean) => {
              setFailOnError(checked)
              setHasChanges(true)
            }}
          />
        </div>
      </div>

      {mutation.error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">
            {(mutation.error as Error).message}
          </p>
        </div>
      )}
    </div>
  )
}
