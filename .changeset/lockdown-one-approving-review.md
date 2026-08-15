---
"agentic": minor
---

Require one approving review of the latest push in the defense-in-depth lockdown ruleset

`lockdown-repo.sh` now writes `required_approving_review_count: 1` and
`require_last_push_approval: true` on the default-branch PR ruleset. `--check` fails if
the live ruleset still allows zero-review merges or lets a later push merge on a stale
approval (dismissing stale reviews on push is accepted as equivalent).
