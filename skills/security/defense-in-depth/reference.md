# Defense in Depth — reference

Implementation spec for the catalog items every repo shares. Section numbers match the
`DEFENSE_IN_DEPTH.md` block. Pull in the section you are implementing. What differs by ecosystem —
the dependency policy, the commands the install firewalls wrap, the CI setup action, and registry
publishing — lives in that ecosystem's rules file under [ecosystems/](./ecosystems/); each section
below names the rules-file section it relies on.

## 1. Security docs

Two files, two jobs:

- **`SECURITY.md`** — short and public-facing: how to report a vulnerability, plus a plain-language
  summary of what secures the repo. No checklists, no status.
- **`DEFENSE_IN_DEPTH.md`** — the working checklist this skill tracks progress in (format rules in
  `security-status-tracking`).

### SECURITY.md

The reporting boilerplate (a public GitHub issue plus an email to the maintainer, and what to
include in a report) is the `project-templates` skill's bundled template — reuse it rather than
writing new prose. This skill owns the summary section appended after it:

```md
## How this repository is secured

This repository follows the [defense-in-depth](https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth/SKILL.md)
hardening checklist; progress is tracked in [DEFENSE_IN_DEPTH.md](./DEFENSE_IN_DEPTH.md). Measures currently in place:

- All changes land through pull requests — direct pushes to `main` are blocked, and merging requires passing status checks.
- Tags can only be created by repository admins; published GitHub Releases are immutable (assets and tags cannot be changed after publish).
- Workflow runs from outside collaborators always require maintainer approval, and only allowlisted GitHub Actions can run.
- CI runs with read-only permissions (only jobs whose purpose is mutating the repo get `contents: write`); generated output is an artifact, never committed back; every action is pinned to a full commit SHA; Socket Firewall (`sfw`) wraps package installs; workflows are security-linted with zizmor on every PR.
- Codespaces, Cursor Cloud Agents, Claude Code on the web, and Codex cloud install through Aikido Safe Chain; package-manager shims must not be bypassed.
- The Codespaces Dev Container image is pinned by digest (`name:<tag>@sha256:<digest>`), not a floating tag.
- Dependencies install from a committed lockfile that CI refuses to change, and no version younger than 7 days is adopted. Socket reviews every dependency change; Aikido scans every build.
- Releases publish through OIDC trusted publishing after a maintainer approves them. There are no registry publish tokens.
```

**Only list what is live.** The bullets above are the full-rollout end state — include a bullet only
once its checklist item is checked in `DEFENSE_IN_DEPTH.md`, and update the summary in the same PR
that completes a section. A `SECURITY.md` that advertises controls the repo doesn't have is worse
than none. In the Safe Chain bullet, name Codex cloud only once its environment item is done, not
ticked off as not used. Keep the whole file under ~40 lines.

Word the last two bullets from the ecosystem blocks that are checked: name each package manager and
its controls (`pnpm with lifecycle scripts blocked and trustPolicy: no-downgrade`) and each registry
with its human gate (`npm releases are staged, reviewed in Drydock, and promoted with 2FA`; `PyPI
releases wait for approval on a protected GitHub environment`).

Private repos: drop the public GitHub issue step from the boilerplate (a private repository has
no public issue tracker) — the email contact is the reporting channel. Drop the "outside
collaborators require maintainer approval" clause from the summary (GitHub does not allow fork PR
approval on private repositories); keep the Actions allowlist clause.

### DEFENSE_IN_DEPTH.md scaffold

