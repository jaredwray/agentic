---
"agentic": patch
---

Fix Codespaces Safe Chain bootstrap for Corepack EACCES and nvm.sh exit 3

`setup-cloud-environment.sh` now sources nvm with `--no-use` and errexit off, and
enables Corepack into `~/.local/bin` (sudo fallback) so a fresh Codespace
`postCreateCommand` cannot die on root-owned `/usr/local/bin` or an unmet `.nvmrc`.
The Dev Container config stays `bash ./scripts/setup-cloud-environment.sh`.
