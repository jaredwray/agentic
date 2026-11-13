# Node

Rules for a Node package root: the directory that holds `pnpm-lock.yaml`, covering its workspaces.
The registry is npm.

## Package manager

- **pnpm** — `pnpm-lock.yaml`. Everything below is written for pnpm 11.3 or newer (`pnpm stage`
  landed in 11.3).
- **Anything else** (`package-lock.json`, `yarn.lock`, `bun.lock` and no `pnpm-lock.yaml`) —
  unsupported. These rules need pnpm, and moving a root to pnpm is the user's call: report the
  root and add no Node block for it.

## Catalog

The § 3 block:

```md
### Node (pnpm)
- [ ] `packageManager: pnpm@11.3+` pinned in `package.json`
- [ ] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false`; no first-party `minimumReleaseAgeExclude`
- [ ] `trustPolicy: no-downgrade`; no first-party `trustPolicyExclude`
- [ ] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline
- [ ] `blockExoticSubdeps: true`
- [ ] Lockfile committed; CI installs with `pnpm install --frozen-lockfile`
```

The § 5 block, only when the root publishes to npm:

```md
### npm
- [ ] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live (manual)
- [ ] `.github/workflows/release.yaml` packs then stages with `pnpm stage publish ./packed/*.tgz --no-git-checks`
- [ ] Maintainer promotes staged versions with 2FA (manual)
- [ ] Drydock connected — staged releases reviewed before promotion (manual)
- [ ] No direct publish rights: package requires 2FA and disallows tokens (manual)
- [ ] `package.json` `repository.url` accurate so provenance maps to this repo
```

## Dependency policy

Put the policy in `pnpm-workspace.yaml` so it's code-reviewed, not developer-local:

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
- CI installs use `--frozen-lockfile` so CI fails if the lockfile would change.
- Renovate, where it is already configured: Drydock's
  `github>JoviDeCroock/drydock//renovate/diff-links` preset adds artifact-diff links to its update
  tables.

## Install protection

- **CI — Socket Firewall.** Every `pnpm install` and `npm install` (including
  `npm install --global`) runs with the `sfw` prefix: `sfw pnpm install --frozen-lockfile`,
  `sfw npm install …`.
- **Cloud environments — Safe Chain.** The bootstrap shims `npm`, `npx`, `pnpm`, and `pnpx`, runs
  `pnpm safe-chain-verify`, and installs with `pnpm install --frozen-lockfile`. If `pnpm` is missing
  and `package.json` has `packageManager`, the bootstrap enables Corepack's `pnpm` shim into
  `~/.safe-chain/bin` (`--install-directory`) so it does not EACCES on the javascript-node image's
  root-owned `/usr/local/bin`.
- **Dev Container image** for a new `devcontainer.json`:
  `mcr.microsoft.com/devcontainers/javascript-node`. The lineage is the Node major plus OS family
  (`24-trixie`).

## CI

- Set up with `actions/setup-node`, then `corepack enable` and `corepack prepare`; `packageManager`
  selects the pnpm version.
- **Publishing workflows restore no cache.** Set `package-manager-cache: false` on every
  `actions/setup-node` step and do not set `cache:` to a package manager. `setup-node` otherwise
  enables npm caching by default when `package.json` names npm.

## Publishing

A root publishes when a `package.json` in it has no `"private": true` and has a publishable name and
exports (workspaces: any published package).

The publishing model, end to end: **CI can stage, only a human can ship, and a second system reviews
the artifact in between.**

1. **OIDC trusted publishing, stage-only** — the publish workflow authenticates to npm with a
   short-lived OIDC token (`id-token: write` on that job only), and the trusted publisher is
   configured **stage-only** on npmjs.com, so even a tampered workflow cannot publish live. No npm
   publish tokens exist anywhere: not in Actions secrets, not on laptops (Drydock's read-only
   review token is the one npm credential held outside npm). Provenance is generated
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

Staging is the human gate, so the npm job needs no reviewer-gated GitHub environment.

npmjs.com setup (manual, per package): configure the trusted publisher (GitHub Actions provider →
exact repo, workflow filename `release.yaml`, and environment if the job uses one) as
**stage-only**, connect Drydock, then set **Require two-factor authentication and disallow tokens**.
Keep `repository.url` accurate so provenance maps to the repo.

