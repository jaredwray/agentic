# Container images

How the image groups in `SKILL.md` find, target, and apply image pins. Package-manager "outdated"
commands never surface images.

## Scan for image references

- `Dockerfile*`, `*.dockerfile` — every `FROM` line, including `AS <name>` aliases.
- `compose.yml`, `docker-compose.yml`, `compose.*.yml`, `docker-compose.*.yml` — `image:` keys and `build:` contexts.
- `.github/workflows/*.yml|yaml` — `container:` and `services:` image references.
- `.devcontainer/devcontainer.json`, `.devcontainer/*/devcontainer.json`, repo-root `devcontainer.json` — each `image` value. These are the Dev Container group, not a Docker group. Parse each file as JSON and stop and report if one is invalid. Skip files that use `build` / `dockerFile` instead of `image`; their `FROM` lines belong to the Docker groups. Dev Container Features tags (`github-cli:1`, `docker-in-docker:4`) are not this group.
- `ARG` / `ENV` indirection — resolve `ARG NODE_VERSION=20` used in `FROM node:${NODE_VERSION}-alpine` to the actual image and version.

## Classify stages

In a multi-stage Dockerfile every `FROM` except the last is a builder stage (Docker build-time group,
dev phase); the last `FROM` is the runtime stage (Docker runtime group). A stage named with
`AS <name>` that no later `COPY --from=<name>` references may be unused — flag it, don't skip it.
Group runtime images by ecosystem (all Node.js runtime images in one PR, all Python in another,
distroless/scratch in another) and service images by service.

## Query for versions

Use `skopeo` (no Docker daemon needed; install it if missing) with the full reference —
`docker.io/library/<image>` for official Docker Hub images, the full registry path otherwise
(`ghcr.io/<owner>/<image>`, `mcr.microsoft.com/dotnet/sdk`):

- `skopeo list-tags docker://<registry>/<image>` — every tag.
- `skopeo inspect --format '{{.Digest}} {{.Created}}' docker://<registry>/<image>:<tag>` — the multi-arch **index** digest to pin, and the image age.
- Without `skopeo`, use `crane` (`crane ls`, `crane digest`, `crane config` for `created`).

## Tag lineage targeting

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
suffix, per [Runtime version agreement](#runtime-version-agreement).

**Floating tags** (`node:20-alpine`, `golang:1.22`, a Dev Container `:latest`) resolve at pull time.
Upgrade them to a digest pin: resolve to a versioned tag and write `name:<tag>@sha256:<index-digest>`
(`node:20-alpine` → `node:20.11.1-alpine3.19@sha256:…`). The digest is the pin; the tag is for
humans. Never leave `latest` as the tag, even with a digest. A reference that already has a digest
is refreshed under the gate.

## 7-day age gate

The release-age gate in `SKILL.md`, for images:

1. The candidate is the newest tag in the lineage.
2. Inspect it. The pin is the **index** digest (manifest list), not a per-platform digest. `Created` is the image age.
3. A missing `Created` makes the candidate ineligible (fail closed).
4. If `Created` is under 7 days, walk older tags in the lineage until one is at least 7 days old. That digest is the target.
5. If none qualify, skip and report. Never pin or refresh to a digest younger than 7 days.

The "latest" image for a group is this 7-day-aged digest, not whatever the registry's `latest` tag
points at today.

## Runtime version agreement

Images follow the runtime version the root's rules file declares in its **Runtime version** section,
never the other way around: `node` follows the Node major, `rust` the toolchain file, `python` the
Python minor, `golang` the Go minor, and the `mcr.microsoft.com/dotnet/*` images the .NET major. An
image with no matching rules file follows [Tag lineage targeting](#tag-lineage-targeting). An image
moves to a new runtime version only with the user's approval, in one `(breaking)` PR that also moves
the version files the rules file names. Never move an image on its own.

## Apply and verify

1. Pin or refresh `name:<tag>@sha256:<index-digest>` in every matching location — Dockerfiles, Compose files, workflows, `devcontainer.json`.
2. Update `ARG` / `ENV` version variables the image is indirected through.
3. Check [Runtime version agreement](#runtime-version-agreement).
4. Verify with `docker build` on each affected Dockerfile when Docker is available; in a sandbox without Docker, check syntax only and say so in the PR body. Verify each changed `devcontainer.json` still parses as JSON; do not require the `devcontainer` CLI.
5. A Dockerfile that pins system packages (`apt-get install pkg=version`) must still resolve them in the new base image during `docker build`; if not, update or remove the pin. Unpinned system packages follow the base image.
6. Version-pinned script installs (`npm install -g pnpm@9.1.0`, `pip install awscli==1.32.0`, `cargo install <tool>@<version>`, `go install <tool>@<version>`) fold into their ecosystem's image PR. `curl | sh` installs with no version are flagged for pinning, not upgraded.

PR titles, e.g. `root - chore: upgrade Docker build-time images`, `root - chore: pin Dev Container
images` on a first digest pin, `root - chore: upgrade Docker Node.js runtime image`; append
`(breaking)` when an image's major changed.
