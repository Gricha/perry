---
name: release
description: Cut a new release - bump version, commit, tag, and push to trigger CI publish
---

# Release Skill

Cut a new Perry release. CI builds and publishes on `v*` tags.

## Prerequisites

- On `main` branch with clean working directory
- All changes committed and pushed
- Validation passing (run `bun run validate:full` if unsure)

## Steps

### 1. Determine version bump

Check current version:
```bash
grep '"version"' package.json
```

Decide bump type:
- **patch** (0.3.13 -> 0.3.14): Bug fixes, minor changes
- **minor** (0.3.13 -> 0.4.0): New features, backward compatible
- **major** (0.3.13 -> 1.0.0): Breaking changes

### 2. Update version in package.json

Edit `package.json` and update the `"version"` field to the new version.

### 3. Commit and push

```bash
git add package.json
git commit -m "Bump version to <x.y.z>"
git push origin main
```

### 4. Create and push tag

```bash
git tag v<x.y.z>
git push origin v<x.y.z>
```

## What happens next

- CI detects the `v*` tag
- Runs full validation
- Builds CLI, worker binary, web UI
- Publishes to npm/registry

## Verification

After CI completes:
```bash
# Check npm for new version
npm view perry version
```

## Rollback (if needed)

If something goes wrong:
```bash
# Delete remote tag
git push origin --delete v<x.y.z>

# Delete local tag
git tag -d v<x.y.z>

# Revert commit if needed
git revert HEAD
git push origin main
```

## Notes

- Never force push to main
- CI handles full validation, but run `validate:full` locally if unsure
- Tag format must be `v<semver>` (e.g., `v0.3.14`, `v1.0.0`)
