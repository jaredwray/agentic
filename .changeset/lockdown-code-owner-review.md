---
"agentic": minor
---

Require a code-owner review on owned paths

`lockdown-repo.sh` writes `require_code_owner_review: true` on the default-branch PR
ruleset and `--check` fails if that flag is off **or** if the default branch has no
CODEOWNERS file with an owner. Adding `.github/CODEOWNERS` is a file PR from the
skill template (`{{OWNERS}}` on `/.github/`, `/.cursor/`, `/.devcontainer/`, and
`/scripts/`); the agent asks who the owners are and never hardcodes a username.
The script never writes the file. The owner's pull-request bypass still lets them
merge without that review.
