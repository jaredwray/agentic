---
"agentic": minor
---

Require one approving review of the latest push in the defense-in-depth lockdown ruleset

`lockdown-repo.sh` now writes `required_approving_review_count: 1` and
`require_last_push_approval: true` on the default-branch PR ruleset. Repository admins
(the owner on a user-owned repo) are a **pull-request** bypass, so they can merge without
a review but still cannot push directly. `--check` fails if the live ruleset still allows
zero-review merges, lets a later push merge on a stale approval (dismissing stale reviews
on push is accepted as equivalent), or has the wrong bypass list.
