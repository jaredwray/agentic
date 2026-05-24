# Dependency Management

Workflow for upgrading both **devDependencies** (with CI tooling) and **runtime dependencies**, one pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Only stop to ask the user when the document explicitly says to stop and report (e.g. uncommitted changes, Node version mismatch) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next dep PR`, or similar. Never open a second dep-management PR while one is already in flight.
>
> **Dev phase before runtime phase.** Finish every dev group before starting any runtime group — tooling churn is lower risk than runtime changes.

## Repository type

Determine the repo shape first:

- **Monorepo** — has `pnpm-workspace.yaml` or `workspaces` in `package.json`. Handle the root and each workspace package.
- **Single-package** — everything else. The root package is the only package.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Sync `main` before each branch; start test services with `pnpm test:services:start`.
- **`sandbox`** — anything else (CI, single-branch agent session, no Docker). If the sandbox can't create separate branches and PRs, stop and report.

## Phases

Run the two phases in order. Do not interleave.

1. **Dev phase** — devDependencies and GitHub Actions. Exhaust every dev group (one PR per group, serially) before moving to the runtime phase.
2. **Runtime phase** — runtime ecosystems and standalone runtime deps. Begin only after every dev group has either been merged or documented as a deferral.

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

Use `skopeo` (does not require a Docker daemon) to inspect and list tags:

- `skopeo inspect docker://docker.io/library/<image>:<tag>` — returns the digest and labels for the current tag.
- `skopeo list-tags docker://docker.io/library/<image>` — lists all available tags.
- If `skopeo` is not available, install it or use `crane` as a fallback (`crane ls <image>`, `crane digest <image>:<tag>`).

### Tag lineage targeting

Parse the current tag into `<major>[.<minor>[.<patch>]][-<variant>]`. The upgrade target is the latest tag sharing the same **major** and **variant**:

- `node:20.11.1-alpine3.19` → latest `node:20.*-alpine*`
- `node:20-alpine` → this is a floating tag; upgrade means refreshing the digest pin (if pinned) or skip (if not pinned)
- `ubuntu:24.04` → latest `ubuntu:24.04` digest (point releases); `ubuntu:24.10` is a major upgrade
- `postgres:16.2-alpine` → latest `postgres:16.*-alpine*`

Major version bumps (`node:20` → `node:22`, `postgres:16` → `postgres:17`) are breaking — own PR with `(breaking)` suffix.

**Floating tags** (e.g. `node:20-alpine` without a digest pin) resolve to the latest image at pull time. Offer to upgrade them to a pinned version — resolve the floating tag to the current concrete version and rewrite the reference (e.g. `node:20-alpine` → `node:20.11.1-alpine3.19`). This makes builds reproducible and gives future upgrade runs a version to compare against. If the tag already has a digest pin, the upgrade is refreshing the digest to the current manifest for that tag.

### System packages and script-installed tools

- System packages (`apt-get install`, `apk add`) are **not** independently upgraded. They follow base image upgrades — verify pins still exist in the new base image during `docker build`.
- Script-installed tools (`npm install -g pnpm@9.1.0`, `pip install awscli==1.32.0`) fold into their ecosystem's Docker image PR.
- `curl | sh` installs with no version pin are flagged for pinning but not upgraded (no version to upgrade from).

## Workflow

Run these steps on the **first** invocation, and again on **every resume** when the user says `continue`, `next`, `next dep PR`, or similar.

