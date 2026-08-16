---
"agentic": minor
---

Stop requiring Restrict updates on the default-branch ruleset

`lockdown-repo.sh` no longer writes the `update` rule. Restrict updates stays
off so writers other than the bypass actor can still merge once the remaining
rules pass. Pull requests, code-owner review of owned paths, and the owner's
pull-request bypass stay in place. `--check` fails if the live ruleset still
has Restrict updates on.
