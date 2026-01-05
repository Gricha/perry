import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Save, RefreshCw, Key, Check } from 'lucide-react'
import { api, type Credentials, type Scripts, type SSHSettings } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function Settings() {
  const queryClient = useQueryClient()

  const { data: credentials, isLoading: credentialsLoading, error: credentialsError, refetch: refetchCredentials } = useQuery({
    queryKey: ['credentials'],
    queryFn: api.getCredentials,
  })

  const { data: scripts, isLoading: scriptsLoading, error: scriptsError, refetch: refetchScripts } = useQuery({
    queryKey: ['scripts'],
    queryFn: api.getScripts,
  })

  const { data: sshSettings, isLoading: sshLoading, error: sshError, refetch: refetchSSH } = useQuery({
    queryKey: ['sshSettings'],
    queryFn: api.getSSHSettings,
  })

  const { data: sshKeys } = useQuery({
    queryKey: ['sshKeys'],
    queryFn: api.listSSHKeys,
  })

  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([])
  const [files, setFiles] = useState<Array<{ dest: string; source: string }>>([])
  const [postStartScript, setPostStartScript] = useState('')
  const [hasEnvChanges, setHasEnvChanges] = useState(false)
  const [hasFileChanges, setHasFileChanges] = useState(false)
  const [hasScriptChanges, setHasScriptChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const [autoAuthorize, setAutoAuthorize] = useState(true)
  const [copyKeys, setCopyKeys] = useState<string[]>([])
  const [authorizeKeys, setAuthorizeKeys] = useState<string[]>([])
  const [hasSSHChanges, setHasSSHChanges] = useState(false)
  const [sshInitialized, setSSHInitialized] = useState(false)

  useEffect(() => {
    if (credentials && !initialized) {
      setEnvVars(Object.entries(credentials.env).map(([key, value]) => ({ key, value })))
      setFiles(Object.entries(credentials.files).map(([dest, source]) => ({ dest, source })))
      setInitialized(true)
    }
  }, [credentials, initialized])

  useEffect(() => {
    if (scripts && !hasScriptChanges && postStartScript === '') {
      setPostStartScript(scripts.post_start || '')
    }
  }, [scripts, hasScriptChanges, postStartScript])

  useEffect(() => {
    if (sshSettings && !sshInitialized) {
      setAutoAuthorize(sshSettings.autoAuthorizeHostKeys)
      setCopyKeys(sshSettings.global.copy || [])
      setAuthorizeKeys(sshSettings.global.authorize || [])
      setSSHInitialized(true)
    }
  }, [sshSettings, sshInitialized])

  const credentialsMutation = useMutation({
    mutationFn: (data: Credentials) => api.updateCredentials(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
      setHasEnvChanges(false)
      setHasFileChanges(false)
    },
  })

  const scriptsMutation = useMutation({
    mutationFn: (data: Scripts) => api.updateScripts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] })
      setHasScriptChanges(false)
    },
  })

  const sshMutation = useMutation({
    mutationFn: (data: SSHSettings) => api.updateSSHSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sshSettings'] })
      setHasSSHChanges(false)
    },
  })

  const handleSaveEnv = () => {
    const env: Record<string, string> = {}
    for (const { key, value } of envVars) {
      if (key.trim()) {
        env[key.trim()] = value
      }
    }
    const filesObj: Record<string, string> = {}
    for (const { dest, source } of files) {
      if (dest.trim() && source.trim()) {
        filesObj[dest.trim()] = source.trim()
      }
    }
    credentialsMutation.mutate({ env, files: filesObj })
  }

  const handleSaveFiles = () => {
    const env: Record<string, string> = {}
    for (const { key, value } of envVars) {
      if (key.trim()) {
        env[key.trim()] = value
      }
    }
    const filesObj: Record<string, string> = {}
    for (const { dest, source } of files) {
      if (dest.trim() && source.trim()) {
        filesObj[dest.trim()] = source.trim()
      }
    }
    credentialsMutation.mutate({ env, files: filesObj })
  }

  const handleSaveScripts = () => {
    scriptsMutation.mutate({
      post_start: postStartScript.trim() || undefined,
    })
  }

  const handleSaveSSH = () => {
    sshMutation.mutate({
      autoAuthorizeHostKeys: autoAuthorize,
      global: {
        copy: copyKeys,
        authorize: authorizeKeys,
      },
      workspaces: sshSettings?.workspaces || {},
    })
  }

  const toggleCopyKey = (keyPath: string) => {
    if (copyKeys.includes(keyPath)) {
      setCopyKeys(copyKeys.filter(k => k !== keyPath))
    } else {
      setCopyKeys([...copyKeys, keyPath])
    }
    setHasSSHChanges(true)
  }

  const toggleAuthorizeKey = (keyPath: string) => {
    if (authorizeKeys.includes(keyPath)) {
      setAuthorizeKeys(authorizeKeys.filter(k => k !== keyPath))
    } else {
      setAuthorizeKeys([...authorizeKeys, keyPath])
    }
    setHasSSHChanges(true)
  }

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
    setHasEnvChanges(true)
  }

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
    setHasEnvChanges(true)
  }

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars]
    updated[index] = { ...updated[index], [field]: value }
    setEnvVars(updated)
    setHasEnvChanges(true)
  }

  const addFile = () => {
    setFiles([...files, { dest: '', source: '' }])
    setHasFileChanges(true)
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
    setHasFileChanges(true)
  }

  const updateFile = (index: number, field: 'dest' | 'source', value: string) => {
    const updated = [...files]
    updated[index] = { ...updated[index], [field]: value }
    setFiles(updated)
    setHasFileChanges(true)
  }

  const isLoading = credentialsLoading || scriptsLoading || sshLoading
  const error = credentialsError || scriptsError || sshError

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">Failed to load settings</p>
        <Button onClick={() => { refetchCredentials(); refetchScripts(); refetchSSH() }} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure credentials and scripts for workspaces
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-6 w-48 bg-muted rounded" />
              <div className="h-4 w-64 bg-muted rounded mt-2" />
            </CardHeader>
          </Card>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Environment Variables</CardTitle>
                  <CardDescription>Variables injected into all new workspaces</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addEnvVar} variant="outline" size="sm">
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                  <Button
                    onClick={handleSaveEnv}
                    disabled={credentialsMutation.isPending || !hasEnvChanges}
                    size="sm"
                  >
                    <Save className="mr-1 h-4 w-4" />
                    {credentialsMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {envVars.length === 0 ? (
                <p className="text-sm text-muted-foreground">No environment variables configured</p>
              ) : (
                <div className="space-y-2">
                  {envVars.map((env, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        type="text"
                        value={env.key}
                        onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                        placeholder="NAME"
                        className="flex-1 font-mono"
                      />
                      <span className="text-muted-foreground">=</span>
                      <Input
                        type="password"
                        value={env.value}
                        onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                        placeholder="value"
                        className="flex-[2] font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEnvVar(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {credentialsMutation.error && (
                <p className="mt-2 text-sm text-destructive">
                  {(credentialsMutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Credential Files</CardTitle>
                  <CardDescription>Files copied into all new workspaces (e.g., SSH keys)</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addFile} variant="outline" size="sm">
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                  <Button
                    onClick={handleSaveFiles}
                    disabled={credentialsMutation.isPending || !hasFileChanges}
                    size="sm"
                  >
                    <Save className="mr-1 h-4 w-4" />
                    {credentialsMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">No credential files configured</p>
              ) : (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        type="text"
                        value={file.source}
                        onChange={(e) => updateFile(index, 'source', e.target.value)}
                        placeholder="~/.ssh/id_rsa"
                        className="flex-1 font-mono"
                      />
                      <span className="text-muted-foreground">→</span>
                      <Input
                        type="text"
                        value={file.dest}
                        onChange={(e) => updateFile(index, 'dest', e.target.value)}
                        placeholder="~/.ssh/id_rsa"
                        className="flex-1 font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Post-Start Script</CardTitle>
                  <CardDescription>Script executed after each workspace starts</CardDescription>
                </div>
                <Button
                  onClick={handleSaveScripts}
                  disabled={scriptsMutation.isPending || !hasScriptChanges}
                  size="sm"
                >
                  <Save className="mr-1 h-4 w-4" />
                  {scriptsMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                type="text"
                value={postStartScript}
                onChange={(e) => {
                  setPostStartScript(e.target.value)
                  setHasScriptChanges(true)
                }}
                placeholder="~/scripts/post-start.sh"
                className="font-mono"
              />
              {scriptsMutation.error && (
                <p className="mt-2 text-sm text-destructive">
                  {(scriptsMutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    SSH Keys
                  </CardTitle>
                  <CardDescription>Configure SSH keys for workspace access and git operations</CardDescription>
                </div>
                <Button
                  onClick={handleSaveSSH}
                  disabled={sshMutation.isPending || !hasSSHChanges}
                  size="sm"
                >
                  <Save className="mr-1 h-4 w-4" />
                  {sshMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-authorize host keys</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically add all host SSH keys to workspace authorized_keys
                  </p>
                </div>
                <Button
                  variant={autoAuthorize ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setAutoAuthorize(!autoAuthorize)
                    setHasSSHChanges(true)
                  }}
                >
                  {autoAuthorize ? 'Enabled' : 'Disabled'}
                </Button>
              </div>

              {sshKeys && sshKeys.length > 0 && (
                <>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Keys to copy to workspaces</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Private keys copied for git operations
                      </p>
                    </div>
                    <div className="space-y-2">
                      {sshKeys.filter(k => k.hasPrivateKey).map((key) => (
                        <div
                          key={key.path}
                          className="flex items-center justify-between p-2 rounded-md border cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleCopyKey(key.path)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                              copyKeys.includes(key.path) ? 'bg-primary border-primary' : 'border-muted-foreground'
                            }`}>
                              {copyKeys.includes(key.path) && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{key.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {key.type.toUpperCase()} · {key.fingerprint.slice(0, 20)}...
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Keys to authorize</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Additional public keys added to authorized_keys
                      </p>
                    </div>
                    <div className="space-y-2">
                      {sshKeys.map((key) => (
                        <div
                          key={key.path}
                          className="flex items-center justify-between p-2 rounded-md border cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleAuthorizeKey(key.publicKeyPath)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                              authorizeKeys.includes(key.publicKeyPath) ? 'bg-primary border-primary' : 'border-muted-foreground'
                            }`}>
                              {authorizeKeys.includes(key.publicKeyPath) && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{key.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {key.type.toUpperCase()} · {key.fingerprint.slice(0, 20)}...
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(!sshKeys || sshKeys.length === 0) && (
                <p className="text-sm text-muted-foreground">No SSH keys found in ~/.ssh/</p>
              )}

              {sshMutation.error && (
                <p className="text-sm text-destructive">
                  {(sshMutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
