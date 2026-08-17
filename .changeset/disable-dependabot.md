---
"agentic": patch
---

Disable Dependabot in defense-in-depth-nodejs

Aikido already does CVE/SCA and Socket already reviews dependency diffs, so Dependabot
alerts and security-update PRs are overlapping noise rather than a second independent
control. `lockdown-repo.sh` now disables both via the API, and `--check` fails while
they are on or while `.github/dependabot.yml` is present. The catalog drops the
manual auto-dismiss-low+medium rule and the § 3 item is "no Dependabot config;
other updaters (if any) open PRs only."
