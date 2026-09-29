---
"agentic": minor
---

Add the `test-audit` skill and gate the tests in every agent pull request with it

`test-audit` (engineering, model-invoked) adapts openclaw's skill of the same name: a four-question
authoring gate that every new or changed test passes before its pull request is opened or updated,
one list of junk patterns, the retention bar, and an evidence-first audit that removes low-value
tests one owner-boundary PR at a time. The `test` skill now takes its drop list from `test-audit`
instead of keeping its own. The defense-in-depth `AGENTS.md` template gains a "Test audit" section
that carries the gate itself, so agents without the plugin follow it too, and states that coverage
targets never lower it. The Safe Chain item reconciles as done only when every template section is
present, and `agentic-upstream-sync` appends the new section on a repo's next dependency-management
run.
