import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar, SidebarTrigger } from './Sidebar'
import { Boxes } from 'lucide-react'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const isTerminalView = location.search.includes('terminal=true')
  const isWorkspaceDetail = /^\/workspaces\/[^/]+$/.test(location.pathname)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 lg:hidden flex-shrink-0">
          <SidebarTrigger onClick={() => setSidebarOpen(true)} />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15">
              <Boxes className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Command</span>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col">
          <div className={
            isTerminalView || isWorkspaceDetail
              ? "flex-1 flex flex-col h-full"
              : "flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 w-full"
          }>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
