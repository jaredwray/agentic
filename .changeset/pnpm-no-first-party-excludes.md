---
"agentic": patch
---

Forbid first-party excludes on the pnpm-workspace security baseline

`minimumReleaseAgeExclude` and `trustPolicyExclude` must not list packages this GitHub owner
publishes — own releases wait the 7-day cooldown too. A hijacked maintainer account shipping a
malicious version of *our* package is what the window is for. Defense-in-depth drops matching
entries when applying the cooldown item; dependency upgrades must not add an exclude to reach a
too-new version.
