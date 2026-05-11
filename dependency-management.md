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

## Workflow

Run these steps on the **first** invocation, and again on **every resume** when the user says `continue`, `next`, `next dep PR`, or similar.

1. **Sync `main`.** Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`.

2. **Start test services if `local`.** Run `pnpm test:services:start` — idempotent, safe to run on every resume. Docker must be running. On a container conflict, remove only the conflicting test-service container and retry — never remove unrelated containers.

3. **Determine the active phase.**
   - If any dev group still has outdated deps (ignoring the dev-phase exclusions above), the active phase is **dev**.
   - Otherwise, if any runtime group still has outdated deps, the active phase is **runtime**.
   - If neither phase has any remaining group, the workflow is **done** — report the full list of merged PRs and any documented deferrals (e.g. "typescript 6 needs tsconfig migration — deferred") and stop.

4. **Pick the next group.** Within the active phase, pick the highest-priority group from [Standard groups](#standard-groups) that still has outdated deps. Plan the group across all affected workspaces (in monorepos, one group may span the root and multiple packages).

5. **Open the PR.**
   - Branch from latest `main` (naming: `chore/<group-key>` — e.g. `chore/code-quality`, `chore/typescript-build`, `chore/monorepo-tooling`, `chore/github-actions`, `chore/react`, `chore/nextjs`, `chore/prisma`, `chore/<pkg>` for singletons).
   - Apply the upgrade — `pnpm add <pkg>@<version>` (or `pnpm add -D <pkg>@<version>` for devDeps and ecosystem-adjacent devDep members like `@types/react`). `<version>` is the exact value from the "Latest" column of `pnpm outdated`. **Never** `pnpm add <pkg>@latest`, `pnpm update --latest`, or `pnpm up --latest` — they can bypass `minimumReleaseAge` and pull versions younger than the gate allows.
   - Run tests: root-level `pnpm test`, or the package's test command when available (check `package.json` `scripts.test`).
   - Open the PR — title and body per [Pull request rules](#pull-request-rules).

6. **Drive CI to green.** After opening the PR, watch CI with `gh pr checks --watch`. If any check fails, diagnose, fix, and push until every check is green. **Do not stop on a red PR.** Only after the PR is green do you proceed.

7. **Stop and wait.** Report to the user:
   - PR URL and group name
   - Confirmation that CI is green
   - What's still left in the active phase, and whether the runtime phase has remaining work

   Then **wait**. Do not open another PR. The workflow resumes only when the user says `continue`, `next`, `next dep PR`, or similar — at which point, return to Step 1.

## Pull request rules

- **One PR per logical group — always.** Don't combine unrelated groups. Don't fragment a clear group across multiple PRs.
- **Only one open dep-management PR at a time.** If a previous dep-management PR is still open, do not open another — drive its CI to green if needed, then stop and wait per Step 7.
- Every PR uses a unique branch from latest `main`.
- If the environment can't create separate branches or PRs (sandbox, single-branch session, etc.), stop and report. Don't bundle groups onto one branch as commits.

### Version targeting

**The "Latest" column from `pnpm outdated` is the exact target version — never upgrade past it.** This repo uses pnpm's `minimumReleaseAge` to gate freshly-published versions, so `pnpm outdated`'s "Latest" is already the curated upgrade target. Don't cross-reference npm, GitHub releases, or CHANGELOGs to pick a newer version.

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

### Major version upgrades

- Research breaking changes before applying.
- Update code as needed for the new version.
- Append `(breaking)` to the PR title: `mono - chore: upgrade code quality dependencies (breaking)`.
- **Each major version upgrade gets its own PR.** Never combine two unrelated majors in one PR. The only exception is related majors within a single ecosystem that must move together (e.g. `react` + `react-dom`, or a framework and its required peer majors) — those may share one PR.

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
