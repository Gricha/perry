# Perry: Distributed Development Environment

## Overview

Perry is a distributed development environment orchestrator that creates isolated Docker-in-Docker containers accessible from multiple clients (CLI, Web UI, Mobile). It transforms development workflows by enabling remote workspace management with local-like performance.

## Architecture Status

**Implemented Core Features:**
- ✅ Agent daemon with HTTP/WebSocket API  
- ✅ oRPC type-safe client-server communication
- ✅ CLI client with TUI
- ✅ React web UI with real-time terminal
- ✅ React Native mobile app
- ✅ Session management and tracking
- ✅ Worker binary pattern for container operations
- ✅ State persistence and locking

## Core Principles

1. **Developer Experience**: One command setup, zero friction workspace creation
2. **Network Simplicity**: Works across any network, Tailscale-optimized but not required  
3. **Real Testing**: Integration tests with actual Docker containers
4. **Type Safety**: oRPC provides compile-time API validation

---

## Quick Start

### Agent Setup

```bash
$ perry agent run
# Starts agent on port 7391, creates default config if needed
Agent running at http://hostname:7391
```

### Client Usage

```bash
$ perry list                    # List workspaces
$ perry start myproject         # Create and start workspace  
$ perry shell myproject         # Interactive terminal
$ perry config worker <host>    # Set agent hostname
```

### Web UI

Navigate to `http://agent-host:7391` for browser-based management with integrated terminal.

### Mobile Access

Install Perry mobile app, configure agent hostname for workspace management on the go.

---

## Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Network (Tailscale/Internet)            │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │              Agent Machine                         │    │
│   │                                                    │    │
│   │   ┌────────────────────────────────────────────┐  │    │
│   │   │         perry agent run (daemon)           │  │    │
│   │   │                                            │  │    │
│   │   │  ┌─────────────┐  ┌─────────────────────┐ │  │    │
│   │   │  │  oRPC API   │  │  WebSocket Terminal │ │  │    │
│   │   │  │   :7391     │  │  Session Manager    │ │  │    │
│   │   │  └─────────────┘  └─────────────────────┘ │  │    │
│   │   │                                            │  │    │
│   │   │  ┌─────────────────────────────────────┐  │  │    │
│   │   │  │     Docker Engine                   │  │    │
│   │   │  │  ┌─────────┐ ┌─────────┐            │  │  │    │
│   │   │  │  │workspace│ │workspace│  ...       │  │  │    │
│   │   │  │  │  -alpha │ │  -beta  │            │  │  │    │
│   │   │  │  └─────────┘ └─────────┘            │  │  │    │
│   │   │  └─────────────────────────────────────┘  │  │    │
│   │   │                                            │  │    │
│   │   │  ┌─────────────────────────────────────┐  │  │    │
│   │   │  │  State & Config                     │  │  │    │
│   │   │  │  ~/.config/perry/state.json        │  │  │    │
│   │   │  │  (file-locked, persistent)          │  │  │    │
│   │   │  └─────────────────────────────────────┘  │  │    │
│   │   └────────────────────────────────────────────┘  │    │
│   └───────────────────────────────────────────────────┘    │
│                            ▲                                │
│                            │ HTTP/WebSocket/oRPC            │
│          ┌─────────────────┼─────────────────┐             │
│          │                 │                 │             │
│    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐       │
│    │  Client   │    │  Browser  │    │  Mobile   │       │
│    │perry CLI  │    │  Web UI   │    │   App     │       │
│    │+ TUI      │    │(React SPA)│    │(React NV) │       │
│    └───────────┘    └───────────┘    └───────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Components

#### 1. Agent Daemon (`perry agent run`)

Long-running process managing workspaces and serving clients:
- **oRPC API server** (port 7391, type-safe client/server communication)  
- **WebSocket terminal server** with session management
- **Docker lifecycle management** (create, start, stop, delete workspaces)
- **State persistence** with file locking
- **Web UI hosting** (serves React SPA as static files)

```bash
perry agent run                   # Start agent (foreground)
perry agent install              # Install systemd service
```

#### 2. CLI Client  

Type-safe commands via oRPC:
```bash
perry start myproject             # Create and start workspace
perry stop myproject              # Stop workspace  
perry shell myproject             # Interactive terminal via WebSocket
perry list                        # List all workspaces
perry delete myproject            # Remove workspace and volumes
perry config worker <host>        # Configure agent connection
```

