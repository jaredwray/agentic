---
name: release-management-nodejs
description: Roll out a hardened npm release pipeline — signer policy, signed release intent, npm trusted publishing, verification gates — one improvement per PR across a strict 4-phase rollout, with status tracked in the target repo's DEFENSE_IN_DEPTH.md. Use when asked to harden npm publishing, set up trusted publishing or release signing, or secure the release pipeline for high-impact packages. Manual, resumable, one PR at a time.
disable-model-invocation: true
user-invocable: true
allowed-tools: [Bash, Read, Edit, Write]
---

# Release Management (Node.js)

Operation manual for rolling out a hardened npm release pipeline (signer policy, release intent, trusted publishing, verification gates) on Node.js OSS projects (Keyv, Cacheable, flat-cache, file-entry-cache, and similar). One controllable improvement per PR; status tracked in the target repo's `DEFENSE_IN_DEPTH.md`.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. The first step audits the target repo's `DEFENSE_IN_DEPTH.md` so the agent can pick the next item from the rollout. Only stop to ask the user when the document explicitly says to stop and report (uncommitted changes, the next item is manual-only, `DEFENSE_IN_DEPTH.md` disagrees with reality, a phase transition needs maintainer sign-off) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR for one item, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next release PR`, or similar. Never open a second release-management PR while one is already in flight.
>
> **Phase order is strict.** Phase 1 must be complete before any Phase 2 item begins; Phase 2 before Phase 3; Phase 3 before Phase 4. Within a phase, pick items top-to-bottom from the catalog. Manual / external items are tracked in `DEFENSE_IN_DEPTH.md` so the maintainer can tick them off; the agent never opens a PR for those, but a phase is not "complete" until all items including manual ones are checked.
>
> This skill follows the shared `shipping-conventions` loop and `pr-conventions`; the `DEFENSE_IN_DEPTH.md` status-block format and reconciliation rules live in `security-status-tracking`.

## Scope and summary

**Scope:** npm package releases for high-impact OSS projects such as Keyv, Cacheable, flat-cache, file-entry-cache, and related packages.

**Summary:** use the best of both worlds — GitHub Actions and npm trusted publishing provide build/publish provenance, while a non-GitHub maintainer signature proves human release approval. A release proceeds only when at least one approved maintainer signs the exact release intent. GitHub is the build system, not the human root of trust.

See [§ 1 Release Trust Model](./reference.md#1-release-trust-model) for the underlying model that the rest of the manual implements.

## Status tracking in DEFENSE_IN_DEPTH.md

The target repo's `DEFENSE_IN_DEPTH.md` carries a `Release Management status` block. It is the source of truth for what's done, what's pending, and what was deferred or marked manual. Behavior:

- The block is appended to `DEFENSE_IN_DEPTH.md` (preserving any existing content above and below).
- Item ordering follows the rollout phases below. Do not invent new items — the catalog defines the universe.
- Each item uses one of three states:
  - `- [ ] <item>` — not started.
  - `- [ ] <item> (PR #<n> pending)` — implementation PR open, not yet merged.
  - `- [x] <item> — PR #<n>` — implemented and merged.
- Manual / external items live under their phase with `(manual)` after the description. The maintainer ticks them off; the agent reports them but never PRs them.

Block template (the agent scaffolds this on first run):

```md
## Release Management status

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/release-ops/release-management-nodejs/SKILL.md.

### Phase 1: Baseline hardening
- [ ] CI installs use `pnpm install --frozen-lockfile`
- [ ] `pnpm-workspace.yaml` security baseline added (`minimumReleaseAge`, `minimumReleaseAgeStrict`, `minimumReleaseAgeIgnoreMissingTime`, `blockExoticSubdeps`, `strictDepBuilds`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}`)
- [ ] pnpm 11 pinned via `packageManager` in `package.json`
- [ ] All GitHub Actions pinned to full commit SHAs
- [ ] Every workflow job installs Socket Firewall via SHA-pinned `SocketDev/action` (`firewall-version` pinned)
- [ ] `permissions: contents: read` default on all workflows
- [ ] npm publish tokens removed from GitHub Actions
- [ ] CODEOWNERS added for `.github/workflows/**` and `.release-policy/**`

### Phase 2: Signing policy
- [ ] Release identity created (e.g. `release@jaredwray.com`) (manual)
- [ ] Google Workspace 2SV / security keys enforced for release identity (manual)
- [ ] `.release-policy/required-signers.v1.json` drafted and committed
- [ ] Signer policy signed; `.release-policy/required-signers.v1.sigstore.json` committed
- [ ] `scripts/verify-one-maintainer-signature.sh` added
- [ ] `scripts/verify-release-intent.sh` added
- [ ] `scripts/verify-actions-pinned.sh` added
- [ ] Dry-run workflow added (verifies a sample release intent without publishing)

