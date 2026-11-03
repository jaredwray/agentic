# Node

Rules for a Node package root. Monorepo: `pnpm-workspace.yaml` or `workspaces` in `package.json` —
handle the root package and every workspace package, and let one group span several of them.

## Package manager

- **pnpm** — `pnpm-lock.yaml`. Everything below is written for pnpm.
- **npm** — `package-lock.json` and no `pnpm-lock.yaml`. The same groups and rules apply, with these substitutions:

  | pnpm | npm |
  |---|---|
  | `pnpm outdated --dev` / `--prod`, `pnpm -r outdated` | `npm ci`, then `npm outdated --long` (`--workspaces` in a monorepo) — without `node_modules` it lists only `dependencies`; its `Package Type` column splits dev from runtime |
  | "Latest" is the target | the target comes from `npm view`; see [Version targeting](#version-targeting) |
  | `pnpm install` | `npm install --min-release-age=7` |
  | `pnpm add [-D] <pkg>@<version>` | `npm install <pkg>@<version> --min-release-age=7`, with `--save-dev` for a devDependency, `--save-exact` when the current spec is exact, and `-w <workspace>` for a workspace package |
  | `pnpm why <pkg>` | `npm explain <pkg>` |
  | `pnpm build`, `pnpm test` | `npm run build`, `npm test` |

  `--min-release-age` needs npm 11.10 or newer, and older npm ignores it without a warning. Check
  `npm --version` before the first install: use the repo's npm when it is new enough, otherwise
  `npx --yes npm@<version>` with the newest npm release that passes the release-age gate. The
  `packageManager` rules below cover pnpm only; an npm project leaves `packageManager` and
  `engines.npm` as they are.
- **Anything else** (`yarn.lock`, `bun.lock`) — stop and report.

## Runtime version

The canonical Node **major** is the first of `.nvmrc`, `.node-version`, `package.json`
`engines.node`, Volta config in `package.json`, Dockerfiles, CI configuration; if these disagree, stop
and report. In a monorepo the root's Node config governs unless a workspace declares its own. Node
images follow it. `@types/node` never exceeds it: `.nvmrc` says `24` → `@types/node@24` even when
"Latest" is `25.x`. A new Node major is the user's call, shipped as one `(breaking)` PR that moves
`.nvmrc`, `engines.node`, `@types/node`, and the images together.

## Candidates

Dev groups: `pnpm outdated --dev` (single package) or `pnpm -r outdated --dev` (monorepo). Runtime
groups: `pnpm outdated --prod` / `pnpm -r outdated --prod`, plus the ecosystem-adjacent devDeps that
travel with a runtime group (`@types/react`, `eslint-config-next`, the `prisma` CLI) — `--prod` won't
surface them.

- **Never move a `peerDependencies` range** in any group — it is the package's compatibility promise to its users, and narrowing it is a breaking change. A peer whose newest release falls outside its range goes in the done report.
- **Exclude from dev groups**, even when `--dev` lists them, the devDeps that belong to a runtime ecosystem: `@types/react`, `@types/react-dom`, `eslint-config-next`, the `prisma` CLI, and the like. They ship with that ecosystem's runtime group.

## Overrides

Review every existing pin **before** any upgrade group. Overrides go stale: the parent catches up, or
the pin itself lags. One override per PR, branch `chore/override-<pkg>`. Do not add new overrides.

**Collect** every pin — do not skip one because it looks intentional: `pnpm.overrides` and `overrides`
in the root and every workspace `package.json`, `overrides` in `pnpm-workspace.yaml`, and Yarn
`resolutions`. Each key is one override; each leaf of a nested npm-style override
(`"foo": { ".": "1.0.0", "bar": "2.0.0" }`) counts as one.

**Try one** at a time, in listed order, on its branch from the latest `main`:

1. **Try remove.** Delete the pin, run `pnpm install`, and check `pnpm why <pkg>` and the lockfile. If the resolved version is still ≥ the pin, the parent has caught up — that's the PR.
2. **Try update.** If removal would regress the resolved version, keep that lockfile. Put the override back as `>=<current>` (`<current>` is the exact pin, or the range's lower bound) and run `pnpm install`, not `pnpm add`. The lockfile version is below `<current>`, so pnpm resolves from the registry — the newest version `minimumReleaseAge` allows. If that is newer than the original pin, rewrite the override to that exact version; that's the PR. With npm, set the override to the newest version the npm registry row of the release-age gate allows and run `npm install --min-release-age=7`; if the pin moves, that's the PR.
3. **Keep** if neither applies. Discard the branch, return to `main`, and try the next pin.

Stop at the first pin that removes or updates. Kept pins are not deferrals; a later run, usually after
a parent upgrade, may make them removable. PR titles: `root - chore: remove <pkg> override`,
`mono - chore: update <pkg> override`.

## Dev groups

1. **Code quality tooling → 1 PR** (`chore/code-quality`) — testing, linting, and formatting travel together:
   `vitest`, `@vitest/*`, `jest`, `@jest/*`, `@testing-library/*`, `playwright`, `cypress`, `msw`, `@faker-js/faker`, `eslint`, `@eslint/*`, `eslint-*`, `@typescript-eslint/*`, `typescript-eslint`, `biome`, `@biomejs/*`, `prettier`, `stylelint`, test runners, lint and formatter configs.

2. **TypeScript / build tooling → 1 PR** (`chore/typescript-build`):
   `typescript`, `ts-node`, `tsx`, `ts-jest`, `@types/*` (except `@types/react` and `@types/react-dom`), `vite`, `rollup`, `webpack`, `esbuild`, `swc`, `@swc/*`, `babel`, `tsup`, `rimraf`, type-checking and build-script utilities. `@types/node` stays at the Node major per [Runtime version](#runtime-version).

3. **Package manager / monorepo tooling → 1 PR** (`chore/monorepo-tooling`):
   `pnpm`, `turbo`, `nx`, `changesets`, workspace tooling, and the `packageManager` field in the root `package.json`.
   - This covers a `packageManager` that names `pnpm`. If it names another manager in a pnpm repo, stop and report — the field and the lockfile disagree, and `corepack use` would convert the repo.
   - Write the field only with `corepack use pnpm@<version>`, which downloads that release, hashes it, and writes `pnpm@<version>+sha512.<hex>`. Never hand-write the field or its hash. A `packageManager` without a hash is outdated even at the current version.
   - Corepack ships with Node up to 24; on Node 25+ run `npm install -g corepack` first. Ignore Corepack's "To update, run: corepack use pnpm@<latest>" banner — it names the registry's `latest`, which bypasses the gate.

## Runtime groups

1. **React → 1 PR** (`chore/react`): `react`, `react-dom`, `@types/react`, `@types/react-dom`, and React-specific libraries that move with the React version.
2. **Next.js → 1 PR** (`chore/nextjs`): `next`, `eslint-config-next`, Next.js plugins and tooling. Include the React packages when the Next upgrade requires them; there is then no separate React PR.
3. **Backend ecosystems → 1 PR each** — only deps clearly in the same ecosystem: GraphQL libraries; Prisma libraries with the `prisma` CLI; `fastify` and its plugins; tRPC libraries; auth libraries of one auth stack; database drivers individually unless they share an ecosystem.
4. **Everything else → 1 PR per dependency** (`chore/<pkg>`; a scoped name drops the `@` and turns `/` into `-`: `chore/cacheable-node-cache`).

## Apply and verify

- Bump with `pnpm add <pkg>@<version>` (`pnpm add -D` for devDeps and ecosystem-adjacent devDep members like `@types/react`); `<version>` is the target from [Version targeting](#version-targeting). **Never** `pnpm add <pkg>@latest`, `pnpm update --latest`, `pnpm up --latest`, `npm install <pkg>@latest`, or `npm update` — they bypass the release-age gate.
- For `packageManager`, `corepack use pnpm@<version>` is the bump and the hash pin in one; commit the lockfile changes its install makes.
- Verify in each affected package: `pnpm build && pnpm test` when a `build` script exists — building first catches type and bundler regressions — otherwise `pnpm test`.

## Version targeting

- **pnpm:** the "Latest" column of `pnpm outdated` is the exact target — `minimumReleaseAge` already gated it. Never go past it, and don't cross-reference npm, GitHub releases, or changelogs to pick another version. The one cap below it is `@types/node`.
- **npm:** `npm outdated`'s "Latest" is the registry's `latest` tag, which no gate filtered. The target is the newest stable version published at least 7 days ago per `npm view <pkg> time --json`, never past `dist-tags.latest`. The `@types/node` cap applies.
- **`packageManager`:** when `pnpm` is also a devDependency, its "Latest" — the two must agree. Otherwise the newest stable pnpm published at least 7 days ago per `npm view pnpm time --json`. Never `corepack use pnpm@latest`.
- **Override updates:** the version `pnpm install` resolves after the `>=<current>` step above.

**Drydock artifact diffs.** For each npm package the PR bumps, add an **Artifact diffs** list to the
PR body: `- [eslint 9.30.0 → 9.34.0](https://drydock.org/diff/eslint/9.30.0/9.34.0)` — the URL is
`https://drydock.org/diff/<name>/<from>/<to>` (scoped names keep `@scope/`). It diffs the published
artifacts, which the lockfile diff cannot show. Link only npmjs.org-public packages with two distinct
published versions: skip private packages and custom registries (the URL would leak the name), and
anything resolved from git.

## AI models

Scan `.ts`, `.js`, `.mjs`, `.cjs` source and `package.json` `scripts`. Provider SDKs:
`@anthropic-ai/sdk`, `openai`, `@google/genai`, `ai` with `@ai-sdk/*`,
`@aws-sdk/client-bedrock-runtime`.

Titles, e.g. `mono - chore: upgrade code quality dependencies`, `web-app - chore: upgrade TypeScript
and build tooling`, `api - chore: upgrade Prisma dependencies`.
