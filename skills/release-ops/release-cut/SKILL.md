---
name: release-cut
description: Cut a release of an OSS Node or TypeScript project — find unreleased commits, decide the next semver per package, generate reviewable release notes, and open one version-bump PR. Handles single-package and pnpm monorepos (including Changesets). Use when asked to cut a release, bump the version, prepare release notes, or ship a new version. Stops for approval of the version and notes; does not publish.
disable-model-invocation: true
user-invocable: true
---

# Release Cut

Operation manual for **cutting a release** of an OSS project — finding the unreleased work, deciding the next semver, generating release notes the maintainer can review, and opening a PR that bumps the version. One PR per release.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 audits the repo to find unreleased commits and decide the next version.
>
> **Two stop-and-report points.** The agent stops twice and only twice in the happy path: (a) after presenting the proposed version bump and release notes for maintainer approval, before opening any PR; (b) after the release PR is open and CI is green, to wait for the merge. Everywhere else it proceeds autonomously.
>
> **One release PR at a time.** If a previous release PR (matching the branch pattern below) is already open, drive its CI to green if needed, then stop and wait. Never open a second release PR while one is in flight.
>
> **Scope is the version bump, not the publish.** This doc covers the bump-and-notes PR. The actual publish is triggered after merge by the project's existing release workflow (e.g. GitHub Release → npm). If no publish workflow exists, surface that in the final report — do not invent one. For setting up a hardened publish pipeline, see the `release-management-nodejs` skill. This skill follows the shared `shipping-conventions` loop and `pr-conventions`.

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

