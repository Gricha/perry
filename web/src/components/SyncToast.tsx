import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, X, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface SyncToastProps {
  show: boolean
  onDismiss: () => void
}

export function SyncToast({ show, onDismiss }: SyncToastProps) {
  const queryClient = useQueryClient()
  const [synced, setSynced] = useState(false)

  const mutation = useMutation({
    mutationFn: api.syncAllWorkspaces,
    onSuccess: () => {
      setSynced(true)
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setTimeout(() => {
        onDismiss()
        setSynced(false)
      }, 1500)
    },
  })

  useEffect(() => {
    if (!show) {
      setSynced(false)
    }
  }, [show])

  if (!show) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="bg-card border rounded-lg shadow-lg p-3 flex items-center gap-3 max-w-xs">
        {synced ? (
          <>
            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
            <span className="text-sm">Synced to all workspaces</span>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Sync to workspaces?</p>
              <p className="text-xs text-muted-foreground">Push changes to running workspaces</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className={cn(
                  "px-2 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
                  mutation.isPending && "opacity-50"
                )}
              >
                {mutation.isPending ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  'Sync'
                )}
              </button>
              <button
                onClick={onDismiss}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
