---
"agentic": minor
---

Add check-npmjs.sh to audit defense-in-depth npmjs publishing settings

`defense-in-depth-nodejs` now bundles `scripts/check-npmjs.sh`: a check-only
audit of the npmjs.com settings in catalog § 5. It confirms the trusted
publisher is GitHub Actions bound to this repo and the stage-publish workflow,
with stage-only permissions (`createStagedPackage`, never live `createPackage`).
Legacy configs with no permissions field fail. Packument `repository.url` must
map to the same GitHub repo. Publishing access (2FA + disallow tokens) is
checked when the registry exposes those fields; `GET /-/package/{pkg}/access`
is not allowed on registry.npmjs.org, so that item is skipped with the npmjs.com
URL rather than treated as passing.

Auth is an `npm login` session only — `NPM_TOKEN` is rejected. Never copy it
into a target repo. It never applies settings — trusted-publisher writes need
interactive 2FA. Audit during the § 5 pass; Drydock and human 2FA promotion
stay `(manual)`.
