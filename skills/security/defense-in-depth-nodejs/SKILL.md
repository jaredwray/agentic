---
name: defense-in-depth-nodejs
description: Harden a Node.js repo against supply-chain compromise one PR at a time — a gh lockdown script for repo settings (PRs required on main, admin-only tags, approval for outside workflow runs), pnpm's 7-day dependency cooldown, SHA-pinned actions via actions-up, Socket Firewall on every CI job, zizmor workflow linting, and staged OIDC npm publishing reviewed in Drydock. Keeps a simple public SECURITY.md and tracks progress in DEFENSE_IN_DEPTH.md. Adapts to what the repo is — npm library, website/app, public or private. Use when asked to harden a repo, improve supply-chain security, lock down GitHub settings, or pin and lint CI. Manual, resumable, one item per PR.
disable-model-invocation: true
user-invocable: true
---

# Defense in Depth (Node.js)

Operation manual for hardening Node.js repos (Keyv, Cacheable, flat-cache, file-entry-cache, and
similar) against supply-chain compromise. One controllable improvement per PR; status tracked in the
target repo's `DEFENSE_IN_DEPTH.md`.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do —
> start with [Workflow](#workflow) Step 1. Only stop where the workflow says to stop (uncommitted
> changes, repo-settings changes, status disagrees with reality) or when a decision genuinely
> requires the user.
>
> **One PR at a time.** Open a PR for one item, drive its CI to green, then stop and wait. Resume
> only when the user says `continue`, `next`, `next defense PR`, or similar.
>
> This skill follows the shared `shipping-conventions` loop and `pr-conventions`; the status-block
> format and reconciliation rules live in `security-status-tracking`.

## Goal and scope

Make compromise require multiple independent failures, and shrink the blast radius of any one
failure: no direct pushes or tags, no long-lived publish credentials, no fresh-off-the-registry
dependencies, no unreviewed workflow changes, and no release that a human didn't approve.

Out of scope: the publish workflow's internals (`release-management-nodejs`), governance boilerplate
(`project-templates`).

## Two files in the target repo

- **`SECURITY.md`** — simple and public: how to report a vulnerability, plus a short "How this
  repository is secured" summary that only lists measures actually in place.
- **`DEFENSE_IN_DEPTH.md`** — the tracked checklist (three checkbox states per
  `security-status-tracking`). The catalog in [reference.md](./reference.md) defines the universe —
  do not invent items.

## Repo profile

Classify the repo before scaffolding; the profile decides which sections apply. Record it in
`DEFENSE_IN_DEPTH.md` (`Profile: npm library · public`).

| Question | Signal | Consequence |
| --- | --- | --- |
| Does it publish to npm? | `package.json` without `"private": true` and with a publishable name/exports (workspaces: any published package) | **npm library** → full catalog. **Website/app** (site, service, docs, internal tool) → skip § 5 npm publishing; everything else applies. |
| Is the repo private? | `gh repo view --json isPrivate` | **Private** → no private-vulnerability-reporting item; plan-gated settings (rulesets, secret scanning) tracked only if available — the lockdown script reports this; skip § 5 unless it actually publishes; SECURITY.md keeps the email contact only. |

## Item priority

Sections in `DEFENSE_IN_DEPTH.md`, in execution order — pick the first unchecked applicable item
top-to-bottom:

1. **§ 1 Security docs** — scaffold/simplify `SECURITY.md`, scaffold `DEFENSE_IN_DEPTH.md`.
2. **§ 2 Repository lockdown** — GitHub settings via [`./scripts/lockdown-repo.sh`](./scripts/lockdown-repo.sh) (settings, not commits — see Step 4).
3. **§ 3 Dependencies (pnpm)** — 7-day cooldown, blocked lifecycle scripts, frozen lockfile.
4. **§ 4 GitHub Actions** — least-privilege permissions, actions-up SHA pinning, Socket Firewall on every job, `check-workflows.yaml` zizmor linting.
5. **§ 5 npm publishing** *(npm libraries only)* — OIDC trusted publishing + staged publishing + Drydock review; npm-side items are `(manual)`.
6. **§ 6 Security tooling** — Aikido on every build; Socket on every dependency change.