1. **Sync `main`.** Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`.

2. **Start test services if `local`.** Run `pnpm test:services:start` — idempotent, safe to run on every resume. Docker must be running. On a container conflict, remove only the conflicting test-service container and retry — never remove unrelated containers. If the next group is a Docker image group, ensure `skopeo` is available (install if needed).

3. **Determine the active phase.**
   - If any dev group still has outdated deps (ignoring the dev-phase exclusions above) or Docker build-time images are outdated, the active phase is **dev**.
   - Otherwise, if any runtime group still has outdated deps or Docker runtime/service images are outdated, the active phase is **runtime**.
   - If neither phase has any remaining group, the workflow is **done** — report the full list of merged PRs and any documented deferrals (e.g. "typescript 6 needs tsconfig migration — deferred") and stop.

4. **Pick the next group.** Within the active phase, pick the highest-priority group from [Standard groups](#standard-groups) that still has outdated deps. Plan the group across all affected workspaces (in monorepos, one group may span the root and multiple packages).

5. **Open the PR.**
   - Branch from latest `main` (naming: `chore/<group-key>` — e.g. `chore/code-quality`, `chore/typescript-build`, `chore/monorepo-tooling`, `chore/github-actions`, `chore/react`, `chore/nextjs`, `chore/prisma`, `chore/<pkg>` for singletons).
   - Apply the upgrade — `pnpm add <pkg>@<version>` (or `pnpm add -D <pkg>@<version>` for devDeps and ecosystem-adjacent devDep members like `@types/react`). `<version>` is the exact value from the "Latest" column of `pnpm outdated`. **Never** `pnpm add <pkg>@latest`, `pnpm update --latest`, or `pnpm up --latest` — they can bypass `minimumReleaseAge` and pull versions younger than the gate allows.
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

6. **Drive CI to green.** After opening the PR, watch CI with `gh pr checks --watch`. If any check fails, diagnose, fix, and push until every check is green. **Do not stop on a red PR.** Only after the PR is green do you proceed.

7. **Check for already-merged.** Before stopping, run `gh pr view <pr-number> --json state,mergedAt` (or equivalent). If the PR is already merged — auto-merge was enabled, or the user merged during CI — treat that as an implicit `next` and **return to Step 1 immediately**. Do not wait, do not prompt. The same applies if the head branch is already gone from the remote.

8. **Stop and wait.** Report to the user with exactly these four things:
   - PR URL and group name
   - Confirmation that CI is green
   - What's still left in the active phase, and whether the runtime phase has remaining work
   - **A literal prompt to resume**, e.g.: *"Merge the PR when you're ready, then reply `continue` (or `next`) and I'll open the next dep-management PR."*

   Then **wait**. Do not open another PR. The workflow resumes only when the user says `continue`, `next`, `next dep PR`, or similar — at which point, return to Step 1.

## Pull request rules

- **One PR per logical group — always.** Don't combine unrelated groups. Don't fragment a clear group across multiple PRs.
- **Only one open dep-management PR at a time.** If a previous dep-management PR is still open, do not open another — drive its CI to green if needed, then stop and wait per Step 8.
- Every PR uses a unique branch from latest `main`.
- If the environment can't create separate branches or PRs (sandbox, single-branch session, etc.), stop and report. Don't bundle groups onto one branch as commits.
- **You must respond to every comment that is not you on what you did.** Reply to each PR comment, review, and review-thread comment authored by someone other than yourself — bots included (CodeQL, Codecov, Gemini, etc.). Reply inline on review-thread comments; for top-level reviews and PR-level bot comments, leave a top-level PR comment. State concretely what was done (or why no action is needed) and reference the commit SHA when applicable. Skip only comments you authored.
  - **Exception — don't engage in pleasantry loops.** Do not reply to comments (especially from bots) that are pure pleasantries (e.g. "You're welcome", "Glad I could help", "Good luck with the merge", "Thanks for the PR") that introduce no new question, finding, or action item. This applies both to initial acknowledgements *and* to follow-ups to substantive discussions. Replying to non-actionable acknowledgements just keeps the loop going. The rule above covers comments about *what you did*; a thank-you is not such a comment.

### Version targeting

**The "Latest" column from `pnpm outdated` is the exact target version — never upgrade past it.** This repo uses pnpm's `minimumReleaseAge` to gate freshly-published versions, so `pnpm outdated`'s "Latest" is already the curated upgrade target. Don't cross-reference npm, GitHub releases, or CHANGELOGs to pick a newer version.

**For Docker image groups**, there is no `pnpm outdated` equivalent. The target is the latest tag within the same lineage, as determined by [Container image discovery](#container-image-discovery). Do not cross-reference Docker Hub's "latest" tag — target the latest tag matching the current major and variant.

### Title prefixes

| Scope                                       | Prefix                  |
| ------------------------------------------- | ----------------------- |
| Monorepo root                               | `mono - chore: `        |
| Cross-package monorepo change               | `mono - chore: `        |
| Specific package (any repo)                 | `<package name> - chore: ` |
| Single-package repo with no package name    | `root - chore: `        |

Examples:

- `mono - chore: upgrade code quality dependencies`
- `web-app - chore: upgrade TypeScript and build tooling`
- `root - chore: upgrade monorepo tooling`
- `root - chore: upgrade GitHub Actions`
- `mono - chore: upgrade React dependencies`
- `web-app - chore: upgrade Next.js dependencies`
- `api - chore: upgrade Prisma dependencies`
- `root - chore: upgrade fastify dependencies`
- `root - chore: upgrade mongodb`
- `root - chore: upgrade Docker build-time images`
- `root - chore: upgrade Docker Node.js runtime image`
- `root - chore: upgrade Docker postgres image`
- `mono - chore: upgrade Docker redis image`

### PR body

Keep PR bodies short. Use this skeleton, omitting sections that don't apply:

```
## Summary
<one sentence: what's upgraded>

