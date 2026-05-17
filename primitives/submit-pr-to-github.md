# Submit a Pull Request to GitHub

Operation manual for **opening (or updating) a single pull request on GitHub** from a branch that is already committed locally. The deliverable is a PR URL with a Conventional-Commit-compliant title, a structured body the reviewer can read in 30 seconds, and green CI. One PR per invocation.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 figures out **what** is being shipped (which branch, which base, which commits). Only stop to ask when the document explicitly says to stop and report.
>
> **Persona.** Act as a **release engineer who treats the PR title as the permanent commit log entry**. Once this PR merges, the title is what `git log` shows for the rest of the project's life. Spend the effort on the title and body that a careful reviewer would expect — not a minute less, not a minute more.
>
> **Three stop points in the happy path** and only three: (a) a dirty working tree on entry — stop and tell the user to commit or stash first; (b) the title-and-body draft — present it once and wait for approval before any push; (c) CI is green on the opened PR — report and stop. Everywhere else the agent proceeds autonomously, including pushing fixes when CI fails.
>
> **One PR per invocation.** Drive one PR to "open + green" and stop. Do not approve, merge, enable auto-merge, request reviewers, or set labels — those are the maintainer's calls, not the agent's.

## Scope

**In scope:** opening or updating exactly one PR for a feature branch that is already committed locally. The agent:

1. Identifies the change set (current branch vs. default branch).
2. Picks a single **Conventional Commit type** (`feat`, `fix`, `perf`, `refactor`, `style`, `test`, `docs`, `chore`, `build`, `ci`, `revert`, with optional `!` for breaking) and composes a compliant title.
3. Renders a PR body using the project's standard skeleton (Summary / Changes / Verification / Test plan).
4. Pushes the branch and posts the PR via the GitHub MCP tools.
5. Drives CI to green by diagnosing failures, pushing fixes, and rechecking — until every required check passes or the failure is a known flake on `main`.

**Out of scope:**

- **Writing the underlying commits.** This document assumes the branch is committed. If the working tree is dirty, stop and ask the user to commit or stash first — do not commit on their behalf.
- **Code review.** Reviewing the diff for bugs, security, or architecture is a different job — defer to [`code-review.md`](./code-review.md).
- **Release cuts.** Version bumps, `CHANGELOG.md` updates, and release notes are owned by [`../release-cut.md`](../release-cut.md). Do not run that workflow from here.
- **Approving, merging, enabling auto-merge, requesting reviewers, or setting labels.** These are maintainer actions, not agent actions.

## Workflow

Run these steps on the **first** invocation, and again on every resume when the user says `submit again`, `update the PR`, `next branch`, or similar.

