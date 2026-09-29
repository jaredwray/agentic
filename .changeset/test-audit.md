---
"agentic": minor
---

Add the `test-audit` skill and gate the tests in every agent pull request with it

`test-audit` (engineering, model-invoked) adapts openclaw's skill of the same name: a four-question
authoring gate that every test a pull request adds, changes, or deletes passes before the PR is
opened or updated, one list of junk patterns, the retention bar, and an evidence-first audit that
records a baseline and removes low-value tests one owner-boundary PR at a time through the
`shipping-conventions` loop. The `test` skill now takes its drop list from `test-audit` instead of
keeping its own. The `AGENTS.md` template gains a "Test audit" section that carries the gate itself,
so agents without the plugin follow it too, and states that coverage targets never lower it.
`agentic-upstream-sync` now creates `AGENTS.md` (and the `CLAUDE.md` import) in repos that lack one,
applying the Safe Chain section only where `pnpm-lock.yaml` exists, so the policy sections reach
every repo, not just pnpm ones. The Safe Chain item reconciles as done only when every template
section is present.
