---
"agentic": minor
---

Require a code-owner review on owned paths

`lockdown-repo.sh` now writes `require_code_owner_review: true` on the default-branch
PR ruleset. `--check` fails if the live ruleset does not require code-owner review.
Without a `CODEOWNERS` file the setting is a no-op; the owner's pull-request bypass
still lets them merge without that review.
