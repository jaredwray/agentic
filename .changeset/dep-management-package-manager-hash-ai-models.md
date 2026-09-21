---
"agentic": minor
---

Hash-pin `packageManager` and add an AI model upgrade step to the dependency-management skills

`dependency-management-node` now owns the `packageManager` field as part of the package manager /
monorepo tooling group. Whenever the field changes it is written by `corepack use pnpm@<version>`,
so it lands as `pnpm@<version>+sha512.<hex>` and Corepack verifies every later download against
that hash; a hash-less field counts as outdated, and a field naming another manager stops the skill
(its toolchain is pnpm). Its target is the `pnpm` devDependency's "Latest"
when there is one, otherwise the newest stable release at least 7 days old per
`npm view pnpm time --json` — never Corepack's "To update" banner.

Both `dependency-management-node` and `dependency-management-rust` gain a last runtime group, **AI
models → 1 PR per provider**, backed by a new shared skill, `ai-model-discovery`: sweep the repo for
model IDs (code, config, env templates, CI, docs), look up each provider's current catalog and
deprecations page (Anthropic, OpenAI, Google, the hosting platform's own catalog for Bedrock and
Vertex IDs, or the provider's own list), and recommend the newest generally-available model in the
same tier. The recommendation is one line per reference; approval is per provider, and the PR opens
only for that provider's approved bumps, carrying the request-shape changes its migration guide
requires.

Also restores three rules whose sections the Claude 5 audit cut while leaving their links dangling:
the `@types/node`-versus-Node-major cap and Container image version agreement in
`dependency-management-node`, and the MSRV rule and Container image version agreement in
`dependency-management-rust`.
