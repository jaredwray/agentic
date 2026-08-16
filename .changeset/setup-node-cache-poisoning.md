---
"agentic": minor
---

Disable `actions/setup-node` default caching on artifact-publishing workflows

The defense-in-depth § 4 catalog now requires `package-manager-cache: false` on every
`actions/setup-node` step in workflows that publish artifacts, so a poisoned GitHub Actions
cache cannot run in a job that holds publish credentials. The release-management publish
template's Aikido gate matches that setting.
