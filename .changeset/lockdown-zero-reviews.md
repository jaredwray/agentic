---
"agentic": minor
---

Stop requiring an approving review on the default-branch ruleset

`lockdown-repo.sh` now writes `required_approving_review_count: 0` and
`require_last_push_approval: false`. Pull requests, code-owner review of owned
paths, and owner-only merge stay in place; a second person no longer has to
approve the tip commit. `--check` fails if the live ruleset still requires a
review count above 0 or last-push approval.
