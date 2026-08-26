---
"agentic": minor
---

Install GitHub CLI and Docker by default in the defense-in-depth Codespaces template

The greenfield `.devcontainer/devcontainer.json` now includes the official
`github-cli` and `docker-in-docker` Dev Container Features so `gh` and `docker`
are available without extra setup. Merge keeps an existing docker feature if
one is already present.
