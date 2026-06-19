---
name: pr-conventions
description: Shared pull-request conventions for this plugin's workflows — Conventional-Commit type selection, the mono/package/root title-prefix scheme for chore PRs, the standard short PR-body skeleton, and the rule for responding to non-self review comments without pleasantry loops. Background discipline referenced by submit-pr, the dependency-management, release, defense-in-depth, SEO, and project-templates skills. Use when titling or describing a PR, or deciding how to answer a reviewer comment.
user-invocable: true
---

# PR conventions

The PR title, body, and review-response conventions shared across this plugin's shipping workflows.
The detailed PR-authoring discipline lives in the `submit-pr` skill; this file holds the rules the
**automated** ops loops (`dependency-management-*`, `defense-in-depth-nodejs`,
`release-management-nodejs`, `seo`, `project-templates`) reuse so they don't each restate them.

## Conventional Commit type

Pick **one** type — the highest-impact type any commit in the PR forces:

| Type | Use when… | Impact |
|---|---|---|
| `feat` | adds a user-visible feature, option, or public API | 1 (highest) |
| `fix` | fixes a bug — wrong behavior becomes right | 2 |
| `perf` | improves performance, no behavior change | 3 |
| `refactor` | restructures code, no behavior/perf change (touches public API → consider `feat`) | 4 |
| `style` | formatting/lint only, no logic change | 5 |
| `test` | tests only | 6 |
| `docs` | documentation only | 7 |
| `chore` | maintenance: dep bumps, plumbing, scripts, CODEOWNERS | 8 |
| `build` | build system or external deps (bundler, lockfile, Dockerfile) | 9 |
| `ci` | CI config (`.github/workflows/`, release pipelines) | 10 |
| `revert` | reverts a prior commit (body references the reverted SHA) | inherits |

Breaking changes override everything: add `!` before the colon and a `BREAKING CHANGE:` paragraph in
the body Summary. Never use `chore:` to disguise a user-visible change because the diff is small.

## Title format

`<type>(<optional-scope>)<optional-!>: <imperative subject>` — ≤70 chars, imperative mood
(`add`, not `added`), lowercase subject, no trailing period, no issue number (link it in the body).

### Prefix scheme for the automated ops loops

The dependency/defense/release/seo loops prefix the chore type by repo shape so monorepo PRs are
scannable. The middle token (`defense - `, etc.) is set by the consumer skill:

| Scope | Prefix |
|---|---|
| Monorepo root / cross-package change | `mono - chore: ` |
| Specific package (any repo) | `<package name> - chore: ` |
| Single-package repo with no package name | `root - chore: ` |

Examples: `mono - chore: upgrade code quality dependencies`,
`root - chore: defense - set permissions: contents: read default`,
`api - chore: upgrade Prisma dependencies`.

## PR body skeleton

Keep bodies short — a reviewer reads them in 30 seconds. Drop sections that don't apply; keep order.

```md
## Summary
<one or two sentences: what changed and why; lead with the user-visible change>

## Changes
- <one bullet per commit or logical group; strip the type: prefix>

## Verification
- [x] <a check actually run, e.g. `pnpm test` passes>

## Breaking notes
<only when breaking — what changes for consumers, and the migration>
```

Checkboxes are promises: never check a box for something you didn't run. No diff paraphrase (the
reviewer has the diff) — explain intent. No marketing ("massively faster" → "240ms → 80ms").

## Responding to review comments

**Respond to every comment that is not your own about what you did** — each PR comment, review, and
review-thread comment authored by someone else (bots included: CodeQL, Codecov, Gemini, Socket).
Reply inline on review threads; leave a top-level comment for top-level reviews and PR-level bot
comments. State concretely what was done (or why no action is needed) and cite the commit SHA when
applicable. There are two responses to a code-change suggestion and no third "ignore" path:

- **Agree** → make the fix, run the same local checks, push a focused commit, reply naming what
  changed + the SHA, then resolve the thread.
- **Disagree** → do **not** push; reply with the concrete reason (cite `path:line`), and leave the
  thread open for the maintainer.

**Exception — no pleasantry loops.** Do not reply to pure pleasantries or status-echo bot comments
("thanks", "LGTM", "glad I could help") that introduce no new question, finding, or action item.
Replying to non-actionable acknowledgements just keeps the loop going.
