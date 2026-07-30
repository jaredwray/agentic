# Defense in Depth (Node.js) — reference

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
