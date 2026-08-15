---
"agentic": minor
---

Review pnpm overrides before any Node dependency upgrade group

`dependency-management-node` now treats existing `pnpm.overrides` / `overrides` / Yarn
`resolutions` as their own first phase. Each resume lists every pin, then tries to remove
one (the parent has caught up) or update one (the pin itself is stale) before picking a
dev or runtime group. One override per PR; pins that still have to stay are reported, not
deferred, and get another look after a parent upgrade merges.
