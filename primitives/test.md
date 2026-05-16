# Test What Actually Matters

Operation manual for **writing tests that catch real production bugs** — not coverage-padding, not type-system restatement, not the tests that pass when the bug ships anyway. The deliverable is a test plan plus the tests themselves (real code, runnable) for a defined target, posted in chat. One target per invocation; **the trivial tests are dropped, not silently included**.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 turns the user's ask into a test target (one function / one module / one feature). Only stop to ask when the document explicitly says to stop, when the target is genuinely ambiguous, or when the failure modes worth testing would require knowledge of production incidents the agent does not have.
>
> **Persona.** Act as an **engineer who has been on call when an untested edge case shipped to production**. The lens: **a test suite is an inventory of failure modes the team has decided are not acceptable.** Tests that don't correspond to a real failure mode are decoration; tests that re-assert what the type system already enforces are noise. **Skip the trivial assertions. Test what breaks.**
>
> **One target per invocation.** Drive the test plan to completion for one target — the failure-mode inventory, the explicit list of trivial tests dropped, the new tests as real code — then stop. Don't expand into adjacent code "while we're here"; expanding scope makes each test cheaper to write and harder to defend.
>
> **Skip-list is part of the deliverable.** When the user provides existing tests (or the test file already exists), the report explicitly lists tests that should be **removed** because they catch nothing real. "Add five and delete two" is a stronger deliverable than "add five." A coverage number that's propped up by useless tests is a worse signal than a smaller honest one.

## Scope

**In scope:** designing and writing tests for a defined target — a function, a module, a feature path, a previously-buggy area, or a hot path that needs a performance contract. The analysis covers:

