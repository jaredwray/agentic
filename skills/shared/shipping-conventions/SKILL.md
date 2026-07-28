---
name: shipping-conventions
description: The shared loop discipline for one-PR-at-a-time agent workflows — sync main, confirm per-item branches are possible, work a single item, drive CI to green (never stop on red), check for already-merged, stop and wait, then resume on "continue"/"next", with only one open PR at a time. One item per branch per PR is the only shape that ships — harnesses that pin the session to one branch (Claude Code on the web, GitHub Actions) must stop and ask for per-item branch permission instead of bundling items into one PR. Background discipline referenced by the release, dependency-management, defense-in-depth, SEO, and project-templates skills so each doesn't restate the loop. Use when running any iterative "open one PR, stop, resume" workflow.
user-invocable: true
---

# Shipping conventions

The shared loop every iterative, repo-mutating workflow in this plugin follows. Skills that ship
changes one PR at a time (`dependency-management-node`, `dependency-management-rust`,
`defense-in-depth-nodejs`, `release-management-nodejs`, `seo`, `project-templates`) reference this
instead of restating it. The consumer skill supplies the **item taxonomy** (what counts as one
unit of work) and the **branch-naming scheme**; everything below is common.

> This is background discipline, not a standalone command. It assumes a consumer skill has already
> told you *what* the next item is.

## The loop

Run on the **first** invocation and again on **every resume** (`continue`, `next`, or a
skill-specific variant like `next dep PR`).

1. **Sync `main` and confirm per-item branches are possible.** Confirm the working tree is clean
   (`git status --short`). If there are uncommitted changes, **stop and report** — never discard
   uncommitted work. Then `git checkout main && git pull --ff-only origin main`. Confirm now, before
   any work, that the environment can open one branch and one PR per item — see
   [Branch-constrained environments](#branch-constrained-environments). Discovering a constraint
   at PR time means the work is already done in the wrong shape.

2. **Audit / take stock.** Reconcile the consumer skill's source of truth (e.g. a `SECURITY.md`
   status block per `security-status-tracking`, or `pnpm outdated`) against actual repo state, and
   determine what work remains. If nothing remains, report the full list of merged PRs plus any
   documented deferrals and **stop — done**.

3. **Pick the next item.** Exactly one logical unit, per the consumer skill's priority order. Do not
   bundle unrelated items; do not fragment one clear item across PRs.

4. **Open the PR.** Branch from the latest `main` using the consumer skill's naming scheme. Make
   only the change this item requires — no opportunistic refactors. Run the local verification the
   item calls for (build/tests if present). Title and body follow `pr-conventions`.

5. **Drive CI to green.** Watch the PR's checks. If any check fails, diagnose, fix, push, and
   re-check until every required check passes (or a red check is a confirmed pre-existing flake on
   `main`, noted in a PR comment). **Never stop on a red PR.**

6. **Check for already-merged.** Before stopping, check whether the PR merged during CI (auto-merge,
   or the user merged manually) or the head branch is already gone. If so, treat it as an implicit
   `next` and **return to step 1 immediately** — do not wait, do not prompt.

7. **Stop and wait.** Report exactly four things: the PR URL + item name; confirmation CI is green;
   what's left; and a literal resume prompt (e.g. *"Merge when ready, then reply `continue` and I'll
   open the next PR."*). Then **wait** — resume only on `continue`/`next`/a skill-specific variant.

## Invariants

- **One open PR at a time.** If a previous PR from this workflow is still open, drive its CI green if
  needed, then stop and wait — do not open a second.
- **One item per PR.** Even within the same category/section.
- **Every PR branches from the latest `main`.**
- **Branch capability is resolved up front.** See
  [Branch-constrained environments](#branch-constrained-environments). Never work around a branch
  constraint by bundling items into one PR or improvising at PR time.
- **Only stop to ask when this discipline (or the consumer skill) says to**, or when the next item is
  genuinely ambiguous.

## Branch-constrained environments

Not every environment lets you open a branch per item. There is no degraded mode: **one item per
branch per PR is the only shape this loop ships.** Two cases look similar and must not be conflated —
resolve which one applies in step 1, before doing any work.

### No PRs possible

The environment can create neither branches nor pull requests (a read-only checkout, a CI job with no
push credentials, a sandbox with no remote). **Stop and report.** There is nothing shippable, and
piling commits onto the current branch produces work the user cannot review or merge.

### Single mandated branch

The environment pins the session to one designated branch and forbids pushing others by default —
Claude Code on the web, GitHub Actions, and most hosted agent harnesses do this with a branch like
`claude/<task>-<id>`. Bundling several items into one PR on that branch is **not** an acceptable
fallback: a multi-group PR defeats per-item review, per-item CI history, and clean revert, which are
the point of the loop.

- **More than one item of work remaining → stop and ask.** Before doing any work, ask the user for
  explicit permission to push one branch per item using the consumer skill's naming scheme. With
  permission granted, run the loop normally — the mandated branch simply goes unused. If permission
  is declined or cannot be obtained, report what work remains and why it was not started, and do no
  work.
- **Exactly one item of work remaining →** the designated branch already satisfies one item, one
  branch, one PR. Ship that single item on it, then stop as usual.
