---
name: resolve-merge-conflicts
description: Resolve git merge or rebase conflicts safely — classify each conflict, reconstruct what both sides intended, resolve so both changes' behavior is preserved, and verify with build and tests before continuing. Use when a merge or rebase has conflicts, when asked to fix the conflicts, or when a PR branch needs updating against main. Mutates the working tree, so it runs only when explicitly invoked.
disable-model-invocation: true
user-invocable: true
---

# Resolve Merge Conflicts

Operation manual for resolving the conflicts from a git merge or rebase **without losing either
side's intent**. The danger isn't the markers — it's "resolving" a conflict by quietly dropping one
side's change and shipping a regression that compiles.

> **When this document is loaded, begin executing immediately.** Start with Step 1. Only stop to ask
> when a conflict is a genuine semantic contradiction that needs a product decision.
>
> **Never blind-pick a side.** `-X ours` / `-X theirs`, "accept current", and "accept incoming" are
> not resolution — they are choosing which change to silently lose. Use them only when you have
> actually concluded one side fully supersedes the other.
>
> **Verify before continuing.** A resolution that isn't built and tested is a guess. Don't
> `git rebase --continue` on hope.

## Scope

**In scope:** resolving conflicts from an in-progress `git merge`, `git rebase`, `git cherry-pick`, or
`git stash pop`. **Out of scope:** deciding *whether* to merge/rebase (that's the caller's call), and
resolving a genuine product contradiction — surface that to the user rather than inventing an answer.

## Workflow

1. **Establish state.** Run `git status`. Identify the operation in progress (merge / rebase /
   cherry-pick), which commit is being applied, and the full list of conflicted paths. For a rebase,
   note that conflicts are resolved **commit by commit** — you may go through this loop several times.
   If the working tree had uncommitted changes that aren't part of the operation, stop and report.

2. **Understand both sides, per file.** For each conflicted file, read all three inputs — not just the
   `<<<<<<<` / `=======` / `>>>>>>>` hunks:
   - **ours** (current branch / rebase target) and **theirs** (incoming).
   - The **merge base** (`git show :1:<path>`) — what both sides started from. The base is what tells
     you whether a side *added*, *changed*, or *removed* a line, which is the difference between a real
     conflict and a false one.
   - The surrounding code, so the resolution is consistent with the rest of the file.

3. **Classify each conflict** and resolve accordingly:
   - **Both added different things** (imports, list entries, cases) → usually **keep both**, in a
     sensible order.
   - **Both edited the same logic** → reconstruct the *intent* of each edit and produce code that
     honors both (e.g. one side fixed a bug, the other renamed a variable → apply the fix to the
     renamed code). This is the case where blind-picking silently regresses.
   - **One side deleted, the other edited** → decide from intent: was the delete a removal of dead code
     (then the edit is moot) or did the edit add behavior the delete shouldn't have dropped? If unclear,
     ask.
   - **Rename vs. edit** → apply the edit to the renamed/moved file.
   - **Generated files** (lockfiles, snapshots, bundles) → do not hand-merge. Regenerate: re-run the
     lockfile install (`pnpm install`, etc.), re-record snapshots, rebuild. The tool is the source of
     truth, not the diff.
   - **Genuine contradiction** (the two sides want incompatible behavior) → stop and ask the user which
     behavior wins; don't invent a compromise.

4. **Remove every marker and stage.** Ensure no `<<<<<<<`, `=======`, or `>>>>>>>` remains anywhere
   (`git diff --check`). Stage resolved files with `git add`.

5. **Verify before continuing.** Build and run the tests (`pnpm build && pnpm test`, or the project's
   equivalent). A clean tree that fails to build is not resolved. Fix and re-verify.

6. **Continue the operation.** `git rebase --continue` / `git merge --continue` /
   `git cherry-pick --continue`. For a rebase, the next commit may conflict too — return to Step 2.
   Never `--skip` a commit to get past a conflict; that drops the commit's changes entirely.

7. **Report.** When the operation completes: the files resolved, the non-trivial decisions made (which
   intents were reconciled and how), confirmation that build and tests pass, and anything you had to
   ask about. If conflicts are still pending (multi-commit rebase), report progress and continue.

## Anti-patterns

- **Blind `-X theirs` / `accept incoming`** to make the markers disappear — silently drops the other
  side's work.
- **Resolving to compile, not to behave.** Picking whichever combination type-checks without checking
  it's correct.
- **Hand-merging a lockfile.** Always regenerate.
- **`git rebase --skip`** to escape a stubborn conflict — it deletes the commit's changes.
- **Continuing without building.** The conflict you mis-resolved is cheapest to catch now, not in CI.