Connecting Drydock: create a [Drydock](https://drydock.org/docs) organization and give it a
granular npm token — **Packages and scopes: Read-only** on the staged packages, **Organizations:
No access** — under *Organization settings → npm access*; it discovers staged versions on its
own. Record each decision in Drydock, then approve or reject on npm with 2FA — promotion always
happens on npm.

### Audit npmjs settings

Audit those registry settings with [`../scripts/check-npmjs.sh`](../scripts/check-npmjs.sh).
**Never copy or commit it into the target repo.** It is check-only — trusted-publisher writes need
interactive 2FA, so apply is not a mode. A maintainer still configures npmjs.com; the script is how
the agent reconciles the npm block during audit. A clean run means the readable npmjs items match; a
FAIL does not jump the queue.

```bash
# from a package checkout, after npm login (NPM_TOKEN is not allowed)
check-npmjs.sh --repo jaredwray/keyv --workflow release.yaml

# one package, or several:
check-npmjs.sh keyv @keyv/redis --repo jaredwray/keyv --workflow release.yaml
```

`--repo` defaults to the current checkout (`gh`, `origin`, or `package.json`). `--workflow`
defaults to the repo workflow that runs `stage publish`, or `release.yaml`. `--environment`
is optional; when set, the trusted publisher must use that GitHub environment.

What it checks, per publishable package:

| Setting | Required value |
| --- | --- |
| Trusted publisher | exactly one, `type: github` |
| `claims.repository` | this GitHub `owner/repo` |
| `claims.workflow_ref.file` | the stage-publish workflow filename |
| `permissions` | `["createStagedPackage"]` only — `createPackage` (live publish) fails; a missing permissions field is legacy publish-only and also fails |
| Publishing access | `publish_requires_tfa=true` and `automation_token_overrides_tfa=false` when the registry exposes those fields. `GET /-/package/{pkg}/access` is not allowed on registry.npmjs.org, so this check is skipped with the npmjs.com URL rather than treated as passing |
| Packument `repository.url` | maps to this GitHub repo |

Drydock connection and human 2FA promotion are not npmjs API settings; they stay `(manual)`.
A skip is not a pass. On start the script compares itself to `jaredwray/agentic@main` and
warns if this copy is stale (does not fail the run).

### Release job

File PR (`chore/defense-node-stage-publish`). Add this job to the release workflow in
[reference.md § 5](../reference.md#5-publishing). Adapt the test script (`pnpm test:ci` vs
`pnpm test`), Node version, and pack command to the repo. `packageManager` must be pnpm 11.3+ so
Corepack provides `pnpm stage publish` — do not install the npm CLI for staging.

If the repo already has a publish workflow, do not replace a custom pipeline wholesale — switch its
publish step to pack + `pnpm stage publish ./<dir>/*.tgz --no-git-checks`.

```yaml
  stage-npm:
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

## Verify

`sfw pnpm install --frozen-lockfile` once Socket Firewall is on the machine (otherwise
`pnpm install --frozen-lockfile`), then `pnpm build` and `pnpm test` where those scripts exist.

## References

- pnpm settings: https://pnpm.io/settings
- pnpm staged publishing: https://pnpm.io/cli/stage
- npm staged publishing: https://github.blog/changelog/2026-05-22-staged-publishing-and-new-install-time-controls-for-npm/
- npm trusted publishing (OIDC): https://docs.npmjs.com/trusted-publishers/
- npm 2FA / disallow tokens: https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/
- npm `trust` CLI: https://docs.npmjs.com/cli/v12/commands/npm-trust/
- npm registry API (trust + access): https://api-docs.npmjs.com/
- Drydock: https://drydock.org/
- Drydock docs (Stage Watchtower setup, Workflow Gate, dependency diff links): https://drydock.org/docs
- setup-node caching (disable in publishing workflows): https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md#caching-packages-data
- Dev Container javascript-node images: https://mcr.microsoft.com/artifact/mar/devcontainers/javascript-node
- Jovi De Croock on the model this follows: https://jovidecroock.com/blog/secure-npm-publishing/
