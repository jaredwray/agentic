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

- All changes land through pull requests — direct pushes to `main` are blocked, and merging requires passing status checks.
- Tags can only be created by repository admins; published GitHub Releases are immutable (assets and tags cannot be changed after publish).
- Workflow runs from outside collaborators always require maintainer approval, and only allowlisted GitHub Actions can run.
- CI runs with read-only permissions (only jobs whose purpose is mutating the repo get `contents: write`); generated output is an artifact, never committed back; every action is pinned to a full commit SHA; Socket Firewall (`sfw`) wraps `pnpm install` / `npm install`; workflows are security-linted with zizmor on every PR.
- Codespaces and Cursor Cloud Agents install through Aikido Safe Chain; package-manager shims must not be bypassed.
- Dependencies install through pnpm with a 7-day cooldown on new versions, lifecycle scripts blocked by default, and `trustPolicy: no-downgrade`. Socket reviews every dependency change; Aikido scans every build.
- npm releases are staged, never published directly: CI publishes via stage-only OIDC trusted publishing, Drydock reviews the exact staged artifact, and a maintainer promotes it with 2FA. There are no npm tokens.
```

**Only list what is live.** The bullets above are the full-rollout end state — include a bullet only
once its checklist item is checked in `DEFENSE_IN_DEPTH.md`, and update the summary in the same PR
that completes a section. A `SECURITY.md` that advertises controls the repo doesn't have is worse
than none. Keep the whole file under ~40 lines.

Private repos: drop the GitHub private-vulnerability-reporting bullet from the boilerplate (the
feature is public-only) — the email contact is the reporting channel. Drop the "outside
collaborators require maintainer approval" clause from the summary (GitHub does not allow fork PR
approval on private repositories); keep the Actions allowlist clause.

### DEFENSE_IN_DEPTH.md scaffold

```md
# Defense in Depth

Catalog: defense-in-depth-nodejs@1.0.0
Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: <npm library | website/app> · <public | private>

## 1. Security docs
- [ ] `SECURITY.md` present — contact info + "How this repository is secured" summary
- [ ] `DEFENSE_IN_DEPTH.md` present (this file)

## 2. CODEOWNERS and cloud bootstrap
- [ ] `.github/CODEOWNERS` covers `/.github/`, `/.cursor/`, `/.devcontainer/`, `/scripts/` with owners the maintainer names
- [ ] Codespaces and Cursor Cloud Agents bootstrap Aikido Safe Chain via scripts/setup-cloud-environment.sh (--ci shims, frozen lockfile)

