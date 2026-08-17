---
"agentic": minor
---

Run GitHub lockdown last in defense-in-depth-nodejs

`lockdown-repo.sh` apply is always the last catalog item (§ 7). File hardening
(docs, CODEOWNERS, pnpm, Actions, publishing, tooling) lands first so required
status checks and the Actions allowlist match the workflows that actually ship,
and CODEOWNERS exists before the branch ruleset enforces it. `--check` still
runs on every audit; a FAIL does not jump the queue.

The catalog collapses the per-setting GitHub checkboxes into that one script
item. After apply, a tracking PR records the result in `DEFENSE_IN_DEPTH.md`.
CI now fails if the catalog or item priority puts the script anywhere but last.
