---
name: repo-dependency-groups
description: The dependency work every dependency-management skill shares — the 7-day release-age gate for package versions, toolchains, and container digests (native package-manager gates or registry publish times), the GitHub Actions group, the Docker build-time, runtime, and service image groups, the Dev Container image group, container image discovery and tag lineage, and the rule that images follow the project's declared runtime version. Background discipline: a language skill runs these groups itself in a single-ecosystem repo, and the dependency-management router runs them once for a whole monorepo. Use when upgrading GitHub Actions, Docker or Dev Container images, or deciding whether a release is old enough to adopt.
user-invocable: true
---

# Repo dependency groups

The parts of dependency management that do not depend on the language. Every
`dependency-management-<language>` skill points here instead of restating them. In a single-ecosystem
repo the language skill runs these groups itself, in its own priority order. Under the
`dependency-management` router they are **router-owned**: the router runs each one once for the
whole repo, and the language skills skip them.

> This file defines groups and rules. The loop that ships them — one group, one branch, one PR,
> drive CI green, stop — is `shipping-conventions`, run by the consumer skill.

## Release-age gate

Nothing moves to a release published less than **7 days** ago — not a package, a toolchain, or an
image digest. Almost every registry compromise is caught and pulled within days; the gate keeps
those releases out.

1. **Use the tool's own gate when it has one** and it can apply without committing anything new:

   | Tool | Gate | How |
   |---|---|---|
   | pnpm | `minimumReleaseAge` | Repo config in `pnpm-workspace.yaml`; `pnpm outdated` and installs honor it. |
   | npm ≥ 11.10 | `min-release-age` (days) | Pass `--min-release-age=7` to every `npm install`. |
   | Poetry ≥ 2.4 | `solver.min-release-age` (days) | Set `POETRY_SOLVER_MIN_RELEASE_AGE=7` on every Poetry command. `poetry.lock` does not record it. |
   | uv | `exclude-newer` | Only when `[tool.uv]` or `uv.toml` already sets it to 7 days or more. Never pass it on the command line or through `UV_EXCLUDE_NEWER`: uv writes it into `uv.lock`, and `uv lock --check` then fails for everyone without the setting. |

