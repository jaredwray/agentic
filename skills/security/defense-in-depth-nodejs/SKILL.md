---
name: defense-in-depth-nodejs
description: Harden a high-download npm package against supply-chain compromise one PR at a time — pnpm 11 controls (minimumReleaseAge, allowBuilds), GitHub Actions hardening (read-only permissions, SHA-pinned actions, CODEOWNERS), dependency policy, security tooling, and SECURITY.md transparency — tracked in the target repo's SECURITY.md. Use when asked to harden a repo, improve supply-chain security, or pin and lock down CI. Manual, resumable, one item per PR.
disable-model-invocation: true
user-invocable: true
---

# Defense in Depth (Node.js)

Operation manual for hardening high-download npm packages and adjacent OSS projects (Keyv, Cacheable, flat-cache, file-entry-cache, and similar) against supply-chain compromise. One controllable improvement per PR; status tracked in the target repo's `SECURITY.md`.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. The first step audits the target repo's `SECURITY.md` so the agent can pick the next item from the catalog. Only stop to ask the user when the document explicitly says to stop and report (uncommitted changes, the next item is manual-only, `SECURITY.md` disagrees with reality) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR for one item, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next defense PR`, or similar. Never open a second defense-in-depth PR while one is already in flight.
>
> **Track status in `SECURITY.md` in the target repo.** Every item from the [Reference](#reference) catalog maps to a checkbox in the `Defense in Depth status` block. Check an item off only after the PR that implements it is merged. Manual / external items are tracked in the same block so the maintainer can tick them off; the agent never opens a PR for those.
>
> This skill follows the shared `shipping-conventions` loop and `pr-conventions`; the `SECURITY.md` status-block format and reconciliation rules live in `security-status-tracking`.

## Scope and goal

**Scope:** high-download npm packages and related OSS projects such as Keyv, Cacheable, flat-cache, file-entry-cache, and adjacent repos.

**Goal:** make compromise require multiple independent failures, reduce the blast radius of any one failure, and create public evidence when a release does not match the expected process.

## Operating Principles

- **No single system is the root of trust.** GitHub can provide build provenance, npm can provide registry integrity, and Sigstore/Cosign can provide owner approval, but no single layer is treated as sufficient.
- **Human release approval is separate from GitHub.** A release may be built by GitHub Actions, but maintainer approval must come from an approved non-GitHub identity, such as `release@jaredwray.com` via Google OIDC or a pinned hardware/KMS release key.
- **Every install is treated as potential code execution.** Dependency lifecycle scripts, transitive dependencies, exotic dependency sources, and fresh package versions are all controlled by policy.
- **CI is untrusted until constrained.** GitHub Actions must run with read-only defaults, pinned actions, minimal permissions, no release secrets in PR jobs, and isolated publish authority.
- **Release authority is explicit and auditable.** Every release must have a signed intent, a reproducible install policy, a protected publish path, provenance where supported, and verification instructions for consumers.
- **Blast radius is intentionally small.** Workstations, VMs, credentials, package ownership, CI permissions, and security tools are separated by company and, where practical, by major project family.

## Status tracking in SECURITY.md

The target repo's `SECURITY.md` carries a `Defense in Depth status` block. It is the source of truth for what's done, what's pending, and what was deferred or marked manual. When this manual is run against a repo:

- The block is appended to `SECURITY.md` (preserving any existing content above and below).
- Item ordering follows this document's catalog. Do not invent new items — the catalog defines the universe.
- Each item uses one of three states:
  - `- [ ] <item>` — not started.
  - `- [ ] <item> (PR #<n> pending)` — implementation PR open, not yet merged.
  - `- [x] <item> — PR #<n>` — implemented and merged.
- Items the agent cannot implement (npm.com settings, hardware keys, VM isolation, etc.) live under the `Manual / external` heading inside the same block. The maintainer ticks them off.

Block template (the agent scaffolds this on first run; section list mirrors the [Reference](#reference)):

```md
## Defense in Depth status

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

### 3. Dependency Policy
- [ ] Committed lockfile present
- [ ] All GitHub Actions installs use `pnpm install --frozen-lockfile`
- [ ] CI blocks if the lockfile would be modified
- [ ] Any dependency-update tooling in use runs in controlled-PR mode (never auto-merge)
- [ ] New direct dependencies require human review
- [ ] High-risk dependencies (install scripts, native builds, exotic sources, recent ownership changes) require additional review
- [ ] Direct dependencies use narrower version ranges (`~` over `^` where reasonable; exact versions for high-risk tooling)

### 4. pnpm 11 Supply Chain Controls
- [ ] `packageManager: pnpm@11.x` pinned in `package.json`
- [ ] `minimumReleaseAge: 10080` set in `pnpm-workspace.yaml`
- [ ] `minimumReleaseAgeStrict: true` set
- [ ] `minimumReleaseAgeIgnoreMissingTime: false` set
- [ ] `blockExoticSubdeps: true` set
- [ ] `strictDepBuilds: true` set
- [ ] `dangerouslyAllowAllBuilds: false` confirmed
- [ ] `allowBuilds: {}` baseline set
- [ ] Approved build scripts maintained as code-reviewed policy
- [ ] `pnpm approve-builds` only used during dependency review, never automatically in CI

### 5. GitHub Actions Hardening
- [ ] Default `permissions: contents: read` on every workflow
- [ ] `id-token: write` only on the final publish job
- [ ] No npm tokens stored in GitHub Actions secrets
- [ ] All third-party actions pinned to a full commit SHA
- [ ] CODEOWNERS in place, listing the maintainer and a shared security contact
- [ ] No `pull_request_target` for workflows that check out or execute untrusted PR code
- [ ] Caches not shared across trust boundaries
- [ ] Package-manager caching disabled in release builds
- [ ] No self-hosted runners on public PR workflows (or just-in-time/ephemeral only)
- [ ] GitHub Actions blocked from creating or approving PRs unless explicitly needed
- [ ] Workflow/security scanner runs on every PR touching CI, manifests, lockfiles, release scripts, or security policy

### 8. Security Tooling and Detection
- [ ] Aikido runs on every build
- [ ] Socket.dev integrated as a second detection layer
- [ ] Socket Gateway in report-only mode (and evaluated for blocking)
- [ ] `deepsec` runs on PRs touching release/dep/CI/auth/crypto/package paths
- [ ] Secret scanning enabled on repo and CI artifacts
- [ ] SBOMs generated for releases
- [ ] Monitoring on npm package versions, dist-tags, and package settings
- [ ] Monitoring on GitHub audit events for workflow / tag / secret / environment changes

### 9. Public Transparency
- [ ] Release policy documented in `SECURITY.md`
- [ ] Approved signer identities and key fingerprints published (here and/or on `jaredwray.com`)
- [ ] Release verification instructions published
- [ ] Per-release `release-intent.json` + signature bundle published
- [ ] Final tarball signature bundles + SHA256 digests published as release assets
- [ ] Statement that releases without owner approval are suspicious

### 10. Incident Response
- [ ] Host-compromise procedure documented (rotate, purge caches, deprecate)
- [ ] Credential rotation list documented (npm, GitHub, Google, cloud, SSH, registry, CI)
- [ ] Cache purge procedure documented for confirmed malicious versions
- [ ] Version deprecation procedure documented
- [ ] Incident-notice template documented
- [ ] VM rebuild trigger documented
- [ ] Quarterly release-compromise tabletop scheduled

### Manual / external (maintainer-owned)
- [ ] (1) Phishing-resistant 2FA on npm, GitHub, Google Workspace, email, password manager
- [ ] (1) Hardware security keys / passkeys preferred over SMS/TOTP
- [ ] (1) Dedicated release identity created (e.g. `release@jaredwray.com`)
- [ ] (1) Google Workspace 2SV / security keys enforced for release identity
- [ ] (1) Recovery codes stored offline, recovery procedure documented
- [ ] (1) Inactive npm collaborators / GitHub maintainers removed quarterly
- [ ] (1) npm package setting **Require two-factor authentication and disallow tokens** applied
- [ ] (1) Unused npm automation tokens revoked
- [ ] (2) Isolated coding VMs between companies / project families
- [ ] (2) Release VM separated from general development
- [ ] (2) No shared browser / npm / GitHub / cloud sessions across VMs
- [ ] (2) Release signing keys kept out of normal dev shells
- [ ] (2) No random global npm packages on the release VM
- [ ] (2) Release VM network and credential access restricted
- [ ] (2) VMs rebuilt or rotated after suspicious dependency installs
- [ ] (7) npm org/package ownership intentional; broad owner lists avoided
- [ ] (7) Trusted publishing configured only on hardened release workflows
- [ ] (7) `repository.url` accurate so npm provenance maps to the expected repo
- [ ] (7) Trusted publisher settings audited regularly
```

## Item priority

The agent picks the highest-priority section with unchecked auto-implementable items, then the first unchecked item top-to-bottom inside that section.

**Auto-implementable (the agent opens PRs):**

1. **Section 4 — pnpm 11 Supply Chain Controls** — `pnpm-workspace.yaml` settings, `packageManager` pin, `allowBuilds` baseline, lifecycle-script policy.
2. **Section 5 — GitHub Actions Hardening** — workflow `permissions`, `id-token` scope, full-SHA action pinning, CODEOWNERS for workflow files.
3. **Section 3 — Dependency Policy** — committed lockfile, frozen-install in CI, dependency review process, new-dep gating, range tightening.
4. **Section 8 — Security Tooling and Detection** — Aikido/Socket/`deepsec` workflow integrations, secret scanning, SBOM generation, monitoring.
5. **Section 9 — Public Transparency** — `SECURITY.md` content (release policy, signer identities, verification instructions), release asset publishing.
6. **Section 10 — Incident Response** — documented procedures in `SECURITY.md`.

**Manual / external (the agent records but does not implement):**

- **Section 1 — Maintainer Identity and Account Security**
- **Section 2 — Device, VM, and Workspace Isolation**
- **Section 7 — npm Package Settings** (npm.com configuration; agent can verify state but cannot change it)

**Out of scope here:**

- **Section 6 — Release Management** — covered by the `release-management-nodejs` skill. Run it for release pipeline work; the SECURITY.md block for release work lives there.

## Workflow

Run these steps on the **first** invocation, and again on **every resume** when the user says `continue`, `next`, `next defense PR`, or similar.

1. **Sync `main`.** Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`.

2. **Audit `SECURITY.md`.**
   - If `SECURITY.md` does not exist, scaffold it from the [Status tracking](#status-tracking-in-securitymd) template and include a link to this operation manual.
   - If the `Defense in Depth status` block is missing, append it to `SECURITY.md` without modifying existing content above or below.
   - For each item in the block, verify that the actual repo state matches the checkbox state, using the [Reference](#reference) for what the implementation looks like. Reconciliation rules:
     - `[ ]` items where the repo already has the change → check them off and add a brief note (e.g. `— verified <date>` instead of a PR number if there is no record of which PR implemented it).
     - `[ ] X (PR #<n> pending)` where PR #n is now merged → mark `[x] X — PR #<n>`.
     - `[x]` items where the repo state is missing the change → **stop and report the regression**; do not silently uncheck.
     - `[x]` items where the repo state still matches → leave alone.
   - Audit changes are committed as part of the next item's PR; do not push a standalone reconciliation commit unless every item is up to date and the only change is the audit itself.

3. **Pick the next item.** Walk [Item priority](#item-priority) in order and pick the first unchecked auto-implementable item. If no auto-implementable items remain, list every still-unchecked manual item and stop with a final summary — do not open a PR.

4. **Open the PR.**
   - Branch from latest `main`. Naming: `chore/defense-<section-key>-<item-key>` (e.g. `chore/defense-pnpm-min-release-age`, `chore/defense-actions-default-perms`, `chore/defense-deps-frozen-lockfile-ci`).
   - Implement the item per the matching section in [Reference](#reference). Touch only what the item requires — no opportunistic refactors.
   - Update the `Defense in Depth status` block: leave the checkbox unchecked, append `(PR #<n> pending)`. If the PR number is not known yet, write `(PR pending)` and amend the commit after the PR is opened, or push a follow-up commit with the real PR number.
   - Run any local verification the section spec calls for (e.g. `pnpm install --frozen-lockfile` should succeed; `pnpm test`/`pnpm build` should pass if they exist).
   - Open the PR — title and body per [Pull request rules](#pull-request-rules).

5. **Drive CI to green.** Watch CI on the PR. If any check fails, diagnose, fix, and push until every check is green. **Do not stop on a red PR.**

6. **Check for already-merged.** Before stopping, check whether the PR was merged during CI (auto-merge, user merged manually). If merged, return to Step 1 immediately — do not wait, do not prompt.

7. **Stop and wait.** Report:
   - PR URL and the implemented item (with section number from the catalog).
   - Confirmation that CI is green.
   - Items still pending in the current section and what comes next in the priority order.
   - **A literal prompt to resume**, e.g. *"Merge the PR when you're ready, then reply `continue` (or `next`) and I'll open the next defense-in-depth PR."*

   Then wait. Do not open another PR. The workflow resumes only when the user says `continue`, `next`, `next defense PR`, or similar — at which point return to Step 1.

## Pull request rules

- **One item per PR.** Don't bundle multiple unchecked items, even within the same section.
- **Only one open defense-in-depth PR at a time.** If a previous one is still open, drive its CI to green if needed, then stop and wait.
- Every PR uses a unique branch from latest `main`. Branch naming: `chore/defense-<section-key>-<item-key>`.

### Title prefixes

Match the prefix scheme in `pr-conventions`:

| Scope                                       | Prefix                          |
| ------------------------------------------- | ------------------------------- |
| Monorepo root                               | `mono - chore: defense - `      |
| Cross-package monorepo change               | `mono - chore: defense - `      |
| Specific package (any repo)                 | `<package> - chore: defense - ` |
| Single-package repo with no package name    | `root - chore: defense - `      |

Examples:

- `mono - chore: defense - pin packageManager to pnpm@11`
- `root - chore: defense - set permissions: contents: read default`
- `keyv - chore: defense - pin all GitHub Actions to full SHAs`

### PR body

Keep PR bodies short:

```
## Summary
<one sentence: which item this implements, with section number>

## Status update
- `SECURITY.md` updated: `<item>` → `(PR #<n> pending)`

## Verification
- [x] <local verification command from the reference section, e.g. `pnpm install --frozen-lockfile`>
- [x] `pnpm test` passes (if applicable)
- [x] `pnpm build` passes (if applicable)

## Reference
defense-in-depth-nodejs § <section number>
```

When the user merges, the next `continue` invocation reconciles the audit in Step 2 and marks the item `[x]` in `SECURITY.md` as part of the next item's PR.

---

## Reference

The remaining sections are the implementation spec for items in the catalog. The agent uses these when it picks an item in Workflow Step 4. Section numbers here match the section identifiers in the `SECURITY.md` block.

## 1. Maintainer Identity and Account Security

- [ ] Use phishing-resistant 2FA for npm, GitHub, Google Workspace, email, and password-manager accounts.
- [ ] Prefer hardware security keys or platform passkeys over SMS/TOTP where supported.
- [ ] Create a dedicated release identity, such as `release@jaredwray.com`, for Sigstore/Cosign keyless approval.
- [ ] Enforce Google Workspace 2SV/security keys for release identities.
- [ ] Store recovery codes offline and document account recovery procedures.
- [ ] Remove inactive npm collaborators and GitHub maintainers quarterly.
- [ ] Require npm package setting: **Require two-factor authentication and disallow tokens** for local-only packages, or after trusted publishing is configured for CI-provenance packages.
- [ ] Revoke unused npm automation tokens.
- [ ] Never store npm publish tokens in GitHub Actions secrets.

## 2. Device, VM, and Workspace Isolation

- [ ] Use isolated coding VMs between companies.
- [ ] Use separate VMs for high-risk or high-download OSS project families where practical.
- [ ] Keep the release VM separate from general development.
- [ ] Do not share browser sessions, npm sessions, GitHub sessions, or cloud credentials across company/project VMs.
- [ ] Keep release signing keys out of normal development shells.
- [ ] Do not install random global npm packages on the release VM.
- [ ] Restrict release VM network and credential access to what release tasks require.
- [ ] Rebuild or rotate VMs after suspicious dependency installs.

## 3. Dependency Policy

- [ ] Move direct dependencies from broad ranges to narrower ranges where reasonable.
  - [ ] Prefer `~` over `^` for runtime dependencies when compatibility risk is low.
  - [ ] Consider exact versions for high-risk release tooling and security-sensitive dependencies.
  - [ ] Keep peer dependency ranges compatible for library consumers; do not over-pin peer dependencies unnecessarily.
- [ ] Require committed lockfiles for every repo.
- [ ] All GitHub Actions installs must use exactly:

  ```bash
  pnpm install --frozen-lockfile
  ```

- [ ] Block CI if the lockfile would be modified.
- [ ] If the repo already uses a dependency-update tool (Renovate, Dependabot, or another), require it to open PRs that go through normal review — never auto-merge. The agent does not add such a tool when one isn't already configured; tool choice is the maintainer's call.
- [ ] Require human review for any new direct dependency.
- [ ] Require additional review for dependencies with install scripts, native builds, binary downloads, exotic sources, or recent ownership changes.

## 4. pnpm 11 Supply Chain Controls

Target `pnpm@11.x` and put pnpm security settings in `pnpm-workspace.yaml`, not scattered across developer-local config.

Recommended baseline:

```yaml
minimumReleaseAge: 10080 # 7 days, in minutes
minimumReleaseAgeStrict: true
minimumReleaseAgeIgnoreMissingTime: false
blockExoticSubdeps: true
strictDepBuilds: true
dangerouslyAllowAllBuilds: false
trustPolicy: no-downgrade

allowBuilds: {}
```

Checklist:

- [ ] Pin the package manager in `package.json`, for example:

  ```json
  {
    "packageManager": "pnpm@11.1.0"
  }
  ```

- [ ] Enforce a seven-day maturity delay with `minimumReleaseAge: 10080`.
- [ ] Set `minimumReleaseAgeStrict: true` so resolution fails instead of falling back to too-new versions.
- [ ] Set `minimumReleaseAgeIgnoreMissingTime: false` so missing registry publish-time metadata fails closed.
- [ ] Explicitly set `blockExoticSubdeps: true` even if it is the default.
- [ ] Use `allowBuilds` in pnpm 11; older settings such as `onlyBuiltDependencies`, `neverBuiltDependencies`, `ignoredBuiltDependencies`, and `ignoreDepScripts` are replaced by `allowBuilds`.
- [ ] Keep `dangerouslyAllowAllBuilds: false`.
- [ ] Treat every new lifecycle script approval as a security exception.
- [ ] Maintain approved build scripts as code-reviewed policy, not one-off developer prompts.
- [ ] Run `pnpm approve-builds` only as part of dependency review, never automatically in CI.

## 5. GitHub Actions Hardening

- [ ] Default all workflows to read-only permissions:

  ```yaml
  permissions:
    contents: read
  ```

- [ ] Give `id-token: write` only to the final publish job.
- [ ] No npm tokens in GitHub Actions.
- [ ] All third-party actions must be pinned to a full commit SHA.
- [ ] Treat tag-pinned or branch-pinned actions as policy violations.
- [ ] Add a `.github/CODEOWNERS` file with a single wildcard rule listing the
  maintainer and a shared security inbox. This is the simplest shape that
  forces a code-owner review on every PR — including PRs that touch
  `.github/workflows/**`, release scripts, signer policy, and the
  package-manager config.

  ```
  *  @maintainer  security@example.com
  ```

  Branch protection on the default branch must enable "Require review from
  Code Owners" for the rule to enforce. Email-style owners only work for
  GitHub accounts with that exact address verified; for a shared security
  contact, list a handle instead (e.g. `@org/security-team`) or a second
  trusted account. Listing a single owner alongside "Require review from
  Code Owners" prevents that owner from merging their own PRs without
  bypassing the policy, so always pair the maintainer with at least one
  other reviewer. Larger repos with distinct ownership domains can scope
  owners by path, but for one- or two-maintainer projects the wildcard
  is enough.
- [ ] Avoid `pull_request_target` for workflows that check out or execute untrusted PR code.
- [ ] Do not share caches across trust boundaries.
- [ ] Disable package-manager caching in release builds.
- [ ] Do not use self-hosted runners for public PR workflows.
- [ ] If self-hosted runners are unavoidable, use just-in-time/ephemeral runners with no resident secrets.
- [ ] Prevent GitHub Actions from creating or approving PRs unless explicitly needed.
- [ ] Run GitHub workflow/security scans on every PR touching CI, package manifests, lockfiles, release scripts, or security policy.

## 6. Release Management

Covered by the `release-management-nodejs` skill. Status for release pipeline work lives in the `Release Management status` block in `SECURITY.md`, not in this manual's block.

## 7. npm Package Settings

- [ ] Use npm org/package ownership intentionally; avoid broad owner lists.
- [ ] Configure trusted publishing only where the release workflow is fully hardened.
- [ ] For packages using trusted publishing, select **Require two-factor authentication and disallow tokens** after confirming the trusted publisher works.
- [ ] For packages not using trusted publishing, publish locally with interactive 2FA only.
- [ ] Audit trusted publisher settings regularly.
- [ ] Keep `repository.url` accurate so npm trusted publishing/provenance checks map to the expected repo.

## 8. Security Tooling and Detection

- [ ] Keep Aikido running on every build.
- [ ] Add Socket.dev as a second detection layer.
- [ ] Evaluate Socket Gateway in report-only mode first; move to default-blocking only after tuning false positives and emergency bypass rules.
- [ ] Run `deepsec` on PRs, especially PRs touching release paths, dependency files, CI, auth, crypto, or package boundaries.
- [ ] Run secret scanning on repos and local/CI artifacts.
- [ ] Generate SBOMs for releases.
- [ ] Monitor npm package versions, dist-tags, and package settings for unexpected changes.
- [ ] Monitor GitHub audit events for workflow edits, tag creation, repo visibility changes, secret changes, and environment-rule changes.

## 9. Public Transparency

- [ ] Publish release policy in `SECURITY.md`.
- [ ] Publish approved signer identities and key fingerprints on `jaredwray.com`.
- [ ] Publish release verification instructions for users.
- [ ] Publish a per-release `release-intent.json` and signature bundle.
- [ ] Publish final tarball signature bundles and SHA256 digests as release assets.
- [ ] State clearly: a release without valid owner approval is suspicious even if it has npm provenance.

## 10. Incident Response

- [ ] Treat any host that installed a known malicious package as compromised.
- [ ] Rotate npm, GitHub, Google, cloud, SSH, package-registry, and CI credentials reachable from the host.
- [ ] Purge private registry and package-manager caches after confirmed malicious versions.
- [ ] Deprecate malicious package versions immediately.
- [ ] Publish an incident notice with affected versions, timeframe, impact, IOCs, and recommended customer actions.
- [ ] Rebuild release and development VMs after serious dependency or credential exposure.
- [ ] Run a quarterly release-compromise tabletop exercise.

## First 30-Day Rollout

A curated subset of the catalog for new repos. Items here are also tracked in `SECURITY.md`; this list exists as a quick-start view of the highest-leverage moves.

- [ ] Move all repos to `pnpm install --frozen-lockfile` in CI.
- [ ] Pin all GitHub Actions to full commit SHAs.
- [ ] Add `permissions: contents: read` defaults to workflows.
- [ ] Move to pnpm 11 and add `minimumReleaseAge: 10080`, `blockExoticSubdeps: true`, and `allowBuilds` policy.
- [ ] Remove npm tokens from GitHub Actions.
- [ ] Create `npm-publish` protected environment.
- [ ] Draft and commit `.release-policy/required-signers.v1.json`.
- [ ] Add one pilot package using signed release intent + trusted publishing.
- [ ] Publish verification docs in `SECURITY.md` and on `jaredwray.com`.

## References

- npm trusted publishing: https://docs.npmjs.com/trusted-publishers/
- npm 2FA package publishing settings: https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/
- npm provenance: https://docs.npmjs.com/generating-provenance-statements/
- npm registry signatures: https://docs.npmjs.com/about-registry-signatures/
- pnpm 11 settings: https://pnpm.io/settings
- pnpm install: https://pnpm.io/cli/install
- pnpm approve-builds: https://pnpm.io/cli/approve-builds
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use
- GitHub environments: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- Sigstore Cosign blob signing: https://docs.sigstore.dev/cosign/signing/signing_with_blobs/
- Sigstore Cosign verification: https://docs.sigstore.dev/cosign/verifying/verify/
- deepsec: https://github.com/vercel-labs/deepsec/
