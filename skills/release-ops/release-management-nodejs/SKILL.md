---
name: release-management-nodejs
description: Roll out a hardened npm release pipeline — signer policy, signed release intent, npm trusted publishing, verification gates — one improvement per PR across a strict 4-phase rollout, with status tracked in the target repo's SECURITY.md. Use when asked to harden npm publishing, set up trusted publishing or release signing, or secure the release pipeline for high-impact packages. Manual, resumable, one PR at a time.
disable-model-invocation: true
user-invocable: true
allowed-tools: [Bash, Read, Edit, Write]
---

# Release Management (Node.js)

Operation manual for rolling out a hardened npm release pipeline (signer policy, release intent, trusted publishing, verification gates) on Node.js OSS projects (Keyv, Cacheable, flat-cache, file-entry-cache, and similar). One controllable improvement per PR; status tracked in the target repo's `SECURITY.md`.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. The first step audits the target repo's `SECURITY.md` so the agent can pick the next item from the rollout. Only stop to ask the user when the document explicitly says to stop and report (uncommitted changes, the next item is manual-only, `SECURITY.md` disagrees with reality, a phase transition needs maintainer sign-off) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR for one item, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next release PR`, or similar. Never open a second release-management PR while one is already in flight.
>
> **Phase order is strict.** Phase 1 must be complete before any Phase 2 item begins; Phase 2 before Phase 3; Phase 3 before Phase 4. Within a phase, pick items top-to-bottom from the catalog. Manual / external items are tracked in `SECURITY.md` so the maintainer can tick them off; the agent never opens a PR for those, but a phase is not "complete" until all items including manual ones are checked.
>
> This skill follows the shared `shipping-conventions` loop and `pr-conventions`; the `SECURITY.md` status-block format and reconciliation rules live in `security-status-tracking`.

## Scope and summary

**Scope:** npm package releases for high-impact OSS projects such as Keyv, Cacheable, flat-cache, file-entry-cache, and related packages.

**Summary:** use the best of both worlds — GitHub Actions and npm trusted publishing provide build/publish provenance, while a non-GitHub maintainer signature proves human release approval. A release proceeds only when at least one approved maintainer signs the exact release intent. GitHub is the build system, not the human root of trust.

See [§ 1 Release Trust Model](#1-release-trust-model) for the underlying model that the rest of the manual implements.

## Status tracking in SECURITY.md

The target repo's `SECURITY.md` carries a `Release Management status` block. It is the source of truth for what's done, what's pending, and what was deferred or marked manual. Behavior:

- The block is appended to `SECURITY.md` (preserving any existing content above and below).
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
- [ ] `.github/workflows/publish.yml` added per the [Reference § 14](#14-github-actions-publish-workflow) template (all action refs replaced with full commit SHAs)
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
- [ ] Consumer verification statement added to `SECURITY.md` per [Reference § 18](#18-consumer-verification-statement)
- [ ] Release verification instructions mirrored to `jaredwray.com`
- [ ] Release signature bundles and SHA256 digests mirrored to `jaredwray.com`
- [ ] (Optional) Custom deployment protection rule added to the `npm-publish` environment
- [ ] Socket Gateway evaluated in report-only mode
- [ ] `deepsec` enabled on PRs touching release / dep / CI / auth / crypto / package paths
```

## Phase priority

Phase 1 → 2 → 3 → 4 in strict order. A phase is complete only when every item — auto and manual — is checked. Within a phase, the agent picks the first unchecked auto-implementable item top-to-bottom.

**Phase 1 — Baseline hardening.** Pure CI and config hygiene. All auto-implementable. Several items overlap with `defense-in-depth-nodejs.md` § 4–5; that's intentional. Both blocks track the same change.

**Phase 2 — Signing policy.** Mostly auto (policy file, signed policy bundle, verification scripts, dry-run workflow). Two manual items at the top: creating the release identity and enforcing 2SV. The agent records these and stops if it reaches them without them being checked.

**Phase 3 — Pilot package.** Mixed. Auto items: package selection (recorded in `SECURITY.md`), publish workflow, signed release intent, test release, negative tests. Manual items: GitHub environment creation, npm trusted publisher config, post-rollout npm 2FA setting and token revocation.

