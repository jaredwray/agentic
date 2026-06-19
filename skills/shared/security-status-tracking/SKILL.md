---
name: security-status-tracking
description: Convention for tracking a hardening rollout's state in a target repo's SECURITY.md — the status-block format, the three checkbox states (not started / PR pending / merged), manual-vs-auto items, first-run scaffolding, and reconciliation rules including never silently unchecking a regression. Background discipline referenced by the defense-in-depth-nodejs and release-management-nodejs skills. Use when recording or reconciling security-hardening progress in SECURITY.md.
user-invocable: true
---

# Security status tracking

How the `defense-in-depth-nodejs` and `release-management-nodejs` skills record rollout state in a
target repo's `SECURITY.md`. The consumer skill owns the **catalog** (the actual list of items);
this skill owns the **format and reconciliation rules** so both consumers track state identically.

> Background discipline. The consumer skill decides which items exist and their priority; it calls
> here for how to write and reconcile the status block.

## The status block

Each consumer maintains one block in the target repo's `SECURITY.md` (e.g.
`## Defense in Depth status`, `## Release Management status`). It is the source of truth for what's
done, pending, deferred, or manual.

- The block is **appended** to `SECURITY.md`, preserving any content above and below.
- Item ordering follows the consumer skill's catalog. **Do not invent items** — the catalog defines
  the universe.
- Each item is in exactly one of three states:
  - `- [ ] <item>` — not started.
  - `- [ ] <item> (PR #<n> pending)` — implementation PR open, not yet merged.
  - `- [x] <item> — PR #<n>` — implemented and merged.
- Items the agent **cannot** implement (registry/account settings, hardware keys, VM isolation, etc.)
  live under a `Manual / external (maintainer-owned)` heading inside the same block. The maintainer
  ticks those off.
- On first run, the agent **scaffolds** the block from the consumer skill's catalog, including a line
  linking back to the operation manual that owns it, e.g.:

  ```md
  Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.
  ```

  (Release-management's block links to
  `https://github.com/jaredwray/agentic/blob/main/skills/release-ops/release-management-nodejs/SKILL.md`.)

## Reconciliation rules

On every run (first invocation and each resume), verify the actual repo state against each checkbox
before opening the next PR:

- `- [ ]` where the repo **already has** the change → check it off. Add a brief note (`— verified
  <date>`) if no PR record exists.
- `- [ ] X (PR #<n> pending)` where **PR #n is now merged** → mark `- [x] X — PR #<n>`.
- `- [x]` where the repo state is now **missing** the change → **stop and report the regression.
  Never silently uncheck.**
- `- [x]` where the repo still matches → leave it.

Audit changes ride along in the next item's PR; do not push a standalone reconciliation commit unless
every item is already up to date and the audit itself is the only change.

## Writing the pending state for a new item

When opening a PR for an item, leave its checkbox unchecked and append `(PR #<n> pending)`. If the PR
number isn't known yet, write `(PR pending)` and amend (or push a follow-up) once it's assigned. The
item flips to `- [x] … — PR #<n>` on the next run's reconciliation after merge.