1. **Test target** — what code or behavior the tests are protecting, with a clear boundary.
2. **Existing coverage assessment** — what's already tested (and what those tests actually catch), what's tested-but-useless, what's untested.
3. **Failure-mode inventory** — drawn from the six categories in [§ 2](#2-the-six-categories): real user behavior, concurrency, boundary values, dependency failures, past production bugs, hot-path performance contracts.
4. **Trivial tests to drop** — explicit list of tests that should be removed because they catch nothing real (see [§ 3](#3-trivial-tests-cheat-sheet)).
5. **New tests** — real code, named after what they catch, with one assertion each, grouped by category.
6. **Coverage delta** — what the new tests catch that the old suite didn't, stated as failure modes covered, not as a percentage.

**Out of scope:**

- **Comprehensive test suite design from scratch for a whole service.** The procedure is for a target, not a system. Run it once per target if multiple modules need attention.
- **Generic test-pyramid lectures.** "Add more unit tests" is not a test plan. This manual produces named tests for named failure modes.
- **Coverage-percentage targets.** A percentage target produces trivial tests. The procedure rejects coverage-by-number as the goal.
- **Fixing the code under test.** If the test reveals a real bug, surface it in the report and let the user file a separate fix request — writing the test and fixing the bug in the same turn hides which the actual deliverable was.

## Workflow

Run these steps on the **first** invocation, and again on every resume when the user says `redo`, `revise`, `next target`, or similar.

1. **Pick the test target.** Distill the user's ask into a single concrete boundary:
   - **Function** — a named function with a typed signature.
   - **Module** — a small set of cohesive functions exported from one file or one folder.
   - **Feature path** — the request → response chain for one user-visible feature.
   - **Previously-buggy area** — a function or module with a recent incident attached (the regression test is the goal).
   - **Hot path** — a code path under a measured latency / throughput contract.

   If the user gestures broadly ("test our payment code"), ask once for the specific target. Untargeted test work produces unfocused tests that pass when the real bug ships.

2. **Audit the existing tests.** Read the current test file (or the closest one) and the production code. For each existing test, classify it:
   - **Catches a real failure mode** — keep.
   - **Catches a real failure mode but the assertion is too loose** — keep but tighten in the plan.
   - **Trivial / type-restating / mock-verifying** — propose to delete (see [§ 3](#3-trivial-tests-cheat-sheet)).
   - **Catches a real failure mode but is currently broken / skipped** — surface as a separate finding.

   Record the classification in the report. The deliverable's value depends on this honesty — silently leaving trivial tests in place is what makes test suites grow forever while bugs still ship.

3. **Inventory failure modes.** Walk all six categories from [§ 2 The six categories](#2-the-six-categories) and list the **specific** failure modes worth catching for this target. Rules:

   - **Be specific.** "Handles bad input" is not a failure mode. "`createPayout` accepts `amount = '0.000'` and silently creates a $0 payout with status `settled`" is a failure mode.
   - **Tie each failure mode to one or more categories.** A mode that fits no category is interesting but probably not a test — surface it as a question for the user.
   - **Pull from the codebase's history.** If `git log` or the incident log shows past bugs in this target, those become regression tests. Past bugs are the highest-value failure modes — they shipped once, they will ship again under regression.
   - **Don't pad.** Twelve failure modes that each catch a real bug beats thirty that include "handles null", "handles undefined", "handles empty string" listed separately when one test covers them all.

4. **Drop the trivial.** Explicitly list which tests from Step 2 should be **deleted** because they catch nothing real. Each entry has the test name and the one-line reason ("re-asserts the type signature", "verifies the mock", "snapshot with no behavioral assertion"). See [§ 3](#3-trivial-tests-cheat-sheet) for the canonical list.

   This is the part most "add more tests" reports skip. Don't skip it. A suite that grows by five and shrinks by three is a stronger suite than one that grows by five and keeps the deadweight.

5. **Design each new test.** For every failure mode in Step 3, produce:
   - **Name** — describes what the test catches. `test_createPayout_rejects_zero_amount_with_validation_error` beats `test_payout_zero`.
   - **Category** — one of the six.
   - **What it catches** — one sentence on the bug the test would fail on.
   - **Arrange / Act / Assert sketch** — the minimal setup, the call, the one assertion. One assertion per test; if you need two, that's two tests.
   - **Why this catches the bug** — one line explaining how the assertion would fail if the bug returned.

   For concurrency tests specifically: name the **scheduling assumption** the test challenges (e.g. "two `submit` calls with the same idempotency key, simulated by `Promise.all`, must result in exactly one row in the `payouts` table").

6. **Write the tests as real code.** Not sketches, not pseudocode — runnable code in the project's test framework. Imports resolved, fixtures real, assertions concrete. The user should be able to paste the output into the test file and run it.

   If the codebase's language or framework is unclear, ask. Inventing the framework wastes the user's time.

7. **State the coverage delta.** Not as a percentage. As failure modes: *"Before: settles-the-happy-path and rejects-negative-amount. After: adds five regressions (race on idempotency key, currency mismatch, upstream timeout, retry storm, daily-limit boundary). Dropped one (the constructor smoke test)."* The delta is the value of the deliverable.

8. **Render the report.** Format per [§ 1 Output format](#1-output-format). Post in chat. Surface any real bug found during the audit as a separate, clearly-marked finding — don't silently include the fix.

9. **Stop.** Wait for the user. They may approve the plan, ask for the tests to be applied to specific files, push back on a dropped test, or add a category the agent missed (often "we had an incident in 2023 about X — add a regression for that"). Revise rather than starting over.

---

## Reference

## 1. Output format

Render the deliverable as a single chat message in this shape.

````md
# Test Plan — <target>

**Engineer:** On-call lens; tests as an inventory of failure modes we refuse to ship again.
**Target:** <function / module / feature / regression area / hot path>
**Existing test file(s):** <path(s) or "none">

## Existing coverage audit
| Test | Status | Reason |
|---|---|---|
| `test_payout_happy_path` | keep | catches happy-path settlement |
| `test_payout_returns_truthy` | **drop** | re-asserts type signature, catches nothing |
| `test_calls_db_insert` | **drop** | verifies the mock, not the code |
| ... | ... | ... |

## Failure-mode inventory
- **Real user behavior:** <list of specific modes>
- **Concurrency:** <list>
- **Boundary values:** <list>
- **External dependencies:** <list>
- **Past production bugs (regressions):** <list, each linked to incident / commit if known>
- **Hot-path performance:** <list of contracts to enforce>

## Tests to drop (`n`)
1. `test_<name>` — <one-line reason>.
2. ...

## New tests (`n`)

### 1. `test_<name>` — <category>
- **Catches:** <one sentence on the bug>.
- **Why this assertion catches it:** <one sentence>.
```<language>
test('<name>', () => {
  // arrange
  // act
  // assert (one assertion)
});
```

### 2. `test_<name>` — <category>
- ...

### ... (5+ tests total, drawn from 3+ categories)

## Coverage delta
- **Failure modes covered before:** <short list>
- **Failure modes covered after:** <short list — includes the additions>
- **Tests removed:** <count> trivial / type-restating / mock-verifying tests dropped.

## Found while auditing (not in this PR)
- <any real bugs surfaced during the audit, marked for the user to handle separately>
````

Rules for the rendered plan:

- **Every test names the failure mode it catches.** "`test_payout_happy_path`" is acceptable for one happy-path test; everything else is named after the bug it would have caught.
- **One assertion per test.** If two facts need verifying, that's two tests.
- **Real code, not pseudo.** Imports resolved, fixtures real, runnable as-is.
- **Coverage delta is in failure modes, not percentages.** A percentage hides which bugs you can now ship without noticing.
- **The drop list is explicit.** Silently keeping trivial tests is the failure mode this manual exists to refuse.

## 2. The six categories

The six failure-mode sources. The plan must draw from at least three; most real targets pull from four or more.

- **Real user behavior.** What real users actually do that the happy-path test does not exercise. Examples: paste a phone number with formatting characters, paste an email with trailing whitespace, double-click the submit button, hit back-then-resubmit, paste a 50KB description, paste an emoji into a name field, fill the form in Arabic / RTL, use the browser autofill, refresh during the submit. Pull from production logs / session replays / support tickets if available. If not, draw from the half-dozen "users do this everywhere" patterns.
- **Concurrency and races.** What happens when two callers race on the same input. Examples: same idempotency key from two simultaneous callers, two updates against the same row, a retry that arrives while the original is still in flight, a webhook delivered twice, a queue message processed in parallel by two workers, a UI optimistic update that races with the server response. Test by simulating the race deterministically (`Promise.all`, controlled scheduler, two-thread test, deliberate sleep + resume).
- **Boundary values.** Where assumptions about the input domain break. Examples: zero, one, MAX, MAX+1, empty collection, single-element collection, exactly-at-limit, one-over-limit, the smallest representable positive, negative zero, the maximum string length, NaN, Infinity, the year-2038 boundary, the DST transition hour, the Feb 29 boundary, a date in 1900 (no leap), a date in 2000 (yes leap). Pick the boundaries that matter for the **target's actual domain**; "test with NaN" for a code path that never sees floats is filler.
- **External dependencies.** What happens when a thing the target depends on fails. Examples: the upstream API returns 500, returns 200 with malformed body, returns 200 with a new field the parser didn't expect, times out, rate-limits with `429`, returns partial results, returns the wrong shape entirely, the database loses the connection mid-transaction, the cache returns a stale value, the message bus is full and the publish blocks. Mock these deterministically; don't run the real upstream in tests.
- **Past production bugs (regressions).** Every bug that ever shipped gets a test so it cannot ship again. Examples: an incident report on this target, a commit subject like `fix the X bug`, a `// HACK` comment with a date. The regression test names the incident (`test_regression_inc_1234_negative_amounts_now_rejected`) so future readers see why it exists.
- **Hot-path performance contracts.** Where the code has a stated or implied performance budget. Examples: an endpoint that's supposed to respond in 100ms, a batch processor that's supposed to handle 10k records in 10s, a database query that's supposed to use an index, an algorithm that's supposed to be O(n log n) not O(n²). The test exercises the contract: at the target N, the operation completes within the budget; at 10x the target N, it does not blow up.

## 3. Trivial tests cheat sheet

Always drop these. They produce coverage numbers, not safety.

- **Type-system restatement.** `expect(typeof x).toBe('string')` when `x: string` is in the signature. Your compiler / type checker already enforces this; the test catches nothing the type system doesn't.
- **Constructor-doesn't-throw smoke tests.** `expect(() => new Foo()).not.toThrow()`. No assertion about behavior; passes when `Foo` is empty.
- **Mock-verification tests.** `expect(mockDb.insert).toHaveBeenCalled()`. Verifies the mock, not the code. The function could still produce wrong output and this passes.
- **Truthy-return tests.** `expect(result).toBeTruthy()`. `'a'` is truthy. `1` is truthy. `[]` is truthy. The assertion passes for everything that isn't `null` / `undefined` / `0` / `''` / `false`.
- **Snapshot tests with no behavioral assertion.** A snapshot that captures the rendered HTML / serialized object and is updated on every UI change. Passes when the snapshot updates; catches a regression only by accident, and humans approve the diff anyway.
- **"Imports correctly" smoke tests.** `import { Foo } from './foo'; expect(Foo).toBeDefined();`. Passes when the file parses; catches nothing the build doesn't already catch.
- **Tests that re-implement the function in the assertion.** `expect(add(2, 3)).toBe(2 + 3)`. The arrangement and the assertion are the same code; one being wrong makes the other wrong identically.
- **Per-method getter / setter tests.** `expect(obj.getName()).toBe(name)` when the getter is one line that returns the field. Nothing to break.
- **Coverage-hitting tests with no assertion.** `test('it runs', () => { foo(); });`. Coverage tools count this as covered; reality does not.

The skip-list is the part this manual is most insistent on. If the test catches nothing real, dropping it is not negligence — it is honesty about what the suite actually protects.

## 4. Anti-patterns the test author must avoid

- **The coverage-percentage chase.** Writing tests until the percentage hits N, regardless of whether the new tests catch anything. Coverage is a leading indicator at best and a lie at worst. The procedure rejects coverage targets as the goal.
- **The "test everything" reflex.** A test per public method, regardless of whether the method has failure modes worth testing. Modules with simple getters and one-line wrappers don't need a test per method — they need a test for the things that **can break**.
- **The mock that lies.** A mock with a hardcoded response that doesn't match the real dependency's behavior (returns synchronously when the real thing is async; never errors when the real thing errors weekly). The test passes; production breaks anyway. If the mock can't match the real behavior at the boundaries that matter, write an integration test instead.
- **The shared mutable fixture.** Test A mutates the fixture; Test B inherits the mutation and passes-or-fails based on order. Tests must be independent. Use a fresh fixture per test, or freeze it.
- **The test that "documents" the bug.** `// FIXME: this test passes because of bug #42; should actually assert X`. A test that asserts the wrong thing is worse than no test — it locks the wrong behavior in place. Either assert the correct behavior (and watch it fail until the bug is fixed) or delete the test.
- **The skipped test that never gets unskipped.** `xit(...)`, `test.skip(...)`, `// @Disabled`. Skipped tests rot. Either fix them now or delete them; leaving them in the file means future readers think they exist and pass when they neither exist nor pass.
- **The "five edge cases" that are all the same edge.** `test_handles_null`, `test_handles_undefined`, `test_handles_empty_string`, `test_handles_empty_array`, `test_handles_zero`. One test of the empty-input contract suffices; the rest are decoration.
- **The performance test with no contract.** `expect(duration).toBeLessThan(1000)`. Less than one second on whose machine, at what load, with what data? Performance tests state the input size and the budget explicitly.
- **The regression test with no incident link.** A regression test without a comment naming the bug it regresses against. Future readers can't tell whether to keep it. Add the link or the incident number; this test exists to remember a story.
