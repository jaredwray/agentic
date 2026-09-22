---
"agentic": minor
---

Check `jaredwray/agentic` for defense-in-depth and `AGENTS.md` updates on every dependency-management resume

`dependency-management-node` and `dependency-management-rust` gain a per-resume step, backed by a new
shared skill, `agentic-upstream-sync`: clone `jaredwray/agentic` `main` and compare the repo's copied
Safe Chain bootstrap script, its `AGENTS.md` template sections, and its `DEFENSE_IN_DEPTH.md` catalog
against upstream. A stale script or section is refreshed and a missing section appended in one
`chore/agentic-sync` PR before any upgrade group; a locally edited section and a catalog behind
upstream are reported instead — the catalog is the `defense-in-depth-nodejs` skill's to re-audit.