1. **Identify the change set.** Resolve the default branch ref with `git symbolic-ref --short refs/remotes/origin/HEAD` (typically `origin/main` or `origin/master`). Resolve the current branch with `git rev-parse --abbrev-ref HEAD`. If the current branch is the default branch, or HEAD is detached, stop and report — there is nothing to open a PR for.

   Collect the change set:
   - `git log <base>..HEAD --oneline` — the commits this PR will contain.
   - `git diff <base>...HEAD --stat` — the file-level summary (three-dot, so it's against the merge base).

   Record: base ref, head ref, commit count, files-changed count, lines added/removed. Stop and report if the commit count is zero.

2. **Check the working tree and remote.** Run `git status --short`. If output is non-empty, stop and report: "Working tree has uncommitted changes — commit or stash first, then re-run." Do not commit on the user's behalf; this primitive only opens PRs for already-committed work.

   Resolve the upstream with `git rev-parse --abbrev-ref --symbolic-full-name @{u}` (suppress stderr). If no upstream is set, the push in Step 7 will need `-u origin <branch>`. If no `origin` remote exists at all, stop and tell the user to `git remote add origin <url>` — do not invent a URL.

3. **Check for an existing PR on this branch.** Call `mcp__github__list_pull_requests` with `head=<owner>:<branch>` and `state=open`. If a PR already exists for this branch, switch to **update mode** for Steps 6–7: the existing PR's number is the target, `mcp__github__update_pull_request` is the write call, and the user is told upfront that this is an update, not a new PR.

   If zero PRs match, the agent is in **new-PR mode**. If multiple open PRs match (rare — usually a stale fork PR), stop and ask which one to update, or whether to open a new one against a different base.

4. **Draft the title.** Apply [Reference § 1](#1-title-format) (format rules) and [Reference § 2](#2-conventional-commit-type-selection) (type selection). The title is a single line:

   ```
   <type>(<optional-scope>)<optional-!>: <imperative subject>
   ```

   - **One** Conventional Commit type. When commits span categories, pick the highest-impact one that any commit forces (see § 2).
   - ≤70 characters total. Imperative mood (`add`, not `added`/`adds`). Lowercase subject. No trailing period. No issue number in the title — link issues in the body.
   - Add `!` before the colon **and** a `BREAKING CHANGE:` paragraph in the body's Summary when any commit is breaking.

5. **Draft the body.** Render per [Reference § 3](#3-pr-body-template). The skeleton is fixed: `Summary`, `Changes`, `Verification`, `Test plan`. Rules:

   - Bullets in `Changes` come from the actual commit log — one line per commit (or per logical group of commits if a PR was iterated locally). Do not paraphrase the diff; the reviewer has the diff.
   - Checkboxes in `Verification` are only for things the agent actually ran. An unchecked box is fine; a checked box that wasn't run is a lie.
   - `Test plan` describes how a reviewer would verify the change in a fresh checkout — commands, URLs, expected output.
   - If any commit message contains `Closes #<n>`, `Fixes #<n>`, or similar, surface those in the Summary so GitHub auto-closes the issue on merge.

6. **Stop and present the title + body for approval.** This is the only approval gate. Show, in one chat message:

   - **Mode:** `new PR` or `update PR #<n>`.
   - **Base → head:** `main ← feat/retry-budget` (with the resolved refs).
   - **Title:** the drafted title, in a single-backtick code span so the user can copy it.
   - **Body:** the full rendered markdown body, wrapped in a four-backtick fenced block so any internal three-backtick fences render verbatim.
   - **Change summary:** `<n> commits, <m> files changed, +<add>/−<rm>`.
   - **Draft state:** `ready` (the default) or `draft` (only if the user has previously asked, or local checks haven't been run).
   - **A literal prompt to approve**, e.g. *"Reply `ship it` (or `lgtm`, `approved`) to push and open. Reply with edits (e.g. `change type to fix`, `drop the scope`, `rewrite the summary`) for changes first."*

   Then **wait**. Do not push. Do not call any GitHub MCP write tool. The agent only proceeds on explicit approval.

7. **Push and open (or update).** On approval:

   - **Push.** `git push -u origin <branch>` if no upstream is set, otherwise `git push`. If the push is rejected because the remote has new commits (rare for a feature branch the agent owns), stop and report — do not force-push without an explicit instruction.
   - **Open or update.** In new-PR mode: `mcp__github__create_pull_request` with `owner`, `repo`, `title`, `body`, `head=<branch>`, `base=<default-branch>`, `draft=false`. In update mode: `mcp__github__update_pull_request` with `pull_number=<n>`, `title`, `body`.
   - **Capture the result.** Record the PR number, URL, and the SHA the PR currently points at.

8. **Drive CI to green, then stop.** Poll the PR's check runs via `mcp__github__pull_request_read` (request `method: "status"` or the checks view). For each failing check:

   1. Read the failure (job logs, failed test names, error output).
   2. Decide: is this **a real failure** (introduced by this PR) or **flaky on `main` too** (intermittent, unrelated)? Confirm flakes by checking the same check on the latest `main` SHA.
   3. If real: fix it locally (the same way you would for any bug — see [`debug.md`](./debug.md) if needed), commit with a focused message (`fix: <what>` or `test: <what>`), push, and re-poll.
   4. If flake: leave a one-line PR comment via `mcp__github__add_issue_comment` calling out the flake (with a link to the `main` failure), and treat the check as passing for the purpose of this workflow.

   Cap the fix-and-push loop at **3 iterations**. If CI is still red after 3 attempts, stop and report the remaining failures with diagnosis — the user decides whether to keep going.

   On green (every required check passing, or the only red checks are confirmed flakes with comments), report:

   - PR URL, number, title.
   - Final commit SHA.
   - Check summary: `<n> passed, <m> flaky-on-main` (or `all green`).
   - The next manual step is the maintainer's: review and merge.

   Then **stop.** Do not request reviewers, do not add labels, do not enable auto-merge, do not merge. The PR is the deliverable; the agent's job ends at the green checkmark.

---

## Reference

Section numbers below are referenced from the workflow above.

## 1. Title format

The title is one line, in this shape:

```
<type>(<optional-scope>)<optional-!>: <subject>
```

| Element | Rule |
|---|---|
| `<type>` | Required. Exactly one of the 11 Conventional Commit types in [§ 2](#2-conventional-commit-type-selection). |
| `(<scope>)` | Optional. The slice of the codebase the change touches — usually a package name (`feat(api):`), a subsystem (`fix(parser):`), or a directory (`docs(readme):`). Omit when the change spans multiple scopes or the repo has no clear scoping. |
| `!` | Optional. Append `!` **before** the colon for any breaking change. Always pair with a `BREAKING CHANGE:` paragraph in the body's Summary. |
| `: <subject>` | Required. Colon, single space, then the imperative-mood subject. |

**Subject rules:**

- ≤70 characters total (title length, not just the subject). GitHub truncates longer titles in the commit list.
- **Imperative mood.** `add retry budget`, not `added retry budget`, not `adds retry budget`, not `adding retry budget`. The test: the subject should complete the sentence "If applied, this commit will ___".
- **Lowercase.** `add`, not `Add`. Exception: proper nouns and identifiers keep their casing (`add OAuth2 support`, `update CHANGELOG.md`).
- **No trailing period.** Titles are headlines, not sentences.
- **No issue numbers.** `#123` belongs in the body (`Closes #123`), not the title. The title is the permanent log entry; issue links rot.
- **No conjoined types.** `feat+fix:` and `feat: ... and fix: ...` are not valid. Pick one type (§ 2 explains how).

**Good titles:**

```
feat(retry): add exponential backoff with jitter
fix(parser): handle UTF-8 BOM in source files
perf: avoid quadratic scan in dependency resolver
refactor(auth)!: split session store into its own module
docs: document the rate-limit headers
chore(deps): bump tsx to 4.20.0
```

**Bad titles** (and what's wrong):

```
Update stuff                      # no type, vague subject
feat: Added new endpoint.         # past tense, capitalized, trailing period
fix #123: parser bug              # issue number in title
feat+fix: retry + parser fix      # multi-type
chore: rewrite the entire auth layer to use OAuth2 and add session support  # >70 chars, and chore: is wrong (it's a feat)
```

## 2. Conventional Commit type selection

Pick **one** type. When the PR contains commits spanning multiple types, pick the **highest-impact** type that any commit in the PR forces.

| Type | Use when… | Impact (high → low) |
|---|---|---|
| `feat` | The PR adds a user-visible feature, capability, option, flag, or public API. | **1 (highest)** |
| `fix` | The PR fixes a bug — observed wrong behavior becomes right. | 2 |
| `perf` | The PR improves performance without changing observable behavior. | 3 |
| `refactor` | The PR restructures code without changing behavior or performance. If it touches the public API, consider `feat` instead. | 4 |
| `style` | Pure formatting / whitespace / lint fixes. No logic change. | 5 |
| `test` | Adds or fixes tests only. No production code change. | 6 |
| `docs` | Documentation-only changes (README, comments, the `docs/` tree, this very file). | 7 |
| `chore` | Maintenance that doesn't fit elsewhere: dep bumps, repo plumbing, internal scripts, codeowners updates. | 8 |
| `build` | Changes to the build system or external dependencies (bundler config, lockfile-only changes, Dockerfile). | 9 |
| `ci` | Changes to CI configuration (`.github/workflows/`, CI scripts, release pipelines). | 10 |
| `revert` | A revert of a previous commit. The body must reference the reverted SHA. | matches the reverted commit's type |

**Breaking changes override everything.** Any commit that removes, renames, or incompatibly changes a public API is a breaking change. Mark the title with `!` (e.g. `feat(api)!: rename listSessions to listActiveSessions`) **and** include a `BREAKING CHANGE:` paragraph in the body's Summary describing the break and the migration. See [`../release-cut.md`](../release-cut.md) § 1 for how breaking changes flow through semver — this primitive only needs to flag them; the release-cut workflow handles the version bump.

**Decision rule for mixed-type PRs:** walk every commit, classify it, then pick the lowest-numbered type on the table above. A PR with one `feat:` commit and ten `chore:` commits is a `feat:` PR. A PR that adds a feature and fixes an unrelated bug should usually be **split** into two PRs — but if it isn't, the title is `feat:` and the body's `Changes` section calls out the bug fix as a second bullet.

**Anti-pattern:** using `chore:` to hide a user-facing change because the diff is small. If a user can observe the change, it is `feat` / `fix` / `perf` / `refactor` — not `chore`.

## 3. PR body template

Render the body in this exact shape. Drop empty sections (no `Verification` block if nothing was run), but keep the section order.

````md
## Summary
<2–4 sentences. What this PR does and why. Lead with the user-visible change, not the implementation. If breaking, lead with the breaking change.>

<For breaking PRs only:>
**BREAKING CHANGE:** <what breaks, in one sentence>.
**Migration:** <how consumers update, in one sentence>.

Closes #<n>.   <!-- optional, only if a commit references it -->

## Changes
- <one bullet per commit (or per logical group), in commit order — strip the `type:` prefix, keep the subject>
- <…>

## Verification
- [x] <local check that was actually run, e.g. `pnpm test` passes locally>
- [x] <e.g. manual smoke test of the new endpoint at `/api/sessions`>
- [ ] <unchecked box for something a reviewer should verify but the agent couldn't, e.g. `production smoke test after deploy`>

## Test plan
- <how a reviewer reproduces the change in a fresh checkout>
- <commands, URLs, expected output>
- <edge cases worth poking at>
````

**Rules for the body:**

- **No diff paraphrase.** The reviewer has the diff. The body explains intent — what changed in the user's world, not what changed in the source tree.
- **No marketing.** "Massively improved performance" → "reduces median response time from 240ms to 80ms on the `/search` endpoint."
- **Checkboxes are promises.** A checked box says "I ran this and it passed." Never check a box for something you didn't run. Unchecked boxes are an acceptable handoff to the reviewer.
- **Link issues, don't repeat them.** `Closes #123` is enough. Do not paste the issue body into the PR.
- **Keep `Test plan` reproducible.** Vague test plans (`make sure it works`) are not test plans. Name the commands, the URLs, the expected output.

## 4. Branch & commit hygiene

The agent does not create commits in this workflow (that's out of scope), but the branch state affects the PR.

- **Branch naming.** When the branch is being created elsewhere, prefer `<type>/<short-slug>` (`feat/retry-budget`, `fix/parser-bom`, `docs/submit-pr-primitive`). The branch name is not the title — but a good slug makes the PR list scannable.
- **Single-commit PRs in squash-merge repos.** When the PR contains one commit, the commit subject and the PR title should match. GitHub uses the PR title as the squash-merge subject by default, so a mismatch creates a third version of the message in `git log`.
- **Multi-commit PRs.** The PR title summarizes the whole change. Individual commit subjects can be more granular. They will be preserved on `rebase-and-merge`, replaced by the PR title on `squash-and-merge`, and noisy on `create-a-merge-commit` — match the repo's merge policy.
- **Rebase before push.** When the base branch has moved significantly, rebase onto it (`git fetch origin && git rebase origin/<base>`) before pushing. A PR that conflicts on day zero is a worse review experience than one that's already integrated.
- **Force-push policy for update mode.** When updating an existing PR, force-push (`git push --force-with-lease`) only when rebasing or rewriting history is necessary. For new commits on top, a regular push is enough and preserves review comment line numbers.

## 5. Posting via GitHub MCP

Use the GitHub MCP tools — not `gh` CLI, not raw API. The tools accept structured arguments and the agent has scoped repository permissions.

| Tool | Used in | Required args |
|---|---|---|
| `mcp__github__list_pull_requests` | Step 3 — dedupe | `owner`, `repo`, `head=<owner>:<branch>`, `state=open` |
| `mcp__github__create_pull_request` | Step 7 — new-PR mode | `owner`, `repo`, `title`, `body`, `head`, `base`, `draft=false` |
| `mcp__github__update_pull_request` | Step 7 — update mode | `owner`, `repo`, `pull_number`, `title`, `body` |
| `mcp__github__pull_request_read` | Step 8 — CI polling | `owner`, `repo`, `pull_number`, `method` (`get`, `status`, or `files` as needed) |
| `mcp__github__add_issue_comment` | Step 8 — flake comment | `owner`, `repo`, `issue_number=<pull_number>`, `body` |

**Defaults to enforce:**

- `draft: false`. Open PRs as **ready for review**, not draft. Draft mode hides the PR from review queues and bypasses required-reviewer policies — use it only when the user explicitly asks, or when local checks haven't been run and the PR exists just to share a WIP link.
- **Do not** call `mcp__github__merge_pull_request`, `mcp__github__enable_pr_auto_merge`, `mcp__github__pull_request_review_write` (for `APPROVE`), or `mcp__github__request_copilot_review` from this workflow. Merging and approving are out of scope.

**Fallback when MCP is unavailable.** If the GitHub MCP server is disconnected (the tools fail with "tool not found" or similar), do **not** improvise with `gh` CLI or `curl` — that's a different transport with different auth. Stop and report the title + body to the user so they can open the PR by hand. The agent's job ends at "PR content drafted, transport unavailable."

## 6. Anti-patterns the submitter must avoid

These are the failure modes of bad PR submissions. Catch yourself in them and back up.

- **The "misc fixes" title.** `chore: updates`, `fix: bug fix`, `wip`. The title is the permanent log entry — make it specific. If you can't name the change in 70 characters, the PR is too big.
- **The wrong type for the optics.** Using `chore:` for a user-visible change because the diff is small (so it looks "safe"), or `feat:` for an internal refactor because the work felt big. The type describes the **observable effect**, not the effort.
- **The conjoined title.** `feat+fix:`, `feat & docs:`, `feat: add X and fix Y`. One PR, one type. If the PR really does two things, split it or pick the dominant type and call out the second in `Changes`.
- **The past-tense subject.** `added retry support`, `fixed the parser`. Imperative mood: `add retry support`, `fix the parser`. Test: "If applied, this commit will ___".
- **The diff-paraphrase body.** A `Summary` that says "This PR changes file A and file B." The reviewer has the diff. Explain the **intent**, not the inventory.
- **The lying checkbox.** A checked `Verification` box for a test that wasn't run. The reviewer trusts the checkboxes; a lie there is worse than no checkbox.
- **The pre-approval push.** Pushing the branch or opening the PR before the user has approved the title. Step 6 is a hard gate, not a courtesy.
- **The dodge-the-review draft.** Opening as `draft: true` so required-reviewer policies don't apply. Drafts are for actual WIP, not for sneaking changes past a review gate.
- **The unauthorized merge.** Calling `mcp__github__merge_pull_request` or `mcp__github__enable_pr_auto_merge` because CI is green. Merging is the maintainer's call. The agent stops at green.
- **The reviewer-spam.** Requesting three reviewers without being asked. The agent does not pick reviewers.
- **The red-PR victory lap.** Reporting "PR opened" as success while CI is still red. Step 8 is part of the workflow, not a nice-to-have. A red PR is an unfinished PR.
