---
"agentic": minor
---

Version the defense-in-depth-nodejs catalog

The hardening catalog now has its own semver (`VERSION`, independent of the plugin version). Target
repos record it as `Catalog: defense-in-depth-nodejs@<semver>` in `DEFENSE_IN_DEPTH.md`, so you can
see what version each repo is on. Applying agents compare that line to `VERSION` and upgrade (or
stop if this skill copy is stale). Bump rules and history live next to the catalog.
