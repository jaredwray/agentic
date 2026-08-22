# defense-in-depth-nodejs catalog

Catalog versions as recorded in target repos (`Catalog: defense-in-depth-nodejs@<version>`).
Independent of the agentic plugin version.

## 1.0.0 — 2026-08-22

First versioned catalog. Sections 1–7: security docs, CODEOWNERS and Safe Chain cloud bootstrap,
pnpm baseline (7-day cooldown, `trustPolicy: no-downgrade`, blocked lifecycle scripts), GitHub
Actions (least privilege, no CI commit-back, SHA-pinned actions, Socket Firewall, zizmor), staged
OIDC npm publishing, Aikido + Socket, then `lockdown-repo.sh` last (immutable releases and
Dependabot disabled; private repos skip fork-PR approval and private vulnerability reporting).
