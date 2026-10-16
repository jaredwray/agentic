---
"agentic": minor
---

Remove the unused `release-management-nodejs` skill

Staged npm publishing already lives in `defense-in-depth-nodejs`. The separate release-management
manual is unused, so the skill is gone. Publish-pipeline setup now points at
`defense-in-depth-nodejs`, and status tracking no longer keeps a Release Management block.
