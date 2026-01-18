---
sidebar_position: 1
---

# Workspaces

Workspaces are isolated Docker-in-Docker containers with their own persistent volumes. You can create, start, stop, clone, and delete them from any client connected to your agent.

## Create or start

```bash
perry start myproject
```

Clone a repo on first creation:

```bash
perry start myproject --clone git@github.com:user/repo.git
```

## Stop

```bash
perry stop myproject
```

## Delete

```bash
perry delete myproject
```

## List and inspect

```bash
perry list
perry info myproject
```

## Logs

```bash
perry logs myproject
```

## Clone

```bash
perry clone myproject myproject-experiment
```

Cloning copies the home volume and Docker-in-Docker volume, then starts a new container with a new SSH port.

## Workspace images

Perry uses a prebuilt workspace image from `ghcr.io/gricha/perry:<version>` by default. If a local image tagged `perry:latest` exists, the agent will use that instead.

The default image is ready to go but heavier. A smaller base image is available for custom builds (`perry-base:latest`), and you can also install tools at startup with scripts.

### Customize with a Docker image

Build the full image locally (same as the prebuilt one):

```bash
perry build
```

Build the base image:

```bash
docker build -t perry-base:latest -f perry/Dockerfile.base perry
```

Extend it with your own Dockerfile:

```Dockerfile
FROM perry-base:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
  my-tool \
  && rm -rf /var/lib/apt/lists/*
```

Then build and tag as `perry:latest` so Perry will pick it up:

```bash
docker build -t perry:latest -f ./Dockerfile .
```

To apply a new image to an existing workspace, delete and recreate it:

```bash
perry delete myproject
perry start myproject
```

### Customize with scripts

If you want to keep the default image but add project-specific tools or config, use post-start scripts. They run as the `workspace` user after each start.

See [Configuration: Scripts](./configuration/scripts.md).

## Notes

- Workspace names must be unique and use lowercase letters, numbers, and dashes.
- Ports are assigned automatically; see [Networking](./networking.md) for access.
