---
name: dependency-management
description: Upgrade every dependency in a repository — one language or a polyglot monorepo — one grouped PR at a time. Finds every package root (Node with pnpm or npm, Rust, .NET, Python with uv, Poetry, or pip, Go), runs the repo-wide work once (the jaredwray/agentic sync, GitHub Actions, Docker and Dev Container images, AI model IDs), and hands each root's package groups to the matching dependency-management-<language> skill, overrides first, then every dev group in the repo before any runtime group. Use when asked to update, upgrade, or bump dependencies in any repo, and always when the repo mixes languages or holds several packages. Manual and resumable.
disable-model-invocation: true
user-invocable: true
---

# Dependency management

The entry point for dependency upgrades. It works out which language skill owns each part of the
repo, keeps one PR in flight across all of them, and runs the repo-wide groups exactly once.

> **When this document is loaded, begin executing immediately** with [Workflow](#workflow), which runs
> the `shipping-conventions` loop from its first step. Stop to ask only where that loop, this
> document, or a delegated language skill says to.
>
> **One PR at a time across the whole repo.** Every root and every repo-wide group shares one queue:
> open a PR, drive its CI green, stop, and resume only on `continue`, `next`, `next dep PR`, or
> similar. Every PR is ready for review, never a draft.
>
> **Overrides, then dev, then runtime — repo-wide.** No root starts a runtime group while any root or
> repo-wide group still has dev work.
>
> PR titles, bodies, and review replies follow `pr-conventions`.

## Scope

In scope: every package root in [Detect package roots](#detect-package-roots), the groups in
`repo-dependency-groups`, the `agentic-upstream-sync` check, and AI model IDs. Out of scope: an
ecosystem with no skill (report it, never improvise one), moving a runtime or toolchain floor (Node
major, MSRV, Python floor, Go `go` directive, .NET target framework — always the user's call), and
dependency bots' config.

## Detect package roots

A **package root** is the directory a package manager runs in: where its lockfile, solution, or
module file lives. Enumerate **tracked** files only (`git ls-files`), so `node_modules`, virtualenvs,
`vendor`, and build output never count.

| Marker (tracked) | Root | Skill |
|---|---|---|
| `pnpm-lock.yaml` | its directory, covering the `pnpm-workspace.yaml` packages | `dependency-management-node` |
| `package-lock.json` | its directory, covering npm `workspaces` | `dependency-management-node` |
| `Cargo.toml` that is not a member of another tracked workspace | its directory | `dependency-management-rust` |
| `*.sln` or `*.slnx`; a `*.csproj` / `*.fsproj` / `*.vbproj` in no solution | the solution's directory; the lone project's directory | `dependency-management-dotnet` |
| `uv.lock`, `poetry.lock`, or `requirements*.txt` / `requirements*.in` | its directory, covering uv workspace members | `dependency-management-python` |
| `go.mod` (a tracked `go.work` joins the modules it uses into one root) | its directory | `dependency-management-go` |

- A project in several solutions belongs to the solution nearest the repo root.
- A `package.json` with no lockfile beside it, and not listed as a workspace of a root above it, is
  **unmanaged** — an example app or fixture. A `pyproject.toml` with no lockfile and no requirements
  file is unmanaged too. List them; don't upgrade them.
- `yarn.lock`, `bun.lock`, `bun.lockb`, `pdm.lock`, `Pipfile`, `pom.xml`, `build.gradle*`, `Gemfile`,
  `composer.json`, `Package.swift`, `pubspec.yaml`, `mix.exs`, and conda `environment.yml` have no
  skill here — list them as **unsupported**.

Order roots by path. The root table is one line per root:

```
javascript/server  · Node (npm)    · dependency-management-node
python             · Python (Poetry) · dependency-management-python
javascript/web/examples/web-sdk · unmanaged (package.json, no lockfile)
```

## Delegation contract

Each package group belongs to the root's language skill. Hand it one root and one phase:

- **Root.** The skill works only inside that root — its manifests, lockfiles, and source — plus the
  CI lines that pin the root's own package manager or toolchain when its group calls for them. Its
  commands run from the root.
- **Phase.** One of:
  - `audit` — read-only: the skill lists its remaining groups in each phase, one line each, and
    changes nothing. Node lists each collected override as a possible item.
  - `overrides` (Node only), `dev`, or `runtime` — the skill ships its highest-priority remaining
    group in that phase.
- **Router-owned.** The skill skips every step it marks *(router-owned)*: `agentic-upstream-sync`,
  every `repo-dependency-groups` group, and AI models.
- **Result.** Exactly one of:
  - **Shipped** — the skill applied the group, verified it, opened the PR, and drove CI green
    (`shipping-conventions` steps 4–5), then hands back the PR URL and group name instead of stopping.
    The router does the already-merged check and the stop.
  - **Nothing left** in that phase.
  - **Blocked** — a stop-and-report condition (an unsupported package manager, a version source
    disagreement, a missing SDK), returned with its reason and nothing changed. The router records it
    under *Blocked* in the [Done report](#done-report), skips that root for the rest of the run, and
    continues. It stops to ask only when the reason needs the user's decision before anything else
    can ship.
- **Names.** With more than one root, insert the root's slug after `chore/`:
  `chore/<root-slug>-<group-key>` (e.g. `chore/javascript-web-code-quality`,
  `chore/javascript-server-override-semver`). The slug is the root's path with `/` → `-`; for the
  repo root it is the ecosystem (`node`, `python`, …), and when two roots share a directory the
  ecosystem is appended (`tools-python`). The PR title prefix is the root's package name. A repo-wide
  group keeps its plain branch and uses `mono - ` (`root - ` when the repo has a single root).

## Workflow

The loop — sync `main`, resolve branch capability, take stock, pick one item, open the PR, drive CI
green, check for already-merged, stop and wait — is `shipping-conventions`. Run it with step 1 below
as its *take stock* and steps 2–7 as its *pick one item*.

1. **Take stock — read-only.** Detect package roots per
   [Detect package roots](#detect-package-roots), run the comparison of `agentic-upstream-sync`
   without acting on it, delegate phase `audit` to every root, and check each `repo-dependency-groups`
   group. Render the root table on the first run. The total across all of them is the item count
   for `shipping-conventions`' single-mandated-branch decision, which completes here, before anything
   changes. Nothing remaining anywhere: render the [Done report](#done-report) and stop.
2. **Check `jaredwray/agentic` for updates.** Run `agentic-upstream-sync`. If it changes any file,
   that is this iteration's PR — branch `chore/agentic-sync`, title e.g.
   `mono - chore: sync defense-in-depth files from agentic`. A catalog behind upstream is reported;
   then continue.
3. **Overrides.** For each Node root in path order, delegate phase `overrides`. The first root that
   ships a PR ends this iteration.
4. **Dev phase.** For each root in path order, delegate phase `dev`. Then the dev groups of
   `repo-dependency-groups` — GitHub Actions, Docker build-time images, Dev Container images — in
   that order. The first group that ships a PR ends this iteration.
5. **Runtime phase.** For each root in path order, delegate phase `runtime`. Then the runtime groups
   of `repo-dependency-groups` — Docker runtime images, then Docker service images. The first group
   that ships a PR ends this iteration.
6. **AI models.** Run `ai-model-discovery` once for the whole repo, scanning the source files and
   provider SDKs that each detected skill's AI models group names. Ship the first approved provider
   — branch `chore/ai-models-<provider>`, title e.g. `mono - chore: upgrade Anthropic models` —
   following the AI models step of the language skill whose files it touches. One provider per
   iteration; a declined bump is a deferral.
7. **Done.** Nothing shipped in steps 2–6: render the [Done report](#done-report) and stop.

After a PR ships, hand back to `shipping-conventions`: check for already-merged, then stop and wait,
naming the root and phase the next `continue` will pick up.

## Done report

One line per entry, grouped under these headings, empty headings dropped:

- **Merged** — each PR from this run, grouped by root.
- **Deferred** — versions held back, with what holds them: a runtime floor (`pytest 9.1.1 needs
  Python ≥ 3.10; floor 3.8`), a new major that needs import changes, a declined model bump.
- **Kept overrides** — pins that could neither be removed nor updated.
- **Blocked** — roots a language skill could not work on, with its reason.
- **Unmanaged / unsupported** — from detection.
- **Past end of life** — any runtime floor the language skills flagged.
