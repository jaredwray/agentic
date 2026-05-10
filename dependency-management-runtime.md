# Runtime Dependency Management

Workflow for upgrading **runtime dependencies** based on `pnpm outdated --prod`.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Only stop to ask the user when the document explicitly says to stop and report (e.g. uncommitted changes, Node version mismatch) or when a decision genuinely requires their input.
>
> Scope: runtime ecosystems and singletons. For devDependency and CI tooling upgrades, see [dependency-management-dev.md](dependency-management-dev.md). Run the dev workflow first when both have outdated deps — tooling churn is lower risk than runtime changes.

## Repository type

Determine the repo shape first:

- **Monorepo** — has `pnpm-workspace.yaml` or `workspaces` in `package.json`. Handle the root and each workspace package.
- **Single-package** — everything else. The root package is the only package.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Sync `main` before each branch; start test services with `pnpm test:services:start`.
- **`sandbox`** — anything else (CI, single-branch agent session, no Docker). If the sandbox can't create separate branches and PRs, stop and report.

## Standard groups

Group upgrades by ecosystem. Each group is **one branch and one PR** containing every listed dep that appears in `pnpm outdated --prod`. In monorepos, a group may span the root and multiple packages.

**Runtime groups include all members of an ecosystem regardless of whether they're classified as `dependencies` or `devDependencies` in `package.json`.** `--prod` won't surface devDep-classified ecosystem members (e.g. `@types/react`, `eslint-config-next`, the Prisma CLI) — check `package.json` for them when planning each group.

**React → 1 PR** (all React-ecosystem deps, including majors of `react` + `react-dom` + their `@types`):
`react`, `react-dom`, `@types/react`, `@types/react-dom`, React-specific libraries that move with the React version.

**Next.js → 1 PR**:
`next`, `eslint-config-next`, Next.js plugins, related tooling. Include React packages here when the Next upgrade requires them — in that case there's no separate React PR.

**Data, API, backend** — one PR per ecosystem (only group deps clearly part of the same ecosystem):
- GraphQL libraries → 1 PR
- Prisma libraries (including the `prisma` CLI devDep) → 1 PR
- `fastify` + its plugins → 1 PR
- tRPC libraries → 1 PR
- Auth libraries within the same auth stack → 1 PR
- Database drivers — individually unless they share a clear ecosystem

**Everything else → 1 PR per dependency**:
Standalone runtime deps with no clear ecosystem partner each get their own PR.

## Workflow

1. **Sync `main`.** Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`. Repeat before each new branch — never branch from stale `main`.

2. **Check outdated.** Run `pnpm outdated --prod` (single-package) or `pnpm -r outdated --prod` (monorepo). Also inspect `package.json` for ecosystem-adjacent devDeps that travel with a runtime group (`@types/react`, `eslint-config-next`, `prisma` CLI, etc.) — `--prod` won't surface them but they belong in their runtime ecosystem's PR. **The "Latest" column is the exact target version — never upgrade past it.** This repo uses pnpm's `minimumReleaseAge` to gate freshly-published versions, so `pnpm outdated`'s "Latest" is already the curated upgrade target. Don't cross-reference npm, GitHub releases, or CHANGELOGs to pick a newer version. Plan groups per [Standard groups](#standard-groups) before changing anything.

3. **Start test services if `local`.** Run `pnpm test:services:start`. Docker must be running. On a container conflict, remove only the conflicting test-service container and retry — never remove unrelated containers.

4. **For each group**, in order — React first, then Next.js, then backend ecosystems (Prisma, GraphQL, fastify, tRPC, auth, db drivers), then Everything-else singletons. Cross-package groups span all affected workspaces in one PR.
   - Branch from latest `main` (naming: `chore/<group-key>` — e.g. `chore/react`, `chore/nextjs`, `chore/prisma`, `chore/<pkg>` for singletons)
   - Apply the upgrade — `pnpm add <pkg>@<version>` where `<version>` is the exact value from the "Latest" column of `pnpm outdated` (use `pnpm add -D` for ecosystem-adjacent devDep members like `@types/react`). Never `pnpm add <pkg>@latest`, `pnpm update --latest`, or `pnpm up --latest` — they can bypass `minimumReleaseAge` and pull versions younger than the gate allows.
   - Run tests: root-level `pnpm test`, or the package's test command when available (check `package.json` `scripts.test`)
   - Open one PR — don't open until tests pass, or any failure is understood and explained in the PR body

5. **Resolve conflicts as PRs merge.** Rebase open branches on updated `main`. Keep two conflict types distinct:
   - **Docker container conflicts** → remove the conflicting test-service container
   - **Git conflicts** → rebase or otherwise resolve the branch

6. **Done.** The workflow ends when every group from the plan has either an opened PR or a documented deferral. Report the list of opened PRs and any deferrals to the user.

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
- Append `(breaking)` to the PR title: `mono - chore: upgrade React dependencies (breaking)`.
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
