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

### Sessions UI Redesign

#### Phase 1: Parser Bug Fix
(Completed - parser fixes and unit tests added)

#### Phase 2: Session Identification
- [ ] Add Playwright tests for session ID visibility in list and detail views
- [ ] Add Playwright tests for session rename functionality

#### Phase 3: Sessions List Redesign
- [ ] Convert sessions from card grid to single-column list layout
- [ ] Add date groupings (Today, Yesterday, This Week, Older)
- [ ] Add compact agent indicator badges `[CC]` `[OC]` `[CX]`
- [ ] Show: session ID, title/first prompt, workspace path, message count, relative time
- [ ] Add unified sessions view across all workspaces (not just per-workspace)
- [ ] Add Playwright tests for sessions list layout and grouping

#### Phase 4: Tool Call Intertwining
- [ ] Refactor Chat message rendering to show tool calls inline (not grouped at top)
- [ ] Split assistant messages at tool call boundaries into separate bubbles
- [ ] Add visual grouping (vertical connector line) for messages in same turn
- [ ] Keep tool call details collapsible but inline
- [ ] Add Playwright tests for tool call display order and intertwining

---

## Considerations

> Add items here to discuss with project owner before promoting to tasks.

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

### systemd Service Installation

DESIGN.md mentions `ws agent install` for systemd service installation. Not currently implemented. Would allow:
```bash
ws agent install
systemctl start workspace-agent
```

### Mock Claude API in Chat Tests

Consider adding MSW (Mock Service Worker) or similar to mock Claude API responses in chat integration tests. This would:
- Avoid requiring real API keys in CI
- Make tests faster and more reliable
- Allow testing of specific response scenarios

### Large File Refactoring

5 files exceed 500 lines and could be split for maintainability:

| File | Lines | Suggested Split |
|------|-------|-----------------|
| `src/agent/router.ts` | 643 | → workspaces.ts, sessions.ts, config.ts |
| `src/sessions/parser.ts` | 597 | → claude-parser.ts, opencode-parser.ts, codex-parser.ts |
| `src/workspace/manager.ts` | 521 | → Extract credentials.ts, cleanup.ts |
| `src/tui/app.ts` | 487 | → Extract views, handlers |
| `src/index.ts` | 451 | → Split commands by domain |

Lower priority than deduplication - consider after other cleanup.
