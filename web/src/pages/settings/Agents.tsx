import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, ExternalLink, Github, Check, Network } from 'lucide-react'
import { api, type CodingAgents, type ModelInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useSyncNotification } from '@/contexts/SyncContext'
import { AgentIcon } from '@/components/AgentIcon'
import { SearchableModelSelect } from '@/components/SearchableModelSelect'

const FALLBACK_CLAUDE_MODELS: ModelInfo[] = [
  { id: 'sonnet', name: 'Sonnet', description: 'Fast and cost-effective', provider: 'anthropic' },
  { id: 'opus', name: 'Opus', description: 'Most capable', provider: 'anthropic' },
  { id: 'haiku', name: 'Haiku', description: 'Fastest, lowest cost', provider: 'anthropic' },
]


function StatusIndicator({ configured }: { configured: boolean }) {
  if (!configured) return null
  return (
    <span className="status-configured text-xs font-medium">
      Configured
    </span>
  )
}

export function AgentsSettings() {
  const queryClient = useQueryClient()
  const showSyncNotification = useSyncNotification()

  const { data: agents, isLoading, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  })

  const { data: claudeModelsData } = useQuery({
    queryKey: ['models', 'claude-code'],
    queryFn: () => api.listModels('claude-code'),
  })

  const { data: opencodeModelsData } = useQuery({
    queryKey: ['models', 'opencode'],
    queryFn: () => api.listModels('opencode'),
  })

  const { data: tailscaleConfig } = useQuery({
    queryKey: ['tailscaleConfig'],
    queryFn: api.getTailscaleConfig,
  })

  const claudeModels = claudeModelsData?.models?.length ? claudeModelsData.models : FALLBACK_CLAUDE_MODELS
  const opencodeModels = opencodeModelsData?.models || []

  const [opencodeZenToken, setOpencodeZenToken] = useState('')
  const [opencodeModel, setOpencodeModel] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [claudeOAuthToken, setClaudeOAuthToken] = useState('')
  const [claudeModel, setClaudeModel] = useState('sonnet')
  const [opencodeHasChanges, setOpencodeHasChanges] = useState(false)
  const [githubHasChanges, setGithubHasChanges] = useState(false)
  const [claudeHasChanges, setClaudeHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [savedSection, setSavedSection] = useState<'opencode' | 'github' | 'claude' | 'tailscale' | null>(null)

  const [tailscaleEnabled, setTailscaleEnabled] = useState(false)
  const [tailscaleAuthKey, setTailscaleAuthKey] = useState('')
  const [tailscaleHostnamePrefix, setTailscaleHostnamePrefix] = useState('')
  const [tailscaleHasChanges, setTailscaleHasChanges] = useState(false)
  const [tailscaleInitialized, setTailscaleInitialized] = useState(false)

  const showSaved = useCallback((section: 'opencode' | 'github' | 'claude' | 'tailscale') => {
    setSavedSection(section)
    setTimeout(() => setSavedSection(null), 2000)
  }, [])

  useEffect(() => {
    if (agents && !initialized) {
      setOpencodeZenToken(agents.opencode?.zen_token || '')
      setOpencodeModel(agents.opencode?.model || '')
      setGithubToken(agents.github?.token || '')
      setClaudeOAuthToken(agents.claude_code?.oauth_token || '')
      setClaudeModel(agents.claude_code?.model || 'sonnet')
      setInitialized(true)
    }
  }, [agents, initialized])

  useEffect(() => {
    if (tailscaleConfig && !tailscaleInitialized) {
      setTailscaleEnabled(tailscaleConfig.enabled)
      setTailscaleAuthKey(tailscaleConfig.authKey || '')
      setTailscaleHostnamePrefix(tailscaleConfig.hostnamePrefix || '')
      setTailscaleInitialized(true)
    }
  }, [tailscaleConfig, tailscaleInitialized])

  const mutation = useMutation({
    mutationFn: (data: CodingAgents) => api.updateAgents(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setOpencodeHasChanges(false)
      setGithubHasChanges(false)
      setClaudeHasChanges(false)
      showSyncNotification()
    },
  })

  const tailscaleMutation = useMutation({
    mutationFn: (config: { enabled?: boolean; authKey?: string; hostnamePrefix?: string }) =>
      api.updateTailscaleConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tailscaleConfig'] })
      setTailscaleHasChanges(false)
    },
  })

  const handleSaveOpencode = () => {
    mutation.mutate(
      {
        ...agents,
        opencode: {
          zen_token: opencodeZenToken.trim() || undefined,
          model: opencodeModel || undefined,
        },
      },
      { onSuccess: () => showSaved('opencode') }
    )
  }

  const handleSaveGithub = () => {
    mutation.mutate(
      {
        ...agents,
        github: { token: githubToken.trim() || undefined },
      },
      { onSuccess: () => showSaved('github') }
    )
  }

  const handleSaveClaude = () => {
    mutation.mutate(
      {
        ...agents,
        claude_code: {
          oauth_token: claudeOAuthToken.trim() || undefined,
          model: claudeModel,
        },
      },
      { onSuccess: () => showSaved('claude') }
    )
  }

  const handleSaveTailscale = () => {
    const config: { enabled?: boolean; authKey?: string; hostnamePrefix?: string } = {
      enabled: tailscaleEnabled,
    }
    if (tailscaleAuthKey && tailscaleAuthKey !== '********') {
      config.authKey = tailscaleAuthKey
    }
    config.hostnamePrefix = tailscaleHostnamePrefix || undefined
    tailscaleMutation.mutate(config, { onSuccess: () => showSaved('tailscale') })
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

  const opencodeConfigured = !!agents?.opencode?.zen_token
  const githubConfigured = !!agents?.github?.token
  const claudeConfigured = !!agents?.claude_code?.oauth_token

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">Configuration</h1>
          <p className="page-description">Configure AI assistants for your workspaces</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="agent-row animate-pulse">
              <div className="agent-icon bg-secondary" />
              <div className="agent-info space-y-2">
                <div className="h-4 w-24 bg-secondary rounded" />
                <div className="h-3 w-48 bg-secondary rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Configuration</h1>
        <p className="page-description">Configure AI assistants for your workspaces</p>
      </div>

      {/* AI Assistants Section */}
      <div>
        <div className="section-header">AI Assistants</div>

        {/* OpenCode */}
        <div className="agent-row">
          <AgentIcon agentType="opencode" size="md" />
          <div className="agent-info">
            <div className="agent-name">
              OpenCode
              <StatusIndicator configured={opencodeConfigured} />
            </div>
            <p className="agent-description">
              Zen token for OpenCode.
              <a
                href="https://opencode.ai/auth"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
              >
                Get token
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <div className="space-y-2 mt-2">
              <div className="agent-input">
                <Input
                  type="password"
                  value={opencodeZenToken}
                  onChange={(e) => {
                    setOpencodeZenToken(e.target.value)
                    setOpencodeHasChanges(true)
                  }}
                  placeholder="zen_... (Zen token)"
                  className="w-full font-mono text-sm h-11 sm:h-9"
                />
              </div>
              <div className="agent-input flex flex-col sm:flex-row gap-2">
                {opencodeModels.length > 0 && (
                  <div className="flex-1">
                    <SearchableModelSelect
                      models={opencodeModels}
                      value={opencodeModel}
                      onChange={(value) => {
                        setOpencodeModel(value)
                        setOpencodeHasChanges(true)
                      }}
                      placeholder="Select model..."
                      showProvider
                    />
                  </div>
                )}
                <Button
                  onClick={handleSaveOpencode}
                  disabled={mutation.isPending || !opencodeHasChanges}
                  size="sm"
                  className="h-11 sm:h-9"
                  variant={savedSection === 'opencode' ? 'secondary' : 'default'}
                >
                  {savedSection === 'opencode' ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Claude Code */}
        <div className="agent-row">
          <AgentIcon agentType="claude-code" size="md" />
          <div className="agent-info">
            <div className="agent-name">
              Claude Code
              <StatusIndicator configured={claudeConfigured} />
            </div>
            <p className="agent-description">
              OAuth token for headless operation. Run <code className="text-xs bg-secondary px-1 py-0.5 rounded">claude setup-token</code> locally to generate.
            </p>
            <div className="space-y-2 mt-2">
              <div className="agent-input">
                <Input
                  type="password"
                  value={claudeOAuthToken}
                  onChange={(e) => {
                    setClaudeOAuthToken(e.target.value)
                    setClaudeHasChanges(true)
                  }}
                  placeholder="sk-ant-oat01-... (OAuth token)"
                  className="w-full font-mono text-sm h-11 sm:h-9"
                />
              </div>
              <div className="agent-input flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <SearchableModelSelect
                    models={claudeModels}
                    value={claudeModel}
                    onChange={(value) => {
                      setClaudeModel(value)
                      setClaudeHasChanges(true)
                    }}
                    showProvider
                  />
                </div>
                <Button
                  onClick={handleSaveClaude}
                  disabled={mutation.isPending || !claudeHasChanges}
                  size="sm"
                  className="h-11 sm:h-9"
                  variant={savedSection === 'claude' ? 'secondary' : 'default'}
                >
                  {savedSection === 'claude' ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version Control Section */}
      <div>
        <div className="section-header">Version Control</div>

        {/* GitHub */}
        <div className="agent-row">
          <div className="agent-icon">
            <Github className="h-5 w-5" />
          </div>
          <div className="agent-info">
            <div className="agent-name">
              GitHub
              <StatusIndicator configured={githubConfigured} />
            </div>
            <p className="agent-description">
              Personal Access Token for git operations. Injected as <code className="text-xs bg-secondary px-1 py-0.5 rounded">GITHUB_TOKEN</code>
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
              >
                Create token
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Use a fine-grained PAT with repository access permissions.
            </p>
            <div className="agent-input flex flex-col sm:flex-row gap-2">
              <Input
                type="password"
                value={githubToken}
                onChange={(e) => {
                  setGithubToken(e.target.value)
                  setGithubHasChanges(true)
                }}
                placeholder="ghp_..."
                className="flex-1 font-mono text-sm h-11 sm:h-9"
              />
              <Button
                onClick={handleSaveGithub}
                disabled={mutation.isPending || !githubHasChanges}
                size="sm"
                className="h-11 sm:h-9"
                variant={savedSection === 'github' ? 'secondary' : 'default'}
              >
                {savedSection === 'github' ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Networking Section */}
      <div>
        <div className="section-header">Networking</div>

        {/* Tailscale */}
        <div className="agent-row">
          <div className="agent-icon">
            <Network className="h-5 w-5" />
          </div>
          <div className="agent-info">
            <div className="agent-name">
              Tailscale
              <StatusIndicator configured={!!tailscaleConfig?.authKey && tailscaleEnabled} />
            </div>
            <p className="agent-description">
              Connect workspaces to your tailnet for direct network access.
              <a
                href="https://login.tailscale.com/admin/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
              >
                Generate auth key
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <div className="space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="tailscale-enabled" className="text-sm">Enable Tailscale</Label>
                <Switch
                  id="tailscale-enabled"
                  checked={tailscaleEnabled}
                  onCheckedChange={(value) => {
                    setTailscaleEnabled(value)
                    setTailscaleHasChanges(true)
                  }}
                />
              </div>
              <div className="agent-input">
                <Input
                  type="password"
                  value={tailscaleAuthKey}
                  onChange={(e) => {
                    setTailscaleAuthKey(e.target.value)
                    setTailscaleHasChanges(true)
                  }}
                  placeholder={tailscaleConfig?.authKey ? '********' : 'tskey-auth-...'}
                  className="w-full font-mono text-sm h-11 sm:h-9"
                />
              </div>
              <div className="agent-input flex flex-col sm:flex-row gap-2">
                <Input
                  type="text"
                  value={tailscaleHostnamePrefix}
                  onChange={(e) => {
                    setTailscaleHostnamePrefix(e.target.value)
                    setTailscaleHasChanges(true)
                  }}
                  placeholder="perry"
                  className="flex-1 text-sm h-11 sm:h-9"
                />
                <Button
                  onClick={handleSaveTailscale}
                  disabled={tailscaleMutation.isPending || !tailscaleHasChanges}
                  size="sm"
                  className="h-11 sm:h-9"
                  variant={savedSection === 'tailscale' ? 'secondary' : 'default'}
                >
                  {savedSection === 'tailscale' ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Save
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Workspaces join as <code className="bg-muted px-1 rounded">{tailscaleHostnamePrefix || 'perry'}-workspacename</code>
              </p>
            </div>
          </div>
        </div>
      </div>

      {(mutation.error || tailscaleMutation.error) && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">
            {((mutation.error || tailscaleMutation.error) as Error).message}
          </p>
        </div>
      )}
    </div>
  )
}
