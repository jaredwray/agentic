---
"agentic": minor
---

Add Aikido Safe Chain cloud bootstrap to defense-in-depth-nodejs

The § 2 catalog replaces the PMG / VM-egress item with a file PR that copies a
fail-closed `setup-cloud-environment.sh` (pinned installer SHA-256, `--ci` shims,
frozen lockfile) plus Codespaces and Cursor templates. Existing `.devcontainer`
and `.cursor` config is merged, not overwritten.
