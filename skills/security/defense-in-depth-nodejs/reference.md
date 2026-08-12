# Defense in Depth (Node.js) — reference

Implementation spec for the catalog items. Section numbers match the `DEFENSE_IN_DEPTH.md` block.
Pull in the section you are implementing.

## 1. Security docs

Two files, two jobs:

- **`SECURITY.md`** — short and public-facing: how to report a vulnerability, plus a plain-language
  summary of what secures the repo. No checklists, no status.
- **`DEFENSE_IN_DEPTH.md`** — the working checklist this skill tracks progress in (format rules in
  `security-status-tracking`).

### SECURITY.md

The reporting boilerplate (private disclosure channels, what to include in a report) is the
`project-templates` skill's bundled template — reuse it rather than writing new prose. This skill
owns the summary section appended after it:

```md
## How this repository is secured

This repository follows the [defense-in-depth](https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md)
hardening checklist; progress is tracked in [DEFENSE_IN_DEPTH.md](./DEFENSE_IN_DEPTH.md). Measures currently in place:

- All changes land through pull requests — direct pushes to `main` are blocked.
- Tags (and therefore releases) can only be created by repository admins.
- Workflow runs from outside collaborators always require maintainer approval.
- CI runs with read-only permissions; every action is pinned to a full commit SHA and workflows are security-linted with zizmor on every PR.
- Dependencies install through pnpm with a 7-day cooldown on new versions, and lifecycle scripts are blocked by default.
- npm releases are staged, never published directly: CI publishes via OIDC trusted publishing to a staged release, Drydock reviews the exact artifact, and a maintainer promotes it with 2FA. There are no npm tokens.
```

**Only list what is live.** The bullets above are the full-rollout end state — include a bullet only
once its checklist item is checked in `DEFENSE_IN_DEPTH.md`, and update the summary in the same PR
that completes a section. A `SECURITY.md` that advertises controls the repo doesn't have is worse
than none. Keep the whole file under ~40 lines.

Private repos: drop the GitHub private-vulnerability-reporting bullet from the boilerplate (the
feature is public-only) — the email contact is the reporting channel.

### DEFENSE_IN_DEPTH.md scaffold

```md
# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: <npm library | website/app> · <public | private>

## 1. Security docs
- [ ] `SECURITY.md` present — contact info + "How this repository is secured" summary
- [ ] `DEFENSE_IN_DEPTH.md` present (this file)

## 2. Repository lockdown
- [ ] Lockdown script run; `lockdown-repo.sh --check` passes clean
- [ ] Pull requests required on the default branch; force pushes and deletion blocked
- [ ] Tag ruleset "Tags only by admins" active
- [ ] Workflow runs from all outside collaborators require approval
- [ ] Default workflow token read-only; Actions cannot create or approve PRs
- [ ] Secret scanning + push protection enabled *(plan-gated on private repos)*
- [ ] Private vulnerability reporting enabled *(public repos only)*
- [ ] Dependabot alerts enabled

## 3. Dependencies (pnpm)
- [ ] `packageManager: pnpm@11.x` pinned in `package.json`
- [ ] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false`
- [ ] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline
- [ ] `blockExoticSubdeps: true`
- [ ] Lockfile committed; CI installs with `pnpm install --frozen-lockfile`
- [ ] Dependency-update tooling opens PRs only — never auto-merge
- [ ] New direct dependencies get human review; prefer `~` ranges over `^`

## 4. GitHub Actions
- [ ] `permissions: contents: read` (or `{}` + per-job grants) on every workflow
- [ ] Every action pinned to a full commit SHA (`npx actions-up`)
- [ ] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR
- [ ] `persist-credentials: false` on checkouts that don't push
- [ ] No `pull_request_target` on workflows that run untrusted PR code
- [ ] No npm tokens (or other registry credentials) in Actions secrets

## 5. npm publishing — npm libraries only
- [ ] OIDC trusted publishing configured on npmjs.com for the publish workflow (manual)
- [ ] Staged publishing: CI runs `npm stage publish`; a maintainer promotes with 2FA (manual)
- [ ] Drydock connected — staged releases reviewed before promotion (manual)
- [ ] No direct publish rights: package requires 2FA and disallows tokens (manual)
- [ ] `package.json` `repository.url` accurate so provenance maps to this repo