## Workflow

Run on the first invocation and on every resume (`continue`, `next`, `next defense PR`):

1. **Sync `main`.** Working tree must be clean (`git status --short`) — stop and report if not.
   `git checkout main && git pull --ff-only origin main`.

2. **Classify.** Determine the repo profile (table above) on first run; afterwards read it from
   `DEFENSE_IN_DEPTH.md` and re-verify only if the repo changed shape.

3. **Audit.**
   - If `DEFENSE_IN_DEPTH.md` is missing, the next item is § 1 by definition. Scaffolding — from
     [reference.md § 1](./reference.md#1-security-docs), dropping sections the profile excludes —
     happens in that item's PR in Step 4, never during the audit, so no scaffold ever sits
     uncommitted when a settings step runs.
   - **Migration (rides the § 1 PR):** if `SECURITY.md` contains an old `Defense in Depth status`
     block, move its state into `DEFENSE_IN_DEPTH.md` (map matching items; list dropped ones in the
     PR body) and cut `SECURITY.md` down to the simple shape. Same for a `Release Management status`
     block — it moves over untouched. The move is one-shot: afterwards status is never read from
     `SECURITY.md` again.
   - Reconcile every checkbox against actual repo state per `security-status-tracking` — for § 2 run
     `lockdown-repo.sh <owner/repo> --check` and mirror its PASS/FAIL lines. Never silently uncheck
     a regression — stop and report it.

4. **Implement the next item.**
   - **File items** (everything except § 2): branch from `main` as
     `chore/defense-<section-key>-<item-key>` (e.g. `chore/defense-pnpm-cooldown`,
     `chore/defense-actions-socket-firewall`), make only the change the item requires, update its
     checkbox to `(PR #<n> pending)`, run the section's local verification
     (`pnpm install --frozen-lockfile`, `pnpm test`/`pnpm build` where they exist), open the PR per
     [PR rules](#pull-request-rules).
   - **§ 2 setting items:** these change GitHub settings, not files — no PR, and they run only
     against a clean working tree. Show the user the `--check` output and ask before applying; then
     run `lockdown-repo.sh <owner/repo>` (or hand the command to a repo admin if `gh` here isn't
     one) and re-run `--check`. Checkbox updates ride the next file PR.
   - **`(manual)` items** (npm-side settings): report what the maintainer needs to do — from
     [reference.md § 5](./reference.md#5-npm-publishing--npm-libraries-only) — and continue past
     them; the maintainer ticks them off.

5. **Drive CI to green.** Diagnose, fix, and push until every check passes. Do not stop on a red PR.

6. **Loop or stop.** If the PR merged while you watched (auto-merge, user merged), return to
   Step 1 immediately. Otherwise stop and report: PR URL and item, CI state, what's next, any
   `(manual)` items waiting on the maintainer, and a literal resume prompt — *"Merge the PR when
   you're ready, then reply `continue` (or `next`) and I'll open the next defense-in-depth PR."* If
   nothing applicable is left unchecked, report the rollout complete with any `(manual)` leftovers.

## Pull request rules

- One item per PR; only one open defense-in-depth PR at a time.
- Title prefixes per `pr-conventions`: `mono - chore: defense - …` (monorepo root/cross-package),
  `<package> - chore: defense - …`, or `root - chore: defense - …` (single-package repo). Example:
  `keyv - chore: defense - pin all GitHub Actions via actions-up`.
- Body: one-sentence Summary naming the section, a Status update line
  (`DEFENSE_IN_DEPTH.md: <item> → (PR #<n> pending)`), Verification checklist of the commands run,
  and `defense-in-depth-nodejs § <n>` as the reference.

---

## Reference

The implementation spec — doc templates, the lockdown script's settings table, the pnpm baseline,
the Socket Firewall step, the `check-workflows.yaml` template, the staged-publishing model, tooling
links — lives in [reference.md](./reference.md). Each `DEFENSE_IN_DEPTH.md` item names its section.
