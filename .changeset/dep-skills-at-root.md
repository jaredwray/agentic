---
"agentic": minor
---

Move the dependency-management skills to the `skills/` root

`dependency-management-node` and `dependency-management-rust` now live at `skills/<name>/`
instead of under `release-ops/`. They are used often, so they belong in the default one-level
`skills/` scan. Invocation names are unchanged (`/agentic:dependency-management-node`,
`/agentic:dependency-management-rust`), and both stay manual-only.
