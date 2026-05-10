# Dependency Management

#oss

Workflow for upgrading dependencies based on `pnpm outdated`.

## Repository type

Determine the repo shape first:

- **Monorepo** — has `pnpm-workspace.yaml` or `workspaces` in `package.json`. Handle the root and each workspace package.
- **Single-package** — everything else. The root package is the only package.

## Local environment setup

When the environment is `local`, sync with `main` before any upgrade work — and again before each new branch.

1. Confirm the working tree is clean:

   ```
   git status --short
   ```

   If there are uncommitted changes, stop and report. Never discard uncommitted work.

2. Update `main`:

   ```
   git checkout main
   git pull --ff-only origin main
   ```

3. Repeat steps 1–2 before starting each new upgrade group. Never branch from stale `main`.

## Grouping philosophy

Group upgrades by ecosystem, toolchain, or logical area. **One PR per group, not per dependency.** Use individual PRs only when a dependency has no clear group, the upgrade is risky, or it's a major version that needs isolated review.

In monorepos, a group may span the root and multiple packages.

### Standard groups

**Code quality tooling** — always one group (testing + linting + formatting together):
`vitest`, `jest`, `@jest/*`, `@testing-library/*`, `playwright`, `cypress`, `msw`, `eslint`, `@eslint/*`, `eslint-*`, `biome`, `@biomejs/*`, `prettier`, `stylelint`, test runners, lint/formatter configs.

**TypeScript / build tooling**:
`typescript`, `ts-node`, `tsx`, `ts-jest`, `@types/*`, `vite`, `rollup`, `webpack`, `esbuild`, `swc`, `babel`, type-checking utilities.

**React**:
`react`, `react-dom`, `@types/react`, `@types/react-dom`, React-specific libraries.

**Next.js**:
`next`, `eslint-config-next`, Next.js plugins, related tooling. Include React packages here when the Next upgrade requires them.

**Package manager / monorepo tooling**:
`pnpm`, `turbo`, `nx`, `changesets`, workspace tooling.

**Data, API, backend** — group only when clearly related:
GraphQL libraries together, Prisma libraries together, `fastify` + plugins, database drivers, tRPC libraries, auth libraries within the same auth stack.

**Everything else**:
Upgrade individually unless a clear grouping reason exists.

## Workflow

### 1. Check outdated dependencies

- Monorepo: `pnpm -r outdated`
- Single-package: `pnpm outdated`

### 2. Plan before changing anything

Review all outdated deps, identify groups, and decide scope (root only, single package, or cross-package). Code quality tooling is always planned as one group.

### 3. Start test services if needed

When the environment is `local`, tests require Docker-backed services:

```
pnpm test:services:start
```

Docker must be running. On a container conflict, remove only the conflicting test-service container and retry. Never remove unrelated containers.

### 4. Apply upgrades in order

For each group below, create one branch from latest `main`, apply the upgrade, run tests, open one PR.

**Root devDependencies**
1. Code quality tooling group
2. Other devDependency groups (TypeScript tooling, build tooling, monorepo tooling, etc.)

**Root dependencies**
React group, Next.js group, GraphQL group, Prisma group, auth group, database group, etc. Individual PR if no group fits.

**Workspace packages (monorepo only)**
For each package, follow the same order: code quality tooling, other devDependencies, runtime dependencies. Prefer package-specific tests when available; fall back to `pnpm test` from the root.

**Cross-package groups**
When an ecosystem touches multiple workspaces, upgrade it in one PR spanning all affected packages — don't split it per package. Examples: code quality tooling across the whole monorepo, React across all workspaces, Next.js across all apps.

## Testing rules

- After each upgrade group, run tests before opening the PR.
- Root-level: `pnpm test`.
- Package-level: use the package's test command if it exists; otherwise `pnpm test` from the root.
- If `local`: run `pnpm test:services:start` first.
- Don't open a PR until tests pass — or until any failure is understood and explained in the PR body.

## Pull request rules

- One PR per logical group. Don't combine unrelated groups. Don't fragment a clear group across multiple PRs.
- Every PR uses a unique branch, created from latest `main`.

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
- Isolate risky majors. Related majors that must move together as one ecosystem may still be grouped.

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

## Branch and conflict rules

- Every PR uses a unique branch, created from latest `main` (run `git checkout main && git pull --ff-only origin main` first).
- As PRs merge, check open branches for Git conflicts. Resolve by rebasing on `main` (in `local`, update `main` first).
- Keep the two kinds of conflict distinct:
  - **Docker container conflicts** → remove the conflicting test-service container.
  - **Git conflicts** → rebase or otherwise resolve the branch.