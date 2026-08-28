---
"agentic": patch
---

Fix Codespaces Safe Chain bootstrap for Corepack EACCES and nvm.sh exit 3

`setup-cloud-environment.sh` enables Corepack only when `pnpm` is missing, writing
shims to `~/.local/bin`, and runs the installer with `NVM_DIR` unset so Codespaces'
`nvm.sh` exit 3 cannot abort `postCreateCommand`. The Dev Container command stays
`bash ./scripts/setup-cloud-environment.sh`.
