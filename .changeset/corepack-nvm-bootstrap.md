---
"agentic": patch
---

Fix Codespaces Safe Chain bootstrap for Corepack EACCES and nvm.sh exit 3

`setup-cloud-environment.sh` enables Corepack `pnpm` only when missing, writing the
shim to `~/.safe-chain/bin`, and runs the installer from `/` so an in-repo `.nvmrc`
cannot abort `postCreateCommand`. The greenfield Dev Container uses docker-in-docker
with `moby: false` (required on Trixie) and keeps
`postCreateCommand` as `bash ./scripts/setup-cloud-environment.sh`.
