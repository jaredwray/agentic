---
"agentic": patch
---

Drop the VS Code automatic-tasks catalog item from defense-in-depth

`task.allowAutomaticTasks` is a User setting agents cannot verify from the repo, so
it does not belong in the tracked checklist. The § 2 catalog keeps CODEOWNERS covering
`/.vscode/` as the review gate for editor task files.
