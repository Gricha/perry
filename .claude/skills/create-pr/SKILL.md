---
name: create-pr
description: Create a pull request with a concise, useful description
---

# Create PR Skill

Create pull requests with concise, useful descriptions.

## Philosophy

- **Be brief**: No walls of text. Reviewers skim.
- **Be specific**: What changed and why, not how (code shows how).
- **No fluff**: Skip test plans, checklists, and boilerplate sections.

## PR Title

Use format: `<type>: <short description>`

Types: `fix`, `feat`, `refactor`, `docs`, `chore`, `test`

Examples:
- `fix: handle null user in session lookup`
- `feat: add workspace pause/resume`
- `refactor: extract terminal manager from agent`

## PR Description

Keep it short. 2-5 bullet points max.

```markdown
## Summary

- <what changed>
- <why it changed>
- <any notable decisions or tradeoffs>
```

That's it. No "Test Plan", no "Screenshots", no checklists unless truly needed.

## Steps

1. Check current state:
   ```bash
   git diff --name-only main...HEAD
   git log --oneline main...HEAD
   ```

2. Create PR:
   ```bash
   gh pr create --title "<type>: <description>" --body "$(cat <<'EOF'
   ## Summary
   
   - <what>
   - <why>
   EOF
   )"
   ```

## When to Add More

Only add extra sections if genuinely useful:

- **Breaking changes**: If API/behavior changes affect users
- **Migration**: If users need to do something
- **Screenshots**: Only for UI changes, and only if they help

## Anti-patterns

- Long descriptions nobody reads
- Copy-pasting commit messages as bullets
- "This PR does X" (we know, it's a PR)
- Test plan sections (CI runs tests)
- Checklists (use CI for enforcement)
