# Release Cut

Operation manual for **cutting a release** of an OSS project — finding the unreleased work, deciding the next semver, generating release notes the maintainer can review, and opening a PR that bumps the version. One PR per release.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 audits the repo to find unreleased commits and decide the next version.
>
> **Two stop-and-report points.** The agent stops twice and only twice in the happy path: (a) after presenting the proposed version bump and release notes for maintainer approval, before opening any PR; (b) after the release PR is open and CI is green, to wait for the merge. Everywhere else it proceeds autonomously.
>
> **One release PR at a time.** If a previous release PR (matching the branch pattern below) is already open, drive its CI to green if needed, then stop and wait. Never open a second release PR while one is in flight.
>
> **Scope is the version bump, not the publish.** This doc covers the bump-and-notes PR. The actual publish is triggered after merge by the project's existing release workflow (e.g. GitHub Release → npm). If no publish workflow exists, surface that in the final report — do not invent one. For setting up a hardened publish pipeline, see [`release-management-nodejs.md`](./release-management-nodejs.md).

## Scope and summary

**Scope:** cutting a release for a Node.js / TypeScript project (single-package or pnpm monorepo). The agent:

1. Detects whether the repo is single-package or a monorepo and, for monorepos, which packages have unreleased work.
2. Finds the last released version anchor (git tag, GitHub Release, or `package.json` ↔ npm comparison).
3. Collects commits since that anchor and groups them by Conventional Commit type (or by best-effort heuristic when the repo doesn't use conventional commits).
4. Proposes a semver bump per package and renders release notes.
5. **Stops, displays the proposal, and waits for maintainer approval** (this is the only decision point).
6. On approval, opens **one PR** that bumps the version(s), updates `CHANGELOG.md` (if the project keeps one), and includes the release notes in the PR body.
7. Drives CI to green, then stops and waits for the merge.

**Out of scope:** running `npm publish`, creating GitHub Releases, signing the release, generating provenance, or any registry-side action. Those are handled by the project's existing publish workflow after merge.

## Repository type

Detect this in Step 1 of the workflow. The shape determines how many packages can be released in a single cut.

- **Single-package** — root `package.json` is the only manifest. The release is one version bump on root `package.json` plus (optionally) one `CHANGELOG.md` entry at the repo root.
- **Monorepo (pnpm workspace)** — `pnpm-workspace.yaml` exists, or root `package.json` declares `workspaces`. Each workspace package is released independently. A single release cut may cover **one or more packages** that have unreleased work, but each gets its own version decision and its own section in the release notes. `package.json` versions and per-package `CHANGELOG.md` files are updated in the same PR.
- **Monorepo with a fixed/locked version** — rare; detected by a Changesets `fixed` config (`.changeset/config.json` → `fixed`), a Lerna `version: "independent"` opt-out (i.e. Lerna in fixed mode), or all package versions historically moving in lockstep. In that case treat the whole repo as one logical package: pick the highest semver bump implied by any change and apply it to every package.

If the repo uses **Changesets** (`.changeset/` directory present, `@changesets/cli` in devDependencies), defer to the Changesets flow — see [Reference § 5](#5-changesets-projects).

## Workflow

Run these steps on the **first** invocation, and again on every resume when the user says `continue`, `next`, `cut another`, or similar.

1. **Sync `main` and audit the repo.**
   - Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work.
   - `git checkout main && git pull --ff-only origin main`.
   - Detect the repo type per [Repository type](#repository-type). Record it (single / monorepo / monorepo-fixed / changesets).
   - Check whether a release PR matching any of the Step 6 branch patterns is already open: `release/v*` (single-package), `release/*@*` (single package in a monorepo), or `release/[0-9][0-9][0-9][0-9]-*` (multi-package cut, e.g. `release/2026-05-16-3-packages`). If yes, jump to Step 6 (drive its CI to green, then stop and wait).

2. **Find the last released anchor for each package.** For each package in scope (the root for single-package, or each workspace package for monorepos), determine the **last released version**. Try in order until one yields a definite answer:

   1. **Latest matching git tag.** Single-package: `v<x.y.z>` or `<x.y.z>` (whichever pattern this repo uses — pick by `git tag --sort=-version:refname | head -n 1`). Monorepo: `<package-name>@<x.y.z>` or `<package-name>-v<x.y.z>`.
   2. **Latest GitHub Release.** Useful when tags exist but the repo doesn't keep them locally; query via `mcp__github__list_releases`.
   3. **`package.json` version vs. npm registry.** If the version in `package.json` matches the latest published version on npm, that commit is the anchor (find it with `git log -G '"version":[[:space:]]*"<x.y.z>"' -- <pkg>/package.json | head -n 1`). If `package.json` is **ahead** of npm, the previous version's anchor is the right one — the current `package.json` version is an unreleased bump-in-flight.
   4. **First commit on `main`.** Only if the repo has never been released. In that case, the first release is `0.1.0` or `1.0.0` (ask the user).

   Record the anchor SHA per package. If sources disagree (e.g. tag points to a different SHA than the `package.json` history), stop and report — do not guess.

3. **Collect unreleased commits.** For each package with an anchor, run `git log <anchor>..HEAD` (single-package) or `git log <anchor>..HEAD -- <package-path>` (monorepo) to gather the unreleased commits. For each commit, capture: short SHA, subject, author, and PR number if the subject ends with `(#<n>)` or matches a merge-commit pattern.

   - **Filter merge commits** unless they are the only commit carrying the change (e.g. squashed PRs land as one commit; "Merge pull request #N" lines without a real change should be dropped from the notes but not from the diff).
   - **Skip empty diffs.** A package with no commits touching its path has no unreleased work and is not part of this cut.
   - If **no package has any unreleased commits**, stop and report: "Nothing to release. Last released version is `<x.y.z>` at `<sha>`."

4. **Decide the semver bump per package.** Apply the rules in [§ 1 Semver decision rules](#1-semver-decision-rules). For each package, output: current version → proposed next version, with the rationale (which commit forced the bump).

5. **Generate release notes and present the proposal.** Render notes per [§ 2 Release notes format](#2-release-notes-format). Then **stop and present** to the user — this is the only approval gate. Display, in chat:

   - Repo type (single / monorepo / monorepo-fixed).
   - Per package: current → proposed version, and the **single line of rationale** (e.g. "minor: 1 feat, 3 fix").
   - The list of commits considered, grouped by category, with SHA + subject + PR link.
   - **The full rendered release notes for each package, inside a four-backtick fenced ` ````md ` code block** so the maintainer can copy the raw markdown straight into the GitHub Release. The outer fence is four backticks (not three) because the notes themselves contain three-backtick code examples under `Features` — a three-backtick wrapper would be terminated by the first inner fence. Do not paraphrase, do not collapse, do not drop the surrounding fence — the block goes in chat verbatim, exactly as it will appear in the PR body and the GitHub Release. If a feature example itself contains four backticks, escalate to five on the outer fence; the rule is "outer fence length > longest inner fence length."
   - **A literal prompt to approve**, e.g. *"Reply `ship it` (or `lgtm`, `approved`) to open the PR with these notes. Reply with edits (e.g. `bump to 2.0.0`, `move X out of breaking`) if you want changes first."*

   Then **wait**. Do not open the PR yet. The agent only proceeds when the user approves.

6. **Open the release PR.** On approval:
   - Branch from latest `main`. Naming: `release/v<x.y.z>` (single-package) or `release/<pkg>@<x.y.z>` (one package in a monorepo) or `release/<date>-<n-packages>` (multi-package monorepo cut, where `<date>` is `YYYY-MM-DD`).
   - Apply the version bump(s):
     - Single-package: `pnpm version <new-version> --no-git-tag-version` (or edit `package.json` directly if `pnpm version` rejects the state).
     - Monorepo: edit the `version` field in each affected `package.json` directly. Do not bump unaffected packages.
     - For workspace cross-deps (`"workspace:*"` or `"workspace:^"`), no manifest change is needed — pnpm resolves at publish time. For pinned cross-deps (`"<pkg>": "1.2.3"`), update consumers to the new version.
   - Update `CHANGELOG.md` (root for single-package, per-package for monorepos) **only if the file already exists**. Prepend the new entry — do not rewrite history. If the project does not keep a `CHANGELOG.md`, skip this step; the release notes live in the PR body and the eventual GitHub Release.
   - Run `pnpm install --lockfile-only` to refresh the lockfile if any version bump changed a workspace cross-dep.
   - Locally: `pnpm install --frozen-lockfile && pnpm build && pnpm test` (or whatever the project's `test:ci` is). Fix any breakage before pushing — a release PR must be green from the first push.
   - Open the PR per [Pull request rules](#pull-request-rules). Title and body templates are in [§ 3 PR title and body](#3-pr-title-and-body).

7. **Drive CI to green.** Watch CI on the PR. If any check fails, diagnose, fix, and push until every check is green. **Do not stop on a red PR.** A flaky test that is flaky on `main` too is the only acceptable reason to proceed without green; document it in a PR comment if so.

8. **Check for already-merged.** Before stopping, check the PR state. If it merged during CI (auto-merge, manual merge), do not loop into another cut — release cuts are user-initiated. Just report the merge and stop.

9. **Stop and wait.** Report:
   - PR URL and the release(s) it cuts (e.g. `keyv@5.4.0`, `cacheable@2.1.0`).
   - Confirmation that CI is green.
   - The next manual step: typically "merge the PR, then create a GitHub Release at tag `<tag>` to trigger publish" — or, if the project's release workflow auto-tags on merge, just "merge the PR".
   - If the project has **no publish workflow at all**, say so explicitly and recommend setting one up (link to `release-management-nodejs.md`).

   Then wait. Do not cut another release until the user says so.

## Pull request rules

- **One release per PR.** A release cut PR contains only the version bump, the `CHANGELOG.md` update (if applicable), and a lockfile refresh if needed. Never bundle code changes, dep upgrades, or refactors into a release PR.
- **Only one open release PR at a time.** If a previous release PR is still open, drive its CI to green if needed, then stop and wait.
- **Branch names** match the patterns in Step 6 — `release/v<version>` (single), `release/<pkg>@<version>` (single package in monorepo), `release/<date>-<n-packages>` (multi-package cut).
- The PR is opened **as ready for review**, not as a draft.

---

## Reference

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
- A monorepo package has only **transitive** changes (its own code is untouched, but a workspace dep it consumes was bumped). Ask whether to release it; sometimes the answer is yes (re-publish to pick up the new dep), sometimes no.

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

**Full diff:** https://github.com/<owner>/<repo>/compare/<previous-tag>...<new-tag>
```

Rules:

- **Drop empty sections.** A patch release with only fixes shows only the `Bug Fixes` section.
- **One bullet per commit**, not per PR. If a PR landed as one squashed commit, that's one bullet. If a PR landed as a merge with multiple commits, prefer the merge subject as one bullet.
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

<release notes per § 2 — full content, not a link>

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
- Merge — **no publish workflow detected**; publish manually with `npm publish` or set up a workflow per `release-management-nodejs.md`.
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
- It does not sign the release intent or upload signature bundles. That's covered by `release-management-nodejs.md` Phase 2 and Phase 3.
