---
name: security-status-tracking
description: Convention for tracking a hardening rollout's state in a target repo's DEFENSE_IN_DEPTH.md — the status-block format, the Catalog version line, the three checkbox states (not started / PR pending / merged), inline (manual) markers for maintainer-owned items, first-run scaffolding, and reconciliation rules including never silently unchecking a regression. Background discipline referenced by the defense-in-depth-nodejs and release-management-nodejs skills. Use when recording or reconciling security-hardening progress.
user-invocable: true
---

# Security status tracking

How the `defense-in-depth-nodejs` and `release-management-nodejs` skills record rollout state in a
target repo's `DEFENSE_IN_DEPTH.md`. The consumer skill owns the **catalog** (the actual list of
items); this skill owns the **format and reconciliation rules** so both consumers track state
identically.

> Background discipline. The consumer skill decides which items exist and their priority; it calls
> here for how to write and reconcile the status block.
>
> `DEFENSE_IN_DEPTH.md` is the working checklist. The repo's `SECURITY.md` stays simple and
> public-facing (contact info + a summary of measures actually in place) — status checkboxes never
> live there.

## The status block

Each consumer maintains one block in the target repo's `DEFENSE_IN_DEPTH.md` (the
`defense-in-depth-nodejs` sections, a `## Release Management status` block appended below). It is
the source of truth for what's done, pending, deferred, or manual.

- Blocks are **appended** to `DEFENSE_IN_DEPTH.md`, preserving any content above and below.
- Item ordering follows the consumer skill's catalog. **Do not invent items** — the catalog defines
  the universe.
- Each item is in exactly one of three states:
  - `- [ ] <item>` — not started.
  - `- [ ] <item> (PR #<n> pending)` — implementation PR open, not yet merged.
  - `- [x] <item> — PR #<n>` — implemented and merged.
- Items only a human can perform (registry and account settings, hardware keys) carry an inline
  `(manual)` marker at the end of the item text and keep their place in the catalog order — there is
  no separate manual section. The agent reports them and moves on; the maintainer ticks them off.
- Versioned catalogs write a `Catalog: <skill-name>@<semver>` line so you can see what version a
  repo is on. `defense-in-depth-nodejs` puts it in the file header. Missing means unversioned.
  Updating it is an audit change (rides along). The consumer skill owns the version number and when
  to bump it; this skill only owns the line format.
- On first run, the agent **scaffolds** the file from the consumer skill's catalog, including the
  Catalog line (when the consumer versions) and a line linking back to the operation manual that
  owns it, e.g.:

  ```md
  Catalog: defense-in-depth-nodejs@<semver>
  Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.
  ```

  (Release-management's block links to
  `https://github.com/jaredwray/agentic/blob/main/skills/release-ops/release-management-nodejs/SKILL.md`.)

- **Migration:** older repos carry these blocks inside `SECURITY.md`. On first contact, move each
  status block into `DEFENSE_IN_DEPTH.md` unchanged (then let the consumer skill reconcile), and
  leave `SECURITY.md` with only its public-facing content.

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