### Phase 3: Pilot package
- [ ] Pilot package selected (record name here)
- [ ] `npm-publish` protected environment created on GitHub (manual)
- [ ] npm trusted publisher configured for the pilot (provider GitHub Actions, exact repo, workflow `publish.yml`, environment `npm-publish`) (manual)
- [ ] Package `repository.url` confirmed accurate
- [ ] `.github/workflows/publish.yml` added per the [reference.md § 14](./reference.md#14-github-actions-publish-workflow) template (all action refs replaced with full commit SHAs; `firewall-version` pinned)
- [ ] Signed release intent prepared for the pilot's first release (`.release/<pkg>/<version>/release-intent.json` + approved maintainer signature bundle)
- [ ] Test release run on a prerelease tag (`<pkg>@x.y.z-test.0`)
- [ ] npm provenance verified on the published prerelease
- [ ] Negative test: signer gate fails when signature is removed
- [ ] Negative test: signer gate fails when manifest is modified after signing
- [ ] Negative test: signer gate fails when signer is not allowlisted
- [ ] After trusted publisher works: npm package setting **Require two-factor authentication and disallow tokens** applied (manual)
- [ ] Pre-existing npm publish tokens for the pilot revoked (manual)

### Phase 4: Expand
- [ ] All high-download packages onboarded (record each below as `- [ ] <pkg> onboarded — PR #<n>`)
- [ ] Consumer verification statement added to `SECURITY.md` per [reference.md § 18](./reference.md#18-consumer-verification-statement)
- [ ] Release verification instructions mirrored to `jaredwray.com`
- [ ] Release signature bundles and SHA256 digests mirrored to `jaredwray.com`
- [ ] (Optional) Custom deployment protection rule added to the `npm-publish` environment
- [ ] Socket Gateway evaluated in report-only mode
```

## Phase priority

Phase 1 → 2 → 3 → 4 in strict order. A phase is complete only when every item — auto and manual — is checked. Within a phase, the agent picks the first unchecked auto-implementable item top-to-bottom.

**Phase 1 — Baseline hardening.** Pure CI and config hygiene. All auto-implementable. Several items overlap with the `defense-in-depth-nodejs` skill § 4–5; that's intentional. Both blocks track the same change.

**Phase 2 — Signing policy.** Mostly auto (policy file, signed policy bundle, verification scripts, dry-run workflow). Two manual items at the top: creating the release identity and enforcing 2SV. The agent records these and stops if it reaches them without them being checked.

**Phase 3 — Pilot package.** Mixed. Auto items: package selection (recorded in `DEFENSE_IN_DEPTH.md`), publish workflow, signed release intent, test release, negative tests. Manual items: GitHub environment creation, npm trusted publisher config, post-rollout npm 2FA setting and token revocation.

**Phase 4 — Expand.** Mostly auto (onboarding each remaining package follows the Phase 3 pattern). Some items are external (mirror docs to `jaredwray.com`, evaluate Socket Gateway).

**Phase transition gate.** When the agent finishes the last auto item in a phase but manual items remain unchecked, it stops with a final report listing the manual items and waits for the user. The user must either tick the manual items off (or say "skip manual for now, continue") before the agent advances to the next phase.

## Workflow

Run these steps on the **first** invocation, and again on **every resume** when the user says `continue`, `next`, `next release PR`, or similar.

1. **Sync `main`.** Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`.

2. **Audit `DEFENSE_IN_DEPTH.md`.**
   - If `DEFENSE_IN_DEPTH.md` does not exist, scaffold it from the [Status tracking](#status-tracking-in-defense_in_depthmd) template and include a link to this operation manual.
   - If the `Release Management status` block is missing, append it to `DEFENSE_IN_DEPTH.md` without modifying existing content above or below.
   - For each item, verify that the actual repo state matches the checkbox state using the [Reference](#reference) sections. Reconciliation rules:
     - `[ ]` items where the repo already has the change → check them off and add a brief note (e.g. `— verified <date>` if there is no PR record).
     - `[ ] X (PR #<n> pending)` where PR #n is now merged → mark `[x] X — PR #<n>`.
     - `[x]` items where the repo state is missing the change → **stop and report the regression**; do not silently uncheck.
     - `[x]` items where the repo state still matches → leave alone.
   - Audit changes ride along in the next item's PR; do not push a standalone reconciliation commit unless every item is already up to date and the audit itself is the only change.

3. **Determine the active phase.**
   - Walk phases 1 → 2 → 3 → 4 in order.
   - The active phase is the first phase with any unchecked item (auto or manual).
   - If the active phase has unchecked auto items, go to Step 4 with the first unchecked auto item.
   - If the active phase has only manual items left, stop and report: list the manual items and ask the user to tick them off (or say "skip manual for now, continue") before proceeding.
   - If every phase is fully checked, stop and report — the rollout is complete.

4. **Pick the next item and open the PR.**
   - Branch from latest `main`. Naming: `chore/release-<phase>-<item-key>` (e.g. `chore/release-p1-frozen-lockfile`, `chore/release-p2-signer-policy`, `chore/release-p3-publish-workflow`, `chore/release-p3-pilot-intent`).
   - Implement the item per the matching section in [Reference](#reference). Touch only what the item requires.
   - Update the `Release Management status` block: leave the checkbox unchecked, append `(PR #<n> pending)`. If the PR number isn't known yet, write `(PR pending)` and push a follow-up commit with the real PR number after opening.
   - Run any local verification the section spec calls for (e.g. `cosign verify-blob` for signer-policy items, `git tag -v` for release-intent items, dry-run the verification scripts on a sample release).
   - Open the PR — title and body per [Pull request rules](#pull-request-rules).

5. **Drive CI to green.** Watch CI on the PR. If any check fails, diagnose, fix, and push until every check is green. **Do not stop on a red PR.**

6. **Check for already-merged.** Before stopping, check whether the PR was merged during CI (auto-merge, user merged manually). If merged, return to Step 1 immediately — do not wait, do not prompt.

7. **Stop and wait.** Report:
   - PR URL and the implemented item (with phase and item identifier).
   - Confirmation that CI is green.
   - Items still pending in the current phase, including any manual items the maintainer needs to tick off.
   - Whether reaching the next phase requires manual items to be checked first.
   - **A literal prompt to resume**, e.g. *"Merge the PR when you're ready, then reply `continue` (or `next`) and I'll open the next release-management PR."*

   Then wait. Do not open another PR. The workflow resumes only when the user says `continue`, `next`, `next release PR`, or similar — at which point return to Step 1.

## Pull request rules

- **One item per PR.** Don't bundle multiple unchecked items, even within the same phase. Negative tests in Phase 3 are individual items.
- **Only one open release-management PR at a time.** If a previous one is still open, drive its CI to green if needed, then stop and wait.
- Every PR uses a unique branch from latest `main`. Branch naming: `chore/release-p<phase>-<item-key>`.

### Title prefixes

Match the prefix scheme in `pr-conventions`:

| Scope                                       | Prefix                          |
| ------------------------------------------- | ------------------------------- |
| Monorepo root                               | `mono - chore: release - `      |
| Cross-package monorepo change               | `mono - chore: release - `      |
| Specific package (any repo)                 | `<package> - chore: release - ` |
| Single-package repo with no package name    | `root - chore: release - `      |

Examples:

- `mono - chore: release - add pnpm-workspace.yaml security baseline`
- `root - chore: release - add signed required-signers.v1.json`
- `keyv - chore: release - add publish.yml with verification gate`
- `keyv - chore: release - prepare release intent for keyv@5.0.0-test.0`

### PR body

```
## Summary
<one sentence: which phase/item this implements>

## Status update
- `DEFENSE_IN_DEPTH.md` updated: `<item>` → `(PR #<n> pending)`

## Verification
- [x] <verification command from the reference section>
- [x] `pnpm install --frozen-lockfile` succeeds
- [x] Any negative tests run locally (Phase 3 onward)

## Reference
release-management-nodejs § <section number>
```

When the user merges, the next `continue` invocation reconciles the audit in Step 2 and marks the item `[x]` in `DEFENSE_IN_DEPTH.md` as part of the next PR.

### Failure and incident handling during rollout

If verification fails during Step 4 or 5, see [reference.md § 20](./reference.md#20-failure-and-incident-handling). Do not bypass a failing signer gate or workflow-hash check; regenerate the release intent and re-sign.

---

## Reference

The trust model, release modes, file layout, signer policy, intent manifest, verification scripts,
publish workflow, and incident handling live in [reference.md](./reference.md). Pull it in at the
rollout item you are implementing — each `DEFENSE_IN_DEPTH.md` item names its section number.
