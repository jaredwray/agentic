---
name: defense-in-depth-nodejs
description: Harden a Node.js repo against supply-chain compromise one PR at a time — pnpm's 7-day dependency cooldown, SHA-pinned actions via actions-up, Socket Firewall on every CI job, zizmor workflow linting, Aikido Safe Chain on Codespaces and Cursor Cloud Agents, staged OIDC npm publishing reviewed in Drydock, then a gh lockdown script last for repo settings (PRs required on main, admin-only tags, approval for outside workflow runs). Keeps a simple public SECURITY.md and tracks progress in DEFENSE_IN_DEPTH.md. Adapts to what the repo is — npm library, website/app, public or private. Use when asked to harden a repo, improve supply-chain security, lock down GitHub settings, or pin and lint CI. Manual, resumable, one item per PR.
disable-model-invocation: true
user-invocable: true
---

# Defense in Depth (Node.js)

Operation manual for hardening Node.js repos (Keyv, Cacheable, flat-cache, file-entry-cache, and
similar) against supply-chain compromise. One controllable improvement per PR; status tracked in the
target repo's `DEFENSE_IN_DEPTH.md`.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do —
> start with [Workflow](#workflow) Step 1. Only stop where the workflow says to stop (uncommitted
> changes, CODEOWNERS owners not yet named, status disagrees with reality, applying GitHub settings)
> or when a decision genuinely requires the user.
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

Out of scope: signer policy, release-intent, and verification-gate internals
(`release-management-nodejs`); governance boilerplate (`project-templates`).

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
| Is the repo private? | `gh repo view --json isPrivate` | **Private** → the lockdown script skips private-vulnerability-reporting; plan-gated settings (rulesets, secret scanning) tracked only if available — the script reports this; skip § 5 unless it actually publishes; SECURITY.md keeps the email contact only. |

## Item priority

Sections in `DEFENSE_IN_DEPTH.md`, in execution order — pick the first unchecked applicable item
top-to-bottom. **`lockdown-repo.sh` apply is always last.** Never run it in apply mode until every
preceding auto-implementable applicable item is checked. `(manual)` items do not block it.
`--check` during audit does not change that.

1. **§ 1 Security docs** — scaffold/simplify `SECURITY.md`, scaffold `DEFENSE_IN_DEPTH.md`.
2. **§ 2 CODEOWNERS and cloud bootstrap** — `.github/CODEOWNERS` (file PR); Aikido Safe Chain on
   Codespaces and Cursor Cloud Agents (file PR; skip without `pnpm-lock.yaml`).
3. **§ 3 Dependencies (pnpm)** — 7-day cooldown with no first-party excludes, blocked lifecycle
   scripts, frozen lockfile.
4. **§ 4 GitHub Actions** — least-privilege permissions, actions-up SHA pinning, Socket Firewall on
   every job with `sfw`-prefixed installs, `check-workflows.yaml` zizmor linting.
5. **§ 5 npm publishing** *(npm libraries only)* — `release.yaml` stages with
   `pnpm stage publish ./packed/*.tgz --no-git-checks`; npmjs.com / Drydock / 2FA settings are
   `(manual)`.
6. **§ 6 Security tooling** — Aikido on every build; Socket on every dependency change.
7. **§ 7 Repository lockdown** — GitHub settings via
   [`./scripts/lockdown-repo.sh`](./scripts/lockdown-repo.sh). Apply after every earlier auto item.
   Account/UI leftovers are `(manual)`.

## Workflow

Run on the first invocation and on every resume (`continue`, `next`, `next defense PR`):

1. **Sync `main`.** Working tree must be clean (`git status --short`) — stop and report if not.
   `git checkout main && git pull --ff-only origin main`.

2. **Classify.** Determine the repo profile (table above) on first run; afterwards read it from
   `DEFENSE_IN_DEPTH.md` and re-verify only if the repo changed shape.

