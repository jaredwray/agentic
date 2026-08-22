---
"agentic": minor
---

Skip fork-PR workflow approval on private repos

`lockdown-repo.sh` no longer audits or sets fork-PR contributor approval on
private repositories. GitHub rejects that setting with HTTP 422 ("Fork PR
approval is not allowed for private repositories"), so `--check` and apply
skip it the same way they skip private vulnerability reporting. Public repos
still require `approval_policy=all_external_contributors`.
