import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { parseNetworkError } from '../lib/network';

type McpOauthConfig =
  | false
  | {
      clientId?: string;
      clientSecret?: string;
      scope?: string;
    };

type McpServer = {
  id: string;
  name: string;
  enabled: boolean;
  type: 'local' | 'remote';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  oauth?: McpOauthConfig;
};

type KV = { key: string; value: string };

function kvFromObject(obj: Record<string, string> | undefined): KV[] {
  return Object.entries(obj || {}).map(([key, value]) => ({ key, value }));
}

function kvToObject(entries: KV[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) continue;
    out[key] = entry.value;
  }
  return out;
}

function newServer(): McpServer {
  const id = `mcp_${Math.random().toString(16).slice(2)}`;
  return {
    id,
    name: 'my-mcp',
    enabled: true,
    type: 'local',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    env: {},
  };
}

export function McpServersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mcp'],
    queryFn: api.getMcpServers as unknown as () => Promise<McpServer[]>,
  });

  const [drafts, setDrafts] = useState<McpServer[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      setDrafts(data);
      setInitialized(true);
    }
  }, [data, initialized]);

  const mutation = useMutation({
    mutationFn: (servers: McpServer[]) =>
      (api.updateMcpServers as unknown as (input: McpServer[]) => Promise<McpServer[]>)(servers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp'] });
      setHasChanges(false);
      Alert.alert('Success', 'MCP servers saved');
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err));
    },
  });

  const setServer = (index: number, next: McpServer) => {
    const updated = [...drafts];
    updated[index] = next;
    setDrafts(updated);
    setHasChanges(true);
  };

  const removeServer = (index: number) => {
    setDrafts(drafts.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const addServer = () => {
    setDrafts([...drafts, newServer()]);
    setHasChanges(true);
  };

  const handleSave = () => {
    mutation.mutate(drafts);
  };

  if (error) {
    return (
      <View
        style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: colors.accent }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>MCP</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Failed to load MCP servers
          </Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>
            {parseNetworkError(error as Error)}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={() => refetch()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.accent }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>MCP</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border }]}
            onPress={addServer}
          >
            <Text style={[styles.actionBtnText, { color: colors.text }]}>+ MCP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: hasChanges ? colors.accent : colors.surface },
            ]}
            onPress={handleSave}
            disabled={!hasChanges || mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.textMuted} />
          </View>
        ) : drafts.length === 0 ? (
          <View style={[styles.emptyCard, { borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>
              No MCP servers configured
            </Text>
          </View>
        ) : (
          drafts.map((server, index) => {
            const headers = kvFromObject(server.headers);
            const env = kvFromObject(server.env);

            return (
              <View
                key={server.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <TextInput
                    style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
                    value={server.name}
                    onChangeText={(t) => setServer(index, { ...server, name: t })}
                    placeholder="server-name"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => removeServer(index)} style={styles.deleteBtn}>
                    <Text style={[styles.deleteBtnText, { color: '#ff3b30' }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Enabled</Text>
                  <TouchableOpacity
                    style={[
                      styles.toggle,
                      { backgroundColor: server.enabled ? colors.accent : colors.border },
                    ]}
                    onPress={() => setServer(index, { ...server, enabled: !server.enabled })}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        { transform: [{ translateX: server.enabled ? 18 : 0 }] },
                      ]}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.segmentRow}>
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      {
                        backgroundColor:
                          server.type === 'local' ? colors.accent : colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() =>
                      setServer(index, {
                        ...server,
                        type: 'local',
                        url: undefined,
                        headers: undefined,
                        oauth: undefined,
                        command: server.command || 'npx',
                        args: server.args || ['-y', '@modelcontextprotocol/server-everything'],
                        env: server.env || {},
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        { color: server.type === 'local' ? '#fff' : colors.text },
                      ]}
                    >
                      Local
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      {
                        backgroundColor:
                          server.type === 'remote' ? colors.accent : colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() =>
                      setServer(index, {
                        ...server,
                        type: 'remote',
                        command: undefined,
                        args: undefined,
                        env: undefined,
                        url: server.url || 'https://example.com/mcp',
                        headers: server.headers || {},
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        { color: server.type === 'remote' ? '#fff' : colors.text },
                      ]}
                    >
                      Remote
                    </Text>
                  </TouchableOpacity>
                </View>

                {server.type === 'remote' ? (
                  <>
                    <TextInput
                      style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                      value={server.url || ''}
                      onChangeText={(t) => setServer(index, { ...server, url: t })}
                      placeholder="https://.../mcp"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <View style={styles.presetRow}>
                      <TouchableOpacity
                        style={[styles.presetBtn, { borderColor: colors.border }]}
                        onPress={() =>
                          setServer(index, {
                            ...server,
                            headers: {
                              ...server.headers,
                              Authorization: 'Bearer {env:API_KEY}',
                            },
                            oauth: false,
                          })
                        }
                      >
                        <Text style={[styles.presetBtnText, { color: colors.text }]}>Bearer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.presetBtn, { borderColor: colors.border }]}
                        onPress={() => setServer(index, { ...server, oauth: {} })}
                      >
                        <Text style={[styles.presetBtnText, { color: colors.text }]}>OAuth</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.subLabel, { color: colors.textMuted }]}>Headers</Text>
                    {headers.map((row, i) => (
                      <View key={i} style={styles.kvRow}>
                        <TextInput
                          style={[
                            styles.kvInput,
                            { color: colors.text, borderColor: colors.border },
                          ]}
                          value={row.key}
                          onChangeText={(t) => {
                            const next = [...headers];
                            next[i] = { ...next[i], key: t };
                            setServer(index, { ...server, headers: kvToObject(next) });
                          }}
                          placeholder="key"
                          placeholderTextColor={colors.textMuted}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TextInput
                          style={[
                            styles.kvInput,
                            { color: colors.text, borderColor: colors.border },
                          ]}
                          value={row.value}
                          onChangeText={(t) => {
                            const next = [...headers];
                            next[i] = { ...next[i], value: t };
                            setServer(index, { ...server, headers: kvToObject(next) });
                          }}
                          placeholder="value"
                          placeholderTextColor={colors.textMuted}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TouchableOpacity
                          style={styles.kvDelete}
                          onPress={() => {
                            const next = headers.filter((_, j) => j !== i);
                            setServer(index, { ...server, headers: kvToObject(next) });
                          }}
                        >
                          <Text style={[styles.kvDeleteText, { color: '#ff3b30' }]}>-</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: colors.border }]}
                      onPress={() =>
                        setServer(index, {
                          ...server,
                          headers: kvToObject([...headers, { key: '', value: '' }]),
                        })
                      }
                    >
                      <Text style={[styles.smallBtnText, { color: colors.text }]}>+ Header</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TextInput
                      style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                      value={server.command || ''}
                      onChangeText={(t) => setServer(index, { ...server, command: t || undefined })}
                      placeholder="command"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <TextInput
                      style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                      value={(server.args || []).join(' ')}
                      onChangeText={(t) =>
                        setServer(index, {
                          ...server,
                          args: t
                            .split(' ')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="args (space separated)"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <Text style={[styles.subLabel, { color: colors.textMuted }]}>Env</Text>
                    {env.map((row, i) => (
                      <View key={i} style={styles.kvRow}>
                        <TextInput
                          style={[
                            styles.kvInput,
                            { color: colors.text, borderColor: colors.border },
                          ]}
                          value={row.key}
                          onChangeText={(t) => {
                            const next = [...env];
                            next[i] = { ...next[i], key: t };
                            setServer(index, { ...server, env: kvToObject(next) });
                          }}
                          placeholder="key"
                          placeholderTextColor={colors.textMuted}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TextInput
                          style={[
                            styles.kvInput,
                            { color: colors.text, borderColor: colors.border },
                          ]}
                          value={row.value}
                          onChangeText={(t) => {
                            const next = [...env];
                            next[i] = { ...next[i], value: t };
                            setServer(index, { ...server, env: kvToObject(next) });
                          }}
                          placeholder="value"
                          placeholderTextColor={colors.textMuted}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TouchableOpacity
                          style={styles.kvDelete}
                          onPress={() => {
                            const next = env.filter((_, j) => j !== i);
                            setServer(index, { ...server, env: kvToObject(next) });
                          }}
                        >
                          <Text style={[styles.kvDeleteText, { color: '#ff3b30' }]}>-</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: colors.border }]}
                      onPress={() =>
                        setServer(index, {
                          ...server,
                          env: kvToObject([...env, { key: '', value: '' }]),
                        })
                      }
                    >
                      <Text style={[styles.smallBtnText, { color: colors.text }]}>+ Env</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 32, fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  headerPlaceholder: { width: 44 },
  content: { padding: 16 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionBtnText: { fontWeight: '600' },
  saveBtn: {
    marginLeft: 'auto',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  loadingContainer: { paddingVertical: 20, alignItems: 'center' },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 13, fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 18, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggle: { width: 42, height: 24, borderRadius: 12, padding: 3 },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  textInput: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  segmentRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentBtnText: { fontSize: 13, fontWeight: '700' },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  presetBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetBtnText: { fontSize: 12, fontWeight: '700' },
  kvRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  kvInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  kvDelete: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kvDeleteText: { fontSize: 18, fontWeight: '700' },
  smallBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  smallBtnText: { fontSize: 12, fontWeight: '700' },
  errorContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  errorTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  errorText: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryButton: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  retryButtonText: { color: '#fff', fontWeight: '700' },
});