3. **Audit.**
   - If `DEFENSE_IN_DEPTH.md` is missing, the next item is § 1. Scaffolding — from
     [reference.md § 1](./reference.md#1-security-docs), dropping sections the profile excludes —
     happens in that item's PR in Step 4, never during the audit.
   - If the defense-in-depth sections don't match the current catalog, replace those sections with
     the catalog in [reference.md § 1](./reference.md#1-security-docs) (leave any
     `Release Management status` block untouched), then reconcile against repo state. Do not map
     old checkboxes.
   - **Migration (rides the § 1 PR):** if `SECURITY.md` contains an old `Defense in Depth status`
     block, move its state into `DEFENSE_IN_DEPTH.md` (map matching items; list dropped ones in the
     PR body) and cut `SECURITY.md` down to the simple shape. Same for a `Release Management status`
     block — it moves over untouched. The move is one-shot: afterwards status is never read from
     `SECURITY.md` again.
   - Reconcile every checkbox against actual repo state per `security-status-tracking`. For § 7 run
     `lockdown-repo.sh <owner/repo> --check` with `--required-checks` and `--allowed-actions` taken
     from the repo's workflows per [reference.md § 7](./reference.md#7-repository-lockdown) (audit
     only — never apply here). A clean `--check` means the lockdown item is done; a FAIL does not
     make § 7 the next item while earlier auto items remain.
     Skip the Safe Chain item when `pnpm-lock.yaml` is absent. Never silently uncheck a regression —
     stop and report it.

4. **Implement the next item.**
   - **File items** (§ 1–6): branch from `main` as `chore/defense-<section-key>-<item-key>` (e.g.
     `chore/defense-pnpm-cooldown`, `chore/defense-actions-socket-firewall`), make only the change
     the item requires, update its checkbox to `(PR #<n> pending)`, run the section's local
     verification (`sfw pnpm install --frozen-lockfile`, `pnpm test`/`pnpm build` where they exist),
     open the PR per [PR rules](#pull-request-rules). Specs live in [reference.md](./reference.md)
     for that section.
     - CODEOWNERS: copy the template from
       [reference.md § 2](./reference.md#2-codeowners-and-cloud-bootstrap). **Stop and ask who the
       owners are** (`@user` and/or `@org/team`) before writing the file; substitute `{{OWNERS}}`.
       Never hardcode a username and never guess from the repo owner login. If the user already
       named owners in this conversation, use those and do not re-ask.
     - Safe Chain: copy
       [`./scripts/setup-cloud-environment.sh`](./scripts/setup-cloud-environment.sh) and the files
       in `templates/` per [reference.md § 2](./reference.md#2-codeowners-and-cloud-bootstrap)
       (merge existing `.devcontainer` / `.cursor` config; never overwrite it). Skip when
       `pnpm-lock.yaml` is absent. Branch `chore/defense-safe-chain-cloud`. A leftover PMG /
       VM-egress line is dropped in that PR.
     - Release workflow (npm libraries): copy `.github/workflows/release.yaml` from
       [reference.md § 5](./reference.md#5-npm-publishing--npm-libraries-only). If a publish
       workflow already exists, switch it to pack +
       `pnpm stage publish ./packed/*.tgz --no-git-checks` rather than replacing a custom pipeline.
       Branch `chore/defense-release-stage-publish`.
   - **`(manual)` items:** report what the maintainer needs to do — from the matching reference
     section — and continue past them; the maintainer ticks them off.
   - **§ 7 lockdown (always last):** do not pick this item while any earlier auto-implementable
     applicable item is unchecked. `(manual)` leftovers do not block it. Working tree must be clean.
     Show `--check` with `--required-checks` and `--allowed-actions` and ask before applying; then
     run `lockdown-repo.sh <owner/repo>` with those flags taken from the repo's workflows per
     [reference.md § 7](./reference.md#7-repository-lockdown) (or hand the command to a repo admin
     if `gh` here isn't one). Re-run `--check` with the same flags. Record the result in a PR
     that updates `DEFENSE_IN_DEPTH.md` and the `SECURITY.md` summary. The script audits CODEOWNERS
     and requires `require_code_owner_review` on the branch ruleset; it does not write the file.

5. **Drive CI to green.** Diagnose, fix, and push until every check passes. Do not stop on a red PR.

6. **Loop or stop.** If the PR merged while you watched (auto-merge, user merged), return to
   Step 1 immediately. Otherwise stop and report in four lines: PR URL and item; CI state; what's
   next (plus any `(manual)` items waiting on the maintainer); and a literal resume prompt —
   *"Merge the PR when you're ready, then reply `continue` (or `next`) and I'll open the next
   defense-in-depth PR."* If nothing applicable is left unchecked, report the rollout complete with
   any `(manual)` leftovers.

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

The implementation spec — doc templates, CODEOWNERS and Safe Chain files, the pnpm baseline, the
Socket Firewall step, the `check-workflows.yaml` template, the staged-publishing model, the lockdown
script's settings table, tooling links — lives in [reference.md](./reference.md). Each
`DEFENSE_IN_DEPTH.md` item names its section.
