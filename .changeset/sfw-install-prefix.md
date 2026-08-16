---
"agentic": minor
---

Require `sfw` on `pnpm install` / `npm install` in defense-in-depth CI

Socket Firewall Free is wrapper-mode only. The catalog no longer treats PATH shims as sufficient:
every `pnpm install` and `npm install` in GitHub Actions is written `sfw pnpm install` /
`sfw npm install` (including `--global`). Release-management's publish template, install policy,
and verification grep match that command. Local defense-in-depth verification uses
`sfw pnpm install --frozen-lockfile`.
