# Workspace Implementation Tasks

> **Workflow**:
> - **Completed tasks are removed** from this list entirely
> - **New task ideas go to Considerations** section first for discussion
> - **Tasks listed below are confirmed work** that must be performed

---

## Priority Tasks

### P0: Critical Terminal Bugs

**Problem**: Both TUI shell and web terminal are broken, making the core user experience non-functional.

**TUI Shell Bug**
- [ ] Debug TUI shell flow: `renderer.destroy()` → `openShell()` → terminal bricks
- [ ] Investigate if stdin raw mode cleanup conflicts with WebSocket shell
- [ ] Test if `@opentui/core` alternate screen cleanup is interfering
- [ ] Add proper terminal state restoration after shell exits
- [ ] Ensure Ctrl-C works to break out of hung state

**Web Terminal Bug**
- [ ] Debug web terminal WebSocket connection flow
- [ ] Verify Bun.Terminal PTY is correctly piping data to WebSocket
- [ ] Test if xterm.js is receiving data from backend
- [ ] Check if resize messages are being handled correctly
- [ ] Add error logging to trace where data flow breaks

**Files**:
- `src/client/shell.ts` (TUI shell WebSocket client)
- `src/tui/app.ts` (TUI renderer and shell integration)
- `src/terminal/handler.ts` (PTY session using Bun.Terminal)
- `src/terminal/websocket.ts` (WebSocket server for terminal)
- `web/src/components/Terminal.tsx` (xterm.js frontend)

---

### P1: Multi-Agent Support (OpenCode, Codex)

**Problem**: Currently only supports Claude Code sessions. Need to support OpenCode and Codex agents.

**Research Needed**:
- [ ] Research OpenCode session storage location (`~/.opencode/` or similar)
- [ ] Research Codex/OpenAI agent session format and storage
- [ ] Document session formats for each agent type

**Backend Implementation**:
- [ ] Extend `src/sessions/parser.ts` to detect and parse OpenCode sessions
- [ ] Extend parser for Codex sessions
- [ ] Update `sessions.list` RPC to aggregate sessions from all agent types
- [ ] Add agent type filtering to sessions API

**Frontend Integration**:
- [ ] Add agent type selector in Sessions page
- [ ] Show agent icon/badge for each session
- [ ] Support starting new sessions with different agents (`opencode`, `codex`, `claude`)

**Credentials Config**:

*OpenCode*:
- [ ] Research OpenCode credential requirements (Zen API key or custom provider)
- [ ] Add OpenCode API key field in Settings → Agents
- [ ] Support configurable API base URL for vendor-agnostic setup

*OpenAI/Codex (OAuth Flow)*:
- [ ] Research OpenAI OAuth flow for subscription-based access
- [ ] Implement OAuth redirect handler in agent server
- [ ] Store OAuth tokens securely (refresh token flow)
- [ ] Add "Connect OpenAI Account" button in Settings → Agents
- [ ] Handle token refresh on expiry

*Injection*:
- [ ] Inject configured credentials into workspace environment on start
- [ ] Support credential rotation without workspace restart

---

### P2: Agent Chat UI Improvements

**Vision**: Remote chat interface for controlling agents in workspaces when away from terminal.

- **Not a replacement** for terminal — Claude Code's terminal UX is superior for desktop work
- **Remote access use case** — check on agents, send commands, review progress from web/mobile
- **Requires running workspace** — agents execute inside the workspace container
- **Future**: Same interface powers mobile app

**Problem**: Current Sessions page uses terminal fallback. Need proper chat interface for remote UX.

**Phase 1: Sessions Menu & Navigation**
- [ ] Add Sessions to main sidebar navigation (not just per-workspace)
- [ ] Create sessions overview page showing all sessions across workspaces
- [ ] Add quick-start buttons for each agent type

**Phase 2: Chat Interface**
- [ ] Create `ChatView.tsx` component with message bubbles (user/assistant)
- [ ] Support markdown rendering in assistant messages
- [ ] Show tool calls/results in collapsible sections
- [ ] Add message timestamps and session metadata header

**Phase 3: Interactive Chat (Streaming)**
- [ ] Integrate with Agent SDK for real-time streaming
- [ ] Add input box for sending new messages
- [ ] Handle streaming responses with typing indicators
- [ ] Support for interrupting/canceling responses

**Frontend Polish** (use `frontend-design` skill):
- [ ] Redesign Sessions page with better visual hierarchy
- [ ] Improve session list with better cards/previews
- [ ] Add empty states and loading skeletons
- [ ] Mobile-responsive chat layout

**Files**:
- `web/src/pages/Sessions.tsx`
- `web/src/components/ChatView.tsx` (new)
- `web/src/components/MessageBubble.tsx` (new)
- `web/src/components/SessionCard.tsx` (new)

---

### P3: End-to-End Testing

**Problem**: No automated tests for web UI or TUI. Need confidence in functionality.

> **Note**: These tests may require the local development environment and won't run in CI. That's acceptable.

**Playwright Web UI Tests** (`test/e2e-web/`):

*Setup*:
- [ ] Install Playwright: `bun add -d @playwright/test`
- [ ] Create `playwright.config.ts` with base URL pointing to local agent
- [ ] Add npm script: `test:e2e-web`

*Test Cases*:
- [ ] Workspace list page loads and displays workspaces
- [ ] Can create a new workspace via UI
- [ ] Can start/stop workspace via UI
- [ ] Can navigate to workspace detail page
- [ ] Settings pages load and save correctly
- [ ] Sessions page lists sessions for a workspace
- [ ] Session preview shows messages
- [ ] Terminal component connects (when fixed)

**TUI Tests** (`test/e2e-tui/`):

*Approach*: Use `node-pty` + expect-like assertions on terminal output

*Setup*:
- [ ] Create test harness that spawns TUI and captures output
- [ ] Implement helpers: `expectOutput(pattern)`, `sendKeys(keys)`, `waitForPrompt()`
- [ ] Add npm script: `test:e2e-tui`

*Test Cases*:
- [ ] TUI starts and shows workspace list
- [ ] Can navigate with arrow keys
- [ ] Can select workspace and see detail view
- [ ] Keyboard shortcuts work (n:new, r:refresh, q:quit)
- [ ] Worker configuration prompt works
- [ ] Shell opens without hanging (when fixed)

**Files**:
- `test/e2e-web/` (new directory)
- `test/e2e-tui/` (new directory)
- `playwright.config.ts` (new)

---

## Phase 13: Polish (Future)

- [ ] User documentation
- [ ] Docker image publishing to registry
- [ ] `ws agent logs` command for debugging

---

## Research Tasks

- [ ] Research GitHub Copilot token portability (lower priority)

---

## Considerations

> Add items here to discuss with project owner before promoting to tasks.

### Design Document Updates (Pending Review)

- **Port range discrepancy**: Design says "starts at 4200" but implementation uses 2200-2400
- **SSE streaming not implemented**: Design specifies SSE for log streaming (`?follow=true`) but implementation uses simple request/response
- **Config API is writable**: Design says read-only but implementation allows updates via API (this is better, just document it)

### Token Usage Tracking

Research document: [RESEARCH_TOKEN_USAGE.md](./RESEARCH_TOKEN_USAGE.md)

Track API token usage across workspaces to monitor costs. Approaches researched:
- Log-based collection from workspaces
- SQLite storage on agent
- Per-agent and per-workspace breakdown
- Cost estimation based on model pricing

### Other

- Add unit test directory structure (`test/unit/`)
- Consider consolidating all types to `src/shared/types.ts`
