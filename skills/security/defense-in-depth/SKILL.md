---
name: defense-in-depth
description: Harden a repository against supply-chain compromise one PR at a time — Node (pnpm), Rust, .NET, Python (uv, Poetry, or pip-tools), and Go, alone or mixed in a monorepo. Loads only the rules for the ecosystems present. Covers a 7-day dependency cooldown and frozen lockfile installs, SHA-pinned actions via actions-up, digest-pinned Dev Container images, Socket Firewall on every CI job, zizmor workflow linting, Aikido Safe Chain on Codespaces, Cursor, Claude Code, and Codex cloud agents, and OIDC trusted publishing with no long-lived tokens (npm staged and reviewed in Drydock; PyPI, crates.io, and NuGet behind a reviewer-gated environment). A repo admin runs lockdown-repo.sh last (never checked into the target repo; all manual tasks last too). Keeps a simple public SECURITY.md and tracks progress in DEFENSE_IN_DEPTH.md. Use when asked to harden a repo, improve supply-chain security, lock down GitHub settings, validate registry publishing settings, or pin and lint CI. Manual, resumable, one item per PR.
disable-model-invocation: true
user-invocable: true
---

# Defense in Depth

Operation manual for hardening a repo against supply-chain compromise. The repo may hold one
ecosystem or several; the workflow is the same, and each ecosystem follows its own rules file. One
controllable improvement per PR; status tracked in the target repo's `DEFENSE_IN_DEPTH.md`.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do —
> start with [Workflow](#workflow) Step 1. Only stop where the workflow or a rules file says to stop
> (uncommitted changes, CODEOWNERS owners not yet named, status disagrees with reality, applying
> GitHub settings) or when a decision genuinely requires the user.
>
> **One PR at a time.** Open a PR for one item, drive its CI to green, then stop and wait. Resume
> only when the user says `continue`, `next`, `next defense PR`, or similar.
>
> This skill follows the shared `shipping-conventions` loop and `pr-conventions`; the status-block
> format and reconciliation rules live in `security-status-tracking`.

## Goal and scope

Make compromise require multiple independent failures, and shrink the blast radius of any one
failure: no direct pushes or tags, no write token on jobs that only generate files, no long-lived
publish credentials, no fresh-off-the-registry dependencies, no unreviewed workflow changes, and no
release that a human didn't approve.

Out of scope: version bumps and release notes (`release-cut`); governance boilerplate
(`project-templates`); upgrading dependencies (`dependency-management`); an ecosystem with no rules
file (report it, never improvise one).

## Two files in the target repo

- **`SECURITY.md`** — simple and public: how to report a vulnerability, plus a short "How this
  repository is secured" summary that only lists measures actually in place.
- **`DEFENSE_IN_DEPTH.md`** — the tracked checklist (three checkbox states per
  `security-status-tracking`). The catalog is the scaffold in [reference.md § 1](./reference.md#1-security-docs)
  plus the **Catalog** blocks of the rules files for the ecosystems present. It defines the
  universe — do not invent items.

## Ecosystems

An ecosystem is present when its marker is a **tracked** file (`git ls-files`), at any depth. Each
directory that holds a marker is a package root.

| Marker (tracked) | Ecosystem | Rules |
|---|---|---|
| `pnpm-lock.yaml` | Node | [ecosystems/node.md](./ecosystems/node.md) |
| `Cargo.toml` that is not a member of another tracked workspace | Rust | [ecosystems/rust.md](./ecosystems/rust.md) |
| `*.sln`, `*.slnx`, or a `*.csproj` / `*.fsproj` / `*.vbproj` in no solution | .NET | [ecosystems/dotnet.md](./ecosystems/dotnet.md) |
| `uv.lock`, `poetry.lock`, or `requirements*.txt` / `requirements*.in` | Python | [ecosystems/python.md](./ecosystems/python.md) |
| `go.mod` | Go | [ecosystems/go.md](./ecosystems/go.md) |

- A `package.json` or `pyproject.toml` with no lockfile beside it, and not a workspace member of a
  root above it, is an example app or fixture: list it, don't harden it.
- `package-lock.json`, `yarn.lock`, and `bun.lock` (the Node rules need pnpm), `pdm.lock`,
  `Pipfile`, `pom.xml`, `build.gradle*`, `Gemfile`, `composer.json`, `Package.swift`,
  `pubspec.yaml`, `mix.exs`, and conda `environment.yml` have no rules file — list them as
  **unsupported**. The ecosystem-neutral sections (§ 1, § 2 CODEOWNERS, § 4, § 6, § 7) still apply
  to the repo.

Read the rules file of every ecosystem the repo has, and only those. Each one has the same
sections: **Package manager**, **Catalog** (its § 3 and § 5 checklist blocks), **Dependency
policy**, **Install protection** (what Socket Firewall and Safe Chain cover), **CI**,
**Publishing**, and **Verify**. A stop-and-report condition in a rules file blocks that ecosystem's
block only: report it and continue with the next applicable item.

## Repo profile

Classify the repo before scaffolding; the profile decides which items apply. Record it in
`DEFENSE_IN_DEPTH.md` (`Profile: Node (pnpm), Python (uv) · publishes to npm, PyPI · public`).

| Question | Signal | Consequence |
| --- | --- | --- |
| Which ecosystems? | The marker table above | One § 3 block per ecosystem. The Safe Chain cloud-bootstrap items apply only with a Node (pnpm) or Python root. |
| Does it publish a package? | Each rules file's **Publishing** section (npm, crates.io, nuget.org, PyPI) | One § 5 block per registry it publishes to. **Publishes nothing** (site, service, docs, internal tool, Go module) → skip § 5; everything else applies. |
| Is the repo private? | `gh repo view --json isPrivate` | **Private** → the lockdown script skips private-vulnerability-reporting and fork-PR workflow approval; plan-gated settings (rulesets, secret scanning, environment reviewers) tracked only if available — the script reports this; SECURITY.md drops the public-issue step and keeps the email contact only. |

## Item priority

Sections in `DEFENSE_IN_DEPTH.md`, in execution order — pick the first unchecked applicable item
top-to-bottom. **`lockdown-repo.sh` is never checked into a repo.** It lives only in this skill;
never copy or commit it into the target. **A repo admin runs apply last**, after every earlier
applicable item including every `(manual)` task. `--check` during audit does not change that.

1. **§ 1 Security docs** — scaffold/simplify `SECURITY.md`, scaffold `DEFENSE_IN_DEPTH.md`.
2. **§ 2 CODEOWNERS and cloud bootstrap** — `.github/CODEOWNERS` including `/.vscode/`, `/.claude/`,
   and `/.codex/` (file PR); Aikido Safe Chain on Codespaces, Cursor Cloud Agents, and Claude Code on
   the web (file PR; only with a Node (pnpm) or Python root); Codex cloud setup and Claude Code
   network settings `(manual)`; Dev Container `image` digest pin (file PR; skip without a
   `devcontainer.json`).
3. **§ 3 Dependencies** — no Dependabot, then each ecosystem's block in the order of the table
   above: a frozen lockfile, a 7-day cooldown with no first-party excludes, no install-time
   dependency code, and only the expected registry, as far as its package manager allows.
4. **§ 4 GitHub Actions** — least-privilege permissions, no CI commit-back, actions-up SHA pinning,
   Socket Firewall on every job with `sfw`-prefixed installs, `check-workflows.yaml` zizmor linting,
   kebab-case workflow and job names (no spaces, so they can be required checks).
5. **§ 5 Publishing** *(repos that publish a package)* — one `release.yaml` with OIDC trusted
   publishing and a human gate per registry: npm stages with
   `pnpm stage publish ./packed/*.tgz --no-git-checks`; PyPI, crates.io, and nuget.org publish from
   a reviewer-gated `release` environment. Registry, Drydock, 2FA, and environment settings are
   `(manual)`. Audit npmjs with [`./scripts/check-npmjs.sh`](./scripts/check-npmjs.sh) (never
   copied into the target; check-only).
6. **§ 6 Security tooling** — Aikido on every build; Socket on every dependency change.
7. **§ 7 Repository lockdown** — GitHub settings via
   [`./scripts/lockdown-repo.sh`](./scripts/lockdown-repo.sh). Never copy it into the target repo.
   A repo admin runs it last, after every earlier item including all `(manual)` tasks.
   Account/UI leftovers are `(manual)` and are last-phase admin work with the script.

## Workflow

Run on the first invocation and on every resume (`continue`, `next`, `next defense PR`):

1. **Sync `main`.** Working tree must be clean (`git status --short`) — stop and report if not.
   `git checkout main && git pull --ff-only origin main`.

2. **Classify.** Detect the ecosystems and determine the repo profile (tables above) on first run,
   and read the rules file of each ecosystem present; afterwards read the profile from
   `DEFENSE_IN_DEPTH.md` and re-verify only if the repo changed shape.

3. **Audit.**
   - If `DEFENSE_IN_DEPTH.md` is missing, the next item is § 1. Scaffolding — from
     [reference.md § 1](./reference.md#1-security-docs) and the rules files' Catalog blocks,
     dropping what the profile excludes — happens in that item's PR in Step 4, never during the
     audit.
   - If the defense-in-depth sections don't match the current catalog, replace those sections with
     the catalog assembled per [reference.md § 1](./reference.md#1-security-docs), then reconcile
     against repo state. Do not map old checkboxes.
   - **Migration (rides the § 1 PR):** if `SECURITY.md` contains an old `Defense in Depth status`
     block, move its state into `DEFENSE_IN_DEPTH.md` (map matching items; list dropped ones in the
     PR body) and cut `SECURITY.md` down to the simple shape. The move is one-shot: afterwards
     status is never read from `SECURITY.md` again.
   - Reconcile every checkbox against actual repo state per `security-status-tracking`. For the npm
     block run [`./scripts/check-npmjs.sh`](./scripts/check-npmjs.sh) with `--repo` and
     `--workflow` taken from the checkout per
     [ecosystems/node.md](./ecosystems/node.md#audit-npmjs-settings). Requires `npm login`;
     `NPM_TOKEN` is not allowed. Never copy it into the target repo; it is check-only and is never
     checked in. A clean run means the readable npmjs items match; a FAIL does not jump the queue.
     For § 7 run `lockdown-repo.sh <owner/repo> --check` with `--required-checks` and
     `--allowed-actions` taken from the repo's workflows per
     [reference.md § 7](./reference.md#7-repository-lockdown) (audit only — never apply here). A
     clean `--check` means the lockdown item is done; a FAIL does not make § 7 the next item while
     earlier applicable items (auto or `(manual)`) remain. Skip the Safe Chain item and the Codex /
     Claude Code environment items when the repo has no Node (pnpm) or Python root. Skip the Dev
     Container image-pin item when no `devcontainer.json` exists. Never silently uncheck a
     regression — stop and report it.

4. **Implement the next item.**
   - **File items** (§ 1–6): branch from `main` as `chore/defense-<section-key>-<item-key>`; an
     ecosystem item uses the ecosystem as its section key (`chore/defense-node-cooldown`,
     `chore/defense-python-cooldown`, `chore/defense-rust-locked`,
     `chore/defense-actions-no-commit-back`, `chore/defense-actions-socket-firewall`). Make only the
     change the item requires, in every package root of that ecosystem, update its checkbox to
     `(PR #<n> pending)`, run the rules file's **Verify** commands, and open the PR per
     [PR rules](#pull-request-rules). Specs live in [reference.md](./reference.md) for the shared
     sections and in the rules file for § 3 and § 5 blocks.
     - CODEOWNERS: copy the template from
       [reference.md § 2](./reference.md#2-codeowners-and-cloud-bootstrap). **Stop and ask who the
       owners are** (`@user` and/or `@org/team`) before writing the file; substitute `{{OWNERS}}`.
       Never hardcode a username and never guess from the repo owner login. If the user already
       named owners in this conversation, use those and do not re-ask.
     - Safe Chain: copy
       [`./scripts/setup-cloud-environment.sh`](./scripts/setup-cloud-environment.sh) and the files
       in `templates/` per [reference.md § 2](./reference.md#2-codeowners-and-cloud-bootstrap)
       (merge existing `.devcontainer` / `.cursor` / `.claude` config, `CLAUDE.md`, and `.gitignore`
       so `.claude/settings.json` and `.claude/hooks/` stay tracked; never overwrite existing
       config). Skip when the repo has no Node (pnpm) or Python root. Branch
       `chore/defense-safe-chain-cloud`. A leftover PMG / VM-egress line is dropped in that PR.
     - Dev Container image pin: rewrite each `.devcontainer/**/devcontainer.json` (and repo-root
       `devcontainer.json`) `image` to `name:<versioned-tag>@sha256:<digest>` per
       [reference.md § 2](./reference.md#2-codeowners-and-cloud-bootstrap). Skip when no
       `devcontainer.json` exists. Branch `chore/defense-devcontainer-pin`.
     - Release workflow: start `.github/workflows/release.yaml` from the skeleton in
       [reference.md § 5](./reference.md#5-publishing) and add the release jobs from the rules file
       of the registry this item is for, one registry per PR. If a publish workflow already exists,
       move its publish step to the rules file's shape rather than replacing a custom pipeline.
       Branch `chore/defense-<ecosystem>-<item-key>` (`chore/defense-node-stage-publish`,
       `chore/defense-python-trusted-publishing`).
   - **`(manual)` items:** report what the maintainer needs to do — from the matching reference or
     rules-file section — and continue past them for later auto items; do not treat them as done.
     All `(manual)` tasks and lockdown are last-phase admin work: after every auto-implementable
     applicable item is checked, stop and hand the remaining manuals plus the lockdown command to
     the admin. The maintainer ticks manuals off.
   - **§ 7 lockdown (always last, admin only):** do not pick this item while any earlier applicable
     item — auto or `(manual)` — is unchecked. Never copy `lockdown-repo.sh` into the target repo
     and never commit it. The agent never runs apply mode. Working tree must be clean. Show
     `--check` with `--required-checks` and `--allowed-actions`. Hand the apply command to a repo
     admin: `lockdown-repo.sh <owner/repo>` with those flags taken from the repo's workflows per
     [reference.md § 7](./reference.md#7-repository-lockdown). A warning that this copy is not the
     latest from jaredwray/agentic is not a stop — update the skill and re-run `--check` before the
     admin applies. After the admin applies, re-run `--check` with the same flags. Record the result
     in a PR that updates `DEFENSE_IN_DEPTH.md` and the `SECURITY.md` summary. The script audits
     CODEOWNERS and requires `require_code_owner_review` on the branch ruleset; it does not write
     the file.

5. **Drive CI to green.** Diagnose, fix, and push until every check passes. Do not stop on a red PR.

6. **Loop or stop.** If the PR merged while you watched (auto-merge, user merged), return to
   Step 1 immediately. Otherwise stop and report in four lines: PR URL and item; CI state; what's
   next (plus any `(manual)` items waiting on the maintainer); and a literal resume prompt —
   *"Merge the PR when you're ready, then reply `continue` (or `next`) and I'll open the next
   defense-in-depth PR."* If only `(manual)` items and/or § 7 remain, report the last-phase admin
   handoff: remaining manuals (run `check-npmjs.sh` for npmjs settings when the repo publishes to
   npm), then `lockdown-repo.sh` last (never committed). If nothing applicable is left unchecked,
   report the rollout complete, with any unsupported ecosystems and blocked rules-file items.

## Pull request rules

- One item per PR; only one open defense-in-depth PR at a time.
- Title prefixes per `pr-conventions`: `mono - chore: defense - …` (monorepo root/cross-package),
  `<package> - chore: defense - …`, or `root - chore: defense - …` (single-package repo). Example:
  `keyv - chore: defense - pin all GitHub Actions via actions-up`.
- Body: one-sentence Summary naming the section, a Status update line
  (`DEFENSE_IN_DEPTH.md: <item> → (PR #<n> pending)`), Verification checklist of the commands run,
  and `defense-in-depth § <n>` as the reference.

---

## Reference

The shared implementation spec — doc templates, CODEOWNERS and Safe Chain files, the Socket
Firewall step, the `check-workflows.yaml` template, the publishing model and `release.yaml`
skeleton, the lockdown script's settings table, tooling links — lives in
[reference.md](./reference.md). The dependency policy, install-protection coverage, CI setup, and
registry publishing of each ecosystem live in its rules file under `ecosystems/`. Each
`DEFENSE_IN_DEPTH.md` item names its section.
