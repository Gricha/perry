import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, WorkspaceInfo } from '../lib/api'
import { useNetwork, parseNetworkError } from '../lib/network'

function StatsCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statsCard}>
      <Text style={[styles.statsValue, { color }]}>{value}</Text>
      <Text style={styles.statsLabel}>{label}</Text>
    </View>
  )
}

function StatsBar({ workspaces }: { workspaces: WorkspaceInfo[] }) {
  const total = workspaces.length
  const running = workspaces.filter((w) => w.status === 'running').length
  const stopped = workspaces.filter((w) => w.status === 'stopped').length

  return (
    <View style={styles.statsBar}>
      <StatsCard label="Total" value={total} color="#fff" />
      <StatsCard label="Running" value={running} color="#34c759" />
      <StatsCard label="Stopped" value={stopped} color="#8e8e93" />
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

function WorkspaceItem({
  workspace,
  onPress,
  onStart,
  onStop,
}: {
  workspace: WorkspaceInfo
  onPress: () => void
  onStart: () => void
  onStop: () => void
}) {
  const isRunning = workspace.status === 'running'
  const isStopped = workspace.status === 'stopped'
  const isError = workspace.status === 'error'

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} testID={`workspace-item-${workspace.name}`}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName} testID="workspace-name">{workspace.name}</Text>
        <StatusBadge status={workspace.status} />
      </View>
      {workspace.repo && <Text style={styles.itemRepo} numberOfLines={1}>{workspace.repo}</Text>}
      <Text style={styles.itemMeta}>
        SSH: {workspace.ports.ssh} · {new Date(workspace.created).toLocaleDateString()}
      </Text>
      <View style={styles.itemActions}>
        {isRunning ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.stopBtn]}
            onPress={(e) => { e.stopPropagation(); onStop() }}
          >
            <Text style={styles.actionBtnText}>Stop</Text>
          </TouchableOpacity>
        ) : (isStopped || isError) ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.startBtn]}
            onPress={(e) => { e.stopPropagation(); onStart() }}
          >
            <Text style={styles.actionBtnText}>{isError ? 'Recover' : 'Start'}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.actionBtn, styles.detailBtn]}
          onPress={onPress}
        >
          <Text style={styles.actionBtnText}>Details →</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

function CreateWorkspaceForm({
  onCreate,
  onCancel,
  isPending,
}: {
  onCreate: (name: string, clone?: string) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [clone, setClone] = useState('')

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required')
      return
    }
    onCreate(name.trim(), clone.trim() || undefined)
  }

  return (
    <View style={styles.createForm}>
      <Text style={styles.createFormTitle}>Create Workspace</Text>
      <TextInput
        style={styles.input}
        placeholder="Workspace name"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
        autoCapitalize="none"
        editable={!isPending}
      />
      <TextInput
        style={styles.input}
        placeholder="Clone URL (optional)"
        placeholderTextColor="#666"
        value={clone}
        onChangeText={setClone}
        autoCapitalize="none"
        editable={!isPending}
      />
      <View style={styles.createFormActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={isPending}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={isPending}>
          {isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

export function WorkspacesScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const { status } = useNetwork()

  const { data: workspaces, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; clone?: string }) => api.createWorkspace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setShowCreate(false)
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err))
    },
  })

  const startMutation = useMutation({
    mutationFn: (name: string) => api.startWorkspace(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const stopMutation = useMutation({
    mutationFn: (name: string) => api.stopWorkspace(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const handleWorkspacePress = useCallback((workspace: WorkspaceInfo) => {
    navigation.navigate('WorkspaceDetail', { name: workspace.name })
  }, [navigation])

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    )
  }

  if (error && status !== 'connected') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Cannot Load Workspaces</Text>
        <Text style={styles.errorText}>{parseNetworkError(error)}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const sortedWorkspaces = [...(workspaces || [])].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1
    if (a.status !== 'running' && b.status === 'running') return 1
    return new Date(b.created).getTime() - new Date(a.created).getTime()
  })

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workspaces</Text>
      </View>

      <FlatList
        data={sortedWorkspaces}
        keyExtractor={(item) => item.name}
        ListHeaderComponent={
          <>
            {workspaces && workspaces.length > 0 && <StatsBar workspaces={workspaces} />}
            {showCreate && (
              <CreateWorkspaceForm
                onCreate={(name, clone) => createMutation.mutate({ name, clone })}
                onCancel={() => setShowCreate(false)}
                isPending={createMutation.isPending}
              />
            )}
          </>
        }
        renderItem={({ item }) => (
          <WorkspaceItem
            workspace={item}
            onPress={() => handleWorkspacePress(item)}
            onStart={() => startMutation.mutate(item.name)}
            onStop={() => stopMutation.mutate(item.name)}
          />
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0a84ff" />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        ListEmptyComponent={
          !showCreate ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>No workspaces yet</Text>
              <Text style={styles.emptySubtext}>Tap + to create one</Text>
            </View>
          ) : null
        }
      />
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setShowCreate(!showCreate)}
        testID="create-workspace-button"
      >
        <Text style={styles.fabText}>{showCreate ? '×' : '+'}</Text>
      </TouchableOpacity>
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
  statsBar: {
    flexDirection: 'row',
    paddingVertical: 16,
    gap: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statsLabel: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  list: {
    padding: 16,
  },
  item: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  itemRepo: {
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: '#636366',
    marginBottom: 12,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  startBtn: {
    backgroundColor: '#34c759',
  },
  stopBtn: {
    backgroundColor: '#ff9f0a',
  },
  detailBtn: {
    backgroundColor: '#2c2c2e',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
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
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
  },
  createForm: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  createFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  createFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#8e8e93',
  },
  createBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0a84ff',
    minWidth: 80,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
})
