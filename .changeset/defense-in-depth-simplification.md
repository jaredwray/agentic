---
"agentic": minor
---

Simplify the defense-in-depth rollout: split tracking out of SECURITY.md, script the repo lockdown, and adopt staged OIDC publishing

**Two files instead of one.** `SECURITY.md` goes back to being simple and public-facing — contact
info plus a "How this repository is secured" summary that only lists measures actually live. The
working checklist moves to a new `DEFENSE_IN_DEPTH.md`; `security-status-tracking` now documents
that home (with a migration rule for repos carrying the old status blocks), and
`release-management-nodejs`'s status block moves there too.

**The catalog shrinks to six sections.** Public Transparency (§ 9), Incident Response (§ 10), and
the `Manual / external (maintainer-owned)` block are gone. Items only a human can perform now carry
an inline `(manual)` marker in catalog order. The skill also classifies the repo first — npm
library vs website/app (websites skip npm publishing entirely) and public vs private (private repos
skip public-only items and plan-gated settings degrade gracefully).

**Repository lockdown becomes a script.** `defense-in-depth-nodejs` now bundles
`scripts/lockdown-repo.sh`: a gh-authed admin one-shot that requires PRs on the default branch
(force pushes and deletion blocked), restricts tag creation to repository admins via a ruleset,
requires approval for every outside collaborator's workflow run, sets workflow tokens read-only and
blocks Actions from creating/approving PRs, and enables secret scanning, push protection, private
vulnerability reporting, and Dependabot alerts. `--check` mode audits without changing anything and
powers reconciliation.

**Publishing policy: staged, reviewed, never direct.** npm libraries publish via OIDC trusted
publishing (no tokens anywhere) with `npm stage publish`; [Drydock](https://drydock.org) reviews
the exact staged artifact, and a maintainer promotes with 2FA. Package settings require 2FA and
disallow tokens, so there are no direct publish rights.

**CI hardening gets concrete tools.** Actions are pinned to full commit SHAs with
[actions-up](https://github.com/azat-io/actions-up), and every repo gets
`.github/workflows/check-workflows.yaml` running [zizmor](https://docs.zizmor.sh) — this repo now
dogfoods that workflow. The pnpm 7-day cooldown (`minimumReleaseAge: 10080`) stays the anchor
dependency control. deepsec, SBOM generation, and the monitoring items are dropped from the
required stack; the tooling layer is [Aikido](https://www.aikido.dev) (build scanning: SCA,
secrets, SAST) plus [Socket](https://socket.dev) (dependency-diff supply-chain linting on PRs),
both already installed as GitHub apps. Aikido also gates releases: the publish workflow template
gains an `aikido-gate` job (`aikido-api-client scan-release` failing on new findings) that must
pass before CI may stage a version.