**Phase 4 — Expand.** Mostly auto (onboarding each remaining package follows the Phase 3 pattern). Some items are external (mirror docs to `jaredwray.com`, evaluate Socket Gateway).

**Phase transition gate.** When the agent finishes the last auto item in a phase but manual items remain unchecked, it stops with a final report listing the manual items and waits for the user. The user must either tick the manual items off (or say "skip manual for now, continue") before the agent advances to the next phase.

## Workflow

Run these steps on the **first** invocation, and again on **every resume** when the user says `continue`, `next`, `next release PR`, or similar.

1. **Sync `main`.** Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`.

2. **Audit `SECURITY.md`.**
   - If `SECURITY.md` does not exist, scaffold it from the [Status tracking](#status-tracking-in-securitymd) template and include a link to this operation manual.
   - If the `Release Management status` block is missing, append it to `SECURITY.md` without modifying existing content above or below.
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

Match the style in `dependency-management-node.md`:

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
- `SECURITY.md` updated: `<item>` → `(PR #<n> pending)`

## Verification
- [x] <verification command from the reference section>
- [x] `pnpm install --frozen-lockfile` succeeds
- [x] Any negative tests run locally (Phase 3 onward)

## Reference
release-management-nodejs.md § <section number>
```

When the user merges, the next `continue` invocation reconciles the audit in Step 2 and marks the item `[x]` in `SECURITY.md` as part of the next PR.

### Failure and incident handling during rollout

If verification fails during Step 4 or 5, see [Reference § 20](#20-failure-and-incident-handling). Do not bypass a failing signer gate or workflow-hash check; regenerate the release intent and re-sign.

---

## Reference

The remaining sections are the implementation spec for items in the rollout. Section numbers here are referenced from the `SECURITY.md` block items above.

## 1. Release Trust Model

A valid release should prove four distinct things:

1. **Maintainer approval:** at least one approved maintainer signed the release intent using a non-GitHub identity.
2. **Build provenance:** the package was built and published from the expected GitHub repo, workflow, tag, and protected environment.
3. **Registry integrity:** the tarball served by npm has not been tampered with after publication.
4. **Dependency determinism:** the release used the committed lockfile and `pnpm install --frozen-lockfile`.

This intentionally separates trust roots:

| Layer | Trust root | What it proves | What it does not prove |
|---|---|---|---|
| Maintainer signature | Google OIDC or pinned release key | An approved maintainer authorized this release intent | That GitHub built it correctly |
| Git signed tag | Maintainer git signing key | The release tag was intentionally created | That the CI workflow is safe |
| npm trusted publishing | GitHub Actions OIDC bound to npm | The publish came from the configured workflow/environment | That the GitHub account/workflow was not compromised |
| npm provenance | npm/Sigstore provenance | Where/how the package was built | That the code is benign |
| npm registry signature | npm registry | npm-served package integrity | That the release was approved |
| pnpm frozen lockfile | repo lockfile | No dependency resolution drift during CI | That dependencies are safe |

## 2. Release Invariants

Every package release must satisfy these invariants before `npm publish` runs:

- [ ] The release is triggered by a release tag only.
- [ ] The release tag verifies with `git tag -v`.
- [ ] `.release/<package>/<version>/release-intent.json` exists.
- [ ] `.release/<package>/<version>/signatures/*.sigstore.json` contains at least one valid approved maintainer signature.
- [ ] The approved signature is over the exact `release-intent.json` bytes.
- [ ] The signer identity appears in `.release-policy/required-signers.v1.json`.
- [ ] The signer issuer is an approved non-GitHub issuer, preferably `https://accounts.google.com`.
- [ ] GitHub, GitHub Actions, and CI OIDC identities are rejected as human approval identities.
- [ ] The signer policy itself verifies against the root release identity.
- [ ] The release intent package, version, tag, workflow path, workflow hash, lockfile hash, install policy, and environment all match the current run.
- [ ] The install command is exactly `pnpm install --frozen-lockfile`.
- [ ] Every third-party GitHub Action is pinned to a full commit SHA.
- [ ] `id-token: write` exists only on the publish job.
- [ ] The publish job uses the `npm-publish` protected environment.
- [ ] npm trusted publishing is configured to the exact repo, workflow filename, and environment.
- [ ] No npm publish token is present in GitHub Actions.

## 3. Release Modes

### Mode A: Best-of-Both-Worlds CI Release

Use for packages where npm provenance is valuable and the workflow is hardened.

Required:

- npm trusted publishing configured.
- GitHub Actions publish job with OIDC.
- npm provenance generated automatically by trusted publishing where supported.
- At least one approved maintainer signature over `release-intent.json`.
- Protected `npm-publish` environment.
- Frozen pnpm install.
- Full SHA-pinned actions.

### Mode B: Local-Only Release

Use for packages where CI publish authority is not acceptable.

Required:

- No GitHub Actions publish authority.
- No npm trusted publisher for that package.
- npm package setting: **Require two-factor authentication and disallow tokens**.
- Local release VM only.
- Interactive npm publish with 2FA.
- Detached Cosign signature over the final `.tgz` and release manifest.
- Publish signature bundles on GitHub Releases and `jaredwray.com`.

This document focuses on **Mode A** because it gives npm provenance while preserving non-GitHub human release approval.

## 4. Required File Layout

```text
.release-policy/
  required-signers.v1.json
  required-signers.v1.sigstore.json

.release/
  keyv/
    5.0.0/
      release-intent.json
      signatures/
        release-jaredwray-com.sigstore.json
        maintainer-a-example-com.sigstore.json

.github/
  workflows/
    publish.yml

scripts/
  verify-one-maintainer-signature.sh
  verify-release-intent.sh
  verify-actions-pinned.sh
```

Check in:

- signer policy
- signer policy signature
- release intent
- maintainer signature bundles
- verification scripts
- public release-key fingerprints or public keys if using key-based signing

Do not normally check in:

- final `.tgz` package files
- generated SBOMs
- final tarball signatures
- `dist/` output

Publish final release artifacts as GitHub Release assets and mirror them on `jaredwray.com`.

## 5. Signer Policy

The signer policy says who may approve a release. Do not define approved maintainers inside `release-intent.json`; a repo compromise could silently extend that list. Keep the allowlist separate and signed.

`.release-policy/required-signers.v1.json`:

```json
{
  "schema": "https://jaredwray.com/schemas/npm-release-signers/v1",
  "mode": "any",
  "threshold": 1,
  "allowed_issuers": [
    "https://accounts.google.com"
  ],
  "forbidden_issuers": [
    "https://token.actions.githubusercontent.com",
    "https://github.com/login/oauth"
  ],
  "maintainers": [
    {
      "name": "Jared Wray",
      "identity": "release@jaredwray.com",
      "issuer": "https://accounts.google.com"
    },
    {
      "name": "Maintainer A",
      "identity": "maintainer-a@example.com",
      "issuer": "https://accounts.google.com"
    }
  ]
}
```

Policy:

- [ ] `mode` is `any`.
- [ ] `threshold` is `1`.
- [ ] At least one allowed maintainer must sign.
- [ ] Unknown signers do not count.
- [ ] GitHub issuers do not count.
- [ ] CI identities do not count.
- [ ] The policy file itself must be signed by the root release identity.

Sign the policy:

```bash
cosign sign-blob \
  --bundle .release-policy/required-signers.v1.sigstore.json \
  .release-policy/required-signers.v1.json
```

If using Google keyless signing, the root policy signature should verify against `release@jaredwray.com` and `https://accounts.google.com`.

## 6. Release Intent Manifest

The release intent binds maintainer approval to one package, one version, one tag, one workflow, one lockfile, and one install policy.

`.release/keyv/5.0.0/release-intent.json`:

```json
{
  "schema": "https://jaredwray.com/schemas/npm-release-intent/v1",
  "package": "keyv",
  "version": "5.0.0",
  "tag": "keyv@5.0.0",
  "repository": "jaredwray/keyv",
  "workflow": ".github/workflows/publish.yml",
  "workflow_sha256": "REPLACE_WITH_SHA256",
  "lockfile": "pnpm-lock.yaml",
  "lockfile_sha256": "REPLACE_WITH_SHA256",
  "install_policy": "pnpm install --frozen-lockfile",
  "publish_environment": "npm-publish",
  "trusted_publisher": true,
  "human_approval_policy": "one approved non-GitHub maintainer signature required",
  "created_at": "2026-05-13T00:00:00Z"
}
```

Avoid putting the final commit SHA inside this file if the file itself is committed to the same release commit. That creates a commit-hash recursion problem. Use the signed tag to bind the release commit, and use the release intent to bind the package/version/workflow/lockfile/policy.

## 7. Preparing a Release Intent

Example local preparation script:

```bash
#!/usr/bin/env bash
set -euo pipefail

PKG="${1:?package required}"
VERSION="${2:?version required}"
REPO="jaredwray/${PKG}"
TAG="${PKG}@${VERSION}"
RELEASE_DIR=".release/${PKG}/${VERSION}"

mkdir -p "${RELEASE_DIR}/signatures"

WORKFLOW=".github/workflows/publish.yml"
LOCKFILE="pnpm-lock.yaml"
WORKFLOW_SHA="$(sha256sum "${WORKFLOW}" | awk '{print $1}')"
LOCK_SHA="$(sha256sum "${LOCKFILE}" | awk '{print $1}')"

cat > "${RELEASE_DIR}/release-intent.json" <<JSON
{
  "schema": "https://jaredwray.com/schemas/npm-release-intent/v1",
  "package": "${PKG}",
  "version": "${VERSION}",
  "tag": "${TAG}",
  "repository": "${REPO}",
  "workflow": "${WORKFLOW}",
  "workflow_sha256": "${WORKFLOW_SHA}",
  "lockfile": "${LOCKFILE}",
  "lockfile_sha256": "${LOCK_SHA}",
  "install_policy": "pnpm install --frozen-lockfile",
  "publish_environment": "npm-publish",
  "trusted_publisher": true,
  "human_approval_policy": "one approved non-GitHub maintainer signature required",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
```

## 8. Maintainer Approval Signing

Any approved maintainer may sign the release intent. The signer authenticates locally with the approved identity provider, such as Google OIDC.

```bash
PKG="keyv"
VERSION="5.0.0"
RELEASE_DIR=".release/${PKG}/${VERSION}"
SIGNER_SLUG="release-jaredwray-com"

cosign sign-blob \
  --bundle "${RELEASE_DIR}/signatures/${SIGNER_SLUG}.sigstore.json" \
  "${RELEASE_DIR}/release-intent.json"
```

Expected approval property:

```text
This exact release-intent.json was signed by an approved maintainer identity.
```

Not acceptable:

```text
Signed by GitHub Actions
Signed by a GitHub user OIDC identity
Signed by an unlisted email
Signed by an approved email but over different release intent bytes
```

## 9. Git Tagging

Create a signed release commit and signed tag after checking in release intent and signature bundle.

```bash
git add .release/keyv/5.0.0/release-intent.json \
        .release/keyv/5.0.0/signatures/release-jaredwray-com.sigstore.json

git commit -m "release: approve keyv@5.0.0"
git tag -s keyv@5.0.0 -m "Release keyv@5.0.0"
git tag -v keyv@5.0.0
git push origin main keyv@5.0.0
```

If a package uses a `v5.0.0` tag style instead, update the parser and release-intent schema accordingly. Prefer package-qualified tags in monorepos.

## 10. Verification Script: One Approved Maintainer Signature

`scripts/verify-one-maintainer-signature.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

PKG="${1:?package required}"
VERSION="${2:?version required}"

RELEASE_DIR=".release/${PKG}/${VERSION}"
MANIFEST="${RELEASE_DIR}/release-intent.json"
SIG_DIR="${RELEASE_DIR}/signatures"

POLICY=".release-policy/required-signers.v1.json"
POLICY_BUNDLE=".release-policy/required-signers.v1.sigstore.json"

ROOT_IDENTITY="release@jaredwray.com"
ROOT_ISSUER="https://accounts.google.com"

test -f "${MANIFEST}"
test -d "${SIG_DIR}"
test -f "${POLICY}"
test -f "${POLICY_BUNDLE}"

cosign verify-blob \
  "${POLICY}" \
  --bundle "${POLICY_BUNDLE}" \
  --certificate-identity "${ROOT_IDENTITY}" \
  --certificate-oidc-issuer "${ROOT_ISSUER}"

test "$(jq -r '.mode' "${POLICY}")" = "any"
test "$(jq -r '.threshold' "${POLICY}")" = "1"

VALID_SIGNATURES=0

while IFS= read -r signer; do
  IDENTITY="$(jq -r '.identity' <<< "${signer}")"
  ISSUER="$(jq -r '.issuer' <<< "${signer}")"

  if [ "${ISSUER}" = "https://token.actions.githubusercontent.com" ]; then
    echo "Rejecting GitHub Actions as human approval issuer: ${IDENTITY}" >&2
    continue
  fi

  echo "Checking approved maintainer signature: ${IDENTITY} (${ISSUER})"

  for BUNDLE in "${SIG_DIR}"/*.sigstore.json; do
    [ -e "${BUNDLE}" ] || continue

    if cosign verify-blob \
      "${MANIFEST}" \
      --bundle "${BUNDLE}" \
      --certificate-identity "${IDENTITY}" \
      --certificate-oidc-issuer "${ISSUER}" >/dev/null 2>&1; then

      echo "Valid release approval found from ${IDENTITY}"
      VALID_SIGNATURES=$((VALID_SIGNATURES + 1))
      break
    fi
  done
done < <(jq -c '.maintainers[]' "${POLICY}")

if [ "${VALID_SIGNATURES}" -lt 1 ]; then
  echo "Release blocked: no approved maintainer signature found." >&2
  exit 1
fi

echo "Release approved: ${VALID_SIGNATURES} approved maintainer signature(s) found."
```

Expected behavior:

| Scenario | Result |
|---|---|
| Jared signs with `release@jaredwray.com` via Google | Pass |
| Another approved maintainer signs via Google | Pass |
| Nobody signs | Fail |
| Unknown email signs | Fail |
| GitHub Actions signs | Fail |
| Manifest changes after signing | Fail |
| Signer policy changes without root signature | Fail |

## 11. Verification Script: Release Intent Content

`scripts/verify-release-intent.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

PKG="${1:?package required}"
VERSION="${2:?version required}"
TAG="${GITHUB_REF_NAME:?GITHUB_REF_NAME required}"
RELEASE_DIR=".release/${PKG}/${VERSION}"
MANIFEST="${RELEASE_DIR}/release-intent.json"

test -f "${MANIFEST}"

test "$(jq -r '.package' "${MANIFEST}")" = "${PKG}"
test "$(jq -r '.version' "${MANIFEST}")" = "${VERSION}"
test "$(jq -r '.tag' "${MANIFEST}")" = "${TAG}"
test "$(jq -r '.install_policy' "${MANIFEST}")" = "pnpm install --frozen-lockfile"
test "$(jq -r '.publish_environment' "${MANIFEST}")" = "npm-publish"
test "$(jq -r '.trusted_publisher' "${MANIFEST}")" = "true"

WORKFLOW="$(jq -r '.workflow' "${MANIFEST}")"
LOCKFILE="$(jq -r '.lockfile' "${MANIFEST}")"

ACTUAL_WORKFLOW_SHA="$(sha256sum "${WORKFLOW}" | awk '{print $1}')"
EXPECTED_WORKFLOW_SHA="$(jq -r '.workflow_sha256' "${MANIFEST}")"
test "${ACTUAL_WORKFLOW_SHA}" = "${EXPECTED_WORKFLOW_SHA}"

ACTUAL_LOCK_SHA="$(sha256sum "${LOCKFILE}" | awk '{print $1}')"
EXPECTED_LOCK_SHA="$(jq -r '.lockfile_sha256' "${MANIFEST}")"
test "${ACTUAL_LOCK_SHA}" = "${EXPECTED_LOCK_SHA}"

# Simple grep; replace with a YAML-aware parser if false positives or negatives arise.
if grep -R "pnpm install" .github/workflows | grep -v -- "--frozen-lockfile"; then
  echo "Release blocked: found pnpm install without --frozen-lockfile" >&2
  exit 1
fi

echo "Release intent content verified."
```

## 12. Verification Script: Full SHA-Pinned Actions

`scripts/verify-actions-pinned.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Flags common unpinned action refs. This is intentionally simple; replace with
# a stricter YAML-aware scanner if needed.

BAD=0

while IFS= read -r line; do
  ref="$(sed -E 's/.*uses:[[:space:]]*([^[:space:]]+).*/\1/' <<< "${line}")"

  # Ignore local actions.
  if [[ "${ref}" == ./* ]]; then
    continue
  fi

  # Docker actions can be handled separately if used.
  if [[ "${ref}" == docker://* ]]; then
    echo "Review docker action reference manually: ${ref}" >&2
    BAD=1
    continue
  fi

  # Require owner/repo/path@40-hex-sha.
  if ! [[ "${ref}" =~ @([a-f0-9]{40})$ ]]; then
    echo "Unpinned action reference: ${ref}" >&2
    BAD=1
  fi
done < <(grep -R "uses:" .github/workflows || true)

if [ "${BAD}" -ne 0 ]; then
  echo "Release blocked: all third-party GitHub Actions must be pinned to full commit SHAs." >&2
  exit 1
fi

echo "All third-party GitHub Actions are pinned to full SHAs."
```

## 13. pnpm Workspace Security Baseline

`pnpm-workspace.yaml`:

```yaml
minimumReleaseAge: 10080
minimumReleaseAgeStrict: true
minimumReleaseAgeIgnoreMissingTime: false
blockExoticSubdeps: true
strictDepBuilds: true
dangerouslyAllowAllBuilds: false
trustPolicy: no-downgrade

allowBuilds: {}
```

Notes:

- `minimumReleaseAge: 10080` means seven days (the value is in minutes).
- `strictDepBuilds: true` fails installs when unreviewed dependency build scripts exist.
- `allowBuilds` is the pnpm 11 policy surface for explicitly allowing or disallowing dependency script execution.
- `blockExoticSubdeps: true` prevents transitive dependencies from using untrusted exotic sources.
- `dangerouslyAllowAllBuilds` must remain false.

## 14. GitHub Actions Publish Workflow

This workflow is a template. Replace action refs with full commit SHAs before use.

`.github/workflows/publish.yml`:

```yaml
name: Publish npm package

on:
  push:
    tags:
      - 'keyv@*'
      - 'cacheable@*'
      - 'flat-cache@*'
      - 'file-entry-cache@*'

permissions:
  contents: read

jobs:
  verify-release-approval:
    name: Verify release approval
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      pkg: ${{ steps.resolve.outputs.pkg }}
      version: ${{ steps.resolve.outputs.version }}

    steps:
      - name: Checkout
        uses: actions/checkout@<FULL_COMMIT_SHA>
        with:
          fetch-depth: 0

      - name: Verify signed tag
        run: git tag -v "$GITHUB_REF_NAME"

      - name: Resolve package/version
        id: resolve
        shell: bash
        run: |
          PKG="${GITHUB_REF_NAME%@*}"
          VERSION="${GITHUB_REF_NAME##*@}"
          echo "PKG=$PKG" >> "$GITHUB_ENV"
          echo "VERSION=$VERSION" >> "$GITHUB_ENV"
          echo "pkg=$PKG" >> "$GITHUB_OUTPUT"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"

      - name: Install cosign
        # jq is pre-installed on GitHub-hosted runners; cosign is not.
        uses: sigstore/cosign-installer@<FULL_COMMIT_SHA>

      - name: Verify actions are SHA-pinned
        run: ./scripts/verify-actions-pinned.sh

      - name: Verify one approved maintainer signed release intent
        run: ./scripts/verify-one-maintainer-signature.sh "$PKG" "$VERSION"

      - name: Verify release intent content
        run: ./scripts/verify-release-intent.sh "$PKG" "$VERSION"

  publish:
    name: Publish to npm with provenance
    needs: verify-release-approval
    runs-on: ubuntu-latest
    environment: npm-publish
    env:
      PKG: ${{ needs.verify-release-approval.outputs.pkg }}
      VERSION: ${{ needs.verify-release-approval.outputs.version }}

    permissions:
      contents: read
      id-token: write
      attestations: write

    steps:
      - name: Checkout
        uses: actions/checkout@<FULL_COMMIT_SHA>
        with:
          fetch-depth: 0

      - name: Enable Corepack
        run: corepack enable

      - name: Verify pnpm version
        run: pnpm --version

      - name: Install dependencies from frozen lockfile only
        run: pnpm install --frozen-lockfile

      - name: Test
        run: pnpm --filter "$PKG" test

      - name: Build
        run: pnpm --filter "$PKG" build

      - name: Pack
        run: |
          mkdir -p dist
          pnpm --filter "$PKG" pack --pack-destination "$PWD/dist"
          sha256sum dist/*.tgz > dist/SHA256SUMS

      - name: Publish through npm trusted publishing
        run: pnpm --filter "$PKG" publish --access public --no-git-checks
```

Important release-job rules:

- [ ] No npm token.
- [ ] No dependency cache.
- [ ] No `workflow_dispatch` for unreviewed manual publishing unless separately gated.
- [ ] No third-party action unless pinned to a full SHA.
- [ ] No untrusted PR code in the publish job.
- [ ] No `id-token: write` outside the publish job.
- [ ] No `pull_request_target` release path.

## 15. GitHub Environment: `npm-publish`

Configure a protected environment named `npm-publish`.

Checklist:

- [ ] Required reviewers enabled.
- [ ] Prevent self-review enabled where appropriate.
- [ ] Admin bypass disabled for release packages.
- [ ] Branch/tag restriction limited to release tags.
- [ ] No long-lived npm publish token stored in the environment.
- [ ] Optional: custom deployment protection rule that independently verifies the signer policy and release intent before approving publish.

The custom deployment protection rule is a later hardening step. The first implementation can rely on the workflow verification gate plus protected environment.

## 16. npm Trusted Publishing Configuration

For each package using Mode A:

- [ ] Go to npm package settings.
- [ ] Add trusted publisher.
- [ ] Provider: GitHub Actions.
- [ ] Organization/user: expected GitHub owner.
- [ ] Repository: exact repo.
- [ ] Workflow filename: `publish.yml`.
- [ ] Environment: `npm-publish`.
- [ ] Confirm package `repository.url` points to the same repo.
- [ ] Confirm publish works.
- [ ] Set package publishing access to **Require two-factor authentication and disallow tokens**.
- [ ] Revoke old npm publish tokens.

## 17. What Gets Published

### Checked into git

- `release-intent.json`
- `release-intent` signature bundle from at least one approved maintainer
- signed signer policy
- verification scripts
- release workflow
- pnpm security config

### GitHub Release assets

- final `.tgz` SHA256 digest
- optional detached Cosign signature over `.tgz`
- SBOM
- provenance/attestation references
- release notes

### `jaredwray.com`

- release policy
- approved signer identities
- public key fingerprints if using key-based signatures
- per-release verification instructions
- mirrored release signatures and hashes

## 18. Consumer Verification Statement

Publish language like this in `SECURITY.md`:

```md
A valid release for this package must have:

1. npm provenance from the configured GitHub Actions trusted publisher;
2. a signed release-intent manifest checked into the release tag;
3. at least one approved maintainer signature over that release intent;
4. release install policy of `pnpm install --frozen-lockfile`;
5. a published tarball matching the release metadata.

A package version without a valid maintainer release-intent signature should be treated as suspicious, even if it has npm provenance.
```

## 19. Rollout Plan

The phase order is enforced by the [Workflow](#workflow) and tracked via the `Release Management status` block. The detailed item lists are mirrored in [Status tracking in SECURITY.md](#status-tracking-in-securitymd).

### Phase 1: Baseline hardening

- [ ] Move all CI installs to `pnpm install --frozen-lockfile`.
- [ ] Add `pnpm-workspace.yaml` security baseline.
- [ ] Move to pnpm 11.
- [ ] Pin every GitHub Action to a full commit SHA.
- [ ] Add `permissions: contents: read` to all workflows.
- [ ] Remove npm publish tokens from GitHub Actions.
- [ ] Add CODEOWNERS for workflow and release-policy files.

### Phase 2: Signing policy

- [ ] Create `release@jaredwray.com` or equivalent release identity.
- [ ] Enforce Google Workspace 2SV/security keys.
- [ ] Draft `.release-policy/required-signers.v1.json`.
- [ ] Sign signer policy.
- [ ] Add verification scripts.
- [ ] Add a dry-run workflow that verifies a sample release intent but does not publish.

### Phase 3: Pilot package

- [ ] Pick one package, such as `keyv` or a lower-risk package first.
- [ ] Configure npm trusted publisher to repo/workflow/environment.
- [ ] Create signed release intent.
- [ ] Run release workflow on a test version or prerelease.
- [ ] Verify npm provenance appears.
- [ ] Verify the signer gate fails if the signature is removed.
- [ ] Verify it fails if the manifest is modified after signing.
- [ ] Verify it fails if the signer identity is not allowlisted.

### Phase 4: Expand

- [ ] Roll out to high-download packages.
- [ ] Publish consumer verification docs.
- [ ] Mirror release metadata to `jaredwray.com`.
- [ ] Add optional custom deployment protection rule.
- [ ] Add Socket gateway/report-only testing.
- [ ] Add deepsec PR mode where appropriate.

## 20. Failure and Incident Handling

### If release fails because no maintainer signed

- [ ] Do not bypass.
- [ ] Ask an approved maintainer to sign the exact release intent.
- [ ] Re-run verification.

### If release fails because workflow or lockfile hash changed

- [ ] Treat as expected if there were legitimate changes.
- [ ] Regenerate release intent.
- [ ] Re-sign release intent.
- [ ] Re-tag only after review.

### If npm shows a version without a valid release intent

- [ ] Treat as suspicious.
- [ ] Freeze further publishes.
- [ ] Check npm package maintainers and trusted publisher settings.
- [ ] Check GitHub workflow/tag/audit logs.
- [ ] Deprecate the version if unauthorized.
- [ ] Rotate npm, GitHub, Google, cloud, and CI credentials reachable from release paths.
- [ ] Publish an advisory.

### If GitHub account compromise is suspected

- [ ] Revoke sessions and tokens.
- [ ] Rotate release signing accounts if necessary.
- [ ] Verify all release tags and release intents since last known-good date.
- [ ] Audit workflow file changes.
- [ ] Audit environment protection rule changes.
- [ ] Audit trusted publisher settings on npm.

## 21. Decisions to Finalize

- [ ] Exact signer identity: `release@jaredwray.com` vs personal Google identity.
- [ ] Whether every package uses Mode A or whether some packages stay local-only.
- [ ] Whether final `.tgz` signatures are required for every release or only major/high-risk releases.
- [ ] Whether to use Google keyless only, hardware/KMS key only, or both.
- [ ] Whether to add a GitHub custom deployment protection rule after the initial workflow gate.
- [ ] Whether Socket Gateway becomes blocking by default after report-only tuning.

## 22. References

- npm trusted publishing: https://docs.npmjs.com/trusted-publishers/
- npm provenance: https://docs.npmjs.com/generating-provenance-statements/
- npm package 2FA settings: https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/
- npm registry signatures: https://docs.npmjs.com/about-registry-signatures/
- pnpm settings: https://pnpm.io/settings
- pnpm install: https://pnpm.io/cli/install
- pnpm approve-builds: https://pnpm.io/cli/approve-builds
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use
- GitHub environments: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- GitHub custom deployment protection rules: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/create-custom-protection-rules
- Sigstore Cosign signing blobs: https://docs.sigstore.dev/cosign/signing/signing_with_blobs/
- Sigstore Cosign verification: https://docs.sigstore.dev/cosign/verifying/verify/
