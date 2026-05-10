# Dependency Management

Workflow for upgrading dependencies based on `pnpm outdated`.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Only stop to ask the user when the document explicitly says to stop and report (e.g. uncommitted changes, Node version mismatch) or when a decision genuinely requires their input.

## Repository type

Determine the repo shape first:

- **Monorepo** — has `pnpm-workspace.yaml` or `workspaces` in `package.json`. Handle the root and each workspace package.
- **Single-package** — everything else. The root package is the only package.

## Standard groups

Group upgrades by ecosystem, toolchain, or logical area. Each group is **one branch and one PR** containing every listed dep that appears in `pnpm outdated`. In monorepos, a group may span the root and multiple packages.

**Code quality tooling → 1 PR** (testing + linting + formatting always travel together):
`vitest`, `jest`, `@jest/*`, `@testing-library/*`, `playwright`, `cypress`, `msw`, `@faker-js/faker`, `eslint`, `@eslint/*`, `eslint-*`, `biome`, `@biomejs/*`, `prettier`, `stylelint`, test runners, lint/formatter configs.

**TypeScript / build tooling → 1 PR**:
`typescript`, `ts-node`, `tsx`, `ts-jest`, `@types/*`, `vite`, `rollup`, `webpack`, `esbuild`, `swc`, `@swc/*`, `babel`, `tsup`, `rimraf`, type-checking utilities, build-script utilities.

**React → 1 PR** (all React-ecosystem deps, including majors of `react` + `react-dom` + their `@types`):
`react`, `react-dom`, `@types/react`, `@types/react-dom`, React-specific libraries that move with the React version.

**Next.js → 1 PR**:
`next`, `eslint-config-next`, Next.js plugins, related tooling. Include React packages here when the Next upgrade requires them — in that case there's no separate React PR.

**Package manager / monorepo tooling → 1 PR**:
`pnpm`, `turbo`, `nx`, `changesets`, workspace tooling.

**Data, API, backend** — one PR per ecosystem (only group deps clearly part of the same ecosystem):
- GraphQL libraries → 1 PR
- Prisma libraries → 1 PR
- `fastify` + its plugins → 1 PR
- tRPC libraries → 1 PR
- Auth libraries within the same auth stack → 1 PR
- Database drivers — individually unless they share a clear ecosystem

**Everything else → 1 PR per dependency**:
Standalone runtime deps with no clear ecosystem partner each get their own PR.

## Workflow

1. **Sync `main`.** Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`. Repeat before each new branch — never branch from stale `main`.

2. **Check outdated.** Run `pnpm outdated` (single-package) or `pnpm -r outdated` (monorepo). Plan groups per [Standard groups](#standard-groups) before changing anything.

3. **Start test services if `local`.** Run `pnpm test:services:start`. Docker must be running. On a container conflict, remove only the conflicting test-service container and retry — never remove unrelated containers.

4. **For each group**, in order — root devDependencies first (code quality, then other dev groups), then root dependencies, then per-workspace deps in monorepos. Cross-package groups span all affected workspaces in one PR.
   - Branch from latest `main`
   - Apply the upgrade
   - Run tests: root-level `pnpm test`, or the package's test command when available
   - Open one PR — don't open until tests pass, or any failure is understood and explained in the PR body

5. **Resolve conflicts as PRs merge.** Rebase open branches on updated `main`. Keep two conflict types distinct:
   - **Docker container conflicts** → remove the conflicting test-service container
   - **Git conflicts** → rebase or otherwise resolve the branch

## Pull request rules

- **One PR per logical group — always.** Don't combine unrelated groups. Don't fragment a clear group across multiple PRs.
- Every PR uses a unique branch from latest `main`.
- If the environment can't create separate branches or PRs (sandbox, single-branch session, etc.), stop and report. Don't bundle groups onto one branch as commits.

### Title prefixes

| Scope                                       | Prefix                  |
| ------------------------------------------- | ----------------------- |
| Monorepo root                               | `mono - chore: `        |
| Cross-package monorepo change               | `mono - chore: `        |
| Specific package (any repo)                 | `<package name> - chore: ` |
| Single-package repo with no package name    | `root - chore: `        |

Examples:

- `mono - chore: upgrade code quality dependencies`
- `mono - chore: upgrade React dependencies`
- `web-app - chore: upgrade Next.js dependencies`
- `api - chore: upgrade Prisma dependencies`
- `root - chore: upgrade TypeScript tooling`

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
