---
name: update-changelog
description: >-
  Update CHANGELOG.md files for frontend and backend based on git history since
  the last documented version. Use when the user says "update changelog",
  "changelog", "/changelog", or asks to document recent changes.
disable-model-invocation: true
---

# Update Changelog

Update `backend/CHANGELOG.md` and `frontend/CHANGELOG.md` with commits since the last documented version.

## Format

Follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [VERSION] - YYYY-MM-DD

### Added
### Changed
### Fixed
### Removed
```

## Workflow

1. Read the current `backend/CHANGELOG.md` and `frontend/CHANGELOG.md` to find the latest documented version.
2. Get commits since that version for each area:
   ```bash
   git log --oneline --no-merges <last-version-commit>..HEAD -- backend/
   git log --oneline --no-merges <last-version-commit>..HEAD -- frontend/
   ```
3. If there's no tag, find the commit that bumped to the last documented version:
   ```bash
   git log --oneline --all --grep="<version>" -- <area>/package.json
   ```
4. Group commits by type using conventional commit prefixes:
   - `feat` → **Added**
   - `fix` → **Fixed**
   - `refactor`, `perf`, `style` → **Changed**
   - Commits removing functionality → **Removed**
   - Skip `chore`, `docs`, `test`, `ci`, `build` unless they have user-facing impact
5. Write concise, human-readable bullet points (not raw commit messages).
6. Read the current version from each `package.json` and use it as the section header.
7. Use today's date.
8. Insert the new section at the top (below the `# Changelog` heading).

## Rules

- Only add a section for an area if there are relevant commits.
- Do NOT remove or rewrite existing changelog entries.
- Do NOT include the version bump commit itself.
- Deduplicate: if the same feature spans multiple commits, summarize as one bullet.
- Keep bullets concise — one line each, no sub-bullets.
