# Research: Agent Terminal Integration

This document covers how OpenCode and Codex handle their terminal/chat experience and how we can integrate them into the workspace web UI.

## OpenCode

### Architecture

OpenCode uses a client/server architecture that separates the backend from the UI:

- **`opencode serve`** - Runs a headless HTTP server exposing an OpenAPI endpoint
- **`opencode web`** - Starts an HTTP server and opens a web browser interface
- **`opencode attach`** - Attaches a TUI terminal to an already-running backend server

This architecture allows OpenCode to run on your computer while you drive it remotely from other clients.

### TUI Implementation

- Built on the [Bubble Tea](https://github.com/charmbracelet/bubbletea) framework (Go)
- Provides interactive terminal interface with Vim-like keybindings
- Features session management, tool integration, and persistent storage (SQLite)
- Supports scroll acceleration and customizable UI settings

### Non-Interactive Mode

OpenCode can run non-interactively by passing a prompt directly:
```bash
opencode "explain this codebase"
```

This is useful for scripting, automation, or quick answers without the full TUI.

### Streaming & API

- Real-time SSE (Server-Sent Events) streaming for responses
- Session management via API
- Multiple third-party web interfaces exist:
  - [opencode-web (bjesus)](https://github.com/bjesus/opencode-web) - SolidJS, real-time streaming
  - [opencode-web (chris-tse)](https://github.com/chris-tse/opencode-web) - Modern chat interface
  - [opencode-manager](https://github.com/chriswritescode-dev/opencode-manager) - Mobile-first PWA
  - [portal](https://github.com/hosenur/portal) - Git integration, in-browser terminal

### Integration Options for Workspace

1. **Use OpenCode's Server API** - Start `opencode serve` in container, connect from web UI
2. **Capture Terminal Output** - Run in PTY, stream output to web via WebSocket
3. **Embed Third-Party UI** - Iframe or port existing web interfaces

**Recommendation**: Option 1 (Server API) is cleanest. OpenCode's architecture is designed for this. We could add an `opencode serve` process in workspaces and connect to its API.

---

## Codex CLI

### Architecture

Codex is a Node.js-based CLI that primarily runs as a local terminal application:

- **Interactive Mode** - `codex` starts a full-screen TUI (REPL)
- **Non-Interactive Mode** - `codex exec` streams results to stdout or JSONL
- No official server/client separation like OpenCode

### TUI Implementation

- Full-screen terminal UI built with Node.js
- Three approval modes: Suggest (default), Auto Edit, Full Auto
- Session persistence for resuming conversations
- Model switching via `/model` command

### Non-Interactive Mode

```bash
codex exec "add error handling to this function"
```

- Streams response to stdout
- Can output JSONL format for parsing
- Supports session resume

### Streaming & Output

- Streaming responses available via API (`stream: true`)
- JSONL output mode for structured data
- Session transcripts stored locally

### Remote Access Challenges

Codex has significant challenges with remote/headless environments:

- OAuth uses `localhost` callback - impossible in terminal-only sessions
- Workarounds exist but are cumbersome (port forwarding, curl hacks)
- Feature request pending for headless OAuth support

### Third-Party Web Interfaces

- [Codex Remote Runner](https://github.com/EdwardAThomson/Codex-Remote-Runner) - NestJS backend, Next.js frontend, real-time streaming

### Integration Options for Workspace

1. **Capture PTY Output** - Run `codex` in PTY, stream to web WebSocket (current approach)
2. **Non-Interactive Mode** - Use `codex exec` with JSONL, parse and display
3. **Third-Party Integration** - Port Codex Remote Runner concepts

**Recommendation**: Option 1 (PTY capture) is most reliable. Codex doesn't have a clean API separation. We already do this with our terminal WebSocket - the main UX question is how to present agent-specific sessions vs raw terminal.

---

## Comparison Summary

| Feature | OpenCode | Codex |
|---------|----------|-------|
| Client/Server Architecture | Yes (`serve`, `web`) | No |
| Non-Interactive Mode | Yes | Yes (`exec`) |
| Streaming Output | SSE | stdout/JSONL |
| Session Persistence | SQLite | Local files |
| Web Interface | Official (`web`) + third-party | Third-party only |
| Remote Auth | Works | Challenging |

---

## Recommendations for Workspace

### Short-Term (Current)

Continue current approach:
- **Claude Code**: Native WebSocket chat integration (already working)
- **OpenCode/Codex**: Terminal PTY with command passthrough

The sessions tab already shows all agent sessions, and clicking non-Claude sessions opens a terminal with the resume command.

### Medium-Term Improvements

1. **OpenCode Server Integration**
   - Start `opencode serve` automatically in workspaces
   - Create web UI component that connects to OpenCode's API
   - Stream messages via SSE similar to Claude integration

2. **Codex JSONL Parser**
   - Run `codex exec` in non-interactive mode
   - Parse JSONL output
   - Display structured messages in web UI

3. **Unified Chat Interface**
   - Abstract agent-specific protocols behind common interface
   - Show tool calls, outputs consistently across all agents

### Long-Term Vision

All agents accessible through consistent web chat interface:
- Agent selector dropdown
- Unified message rendering
- Cross-agent session history
- Shared tool visualization

---

## Sources

- [OpenCode TUI Documentation](https://opencode.ai/docs/tui/)
- [OpenCode CLI Documentation](https://opencode.ai/docs/cli/)
- [OpenCode Server Documentation](https://opencode.ai/docs/server/)
- [OpenCode GitHub](https://github.com/opencode-ai/opencode)
- [Codex CLI Documentation](https://developers.openai.com/codex/cli/)
- [Codex CLI Features](https://developers.openai.com/codex/cli/features/)
- [Codex GitHub](https://github.com/openai/codex)
- [Codex Remote Runner](https://github.com/EdwardAThomson/Codex-Remote-Runner)
