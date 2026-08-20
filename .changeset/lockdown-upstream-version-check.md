---
"agentic": minor
---

Warn when lockdown-repo.sh is not the latest copy

`lockdown-repo.sh` now compares itself to `jaredwray/agentic@main` on start and
prints a warning if this copy is stale (marketplace cache or old clone). The
warning does not fail `--check` or apply.
