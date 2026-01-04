# Research: Claude Code Authentication in Interactive Mode

**Date:** 2026-01-04
**Researcher:** Claude Sonnet 4.5
**Question:** Can we start Claude Code in interactive mode by relying solely on `CLAUDE_CODE_OAUTH_TOKEN`, or do we need additional "hacks"?

## Executive Summary

**Answer:** No, `CLAUDE_CODE_OAUTH_TOKEN` alone is **NOT sufficient** for interactive mode. You need both:
1. `CLAUDE_CODE_OAUTH_TOKEN` environment variable set
2. `~/.claude.json` with `{"hasCompletedOnboarding": true}`

This is **not officially documented** but is a known limitation confirmed by multiple sources including official GitHub issues.

---

## Current Implementation in This Repository

### What We Do Now

File: `src/workspace/manager.ts:148-204`

```typescript
private async setupClaudeCodeConfig(containerName: string): Promise<void> {
  // Try to copy host's ~/.claude.json
  try {
    await fs.access(localClaudeConfig);
    await copyCredentialToContainer({
      source: '~/.claude.json',
      dest: '/home/workspace/.claude.json',
      containerName,
      filePermissions: '644',
      tempPrefix: 'ws-claude-config',
    });
  } catch {
    // If it doesn't exist, create minimal config with onboarding flag
    const oauthToken = this.config.agents?.claude_code?.oauth_token;
    if (oauthToken) {
      const configContent = JSON.stringify({ hasCompletedOnboarding: true });
      // ... write to container
    }
  }

  // Try to copy host's ~/.claude/.credentials.json
  try {
    await fs.access(localClaudeCredentials);
    await copyCredentialToContainer({
      source: '~/.claude/.credentials.json',
      dest: '/home/workspace/.claude/.credentials.json',
      // ...
    });
  } catch {
    // Comment at line 202: "No credentials file - that's OK, user may use oauth_token env var instead"
  }
}
```

### Our Current Approach

1. **Set `CLAUDE_CODE_OAUTH_TOKEN` environment variable** in container (line 330)
2. **Copy `~/.claude.json` from host** if it exists, OR create minimal one with `hasCompletedOnboarding: true`
3. **Copy `~/.claude/.credentials.json` from host** if it exists (optional - falls back to env var)

**This is the correct approach** based on current Claude Code limitations.

---

## Official Claude Code Documentation

### Documented Authentication Methods

