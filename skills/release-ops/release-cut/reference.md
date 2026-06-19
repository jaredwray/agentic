# Release Cut — reference

Reference material for the `release-cut` skill. The workflow points here at the steps that need it.

Section numbers below are referenced from the workflow above.

## 1. Semver decision rules

For each package, walk its unreleased commits and pick the **highest** bump that any commit forces. Default to **patch**.

### Conventional Commits (preferred)

When commit subjects follow the [Conventional Commits](https://www.conventionalcommits.org/) spec (`type(scope): subject`, optional `!` for breaking, optional `BREAKING CHANGE:` footer), use this mapping:

| Commit signal | Bump |
|---|---|
| `<type>!:` or `BREAKING CHANGE:` footer | **major** |
| `feat:` / `feat(scope):` | **minor** |
| `fix:` / `perf:` / `revert:` | **patch** |
| `refactor:` / `style:` | patch (unless it touches the public API — then minor) |
| `docs:` / `test:` / `chore:` / `build:` / `ci:` | patch — but if **all** unreleased commits are in this set, ask the user whether a release is even warranted |

### Non-conventional commits (fallback)

When the repo doesn't use conventional commits, infer from subject keywords and diff content. Be conservative — when in doubt, pick the lower bump and let the maintainer override at the approval gate.

| Signal | Bump |
|---|---|
| Subject contains `BREAKING`, `breaking change`, `remove`, `drop support`, or removes/renames an exported symbol | **major** |
| Subject starts with `add`, `feat`, `feature`, `support`, `introduce`, or adds a new exported symbol | **minor** |
| Subject starts with `fix`, `bug`, `patch`, `correct`, `prevent`, or only changes implementation behind existing APIs | **patch** |
| Subject is `chore`, `docs`, `test`, `refactor` with no API surface change | **patch** |

### Pre-1.0 (`0.x.y`) projects

Semver allows breaking changes in **minor** bumps for `0.x` versions. Use this mapping instead:

| Commit signal | Bump |
|---|---|
| Breaking change | **minor** (e.g. `0.4.2 → 0.5.0`) |
| Feature | **minor** |
| Fix / patch | **patch** |

If a `0.x` project is ready to declare stability, ask the user before promoting to `1.0.0` — that's a deliberate choice, not an automatic bump.

### Stop-and-ask cases

Stop and ask the user (do not guess) when:

- The only unreleased commits are `chore` / `docs` / `ci` and there's no clear shipping reason. ("There are no `feat` or `fix` commits since the last release. Cut a patch anyway?")
- A breaking change is detected but the project follows a deprecation policy (e.g. deprecate-then-remove). Confirm the deprecation cycle is complete.
- A monorepo package has only **transitive** changes (its own code is untouched, but a workspace dep it consumes was bumped) **and** the consumed dep's bump is breaking (major, or minor for `0.x`). Apply the Step 4 rule: patch-bump the consumer automatically for a non-breaking consumed bump (patch, or minor for `1.0+`); ask the user for a breaking one — sometimes a re-release is wanted, sometimes the consumer should be updated first.

## 2. Release notes format

Render notes in **Keep a Changelog**-flavored markdown. The same rendered notes are used in three places: the chat preview at the approval gate, the PR body, and (verbatim) the eventual GitHub Release body.

### Per-package template

```md
## <package-name>@<new-version> — <YYYY-MM-DD>

<one-sentence summary of the release — 100 chars max, no marketing language>

### ⚠ BREAKING CHANGES
- <description of breaking change> (<short-sha>, #<pr>)
  Migration: <one line on how consumers update>

### Features
- <feat subject without the `feat:` prefix> (<short-sha>, #<pr>)

  ```<language>
  // Short usage example — prefer before/after when behavior changed.
  // See the "Code examples for features" rule below.
  ```

### Bug Fixes
- <fix subject without the `fix:` prefix> (<short-sha>, #<pr>)

### Performance
- <perf subject without the `perf:` prefix> (<short-sha>, #<pr>)

### Documentation
- <docs subject without the `docs:` prefix> (<short-sha>, #<pr>)

### Internal
- <chore / refactor / test / ci subjects, collapsed if numerous> (<short-sha>, #<pr>)

### Contributors
- @<github-handle> (<commit-count>)

### Full List of Changes
- <PR title> by @<author> in #<pr>
- <PR title> by @<author> in #<pr>

**Full diff:** https://github.com/<owner>/<repo>/compare/<previous-tag>...<new-tag>
```

Rules:

- **Drop empty sections.** A patch release with only fixes shows only the `Bug Fixes` section. The `Full List of Changes` and `Contributors` sections are exempt from this rule — they always render as long as the release contains any commits.
- **One bullet per commit**, not per PR, in the category sections (`Features`, `Bug Fixes`, etc.). If a PR landed as one squashed commit, that's one bullet. If a PR landed as a merge with multiple commits, prefer the merge subject as one bullet. The `Full List of Changes` section is the exception — it's one bullet per PR (see below).
- **Strip the conventional prefix** from each bullet. `feat: add retry support` → `add retry support`.
- **Link the PR**, not the commit, when both are present. Use `(#123)`; GitHub auto-renders this in PR bodies and Release bodies.
- **Migration notes are mandatory for breaking changes.** Every `BREAKING CHANGES` bullet has a `Migration:` sub-line. If you can't write one, that's a sign the change isn't actually ready to ship — stop and ask.
- **No marketing language.** "Massive performance improvements" → "reduced X by N%". "Better DX" → name the specific change.
- **Code examples for features.** Every bullet under `Features` should be followed by a short fenced code block showing how to use it — readers learn the change faster from one line of code than from a paragraph. Rules:
  - **Required** when the feature adds a new exported symbol, a new option/flag, a new CLI subcommand, a new HTTP endpoint, or otherwise changes the public surface consumers call.
  - **Required** when the feature changes the resolution of an existing input (e.g. URL routing, parser, matcher). Show a real **before / after**: input on the left, what the old version returned, what the new version returns.
  - **Skip** for purely internal optimizations, tooling-only features, or anything a consumer cannot observe.
  - Keep each block under ~12 lines. Use the smallest realistic snippet that demonstrates the feature, not a full program. Pick the language fence that matches the example (`ts`, `js`, `bash`, `http`, `json`, etc.).
  - If a single feature warrants more than one example (e.g. an SDK call + a CLI invocation), use two separate fenced blocks, not one combined one.
  - `Bug Fixes`, `Performance`, `Documentation`, and `Internal` bullets do **not** include code blocks by default — only if a fix is subtle enough that the diff in behavior needs to be shown explicitly.
- **Contributors section** lists every distinct commit author, sorted by commit count desc. Skip bot accounts (`dependabot`, `renovate-bot`, `claude[bot]`).
- **Full List of Changes section** is a flat, complete inventory of every PR shipped in this release — one bullet per PR, not per commit, rendered at the bottom right before the `Full diff:` link. This mirrors GitHub's auto-generated "What's Changed" format so readers can scan every PR at a glance even when the categorized sections collapse multiple PRs into a single line.
  - **Source.** Walk the unreleased commits collected in Workflow Step 3, using each commit's resolved PR number (Step 3 already runs the subject-parse → commit-to-PR API lookup → no-PR fallback chain, so this section just consumes the result). For a monorepo cut, filter to PRs whose commits touch the package's path.
  - **Format.** `- <PR title> by @<author> in #<pr>`. Use the PR title from GitHub (via `mcp__github__pull_request_read`), not the commit subject — they often differ, and the PR title is what the maintainer wrote on the PR. The `#<pr>` reference auto-renders as a link in PR bodies and Release bodies.
  - **Order.** Chronological by merge date (or commit date for direct commits with no PR), oldest first. This matches GitHub's default and gives readers a sense of the release's timeline.
  - **Deduplicate.** If two commits reference the same PR (rare — usually a follow-up commit landed on a merge PR), list the PR once.
  - **Bots.** Include bot PRs (`dependabot`, `renovate-bot`, `claude[bot]`) — unlike the `Contributors` section, this list is meant to be exhaustive. Dependency bumps and automated updates are real changes a consumer might care about.
  - **Commits with no PR.** If a commit was pushed directly to `main` without a PR (uncommon on protected branches but possible on solo projects), render it as `- <commit subject> by @<author> in <short-sha>` so the inventory stays complete.
  - **New contributors.** If a PR author's `author_association` field on the PR is `FIRST_TIME_CONTRIBUTOR` or `FIRST_TIMER`, append ` (first-time contributor)` to their bullet. This field is already in the PR data fetched in Step 3, so no extra lookup is needed.

### Multi-package monorepo cut

Render one `## <package>@<version>` block per package, in the order: packages with breaking changes first, then features, then patches. At the top of the PR body, prepend a one-line summary:

```md
Releasing 3 packages: keyv@5.5.0 (minor), cacheable@2.1.1 (patch), flat-cache@6.0.1 (patch).
```

## 3. PR title and body

### Title

| Repo type | Title |
|---|---|
| Single-package | `release: v<new-version>` |
| Monorepo, one package | `release: <package>@<new-version>` |
| Monorepo, multi-package | `release: <date> (<n> packages)` — e.g. `release: 2026-05-16 (3 packages)` |
| Monorepo, fixed-version | `release: v<new-version>` (matches single-package since all packages move together) |

Append `(breaking)` to the title for any release that contains a major bump.

### Body

```md
## Release summary
<one-sentence summary — for monorepos, the multi-package summary line from § 2>

## Packages
<the release summary table from Step 5 — required for any monorepo cut (single or multi-package). Lists every workspace package considered, including skipped and private rows. Omit this section only for single-package repos.>

<release notes per § 2 — full content, not a link. For multi-package monorepo cuts, render one per-package notes block per shipped package, in the same order as the table above.>

## Verification
- [x] `pnpm install --frozen-lockfile` succeeds
- [x] `pnpm build` succeeds
- [x] `pnpm test` (or `pnpm test:ci`) passes locally
- [x] No uncommitted changes outside the version bump and CHANGELOG entry

## Post-merge
<one of the following, depending on the project's publish setup:>
- Merge then create a GitHub Release at tag `<tag>` — the `release.yaml` workflow publishes to npm.
- Merge then push tag `<tag>` — the publish workflow runs on tag push.
- Merge — auto-tag and publish run on merge to `main`.
- Merge — **no publish workflow detected**; publish manually with `npm publish` or set up a workflow per the `release-management-nodejs` skill.
```

Don't add commentary beyond the skeleton unless something genuinely surprising came up (e.g. a flaky test on `main`, a contributor who needs an attribution fix).

## 4. Finding the unreleased anchor — examples

### Single-package, tag-based

```bash
# Most recent release tag (whichever pattern is used):
git tag --sort=-version:refname | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1
# → v1.5.1

# Commits since that tag:
git log v1.5.1..HEAD --oneline
```

### Single-package, no tags (npm-anchored)

```bash
# Current package.json version:
node -p "require('./package.json').version"
# → 1.5.1

# Latest npm publish:
npm view "$(node -p "require('./package.json').name")" version
# → 1.5.0  (so package.json is already bumped to 1.5.1; previous release was 1.5.0)

# Commit that introduced the current package.json version (the bump-in-flight):
git log -G '"version":[[:space:]]*"1\.5\.1"' --reverse -- package.json | head -n 1
# Use that commit's parent as the anchor — that's where 1.5.0 ended.
```

### Monorepo, per-package tags

```bash
# Latest tag per package (typical pattern: <pkg>@<version>):
git tag --sort=-version:refname | grep -E '^keyv@[0-9]' | head -n 1
# → keyv@5.4.2

git log keyv@5.4.2..HEAD --oneline -- packages/keyv
```

### Monorepo, no per-package tags (workspace history walk)

When only the root is tagged but packages release independently, fall back to `package.json` history per package (same approach as the single-package npm-anchored case, but per workspace).

## 5. Changesets projects

If the repo has `.changeset/` and `@changesets/cli` in devDependencies, **do not implement the bump manually** — Changesets owns the version state. Instead:

1. Run `pnpm changeset status` (or `npx changeset status --since=origin/main`) to see what's queued.
2. If the changeset queue is empty, there's nothing to release — stop and report.
3. If the queue is non-empty, run `pnpm changeset version` to apply the queued bumps and regenerate `CHANGELOG.md` files. Commit the result.
4. Use the per-package `CHANGELOG.md` diffs as the release notes for the approval gate. Skip § 2's manual rendering — Changesets has already produced the canonical notes.
5. Open the release PR per Step 6, with the title `release: changesets <date>` (or `release: <pkg>@<version>` if a single package is bumped).

The semver decision rules in § 1 do not apply — Changesets has already encoded the bump per changeset file.

## 6. Edge cases

### `package.json` version is ahead of the last release tag

The repo bumped the version manually (or via a previous release PR that was never tagged). Two cases:

- **Manual bump, never published.** The current `package.json` version is the right "next version". Re-run the rest of the workflow using that as the proposal — but ask the user whether they want any additional commits to influence the bump (e.g. if the manual bump was patch but a `feat:` has since landed, it should be a minor).
- **Published but never tagged.** Confirm via `npm view <pkg> version`. If the published version matches `package.json`, treat that commit as the anchor and find the next bump from there.

### Tag exists but `package.json` was never updated

A release tag was pushed but the `package.json` version stayed behind. Stop and ask — this usually indicates a broken release. Do not silently "catch up" the manifest.

### Multiple unreleased majors in one cut

A monorepo cut contains breaking changes for two or more packages. That is allowed (one PR can cut several major bumps as long as each package's notes call them out). But: confirm at the approval gate that the maintainer wants them in the same PR and not split.

### Pre-release tags (`-rc.1`, `-beta.0`, `-test.0`)

If the most recent release was a pre-release (e.g. `1.5.0-rc.1`) and the cut is the GA release (`1.5.0`), the bump is **drop the pre-release suffix**, not a semver step. If the cut is the next pre-release (`1.5.0-rc.2`), bump only the pre-release counter. Ask the user which kind of cut they want when a pre-release tag is in play.

### Monorepo with internal-only packages

Some workspace packages are marked `"private": true` and never publish. Skip them — they have no release. Their commits still influence other packages' releases if any **public** package depends on them.

## 7. What this doc does **not** do

- It does not run `npm publish`. The publish is the project's existing workflow.
- It does not create the GitHub Release. (If the project's workflow triggers off a GitHub Release, the maintainer creates that after merge — call this out in the post-merge section of the PR body.)
- It does not push the release tag. Either the publish workflow does it after publish, or the maintainer creates it via the GitHub Release. Pushing tags from a PR-bump branch couples two concerns and bypasses review.
- It does not sign the release intent or upload signature bundles. That's covered by the `release-management-nodejs` skill Phase 2 and Phase 3.
