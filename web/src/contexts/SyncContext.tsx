import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { SyncToast } from '@/components/SyncToast'

interface SyncContextValue {
  showSyncPrompt: () => void
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const [showToast, setShowToast] = useState(false)

  const showSyncPrompt = useCallback(() => {
    setShowToast(true)
  }, [])

  const dismissToast = useCallback(() => {
    setShowToast(false)
  }, [])

  return (
    <SyncContext.Provider value={{ showSyncPrompt }}>
      {children}
      <SyncToast show={showToast} onDismiss={dismissToast} />
    </SyncContext.Provider>
  )
}

export function useSyncPrompt() {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSyncPrompt must be used within SyncProvider')
  }
  return context.showSyncPrompt
}
