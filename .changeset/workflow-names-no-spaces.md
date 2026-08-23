---
"agentic": minor
---

Require kebab-case workflow and job names in defense-in-depth

GitHub rulesets cannot require a status check whose name contains a space. The
defense-in-depth § 4 catalog now requires workflow `name:` and job `name:` to be
kebab-case (or omitted, so the job id is the check). Templates, this repo's
check-workflows workflow, and the release-management publish template match that
rule. `lockdown-repo.sh --required-checks` rejects names with spaces.
