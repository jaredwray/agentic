---
"agentic": minor
---

Align release-management with staged Drydock publishing

`release-management-nodejs` § 16 still walked a maintainer through configuring a **live-publish**
trusted publisher — exactly the config `check-npmjs.sh` fails. It now requires the stage-only
publisher (staging permission only, set manually on npmjs.com) and verifies
`createStagedPackage`-only permissions. The
invariants, Mode A, trust table, and Phase 3 catalog now require staging + Drydock review + 2FA
promotion; § 15 names Drydock's Workflow Gate as the optional deployment protection rule (with
the required job split — pack/upload ungated, gated job verifies and stages the downloaded
files); § 20 adds the flagged-stage path (adjudicate; promote recorded-intended findings; reject
unexplained ones).

`defense-in-depth-nodejs` § 5 records the Drydock connection spec (granular npm token: Packages
read-only, Organizations no access) and qualifies the token invariant to npm *publish* tokens.
`dependency-management-node` PR bodies link each public npm bump's
`drydock.org/diff/<name>/<from>/<to>` artifact diff.
