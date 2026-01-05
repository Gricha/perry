---
sidebar_position: 3
---

# Getting Started

## Start Agent

```bash
workspace agent run
```

Web UI: `http://localhost:7391`

Options:
```bash
workspace agent run --port 3000       # Custom port
workspace agent run --no-host-access  # Disable direct host machine access
```

## Host Access

By default, the agent enables direct access to your host machine. This allows running terminals and AI coding agents directly on your machine without Docker isolation.

To disable host access (workspaces-only mode):
```bash
workspace agent run --no-host-access
```

Or via environment variable:
```bash
WS_NO_HOST_ACCESS=true workspace agent run
```

For systemd service installation:
```bash
workspace agent install --no-host-access
```

## Create Workspace

CLI:
```bash
workspace create myproject
workspace create myproject --clone git@github.com:user/repo.git
```

Web UI:
1. Open `http://localhost:7391`
2. Click "+"
3. Enter name
4. Create

## Access

SSH:
```bash
workspace list  # Find port
ssh -p 2201 workspace@localhost
```

Web Terminal: Click workspace → Terminal

## Commands

```bash
workspace list              # List all
workspace start <name>      # Start
workspace stop <name>       # Stop
workspace delete <name>     # Delete
workspace logs <name>       # Logs
```
