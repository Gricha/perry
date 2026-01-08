import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Lock, Globe, Loader2, Github } from 'lucide-react'
import { api, type GitHubRepo } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RepoSelectorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function RepoSelector({ value, onChange, placeholder = 'https://github.com/user/repo' }: RepoSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['githubRepos', debouncedSearch],
    queryFn: () => api.listGitHubRepos(debouncedSearch || undefined, 20),
    staleTime: 60000,
  })

  const isConfigured = data?.configured ?? false
  const repos = data?.repos ?? []

  const handleSelect = (repo: GitHubRepo) => {
    onChange(repo.cloneUrl)
    setIsOpen(false)
    setSearch('')
  }

  if (!isConfigured) {
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
          <Github className="h-3.5 w-3.5" />
          Search your repositories
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search repositories..."
            className="pl-9"
            data-testid="repo-search"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {isOpen && (
          <div
            className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
            data-testid="repo-dropdown"
          >
            <div className="max-h-48 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : repos.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {search ? 'No repositories found' : 'Start typing to search'}
                </div>
              ) : (
                repos.map((repo) => (
                  <button
                    key={repo.fullName}
                    type="button"
                    onClick={() => handleSelect(repo)}
                    className="w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-3"
                    data-testid="repo-option"
                  >
                    <span className="mt-0.5 text-muted-foreground">
                      {repo.private ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{repo.fullName}</div>
                      {repo.description && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {repo.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">
          Or enter URL directly
        </Label>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid="repo-input"
        />
      </div>
    </div>
  )
}
