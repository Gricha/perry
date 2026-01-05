import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  SectionList,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { api, SessionInfo, AgentType } from '../lib/api'
import { useNetwork, parseNetworkError } from '../lib/network'

type AgentFilter = AgentType | 'all'

const AGENT_FILTERS: { value: AgentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'claude-code', label: 'Claude' },
  { value: 'opencode', label: 'OpenCode' },
  { value: 'codex', label: 'Codex' },
]

function AgentBadge({ type }: { type: AgentType }) {
  const labels: Record<AgentType, string> = {
    'claude-code': 'CC',
    opencode: 'OC',
    codex: 'CX',
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

interface SessionWithWorkspace extends SessionInfo {
  workspaceName: string
}

function SessionItem({
  session,
  onPress,
}: {
  session: SessionWithWorkspace
  onPress: () => void
}) {
  const preview = session.firstPrompt?.slice(0, 100) || 'No messages'
  const timeAgo = getTimeAgo(new Date(session.lastActivity))

  return (
    <TouchableOpacity style={styles.sessionItem} onPress={onPress}>
      <View style={styles.sessionHeader}>
        <View style={styles.sessionHeaderLeft}>
          <AgentBadge type={session.agentType} />
          <Text style={styles.workspaceName}>{session.workspaceName}</Text>
        </View>
        <Text style={styles.sessionTime}>{timeAgo}</Text>
      </View>
      <Text style={styles.sessionPreview} numberOfLines={2}>
        {preview}
      </Text>
      <Text style={styles.sessionMeta}>
        {session.messageCount} messages · {session.projectPath}
      </Text>
    </TouchableOpacity>
  )
}

function AgentFilterPicker({ value, onChange }: { value: AgentFilter; onChange: (v: AgentFilter) => void }) {
  return (
    <View style={styles.filterPicker}>
      {AGENT_FILTERS.map((filter) => (
        <TouchableOpacity
          key={filter.value}
          style={[styles.filterChip, value === filter.value && styles.filterChipSelected]}
          onPress={() => onChange(filter.value)}
        >
          <Text style={[styles.filterChipText, value === filter.value && styles.filterChipTextSelected]}>
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export function SessionsScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all')
  const { status } = useNetwork()

  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['allSessions', agentFilter],
    queryFn: () => api.listAllSessions(agentFilter === 'all' ? undefined : agentFilter, 100),
  })

  const handleSessionPress = (session: SessionWithWorkspace) => {
    navigation.navigate('SessionDetail', {
      workspaceName: session.workspaceName,
      sessionId: session.id,
      agentType: session.agentType,
    })
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    )
  }

  if (error && status !== 'connected') {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Cannot Load Sessions</Text>
        <Text style={styles.errorText}>{parseNetworkError(error)}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const sessions = (data?.sessions || []) as SessionWithWorkspace[]

  const grouped = sessions.reduce((acc, session) => {
    const group = getDateGroup(new Date(session.lastActivity))
    if (!acc[group]) acc[group] = []
    acc[group].push(session)
    return acc
  }, {} as Record<string, SessionWithWorkspace[]>)

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older']
  const sections = groupOrder
    .filter((group) => grouped[group]?.length > 0)
    .map((group) => ({ title: group, data: grouped[group] }))

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sessions</Text>
      </View>

      <View style={styles.filterBar}>
        <AgentFilterPicker value={agentFilter} onChange={setAgentFilter} />
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyText}>No sessions found</Text>
          <Text style={styles.emptySubtext}>
            {agentFilter === 'all'
              ? 'Start a coding agent in a workspace'
              : `No ${AGENT_FILTERS.find((f) => f.value === agentFilter)?.label} sessions`}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.workspaceName}-${item.id}`}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <SessionItem session={item} onPress={() => handleSessionPress(item)} />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0a84ff" />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  filterPicker: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1c1c1e',
  },
  filterChipSelected: {
    backgroundColor: '#0a84ff',
  },
  filterChipText: {
    fontSize: 14,
    color: '#8e8e93',
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  list: {
    padding: 16,
  },
  sectionHeader: {
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
  sessionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workspaceName: {
    fontSize: 13,
    color: '#8e8e93',
    fontWeight: '500',
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
  agentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  agentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#8e8e93',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#636366',
    marginTop: 4,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#0a84ff',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
})
