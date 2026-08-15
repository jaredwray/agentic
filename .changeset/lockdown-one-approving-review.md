---
"agentic": minor
---

Require one approving review in the defense-in-depth lockdown ruleset

`lockdown-repo.sh` now writes `required_approving_review_count: 1` on the default-branch
PR ruleset, and `--check` fails if the live ruleset still allows zero-review merges.
