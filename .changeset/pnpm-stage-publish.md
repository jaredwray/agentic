---
"agentic": patch
---

Stage npm packages with `pnpm stage publish` instead of installing the npm CLI

pnpm 11.3 added `pnpm stage`, so defense-in-depth and the release-management publish template no
longer pin a global npm 11.19 CLI just to run `npm stage publish`. CI packs with pnpm and stages
with `pnpm stage publish ./packed/*.tgz --access public --provenance --no-git-checks` (the flag is
required: pnpm still runs git-checks for a tarball, which fail on a detached release-tag checkout
and on the untracked pack output). `packageManager` pins move to pnpm 11.3+. The skills validator
rejects leftover `npm stage publish` and tarball stages missing `--no-git-checks`.