## 3. Dependencies (pnpm)
- [ ] `packageManager: pnpm@11.3+` pinned in `package.json`
- [ ] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false`; no first-party `minimumReleaseAgeExclude`
- [ ] `trustPolicy: no-downgrade`; no first-party `trustPolicyExclude`
- [ ] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline
- [ ] `blockExoticSubdeps: true`
- [ ] Lockfile committed; CI installs with `pnpm install --frozen-lockfile`
- [ ] No `.github/dependabot.yml`; other dependency-update tools (if any) open PRs only — never auto-merge

## 4. GitHub Actions
- [ ] `permissions: contents: read` (or `{}` + per-job grants) on every workflow
- [ ] No `contents: write` except jobs whose purpose is mutating the repo (GitHub Release, Changesets version PR); generated output is a workflow artifact, never committed back from CI
- [ ] Every action pinned to a full commit SHA (`npx actions-up`)
- [ ] Every job installs Socket Firewall (`SocketDev/action` SHA-pinned, `firewall-version` pinned); `pnpm install` / `npm install` run as `sfw pnpm install` / `sfw npm install`
- [ ] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR
- [ ] `persist-credentials: false` on checkouts that don't push
- [ ] No `pull_request_target` on workflows that run untrusted PR code
- [ ] Artifact-publishing workflows disable `actions/setup-node` default caching (`package-manager-cache: false`) to prevent cache poisoning
- [ ] No npm tokens (or other registry credentials) in Actions secrets

## 5. npm publishing — npm libraries only
- [ ] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live (manual)
- [ ] `.github/workflows/release.yaml` packs then stages with `pnpm stage publish ./packed/*.tgz --no-git-checks`
- [ ] Maintainer promotes staged versions with 2FA (manual)
- [ ] Drydock connected — staged releases reviewed before promotion (manual)
- [ ] No direct publish rights: package requires 2FA and disallows tokens (manual)
- [ ] `package.json` `repository.url` accurate so provenance maps to this repo

## 6. Security tooling
- [ ] Aikido runs on every build
- [ ] Aikido release gate: the release workflow's stage-publish job `needs:` a passing `scan-release`
- [ ] Socket reviews every PR that changes dependencies

## 7. Repository lockdown
- [ ] `lockdown-repo.sh` applied; `--check` with `--required-checks` and `--allowed-actions` passes (PRs required on the default branch, merges blocked unless required status checks pass, tag ruleset, immutable releases, fork-PR approval (public repos), read-only workflow tokens, Actions allowlist, secret scanning, Dependabot disabled, private vulnerability reporting (public repos))
- [ ] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts (manual)
- [ ] Recovery codes stored offline in a password manager (manual)
```

### Catalog version

The catalog is versioned independently of the plugin. [VERSION](./VERSION) is the semver (`x.y.z`);
this scaffold's `Catalog:` line must match it (CI checks). History is in [CHANGELOG.md](./CHANGELOG.md).
Each target repo records `Catalog: defense-in-depth-nodejs@<version>`.

Bump `VERSION` in the same PR that changes the catalog or a bundled script's required behavior,
update this scaffold's `Catalog:` line, and add a CHANGELOG entry:

| Bump | When |
| --- | --- |
| **major** | removed or incompatible item (a previously passing repo would fail the new check) |
| **minor** | new catalog item or new requirement a repo satisfies by adding something |
| **patch** | wording, script bugfix, or verification change that does not add/remove checklist items |

Do not bump for skill prose, shared-skill, or plugin packaging changes that leave the catalog and
required script behavior unchanged.

Profile adjustments when scaffolding:

- **website/app** — omit § 5 entirely.
- **private** — omit the private-vulnerability-reporting and fork-PR approval clauses from the
  lockdown item; keep the plan-gated settings only if the plan supports them (the lockdown script
  reports this); omit § 5 unless the repo actually publishes a package.
- **no `pnpm-lock.yaml`** — omit the Safe Chain cloud-bootstrap item.

## 2. CODEOWNERS and cloud bootstrap

File PRs. GitHub repo settings are § 7 and run last.

### CODEOWNERS

Copy this template into `.github/CODEOWNERS`. **Ask who the owners are** (`@user` and/or
`@org/team`, one or more) and substitute `{{OWNERS}}`. Never hardcode a username and never guess
from the repo owner login; if the user already named owners in this conversation, use those.

```
# High-risk paths. Last matching pattern wins.
# Root-anchored so nested copies (e.g. skills/**/scripts/) are not owned here.
/.github/ {{OWNERS}}
/.cursor/ {{OWNERS}}
/.devcontainer/ {{OWNERS}}
/scripts/ {{OWNERS}}
```

Cover `.cursor/` and `.devcontainer/` even before those directories exist so a later add is already
owned. Pair with a second trusted reviewer when the bus factor allows.

`lockdown-repo.sh --check` (§ 7) fails if the default branch has no CODEOWNERS file with at least
one owner (looks in `.github/CODEOWNERS`, then `CODEOWNERS`, then `docs/CODEOWNERS`). The script
never writes that file.

### Safe Chain on Codespaces and Cursor Cloud Agents

File PR (`chore/defense-safe-chain-cloud`). Skip when the target repo has no `pnpm-lock.yaml`. Copy
the bundled [`./scripts/setup-cloud-environment.sh`](./scripts/setup-cloud-environment.sh) to the
target's `scripts/setup-cloud-environment.sh`, and copy from this skill's `templates/`:

| Source | Target path |
| --- | --- |
| `templates/.devcontainer/devcontainer.json` | `.devcontainer/devcontainer.json` |
| `templates/.cursor/environment.json` | `.cursor/environment.json` |
| `templates/AGENTS.md` | `AGENTS.md` (section only — see merge rules) |
| `scripts/setup-cloud-environment.sh` | `scripts/setup-cloud-environment.sh` |

The bootstrap installs [Aikido Safe Chain](https://github.com/AikidoSec/safe-chain) from a **pinned**
release, verifies the official installer SHA-256, runs `--ci` so `pnpm` / `npm` / `npx` / `pnpx` use
shims, persists those shim paths, runs `pnpm safe-chain-verify`, and then `pnpm install
--frozen-lockfile`. It fails closed — no unprotected install, no `latest` installer. Bump the
version and digest in the bundled script the same way Socket Firewall's `firewall-version` is
bumped; do not fetch "latest" when applying.

Greenfield templates: Codespaces uses `mcr.microsoft.com/devcontainers/javascript-node:latest`
directly (no Dockerfile). Cursor uses a managed environment with only `install` (no `build`, no
Dockerfile, no snapshot). Both invoke `bash ./scripts/setup-cloud-environment.sh` so the copied
script does not need the executable bit.

The script's `PATH` export stays in its own process. Any follow-on package-manager command in the
same `install` / `postCreateCommand` string must put the shims on `PATH` in that shell:

```bash
bash ./scripts/setup-cloud-environment.sh && export PATH="$HOME/.safe-chain/shims:$HOME/.safe-chain/bin:$PATH" && …
```

Merge — never blindly overwrite:

| File | Missing | Already present |
| --- | --- | --- |
| `scripts/setup-cloud-environment.sh` | Copy from the skill | Replace with the skill's script (this is the security control) |
| `.devcontainer/devcontainer.json` | Write the template | Keep existing keys, image, and Dockerfile. Set or chain `postCreateCommand` with the same-shell pattern above so the bootstrap runs and later installs stay shimmed. Do not add a Dockerfile. Do not force `javascript-node:latest` over an existing image. |
| `.cursor/environment.json` | Write `{ "install": "bash ./scripts/setup-cloud-environment.sh" }` | Keep other keys; if `install` exists, prepend the same-shell pattern above unless it already runs the script. Do not add `build` or a Dockerfile. |
| `AGENTS.md` | Write the Safe Chain section | Append the section if absent; leave existing content alone. |

Stop and report if `devcontainer.json` or `environment.json` is not valid JSON. A leftover catalog
line about PMG / VM-egress filtering is dropped in this PR (list it in the body).

Reconcile as done when the bootstrap script is present, both environment configs invoke it, and
`AGENTS.md` has the Safe Chain section.

## 3. Dependencies (pnpm)

Target `pnpm@11.3+` (`pnpm stage` landed in 11.3); put the policy in `pnpm-workspace.yaml` so
it's code-reviewed, not developer-local:

```yaml
minimumReleaseAge: 10080 # 7 days, in minutes
minimumReleaseAgeStrict: true # fail instead of falling back to a too-new version
minimumReleaseAgeIgnoreMissingTime: false # missing publish-time metadata fails closed
blockExoticSubdeps: true
strictDepBuilds: true
dangerouslyAllowAllBuilds: false
trustPolicy: no-downgrade # fail if a later version has weaker trust evidence

