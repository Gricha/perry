# Workspace Implementation Tasks

> **Workflow**:
>
> - **Completed tasks are removed** from this list entirely
> - **New task ideas go to Considerations** section first for discussion
> - **Tasks listed below are confirmed work** that must be performed
>
> **Research Tasks**:
>
> - Research tasks are always allowed and should be performed when listed
> - Document findings in `docs/research/RESEARCH_<TOPIC>.md` files
> - Convert research into concrete implementation tasks when complete

---

## Tasks

### Binary Distribution via Curl Install Script

Switch from npm-based distribution to standalone binary distribution with curl install script (like OpenCode/Claude Code).

**Benefits:**
- No runtime dependency (currently requires Bun installed globally)
- Single binary, faster cold starts with bytecode compilation
- Simpler: `curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash`

#### Phase 1: Binary Build System

- [ ] Create binary build script using Bun's `--compile` flag for all platforms:
  - `perry-linux-x64` (glibc)
  - `perry-linux-arm64` (glibc)
  - `perry-darwin-x64` (Intel Mac)
  - `perry-darwin-arm64` (Apple Silicon)
  - `perry-windows-x64.exe`
- [ ] Use `--minify --bytecode` flags for optimized binaries
- [ ] Handle web UI assets embedding (investigate Bun file embedding)
- [ ] Add `build:binaries` script to package.json
- [ ] Test compiled binary runs basic commands locally

#### Phase 2: Install Script

- [ ] Create `install.sh` at repository root with:
  - Platform detection (Darwin/Linux via uname)
  - Architecture detection (x64/arm64)
  - GitHub releases API to fetch latest version
  - Download binary from GitHub releases
  - Install to `$HOME/.perry/bin` (or `$PERRY_INSTALL_DIR`)
  - PATH modification (.bashrc, .zshrc, config.fish, .profile)
  - Post-install verification (`perry --version`)
- [ ] Support `--version` flag for specific version install
- [ ] Support `--no-modify-path` flag
- [ ] GitHub Actions detection (add to `$GITHUB_PATH`)

#### Phase 3: Release Workflow

- [ ] Add `binaries` job to `.github/workflows/release.yml`:
  - Cross-compile for all targets using Bun
  - Create archives (tar.gz for Linux/macOS, zip for Windows)
  - Upload to GitHub Releases
  - Generate SHA256 checksums
- [ ] Keep npm publish as alternative install method

#### Phase 4: Update Checker

- [ ] Modify `src/update-checker.ts`:
  - Query GitHub releases API instead of npm registry
  - Update upgrade message to show curl command
- [ ] (Optional) Add `perry upgrade` self-update command

#### Phase 5: Documentation

- [ ] Update `docs/docs/installation.md` with curl install as primary method
- [ ] Update README.md
- [ ] Document manual download from GitHub Releases
- [ ] Document uninstall process

---

### Consolidate Chat Handlers with Adapter Pattern

**Context:** `src/chat/handler.ts` (container) and `src/chat/host-handler.ts` (host) share ~95% identical code:
- `StreamMessage` interface duplicated (L18-40 vs L11-33)
- `processBuffer()` method identical
- `handleStreamMessage()` method ~95% identical
- `interrupt()` method identical
- Default model `'sonnet'` hardcoded in both

Same pattern exists for OpenCode handlers. When we add more agents, this will get worse.

**Task:** Refactor to adapter pattern:

1. Create `src/chat/base-chat-session.ts`:
   - Move `StreamMessage` interface here
   - Create abstract `BaseChatSession` class with:
     - `protected buffer: string`
     - `protected sessionId?: string`
     - `protected model: string` (default from constant)
     - `protected processBuffer(): void` - shared implementation
     - `protected handleStreamMessage(msg: StreamMessage): void` - shared implementation
     - `async interrupt(): Promise<void>` - shared implementation
     - `abstract getSpawnCommand(): string[]` - what differs between container/host
     - `abstract getSpawnOptions(): object` - cwd, env differences

2. Create `src/chat/adapters/`:
   - `container-adapter.ts` - implements spawn for `docker exec` into container
   - `host-adapter.ts` - implements spawn for direct `claude` execution

3. Refactor `ChatSession` and `HostChatSession` to extend `BaseChatSession` and use adapters

4. Do the same for OpenCode handlers (`opencode-handler.ts`, `host-opencode-handler.ts`)

5. Move default model `'sonnet'` to `src/shared/constants.ts` as `DEFAULT_CLAUDE_MODEL`

**Files to create:**
- `src/chat/base-chat-session.ts`
- `src/chat/adapters/container-adapter.ts`
- `src/chat/adapters/host-adapter.ts`

**Files to modify:**
- `src/chat/handler.ts` - extend base, use adapter
- `src/chat/host-handler.ts` - extend base, use adapter
- `src/chat/opencode-handler.ts` - same pattern
- `src/chat/host-opencode-handler.ts` - same pattern
- `src/shared/constants.ts` - add DEFAULT_CLAUDE_MODEL

**Verify:** Chat still works for both container and host workspaces. Run existing chat tests.

---

## Considerations

> Add items here to discuss with project owner before promoting to tasks.

### OpenCode Server API Integration

Research completed - see [RESEARCH_AGENT_TERMINAL.md](./docs/research/RESEARCH_AGENT_TERMINAL.md)

Current approach uses `opencode run --format json` per message. OpenCode has `opencode serve` with HTTP API and SSE streaming that would be more efficient.

**Challenges:**
- OpenCode server runs inside container, Perry agent on host
- Requires either port exposure or docker exec tunneling
- Port exposure needs container/Dockerfile changes
- Docker exec approach doesn't provide significant benefits

**Prerequisites for implementation:**
- Decide on port exposure strategy (add internal port or use SSH tunneling)
- Determine process lifecycle management (on-demand vs always-on)
- @opencode-ai/sdk available for TypeScript client

**Recommendation:** Lower priority given working CLI approach with session history loading. Consider when container port exposure strategy is decided.

### Design Document Updates (Pending Review)

- **Port range discrepancy**: Design says "starts at 4200" but implementation uses 2200-2400
- **SSE streaming not implemented**: Design specifies SSE for log streaming (`?follow=true`) but implementation uses simple request/response
- **Config API is writable**: Design says read-only but implementation allows updates via API (this is better, just document it)

### Token Usage Tracking

Research document: [docs/research/RESEARCH_TOKEN_USAGE.md](./docs/research/RESEARCH_TOKEN_USAGE.md)

Track API token usage across workspaces to monitor costs. Approaches researched:

- Log-based collection from workspaces
- SQLite storage on agent
- Per-agent and per-workspace breakdown
- Cost estimation based on model pricing

### Mock Claude API in Chat Tests

Consider adding MSW (Mock Service Worker) or similar to mock Claude API responses in chat integration tests. This would:
- Avoid requiring real API keys in CI
- Make tests faster and more reliable
- Allow testing of specific response scenarios