#### 3. Web UI

React SPA with real-time capabilities:
- **Framework**: React + Vite + shadcn/ui  
- **Terminal**: xterm.js with WebSocket connection
- **API**: oRPC client with type safety
- **Features**: Full workspace lifecycle, real-time session tracking

#### 4. Mobile App

React Native + Expo production app:
- **Platform**: iOS and Android
- **Features**: Workspace management, terminal access
- **API**: Same oRPC endpoints as web UI
- **Real-time**: Session updates via WebSocket

---

## Data Models

### Agent Configuration

Location: `~/.config/perry/config.json`

```json
{
  "port": 7391,
  "workspacePrefix": "workspace-",
  "imageTag": "workspace-base"
}
```

### Client Configuration  

Location: `~/.config/perry/client.json`

```json
{
  "worker": "my-desktop.example.com:7391"
}
```

### Workspace State

Location: `~/.config/perry/state.json` (agent machine)

```json
{
  "workspaces": {
    "myproject": {
      "name": "myproject",
      "status": "running",
      "containerId": "abc123def456...", 
      "created": "2025-01-10T15:30:00Z",
      "image": "workspace-base",
      "ports": {
        "ssh": 22001,
        "http": 22080
      }
    }
  }
}
```

State is managed with file locking (`proper-lockfile`) for safe concurrent access.

---

## API Specification

