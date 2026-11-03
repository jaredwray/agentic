---
name: dependency-management-node
description: Upgrade a Node project's dev and runtime dependencies one grouped PR at a time, with pnpm or npm — first reviewing overrides to remove or update them, then code-quality tooling, build tooling, monorepo tooling (including a hash-pinned packageManager written by corepack use), GitHub Actions, Docker images, Dev Container images, then runtime ecosystems, and last the AI model IDs the code calls (look up each provider's latest, recommend, bump on approval) — respecting pnpm minimumReleaseAge or npm's 7-day release-age gate, a 7-day age gate on container image pins, and the @types/node-versus-Node-major rule. Every resume also checks jaredwray/agentic for defense-in-depth and AGENTS.md updates and syncs stale copies. Use when asked to update, upgrade, or bump dependencies or AI models on a Node, pnpm, or npm project. Manual and resumable; overrides first, then the dev phase before the runtime phase.
disable-model-invocation: true
user-invocable: true
---

# Dependency Management

Workflow for upgrading both **devDependencies** (with CI tooling) and **runtime dependencies**, one pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow), which runs the `shipping-conventions` loop from its first step. Only stop to ask the user when that loop or this document says to stop and report (e.g. uncommitted changes, Node version mismatch) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next dep PR`, or similar. Never open a second dep-management PR while one is already in flight.
>
> **Every PR is ready for review, never a draft.** Mark the PR ready for review when you open it (`draft: false`, or the tool's ready-for-review equivalent). If it was created as a draft — including when the environment defaults to draft — mark it ready for review before you stop. Do not leave any PR in draft mode.
>
> **Overrides, then dev, then runtime.** Finish every override that can be removed or updated before any upgrade group. Finish every dev group before starting any runtime group — tooling churn is lower risk than runtime changes.
>
> **Delegated mode.** When the `dependency-management` router hands this skill one package root, follow its delegation contract: work only in that root, run only the phase it names, and skip every step marked *(router-owned)*.
>
> This skill follows the shared `shipping-conventions` loop; PR titles, bodies, and review replies follow `pr-conventions` (the dependency-specific PR-body skeletons below extend it). The GitHub Actions group and every container image group are `repo-dependency-groups`.

## Repository type

Determine the repo shape first:

- **Monorepo** — has `pnpm-workspace.yaml` or `workspaces` in `package.json`. Handle the root and each workspace package.
- **Single-package** — everything else. The root package is the only package.

## Package manager

- **pnpm** — `pnpm-lock.yaml`. Everything in this document is written for pnpm.
- **npm** — `package-lock.json` and no `pnpm-lock.yaml`. The same phases, groups, and rules apply, with these substitutions:

  | pnpm | npm |
  |---|---|
  | `pnpm outdated --dev` / `--prod`, `pnpm -r outdated` | `npm outdated --long` (`--workspaces` in a monorepo); its `Package Type` column splits dev from runtime |
  | "Latest" is the target | the target is the npm row of `repo-dependency-groups` → Release-age gate; see [Version targeting](#version-targeting) |
  | `pnpm install` | `npm install --min-release-age=7` |
  | `pnpm add [-D] <pkg>@<version>` | `npm install <pkg>@<version> --min-release-age=7`, with `--save-dev` for a devDependency, `--save-exact` when the current spec is exact, and `-w <workspace>` for a workspace package |
  | `pnpm why <pkg>` | `npm explain <pkg>` |
  | `pnpm build`, `pnpm test` | `npm run build`, `npm test` |

  `--min-release-age` gates transitive resolution and needs npm 11.10 or newer: use the repo's npm
  when it is new enough, otherwise `npx --yes npm@<version>` with the newest npm release that passes
  the release-age gate. The `packageManager` rules in the monorepo tooling group cover pnpm only; an
  npm project leaves `packageManager` and `engines.npm` as they are.
- **Anything else** (`yarn.lock`, `bun.lock`) — stop and report.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Sync `main` before each branch; start test services with `pnpm test:services:start` (`npm run test:services:start`) when the root `package.json` defines that script.
- **`sandbox`** — anything else (CI, hosted agent session, no Docker). Resolve branch capability before starting, per `shipping-conventions` → Branch-constrained environments. One group per branch per PR is the only shape this workflow ships.

## Phases

Run the three phases in order. Do not interleave.

1. **Overrides** — existing version pins (`pnpm.overrides`, `overrides`, Yarn `resolutions`). Exhaust every pin that can be removed or updated (one PR each) before starting the dev phase. See [Overrides](#overrides).
2. **Dev phase** — devDependencies, GitHub Actions, Docker build-time images, and Dev Container images. Exhaust every dev group (one PR per group, serially) before moving to the runtime phase.
3. **Runtime phase** — runtime ecosystems and standalone runtime deps, then the AI model IDs the code calls. Begin only after every dev group has either been merged or documented as a deferral.

## Standard groups

Group upgrades by toolchain or ecosystem. Each group is **one branch and one PR** containing every listed dep that appears in `pnpm outdated`. In monorepos, a group may span the root and multiple packages.

### Dev groups

Surface with `pnpm outdated --dev` (single-package) or `pnpm -r outdated --dev` (monorepo). Priority order within the dev phase:

1. **Code quality tooling → 1 PR** (testing + linting + formatting always travel together):
   `vitest`, `@vitest/*`, `jest`, `@jest/*`, `@testing-library/*`, `playwright`, `cypress`, `msw`, `@faker-js/faker`, `eslint`, `@eslint/*`, `eslint-*`, `@typescript-eslint/*`, `typescript-eslint`, `biome`, `@biomejs/*`, `prettier`, `stylelint`, test runners, lint/formatter configs.

2. **TypeScript / build tooling → 1 PR**:
   `typescript`, `ts-node`, `tsx`, `ts-jest`, `@types/*` (except `@types/react` and `@types/react-dom` — those travel with the runtime React group), `vite`, `rollup`, `webpack`, `esbuild`, `swc`, `@swc/*`, `babel`, `tsup`, `rimraf`, type-checking utilities, build-script utilities.
   - `@types/node` never exceeds the project's Node major: pin it to the canonical Node major from `repo-dependency-groups` → Image version agreement — `.nvmrc` says `24` → `@types/node@24` even when "Latest" is `25.x`, never `@types/node@latest`. In monorepos the root Node config governs unless a workspace declares its own Node version.

3. **Package manager / monorepo tooling → 1 PR**:
   `pnpm`, `turbo`, `nx`, `changesets`, workspace tooling, and the `packageManager` field in the root `package.json` (not surfaced by `pnpm outdated` — its target is in [Version targeting](#version-targeting)).
   - This rule covers a `packageManager` that names `pnpm`. If it names Yarn, npm, or another manager in a pnpm repo, stop and report — the field and the lockfile disagree, and `corepack use pnpm@<version>` would convert the repo. Whenever `packageManager` changes, write it with its integrity hash — `pnpm@<version>+sha512.<hex>` — by running `corepack use pnpm@<version>`, which downloads that exact release, hashes it, and rewrites the field. Never hand-write the field or its hash. A `packageManager` without a hash is outdated even at the current version and is pinned in this group's PR.
   - Corepack ships with Node up to 24; on Node 25+ run `npm install -g corepack` first. Ignore Corepack's "To update, run: corepack use pnpm@<latest>" banner — it names the registry's `latest`, which bypasses the age gate.

4–6. **GitHub Actions, Docker build-time images, Dev Container images** *(router-owned)* — `chore/github-actions`, `chore/docker-build-images`, and `chore/devcontainer-images` (digest pins under the 7-day age gate) per `repo-dependency-groups`, with the Node row of its Image version agreement.

**Never move a `peerDependencies` range** in any group — it is the package's compatibility promise to its users, and narrowing it is a breaking change. A peer whose newest release falls outside its range is reported in the done report.

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

5–6. **Docker runtime images, Docker service images** *(router-owned)* — per `repo-dependency-groups`.

7. **AI models → 1 PR per provider** *(router-owned)* (only if the repo references AI model IDs; not surfaced by `pnpm outdated`):
   Every model ID the code, config, or env templates hand to an AI provider. Runs last so the provider SDKs (`@anthropic-ai/sdk`, `openai`, `@google/genai`, `ai` + `@ai-sdk/*`, `@aws-sdk/client-bedrock-runtime`, and the like) are already at their targets. The provider is whoever serves the call — `anthropic`, `openai`, `google`, `bedrock`, `vertex` — so a hosting platform's IDs are one group even when they front several vendors.
   - Branch: `chore/ai-models-<provider>` (e.g. `chore/ai-models-anthropic`, `chore/ai-models-bedrock`)
   - PR title: e.g. `root - chore: upgrade Anthropic models`
   - Discovery, catalog lookup, and the per-provider approval are `ai-model-discovery`; scan `.ts`, `.js`, and `.mjs` source and `package.json` `scripts` in addition to the files it lists

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
2. **Try update.** If removal would regress the resolved version, keep that lockfile. Put the override back as `>=<current>` (`<current>` is the exact pin, or the range's lower bound) and run `pnpm install`, not `pnpm add`. The lockfile version is below `<current>`, so the range is unsatisfied and pnpm resolves from the registry — that version is the newest installable under `minimumReleaseAge` (the same gate as `pnpm outdated`'s Latest; do not pick a younger version). If it is newer than the original pin, rewrite the override to that exact version. If the pin moves, that's the PR.
   With npm, set the override to the newest version the npm row of the release-age gate allows and run `npm install --min-release-age=7`; if the pin moves, that's the PR.
3. **Keep** if neither applies. Discard the branch, return to `main`, and continue to the next pin.

Stop at the first pin that removes or updates. Kept pins are not deferrals; they stay until a later resume (usually after a parent upgrade) makes them removable.

## Workflow

The loop — sync `main`, resolve branch capability, pick one item, open the PR, drive CI to green,
check for already-merged, stop and wait for `continue` — is `shipping-conventions`. Run it, with the
**item taxonomy** and **branch naming** below (`chore/<group-key>`, `chore/override-<pkg>`, `chore/agentic-sync`). Its first step syncs `main` and
stops on a dirty working tree — do not skip ahead to the numbered steps here, which are additions
*inside* that loop, not a replacement for it:

1. **Start test services if `local`.** Run `pnpm test:services:start` (`npm run test:services:start`) when the root `package.json` defines it — idempotent, safe to run on every resume. Docker must be running. On a container conflict, remove only the conflicting test-service container and retry — never remove unrelated containers. If the next group is a Docker or Dev Container image group, ensure `skopeo` is available (install if needed).

2. **Review overrides first.** Follow [Overrides](#overrides). If a pin can be removed or updated, verify (if a `build` script exists, `pnpm build && pnpm test`; otherwise `pnpm test`) and open the PR — title e.g. `root - chore: remove <pkg> override` or `root - chore: update <pkg> override` (use `mono - ` when the pin lives at the workspace root). Hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait. Do not pick a standard group this iteration.
   If none can change, continue to step 3. Re-run this step on every resume — a merged parent upgrade often makes a kept pin removable.

3. **Check `jaredwray/agentic` for updates** *(router-owned)*. Run `agentic-upstream-sync`. If it changes any file (a stale copy, a missing or stale `AGENTS.md` section, or a missing `CLAUDE.md` import), open that PR — branch `chore/agentic-sync`, title e.g. `root - chore: sync defense-in-depth files from agentic` — and hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait. Do not pick a standard group this iteration. A catalog behind upstream is reported (running `defense-in-depth-nodejs` is the user's call); then continue to step 4. Re-run this step on every resume.

4. **Determine the active phase.**
   - If any dev group still has outdated deps (ignoring the dev-phase exclusions above; a `packageManager` behind its target or missing its hash counts) or a router-owned dev group in `repo-dependency-groups` is outdated, the active phase is **dev**.
   - Otherwise, if any runtime group still has outdated deps, Docker runtime/service images are outdated, or an AI model reference is behind its provider's latest per `ai-model-discovery` (a declined bump is a deferral, not remaining work), the active phase is **runtime**.
   - If neither phase has any remaining group, the workflow is **done** — report the full list of merged PRs, any documented deferrals (e.g. "typescript 6 needs tsconfig migration — deferred", declined model bumps), and any overrides that were kept, then stop.

5. **Pick the next group.** Within the active phase, pick the highest-priority group from [Standard groups](#standard-groups) that still has outdated deps. Plan the group across all affected workspaces (in monorepos, one group may span the root and multiple packages).

6. **Apply the upgrade.** Branch: `chore/<group-key>` — e.g. `chore/code-quality`, `chore/typescript-build`, `chore/monorepo-tooling`, `chore/github-actions`, `chore/devcontainer-images`, `chore/react`, `chore/nextjs`, `chore/prisma`, `chore/<pkg>` for singletons.
   - Bump it — `pnpm add <pkg>@<version>` (or `pnpm add -D <pkg>@<version>` for devDeps and ecosystem-adjacent devDep members like `@types/react`). `<version>` is the target from [Version targeting](#version-targeting). **Never** `pnpm add <pkg>@latest`, `pnpm update --latest`, `pnpm up --latest`, `npm install <pkg>@latest`, `npm update`, or adding the package to `minimumReleaseAgeExclude` / `trustPolicyExclude` / `min-release-age-exclude` — they bypass the release-age gate and pull versions younger than it allows.
   - Verify the upgrade. Check the relevant `package.json` `scripts` (root for single-package, the affected workspace for monorepos):
     - If a `build` script exists, run `pnpm build && pnpm test` — building first catches type and bundler regressions that tests alone won't.
     - Otherwise run `pnpm test`.
   - **For a Docker or Dev Container image group**, follow `repo-dependency-groups`.
   - **For the `packageManager` field**, `corepack use pnpm@<version>` with the target from [Version targeting](#version-targeting) is the bump and the hash pin in one; commit the lockfile changes its install makes, then verify as above.
   - **For AI model groups**, run `ai-model-discovery` first and take only the one provider's approved bumps it hands back. Replace every approved reference (code, config, env templates, docs), make the request-shape changes the provider's migration guide requires, and verify as above; if the tests call the provider live and no credentials are available, say so in the PR body. The PR body lists each `current → target` with the provider's catalog link, and any out-of-repo values (CI repository variables, deployment config) the user must change by hand.
   - Open the PR **ready for review**, never as a draft — title and body per [Pull request rules](#pull-request-rules). Pass `draft: false` (or the tool's ready-for-review equivalent). If the PR was created as a draft, mark it ready for review before continuing.

   Then hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait.
   Report what's left in the active phase and whether the runtime phase still has work.

## Pull request rules

Loop invariants (one group per PR, one open PR at a time, branch from latest `main`,
branch-constrained environments, ready for review and never a draft) are `shipping-conventions`.
Review replies and the pleasantry-loop exception are `pr-conventions`. What's specific to this workflow:

### Version targeting

**With pnpm, the "Latest" column from `pnpm outdated` is the exact target version — never upgrade past it.** This repo uses pnpm's `minimumReleaseAge` to gate freshly-published versions, so `pnpm outdated`'s "Latest" is already the curated upgrade target. Don't cross-reference npm, GitHub releases, or CHANGELOGs to pick a newer version. Don't add `minimumReleaseAgeExclude` or `trustPolicyExclude` entries to reach a younger version, including for first-party packages this GitHub owner publishes. The one cap below "Latest" is `@types/node`, held at the project's Node major (see the TypeScript / build tooling group).

**With npm**, `npm outdated`'s "Latest" is the registry's `latest` tag, which no gate has filtered. The target is the newest stable version published at least 7 days ago per `npm view <pkg> time --json`, never past `dist-tags.latest` — the npm row of `repo-dependency-groups` → Release-age gate. The `@types/node` cap applies the same way.

**For `packageManager`**, `pnpm outdated` has no row. When `pnpm` is also a devDependency, the target is that row's "Latest" — the field and the devDependency must agree. Otherwise it is the newest stable pnpm release published at least 7 days ago per `npm view pnpm time --json` (the `minimumReleaseAge` window; skip pre-releases). Never `corepack use pnpm@latest`.

**For Docker and Dev Container image groups**, the target is the newest digest in the current lineage that is at least 7 days old, per `repo-dependency-groups`. Do not pin whatever the registry's `latest` tag points at today.

**For override updates**, the package is usually transitive and will not appear in `pnpm outdated`. The target is the version `pnpm install` resolves from the registry after putting the override back as `>=<current>` on the post-remove lockfile — that resolution already applies `minimumReleaseAge`. Do not look up versions on npm, GitHub, or CHANGELOGs.

**For AI model groups**, the target is the provider's newest generally-available model in the same tier as the current reference, per `ai-model-discovery`; it becomes a bump only once the user approves it.

### Drydock artifact diffs

For each npm package the PR bumps, add an **Artifact diffs** list to the PR body:
`- [eslint 9.30.0 → 9.34.0](https://drydock.org/diff/eslint/9.30.0/9.34.0)` — the URL is
`https://drydock.org/diff/<name>/<from>/<to>` (scoped names keep `@scope/`). It diffs the
published artifacts, which the `package.json` + lockfile diff cannot show; nothing contacts
Drydock until a reviewer clicks. Link only npmjs.org-public packages with two distinct published
versions: skip private packages and custom registries (the URL would leak the name and fetch
nothing), image and Actions groups, and anything resolved from git.

### Title prefixes

Per `pr-conventions` → Prefix scheme for the automated ops loops.
Examples:

- `mono - chore: remove semver override`
- `root - chore: update braces override`
- `mono - chore: upgrade code quality dependencies`
- `web-app - chore: upgrade TypeScript and build tooling`
- `api - chore: upgrade Prisma dependencies`
- `root - chore: upgrade Docker Node.js runtime image`
- `root - chore: pin Dev Container images`
- `root - chore: upgrade Anthropic models`
- `root - chore: sync defense-in-depth files from agentic`
