---
name: dependency-management
description: Upgrade every dependency in a repository one grouped PR at a time — Node (pnpm or npm), Rust, .NET, Python (uv, Poetry, pip-tools, or requirements files), and Go, alone or mixed in a monorepo. Finds each package root, loads only the rules for the ecosystems present, and runs overrides first, then every dev group (tooling, GitHub Actions, Docker and Dev Container images) before any runtime group, and last the AI model IDs the code calls (recommend the provider's latest, bump on approval). Every version it moves to has been public for 7 days, no upgrade raises a runtime floor (Node major, MSRV, Python, Go, .NET target framework), and every resume syncs defense-in-depth and AGENTS.md updates from jaredwray/agentic. Use when asked to update, upgrade, or bump dependencies or AI models in any repo. Manual and resumable.
disable-model-invocation: true
user-invocable: true
---

# Dependency management

Upgrade a repo's dependencies one grouped pull request at a time. The repo may hold one ecosystem or
several; the workflow is the same, and each package root follows the rules file for its ecosystem.

> **When this document is loaded, begin executing immediately** with [Workflow](#workflow), which
> runs the `shipping-conventions` loop from its first step. Stop to ask only where that loop, this
> document, or a rules file says to, or when a decision genuinely requires the user.
>
> **One PR at a time across the whole repo.** Open a PR, drive its CI green, stop, and resume only on
> `continue`, `next`, `next dep PR`, or similar. Every PR is ready for review, never a draft — mark
> it ready if the tool or environment created it as a draft.
>
> **Overrides, then dev, then runtime — across the whole repo.** No root starts a runtime group while
> any root or repo-wide group still has dev work.
>
> PR titles, bodies, and review replies follow `pr-conventions`.

## Scope

In scope: every package root in [Package roots](#package-roots), the
[repo-wide groups](#repo-wide-groups), the `agentic-upstream-sync` check, and AI model IDs. When the
user names ecosystems or roots ("only the Python package"), work only those, and the repo-wide groups
only if asked. Out of scope: an ecosystem with no rules file (report it, never improvise one), moving
a runtime floor (always the user's call), and dependency bots' config.

## Package roots

A **package root** is the directory a package manager runs in: where its lockfile, solution, or
module file lives. Enumerate **tracked** files only (`git ls-files`), so `node_modules`, virtualenvs,
`vendor`, and build output never count.

| Marker (tracked) | Root | Rules |
|---|---|---|
| `pnpm-lock.yaml` or `package-lock.json` | its directory, covering its workspaces | [ecosystems/node.md](./ecosystems/node.md) |
| `Cargo.toml` that is not a member of another tracked workspace | its directory | [ecosystems/rust.md](./ecosystems/rust.md) |
| `*.sln` or `*.slnx`; a `*.csproj` / `*.fsproj` / `*.vbproj` in no solution | the solution's directory; the lone project's directory | [ecosystems/dotnet.md](./ecosystems/dotnet.md) |
| `uv.lock`, `poetry.lock`, or `requirements*.txt` / `requirements*.in` | its directory, covering uv workspace members | [ecosystems/python.md](./ecosystems/python.md) |
| `go.mod` (a tracked `go.work` joins the modules it uses into one root) | its directory | [ecosystems/go.md](./ecosystems/go.md) |

- A project in several solutions belongs to the solution nearest the repo root.
- A `package.json` with no lockfile beside it, and not listed as a workspace of a root above it, is
  **unmanaged** — an example app or fixture. So is a `pyproject.toml` with no lockfile and no
  requirements file. List them; don't upgrade them.
- `yarn.lock`, `bun.lock`, `bun.lockb`, `pdm.lock`, `Pipfile`, `pom.xml`, `build.gradle*`, `Gemfile`,
  `composer.json`, `Package.swift`, `pubspec.yaml`, `mix.exs`, and conda `environment.yml` have no
  rules file — list them as **unsupported**.

Read the rules file of every ecosystem the repo has, and only those. Each one has the same sections:
**Package manager**, **Runtime version** (the floor no upgrade may raise, and the version its images
follow), **Candidates** (how to list what is outdated and classify it), **Dev groups** and
**Runtime groups** in priority order, **Apply and verify**, **Version targeting**, and **AI models**.
A stop-and-report condition in a rules file blocks that root only: record it under *Blocked*, skip
the root for the rest of the run, and continue. Stop to ask only when nothing else can ship without
the user's decision.

Order roots by path. The root table is one line per root:

```
dotnet             · .NET (solution)  · ecosystems/dotnet.md
javascript/server  · Node (npm)       · ecosystems/node.md
javascript/web/examples/web-sdk · unmanaged (package.json, no lockfile)
```

## Working in a root

- **Boundaries.** Work only inside the root — its manifests, lockfiles, and source — plus the CI lines
  that pin the root's own package manager or toolchain when its group calls for them. Run its
  commands from the root.
- **Environment.** `local` is a developer machine with a working `git` remote and Docker; start the
  root's test services with its documented command (Node: the `test:services:start` script when
  `package.json` defines it), and on a container conflict remove only the conflicting test-service
  container. `sandbox` is anything else; resolve branch capability per `shipping-conventions` →
  Branch-constrained environments.
- **Names.** Each group is one branch and one PR. Its branch is `chore/<group-key>` with the group key
  from the rules file. With more than one root, insert the root's slug after `chore/`:
  `chore/javascript-web-code-quality`, `chore/javascript-server-override-semver`. The slug is the
  root's path with `/` → `-`; for the repo root it is the ecosystem (`node`, `python`, …), and when two
  roots share a directory the ecosystem is appended (`tools-python`). The PR title prefix is the root's
  package name, per `pr-conventions`; a repo-wide group uses `mono - ` (`root - ` when the repo has one
  root).

## Release-age gate

Nothing moves to a release published less than **7 days** ago — not a package, a toolchain, an
action, or an image digest. Almost every registry compromise is caught and pulled within days; the
gate keeps those releases out.

1. **Use the tool's own gate when it has one** and it can apply without committing anything new:

   | Tool | Gate | How |
   |---|---|---|
   | pnpm | `minimumReleaseAge` | Repo config in `pnpm-workspace.yaml`; `pnpm outdated` and installs honor it. |
   | npm ≥ 11.10 | `min-release-age` (days) | Pass `--min-release-age=7` to every `npm install`. Older npm ignores the flag without a warning. |
   | Poetry ≥ 2.4 | `solver.min-release-age` (days) | Set `POETRY_SOLVER_MIN_RELEASE_AGE=7` on every Poetry command. `poetry.lock` does not record it. |
   | uv | `exclude-newer` | Only when `[tool.uv]` or `uv.toml` already sets it to a relative span of 7 days or more (`"7 days"`, `"1 week"`, `"P7D"`). A fixed date is a hard cap instead: versions after it are deferrals (`held by exclude-newer 2026-10-20`), and moving the date is the user's call. Never pass it on the command line or through `UV_EXCLUDE_NEWER`: uv writes it into `uv.lock`, and `uv lock --check` then fails for everyone without the setting. |

2. **Otherwise compute it from the registry.** Walk candidate versions newest first. The target is
   the first stable release whose publish time is at least 7 days ago. Skip pre-releases, yanked,
   unlisted, and retracted versions. A version with no publish time is ineligible (fail closed). If
   nothing qualifies, skip the item and report it.

   | Registry | Publish time |
   |---|---|
   | npm | `npm view <pkg> time --json` → `time["<version>"]`. Never go past `npm view <pkg> dist-tags.latest`. |
   | crates.io | `curl -s -A dependency-management https://crates.io/api/v1/crates/<name>/versions` → each version's `num`, `created_at`, `yanked`, and `rust_version`. |
   | PyPI | `curl -s -H 'Accept: application/vnd.pypi.simple.v1+json' https://pypi.org/simple/<name>/` → each file's `upload-time`, `yanked`, and `requires-python`. A version's time is its **newest** file's upload, because a wheel added later restarts the clock. |
   | NuGet | `curl -s --compressed https://api.nuget.org/v3/registration5-gz-semver2/<id-lowercase>/index.json` → `items[].items[].catalogEntry` `published` and `listed`. A page with no inline `items` is fetched from its `@id`. `listed: false` or a 1900 `published` date means unlisted (ineligible). |
   | Go module proxy | `go list -m -json <module>@<version>` → `Time`. It honors `GOPROXY` and `GOPRIVATE`. |
   | GitHub Actions | `gh api repos/<owner>/<repo>/releases --paginate` → each release's `tag_name` and `published_at`, which GitHub sets at publish time. Commit dates are set by whoever made the commit, so a tag with no published release is ineligible. |
   | Container registry | `Created` from `skopeo inspect` — see [containers.md](./containers.md). |

   A private feed uses its own metadata under the same rule; a feed that exposes no publish time
   makes its packages ineligible — report them, don't guess.

3. **Never exclude a package from a gate** (`minimumReleaseAgeExclude`, `trustPolicyExclude`,
   `min-release-age-exclude`, `exclude-newer-package`, `solver.min-release-age-exclude`) to reach a
   younger version — first-party packages included. A hijacked maintainer account publishing *our*
   package is exactly what the gate catches.

## Repo-wide groups

These run once for the whole repo, after every root's groups in the same phase. Each is one branch and
one PR. An image group is outdated when any of its references has a floating tag, lacks a digest, or
pins a digest older than its gated target; an action is outdated when its pin is behind its gated
target.

**Dev phase**

1. **GitHub Actions → 1 PR** (only if `.github/workflows/` exists) — branch `chore/github-actions`.
   Move every `uses: <action>@<ref>` in `.github/workflows/*.yml|yaml` and
   `.github/actions/*/action.yml|yaml` to the action's newest release that passes the
   [Release-age gate](#release-age-gate), language setup actions included. When a workflow installs
   Socket Firewall, also bump `firewall-version` to the latest reviewed
   [sfw-free](https://github.com/SocketDev/sfw-free/releases) release (no `v` prefix).
   - Match the existing pin style (full SHA, `@vX`, or `@vX.Y.Z`). A SHA pin takes the commit the target release's tag points to (`gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`), with the version as its comment. A major-tag pin (`@v5`) floats inside its major by design; the gate decides only when it moves to a new major. Append `(breaking)` to the title if any action's major changed.
   - Leave toolchain inputs (`node-version`, `python-version`, `go-version`, `dotnet-version`, `poetry-version`, uv `version`) alone; they follow the rules files.
   - Verify every changed file still parses as YAML. A workflow that never runs on `pull_request` (release, `workflow_dispatch`, schedule) is not exercised by the PR's CI — list it under Verification as parsed only.
2. **Docker build-time images → 1 PR** — branch `chore/docker-build-images`: builder-stage `FROM` lines and workflow `container:` / `services:` images.
3. **Dev Container images → 1 PR** — branch `chore/devcontainer-images`: every `image` in `devcontainer.json` files, digest-pinned under the 7-day age gate.

**Runtime phase**

4. **Docker runtime images → 1 PR per ecosystem** — branch `chore/docker-<ecosystem>`: final-stage `FROM` lines and Compose application images.
5. **Docker service images → 1 PR per service** — branch `chore/docker-<service>`: `postgres`, `redis`, and other infrastructure images in Compose and workflow `services:`.

Find, target, and apply image groups per [containers.md](./containers.md).

## Workflow

The loop — sync `main`, resolve branch capability, take stock, pick one item, open the PR, drive CI
green, check for already-merged, stop and wait — is `shipping-conventions`. Step 1 below is its
*take stock*; steps 2–7 are its *pick one item*.

1. **Take stock — read-only.** Detect package roots, read their rules files, and list each root's
   remaining groups per phase (each collected Node override counts as a possible item). Run the
   comparison of `agentic-upstream-sync` without acting on it, and check each repo-wide group. Render
   the root table on the first run. The total is the item count for `shipping-conventions`'
   single-mandated-branch decision, which completes here, before anything changes. Nothing remaining
   anywhere: render the [Done report](#done-report) and stop.
2. **Check `jaredwray/agentic` for updates.** Run `agentic-upstream-sync`. If it changes any file, that
   is this iteration's PR — branch `chore/agentic-sync`, title e.g.
   `mono - chore: sync defense-in-depth files from agentic`. A catalog behind upstream is reported;
   then continue.
3. **Overrides.** For each Node root in path order, follow the Overrides section of its rules file.
   The first pin that removes or updates is this iteration's PR.
4. **Dev phase.** For each root in path order, its highest-priority remaining dev group; then the
   repo-wide dev groups in order. The first group with work is this iteration's PR.
5. **Runtime phase.** For each root in path order, its highest-priority remaining runtime group; then
   the repo-wide runtime groups in order. The first group with work is this iteration's PR.
6. **AI models.** Run `ai-model-discovery` once for the whole repo, scanning the source files and
   provider SDKs each present rules file's AI models section names. Ship only the first approved
   provider — branch `chore/ai-models-<provider>`, title e.g. `mono - chore: upgrade Anthropic models`.
   Replace every approved reference (code, config, env templates, docs), make the request-shape
   changes the provider's migration guide requires, and verify each touched root per its rules file;
   if the tests call the provider live and no credentials are available, say so in the PR body. The
   PR body lists each `current → target` with the provider's catalog link and any out-of-repo values
   the user must change by hand. A declined bump is a deferral.
7. **Done.** Nothing shipped in steps 2–6: render the [Done report](#done-report) and stop.

To ship an item, apply it per its rules file's Apply and verify section (or
[containers.md](./containers.md) for an image group), make only the change the group requires, and
open the PR ready for review. Then hand back to `shipping-conventions`: drive CI green, check for
already-merged, and stop and wait, naming the root and phase the next `continue` picks up.

## Done report

One line per entry, grouped under these headings, empty headings dropped:

- **Merged** — each PR from this run, grouped by root.
- **Deferred** — versions held back, with what holds them: a runtime floor (`pytest 9.1.1 needs
  Python ≥ 3.10; floor 3.8`), a new major that needs code or import changes, a declined model bump.
- **Kept overrides** — pins that could neither be removed nor updated.
- **Blocked** — roots a rules file stopped on, with the reason.
- **Unmanaged / unsupported** — from detection.
- **Past end of life** — any runtime floor a rules file flags.