```md
# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth/SKILL.md.

Profile: <ecosystems> · <publishes to <registries> | publishes nothing> · <public | private>

## 1. Security docs
- [ ] `SECURITY.md` present — contact info + "How this repository is secured" summary
- [ ] `DEFENSE_IN_DEPTH.md` present (this file)

## 2. CODEOWNERS and cloud bootstrap
- [ ] `.github/CODEOWNERS` covers `/.github/`, `/.vscode/`, `/.cursor/`, `/.devcontainer/`, `/.claude/`, `/.codex/`, `/scripts/` with owners the maintainer names
- [ ] Codespaces, Cursor Cloud Agents, and Claude Code on the web bootstrap Aikido Safe Chain via scripts/setup-cloud-environment.sh (--ci shims, frozen lockfile); Claude Code runs it from `.claude/hooks/session-start.sh` (web sessions only, install log on stderr, 600s timeout) and `.gitignore` keeps `.claude/settings.json` and `.claude/hooks/` tracked
- [ ] Codex cloud environments use Manual setup with `bash ./scripts/setup-cloud-environment.sh` as the setup and maintenance script (manual)
- [ ] Claude Code on the web environments allow `malware-list.aikido.dev` (Custom network access plus the default package-manager list) (manual)
- [ ] Dev Container `image` pinned by digest (`name:<tag>@sha256:<digest>`; not a floating tag)

## 3. Dependencies
- [ ] No `.github/dependabot.yml`; other dependency-update tools (if any) open PRs only — never auto-merge
<the § 3 block of each ecosystem present>

## 4. GitHub Actions
- [ ] `permissions: contents: read` (or `{}` + per-job grants) on every workflow
- [ ] No `contents: write` except jobs whose purpose is mutating the repo (GitHub Release, Changesets version PR); generated output is a workflow artifact, never committed back from CI
- [ ] Every action pinned to a full commit SHA (`npx actions-up`)
- [ ] Every job installs Socket Firewall (`SocketDev/action` SHA-pinned, `firewall-version` pinned); every package install the firewall supports runs with the `sfw` prefix
- [ ] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR
- [ ] Workflow `name:` and job `name:` contain no spaces (kebab-case) so they can be set as required status checks
- [ ] `persist-credentials: false` on checkouts that don't push
- [ ] No `pull_request_target` on workflows that run untrusted PR code
- [ ] Artifact-publishing workflows restore no dependency or build cache (setup-action caching off) to prevent cache poisoning
- [ ] No registry publish tokens (or other registry credentials) in Actions secrets

## 5. Publishing
- [ ] GitHub environment `release` requires a reviewer and deploys only from the default branch and release tags (manual)
<the § 5 block of each ecosystem that publishes>

## 6. Security tooling
- [ ] Aikido runs on every build
- [ ] Aikido release gate: every publish job in the release workflow `needs:` a passing `scan-release`
- [ ] Socket reviews every PR that changes dependencies

## 7. Repository lockdown
- [ ] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub account and every package-registry account that can publish (manual)
- [ ] Recovery codes stored offline in a password manager (manual)
- [ ] `lockdown-repo.sh` applied by a repo admin (never committed to this repo); `--check` with `--required-checks` and `--allowed-actions` passes (PRs required on the default branch, merges blocked unless required status checks pass, tag ruleset, immutable releases, fork-PR approval (public repos), read-only workflow tokens, Actions allowlist, secret scanning, Dependabot disabled, private vulnerability reporting (public repos))
```

Assemble the catalog when scaffolding:

- **§ 3** — after the Dependabot item, add the § 3 block from the **Catalog** section of each
  ecosystem's rules file, in the order of the ecosystem table in `SKILL.md`. Each block starts
  with its own `### ` heading.
- **§ 5** — add the § 5 block of each ecosystem that publishes. Omit the `release` environment
  item when npm is the only registry: staging is npm's human gate. A repo that publishes nothing
  omits § 5 and the Aikido release-gate item.
- **private** — omit the private-vulnerability-reporting and fork-PR approval clauses from the
  lockdown item; keep the plan-gated settings only if the plan supports them (the lockdown script
  reports this).
- **no ecosystem the Safe Chain bootstrap covers** — omit the Safe Chain cloud-bootstrap item and
  the Codex and Claude Code environment items.
- **no `devcontainer.json`** — omit the Dev Container image-pin item.

## 2. CODEOWNERS and cloud bootstrap

File PRs. GitHub repo settings are § 7 and a repo admin runs them last. Never check `lockdown-repo.sh` into the target repo.

### CODEOWNERS

Copy this template into `.github/CODEOWNERS`. **Ask who the owners are** (`@user` and/or
`@org/team`, one or more) and substitute `{{OWNERS}}`. Never hardcode a username and never guess
from the repo owner login; if the user already named owners in this conversation, use those.

```
# High-risk paths. Last matching pattern wins.
# Root-anchored so nested copies (e.g. skills/**/scripts/) are not owned here.
/.github/ {{OWNERS}}
/.vscode/ {{OWNERS}}
/.cursor/ {{OWNERS}}
/.devcontainer/ {{OWNERS}}
/.claude/ {{OWNERS}}
/.codex/ {{OWNERS}}
/scripts/ {{OWNERS}}
```

Cover `.vscode/`, `.cursor/`, `.devcontainer/`, `.claude/`, and `.codex/` even before those
directories exist so a later add is already owned. This skill writes nothing to `.codex/`, but a
trusted project's `.codex/config.toml` and hooks run commands in Codex sessions. Pair with a second
trusted reviewer when the bus factor allows.

