---
sidebar_position: 1
---

# Introduction

Perry is a lightweight orchestration layer for development environments with built-in support for AI coding agents.

## What is Perry?

Perry is a self-hosted daemon that:

- **Spawns sandboxed containers** for isolated development workspaces
- **Runs AI coding agents** (Claude Code, OpenCode, Codex) against your workspaces—or directly on the host
- **Provides remote access** via CLI, web UI, or SSH over Tailscale

Think of it as your personal development environment manager that you can access from anywhere.

## Access From Anywhere

Perry is designed for remote access. Once your agent is running, you can connect from any device on your Tailscale network.

**CLI** — The fastest way to access workspaces:
```bash
# Create and clone a repo
perry start my-proj --clone git@github.com:user/repo.git

# Shell into the workspace
perry shell my-proj

# Or attach an AI coding agent directly
opencode attach http://my-proj:4096
```

**Web UI** — Full workspace management at `http://<hostname>:7391`

**SSH** — Connect directly to registered workspaces on your tailnet

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Devices                           │
│   Browser (Web UI)  •  CLI  •  SSH                          │
└─────────────────────────┬───────────────────────────────────┘
                          │ Tailscale / Local
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Perry Agent                             │
│   API Server  •  Container Management  •  Session Tracking │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │Workspace │    │Workspace │    │  Host    │
    │Container │    │Container │    │ Machine  │
    └──────────┘    └──────────┘    └──────────┘
```

## Key Features

- **Self-hosted** — runs on your hardware, your data stays with you
- **Container isolation** — each workspace is sandboxed with Docker-in-Docker support
- **Remote access** — work from any device via Tailscale
- **AI-ready** — coding agents pre-installed and configured
- **Credential sync** — SSH keys, API tokens, and configs automatically available in workspaces

## Next Steps

1. [Install Perry](./installation.md)
2. [Create your first workspace](./getting-started.md)
3. [Configure credentials and agents](./configuration/overview.md)
