# Perry

[![Tests](https://github.com/gricha/perry/actions/workflows/test.yml/badge.svg)](https://github.com/gricha/perry/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/@gricha%2Fperry.svg)](https://www.npmjs.com/package/@gricha/perry)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Isolated, self-hosted workspaces accessible over Tailscale. AI coding agents, web UI, and remote terminal access.

## Features

- **AI Coding Agents** - Claude Code, OpenCode, GitHub Copilot pre-installed
- **Self-Hosted** - Run on your own hardware, full control
- **Remote Access** - Use from anywhere via Tailscale, CLI, web, or SSH
- **Web UI** - Manage workspaces from your browser
- **Isolated Environments** - Each workspace runs in its own container

## Setup

### Install

```bash
npm install -g @gricha/perry
```

### Build Base Image

```bash
perry build
```

### Start Agent

```bash
perry agent run
```

Web UI: **http://localhost:7391**

The agent runs on port 7391 by default. For remote access, install as a service:

```bash
perry agent install
systemctl --user start perry-agent
```

### Create & Use Workspaces

**Via CLI:**

```bash
# Create workspace
perry create myproject

# Or clone a repo
perry create myproject --clone git@github.com:user/repo.git

# SSH into workspace
perry list  # Find SSH port
ssh -p 2201 workspace@localhost

# Manage workspaces
perry start myproject
perry stop myproject
perry delete myproject
```

**Via Web UI:**

Open http://localhost:7391 and click "+" to create a workspace.

## Security

Perry is designed for use within **secure networks** like [Tailscale](https://tailscale.com). The web UI and API have no authentication, making them ideal for private networks where you can safely access workspaces remotely without additional security concerns.

For public internet exposure, place behind a reverse proxy with authentication.

## Configuration

Configure credentials and environment variables via Web UI → Settings or edit `~/.config/perry/config.json`:

```json
{
  "credentials": {
    "env": {
      "ANTHROPIC_API_KEY": "sk-ant-...",
      "OPENAI_API_KEY": "sk-...",
      "GITHUB_TOKEN": "ghp_..."
    },
    "files": {
      "~/.ssh/id_ed25519": "~/.ssh/id_ed25519",
      "~/.gitconfig": "~/.gitconfig"
    }
  }
}
```

Restart workspaces to apply changes.

## What's Inside Each Workspace

- Ubuntu 24.04 LTS
- Node.js 22, Python 3, Go
- Docker (for containerized development)
- Neovim + LazyVim
- Git, GitHub CLI, ripgrep, fd-find, jq
- Claude Code, OpenCode, Codex CLI

## Commands

```bash
# Agent
perry agent run [--port PORT]
perry agent install
perry agent uninstall
perry agent status

# Workspaces
perry create <name> [--clone URL]
perry start <name>
perry stop <name>
perry delete <name>
perry list
perry logs <name>

# Build
perry build [--no-cache]
```

## Development

```bash
git clone https://github.com/gricha/perry.git
cd perry
bun install
bun run build
```

Run tests:

```bash
bun run validate  # Lint, typecheck, build, test
bun run test      # Tests only
```

## License

MIT
