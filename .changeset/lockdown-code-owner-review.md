---
"agentic": minor
---

Require a code-owner review on owned paths

`lockdown-repo.sh` writes `require_code_owner_review: true` on the default-branch PR
ruleset and `--check` fails if that flag is off **or** if the default branch has no
CODEOWNERS file with an owner. Adding `.github/CODEOWNERS` is a file PR (template in
the skill reference); the script never writes the file. This repo dogfoods the
template with `@jaredwray` on `/.github/`, `/.cursor/`, `/.devcontainer/`, and
`/scripts/`. The owner's pull-request bypass still lets them merge without that
review.
