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
import { api, AgentType } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { parseNetworkError } from '../lib/network';

type Skill = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  appliesTo: 'all' | AgentType[];
  skillMd: string;
};

const AGENT_TYPES: AgentType[] = ['claude-code', 'opencode', 'codex'];

const AGENT_LABELS: Record<AgentType, string> = {
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
  codex: 'Codex',
};

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toSkillMd(skill: { name: string; description: string; body: string }): string {
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body.trim()}\n`;
}

function defaultSkillMd(slug: string): string {
  return toSkillMd({
    name: slug,
    description: 'Describe what this skill does and when to use it.',
    body: '# Instructions\n\n- Provide step-by-step guidance.\n',
  });
}

function newSkill(): Skill {
  const id = `skill_${Math.random().toString(16).slice(2)}`;
  const name = 'new-skill';
  return {
    id,
    name,
    description: 'Describe what this skill does and when to use it.',
    enabled: true,
    appliesTo: 'all',
    skillMd: defaultSkillMd(name),
  };
}

function normalizeSkill(skill: Skill): Skill {
  const safeName = slugify(skill.name) || 'skill';
  const safeDescription =
    skill.description?.trim() || 'Describe what this skill does and when to use it.';
  return {
    ...skill,
    name: safeName,
    description: safeDescription,
    skillMd: skill.skillMd?.trim().length ? skill.skillMd : defaultSkillMd(safeName),
  };
}

function appliesToList(appliesTo: Skill['appliesTo']): AgentType[] {
  return appliesTo === 'all' ? [...AGENT_TYPES] : appliesTo;
}

function toggleAgent(appliesTo: Skill['appliesTo'], agent: AgentType): Skill['appliesTo'] {
  if (appliesTo === 'all') {
    return AGENT_TYPES.filter((a) => a !== agent);
  }

  const set = new Set(appliesTo);
  if (set.has(agent)) set.delete(agent);
  else set.add(agent);

  const next = Array.from(set);
  return next.length === AGENT_TYPES.length ? 'all' : next;
}

export function SkillsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['skills'],
    queryFn: api.getSkills as unknown as () => Promise<Skill[]>,
  });

  const [drafts, setDrafts] = useState<Skill[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      setDrafts(data.map((s) => normalizeSkill(s as Skill)));
      setInitialized(true);
    }
  }, [data, initialized]);

  const mutation = useMutation({
    mutationFn: (skills: Skill[]) =>
      (api.updateSkills as unknown as (input: Skill[]) => Promise<Skill[]>)(
        skills.map(normalizeSkill)
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      setHasChanges(false);
      Alert.alert('Success', 'Skills saved');
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err));
    },
  });

  const setSkill = (index: number, next: Skill) => {
    const updated = [...drafts];
    updated[index] = next;
    setDrafts(updated);
    setHasChanges(true);
  };

  const removeSkill = (index: number) => {
    setDrafts(drafts.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const addSkill = () => {
    setDrafts([...drafts, newSkill()]);
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Skills</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Failed to load skills</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Skills</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border }]}
            onPress={addSkill}
          >
            <Text style={[styles.actionBtnText, { color: colors.text }]}>+ Skill</Text>
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
              No skills configured
            </Text>
          </View>
        ) : (
          drafts.map((skill, index) => (
            <View
              key={skill.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.cardHeaderRow}>
                <TextInput
                  style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
                  value={skill.name}
                  onChangeText={(t) => setSkill(index, { ...skill, name: t })}
                  placeholder="skill-name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => removeSkill(index)} style={styles.deleteBtn}>
                  <Text style={[styles.deleteBtnText, { color: '#ff3b30' }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                value={skill.description}
                onChangeText={(t) => setSkill(index, { ...skill, description: t })}
                placeholder="Description"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Enabled</Text>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    { backgroundColor: skill.enabled ? colors.accent : colors.border },
                  ]}
                  onPress={() => setSkill(index, { ...skill, enabled: !skill.enabled })}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      { transform: [{ translateX: skill.enabled ? 18 : 0 }] },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.appliesRow}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Applies To</Text>
                <View style={styles.chipsRow}>
                  {AGENT_TYPES.map((agent) => {
                    const active = appliesToList(skill.appliesTo).includes(agent);
                    return (
                      <TouchableOpacity
                        key={agent}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? colors.accent : colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() =>
                          setSkill(index, {
                            ...skill,
                            appliesTo: toggleAgent(skill.appliesTo, agent),
                          })
                        }
                      >
                        <Text style={[styles.chipText, { color: active ? '#fff' : colors.text }]}>
                          {AGENT_LABELS[agent]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textMuted }]}>SKILL.md</Text>
                <TouchableOpacity
                  style={[styles.smallBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    const slug = slugify(skill.name) || 'skill';
                    setSkill(index, {
                      ...skill,
                      name: slug,
                      skillMd: toSkillMd({
                        name: slug,
                        description: skill.description,
                        body: '# Instructions\n',
                      }),
                    });
                  }}
                >
                  <Text style={[styles.smallBtnText, { color: colors.text }]}>Reset</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.textArea, { color: colors.text, borderColor: colors.border }]}
                value={skill.skillMd}
                onChangeText={(t) => setSkill(index, { ...skill, skillMd: t })}
                placeholder="SKILL.md contents"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ))
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
  smallBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallBtnText: { fontSize: 12, fontWeight: '700' },
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
  textArea: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    minHeight: 180,
    fontFamily: 'monospace',
  },
  appliesRow: { marginTop: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  errorContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  errorTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  errorText: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryButton: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  retryButtonText: { color: '#fff', fontWeight: '700' },
});
