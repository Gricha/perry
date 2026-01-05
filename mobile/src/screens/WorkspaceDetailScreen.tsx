import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, WorkspaceInfo, SessionInfo, AgentType } from '../lib/api'
import { parseNetworkError } from '../lib/network'

type Tab = 'sessions' | 'settings'

function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, active === 'sessions' && styles.tabActive]}
        onPress={() => onChange('sessions')}
      >
        <Text style={[styles.tabText, active === 'sessions' && styles.tabTextActive]}>Sessions</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, active === 'settings' && styles.tabActive]}
        onPress={() => onChange('settings')}
      >
        <Text style={[styles.tabText, active === 'settings' && styles.tabTextActive]}>Settings</Text>
      </TouchableOpacity>
    </View>
  )
}

function StatusBadge({ status }: { status: WorkspaceInfo['status'] }) {
  const colors = {
    running: '#34c759',
    stopped: '#8e8e93',
    creating: '#ff9f0a',
    error: '#ff3b30',
  }
  return (
    <View style={[styles.badge, { backgroundColor: colors[status] }]}>
      <Text style={styles.badgeText}>{status}</Text>
    </View>
  )
}

function AgentBadge({ type }: { type: AgentType }) {
  const labels: Record<AgentType, string> = {
    'claude-code': 'Claude',
    opencode: 'OpenCode',
    codex: 'Codex',
  }
  const colors: Record<AgentType, string> = {
    'claude-code': '#ff6b35',
    opencode: '#34c759',
    codex: '#007aff',
  }
  return (
    <View style={[styles.agentBadge, { backgroundColor: colors[type] }]}>
      <Text style={styles.agentBadgeText}>{labels[type]}</Text>
    </View>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getDateGroup(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  if (date >= today) return 'Today'
  if (date >= yesterday) return 'Yesterday'
  if (date >= weekAgo) return 'This Week'
  return 'Older'
}

function SessionsTab({
  workspace,
  onSelectSession,
}: {
  workspace: WorkspaceInfo
  onSelectSession: (session: SessionInfo) => void
}) {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sessions', workspace.name],
    queryFn: () => api.listSessions(workspace.name, undefined, 100),
    enabled: workspace.status === 'running',
  })

  if (workspace.status !== 'running') {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>⏸</Text>
        <Text style={styles.emptyTitle}>Workspace Not Running</Text>
        <Text style={styles.emptyText}>Start the workspace to view sessions</Text>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    )
  }

  const sessions = data?.sessions || []

  if (sessions.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0a84ff" />}
      >
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={styles.emptyTitle}>No Sessions</Text>
        <Text style={styles.emptyText}>Start a coding agent to create sessions</Text>
      </ScrollView>
    )
  }

  const grouped = sessions.reduce((acc, session) => {
    const group = getDateGroup(new Date(session.lastActivity))
    if (!acc[group]) acc[group] = []
    acc[group].push(session)
    return acc
  }, {} as Record<string, SessionInfo[]>)

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older']

  return (
    <ScrollView
      style={styles.sessionsContainer}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0a84ff" />}
    >
      {groupOrder.map((group) => {
        const groupSessions = grouped[group]
        if (!groupSessions?.length) return null
        return (
          <View key={group}>
            <Text style={styles.groupHeader}>{group}</Text>
            {groupSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionItem}
                onPress={() => onSelectSession(session)}
              >
                <View style={styles.sessionHeader}>
                  <AgentBadge type={session.agentType} />
                  <Text style={styles.sessionTime}>{getTimeAgo(new Date(session.lastActivity))}</Text>
                </View>
                <Text style={styles.sessionPreview} numberOfLines={2}>
                  {session.firstPrompt?.slice(0, 100) || 'No messages'}
                </Text>
                <Text style={styles.sessionMeta}>
                  {session.messageCount} messages · {session.projectPath}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )
      })}
    </ScrollView>
  )
}

