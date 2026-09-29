---
name: test-audit
description: Decide whether a test earns its place. The authoring gate — four questions and a junk-pattern check — runs on every new or changed test before the pull request that carries it is opened or updated; the audit sweeps existing tests for ones that assert nothing, restate the implementation, prove only a mock, duplicate stronger proof, or keep test-only production code alive, and removes them one evidence-backed PR at a time. Invoke whenever writing, changing, reviewing, or sweeping tests, including before opening or updating a pull request that touches a test. Use when asked to audit, prune, or clean up a test suite, find low-value, redundant, or implementation-coupled tests, or judge whether a test is worth keeping.
user-invocable: true
---

# Test Audit

Operation manual for **deciding whether a test earns its place**. One value bar, two modes: the **authoring gate** checks every new or changed test before it lands, and the **audit** sweeps existing tests and removes the ones that protect nothing, one coherent pull request at a time. Optimize for confidence, not deletion count.

> **When this document is loaded, begin executing immediately.** Pick the mode from the situation:
>
> - **Authoring gate** — you are writing or changing tests, reviewing a change that does, or about to open or update a pull request that adds or changes a test. Run [the gate](#authoring-gate) on exactly those tests. In your own change, fix or drop what fails and carry on with the task — no stop; in someone else's, report each failure as a review finding.
> - **Audit** — the user asked to audit, prune, or clean up tests. Start at [Audit workflow](#audit-workflow) Step 1. Discovery is read-only; nothing is edited until the user approves the batch.
>
> **Persona.** Act as a **maintainer who keeps every test green through every refactor and pays for each one on every CI run.** A test is a standing cost; it earns its keep only by failing on a regression that would otherwise ship.
>
> **Scope bound.** The gate covers only the tests the current change adds or edits. An audit covers one owner boundary — a module, package, or feature path — per pull request. Never widen a feature PR into an audit; a broad audit continues as separate follow-up PRs.
>
> **Effort.** The gate runs at any effort level. The audit needs `high` or above — below it, the evidence pass skips callers and history, and tests that guard a real contract get deleted.

## Scope

**In scope:** the gate on new and changed tests; audits of existing tests against the [junk patterns](#junk-patterns); deleting, repairing, or consolidating the tests that fail, together with the test-only production seams and dead code they keep alive.

**Out of scope:**

- **Finding what to test.** Designing tests for untested failure modes is the `test` skill's job; the tests it designs still pass this gate.
- **Fixing product bugs.** A retained test that fails on the baseline is a possible product bug. Reproduce it and report it; never delete or loosen the test to get green.
- **Flaky tests.** Root-causing nondeterminism belongs to the `debug` skill.
- **Coverage percentages.** A threshold is not a contract; the gate's coverage rule says how to meet one.

## Authoring gate

Before a new or changed test lands, answer four questions. A missing answer means it does not land yet.

1. **What does it protect?** Name the observable behavior, invariant, or independent contract.
2. **What credible regression makes it fail?**
3. **Why doesn't existing coverage already catch that failure?** Each contract has one primary test at its strongest boundary. A test at another layer needs a distinct risk, such as a transport or lifecycle failure the primary test cannot reach. Prefer a new row in an existing table-driven test or shared fixture over a near-duplicate test, and consolidate duplicated setup in the same change.
4. **Does it need a production seam no production caller needs** — an export, flag, wrapper, or injection hook? Then move the test to the real boundary instead.

Then check the test against every [junk pattern](#junk-patterns). A match fails the gate unless the [retention bar](#retention-bar) names the contract the test independently guards. A test that would break under a behavior-preserving refactor asserts implementation, not behavior: rewrite it at the owning boundary before it lands.

- **Regression tests** must fail on the pre-fix code for the intended reason and pass after the fix — run each against the pre-fix code and watch it fail. A regression test that never failed proves the mock, not the fix. One regression at the owner boundary covers the bug; do not replay the scenario at every layer it crosses.
- **Coverage targets** never lower the gate. Reach an uncovered line through its public entry point with a test that answers all four questions. A branch no caller can reach is dead code to remove, not a line to probe.
- **Record the gate** in the PR body's Verification list: one line for the tests that passed, plus one line per test dropped or rewritten, naming the question or pattern it failed.

## Junk patterns

The shared checklist: the gate rejects a new test that matches one, and the audit hunts existing tests that do. Judge a test by its assertions, not its name.

- **Asserts nothing, or less than it claims**
  - assertion-free coverage probes: `it('runs', () => fn())`, constructor-doesn't-throw and import-is-defined smoke tests;
  - assertions loose enough to pass on wrong output, such as `toBeTruthy()` or a bare `toBeDefined()`;
  - restatements of what the type checker already enforces, such as `expect(typeof x).toBe('string')` on a typed return;
  - getters, setters, and pass-throughs with nothing to break;
  - snapshots with no behavioral assertion, re-approved on every change;
  - names or fixtures that promise more than the input exercises, such as an "expires the entry" test that never checks the entry is gone;
  - tests left skipped (`it.skip`, `xit`), which read as coverage they do not provide.
- **Restates the implementation**
  - exact source, import, or string greps;
  - copied fixtures, inventories, manifests, or export lists;
  - expected values computed by the code under test or a copy of its logic (`expect(add(2, 3)).toBe(2 + 3)`), self-comparisons, and identity copiers;
  - private-predicate and call-shape tests (`toHaveBeenCalledWith` on a mock) that stand in for the observable outcome or duplicate a test at the real boundary;
  - tests that lock in known-wrong behavior (`// FIXME: passes because of #42`).
- **Proves the mock or fixture, not the code**
  - mocks that implement the asserted behavior or behave unlike the real dependency (synchronous where it is async, never failing), or one identical mock standing in for different APIs;
  - fixtures that supply the result, receipt, or callback ordering the code under test should produce, or persistence asserted against a store the path never writes;
  - capability tests that restate declared flags instead of exercising what the flag promises;
  - negative controls that pass for an unrelated reason, such as a rejection from a different guard or an error the production path never reaches;
  - shared mutable fixtures that make a result depend on test order.
- **Duplicates stronger proof**
  - duplicate invocations of the same contract, such as `handles null`, `handles undefined`, and `handles empty string` for one empty-input rule;
  - per-implementation replays of a shared helper's tests.
- **Keeps test-only code alive**
  - tests whose only purpose is preserving test-only exports, globals, or wrappers;
  - dead production code whose only callers are tests.

## Retention bar

Keep a test when it independently enforces a public API, protocol or wire format, config, migration, storage, security, platform, default value, package export, release, or architecture contract. Also keep:

- call ordering, when order is observable behavior;
- a regression with a credible failure mode;
- source inspection when it is the cheapest independent guard — it fails when the contract changes (the user-facing key, byte, or path) and survives an identifier-only refactor;
- a test that fails on the baseline — a possible product bug, per [Scope](#scope).

Static or slow is not a reason to delete. In an audit, an existing test that must change for a behavior-preserving reorganization is suspect, not automatically deletable: a test that resembles implementation may still be the independent contract, so prove otherwise before removing it.

## Audit workflow

Run on the first invocation and again for each follow-up batch.

1. **Fix the target and read the rules.** Pick one owner boundary — a module, package, or feature path. Read the root and scoped `AGENTS.md` and `CLAUDE.md`, the test config, and the CI workflow that runs these tests.
2. **Sweep every test in scope.** Read each in full, including parameter tables, and record every test that matches a junk pattern, with the pattern it matched. Record; do not judge or rank yet. For a broad target, split the sweep into lanes along production owner boundaries plus one cross-cutting pattern lane, and run the lanes as parallel read-only subagents when available.
3. **Gather evidence per candidate.** Read the production owner, its entry point, callers, callees, sibling implementations, overlapping tests, CI routing, and `git log` history; when the test claims dependency-backed behavior, read the dependency's source or types. Record every field — a candidate missing one is not ready:
   - test name and location;
   - the failure it can actually detect;
   - non-test callers of the production or support seam it covers;
   - the stronger owner-boundary test that remains (the **keeper**), or why no proof is needed;
   - why the test or seam exists, from history;
   - the production or test-support code its removal unlocks;
   - risk, and the focused command that validates the change.
4. **Mark each candidate, then pick the batch.** One mark per test; an `it.each` gets one mark unless its rows need different ones.
   - `R` retain — the retention bar names its contract; a false positive.
   - `F` fix — the contract is real, but the assertion is vacuous, loose, or proves the mock.
   - `C` consolidate — fold it into its keeper: a sibling table row or a stronger boundary suite.
   - `D` delete — name the keeper, or why no contract exists.

   Pick **one coherent owner-boundary batch** of `F`, `C`, and `D` candidates with complete evidence. The rest become named follow-ups; never pad the batch with uncertain candidates to raise the count.
5. **Report and stop.** Render per [Audit report](#audit-report) and wait. Edit, commit, push, or open a PR only after the user approves the batch.
6. **Apply the marks.** `D`: delete the test and the test-only exports, globals, wrappers, and dead production paths it kept alive — no aliases left behind. `C`: move the assertion into its keeper, collapsing repeated package or dependency assertions into one table-driven contract. `F`: repair the assertion so it fails on the regression it names. Move retained regressions to their canonical owner. Add no replacement test that restates the same implementation, and prefer a net-negative production diff.
7. **Validate.** Run the owner and sibling tests with the repo's narrowest test command, then the full check CI runs (`pnpm test`, `cargo test`, …). For each contract now proved only by its keeper, mutate the production owner once, confirm the keeper fails, and restore the file exactly. For a removed assertion on source text or generated output, run the script, build, or dry-run that owns the real contract. Run the formatter on changed files and `git diff --check`, and split `git diff --numstat` into production and tooling lines versus test and test-support lines. Then run the `code-review` skill on the diff and resolve its findings.
8. **Ship one PR, then continue.** Open it per `pr-conventions` with the report in the body, drive CI to green, and post the PR URL. After it merges, refresh from `main` and rerun Steps 2–5 for the next batch.

## Audit report

One chat message, one line per entry. The Diff and Proof lines are filled in after Step 7.

```md
# Test audit — <owner boundary>

**Root cause:** <why these tests accumulated>
**Diff:** production −<a>/+<b> · tests −<c>/+<d>

## This batch (D <n> · C <n> · F <n>)
- `<mark>` `<file>` › `<test name>` — <junk pattern>; keeper: `<test>`; unlocks: <seam or code removed>
## Retained false positives (<n>)
- `R` `<file>` › `<test name>` — guards <contract>
## Possible product bugs (<n>)
- `<file>` › `<test name>` — fails on baseline: <symptom>
## Proof
- `<command>` — <result>
## Follow-ups
- <next owner boundary> — <n> candidates
```

---

Adapted from openclaw's [`test-audit` skill](https://github.com/openclaw/openclaw/blob/main/.agents/skills/test-audit/SKILL.md) (MIT License, Copyright (c) 2026 OpenClaw Foundation).
