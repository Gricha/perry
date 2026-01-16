# Agent Instructions

## Skills

Use the `skill` tool for common workflows:

| Skill | When to use |
|-------|-------------|
| `validate` | Before committing, after changes, to verify code quality |
| `test` | To run targeted tests for your changes |
| `release` | To cut a new version release |

## Code Review Agents

Before submitting changes, run review agents in parallel with validation:

| Agent | When to use |
|-------|-------------|
| `security-review` | After auth, data handling, or user input changes |
| `perf-review` | After adding loops, data fetching, or heavy computation |
| `react-review` | After React component changes (web/ or mobile/) |

These agents review your local changes (uncommitted, branch diff, or last commit) and report issues. They will be honest - if the code is good, they'll say so. They may also suggest lint rules or tests to prevent similar issues in the future.

**Location**: Claude Code uses `.claude/agents/`, OpenCode uses `.opencode/agent/` (OpenCode agents reference the Claude Code files for shared instructions).

## Architecture

Read `DESIGN.md` for comprehensive architecture, data models, and API specifications.

Perry is a distributed development environment orchestrator using Docker-in-Docker containers.

- **Runtime**: Bun (not Node.js)
- **Language**: TypeScript with ES modules
- **API**: oRPC server with WebSocket terminals
- **Clients**: CLI with TUI, React web UI, React Native mobile app

## Implementation Patterns

- **Docker Operations**: CLI spawning (`src/docker/`), not Docker SDK
- **State Management**: File-locked JSON (`~/.config/perry/state.json`)
- **oRPC API**: Type-safe client/server communication
- **Worker Binary**: Compiled bun binary synced to containers

## Code Style

- Fight entropy - leave the codebase better than you found it. Prefer simpler solutions where it reasonably makes sense.
- Minimal dependencies
- Early returns, fail fast
- TypeScript strict mode
- Use `withLock()` for state mutations
- No comments in code (self-documenting)

## Constraints

- No CLI command additions without approval
- No pre-commit hooks (CI handles validation)
- No complex bash in docker exec (use TypeScript)
- No skipping failing tests
- Use SSH for user interaction (not `docker exec`)
- Follow naming: `workspace-<name>` containers, `workspace-internal-` resources

## Mobile

Install deps and run on iOS device:
```bash
cd mobile && bun install
bunx expo run:ios --device "<Your iPhone Name>" --no-bundler  # Terminal 1
bunx expo start --dev-client                                   # Terminal 2
```

Environment: `mobile/.env.local` (use `EXPO_PUBLIC_` prefix for runtime vars)