According to [official docs](https://code.claude.com/docs/en/settings.md), the supported authentication methods are:

1. **`ANTHROPIC_API_KEY`** - API key authentication (documented)
2. **`ANTHROPIC_AUTH_TOKEN`** - Custom bearer token (documented)
3. **`apiKeyHelper`** - Script-based dynamic credentials (documented)
4. **Interactive OAuth flow** - Default for interactive mode (documented)

### What's NOT Documented

**`CLAUDE_CODE_OAUTH_TOKEN` is NOT mentioned in official documentation.**

However, it appears in:
- Official GitHub Issues ([#8938](https://github.com/anthropics/claude-code/issues/8938), [#7855](https://github.com/anthropics/claude-code/issues/7855))
- Official GitHub Action setup docs ([setup.md](https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md))
- Official support article ([Managing API Key Environment Variables](https://support.claude.com/en/articles/12304248-managing-api-key-environment-variables-in-claude-code))

**Conclusion:** `CLAUDE_CODE_OAUTH_TOKEN` is a semi-official environment variable that exists in the code but is poorly documented.

---

## The "Hack" Requirement: `hasCompletedOnboarding`

### The Problem

From [GitHub Issue #8938](https://github.com/anthropics/claude-code/issues/8938):

> When a user runs `claude setup-token` to generate an OAuth token and exports it as `CLAUDE_CODE_OAUTH_TOKEN`, Claude Code still prompts for authentication setup on a fresh installation instead of using the provided token.

**Steps to Reproduce:**
1. Run `claude setup-token`
2. Export `CLAUDE_CODE_OAUTH_TOKEN=<token>`
3. Delete `.claude*` directories
4. Run `claude`
5. **Result:** Claude asks for theme and authentication despite having the token

### The Workaround

You must create `~/.claude.json` with:

```json
{
  "hasCompletedOnboarding": true
}
```

**Why?** Claude Code checks for onboarding completion before using the environment variable. This is confirmed by:
- User @chunlea in Issue #8938: "CLAUDE_CODE_OAUTH_TOKEN works in interactive mode when hasCompletedOnboarding: true is set"
- Multiple open-source projects implementing this workaround

### Is This a Hack?

**Yes and No:**

**Yes, it's a hack because:**
- Not documented officially
- Unintuitive - why does an auth token require an onboarding flag?
- Community consensus is this should "just work" without manual config

**No, it's not a hack because:**
- It's the only way to make it work currently
- Multiple official Anthropic team members are aware (issues are not closed as "won't fix")
- It's used consistently across community projects

---

## Analysis of Other Open Source Projects

### 1. [tintinweb/claude-code-container](https://github.com/tintinweb/claude-code-container)

**Approach:**
- Sets `CLAUDE_CODE_OAUTH_TOKEN` environment variable
- No mention of `~/.claude.json` creation

**Assessment:** Likely incomplete - may not work for interactive mode without the onboarding flag.

### 2. [cabinlab/claude-code-sdk-docker](https://github.com/cabinlab/claude-code-sdk-docker)

**Approach:**
- Uses `CLAUDE_CODE_OAUTH_TOKEN` for OAuth tokens
- Uses `.env` file for configuration
- Notes that interactive OAuth is "clunky inside a container"

**Assessment:** Production-focused but doesn't document the onboarding flag requirement.

### 3. [RchGrav/claudebox](https://github.com/RchGrav/claudebox)

**Approach:**
- Mounts `~/.claude/` as persistent storage per project
- Uses `ANTHROPIC_API_KEY` (not OAuth token)
- Project-specific auth state isolation

**Assessment:** Avoids the problem by using API keys instead of OAuth tokens.

### 4. [claude-did-this.com Container Guide](https://claude-did-this.com/claude-hub/getting-started/setup-container-guide)

**Approach:**
- **Explicitly documents the full `~/.claude` directory copy approach**
- Recommends copying entire directory structure including:
  - `.credentials.json` (OAuth tokens)
  - `settings.local.json`
  - `projects/`, `todos/`, `statsig/`
- Notes that tokens expire (8-12 hours for access tokens)

**Assessment:** Most comprehensive guide found. Suggests copying the entire directory is safer than minimal config.

---

## Known Issues and Bugs

### Issue 1: Environment Variables Break Local Interactive Mode

**[GitHub Issue #7855](https://github.com/anthropics/claude-code/issues/7855)**

**Problem:** Setting `ANTHROPIC_AUTH_TOKEN` or `CLAUDE_CODE_OAUTH_TOKEN` as environment variables causes local interactive mode to fail.

**Steps to Reproduce:**
```bash
export CLAUDE_CODE_OAUTH_TOKEN="any_value"
claude  # Fails with auth error

unset CLAUDE_CODE_OAUTH_TOKEN
claude  # Works fine
```

**Impact:** These environment variables are designed for containers/CI but interfere with local development.

**Workaround:** Unset these variables for local use.

### Issue 2: GitHub Action Clears CLAUDE_CODE_OAUTH_TOKEN

**[GitHub Issue #676](https://github.com/anthropics/claude-code-action/issues/676)**

**Problem:** `claude-code-action@v1` clears the `CLAUDE_CODE_OAUTH_TOKEN` environment variable after the prepare phase.

**Status:** Open (P1 showstopper)

**Impact:** OAuth token authentication is unreliable in GitHub Actions.

### Issue 3: setup-token Not Sufficient

**[GitHub Issue #8938](https://github.com/anthropics/claude-code/issues/8938)**

**Problem:** Running `claude setup-token` and setting `CLAUDE_CODE_OAUTH_TOKEN` is not enough - still prompts for authentication.

**Status:** Open

**Root Cause:** Missing `hasCompletedOnboarding: true` flag in `~/.claude.json`.

---

## Recommendations

### For This Repository

**Current implementation is correct.** Keep doing what we're doing:

1. ✅ Set `CLAUDE_CODE_OAUTH_TOKEN` environment variable
2. ✅ Create `~/.claude.json` with `hasCompletedOnboarding: true` if not present
3. ✅ Optionally copy `~/.claude/.credentials.json` from host (fallback to env var)

### Potential Improvements

#### Option A: Minimal Approach (Current)
```typescript
// src/workspace/manager.ts (lines 162-184)
const configContent = JSON.stringify({ hasCompletedOnboarding: true });
```

**Pros:**
- Simple
- Works for OAuth token authentication
- Minimal file I/O

**Cons:**
- Doesn't preserve user preferences (theme, settings)
- Can't use credential files if they exist on host

#### Option B: Enhanced Config (Recommended)
```typescript
const configContent = JSON.stringify({
  hasCompletedOnboarding: true,
  theme: "dark",  // Or read from user's local config if available
  permissions: {
    // Pre-approve common permissions for container use
  }
});
```

**Pros:**
- Better user experience (no theme prompt)
- Could pre-configure permissions for non-interactive workflows

**Cons:**
- More opinionated
- May override user preferences if they mount their own config later

#### Option C: Environment Variable Detection
```typescript
// If CLAUDE_CODE_OAUTH_TOKEN is set, automatically skip onboarding
// This is what the community wants Claude Code to do natively
```

**Status:** Not possible - we can't modify Claude Code's behavior. This must be done by Anthropic.

### Testing Protocol

To verify our implementation works:

```bash
# 1. In a workspace container
docker exec -it workspace-test bash

# 2. Verify environment variable is set
echo $CLAUDE_CODE_OAUTH_TOKEN

# 3. Verify config file exists
cat ~/.claude.json
# Should show: {"hasCompletedOnboarding":true}

# 4. Test interactive mode
claude
# Should NOT prompt for authentication
# Should work immediately

# 5. Test a simple command
echo "console.log('hello')" | claude -p "explain this code"
```

### Documentation Updates

Our current docs in `docs/docs/configuration/ai-agents.md` are correct but minimal. Consider adding:

```markdown
## Claude Code Authentication Details

Claude Code requires two components for container authentication:

1. **OAuth Token**: Set via Web UI → Settings → Agents → Claude Code
   - This is injected as `CLAUDE_CODE_OAUTH_TOKEN` environment variable

2. **Onboarding Flag**: Automatically created as `~/.claude.json`
   - Contains `{"hasCompletedOnboarding": true}`
   - Required to bypass interactive setup prompts

**Note:** This configuration is automatically handled when you add your token in Settings.
```

---

## Conclusion

### Summary of Findings

1. **`CLAUDE_CODE_OAUTH_TOKEN` alone is NOT sufficient** for interactive mode
2. **The `hasCompletedOnboarding` flag is required** - this is a documented limitation in GitHub issues but not in official docs
3. **Our current implementation is correct** and follows community best practices
4. **No "cleaner" solution exists** without changes to Claude Code itself
5. **Other projects either:**
   - Use the same approach (onboarding flag)
   - Use API keys instead of OAuth tokens
   - Copy the entire `~/.claude` directory

### Is This a Hack?

**Technically no** - it's a workaround for an acknowledged limitation. The term "hack" implies we're doing something unsupported or fragile. What we're doing is:

- Using a semi-official environment variable (`CLAUDE_CODE_OAUTH_TOKEN`)
- Creating a configuration file (`~/.claude.json`) that Claude Code expects
- Following the pattern used by multiple community projects
- Implementing a workaround that Anthropic team members are aware of (via GitHub issues)

**It's more accurate to call this a "required configuration workaround."**

### Future Outlook

The ideal scenario would be for Anthropic to:
1. Officially document `CLAUDE_CODE_OAUTH_TOKEN` in the main docs
2. Make Claude Code automatically set `hasCompletedOnboarding: true` when the env var is present
3. Improve the DX for containerized/CI environments

Until then, our current implementation is the standard approach.

---

## References

### Official Sources
- [Claude Code Settings Documentation](https://code.claude.com/docs/en/settings.md)
- [Claude Code IAM Documentation](https://code.claude.com/docs/en/iam.md)
- [GitHub Issue #8938 - setup-token not enough](https://github.com/anthropics/claude-code/issues/8938)
- [GitHub Issue #7855 - Env vars interfere with local mode](https://github.com/anthropics/claude-code/issues/7855)
- [GitHub Issue #676 - Action clears token](https://github.com/anthropics/claude-code-action/issues/676)
- [Claude Code Action Setup Docs](https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md)

### Community Resources
- [Docker Official Docs - Configure Claude Code](https://docs.docker.com/ai/sandboxes/claude-code/)
- [Claude Did This - Container Authentication Guide](https://claude-did-this.com/claude-hub/getting-started/setup-container-guide)
- [tintinweb/claude-code-container](https://github.com/tintinweb/claude-code-container)
- [cabinlab/claude-code-sdk-docker](https://github.com/cabinlab/claude-code-sdk-docker)
- [RchGrav/claudebox](https://github.com/RchGrav/claudebox)

### Web Search Results
- [Managing API Key Environment Variables in Claude Code](https://support.claude.com/en/articles/12304248-managing-api-key-environment-variables-in-claude-code)
- [Multiple blog posts and guides confirming the onboarding flag requirement]

---

## Appendix: Code Snippets

### Minimal Working Configuration

```bash
# In container startup script
export CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..."

# Create config file
cat > ~/.claude.json << 'EOF'
{"hasCompletedOnboarding":true}
EOF

# Claude should now work in interactive mode
claude
```

### Full Configuration (If Copying from Host)

```bash
# Copy entire .claude directory
cp -r ~/.claude /container/home/workspace/

# Or copy individual files
cp ~/.claude.json /container/home/workspace/
cp ~/.claude/.credentials.json /container/home/workspace/.claude/

# Set permissions
chmod 644 /container/home/workspace/.claude.json
chmod 600 /container/home/workspace/.claude/.credentials.json
chown workspace:workspace /container/home/workspace/.claude*
```

### Using jq for Dynamic Generation

```bash
# Install jq if not available
apt-get install -y jq

# Generate config with onboarding flag
jq -n '{hasCompletedOnboarding: true}' > ~/.claude.json
```