allowBuilds: {}
```

- Pin the package manager in `package.json` (e.g. `"packageManager": "pnpm@11.3.0"`).
- The 7-day window (`minimumReleaseAge: 10080`) is the single highest-leverage control: almost every
  npm supply-chain attack is caught and unpublished within days.
- No first-party excludes. `minimumReleaseAgeExclude` and `trustPolicyExclude` must not list
  packages this GitHub owner publishes (workspace `package.json` `name` values, or
  `npm view <pkg> repository.url` / `npm view <pkg> maintainers` matching
  `gh repo view --json owner --jq .owner.login`) nor globs that cover them (`@scope/*`). A hijacked
  maintainer account shipping a malicious version of *our* package is what those gates catch;
  skipping them because "we published it" removes the control. When applying the cooldown or
  trust-policy item, drop matching entries; omit the key if the list is then empty. Do not add an
  exclude to unblock a too-new or weaker-trust version — pin to a version that already meets the
  gate. Leave unrelated third-party entries as they are.
- Reconcile the cooldown item as done when the three `minimumReleaseAge*` keys match the baseline
  and `minimumReleaseAgeExclude` contains no first-party package (absent key is fine).
- `trustPolicy: no-downgrade` fails the install if a later-published version has weaker trust
  evidence than an earlier one (trusted publisher → provenance-only → none). Reconcile as done
  when the key is `no-downgrade` and `trustPolicyExclude` contains no first-party package
  (absent key is fine).
- `allowBuilds` replaces the older `onlyBuiltDependencies` / `neverBuiltDependencies` /
  `ignoredBuiltDependencies` settings. Every entry added to it is a security exception that gets code
  review; run `pnpm approve-builds` only during dependency review, never in CI.
- CI installs use `--frozen-lockfile` so CI fails if the lockfile would change. Once Socket Firewall
  is on the job (§ 4), the command is `sfw pnpm install --frozen-lockfile`.
- No Dependabot. Do not add `.github/dependabot.yml`. GitHub-native alerts and security-update
  PRs are disabled in § 7. Aikido already does CVE/SCA and Socket already reviews dependency
  diffs; a third overlapping scanner is noise, not an independent control. If another updater
  (Renovate) is already configured, it opens PRs through normal review — never auto-merge. Don't
  add one where none exists.

## 4. GitHub Actions

- Default every workflow to least privilege: top-level `permissions: contents: read` (or
  `permissions: {}` with per-job grants). `id-token: write` appears only on a publish job.
- No `contents: write` except jobs whose purpose is mutating the repo. Generated output is a
  workflow artifact, never committed back from CI — a compromised action in that job then cannot
  push `main`. `id-token: write` on a publish job is OIDC (§ 5), not repo write.
- **Pin by SHA with [actions-up](https://github.com/azat-io/actions-up):** `npx actions-up` scans
  every workflow and composite action, updates to the latest release, and pins to the full commit
  SHA with a version comment. Use it for the initial pinning PR; afterwards pin refresh rides the
  monthly dependency/workflow management pass. Never hand-resolve SHAs.
- `persist-credentials: false` on every `actions/checkout` that doesn't need to push.
- No `pull_request_target` for workflows that check out or execute untrusted PR code; don't share
  caches across trust boundaries.
- Artifact-publishing workflows (staged npm publish, GitHub Releases, OIDC, attestations) set
  `package-manager-cache: false` on every `actions/setup-node` step and do not set `cache:` to a
  package manager. `setup-node` otherwise enables npm caching by default when `package.json`
  names npm, and a poisoned Actions cache can run attacker-controlled code in a job that holds
  publish credentials. Regular CI may still cache.
- No npm tokens in Actions secrets — publishing is OIDC-only (§ 5).
- CODEOWNERS for workflow and script paths is § 2 — the branch ruleset that requires the review is
  § 7, applied last.

### No CI commit-back

File PR (`chore/defense-actions-no-commit-back`). Inventory, classify, convert; do not add a new
workflow just to dogfood artifacts.

1. **Inventory** `.github/workflows/` for `contents: write`, `git commit`, `git push`, and
   auto-commit actions (`stefanzweifel/git-auto-commit-action`, `EndBug/add-and-commit`,
   `peaceiris/actions-gh-pages`, and similar).
2. **Classify each hit.** Mutating the repo **is** the job → keep `contents: write` on **that job
   only** (creating a GitHub Release; Changesets opening a version PR). Anything else (docs,
   `llms.txt`, formatters, generated catalogs, a built site pushed to `gh-pages`) is generated
   output → strip write.
3. **Convert generated-output jobs.** Gitignore the files. Upload with SHA-pinned
   `actions/upload-artifact` and `persist-credentials: false` on checkout. Prefer
   `actions/upload-pages-artifact` + `actions/deploy-pages` over pushing `gh-pages`. Pin new `uses:`
   with `npx actions-up` in the same PR. Do not wrap the job in an org composite action, and do not
   add `npm install` for a stdlib script. If Socket Firewall is already on the job, leave it.
4. **Stop and report** if something downstream consumed the old commit (a deploy repo, Pages from a
   branch). Do not invent that wiring.

```yaml
name: Build generated files

on:
  push:
    branches: [main]

permissions: {}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Generate
        run: node scripts/build-generated.js
      - name: Upload
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: generated
          path: generated/
          if-no-files-found: error
```

After adapting the sketch, run `npx actions-up` so the action pins are current rather than trusting
this file's snapshot.

Reconcile as done when no workflow has `contents: write`, `git commit` / `git push`, or an
auto-commit action except the documented exceptions. If every remaining write job is a real
exception, check the item off with `— verified <date>` and do not open a no-op PR.

### Socket Firewall on every job

Every job with `steps:` installs [Socket Firewall Free](https://docs.socket.dev/docs/socket-firewall-free)
immediately after checkout (or as the first step if the job does not check out), even if the job
does not currently install packages. This is install-time blocking; the Socket GitHub app in § 6
reviews dependency diffs on PRs.

Socket Firewall Free is wrapper-mode only. Every `pnpm install` and `npm install` (including
`npm install --global`) is invoked with the `sfw` prefix — do not rely on PATH shims
(`corepack enable` and later PATH changes can shadow them). A job that installs dependencies runs
`sfw pnpm install --frozen-lockfile` (or `sfw npm install …`).

```yaml
      - name: Install Socket Firewall
        uses: SocketDev/action@ba6de6cc0565af1f42295590380973573297e31f # v1.3.2
        with:
          mode: firewall-free
          firewall-version: "1.15.0"
```

- Pin `SocketDev/action` to a full commit SHA via actions-up — never a floating tag.
- Pin `firewall-version` to a reviewed [sfw-free](https://github.com/SocketDev/sfw-free/releases)
  version (no `v` prefix; the action prepends it). Never `latest`. After copying this snapshot, look
  up the current reviewed release rather than trusting the version in this file.
- `mode: firewall-free` needs no Socket API token. The job still needs `contents: read` so the
  action can fetch the release through the GitHub API.
- Rewrite existing `pnpm install` / `npm install` steps to `sfw pnpm install` / `sfw npm install` in
  the same PR. Reconcile as done when every job with `steps:` has the Firewall step and no workflow
  install is missing the prefix.

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
      - name: Install Socket Firewall
        uses: SocketDev/action@ba6de6cc0565af1f42295590380973573297e31f # v1.3.2
        with:
          mode: firewall-free
          firewall-version: "1.15.0"
      - name: Run zizmor
        uses: zizmorcore/zizmor-action@3dc1ecc9bcb9e94e9b2c709687979e1298497054 # v0.6.2
```

Private repos without Advanced Security can't upload SARIF — add `with: advanced-security: false`
to the zizmor step (findings become annotations and fail the job) and drop `security-events: write`.
After copying the template, run `npx actions-up` so the action pins are current rather than trusting
this file's snapshot, and look up the current reviewed sfw-free version for `firewall-version`.

## 5. npm publishing — npm libraries only

The publishing model, end to end: **CI can stage, only a human can ship, and a second system reviews
the artifact in between.**

1. **OIDC trusted publishing, stage-only** — the publish workflow authenticates to npm with a
   short-lived OIDC token (`id-token: write` on that job only), and the trusted publisher is
   configured **stage-only** on npmjs.com, so even a tampered workflow cannot publish live. No npm
   tokens exist anywhere: not in Actions secrets, not on laptops. Provenance is generated
   automatically.
2. **Staged publishing** — CI packs a tarball and runs
   `pnpm stage publish ./packed/*.tgz --access public --provenance --no-git-checks` (pnpm ≥ 11.3)
   instead of `pnpm publish`. The version lands in a staging queue, not on the registry.
   `--no-git-checks` is required: pnpm still runs git-checks for a tarball, and they fail on a
   detached release-tag checkout and on the untracked pack output. Prefix the glob with `./` so
   it is a local path. Any pack directory is fine (`packed/`, `dist/`).
3. **Drydock review** — [Drydock](https://drydock.org) (free for npm maintainers) picks up the
   staged tarball with a read-only token, diffs it against the last published version, and flags
   what malware relies on: new lifecycle scripts, unexpected files, network/process calls, added
   binaries.
4. **Human promotion** — a maintainer reviews the Drydock report and approves the staged version
   with a 2FA challenge. That approval — not the CI run — is what publishes.
5. **No direct publish rights** — package settings require 2FA and disallow tokens, and the trusted
   publisher is the only automated path in, so a compromised laptop or CI run cannot skip the stage.

npmjs.com setup (manual, per package): configure the trusted publisher (GitHub Actions provider →
exact repo, workflow filename matching the file that stages — `release.yaml` for the template
below — and environment if the job uses one) as **stage-only**, connect Drydock, then set
**Require two-factor authentication and disallow tokens**. Keep `repository.url` accurate so
provenance maps to the repo.

Signer policy, release-intent, and verification gates belong to the `release-management-nodejs`
skill. This section owns the stage-publish workflow below plus the registry-side settings.

### release.yaml

File PR. Copy into `.github/workflows/release.yaml`. Adapt the test script (`pnpm test:ci` vs
`pnpm test`), Node version, and pack command to the repo. After copying, run `npx actions-up` so
the action pins are current rather than trusting this file's snapshot, and look up the current
reviewed sfw-free version for `firewall-version`. `packageManager` must be pnpm 11.3+ so Corepack
provides `pnpm stage publish` — do not install the npm CLI for staging.

If the repo already has a publish workflow, do not replace a custom pipeline wholesale — switch its
publish step to pack + `pnpm stage publish ./<dir>/*.tgz --no-git-checks`. A new workflow includes
the Aikido gate so the stage-publish job is never ungated; when a publish workflow already exists,
§ 6 adds the gate as its own PR.

```yaml
name: release

on:
  workflow_dispatch:
  release:
    types: [released]

permissions:
  contents: read

jobs:
  aikido-gate:
    name: Aikido release gate
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Install Socket Firewall
        uses: SocketDev/action@ba6de6cc0565af1f42295590380973573297e31f # v1.3.2
        with:
          mode: firewall-free
          firewall-version: "1.15.0"

      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24
          package-manager-cache: false

      - name: Install Aikido CI client
        # zizmor: ignore[adhoc-packages] pinned Aikido CI client for the release gate
        run: sfw npm install --global @aikidosec/ci-api-client@1.0.17

      # Fails on new SAST/IaC/secrets findings. The API key comes from Aikido's
      # Continuous Integration settings — it grants no publish authority.
      - name: Run Aikido release scan
        env:
          REPO_NAME: ${{ github.event.repository.name }}
          AIKIDO_CLIENT_API_KEY: ${{ secrets.AIKIDO_CLIENT_API_KEY }}
        run: >
          aikido-api-client scan-release
          "$REPO_NAME" "$GITHUB_SHA"
          --apikey "$AIKIDO_CLIENT_API_KEY"
          --fail-on-sast-scan --fail-on-iac-scan --fail-on-secrets-scan

  build:
    needs: [aikido-gate]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Install Socket Firewall
        uses: SocketDev/action@ba6de6cc0565af1f42295590380973573297e31f # v1.3.2
        with:
          mode: firewall-free
          firewall-version: "1.15.0"
      - name: Use Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24
          package-manager-cache: false

      - name: Enable Corepack
        run: corepack enable

      - name: Prepare pnpm
        run: corepack prepare

      - name: Install Dependencies
        run: sfw pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Testing
        run: pnpm test:ci

      - name: Pack
        run: |
          mkdir -p packed
          pnpm pack --pack-destination packed
          ls -la packed

      - name: Stage publish
        # pnpm ≥ 11.3. --no-git-checks: git-checks run even for a tarball and
        # fail on a detached release-tag checkout and on the untracked pack output.
        run: pnpm stage publish ./packed/*.tgz --access public --provenance --no-git-checks
```

Background: [Publishing packages with less anxiety](https://jovidecroock.com/blog/secure-npm-publishing/)
and [Two places to stop a bad release](https://jovidecroock.com/blog/drydock-release-defenses/).

## 6. Security tooling

Both layers are GitHub apps already used across these repos — installing the app on the repo is the
whole setup, and each item is verified by its check appearing on PRs.

- **Aikido** ([aikido.dev](https://www.aikido.dev)) runs on every build — SCA/CVE scanning, secrets,
  SAST. Aikido also partners with Drydock, so pre-publish review and build-time scanning share
  findings. Code its release gate into the release workflow (`release.yaml` / `publish.yml`): an
  `aikido-gate` job runs `aikido-api-client scan-release … --fail-on-sast-scan --fail-on-iac-scan
  --fail-on-secrets-scan` and the stage-publish job `needs:` it, so nothing is staged while new
  findings are open — the job is in the § 5 `release.yaml` template (signed-release variant in
  the `release-management-nodejs` reference § 14).
- **Socket** ([socket.dev](https://socket.dev)) is the dependency security linter: it reviews every
  PR that changes dependencies for supply-chain behavior — new install scripts, network access,
  obfuscated code, typosquats, maintainer changes — the risks CVE scanners can't see yet. CI
  install-time blocking is Socket Firewall in § 4, not this GitHub-app item.
- Secret scanning and push protection are repo settings — § 7 owns them. Dependabot stays off
  (alerts, security-update PRs, and `.github/dependabot.yml`) for the same reason: Aikido and
  Socket already cover that ground.

## 7. Repository lockdown

**Always last.** Do not apply until every preceding auto-implementable catalog item is checked and
on `main`. `(manual)` items (npm-side settings, account 2FA) do not block it. File items first so
`--required-checks` names the real CI jobs, the Actions allowlist matches `uses:` in the landed
workflows, and CODEOWNERS exists before `require_code_owner_review` is enforced. `--check` during
audit is always allowed; apply mode is not.

One admin, one script: [`./scripts/lockdown-repo.sh`](./scripts/lockdown-repo.sh) (bundled with this
skill) applies every GitHub-side setting in this section idempotently via `gh`, and audits them with
`--check`.

```bash
# audit — safe anywhere, changes nothing, exits 1 if anything is off
lockdown-repo.sh jaredwray/keyv --check --required-checks "test,zizmor"

# apply — requires gh authenticated as a repo admin; only after earlier auto items
lockdown-repo.sh jaredwray/keyv --required-checks "test,zizmor" --allowed-actions "changesets/*"
```

Before apply, take both flags from the repo as it stands on `main`:

- `--required-checks` — the job names from `.github/workflows/` (e.g. `test,zizmor`).
- `--allowed-actions` — extra `uses:` owners not already covered (GitHub-owned, verified creators,
  `zizmorcore/*`, and `SocketDev/*` are always allowed). Grep `uses:` first.

What it sets:

| Setting | Value |
| --- | --- |
| Default workflow token | `read` only, and Actions cannot create or approve PRs |
| Fork-PR workflow approval | `all_external_contributors` — a maintainer approves every outside collaborator's run (public repos only) |
| Branch ruleset "Pull requests required" | PR required on the default branch with **0 required approving reviews**, **last-push approval off**, **code owner review** of owned paths, and **Restrict updates off**. The owner is on the bypass list in **pull request** mode: they may merge without a review but still cannot push directly. Force pushes and deletion blocked |
| CODEOWNERS | `.github/CODEOWNERS` on the default branch names at least one owner. The script audits this; adding the file is the § 2 PR. Without it `require_code_owner_review` is a no-op |
| Required status checks | with `--required-checks "<c1,c2>"`, merging is blocked unless those checks pass — name the repo's CI jobs (e.g. `test,zizmor`) |
| Tag ruleset "Tags only by admins" | tag creation restricted; only repository admins bypass |
| Immutable GitHub Releases | enabled: published release assets cannot be added, replaced, or deleted; the release tag cannot be moved or deleted while the release exists. Existing releases stay mutable until republished. Attach assets on a draft, then publish |
| Secret scanning + push protection | enabled (public repos; private needs GitHub Secret Protection) |
| Private vulnerability reporting | enabled (public repos only) |
| Dependabot | disabled: alerts off, security-update PRs off, no `.github/dependabot.yml`. Aikido + Socket already cover CVE/SCA and supply-chain review |
| Actions allowlist | only GitHub-owned actions, verified creators, and explicit patterns can run (`zizmorcore/*` and `SocketDev/*` always included; extend with `--allowed-actions`). Workflows using anything else fail — grep `uses:` before applying |

Notes:

- On start the script compares itself to `jaredwray/agentic@main` and warns if this copy is stale
  (marketplace cache, old clone). The warning does not fail `--check` or apply — update the skill
  and re-run before applying.
- The agent never runs apply mode on its own: run `--check` with `--required-checks` and
  `--allowed-actions` freely for reconciliation, but stop and ask before changing repo settings, or
  hand the command to the maintainer.
- Rulesets are judged by their contents, not their name: `--check` validates enforcement, rule
  types, review count (0), last-push approval off, code-owner review, Restrict updates off, targets,
  and the bypass list, and apply mode overwrites a same-name ruleset with the canonical config — a
  pre-existing weak ruleset can't pass as compliant.
- The PR ruleset does not require an approving review (`required_approving_review_count: 0`) and
  does not require approval of the most recent push (`require_last_push_approval: false`). A PR is
  still required — no direct pushes. It does require a code-owner review (`require_code_owner_review`)
  of any path listed in `.github/CODEOWNERS`. **Restrict updates** is off (`update` rule absent);
  `--check` fails if it is on. The owner is on the bypass list: on a user-owned repo that is the
  owner user (`actor_type: User`); on an org-owned repo it is organization owners
  (`OrganizationAdmin`). The owner's bypass is **pull request** mode: they can merge without a
  review (including without a code-owner review) but still cannot push directly to the default
  branch.
- Private repos: fork-PR workflow approval and private vulnerability reporting are skipped (GitHub
  does not offer either on private repositories). On a free plan, rulesets need GitHub Pro/Team and
  secret scanning needs the Secret Protection add-on — the script reports these instead of failing.
- Manual fallback for the tag ruleset (GitHub UI): Settings → Rules → Rulesets → New tag ruleset;
  name `Tags only by admins`, Enforcement **Active**, add **Repository admins** to the bypass list,
  target **All tags**, enable **Restrict creations**.
- Dependabot: the script disables alerts and security-update PRs via the API. It cannot delete
  files, so `--check` fails while `.github/dependabot.yml` (or `.yaml`) is on the default branch —
  remove that file in a PR (the § 3 item, or the lockdown recording PR).
- Immutable releases: `--check` treats GET 404 as disabled. Owner-enforced org policy (`enabled`
  with `enforced_by_owner`) counts as done. Publish as a draft, attach assets, then publish — you
  cannot add files after a release is live. Existing releases stay mutable until republished.
- After apply, re-run `--check` with the same `--required-checks` and `--allowed-actions` and open a
  PR whose file change is checking off the lockdown item in `DEFENSE_IN_DEPTH.md` and adding the
  matching bullets to the `SECURITY.md` summary.

## References

- pnpm staged publishing: https://pnpm.io/cli/stage
- npm staged publishing: https://github.blog/changelog/2026-05-22-staged-publishing-and-new-install-time-controls-for-npm/
- npm trusted publishing (OIDC): https://docs.npmjs.com/trusted-publishers/
- npm 2FA / disallow tokens: https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/
- Drydock: https://drydock.org/
- actions-up: https://github.com/azat-io/actions-up
- zizmor: https://docs.zizmor.sh/
- Socket: https://socket.dev/
- Socket Firewall Free: https://docs.socket.dev/docs/socket-firewall-free
- SocketDev/action: https://github.com/SocketDev/action
- sfw-free releases: https://github.com/SocketDev/sfw-free/releases
- Aikido: https://www.aikido.dev/
- Aikido Safe Chain: https://github.com/AikidoSec/safe-chain
- pnpm settings: https://pnpm.io/settings
- GitHub rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use
- setup-node caching (disable in publishing workflows): https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md#caching-packages-data
- Jovi De Croock on the model this follows: https://jovidecroock.com/blog/secure-npm-publishing/
