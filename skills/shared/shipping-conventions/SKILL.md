---
name: shipping-conventions
description: The shared loop discipline for one-PR-at-a-time agent workflows — sync main, resolve the branch mode, work a single item, drive CI to green (never stop on red), check for already-merged, stop and wait, then resume on "continue"/"next", with only one open PR at a time. Defines designated-branch mode for harnesses that pin the session to one branch (Claude Code on the web, GitHub Actions). Background discipline referenced by the release, dependency-management, defense-in-depth, SEO, and project-templates skills so each doesn't restate the loop. Use when running any iterative "open one PR, stop, resume" workflow.
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

1. **Sync `main` and resolve the branch mode.** Confirm the working tree is clean
   (`git status --short`). If there are uncommitted changes, **stop and report** — never discard
   uncommitted work. Then `git checkout main && git pull --ff-only origin main`. Establish which
   branch mode applies now, before any work — see
   [Branch-constrained environments](#branch-constrained-environments). Discovering the constraint
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
- **Branch mode is resolved up front.** See
  [Branch-constrained environments](#branch-constrained-environments). Never work around a branch
  constraint by improvising at PR time.
- **Only stop to ask when this discipline (or the consumer skill) says to**, or when the next item is
  genuinely ambiguous.

## Branch-constrained environments

Not every environment lets you open a branch per item. Two cases look similar and must not be
conflated — resolve which one applies in step 1, before doing any work.

### No PRs possible

The environment can create neither branches nor pull requests (a read-only checkout, a CI job with no
push credentials, a sandbox with no remote). **Stop and report.** There is nothing shippable, and
piling commits onto the current branch produces work the user cannot review or merge.

### Designated-branch mode

The environment mandates one specific branch but pull requests work normally. This is the common
case, not an exotic one — Claude Code on the web, GitHub Actions, and most hosted agent harnesses
pin the session to a branch like `claude/<task>-<id>` and forbid pushing elsewhere. Under the old
stop-and-report rule these environments could never run the workflow at all, which is the wrong
outcome when a reviewable PR is plainly achievable.

Degrade gracefully instead:

- **Keep the item taxonomy intact.** One commit per item, in the consumer skill's priority order,
  each with the commit message the item's PR title would have used. Never squash several items into
  one undifferentiated commit — the grouping is the reviewable unit, and per-item commits keep it
  bisectable and revertable.
- **Verify per item, not once at the end.** Run the item's build/test verification after each
  commit, exactly as you would before opening that item's PR. A green run at the end doesn't tell
  you which item broke what.
- **Open one PR** from the designated branch.
- **Say so in the PR body.** Add a short section naming which items would normally have shipped as
  separate PRs, and that the environment mandated a single branch. A reviewer must never have to
  guess why a multi-group PR arrived.
- **The one-open-PR invariant still holds.** Push follow-up items as additional commits to the same
  PR; do not open a second.

Deviating this way is allowed *only* because the environment forced it. When branches are available,
one item per PR remains the rule — designated-branch mode is a fallback, never a preference.