## 6. Security tooling
- [ ] Aikido runs on every build
- [ ] Socket reviews every PR that changes dependencies
```

Profile adjustments when scaffolding:

- **website/app** — omit § 5 entirely.
- **private** — omit the private-vulnerability-reporting item; keep the plan-gated items only if the
  plan supports them (the lockdown script reports this); omit § 5 unless the repo actually publishes
  a package.

## 2. Repository lockdown

One admin, one script: [`./scripts/lockdown-repo.sh`](./scripts/lockdown-repo.sh) (bundled with this
skill) applies every GitHub-side setting in § 2 idempotently via `gh`, and audits them with
`--check`.

```bash
# audit — safe anywhere, changes nothing, exits 1 if anything is off
lockdown-repo.sh jaredwray/keyv --check

# apply — requires gh authenticated as a repo admin
lockdown-repo.sh jaredwray/keyv
```

What it sets:

| Setting | Value |
| --- | --- |
| Default workflow token | `read` only, and Actions cannot create or approve PRs |
| Fork-PR workflow approval | `all_external_contributors` — a maintainer approves every outside collaborator's run |
| Branch ruleset "Pull requests required" | PR required on the default branch, force pushes and deletion blocked, **no bypass** (admins go through PRs too) |
| Tag ruleset "Tags only by admins" | tag creation restricted; only repository admins bypass |
| Secret scanning + push protection | enabled (public repos; private needs GitHub Secret Protection) |
| Private vulnerability reporting | enabled (public repos only) |
| Dependabot alerts | enabled |

Notes:

- The agent never runs the apply mode on its own: run `--check` freely for reconciliation, but stop
  and ask before changing repo settings, or hand the command to the maintainer.
- Rulesets are judged by their contents, not their name: `--check` validates enforcement, rule
  types, targets, and the bypass list, and apply mode overwrites a same-name ruleset with the
  canonical config — a pre-existing weak ruleset can't pass as compliant.
- The PR ruleset requires 0 approving reviews by default — the point is "no direct pushes", and a
  solo maintainer must still be able to merge. Teams can raise the count or add code-owner review on
  top.
- Private repos on a free plan: rulesets need GitHub Pro/Team, secret scanning needs the Secret
  Protection add-on — the script reports these instead of failing.
- Manual fallback for the tag ruleset (GitHub UI): Settings → Rules → Rulesets → New tag ruleset;
  name `Tags only by admins`, Enforcement **Active**, add **Repository admins** to the bypass list,
  target **All tags**, enable **Restrict creations**.

## 3. Dependencies (pnpm)

Target `pnpm@11.x`; put the policy in `pnpm-workspace.yaml` so it's code-reviewed, not
developer-local:

```yaml
minimumReleaseAge: 10080 # 7 days, in minutes
minimumReleaseAgeStrict: true # fail instead of falling back to a too-new version
minimumReleaseAgeIgnoreMissingTime: false # missing publish-time metadata fails closed
blockExoticSubdeps: true
strictDepBuilds: true
dangerouslyAllowAllBuilds: false
trustPolicy: no-downgrade

allowBuilds: {}
```

- Pin the package manager in `package.json` (e.g. `"packageManager": "pnpm@11.1.0"`).
- The 7-day window (`minimumReleaseAge: 10080`) is the single highest-leverage control: almost every
  npm supply-chain attack is caught and unpublished within days.
- `allowBuilds` replaces the older `onlyBuiltDependencies` / `neverBuiltDependencies` /
  `ignoredBuiltDependencies` settings. Every entry added to it is a security exception that gets code
  review; run `pnpm approve-builds` only during dependency review, never in CI.
- CI installs use exactly `pnpm install --frozen-lockfile`, so CI fails if the lockfile would change.
- If a dependency-update tool is already configured (Renovate, Dependabot), it opens PRs that go
  through normal review — never auto-merge. Don't add one where none exists; tool choice is the
  maintainer's call.
- New direct dependencies need human review — extra scrutiny for install scripts, native builds,
  binary downloads, or recent ownership changes. Prefer `~` over `^` for runtime deps; keep peer
  ranges consumer-friendly.

## 4. GitHub Actions

- Default every workflow to least privilege: top-level `permissions: contents: read` (or
  `permissions: {}` with per-job grants). `id-token: write` appears only on a publish job.
- **Pin by SHA with [actions-up](https://github.com/azat-io/actions-up):** `npx actions-up` scans
  every workflow and composite action, updates to the latest release, and pins to the full commit
  SHA with a version comment. Use it both for the initial pinning PR and for routine updates —
  never hand-resolve SHAs.
- `persist-credentials: false` on every `actions/checkout` that doesn't need to push.
- No `pull_request_target` for workflows that check out or execute untrusted PR code; don't share
  caches across trust boundaries, and disable package-manager caching in release builds.
- No npm tokens in Actions secrets — publishing is OIDC-only (§ 5).
- Optionally add `.github/CODEOWNERS` with a wildcard rule so workflow, release-script, and policy
  changes always get a code-owner review (pair the maintainer with a second trusted reviewer, and
  enable code-owner review in the branch ruleset).

### CI security linting: check-workflows.yaml

Add `.github/workflows/check-workflows.yaml` running [zizmor](https://docs.zizmor.sh), the GitHub
Actions security linter — it catches template injections, excessive permissions, unpinned actions,
cache poisoning, and credential persistence:

```yaml
name: Check Workflows

