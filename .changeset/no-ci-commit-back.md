---
"agentic": minor
---

Forbid CI commit-back except jobs whose purpose is mutating the repo

The defense-in-depth § 4 catalog now requires that GitHub Actions not take `contents: write`
unless mutating the repo is the job (GitHub Release, Changesets version PR). Generated output
is a workflow artifact, never committed back, so a compromised action in that job cannot push
`main`. npm stage-publish is unchanged (§ 5); `id-token: write` is OIDC, not repo write.
