---
"agentic": minor
---

Make zizmor skip SARIF upload on fork PRs

Fork PRs get a read-only `GITHUB_TOKEN`, so `zizmor-action`'s default Advanced Security
upload fails and the required `zizmor` check cannot pass. The check-workflows template
(and this repo's dogfood workflow) keep `security-events: write` for same-repo SARIF
uploads and switch fork PRs to annotations. Permission values cannot be expressions.
