---
"agentic": minor
---

Turn off VS Code / Cursor automatic tasks in defense-in-depth

The § 2 catalog now tracks `task.allowAutomaticTasks` as `off` or `prompt` in User
settings (global, not workspace) so a `.vscode/tasks.json` `folderOpen` trigger in a
clone cannot silently execute. CODEOWNERS covers `/.vscode/` as the matching repo-side
review gate. Background: How Malware Abuses NPM Lifecycle Scripts and VS Code Tasks.
