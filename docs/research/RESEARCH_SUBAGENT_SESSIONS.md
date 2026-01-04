# Research: Subagent Session Identification

## Summary

Claude Code subagent sessions are **already filtered out** by our current parser implementation because they are stored in different locations than main sessions.

## Session Storage Locations

| Session Type | Storage Location | File Pattern |
|--------------|------------------|--------------|
| Main session | `~/.claude/projects/<encoded-project>/` | `<uuid>.jsonl` |
| Subagent | Project root directory (working dir) | `agent-<agentId>.jsonl` |

## Current Behavior

Our parser (`src/sessions/parser.ts`) only looks in `~/.claude/projects/` which means:
- Main sessions: **Included**
- Subagent sessions: **Excluded** (different location)

No code changes needed for filtering.

## Known Limitations

Per [GitHub Issue #7881](https://github.com/anthropics/claude-code/issues/7881):
- All subagents within a session share the same `session_id`
- No `parent_session_id` or `subagent_id` field exists yet
- Feature requests are open but not yet implemented (as of Dec 2025)

## Future Considerations

If we want to include subagent sessions in the future:
1. Search workspace directories for `agent-*.jsonl` files
2. Parse them using the same JSONL format
3. Add an `isSubagent: true` flag to session metadata

## Sources

- [Claude Code Subagents Docs](https://code.claude.com/docs/en/sub-agents)
- [GitHub Issue #7881](https://github.com/anthropics/claude-code/issues/7881) - SubagentStop hook session ID issue
- [GitHub Issue #10052](https://github.com/anthropics/claude-code/issues/10052) - Feature request for agent info