If the repo uses **Changesets** (`.changeset/` directory present, `@changesets/cli` in devDependencies), defer to the Changesets flow — see [Reference § 5](./reference.md#5-changesets-projects).

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

3. **Collect unreleased commits.** For each package with an anchor, run `git log <anchor>..HEAD` (single-package) or `git log <anchor>..HEAD -- <package-path>` (monorepo) to gather the unreleased commits. For each commit, capture: short SHA, subject, author, and the associated PR number (see resolution rule below).

   - **Resolve the PR per commit.** Subject parsing alone is unreliable — squash-merge subjects carry `(#<n>)` and merge-commit subjects carry `Merge pull request #<n>`, but rebase-and-merge and customized squash templates land commits on `main` with no PR reference in the subject. Resolve in this order, stopping at the first hit:
     1. Parse the subject for `(#<n>)` (squash-merge default) or `Merge pull request #<n>` (merge-commit default).
     2. Query the GitHub commit-to-PR association via `mcp__github__search_pull_requests` with `query: "repo:<owner>/<repo> is:merged <sha>"` — GitHub indexes the merge commit SHA on the PR. For rebase-and-merge, this resolves the original PR even though no individual commit on `main` references it.
     3. If neither resolves a PR, treat the commit as a direct push to `main` (see the `Commits with no PR` rule in [§ 2](./reference.md#2-release-notes-format)).
   - **Filter merge commits** unless they are the only commit carrying the change (e.g. squashed PRs land as one commit; "Merge pull request #N" lines without a real change should be dropped from the notes but not from the diff).
   - **Skip empty diffs.** A package with no commits touching its path has no unreleased work and is not part of this cut.
   - **Resolve PR titles and authors.** For each distinct PR number captured, fetch the PR's title, merge date, author handle, and `author_association` via `mcp__github__pull_request_read`. This data feeds the `Full List of Changes` section in [§ 2](./reference.md#2-release-notes-format). Batch the lookups — one call per PR is fine for releases under ~10 PRs; for larger releases, prefer `mcp__github__list_pull_requests` with `state: "closed"` and filter client-side to avoid latency and rate-limit pressure. Cache results per cut so a re-render doesn't re-fetch.
   - If **no package has any unreleased commits**, stop and report: "Nothing to release. Last released version is `<x.y.z>` at `<sha>`."

4. **Decide the semver bump per package.** Apply the rules in [§ 1 Semver decision rules](./reference.md#1-semver-decision-rules). For each package, output: current version → proposed next version, with the rationale (which commit forced the bump).

   **Monorepos: walk every workspace package, not just the ones with code changes.** For each workspace package:

   1. Resolve its anchor (from Step 2) and the commits touching its path (from Step 3).
   2. If the package has unreleased commits in its own path → decide its bump per [§ 1](./reference.md#1-semver-decision-rules) and add it to the release set.
   3. If the package has **no commits in its own path but consumes a workspace dep that is being bumped**, decide whether to re-release it. Patch-bump it if the consumed dep's bump is non-breaking (patch, or minor for `1.0+`); for a consumed breaking bump (major, or minor for `0.x`), ask the user — sometimes a re-release is wanted, sometimes the consumer should be updated first.
   4. If the package has no unreleased work and consumes nothing that is changing, skip it. Mark it as `_skipped_` in the proposal table with a rationale like `no changes since <last-tag>` so the maintainer can see it was considered.
   5. Mark `"private": true` workspaces as `_private_` (rationale: `not published`) and exclude them from the release set, but still surface their commit count so the maintainer knows the work was considered.

   The per-package decisions go into the proposal table rendered in Step 5.

5. **Generate release notes and present the proposal.** Render notes per [§ 2 Release notes format](./reference.md#2-release-notes-format). Then **stop and present** to the user — this is the only approval gate. Display, in chat:

   - Repo type (single / monorepo / monorepo-fixed).
   - **A release summary table.** Required for all monorepo cuts (single-package or multi-package — the whole point is to show the full audit including skipped and private rows); recommended but optional for single-package repos. The table lists **every workspace package the agent considered**, not only the ones being released — skipped and private packages appear too, so the maintainer can see the full audit. Use this column set:

     | Package | Current | New | Bump | Rationale | Commits |
     |---|---|---|---|---|---|
     | `keyv` | `5.4.2` | `5.5.0` | **minor** | 1 feat, 2 fix | 3 |
     | `cacheable` | `2.1.0` | `2.1.1` | patch | 1 fix | 1 |
     | `flat-cache` | `6.0.0` | — | _skipped_ | no changes since `flat-cache@6.0.0` | 0 |
     | `internal-utils` | `0.3.0` | — | _private_ | not published | 2 |

     The `Bump` column uses **bold** for any bump that ships (`major` / `minor` / `patch`) and italic for non-shipping rows (`_skipped_`, `_private_`). The `Commits` column is the count of non-merge commits touching the package's path since its anchor. Order rows: shipping rows first (major → minor → patch), then skipped, then private. For single-package repos, the table has one row.
   - Per package being released: the **single line of rationale** (e.g. "minor: 1 feat, 3 fix") and the list of commits considered, grouped by category, with SHA + subject + PR link.
   - **The full rendered release notes for each package, wrapped in a four-backtick fenced ` ````md ` block.** The outer fence is a chat-presentation wrapper only — it keeps the raw markdown displayed verbatim in chat so the maintainer can copy the **content between the fences** straight into the PR body and the GitHub Release. (The fence itself is not part of the PR body or Release.) The wrapper is four backticks (not three) because the notes themselves contain three-backtick code examples under `Features`, and a three-backtick wrapper would be terminated by the first inner fence. Do not paraphrase, do not collapse, do not drop the surrounding wrapper. If a feature example itself uses four backticks, escalate to five on the wrapper; the rule is "wrapper fence length > longest inner fence length."
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
   - Open the PR per [Pull request rules](#pull-request-rules). Title and body templates are in [§ 3 PR title and body](./reference.md#3-pr-title-and-body).

7. **Drive CI to green.** Watch CI on the PR. If any check fails, diagnose, fix, and push until every check is green. **Do not stop on a red PR.** A flaky test that is flaky on `main` too is the only acceptable reason to proceed without green; document it in a PR comment if so.

8. **Check for already-merged.** Before stopping, check the PR state. If it merged during CI (auto-merge, manual merge), do not loop into another cut — release cuts are user-initiated. Just report the merge and stop.

9. **Stop and wait.** Report:
   - PR URL and the release(s) it cuts (e.g. `keyv@5.4.0`, `cacheable@2.1.0`).
   - Confirmation that CI is green.
   - The next manual step: typically "merge the PR, then create a GitHub Release at tag `<tag>` to trigger publish" — or, if the project's release workflow auto-tags on merge, just "merge the PR".
   - If the project has **no publish workflow at all**, say so explicitly and recommend setting one up (link to the `release-management-nodejs` skill).

   Then wait. Do not cut another release until the user says so.

## Pull request rules

- **One release per PR.** A release cut PR contains only the version bump, the `CHANGELOG.md` update (if applicable), and a lockfile refresh if needed. Never bundle code changes, dep upgrades, or refactors into a release PR.
- **Only one open release PR at a time.** If a previous release PR is still open, drive its CI to green if needed, then stop and wait.
- **Branch names** match the patterns in Step 6 — `release/v<version>` (single), `release/<pkg>@<version>` (single package in monorepo), `release/<date>-<n-packages>` (multi-package cut).
- The PR is opened **as ready for review**, not as a draft.

---

## Reference

The semver decision rules, release-notes format, PR title and body templates, anchor-finding examples, the Changesets flow, and edge cases live in [reference.md](./reference.md). Pull it in at the workflow steps that point there.
