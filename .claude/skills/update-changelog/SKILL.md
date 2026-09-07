---
name: update-changelog
description: >-
  Update CHANGELOG.md files based on git history since the last documented
  version. Works with any repo layout by auto-detecting changelog areas (root,
  monorepo packages, or app folders). Use when the user says "update changelog",
  "changelog", "/changelog", or asks to document recent changes.
disable-model-invocation: true
---

# Update Changelog

Update every `CHANGELOG.md` in the repo with the commits that happened since its last documented version. This skill does not assume any fixed folder layout — it discovers the changelog areas automatically.

## Step 1: Discover changelog areas

An "area" is a directory that owns a `CHANGELOG.md`. Find them:

```bash
# All changelog files, excluding dependencies and build output
git ls-files '**/CHANGELOG.md' 'CHANGELOG.md' | grep -v node_modules
```

For each `CHANGELOG.md` found, its **area path** is the directory that contains it (use the repo root `.` for a top-level `CHANGELOG.md`).

If the repo has no `CHANGELOG.md` at all, ask the user where changelogs should live (or create a single root `CHANGELOG.md`) before continuing.

## Step 2: Find the version source for each area

For each area, look for a version/manifest file in this order and use the first that exists:

1. `<area>/package.json` (`version` field)
2. `<area>/pyproject.toml`, `<area>/Cargo.toml`, `<area>/*.csproj`, `<area>/composer.json`, or another manifest with a version
3. No manifest → use **date-based** sections instead of version numbers

Read the version at sync time — never trust a value cached elsewhere.

## Step 3: Find the last documented point

For each area:

1. Read the existing `CHANGELOG.md` and note the latest documented version (or date).
2. Find the commit to diff from, in this order:
   - A matching git tag (e.g. `v1.2.0`, `1.2.0`, or `<area>-1.2.0`).
   - Otherwise, the commit that bumped the manifest to that version:
     ```bash
     git log --oneline --all -S"<version>" -- <area>/<manifest>
     ```
   - Otherwise, fall back to the date of the latest changelog entry, or the full history if the changelog is empty.

## Step 4: Collect commits per area

Scope commits to each area path so unrelated changes are excluded:

```bash
git log --oneline --no-merges <last-point>..HEAD -- <area>/
```

For a root-level area, scope to the whole repo but exclude the other areas' paths so changes are not counted twice.

## Step 5: Group commits by type

Map conventional-commit prefixes to Keep a Changelog sections:

- `feat` → **Added**
- `fix` → **Fixed**
- `refactor`, `perf`, `style` → **Changed**
- Commits that remove functionality → **Removed**
- Commits that deprecate something (or `feat!` / `BREAKING CHANGE`) → **Deprecated** or **Changed** with a clear breaking-change note
- Skip `chore`, `docs`, `test`, `ci`, `build` unless they have user-facing impact

If commits do not follow conventional prefixes, classify them by reading the change (diff, file names, message) instead of the prefix.

## Step 6: Write the entries

Follow [Keep a Changelog](https://keepachangelog.com/) format.

Versioned areas:

```markdown
## [VERSION] - YYYY-MM-DD

### Added

### Changed

### Fixed

### Removed
```

Areas without a manifest version (apps, demos):

```markdown
## YYYY-MM-DD

### Changed
```

Rules:

- Write concise, human-readable bullets — one line each, no sub-bullets. Do not paste raw commit messages.
- Only add a section for an area if it has relevant commits.
- Only include sections (Added/Changed/…) that have entries.
- Use today's date, or the release date if known.
- Insert the new section at the top, directly below the `# Changelog` heading.
- Deduplicate: summarize a feature that spans multiple commits as one bullet.
- Do NOT remove or rewrite existing entries.
- Do NOT include the version-bump commit itself.

## Output to user

After updating, briefly list:

- Which `CHANGELOG.md` files were updated (by area).
- The version or date used for each new section.
- Areas skipped because they had no relevant commits.
