---
name: dependency-management-node
description: Upgrade a Node project's dev and runtime dependencies one grouped PR at a time — first reviewing pnpm overrides to remove or update them, then code-quality tooling, build tooling, monorepo tooling, GitHub Actions, Docker images, then runtime ecosystems — respecting pnpm minimumReleaseAge and the @types/node-versus-Node-major rule. Use when asked to update, upgrade, or bump dependencies on a Node or pnpm project. Manual and resumable; overrides first, then the dev phase before the runtime phase.
disable-model-invocation: true
user-invocable: true
---

# Dependency Management

Workflow for upgrading both **devDependencies** (with CI tooling) and **runtime dependencies**, one pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow), which runs the `shipping-conventions` loop from its first step. Only stop to ask the user when that loop or this document says to stop and report (e.g. uncommitted changes, Node version mismatch) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next dep PR`, or similar. Never open a second dep-management PR while one is already in flight.
>
> **Overrides, then dev, then runtime.** Finish every override that can be removed or updated before any upgrade group. Finish every dev group before starting any runtime group — tooling churn is lower risk than runtime changes.
>
> This skill follows the shared `shipping-conventions` loop; PR titles, bodies, and review replies follow `pr-conventions` (the dependency-specific PR-body skeletons below extend it).

## Repository type

Determine the repo shape first:

- **Monorepo** — has `pnpm-workspace.yaml` or `workspaces` in `package.json`. Handle the root and each workspace package.
- **Single-package** — everything else. The root package is the only package.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Sync `main` before each branch; start test services with `pnpm test:services:start`.
- **`sandbox`** — anything else (CI, hosted agent session, no Docker). Resolve branch capability before starting, per `shipping-conventions` → Branch-constrained environments. One group per branch per PR is the only shape this workflow ships.

## Phases

Run the three phases in order. Do not interleave.

1. **Overrides** — existing version pins (`pnpm.overrides`, `overrides`, Yarn `resolutions`). Exhaust every pin that can be removed or updated (one PR each) before starting the dev phase. See [Overrides](#overrides).
2. **Dev phase** — devDependencies and GitHub Actions. Exhaust every dev group (one PR per group, serially) before moving to the runtime phase.
3. **Runtime phase** — runtime ecosystems and standalone runtime deps. Begin only after every dev group has either been merged or documented as a deferral.

## Standard groups

Group upgrades by toolchain or ecosystem. Each group is **one branch and one PR** containing every listed dep that appears in `pnpm outdated`. In monorepos, a group may span the root and multiple packages.

### Dev groups

Surface with `pnpm outdated --dev` (single-package) or `pnpm -r outdated --dev` (monorepo). Priority order within the dev phase:

1. **Code quality tooling → 1 PR** (testing + linting + formatting always travel together):
   `vitest`, `jest`, `@jest/*`, `@testing-library/*`, `playwright`, `cypress`, `msw`, `@faker-js/faker`, `eslint`, `@eslint/*`, `eslint-*`, `biome`, `@biomejs/*`, `prettier`, `stylelint`, test runners, lint/formatter configs.

2. **TypeScript / build tooling → 1 PR**:
   `typescript`, `ts-node`, `tsx`, `ts-jest`, `@types/*` (except `@types/react` and `@types/react-dom` — those travel with the runtime React group), `vite`, `rollup`, `webpack`, `esbuild`, `swc`, `@swc/*`, `babel`, `tsup`, `rimraf`, type-checking utilities, build-script utilities.

3. **Package manager / monorepo tooling → 1 PR**:
   `pnpm`, `turbo`, `nx`, `changesets`, workspace tooling.

4. **GitHub Actions → 1 PR** (only if `.github/workflows/` exists; not surfaced by `pnpm outdated`):
   Upgrade every `uses: <action>@<ref>` reference to the latest available version.
   - Branch: `chore/github-actions`
   - PR title: e.g. `root - chore: upgrade GitHub Actions` (or `mono - chore: …`); append `(breaking)` if any action's major changed
   - Match the existing pin style (full SHA, `@vX`, or `@vX.Y.Z`) — don't change pin style during the upgrade
   - Verify the workflow YAML still parses before opening the PR

5. **Docker build-time images → 1 PR** (only if `Dockerfile*`, `*.dockerfile`, or CI workflow `container:`/`services:` image refs exist; not surfaced by `pnpm outdated`):
   Builder-stage `FROM` lines in multi-stage Dockerfiles and `container:`/`services:` image references in `.github/workflows/*.yml`. These images carry build tools and never ship in the final container.
   - Branch: `chore/docker-build-images`
   - PR title: e.g. `root - chore: upgrade Docker build-time images`; append `(breaking)` if any image's major version changed
   - See [Container image discovery](#container-image-discovery) for how to find and query image versions
   - See [Container image version agreement](#container-image-version-agreement) for cross-checking `.nvmrc` / `package.json engines.node`

**Exclude from dev groups even when they appear in `pnpm outdated --dev`** — these belong to runtime ecosystem groups and ship in the runtime phase: `@types/react`, `@types/react-dom`, `eslint-config-next`, the `prisma` CLI, and any other devDep that clearly belongs to a runtime ecosystem listed below.

### Runtime groups

Surface with `pnpm outdated --prod` (single-package) or `pnpm -r outdated --prod` (monorepo). Also inspect `package.json` for ecosystem-adjacent devDeps that travel with a runtime group (`@types/react`, `eslint-config-next`, the `prisma` CLI, etc.) — `--prod` won't surface them but they belong in their runtime ecosystem's PR. Priority order within the runtime phase:

1. **React → 1 PR** (all React-ecosystem deps, including majors of `react` + `react-dom` + their `@types`):
   `react`, `react-dom`, `@types/react`, `@types/react-dom`, React-specific libraries that move with the React version.

2. **Next.js → 1 PR**:
   `next`, `eslint-config-next`, Next.js plugins, related tooling. Include React packages here when the Next upgrade requires them — in that case there's no separate React PR.

3. **Backend ecosystems** — one PR per ecosystem (only group deps clearly part of the same ecosystem):
   - GraphQL libraries → 1 PR
   - Prisma libraries (including the `prisma` CLI devDep) → 1 PR
   - `fastify` + its plugins → 1 PR
   - tRPC libraries → 1 PR
   - Auth libraries within the same auth stack → 1 PR
   - Database drivers — individually unless they share a clear ecosystem

4. **Everything else → 1 PR per dependency**:
   Standalone runtime deps with no clear ecosystem partner each get their own PR.

5. **Docker runtime images → 1 PR per ecosystem** (only if Dockerfiles or Compose files exist; not surfaced by `pnpm outdated`):
   Final-stage `FROM` lines in Dockerfiles and `image:` references in `compose.yml`/`docker-compose.yml` for application services. Group by image ecosystem (e.g. all Node.js runtime images in one PR, all Python runtime images in another).
   - Branch: `chore/docker-<ecosystem>` (e.g. `chore/docker-node`, `chore/docker-python`)
   - See [Container image discovery](#container-image-discovery) and [Container image version agreement](#container-image-version-agreement)

6. **Docker service images → 1 PR per service** (only if Compose files or CI `services:` exist):
   Infrastructure service images — `postgres`, `redis`, `nginx`, `mysql`, `elasticsearch`, etc. — in Compose definitions and CI `services:` blocks. Each service ecosystem gets its own PR.
   - Branch: `chore/docker-<service>` (e.g. `chore/docker-postgres`, `chore/docker-redis`)

## Overrides

Review every existing pin **before** any upgrade group. Overrides go stale: the parent catches up, or the pin itself lags. One override per PR. Do not add new overrides in this step.

### Collect

Sweep every source — do not skip a pin because it looks intentional:

- `pnpm.overrides` and `overrides` in the root `package.json` and every workspace `package.json`
- `overrides` in `pnpm-workspace.yaml`
- `resolutions` in `package.json` (Yarn)

Each key is one override. Nested npm-style overrides (`"foo": { ".": "1.0.0", "bar": "2.0.0" }`) count each leaf as one.

### Try one

Walk the collected pins in listed order. Evaluate each on a `chore/override-<pkg>` branch from latest `main`, never on `main`. Prefer removal over an update:

1. **Try remove.** Delete the pin, run `pnpm install`, and check `pnpm why <pkg>` and the lockfile. If the resolved version is still ≥ the pin, the parent has caught up — that's the PR.
2. **Try update.** If removal would regress the resolved version, restore the pin and bump it to the newest version installable under the repo's `minimumReleaseAge` (the same gate as `pnpm outdated`'s Latest; do not pick a younger version). Edit the override and run `pnpm install`, not `pnpm add`. If the pin moves, that's the PR.
3. **Keep** if neither applies. Discard the branch, return to `main`, and continue to the next pin.

Stop at the first pin that removes or updates. Kept pins are not deferrals; they stay until a later resume (usually after a parent upgrade) makes them removable.

## Container image discovery

Container images are not surfaced by `pnpm outdated`. Use this procedure when Docker build-time or runtime groups need upgrading.

### Scan for image references

Search the repo for all container image references:

- `Dockerfile*`, `*.dockerfile` — parse every `FROM` line, including `AS <name>` aliases.
- `compose.yml`, `docker-compose.yml`, `compose.*.yml`, `docker-compose.*.yml` — parse `image:` keys and `build:` contexts.
- `.github/workflows/*.yml` — parse `container:` and `services:` image references.
- `ARG` / `ENV` version indirection — resolve variables like `ARG NODE_VERSION=20` used in `FROM node:${NODE_VERSION}-alpine` to determine the actual image and version.

### Classify stages

In multi-stage Dockerfiles, identify builder vs runtime stages:

- Every `FROM` line except the last is a builder stage (dev-phase group).
- The last `FROM` is the runtime stage (runtime-phase group).
- If a `FROM` uses `AS <name>` and no later `COPY --from=<name>` references it, it may be an unused stage — flag it but don't skip it.

### Query for latest versions

Use `skopeo` (does not require a Docker daemon) to inspect and list tags. Use the full image reference — `docker.io/library/<image>` for official Docker Hub images, or the full registry path for others (e.g. `ghcr.io/<owner>/<image>`, `<org>/<image>`):

- `skopeo inspect docker://<registry>/<image>:<tag>` — returns the digest and labels for the current tag.
- `skopeo list-tags docker://<registry>/<image>` — lists all available tags.
- If `skopeo` is not available, install it or use `crane` as a fallback (`crane ls <image>`, `crane digest <image>:<tag>`).

### Tag lineage targeting

Parse the current tag into `<major>[.<minor>[.<patch>]][-<variant>]`. The upgrade target is the latest tag sharing the same **major** and **variant family**. The variant family is the base variant name without its version — e.g. `alpine3.19` belongs to the `alpine` family, `bookworm` and `bullseye` are distinct families:

- `node:20.11.1-alpine3.19` → latest `node:20.*-alpine*` (the Alpine OS version may advance, e.g. `alpine3.19` → `alpine3.21`)
- `node:20-alpine` → this is a floating tag; upgrade means resolving to a pinned version (see [Floating tags](#tag-lineage-targeting) above)
- `ubuntu:24.04` → latest `ubuntu:24.04` digest (point releases); `ubuntu:24.10` is a major upgrade
- `postgres:16.2-alpine` → latest `postgres:16.*-alpine*` (Alpine version may advance)

Major version bumps (`node:20` → `node:22`, `postgres:16` → `postgres:17`) are breaking — **stop and ask the user** before proceeding. Do not open a major-version Docker image PR without explicit approval. If approved, use a separate PR with `(breaking)` suffix.

**Floating tags** (e.g. `node:20-alpine` without a digest pin) resolve to the latest image at pull time. Offer to upgrade them to a pinned version — resolve the floating tag to the current concrete version and rewrite the reference (e.g. `node:20-alpine` → `node:20.11.1-alpine3.19`). This makes builds reproducible and gives future upgrade runs a version to compare against. If the tag already has a digest pin, the upgrade is refreshing the digest to the current manifest for that tag.

### System packages and script-installed tools

- System packages (`apt-get install`, `apk add`) are **not** independently upgraded. They follow base image upgrades — verify pins still exist in the new base image during `docker build`.
- Script-installed tools (`npm install -g pnpm@9.1.0`, `pip install awscli==1.32.0`) fold into their ecosystem's Docker image PR.
- `curl | sh` installs with no version pin are flagged for pinning but not upgraded (no version to upgrade from).

## Workflow

The loop — sync `main`, resolve branch capability, pick one item, open the PR, drive CI to green,
check for already-merged, stop and wait for `continue` — is `shipping-conventions`. Run it, with the
**item taxonomy** and **branch naming** below (`chore/<group-key>`, `chore/override-<pkg>`). Its first step syncs `main` and
stops on a dirty working tree — do not skip ahead to the numbered steps here, which are additions
*inside* that loop, not a replacement for it:

1. **Start test services if `local`.** Run `pnpm test:services:start` — idempotent, safe to run on every resume. Docker must be running. On a container conflict, remove only the conflicting test-service container and retry — never remove unrelated containers. If the next group is a Docker image group, ensure `skopeo` is available (install if needed).

2. **Review overrides first.** Follow [Overrides](#overrides). If a pin can be removed or updated, verify (if a `build` script exists, `pnpm build && pnpm test`; otherwise `pnpm test`) and open the PR — title e.g. `root - chore: remove <pkg> override` or `root - chore: update <pkg> override` (use `mono - ` when the pin lives at the workspace root). Hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait. Do not pick a standard group this iteration.
   If none can change, continue to step 3. Re-run this step on every resume — a merged parent upgrade often makes a kept pin removable.

3. **Determine the active phase.**
   - If any dev group still has outdated deps (ignoring the dev-phase exclusions above) or Docker build-time images are outdated, the active phase is **dev**.
   - Otherwise, if any runtime group still has outdated deps or Docker runtime/service images are outdated, the active phase is **runtime**.
   - If neither phase has any remaining group, the workflow is **done** — report the full list of merged PRs, any documented deferrals (e.g. "typescript 6 needs tsconfig migration — deferred"), and any overrides that were kept, then stop.

4. **Pick the next group.** Within the active phase, pick the highest-priority group from [Standard groups](#standard-groups) that still has outdated deps. Plan the group across all affected workspaces (in monorepos, one group may span the root and multiple packages).

5. **Apply the upgrade.** Branch: `chore/<group-key>` — e.g. `chore/code-quality`, `chore/typescript-build`, `chore/monorepo-tooling`, `chore/github-actions`, `chore/react`, `chore/nextjs`, `chore/prisma`, `chore/<pkg>` for singletons.
   - Bump it — `pnpm add <pkg>@<version>` (or `pnpm add -D <pkg>@<version>` for devDeps and ecosystem-adjacent devDep members like `@types/react`). `<version>` is the exact value from the "Latest" column of `pnpm outdated`. **Never** `pnpm add <pkg>@latest`, `pnpm update --latest`, or `pnpm up --latest` — they can bypass `minimumReleaseAge` and pull versions younger than the gate allows.
   - Verify the upgrade. Check the relevant `package.json` `scripts` (root for single-package, the affected workspace for monorepos):
     - If a `build` script exists, run `pnpm build && pnpm test` — building first catches type and bundler regressions that tests alone won't.
     - Otherwise run `pnpm test`.
   - **For Docker image groups**, the upgrade procedure differs:
     1. Query the registry for the latest tag within the same lineage (see [Container image discovery](#container-image-discovery)).
     2. Update the tag (and digest if already pinned) in all matching locations across Dockerfiles, Compose files, and CI workflows.
     3. Update `ARG`/`ENV` version variables if the image is indirected through them.
     4. Check [Container image version agreement](#container-image-version-agreement) — `.nvmrc`, `package.json engines.node`, etc. must agree with the new image version.
     5. Verify: run `docker build` on affected Dockerfiles if Docker is available. If in sandbox without Docker, verify syntax only and note the limitation in the PR body.
     6. If the Dockerfile pins system packages (`apt-get install pkg=version`), verify they still resolve in the new base image during `docker build`; if not, update or remove the pin.
   - Open the PR — title and body per [Pull request rules](#pull-request-rules).

   Then hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait.
   Report what's left in the active phase and whether the runtime phase still has work.

## Pull request rules

Loop invariants (one group per PR, one open PR at a time, branch from latest `main`,
branch-constrained environments) are `shipping-conventions`. Review replies and the pleasantry-loop
exception are `pr-conventions`. What's specific to this workflow:

### Version targeting

**The "Latest" column from `pnpm outdated` is the exact target version — never upgrade past it.** This repo uses pnpm's `minimumReleaseAge` to gate freshly-published versions, so `pnpm outdated`'s "Latest" is already the curated upgrade target. Don't cross-reference npm, GitHub releases, or CHANGELOGs to pick a newer version.

**For Docker image groups**, there is no `pnpm outdated` equivalent. The target is the latest tag within the same lineage, as determined by [Container image discovery](#container-image-discovery). Do not cross-reference Docker Hub's "latest" tag — target the latest tag matching the current major and variant.

### Title prefixes

Per `pr-conventions` → Prefix scheme for the automated ops loops.
Examples:

- `mono - chore: remove semver override`
- `root - chore: update braces override`
- `mono - chore: upgrade code quality dependencies`
- `web-app - chore: upgrade TypeScript and build tooling`
- `api - chore: upgrade Prisma dependencies`
- `root - chore: upgrade Docker Node.js runtime image`
