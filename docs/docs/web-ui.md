---
sidebar_position: 6
---

# Remote Access

Perry gives you access to your workspaces from anywhere via CLI, web UI, or SSH.

## CLI

The CLI is the fastest way to work with Perry workspaces from any machine.

### Setup

Install Perry on your client machine and point it to your agent:

```bash
perry config agent <hostname>
```

Replace `<hostname>` with your Tailscale hostname or IP (e.g., `myserver` or `myserver.tail1234.ts.net`).

### Usage

```bash
# Create workspace and clone a repo
perry start my-proj --clone git@github.com:user/repo.git

# Shell into the workspace
perry shell my-proj

# Or attach an AI coding agent directly
opencode attach http://my-proj:4096
```

See [CLI Reference](./cli.md) for all available commands.

## Web UI

The web UI is served directly by the Perry agent.

### Accessing

**Locally:**
```
http://localhost:7391
```

**Remotely via Tailscale:**
```
http://<hostname>:7391
```

With [Tailscale Serve](https://tailscale.com/kb/1312/serve) configured, Perry automatically advertises itself over HTTPS at your Tailscale hostname.

### Capabilities

- **Manage workspaces** - Create, start, stop, and delete workspaces
- **Web terminal** - Full terminal access to any workspace
- **AI sessions** - View and resume Claude Code, OpenCode, and Codex sessions
- **Port forwarding** - Configure ports for each workspace (used by `perry proxy`)
- **Settings** - Configure environment variables, SSH keys, file sync, and agent credentials

### Host Access

By default, Perry also provides direct access to your host machine (not just containers). This lets you run terminals and AI agents on host projects without Docker isolation.

Disable with `perry agent run --no-host-access` if you only want container access.

## SSH Access

Every workspace is reachable directly on your tailnet using its Tailscale hostname.

```bash
ssh ubuntu@<workspace-name>
```

If you prefer local tooling, you can also use `perry shell` to hop into a workspace from any client machine on your tailnet.
