# Node.js OSS Defense in Depth Checklist

**Scope:** high-download npm packages and related OSS projects such as Keyv, Cacheable, flat-cache, file-entry-cache, and adjacent repos.

**Goal:** make compromise require multiple independent failures, reduce the blast radius of any one failure, and create public evidence when a release does not match the expected process.

## Operating Principles

- [ ] **No single system is the root of trust.** GitHub can provide build provenance, npm can provide registry integrity, and Sigstore/Cosign can provide owner approval, but no single layer is treated as sufficient.
- [ ] **Human release approval is separate from GitHub.** A release may be built by GitHub Actions, but maintainer approval must come from an approved non-GitHub identity, such as `release@jaredwray.com` via Google OIDC or a pinned hardware/KMS release key.
- [ ] **Every install is treated as potential code execution.** Dependency lifecycle scripts, transitive dependencies, exotic dependency sources, and fresh package versions are all controlled by policy.
- [ ] **CI is untrusted until constrained.** GitHub Actions must run with read-only defaults, pinned actions, minimal permissions, no release secrets in PR jobs, and isolated publish authority.
- [ ] **Release authority is explicit and auditable.** Every release must have a signed intent, a reproducible install policy, a protected publish path, provenance where supported, and verification instructions for consumers.
- [ ] **Blast radius is intentionally small.** Workstations, VMs, credentials, package ownership, CI permissions, and security tools are separated by company and, where practical, by major project family.

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
- [ ] Use Renovate/Dependabot in controlled PRs, not automatic release pipelines.
- [ ] Require human review for any new direct dependency.
- [ ] Require additional review for dependencies with install scripts, native builds, binary downloads, exotic sources, or recent ownership changes.
- [ ] Maintain a direct-dependency owner map for critical packages.

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
- [ ] Require CODEOWNERS review for `.github/workflows/**`, release scripts, signer policy, and package-manager config.
- [ ] Avoid `pull_request_target` for workflows that check out or execute untrusted PR code.
- [ ] Do not share caches across trust boundaries.
- [ ] Disable package-manager caching in release builds.
- [ ] Do not use self-hosted runners for public PR workflows.
- [ ] If self-hosted runners are unavoidable, use just-in-time/ephemeral runners with no resident secrets.
- [ ] Prevent GitHub Actions from creating or approving PRs unless explicitly needed.
- [ ] Run GitHub workflow/security scans on every PR touching CI, package manifests, lockfiles, release scripts, or security policy.

## 6. Release Management

- [ ] Decide per package whether it is:
  - [ ] **Local-only release:** local npm publish with interactive 2FA and detached tarball signature.
  - [ ] **Best-of-both-worlds release:** non-GitHub maintainer approval plus GitHub Actions trusted publishing and npm provenance.
- [ ] For CI-provenance releases, configure npm trusted publishing to the exact GitHub repo, workflow filename, and `npm-publish` environment.
- [ ] Require one approved maintainer signature over `release-intent.json` before publishing.
- [ ] Verify the maintainer signature using Cosign keyless verification pinned to an allowed identity and issuer, for example `release@jaredwray.com` and `https://accounts.google.com`.
- [ ] Reject GitHub or GitHub Actions OIDC identities as human approval identities.
- [ ] Use a signed signer policy so a compromised repo cannot silently add a new approved signer.
- [ ] Check in the signed release intent and approval bundle.
- [ ] Publish final tarball signatures as GitHub Release assets and mirror them on `jaredwray.com`.
- [ ] Verify after publish that the tarball fetched from npm matches the expected package/version and release metadata.

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
