import { useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, WorkspaceInfo, HOST_WORKSPACE_NAME } from '../lib/api'
import { useNetwork, parseNetworkError } from '../lib/network'

function StatusDot({ status }: { status: WorkspaceInfo['status'] | 'host' }) {
  const colors = {
    running: '#34c759',
    stopped: '#636366',
    creating: '#ff9f0a',
    error: '#ff3b30',
    host: '#f59e0b',
  }
  return <View style={[styles.statusDot, { backgroundColor: colors[status] }]} />
}

function WorkspaceRow({
  workspace,
  onPress,
}: {
  workspace: WorkspaceInfo
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} testID={`workspace-item-${workspace.name}`}>
      <StatusDot status={workspace.status} />
      <View style={styles.rowContent}>
        <Text style={styles.rowName} testID="workspace-name">{workspace.name}</Text>
        {workspace.repo && (
          <Text style={styles.rowRepo} numberOfLines={1}>{workspace.repo}</Text>
        )}
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  )
}

function HostSection({ onHostPress }: { onHostPress: () => void }) {
  const queryClient = useQueryClient()

  const { data: hostInfo, isLoading } = useQuery({
    queryKey: ['hostInfo'],
    queryFn: api.getHostInfo,
  })

  const { data: info } = useQuery({
    queryKey: ['info'],
    queryFn: api.getInfo,
  })

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => api.updateHostAccess(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostInfo'] })
    },
  })

  if (isLoading) {
    return (
      <View style={styles.hostSection}>
        <ActivityIndicator size="small" color="#8e8e93" />
      </View>
    )
  }

  return (
    <View style={styles.hostSection}>
      <View style={styles.hostHeader}>
        <View>
          <Text style={styles.hostLabel}>Host Machine</Text>
          <Text style={styles.hostName}>{info?.hostname || hostInfo?.hostname || 'Unknown'}</Text>
        </View>
        <Switch
          value={hostInfo?.enabled || false}
          onValueChange={(value) => toggleMutation.mutate(value)}
          trackColor={{ false: '#3a3a3c', true: '#f59e0b' }}
          thumbColor="#fff"
        />
      </View>

      {hostInfo?.enabled && (
        <>
          <TouchableOpacity style={styles.hostRow} onPress={onHostPress}>
            <StatusDot status="host" />
            <View style={styles.rowContent}>
              <Text style={styles.hostRowName}>
                {hostInfo.username}@{hostInfo.hostname}
              </Text>
              <Text style={styles.hostRowPath}>{hostInfo.homeDir}</Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <Text style={styles.hostWarning}>
            ⚠️ Commands run directly on your machine without isolation
          </Text>
        </>
      )}

      {!hostInfo?.enabled && info && (
        <View style={styles.hostStats}>
          <Text style={styles.hostStat}>{info.workspacesCount} workspaces</Text>
          <Text style={styles.hostStatDivider}>•</Text>
          <Text style={styles.hostStat}>Docker {info.dockerVersion}</Text>
        </View>
      )}
    </View>
  )
}

export function HomeScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { status } = useNetwork()

  const { data: workspaces, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  const handleWorkspacePress = useCallback((workspace: WorkspaceInfo) => {
    navigation.navigate('WorkspaceDetail', { name: workspace.name })
  }, [navigation])

  const handleHostPress = useCallback(() => {
    navigation.navigate('WorkspaceDetail', { name: HOST_WORKSPACE_NAME })
  }, [navigation])

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
        <Text style={styles.errorIcon}>!</Text>
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
        <Text style={styles.headerTitle}>Perry</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
          testID="settings-button"
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedWorkspaces}
        keyExtractor={(item) => item.name}
        ListHeaderComponent={<HostSection onHostPress={handleHostPress} />}
        renderItem={({ item }) => (
          <WorkspaceRow
            workspace={item}
            onPress={() => handleWorkspacePress(item)}
          />
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0a84ff" />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No workspaces</Text>
            <Text style={styles.emptySubtext}>Create one from the web UI or CLI</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  settingsBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 22,
    color: '#8e8e93',
  },
  hostSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  hostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hostLabel: {
    fontSize: 12,
    color: '#636366',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hostName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f59e0b33',
  },
  hostRowName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f59e0b',
  },
  hostRowPath: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },
  hostWarning: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 10,
    textAlign: 'center',
  },
  hostStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  hostStat: {
    fontSize: 13,
    color: '#8e8e93',
  },
  hostStatDivider: {
    fontSize: 13,
    color: '#636366',
    marginHorizontal: 8,
  },
  list: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
  },
  rowRepo: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },
  rowChevron: {
    fontSize: 20,
    color: '#636366',
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#1c1c1e',
    marginLeft: 38,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 17,
    color: '#8e8e93',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#636366',
    marginTop: 4,
  },
  errorIcon: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ff3b30',
    marginBottom: 12,
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
