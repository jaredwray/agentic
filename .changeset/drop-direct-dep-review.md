---
"agentic": patch
---

Drop the new-direct-dependency review catalog item from defense-in-depth

Human review of new packages and preferring `~` over `^` are process notes, not
an enforceable control. Socket already reviews every dependency-changing PR,
and new packages already land through pull requests. The § 3 catalog keeps the
pnpm cooldown, lifecycle-script block, lockfile, and Dependabot rules.