`lockdown-repo.sh --check` (§ 7) fails if the default branch has no CODEOWNERS file with at least
one owner (looks in `.github/CODEOWNERS`, then `CODEOWNERS`, then `docs/CODEOWNERS`). The script
never writes that file.

### Safe Chain on Codespaces, Cursor Cloud Agents, and Claude Code on the web

File PR (`chore/defense-safe-chain-cloud`). Applies when the repo has a Node (pnpm) or Python root —
the ecosystems Safe Chain shims. Skip it otherwise; each rules file's **Install protection** section
says whether the bootstrap covers it. Copy the bundled [`./scripts/setup-cloud-environment.sh`](./scripts/setup-cloud-environment.sh) to the
target's `scripts/setup-cloud-environment.sh`, and copy from this skill's `templates/`:

| Source | Target path |
| --- | --- |
| `templates/.devcontainer/devcontainer.json` | `.devcontainer/devcontainer.json` |
| `templates/.cursor/environment.json` | `.cursor/environment.json` |
| `templates/.claude/settings.json` | `.claude/settings.json` |
| `templates/.claude/hooks/session-start.sh` | `.claude/hooks/session-start.sh` |
| `templates/AGENTS.md` | `AGENTS.md` (section only — see merge rules) |
| `@AGENTS.md` (one line) | `CLAUDE.md` (import only — see merge rules) |
| `scripts/setup-cloud-environment.sh` | `scripts/setup-cloud-environment.sh` |

