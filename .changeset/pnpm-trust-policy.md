---
"agentic": patch
---

Track `trustPolicy: no-downgrade` in the pnpm security baseline

The setting was already in the workspace YAML snippet but not a catalog item, so
applying agents could skip it. Defense-in-depth § 3 now requires it (and no
first-party `trustPolicyExclude`); release-management's baseline list matches.
