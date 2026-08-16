---
"agentic": patch
---

`lockdown-repo.sh` keeps only high/critical Dependabot alerts open: after enabling alerts it dismisses open low/medium ones (GitHub has no API for auto-triage severity rules). `--check` fails when low/medium alerts are still open. The defense-in-depth catalog adds a short manual item for the UI Dependabot rule that auto-dismisses low + medium.
