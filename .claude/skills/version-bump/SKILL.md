---
description: Bump the npm package version. Analyzes commits since last release to recommend patch/minor/major, asks for confirmation, writes CHANGELOG, bumps version, commits, and tags. Does not push.
allowed-tools: Read Edit Bash
---

Perform a version bump for this npm package:

1. Run `git tag --sort=-version:refname` and take the top result as the latest version tag.
2. Run `git log <latest-tag>..HEAD --oneline` to get all commits since the last release.
3. Analyze the commits and recommend a bump type:
   - **major** — breaking changes (BREAKING CHANGE, `!` suffix on conventional commit type)
   - **minor** — new features or behaviour added (feat, add, new)
   - **patch** — everything else (fix, docs, refactor, chore, test)
4. Present the recommendation to the user with a short explanation of what drove the choice, then ask them to confirm or override with patch / minor / major.
5. Once confirmed, perform the following steps in order:
   a. Run `date +%Y-%m-%d` to get today's date.
   b. Read `package.json` to get the current version, compute the new version from the bump type.
   c. Read `CHANGELOG.md` and insert a new entry after the `# Changelog` header line and before the first existing `## [` entry. Group changes under `### Added`, `### Changed`, or `### Fixed` as appropriate. Format:
      ```
      ## [NEW_VERSION] - DATE

      ### Changed
      - ...
      ```
   d. Run `npm version <type> --no-git-tag-version` to bump `package.json` and `package-lock.json` without creating a git commit.
   e. Stage all changed files: `git add CHANGELOG.md package.json package-lock.json`
   f. Commit: `git commit -m "<new-version>"`
   g. Create the tag: `git tag v<new-version>`
6. Report the new version and tag. Do NOT run `git push`.