## Versions
- `<pkg>` `<old>` → `<new>`

## Tests
- [x] `pnpm test` passes
- [x] `pnpm build` passes (if applicable)

## Breaking notes
<only for (breaking) PRs — list code changes required>
```

Don't add commentary beyond the skeleton unless something genuinely surprising came up (e.g. a flaky test pre-existing on `main`).

For Docker image PRs, use this skeleton instead:

```
## Summary
<one sentence: what's upgraded>

## Images
- `<image>` `<old-tag>` → `<new-tag>` (`<old-digest-prefix>` → `<new-digest-prefix>`)

## Locations
- `Dockerfile:3` — builder stage
- `compose.yml:12` — service `db`
- `.github/workflows/ci.yml:15` — container

## Checks
- [x] `docker build` passes (or: syntax-only — no Docker daemon available)
- [x] Version sources agree (`.nvmrc`, `package.json engines.node`, etc.)
- [x] System package pins still resolve (if applicable)

## Breaking notes
<only for major version PRs — list required code/config changes>
```

### Major version upgrades

- Research breaking changes before applying.
- Update code as needed for the new version.
- Append `(breaking)` to the PR title: `mono - chore: upgrade code quality dependencies (breaking)`.
- **Each major version upgrade gets its own PR.** Never combine two unrelated majors in one PR. The only exception is related majors within a single ecosystem that must move together (e.g. `react` + `react-dom`, or a framework and its required peer majors) — those may share one PR.
- **Docker major version upgrades** follow the same rule. `node:20` → `node:22`, `ubuntu:22.04` → `ubuntu:24.04`, `postgres:16` → `postgres:17` each get their own PR with `(breaking)` suffix. When a Docker image major bump requires updating project version sources (`.nvmrc`, `package.json engines.node`, `@types/node`), all of those changes travel in the same PR.

## `@types/node` rule

`@types/node` must never exceed the project's Node.js major version. Never use `@types/node@latest`.

Determine the project's Node major from the first available source, in order:

1. `.nvmrc`
2. `.node-version`
3. `package.json` → `engines.node`
4. Volta config in `package.json`
5. Docker files
6. CI configuration

Pin `@types/node` to that major. Example: `.nvmrc` says `24` → use `@types/node@24`, not `@types/node@latest` if latest resolves to `25.x`.

If Node version sources disagree, stop and report the mismatch — don't guess.

In monorepos, the root Node config governs `@types/node` unless a workspace package declares its own supported Node version, in which case compare them first before upgrading that package.

## Container image version agreement

When upgrading Docker base images, the project's canonical Node.js version source is the authority — the Dockerfile must agree.

The canonical Node version is determined from the same priority list as the [`@types/node` rule](#typesnode-rule). The `FROM node:<major>` major in every Dockerfile must equal the canonical major. If they disagree, stop and report.

When a Docker image major bump is needed (e.g. `node:20` → `node:22`), update **all** version sources in the same PR: `.nvmrc`, `.node-version`, `package.json engines.node`, `@types/node`, and every `FROM node:*` line. Never upgrade the Dockerfile image past the project's canonical version without upgrading the project version source in the same PR.

For non-Node images (e.g. `python`, `golang`) referenced in Dockerfiles: apply the same principle using whatever version source the project declares (`.python-version`, `go.mod`, etc.). If no project-level version source exists, upgrade based on tag lineage from [Container image discovery](#container-image-discovery).

## Digest pinning rule

- If an image reference already has a digest pin (`FROM node:20-alpine@sha256:abc123...`), updating the tag without updating the digest is a no-op — the digest wins. Always update **both** tag and digest together.
- If an image reference does not have a digest pin, do not introduce one during a dependency management PR. Introduction of digest pinning is defense-in-depth work.
- To resolve a new digest: `skopeo inspect --raw docker://<image>:<tag>` returns the manifest; the digest is the sha256 of that manifest. Alternatively, `crane digest <image>:<tag>`.
- Always pin to the manifest list digest (multi-arch index), not a platform-specific manifest, unless the Dockerfile uses `--platform`.
