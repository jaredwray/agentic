---
"agentic": minor
---

Require one approving review of the latest push; only the repository owner can merge

`lockdown-repo.sh` now writes `required_approving_review_count: 1`,
`require_last_push_approval: true`, and an `update` rule on the default-branch
PR ruleset. The bypass list is the repository owner (the owner user on a
user-owned repo, organization owners on an org-owned repo) in **pull-request**
mode, so only they can merge, they can merge without a review, and they still
cannot push directly. `--check` fails if the live ruleset still allows
zero-review merges, lets a later push merge on a stale approval (dismissing
stale reviews on push is accepted as equivalent), lets non-owners merge, or has
the wrong bypass list.