on:
  push:
    branches: [main]
  pull_request:

permissions: {}

jobs:
  zizmor:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: read
      security-events: write # SARIF upload to code scanning
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Run zizmor
        uses: zizmorcore/zizmor-action@3dc1ecc9bcb9e94e9b2c709687979e1298497054 # v0.6.2
```

Private repos without Advanced Security can't upload SARIF — add `with: advanced-security: false`
to the zizmor step (findings become annotations and fail the job) and drop `security-events: write`.
After copying the template, run `npx actions-up` so the pins are current rather than trusting this
file's snapshot.

## 5. npm publishing — npm libraries only

The publishing model, end to end: **CI can stage, only a human can ship, and a second system reviews
the artifact in between.**

1. **OIDC trusted publishing** — the publish workflow authenticates to npm with a short-lived OIDC
   token (`id-token: write` on that job only). No npm tokens exist anywhere: not in Actions secrets,
   not on laptops. Provenance is generated automatically.
2. **Staged publishing** — CI runs `npm stage publish` (npm CLI ≥ 11.15) instead of `npm publish`.
   The version lands in a staging queue, not on the registry.
3. **Drydock review** — [Drydock](https://drydock.org) (free for npm maintainers) picks up the
   staged tarball with a read-only token, diffs it against the last published version, and flags
   what malware relies on: new lifecycle scripts, unexpected files, network/process calls, added
   binaries.
4. **Human promotion** — a maintainer reviews the Drydock report and approves the staged version
   with a 2FA challenge. That approval — not the CI run — is what publishes.
5. **No direct publish rights** — package settings require 2FA and disallow tokens, and the trusted
   publisher is the only automated path in, so a compromised laptop or CI run cannot skip the stage.

npmjs.com setup (manual, per package): configure the trusted publisher (GitHub Actions provider →
exact repo, workflow filename, environment), switch CI to `npm stage publish`, connect Drydock, then
set **Require two-factor authentication and disallow tokens**. Keep `repository.url` accurate so
provenance maps to the repo.

The publish workflow itself (build steps, environments, verification gates) belongs to the
`release-management-nodejs` skill — this section owns the policy and the registry-side settings.

Background: [Publishing packages with less anxiety](https://jovidecroock.com/blog/secure-npm-publishing/)
and [Two places to stop a bad release](https://jovidecroock.com/blog/drydock-release-defenses/).

## 6. Security tooling

Both layers are GitHub apps already used across these repos — installing the app on the repo is the
whole setup, and each item is verified by its check appearing on PRs.

- **Aikido** ([aikido.dev](https://www.aikido.dev)) runs on every build — SCA/CVE scanning, secrets,
  SAST. Aikido also partners with Drydock, so pre-publish review and build-time scanning share
  findings.
- **Socket** ([socket.dev](https://socket.dev)) is the dependency security linter: it reviews every
  PR that changes dependencies for supply-chain behavior — new install scripts, network access,
  obfuscated code, typosquats, maintainer changes — the risks CVE scanners can't see yet.
- Secret scanning, push protection, and Dependabot alerts are repo settings — § 2 owns them.

## References

- npm staged publishing: https://github.blog/changelog/2026-05-22-staged-publishing-and-new-install-time-controls-for-npm/
- npm trusted publishing (OIDC): https://docs.npmjs.com/trusted-publishers/
- npm 2FA / disallow tokens: https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/
- Drydock: https://drydock.org/
- actions-up: https://github.com/azat-io/actions-up
- zizmor: https://docs.zizmor.sh/
- Socket: https://socket.dev/
- Aikido: https://www.aikido.dev/
- pnpm settings: https://pnpm.io/settings
- GitHub rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use
- Jovi De Croock on the model this follows: https://jovidecroock.com/blog/secure-npm-publishing/
