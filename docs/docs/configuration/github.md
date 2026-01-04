---
sidebar_position: 4
---

# GitHub

Configure GitHub access for your workspaces using either Personal Access Tokens or SSH keys.

## Personal Access Tokens (PAT)

Add your GitHub PAT as an environment variable:

```yaml
credentials:
  env:
    GITHUB_TOKEN: "ghp_..."
```

Or Web UI → Settings → Environment.

**Required permissions:**
- Contents: Read and write

**Recommended permissions:**
- Pull requests: Read and write

## SSH Keys

Sync your SSH key from the host machine:

```yaml
credentials:
  files:
    ~/.ssh/id_ed25519: ~/.ssh/id_ed25519
    ~/.ssh/id_ed25519.pub: ~/.ssh/id_ed25519.pub
```

Or Web UI → Settings → Files.

If using SSH, also sync your Git config:

```yaml
credentials:
  files:
    ~/.gitconfig: ~/.gitconfig
```