Perry uses [oRPC](https://orpc.unnoq.com/) for type-safe RPC communication. The API provides compile-time type safety between client and server.

### Base URL

`http://<agent-host>:7391/rpc`

### Current oRPC Router

Based on implementation in `src/agent/router.ts`:

```typescript
{
  workspaces: {
    list: () => Workspace[]
    get: ({ name: string }) => Workspace  
    create: ({ name: string }) => Workspace
    delete: ({ name: string }) => { success: boolean }
    start: ({ name: string }) => Workspace
    stop: ({ name: string }) => Workspace
    sync: ({ name: string }) => void
  },
  sessions: {
    list: ({ workspaceName: string }) => SessionInfo[]
    messages: ({ workspaceName: string, sessionId: string }) => Message[]
  },
  agent: {
    info: () => AgentInfo
    kill: () => void
  },
  config: {
    get: () => Config
    setWorker: ({ worker: string }) => Config
  }
}
```

### Core Types

```typescript
interface Workspace {
  name: string
  status: 'running' | 'stopped' | 'creating' | 'error'
  containerId?: string
  created: string
  ports: { ssh: number }
}

interface SessionInfo {
  sessionId: string
  title: string
  agent: string
  messageCount: number
  lastActivity: string
}

interface AgentInfo {
  version: string
  hostname: string
  uptime: number
  workspacesCount: number
}
```

### WebSocket Endpoints

**Terminal Access:**
```
GET /terminal/:workspaceName
Upgrade: WebSocket
```

**Session Streaming:**  
```
GET /sessions/:workspaceName
Upgrade: WebSocket
```

Real-time session updates and terminal I/O via WebSocket with binary message protocol.

---

## Workspace Lifecycle

### Creation Flow

```
perry start myproject

1. Validate workspace name (unique, valid format)
2. Allocate SSH port from available range  
3. Create Docker container:
   - Image: workspace-base (pre-built with development tools)
   - Volumes: Named volume for /home/workspace persistence
   - Network: Custom bridge for container isolation
   - Port mapping: SSH port for external access
4. Start container and wait for SSH availability
5. Copy perry worker binary for container-side operations
6. Update state.json with workspace metadata
7. Return workspace info via oRPC
```

### Storage Strategy

**Named Volumes per Workspace:**
- `workspace-{name}-home`: Persistent /home/workspace directory
- `workspace-{name}-docker`: Docker-in-Docker storage
- Volumes persist across container restarts
- Deleted only when workspace is explicitly removed

**Container Image:**
- Pre-built `workspace-base` with development tools
- Includes: Node.js, Python, Go, Docker-in-Docker setup, SSH server
- Workspace-specific setup via environment variables

---

## Session Management 

Perry provides real-time tracking and management of development tool sessions (Claude, OpenCode, etc.) within workspaces.

### Architecture

**Session Discovery:**
- `perry worker` binary runs inside containers
- Scans for session files/directories (e.g., `/tmp/opencode-sessions/`)
- HTTP server provides session data to agent via internal API

**Agent Aggregation:**  
- Agent polls container session endpoints
- Maintains centralized session index with WebSocket broadcasting
- Clients receive real-time session updates

**Client Integration:**
- Web UI shows live session list with message counts
- Mobile app displays active sessions per workspace  
- CLI provides session inspection commands

### Implementation

- **Container Side**: `src/worker/` - HTTP server with session scanning
- **Agent Side**: `src/session-manager/` - Aggregation and WebSocket broadcasting  
- **Client Side**: Real-time session updates via WebSocket connection

---

## Testing Strategy

Perry's testing approach emphasizes real-world validation over test coverage metrics.

### Test Categories

**Unit Tests** (`test/unit/`):
- Pure functions, config parsing, validation logic
- Fast execution, no external dependencies

**Integration Tests** (`test/integration/`):  
- Agent + Docker interaction
- oRPC API functionality
- Workspace lifecycle operations
- Requires Docker daemon

**E2E Tests** (`test/e2e/`, `web/e2e/`):
- Full system workflows: CLI → Agent → Docker
- Web UI interactions (Playwright)
- Real network communication

### Validation Command

```bash
bun run validate    # Complete test suite + linting + builds
```

**Components:**
- `bun run check` - Linting and type checking  
- `bun run build` - CLI, worker binary, and web UI builds
- `bun run test` - Unit and integration tests
- `bun run test:web` - Playwright e2e web tests

### Philosophy

Tests must catch real bugs, not satisfy coverage metrics. Manual verification remains essential for validating user experience and complex integration scenarios.

---

## Container Architecture

Perry uses a pre-built Docker image (`workspace-base`) with development tools and Docker-in-Docker capability.

### Base Image Features

**Pre-installed Tools:**
- Node.js, Bun, Go, Python development environments
- Docker-in-Docker for nested container workflows  
- SSH server for terminal access
- Development tools (git, curl, etc.)

**Container Setup:**
- User: `workspace` with sudo privileges
- Persistent volumes for /home/workspace 
- SSH port allocation for external access
- Internal Docker daemon for development workflows

### Worker Binary Pattern

The `perry worker` binary enables container-side operations:

**Build Process:**
```bash
bun build src/index.ts --compile --outfile dist/perry-worker --target=bun
```

**Deployment:**
- Binary copied to containers during `perry sync`
- Enables session discovery and container management
- Self-contained, no npm dependencies in container

**Usage:**
```bash
# Inside container
perry worker sessions list      # Discover active tool sessions
perry worker sessions messages  # Get session message history
```

This pattern allows rapid updates without rebuilding Docker images.

---

## Future Enhancements

### Multi-Agent Support
- Connect to multiple perry agents from single client
- Workspace distribution across machines  
- Load balancing and failover capabilities

### Enhanced Session Management
- Session persistence across workspace restarts
- Session sharing and collaboration features
- Advanced filtering and search capabilities

### DevContainer Integration
- Support for `.devcontainer.json` configuration
- VS Code DevContainer feature compatibility
- Custom container images per workspace

### Network Optimizations
- Terminal latency improvements (local echo, compression)
- Session data compression and caching
- Offline capability for cached data

### Authentication & Security
- Optional bearer token authentication
- Integration with Tailscale ACLs
- Role-based workspace access control

---

## Project Structure

```
perry/
├── src/
│   ├── agent/              # oRPC server and HTTP endpoints
│   ├── workspace/          # Docker container lifecycle management  
│   ├── session-manager/    # Real-time session tracking
│   ├── worker/             # Container-side HTTP server
│   ├── terminal/           # WebSocket terminal implementation
│   ├── docker/             # Docker CLI interface
│   ├── client/             # oRPC client utilities
│   └── index.ts            # Main CLI entry point
├── web/                    # React SPA served by agent
│   ├── src/components/     # shadcn/ui component library
│   ├── src/lib/           # oRPC client configuration
│   └── dist/              # Built assets served statically
├── mobile/                 # React Native + Expo app
│   └── src/               # Mobile UI components and navigation
├── test/
│   ├── unit/              # Pure function tests
│   ├── integration/       # Agent + Docker tests  
│   └── e2e/               # Full system tests
├── DESIGN.md              # Architecture documentation
└── AGENTS.md              # Implementation guidelines
```