function SettingsTab({ workspace, onBack }: { workspace: WorkspaceInfo; onBack: () => void }) {
  const queryClient = useQueryClient()

  const startMutation = useMutation({
    mutationFn: () => api.startWorkspace(workspace.name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const stopMutation = useMutation({
    mutationFn: () => api.stopWorkspace(workspace.name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteWorkspace(workspace.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      onBack()
    },
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.syncWorkspace(workspace.name),
    onSuccess: () => Alert.alert('Success', 'Credentials synced to workspace'),
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const handleDelete = () => {
    Alert.alert(
      'Delete Workspace',
      `Are you sure you want to delete "${workspace.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ]
    )
  }

  const isRunning = workspace.status === 'running'
  const isStopped = workspace.status === 'stopped'
  const isError = workspace.status === 'error'

  return (
    <ScrollView style={styles.settingsContainer}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workspace Info</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <StatusBadge status={workspace.status} />
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>SSH Port</Text>
            <Text style={styles.infoValue}>{workspace.ports.ssh}</Text>
          </View>
          {workspace.ports.http && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>HTTP Port</Text>
              <Text style={styles.infoValue}>{workspace.ports.http}</Text>
            </View>
          )}
          {workspace.repo && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Repository</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{workspace.repo}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Container ID</Text>
            <Text style={styles.infoValueMono}>{workspace.containerId.slice(0, 12)}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>{new Date(workspace.created).toLocaleDateString()}</Text>
          </View>
        </View>
      </View>

      {isRunning && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <ActivityIndicator size="small" color="#0a84ff" />
            ) : (
              <>
                <Text style={styles.actionButtonIcon}>🔄</Text>
                <View>
                  <Text style={styles.actionButtonText}>Sync Credentials</Text>
                  <Text style={styles.actionButtonSubtext}>Push config files to workspace</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <View style={styles.dangerCard}>
          {isRunning && (
            <TouchableOpacity
              style={[styles.dangerButton, styles.stopButton]}
              onPress={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              {stopMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.dangerButtonText}>Stop Workspace</Text>
              )}
            </TouchableOpacity>
          )}
          {(isStopped || isError) && (
            <TouchableOpacity
              style={[styles.dangerButton, styles.startButton]}
              onPress={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.dangerButtonText}>{isError ? 'Recover Workspace' : 'Start Workspace'}</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.dangerButton, styles.deleteButton]}
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.dangerButtonText}>Delete Workspace</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

export function WorkspaceDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState<Tab>('sessions')
  const { name } = route.params

  const { data: workspace, isLoading, error } = useQuery({
    queryKey: ['workspace', name],
    queryFn: () => api.getWorkspace(name),
  })

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    )
  }

  if (error || !workspace) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Workspace Not Found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const handleSelectSession = (session: SessionInfo) => {
    navigation.navigate('SessionDetail', {
      workspaceName: workspace.name,
      sessionId: session.id,
      agentType: session.agentType,
    })
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerName}>{workspace.name}</Text>
          <StatusBadge status={workspace.status} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'sessions' ? (
        <SessionsTab workspace={workspace} onSelectSession={handleSelectSession} />
      ) : (
        <SettingsTab workspace={workspace} onBack={() => navigation.goBack()} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: {
    fontSize: 24,
    color: '#0a84ff',
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0a84ff',
  },
  tabText: {
    fontSize: 15,
    color: '#8e8e93',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0a84ff',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#0a84ff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
  },
  sessionsContainer: {
    flex: 1,
    padding: 16,
  },
  groupHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  sessionItem: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionTime: {
    fontSize: 12,
    color: '#636366',
  },
  sessionPreview: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    marginBottom: 6,
  },
  sessionMeta: {
    fontSize: 12,
    color: '#636366',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  agentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  agentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  settingsContainer: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  infoLabel: {
    fontSize: 14,
    color: '#8e8e93',
  },
  infoValue: {
    fontSize: 14,
    color: '#fff',
    maxWidth: '60%',
    textAlign: 'right',
  },
  infoValueMono: {
    fontSize: 13,
    color: '#fff',
    fontFamily: 'monospace',
  },
  actionButton: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButtonIcon: {
    fontSize: 24,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  actionButtonSubtext: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },
  dangerCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  dangerButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#34c759',
  },
  stopButton: {
    backgroundColor: '#ff9f0a',
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})
