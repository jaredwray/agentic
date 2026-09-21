---
"agentic": minor
---

Hash-pin `packageManager` and add an AI model upgrade step to the dependency-management skills

`dependency-management-node` now owns the `packageManager` field as part of the package manager /
monorepo tooling group. Whenever the field changes it is written by `corepack use pnpm@<version>`,
so it lands as `pnpm@<version>+sha512.<hex>` and Corepack verifies every later download against
that hash; a hash-less field counts as outdated. Its target is the `pnpm` devDependency's "Latest"
when there is one, otherwise the newest stable release at least 7 days old per
`npm view pnpm time --json` — never Corepack's "To update" banner.

Both `dependency-management-node` and `dependency-management-rust` gain a last runtime group, **AI
models → 1 PR per provider**: sweep the repo for model IDs (code, config, env templates, CI, docs),
look up each provider's current catalog and deprecations page (Anthropic, OpenAI, Google, or the
provider's own list), and recommend the newest generally-available model in the same tier. The
recommendation is one line per reference; the PR opens only for the bumps the user approves and
carries the request-shape changes the provider's migration guide requires.
