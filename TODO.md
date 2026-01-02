# Workspace Implementation Tasks

> **Important**: Remove tasks from this list when completed. Do not add new tasks without discussing with the project owner first - add them to "Considerations" section instead.

## Priority: Remote Access

- [ ] Remote shell (`ws shell <name>`) - connect to workspace terminal from client machine
- [ ] Port forwarding/proxy - forward workspace ports to client machine

## Phase 5: TUI

- [ ] Set up OpenTUI
- [ ] Workspace list view
- [ ] Create workspace form (name, optional repo)
- [ ] Workspace actions (start/stop/delete)
- [ ] Integrated terminal view
- [ ] Settings/config view (add credentials)

## Phase 6: Web UI

- [ ] Set up React + react-router + shadcn/ui project in `web/`
- [ ] Workspace list page
- [ ] Workspace detail page
- [ ] Create workspace form
- [ ] xterm.js terminal integration
- [ ] Settings page (credentials management)
- [ ] Build pipeline (bundle into agent)
- [ ] Agent serves static files from `web/dist/`

## Phase 7: Polish (Future)

- [ ] Comprehensive error messages with actionable fixes
- [ ] User documentation
- [ ] Docker image publishing to registry
- [ ] `ws agent logs` command for debugging

---

## Research Tasks

- [ ] Research Codex CLI authentication method and portability
- [ ] Research GitHub Copilot token portability (lower priority)

---

## Considerations

> Add items here to discuss with project owner before promoting to tasks.

- Change oxlint warnings to errors (currently 9 warnings in pre-existing code: unused imports, unused variables, empty catch blocks)