2. **Otherwise compute it from the registry.** Walk candidate versions newest first. The target is
   the first stable release whose publish time is at least 7 days ago. Skip pre-releases, yanked,
   unlisted, and retracted versions. A version with no publish time is ineligible (fail closed). If
   nothing qualifies, skip the item and report it.

   | Registry | Publish time |
   |---|---|
   | npm | `npm view <pkg> time --json` → `time["<version>"]`. Never go past `npm view <pkg> dist-tags.latest`. |
   | PyPI | `curl -s -H 'Accept: application/vnd.pypi.simple.v1+json' https://pypi.org/simple/<name>/` → each file's `upload-time`, `yanked`, and `requires-python`. A version's time is its **newest** file's upload, because a wheel added later restarts the clock. |
   | NuGet | `curl -s --compressed https://api.nuget.org/v3/registration5-gz-semver2/<id-lowercase>/index.json` → `items[].items[].catalogEntry` `published` and `listed`. A page with no inline `items` is fetched from its `@id`. `listed: false` or a 1900 `published` date means unlisted (ineligible). `dependencyGroups[].targetFramework` lists the frameworks the version supports. |
   | Go module proxy | `go list -m -json <module>@<version>` → `Time` (and `GoVersion`, the module's minimum Go). It honors `GOPROXY` and `GOPRIVATE`. |
   | Container registry | `Created` from `skopeo inspect` — see [Container images](#container-images). |

   A private feed uses its own metadata under the same rule; a feed that exposes no publish time
   makes its packages ineligible — report them, don't guess.

3. **Never exclude a package from a gate** (`minimumReleaseAgeExclude`, `min-release-age-exclude`,
   `exclude-newer-package`, `solver.min-release-age-exclude`) to reach a younger version — first-party
   packages included. A hijacked maintainer account publishing *our* package is exactly what the gate
   catches.

## Groups

Each group is one branch and one PR. A dev-phase group ships before any runtime group, per the
consumer skill's phases.

### Dev phase

1. **GitHub Actions → 1 PR** (only if `.github/workflows/` exists):
   Upgrade every `uses: <action>@<ref>` in `.github/workflows/*.yml|yaml` and
   `.github/actions/*/action.yml|yaml` to the latest available version, language setup actions
   included (`actions/setup-node`, `actions/setup-python`, `actions/setup-go`, `actions/setup-dotnet`,
   `dtolnay/rust-toolchain`, `astral-sh/setup-uv`, `abatilo/actions-poetry`). When a workflow installs
   Socket Firewall, also bump `firewall-version` to the latest reviewed
   [sfw-free](https://github.com/SocketDev/sfw-free/releases) release (no `v` prefix).
   - Branch: `chore/github-actions`
   - PR title: e.g. `mono - chore: upgrade GitHub Actions` (`root - ` in a single-package repo); append `(breaking)` if any action's major changed
   - Match the existing pin style (full SHA, `@vX`, or `@vX.Y.Z`) — don't change pin style during the upgrade
   - Leave toolchain inputs (`node-version`, `python-version`, `go-version`, `dotnet-version`, `poetry-version`, uv `version`) alone; they follow [Image version agreement](#image-version-agreement) or the language skill's own toolchain group
   - Verify every changed file still parses as YAML. A workflow that never runs on `pull_request` (release, `workflow_dispatch`, schedule) is not exercised by the PR's CI — list it under Verification as parsed only

2. **Docker build-time images → 1 PR** (only if `Dockerfile*`, `*.dockerfile`, or workflow `container:`/`services:` image refs exist):
   Builder-stage `FROM` lines in multi-stage Dockerfiles and `container:`/`services:` image references in `.github/workflows/*.yml`. These images carry build tools and never ship in the final container.
   - Branch: `chore/docker-build-images`
   - PR title: e.g. `root - chore: upgrade Docker build-time images`; append `(breaking)` if any image's major changed

3. **Dev Container images → 1 PR** (only if `.devcontainer/devcontainer.json`, `.devcontainer/*/devcontainer.json`, or a repo-root `devcontainer.json` exists):
   Every `image` value in those files. Pin floating tags and refresh digest pins to the newest digest in lineage that passes the [7-day age gate](#7-day-age-gate).
   - Branch: `chore/devcontainer-images`
   - PR title: e.g. `root - chore: upgrade Dev Container images` (or `pin` on a first digest pin)
   - Skip files that use `build` / `dockerFile` instead of `image`; those `FROM` lines belong to the Docker groups
   - Do not change Dev Container Features tags (`github-cli:1`, `docker-in-docker:4`)

### Runtime phase

4. **Docker runtime images → 1 PR per ecosystem** (only if Dockerfiles or Compose files exist):
   Final-stage `FROM` lines and `image:` references for application services in `compose.yml` /
   `docker-compose.yml`. Group by image ecosystem — all Node.js runtime images in one PR, all Python
   runtime images in another, distroless/scratch in another.
   - Branch: `chore/docker-<ecosystem>` (e.g. `chore/docker-node`, `chore/docker-python`, `chore/docker-dotnet`)

5. **Docker service images → 1 PR per service** (only if Compose files or workflow `services:` exist):
   Infrastructure images — `postgres`, `redis`, `nginx`, `mysql`, `elasticsearch`, … — in Compose
   definitions and CI `services:` blocks.
   - Branch: `chore/docker-<service>` (e.g. `chore/docker-postgres`)

To upgrade any image group: find the target per [Container images](#container-images), pin
`name:<tag>@sha256:<index-digest>` in every matching location (Dockerfiles, Compose files,
workflows), update `ARG` / `ENV` version variables the image is indirected through, and check
[Image version agreement](#image-version-agreement). Verify with `docker build` on each affected
Dockerfile when Docker is available; in a sandbox without Docker, check syntax only and say so in the
PR body. If a Dockerfile pins system packages (`apt-get install pkg=version`), confirm they still
resolve in the new base image during `docker build`; if not, update or remove the pin. For Dev
Container groups, verify each changed file still parses as JSON; do not require the `devcontainer` CLI.

## Container images

Package-manager "outdated" commands never surface images. Use this procedure for every image group.

### Scan for image references

- `Dockerfile*`, `*.dockerfile` — every `FROM` line, including `AS <name>` aliases.
- `compose.yml`, `docker-compose.yml`, `compose.*.yml`, `docker-compose.*.yml` — `image:` keys and `build:` contexts.
- `.github/workflows/*.yml` — `container:` and `services:` image references.
- `.devcontainer/devcontainer.json`, `.devcontainer/*/devcontainer.json`, repo-root `devcontainer.json` — each `image` value. These are the Dev Container group, not a Docker group. Parse each file as JSON and stop and report if one is invalid.
- `ARG` / `ENV` indirection — resolve `ARG NODE_VERSION=20` used in `FROM node:${NODE_VERSION}-alpine` to the actual image and version.

### Classify stages

In a multi-stage Dockerfile every `FROM` except the last is a builder stage (dev phase); the last
`FROM` is the runtime stage (runtime phase). A stage named with `AS <name>` that no later
`COPY --from=<name>` references may be unused — flag it, don't skip it.

### Query for versions

Use `skopeo` (no Docker daemon needed; install it if missing) with the full reference —
`docker.io/library/<image>` for official Docker Hub images, the full registry path otherwise
(`ghcr.io/<owner>/<image>`, `mcr.microsoft.com/dotnet/sdk`):

- `skopeo list-tags docker://<registry>/<image>` — every tag.
- `skopeo inspect --format '{{.Digest}} {{.Created}}' docker://<registry>/<image>:<tag>` — the multi-arch **index** digest to pin, and the image age.
- Without `skopeo`, use `crane` (`crane ls`, `crane digest`, `crane config` for `created`).

### Tag lineage targeting

Parse the current tag into `<version>[-<variant>]`. The target is the newest tag in the same
**lineage** — same runtime major and same variant family — that passes the
[7-day age gate](#7-day-age-gate). The variant family is the variant without its version:
`alpine3.19` is the `alpine` family; `bookworm` and `bullseye` are different families.

- `node:20.11.1-alpine3.19` → newest `node:20.*-alpine*` (Alpine may advance, `alpine3.19` → `alpine3.21`)
- `rust:1.85.0-slim-bookworm` → newest `rust:1.*-slim-bookworm`
- `python:3.12.7-slim-bookworm` → newest `python:3.12.*-slim-bookworm` — for Python the lineage major is the minor, `3.12`
- `golang:1.22.5-alpine` → newest `golang:1.22.*-alpine*` — for Go the lineage major is the minor, `1.22`
- `mcr.microsoft.com/dotnet/aspnet:8.0.11-bookworm-slim` → newest `aspnet:8.0.*-bookworm-slim`
- `ubuntu:24.04` → newest `ubuntu:24.04` digest; `ubuntu:24.10` is a major upgrade
- `postgres:16.2-alpine` → newest `postgres:16.*-alpine*`
- Microsoft Dev Container images (`mcr.microsoft.com/devcontainers/<language>`): the lineage is the runtime version plus OS family, not the image-catalog version — `javascript-node:5.0.2-24-trixie` → newest `*-24-trixie`, and `5.0.2` → `5.1.1` is a refresh. Prefer the `version` and `dev.containers.variant` labels when rewriting the tag.

A major move — a new runtime major (`node:20` → `node:22`), a new Python or Go minor
(`python:3.12` → `3.13`), a new OS release (`ubuntu:22.04` → `24.04`), `postgres:16` → `17` — is
breaking: **stop and ask the user**. With approval it ships as its own PR with a `(breaking)`
suffix, per [Image version agreement](#image-version-agreement).

**Floating tags** (`node:20-alpine`, `golang:1.22`, a Dev Container `:latest`) resolve at pull time.
Upgrade them to a digest pin: resolve to a versioned tag and write `name:<tag>@sha256:<index-digest>`
(`node:20-alpine` → `node:20.11.1-alpine3.19@sha256:…`). The digest is the pin; the tag is for
humans. Never leave `latest` as the tag, even with a digest. A reference that already has a digest
is refreshed under the gate.

### 7-day age gate

The [Release-age gate](#release-age-gate) for images:

1. The candidate is the newest tag in the lineage.
2. Inspect it. The pin is the **index** digest (manifest list), not a per-platform digest. `Created` is the image age.
3. A missing `Created` makes the candidate ineligible (fail closed).
4. If `Created` is under 7 days, walk older tags in the lineage until one is at least 7 days old. That digest is the target.
5. If none qualify, skip and report. Never pin or refresh to a digest younger than 7 days.

The "latest" image for a group is this 7-day-aged digest, not whatever the registry's `latest` tag
points at today.

### System packages and script-installed tools

- System packages (`apt-get install`, `apk add`) are not upgraded on their own; they follow the base image.
- Version-pinned script installs (`npm install -g pnpm@9.1.0`, `pip install awscli==1.32.0`, `cargo install <tool>@<version>`, `go install <tool>@<version>`) fold into their ecosystem's image PR.
- `curl | sh` installs with no version are flagged for pinning, not upgraded.

## Image version agreement

Images follow the project's declared runtime version, never the other way around. The canonical
version is the first source found in the row's order; if two sources disagree, **stop and report**.

| Runtime | Images | Canonical version |
|---|---|---|
| Node | `node`, `devcontainers/javascript-node`, `devcontainers/typescript-node` | Node **major**: `.nvmrc`, `.node-version`, `package.json` `engines.node`, Volta in `package.json`, Dockerfiles, CI |
| Rust | `rust`, `devcontainers/rust` | `rust-toolchain.toml` or `rust-toolchain`, compatible with `dependency-management-rust`'s MSRV rule |
| Python | `python`, `devcontainers/python` | Python **minor**: `.python-version`, then CI `python-version` — never below the project's Python floor |
| Go | `golang`, `devcontainers/go` | Go **minor**: the `toolchain` directive in `go.mod`, else its `go` directive |
| .NET | `mcr.microsoft.com/dotnet/sdk`, `aspnet`, `runtime`, `runtime-deps`, `devcontainers/dotnet` | .NET **major**: `global.json` `sdk.version` for SDK images; the highest `TargetFramework` (`net8.0` → `8.0`) for runtime images |

Every image of a runtime must match that version, and upgrades stay inside it. An image moves to a
new runtime version only with the user's approval, in one `(breaking)` PR that also moves the version
files (`.nvmrc`, `engines.node`, and `@types/node`; `.python-version`; `go.mod`'s `toolchain`; `global.json`). Never
move an image on its own. An image with no row follows [Tag lineage targeting](#tag-lineage-targeting).