The bootstrap installs [Aikido Safe Chain](https://github.com/AikidoSec/safe-chain) from a **pinned**
release, verifies the official installer SHA-256, runs `--ci` so the npm and Python package managers
use shims, persists those shim paths, and checks the shims with `<manager> safe-chain-verify`. Then it
runs the frozen install of every tracked lockfile, in that lockfile's directory:
`pnpm install --frozen-lockfile` for `pnpm-lock.yaml`, `uv sync --locked` for `uv.lock`, and
`poetry sync` for `poetry.lock`. A root with only requirements files gets the shims and no install.
It fails closed — no lockfile or requirements file, no run; no unprotected install; no `latest`
installer. Bump the version and digest in the bundled script the same way Socket Firewall's
`firewall-version` is bumped; do not fetch "latest" when applying.

Greenfield templates: Codespaces uses a **digest-pinned**
`mcr.microsoft.com/devcontainers/javascript-node:<version>-<variant>@sha256:<digest>` image (no
Dockerfile; never `:latest`). In a repo with no Node root, replace the template's `name` and `image`
with the Dev Container image its rules file names, resolved to `name:<tag>@sha256:<digest>` per
[Pin Dev Container images](#pin-dev-container-images). The template installs GitHub CLI plus Docker
via Dev Container Features
(`ghcr.io/devcontainers/features/github-cli:1` and
`ghcr.io/devcontainers/features/docker-in-docker:4` with `"moby": false` — Trixie has no Moby
packages). Cursor uses a managed environment with only `install` (no `build`, no Dockerfile, no
snapshot). Claude Code on the web uses a SessionStart hook in `.claude/settings.json` whose
command is `bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.sh` with `"timeout": 600`. The
hook script runs only when `CLAUDE_CODE_REMOTE` is `true` — local Claude Code sessions exit 0 with
no output — then `cd`s to `$CLAUDE_PROJECT_DIR` and runs `bash ./scripts/setup-cloud-environment.sh >&2`.
Hook stdout is injected into the session; the install log must not land there. The default hook
timeout is 60s, which kills a cold Safe Chain install, so 600 is required. It sets no `matcher`,
so resume, `/clear`, compaction, and forks re-run it, and it is not `async`, so the shims exist
before Claude runs a command. Invoke the hook with `bash` so it does not need the executable bit.
Codespaces and Cursor still invoke `bash ./scripts/setup-cloud-environment.sh` directly.
Leave `postCreateCommand`, `install`, and the hook `command` as those invocations — do not wrap
them in `bash -i`, `source ~/.bashrc`, or `source "$NVM_DIR/nvm.sh"`. A fresh Codespace runs a
non-interactive shell, so those only help an already-open terminal (`source ~/.bashrc` after a
one-off run). If `pnpm` is missing, the script enables Corepack's `pnpm` shim into
`~/.safe-chain/bin` (`--install-directory`) so it does not EACCES on the javascript-node image's
root-owned `/usr/local/bin`. If `uv` or `poetry` is missing and `pipx` is on `PATH`, the script
installs it with `pipx` into `~/.safe-chain/bin` once the shims are in place, so that install is
protected too. It runs the pinned installer from `/` so an in-repo `.nvmrc` cannot make NVM's
optional legacy scan return 3. The template snapshot is already 7-day-aged; refresh of
that pin later is `dependency-management`, not this item.

The script's `PATH` export stays in its own process. Any follow-on package-manager command in the
same `install` / `postCreateCommand` string must put the shims on `PATH` in that shell:

```bash
bash ./scripts/setup-cloud-environment.sh && export PATH="$HOME/.safe-chain/shims:$HOME/.safe-chain/bin:$PATH" && …
```

Claude Code's Bash tool starts each command from a shell snapshot taken at launch, not from the rc
files, so the script also appends the shim `PATH` to `CLAUDE_ENV_FILE`, which Claude Code runs before
every Bash command. A failed SessionStart hook does not stop the session, so the script writes that
line before anything can fail and seeds `~/.safe-chain/shims` with stubs for `npm`, `npx`, `pnpm`,
`pnpx`, `pip`, `pip3`, `pipx`, `uv`, `uvx`, `poetry`, and `pdm` that exit 1, and with `python` /
`python3` stubs that run Python but refuse a package manager run as a module (`python -m pip`),
until Safe Chain's `setup-ci` replaces them: a failed bootstrap leaves package
installs blocked, not unprotected. The hook script must not append `PATH` itself after the bootstrap
returns — that write would be skipped when the bootstrap fails. A session with several
repositories loads no repo hooks, so run Claude Code sessions on this repo alone. `CLAUDE.md`
imports `@AGENTS.md` because Claude Code reads only `CLAUDE.md` when both files exist, and some
sessions never read `AGENTS.md` (versions before 2.1.277, third-party providers, the first session
after an install).

`.gitignore` must not hide the hook. A line `.claude` or `.claude/` ignores the directory, and Git
will not re-include anything underneath it. Use this block (replace a blanket `.claude` /
`.claude/` rule with it; if `.claude/*` is already present, add only the two negations that are
missing; if no Claude rule exists, append the block):

```
# AI (keep the shared Claude Code settings and hooks; ignore local state)
.claude/*
!.claude/settings.json
!.claude/hooks/
```

`settings.local.json` and other `.claude` entries stay ignored. Do not un-ignore them.

Merge — never blindly overwrite:

| File | Missing | Already present |
| --- | --- | --- |
| `scripts/setup-cloud-environment.sh` | Copy from the skill | Replace with the skill's script (this is the security control) |
| `.claude/hooks/session-start.sh` | Copy from the skill | Replace with the skill's script (this is the security control) |
| `.devcontainer/devcontainer.json` | Write the template | Keep existing keys, image, and Dockerfile. Set or chain `postCreateCommand` with the same-shell pattern above so the bootstrap runs and later installs stay shimmed. Detect GitHub CLI / Docker by feature id, ignoring the tag (`github-cli`, `docker-in-docker`, `docker-outside-of-docker`, `docker-from-docker`). If no GitHub CLI feature is present, add `github-cli:1`. If no Docker feature is present, add `docker-in-docker:4` with `"moby": false`. Do not add a second copy of either. Do not add a Dockerfile. Do not replace an existing image with the template image — pinning that image is the next item. |
| `.cursor/environment.json` | Write `{ "install": "bash ./scripts/setup-cloud-environment.sh" }` | Keep other keys; if `install` exists, prepend the same-shell pattern above unless it already runs the script. Do not add `build` or a Dockerfile. |
| `.claude/settings.json` | Write the template | Keep other keys and hooks. Replace a SessionStart hook that already runs the bootstrap (inline or via `session-start.sh`) with the template's hook (`bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.sh`, `"timeout": 600`, no `matcher`, not `async`); if none does, add the template's `SessionStart` group. All matching hooks run in parallel, so remove package installs from other SessionStart hooks — the bootstrap already runs the frozen installs. |
| `.gitignore` | Append the `.claude/*` block above | Replace a `.claude` or `.claude/` directory rule with that block. If `.claude/*` is already there, add `!.claude/settings.json` and `!.claude/hooks/` when missing. |
| `AGENTS.md` | Write every template section | Compare each template section per `agentic-upstream-sync` (Compare, step 3): append a missing one, replace a stale one, and list a locally edited one in the PR body. Leave other content alone. |
| `CLAUDE.md` | Write `@AGENTS.md` | Add `@AGENTS.md` as the first line unless it already imports `AGENTS.md` (or is a symlink to it); leave the rest alone. |

Stop and report if `devcontainer.json`, `environment.json`, or `.claude/settings.json` is not valid
JSON. A leftover catalog line about PMG / VM-egress filtering is dropped in this PR (list it in the
body).

Reconcile Safe Chain as done when the bootstrap script is present, the Dev Container and Cursor
configs invoke it, `.claude/hooks/session-start.sh` matches the template, `.claude/settings.json`
runs that hook with timeout 600, `.gitignore` does not ignore `.claude/settings.json` or
`.claude/hooks/`, `CLAUDE.md` imports `@AGENTS.md`, and every template section in `AGENTS.md` is
current or locally edited — a repo hardened before the hook script, the timeout, the stderr
redirect, the gitignore exceptions, or a template section existed is not done until they are added,
and a stale section is not done until it is replaced. Image digest pinning is the next item — a
greenfield copy of the template already satisfies it.

### Codex cloud and Claude Code environments (manual)

Both products keep part of their setup in account settings, not in the repo. The agent reports these
two items and moves on; a maintainer who does not run this repo in that product ticks its item off as
not used.

- **Codex cloud** — setup and maintenance scripts are environment settings. In each Codex environment
  for this repo, choose **Manual** setup (Automatic setup installs dependencies itself, without Safe
  Chain) and set both the setup script and the maintenance script, which runs when a cached container
  resumes, to `bash ./scripts/setup-cloud-environment.sh`. The setup script runs in its own Bash
  session with internet access; the agent gets the shims from the `~/.bashrc` line the script writes,
  and reads `AGENTS.md` natively. Agent internet access is off by default; if you enable it, allow
  `malware-list.aikido.dev` too so Safe Chain checks packages against a current list.
- **Claude Code on the web** — the SessionStart hook runs the bootstrap, but network access is an
  environment setting. The default **Trusted** allowlist omits `malware-list.aikido.dev`, so Safe
  Chain cannot load its malware list and fails every package add closed. Set **Custom** network
  access, check **Also include default list of common package managers**, and add
  `malware-list.aikido.dev`. Do not move the bootstrap into the environment's setup script: a setup
  script gets a 403 on release assets from repositories not attached to the session, such as the
  pinned Safe Chain installer.

### Pin Dev Container images

File PR (`chore/defense-devcontainer-pin`). Skip when the repo has no `devcontainer.json`
(`.devcontainer/devcontainer.json`, `.devcontainer/*/devcontainer.json`, or repo-root
`devcontainer.json`). Features tags (`github-cli:1`, `docker-in-docker:4`) stay as they are.

This is the Actions SHA-pin analog for Codespaces: a floating tag (`:latest`, `:24`) can be
retagged to a compromised image; `name:<tag>@sha256:<digest>` is immutable. Use the **index**
digest (manifest list), not a per-platform digest, so amd64 and arm64 stay under one pin.

For each file's `image` property:

1. Already `name:<tag>@sha256:<64 hex>` and `<tag>` is not `latest` → leave it. Refresh rides
   `dependency-management` under the same 7-day age gate.
2. Missing (`build` / `dockerFile` instead) → skip that file. Dockerfile `FROM` pins are the
   Docker image groups in `dependency-management`.
3. Unpinned or floating → inspect with `skopeo` (or `crane`). The target is the newest digest in
   the current lineage whose image `Created` is at least **7 days** ago — the same window as the
   dependency cooldown. A missing `Created` is ineligible (fail closed). Rewrite to
   `name:<versioned-tag>@sha256:<index-digest>`. Never leave `:latest` as the tag, even with a
   digest. On Microsoft Dev Container images, prefer the `version` + `dev.containers.variant`
   labels (e.g. `5.0.2-24-trixie`). Lineage is the runtime version plus OS family (`24-trixie` for
   Node 24); a new runtime version is breaking — stop and ask. If no digest in lineage is 7 days old, skip and report.
4. Do not replace an existing image with the greenfield template image.

Stop and report if a `devcontainer.json` is not valid JSON.

Reconcile as done when every `image` value is digest-pinned with a non-`latest` tag, or there is
no `image` key to pin.

## 3. Dependencies

Each ecosystem's checklist is the § 3 block of its rules file, and the spec is that file's
**Dependency policy** section. Every policy aims at the same four controls, as far as its package
manager can express them:

| Control | What it stops |
| --- | --- |
| Committed lockfile, frozen in CI | CI fails instead of resolving a version nobody reviewed |
| 7-day cooldown on new versions | Almost every registry compromise is caught and pulled within days |
| No dependency code at install time, or a reviewed allowlist | A package cannot run code just by being installed |
| Only the expected registry | A dependency cannot arrive from a git URL, a tarball, or a look-alike feed |

Where a package manager cannot express a control, its rules file says so and names what stands in
for it. Never claim a control in `SECURITY.md` that the rules file says the manager lacks.

- One item covers every package root of its ecosystem: apply it in each root in the same PR.
- A cooldown or trust setting never gains an exclude to unblock a too-new version — first-party
  packages included. A hijacked maintainer account shipping a malicious version of *our* package is
  what those gates catch.
- No Dependabot. Do not add `.github/dependabot.yml`. GitHub-native alerts and security-update
  PRs are disabled in § 7. Aikido already does CVE/SCA and Socket already reviews dependency
  diffs; a third overlapping scanner is noise, not an independent control. If another updater
  (Renovate) is already configured, it opens PRs through normal review — never auto-merge. Don't
  add an updater where none exists.

## 4. GitHub Actions

- Default every workflow to least privilege: top-level `permissions: contents: read` (or
  `permissions: {}` with per-job grants). `id-token: write` appears only on a publish job.
- No `contents: write` except jobs whose purpose is mutating the repo. Generated output is a
  workflow artifact, never committed back from CI — a compromised action in that job then cannot
  push `main`. `id-token: write` on a publish job is OIDC (§ 5), not repo write.
- **Pin by SHA with [actions-up](https://github.com/azat-io/actions-up):** `npx actions-up` scans
  every workflow and composite action, updates to the latest release, and pins to the full commit
  SHA with a version comment. Use it for the initial pinning PR; afterwards pin refresh rides
  `dependency-management`. Never hand-resolve SHAs. It runs through `npx`, so it needs Node on the
  machine that runs it, not in the repo.
- `persist-credentials: false` on every `actions/checkout` that doesn't need to push.
- No `pull_request_target` for workflows that check out or execute untrusted PR code; don't share
  caches across trust boundaries.
- Artifact-publishing workflows (registry publish, GitHub Releases, OIDC, attestations) restore no
  dependency or build cache: a poisoned Actions cache can run attacker-controlled code in a job
  that holds publish credentials. Each rules file's **CI** section names the setup-action input
  that turns its cache off and the cache actions to leave out. Regular CI may still cache.
- No registry publish tokens in Actions secrets — publishing is OIDC-only (§ 5).
- Workflow `name:` and job `name:` contain no spaces (kebab-case). GitHub rulesets cannot require
  a status check whose name has a space, so `--required-checks` in § 7 can only name those
  space-free checks. Step names may still have spaces. Details below.
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
name: build-generated-files

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

Socket Firewall Free is wrapper-mode only. Every package-manager command it supports is invoked
with the `sfw` prefix — do not rely on PATH shims (`corepack enable` and later PATH changes can
shadow them). Each rules file's **Install protection** section lists the commands to wrap and the
frozen install a job runs behind it (`sfw pnpm install --frozen-lockfile`, `sfw uv sync --locked`,
`sfw cargo fetch --locked`). A package manager the firewall does not wrap runs unprefixed; its
rules file says what protects it instead.

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
- Rewrite every existing install step the rules files name to its `sfw` form in the same PR.
  Reconcile as done when every job with `steps:` has the Firewall step and no workflow install the
  firewall supports is missing the prefix.

### CI security linting: check-workflows.yaml

Add `.github/workflows/check-workflows.yaml` running [zizmor](https://docs.zizmor.sh), the GitHub
Actions security linter — it catches template injections, excessive permissions, unpinned actions,
cache poisoning, and credential persistence:

```yaml
name: check-workflows

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
      # SARIF upload. GitHub grants read-only on fork PRs regardless; permission
      # values cannot be expressions, so the write grant stays and the zizmor
      # step below skips Advanced Security on forks.
      security-events: write
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
        with:
          # Fork PRs cannot upload SARIF (read-only token). Lint with annotations instead.
          advanced-security: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}
          annotations: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository }}
```

Fork PRs from public repos receive a read-only `GITHUB_TOKEN`, so the default SARIF upload
fails even when the workflow requests `security-events: write`. Permission *values* cannot
be expressions (GitHub rejects `${{ github.… }}` there as an unrecognized named-value), and
GitHub already ignores the write grant on those runs. The template keeps `security-events:
write` for same-repo PRs and pushes, and sets `advanced-security: false` plus `annotations:
true` on forks (the two inputs are mutually exclusive). Annotation mode fails the job on
findings.

Private repos without Advanced Security can't upload SARIF on any event — set
`advanced-security: false` and `annotations: true` on the zizmor step, drop the
`security-events` grant, and omit the fork expressions.

After copying the template, run `npx actions-up` so the action pins are current rather than trusting
this file's snapshot, and look up the current reviewed sfw-free version for `firewall-version`.

### Workflow and job names

File PR (`chore/defense-actions-workflow-names`). GitHub rulesets cannot require a status check
whose name contains a space, so `--required-checks` in § 7 can only name checks that are
space-free.

- Workflow `name:` is kebab-case (`check-workflows`, `release`, `ci`). Rename any
  `Check Workflows` / `CI Tests` style names.
- Job `name:` (when set) is the check context, not the job id. Omit it (the job id is the
  check) or use kebab-case. Step names may still have spaces — they are not status checks.

Reconcile as done when every workflow `name:` and job `name:` in `.github/workflows/` has no
spaces.

## 5. Publishing

Applies to every ecosystem that publishes a package. The model is the same on every registry:
**CI can build, only a human can ship, and no long-lived publish credential exists.**

1. **OIDC trusted publishing** — the publish job exchanges a short-lived GitHub OIDC token
   (`id-token: write` on that job only) for a registry credential that lasts minutes. No registry
   token sits in Actions secrets or on a laptop.
2. **A human gate the workflow cannot skip** — how depends on the registry:
   - **npm** stages the version: CI can only stage, Drydock reviews the staged artifact, and a
     maintainer promotes it with 2FA.
   - **PyPI, crates.io, and nuget.org** publish an upload at once, so the gate is in front of the
     upload: the publish job runs in the `release` GitHub environment, which waits for a
     maintainer's approval, and the registry's trusted publisher names that environment — it
     rejects a token minted by any other job.
3. **The job that can publish runs no dependency code** — where the registry has no staging step,
   building and publishing are separate jobs. The build job installs, builds, and tests with no
   `id-token`; the publish job downloads the built artifact and uploads it.
4. **Published versions are permanent** — no registry here lets a version be replaced. A bad
   release is yanked, unlisted, or deprecated, and fixed with a new version.

Each rules file's **Publishing** section holds the registry's setup, its `(manual)` settings, and
its release jobs. A Go module publishes by tag and adds nothing here.

### release.yaml

File PR, one per registry. All registries share one workflow, `.github/workflows/release.yaml`,
because every trusted publisher names that filename. Start from this skeleton and append the
release jobs of each publishing ecosystem's rules file; every one of them `needs: [aikido-gate]`,
directly or through its build job. After copying, run `npx actions-up` so the action pins are
current rather than trusting this file's snapshot, and look up the current reviewed sfw-free
version for `firewall-version`.

If the repo already has a publish workflow, do not replace a custom pipeline wholesale — move its
publish step to the shape the rules file describes. A new workflow includes the Aikido gate so no
publish job is ever ungated; when a publish workflow already exists, § 6 adds the gate as its own
PR.

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
```

### The release environment (manual)

Only for PyPI, crates.io, and nuget.org; npm's gate is staging. The environment is a repository
setting a maintainer creates under *Settings → Environments*:

- Name it `release` — the name the publish jobs and the trusted publishers use.
- **Required reviewers**: at least one maintainer. A run then stops at the publish job until a
  reviewer approves it in the GitHub UI; the workflow's own token cannot approve.
- **Deployment branches and tags**: *Selected branches and tags* — the default branch and the
  release tag pattern (`v*`).
- Add no environment secrets: the registry credential comes from OIDC.

Environments are available on public repositories on every plan; a private repository needs GitHub
Pro or Team, and some protection rules have limited availability there. When required reviewers
cannot be set, the environment still scopes the trusted publisher, but nothing waits for a human —
report that instead of ticking the item. One approval from the listed reviewers releases the job.

The agent reports this item with the registry-side `(manual)` settings and moves on. Reconcile it
with `gh api repos/<owner>/<repo>/environments/release`: done when `protection_rules` has a
`required_reviewers` rule and `deployment_branch_policy` is not null.

## 6. Security tooling

Both layers are GitHub apps already used across these repos — installing the app on the repo is the
whole setup, and each item is verified by its check appearing on PRs.

- **Aikido** ([aikido.dev](https://www.aikido.dev)) runs on every build — SCA/CVE scanning, secrets,
  SAST. Aikido also partners with Drydock, so pre-publish review and build-time scanning share
  findings. Code its release gate into the release workflow (`release.yaml` / `publish.yml`): an
  `aikido-gate` job runs `aikido-api-client scan-release … --fail-on-sast-scan --fail-on-iac-scan
  --fail-on-secrets-scan` and every publish job `needs:` it, so nothing is published or staged
  while new findings are open — the job is in the § 5 `release.yaml` skeleton. The client installs
  from npm, so the gate job sets up Node whatever the repo's ecosystem.
- **Socket** ([socket.dev](https://socket.dev)) is the dependency security linter: it reviews every
  PR that changes dependencies for supply-chain behavior — new install scripts, network access,
  obfuscated code, typosquats, maintainer changes — the risks CVE scanners can't see yet. CI
  install-time blocking is Socket Firewall in § 4, not this GitHub-app item.
- Secret scanning and push protection are repo settings — § 7 owns them. Dependabot stays off
  (alerts, security-update PRs, and `.github/dependabot.yml`) for the same reason: Aikido and
  Socket already cover that ground.

## 7. Repository lockdown

**Always last. Never checked into a repo. Admin only.** Do not apply until every preceding
applicable catalog item is checked and on `main` — auto-implementable file items and every
`(manual)` task (registry-side settings, account 2FA, recovery codes). File items first so
`--required-checks` names the real CI jobs, the Actions allowlist matches `uses:` in the landed
workflows, and CODEOWNERS exists before `require_code_owner_review` is enforced. `--check` during
audit is always allowed; apply mode is not.

**Never copy or commit [`./scripts/lockdown-repo.sh`](./scripts/lockdown-repo.sh) into the target
repo.** It lives only in this skill. A repo admin runs it last from the skill (or an uncommitted
local copy), after every earlier item including all `(manual)` tasks. The script applies every
GitHub-side setting in this section idempotently via `gh`, and audits them with `--check`.

```bash
# audit — safe anywhere, changes nothing, exits 1 if anything is off
lockdown-repo.sh jaredwray/keyv --check --required-checks "test,zizmor"

# apply — repo admin only; never committed to the target; only after every earlier item including manuals
lockdown-repo.sh jaredwray/keyv --required-checks "test,zizmor" --allowed-actions "changesets/*"
```

Before apply, take both flags from the repo as it stands on `main`:

- `--required-checks` — the job names from `.github/workflows/` (e.g. `test,zizmor`). Names must
  not contain spaces (GitHub cannot require a check whose name has a space); rename the
  workflow/job first (§ 4).
- `--allowed-actions` — extra `uses:` owners not already covered (GitHub-owned, verified creators,
  `zizmorcore/*`, and `SocketDev/*` are always allowed). Grep `uses:` first.

What it sets:

| Setting | Value |
| --- | --- |
| Default workflow token | `read` only, and Actions cannot create or approve PRs |
| Fork-PR workflow approval | `all_external_contributors` — a maintainer approves every outside collaborator's run (public repos only) |
| Branch ruleset "Pull requests required" | PR required on the default branch with **0 required approving reviews**, **last-push approval off**, **code owner review** of owned paths, and **Restrict updates off**. The owner is on the bypass list in **pull request** mode: they may merge without a review but still cannot push directly. Force pushes and deletion blocked |
| CODEOWNERS | `.github/CODEOWNERS` on the default branch names at least one owner. The script audits this; adding the file is the § 2 PR. Without it `require_code_owner_review` is a no-op |
| Required status checks | with `--required-checks "<c1,c2>"`, merging is blocked unless those checks pass — name the repo's CI jobs (e.g. `test,zizmor`); names must not contain spaces |
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
- The agent never runs apply mode and never copies the script into the target repo. Run `--check`
  with `--required-checks` and `--allowed-actions` freely for reconciliation, then hand the apply
  command to a repo admin. Apply is always last: after every earlier auto item and every `(manual)`
  task.
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

Registry and package-manager links are in each rules file under [ecosystems/](./ecosystems/).

- actions-up: https://github.com/azat-io/actions-up
- zizmor: https://docs.zizmor.sh/
- Socket: https://socket.dev/
- Socket Firewall Free: https://docs.socket.dev/docs/socket-firewall-free
- SocketDev/action: https://github.com/SocketDev/action
- sfw-free releases: https://github.com/SocketDev/sfw-free/releases
- Aikido: https://www.aikido.dev/
- Aikido Safe Chain: https://github.com/AikidoSec/safe-chain
- GitHub environments and required reviewers: https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment
- GitHub rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use
