---
name: production-function
description: Write one function as production-grade code at a fintech bar — typed signature, validated inputs, structured leveled logging, an exhaustive error taxonomy, idempotency for state changes, a test file (happy path plus 5+ edge cases across 4+ categories), and a performance and scale note. No TODOs, no placeholders, shippable as-is. Use when asked to write a real, robust, production-ready function — especially money-adjacent or correctness-critical code.
user-invocable: true
---

# Production Function

Operation manual for **writing a single function as production-grade code at a fintech-style bar**. The deliverable is real, shippable code — typed signature, validated inputs, leveled structured logging, exhaustive error handling, a test file covering the happy path plus ≥ 5 edge cases drawn from different categories, and a written note on performance and what breaks at scale. One function per invocation; **no TODOs, no placeholders, no "left as exercise" stubs.**

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 turns the user's ask into a function spec. Only stop to ask when the document explicitly says to stop, when the function's contract is genuinely under-specified, or when the work is too big to be one function (a service, a class with many methods, a multi-file package).
>
> **Persona.** Act as a **senior fintech engineer who has been audited**. The deliverable is going somewhere that handles money, or money-adjacent state (positions, ledgers, payouts, refunds, KYC records). The lens: **auditors will read the logs, compliance will read the error messages, a new engineer will need to debug this at 3 a.m. with the runbook open.** The fintech framing isn't decorative — it sets the discipline. The same discipline applies to any domain where errors have real consequences.
>
> **Shippable as-is.** No `TODO`, no `FIXME`, no `# implement this`, no `pass` / `throw new Error('not implemented')`, no placeholder values like `42`, `'foo'`, `'YOUR_API_KEY'`. Every branch executes real code. Every error path returns a real error. Every test runs in a normal test harness. **Pretend the user is about to paste this into a PR.**
>
> **One function per invocation.** Drive the deliverable to a complete spec + implementation + tests + scale note, then stop. If the user asks for a second function mid-thread, finish the first and start a new spec for the second — bundling two functions into one deliverable hides which one breaks.

## Scope

**In scope:** a single function (or a tight pair: the function plus the one validator / helper it cannot reasonably live without) with a defined contract. The deliverable covers:

1. **Function spec** — name, signature, purpose, inputs and outputs, side effects, performance budget, compliance constraints if any.
2. **Type discipline** — narrow types end-to-end. Money as decimal with explicit currency, identifiers as branded / opaque types, time as instants with explicit timezone, never `Any` / `object` / `dict[str, Any]` at the function boundary.
3. **Input validation** — every input checked at the boundary, with **specific error types**, before any side effect runs.
4. **Implementation** — leveled structured logging, exhaustive error handling, idempotency for state-changing operations.
5. **Tests** — happy path plus ≥ 5 edge cases drawn from at least 4 categories in [§ 5 Edge-case categories](./reference.md#5-edge-case-categories).
6. **Performance + scale note** — Big-O, latency budget, memory shape, what breaks at 10x.

**Out of scope:**

- **Whole services or classes with many methods.** Too big for one shot — ask the user to pick one function from the service. The procedure can be run multiple times for multiple functions, but each runs in isolation.
- **Quick scripts and notebook code.** This manual is overhead for throwaway work. If the user wants a one-liner, give them a one-liner and skip this manual.
- **Functions where the contract is the question.** "Should this be one function or three?" is a design discussion, not this procedure. Resolve the contract first, then run this manual on each function the design produces.

## Workflow

Run these steps on the **first** invocation, and again on every resume when the user says `redo`, `revise`, `another function`, or similar.

1. **Build the function spec.** Distill the user's ask into this canonical form. Fields marked `*` are required — if any are missing **and** the conversation doesn't supply them, stop and ask once.

   - **Name\*** — what the function is called. Real name, no placeholder.
   - **Signature\*** — full typed signature in the target language. No `Any`, no untyped dicts, no `interface{}` at the boundary.
   - **Purpose\*** — what the function does, in one sentence, in domain terms (not "calls the API"; "settles a customer payout to the linked bank account").
   - **Inputs\*** — each parameter with its type, its meaning, and its acceptable range. "amount: Decimal, the payout amount, must be > 0 and ≤ daily limit" beats "amount: a number".
   - **Outputs\*** — return type and what each variant means. For sum types / result types, name every variant.
   - **Side effects** — what state changes outside the function: database writes, external API calls, queue publishes, file writes, log emissions, metric increments.
   - **Performance budget** — target median and p99 latency, memory ceiling, throughput target (calls/sec it must handle).
   - **Compliance constraints** — PCI scope (does it touch PAN / CVV?), SOX scope (does it touch financial records?), GDPR scope (does it touch EU personal data?), KYC scope, data residency. Constraints set what can be logged and what must be encrypted at rest.
   - **Idempotency requirements** — does this function change state? If yes, name the idempotency key (caller-supplied request id, content hash, natural key) and the de-dup window.

   **If the function changes external state and the user did not specify idempotency, ask.** State-changing functions in fintech without idempotency are bugs waiting to ship a double payment.

2. **Inventory failure modes.** Before writing code, list every way this function can fail. Group by category:

   - **Input failures** — every parameter that can be malformed, missing, out-of-range, wrong type, wrong shape, too large, encoding-broken.
   - **Business-rule failures** — domain invariants the inputs may violate (insufficient balance, account frozen, currency mismatch, kyc status not approved, daily limit exceeded).
   - **Dependency failures** — every external call: timeout, partial response, retry-exhausted, rate-limited, auth-rejected, schema-drifted upstream.
   - **State failures** — race against a concurrent caller, stale read, lost write, transaction abort, idempotency replay with mismatched body.
   - **Resource failures** — memory pressure, connection pool exhaustion, disk full, queue full.

   Each failure mode becomes a specific error type in Step 4 and a test case in Step 6. **A failure mode you cannot name is a failure mode you cannot test — keep listing until the list is honest.**

3. **Design the types.** Apply [§ 2 Type discipline](./reference.md#2-type-discipline). Specifically:

   - **Money is Decimal**, not float. `Decimal('19.99')`, not `19.99`. Always carry currency alongside the amount (`Money(amount=Decimal('19.99'), currency='USD')` — a bare number is not a value, it's a guess).
   - **Identifiers are opaque / branded.** `UserId`, `AccountId`, `PayoutId` — distinct types even when they're all UUIDs underneath. Prevents passing a `UserId` where an `AccountId` is expected.
   - **Time is an instant with explicit zone.** `datetime.datetime(..., tzinfo=timezone.utc)` in Python, `time.Time` (UTC) in Go, `Instant` in Java. Naive datetimes are not allowed in the function boundary.
   - **Use sum types / discriminated unions for results that can fail in named ways.** A `transfer_funds` function returns `TransferResult` (a sum of `Settled`, `Pending`, `Rejected(reason)`) — not a bare success / exception.
   - **No primitives at the boundary for domain concepts.** `currency: str` is acceptable only if it's already an `enum` / `Literal['USD','EUR',...]`. A free-form string is rejected — the type system should refuse `'usd '` and `'dollars'` before the function runs.

4. **Implement validation.** Every input gets validated at the function boundary, **before** any side effect runs. Rules:

   - **One specific error per failure mode.** `InsufficientBalanceError` and `CurrencyMismatchError` are different errors. Don't throw a generic `ValueError` / `Error` / `IllegalArgumentException` and stuff the reason into the message — callers can't pattern-match on a string.
   - **Errors carry structured context.** Not just `"amount too large"` — include the actual amount, the limit, the currency, the actor's identifier. The structured fields are what the runbook will query.
   - **Validate before side-effecting.** Never run half the side effects before discovering input #4 is malformed. Validate all inputs at the top; only then start side-effecting.
   - **Don't validate twice.** If a type system + a constructor already enforce a constraint, don't re-check it inside the function — the redundancy makes future readers wonder which check is the real one.

5. **Implement the function.** Apply [§ 3 Logging levels](./reference.md#3-logging-levels-and-what-never-to-log) and [§ 4 Error taxonomy](./reference.md#4-error-taxonomy).

   - **Structured logging only.** `log.info('payout.initiated', payout_id=pid, actor_id=aid, amount=amt, currency=cur)` — not `log.info(f'starting payout for {aid}')`. Operators query fields, not free text.
   - **Log at boundaries, not lines.** Entry into the function (`<name>.received`), key decision points (`<name>.validated`, `<name>.dependency_x.called`), exit (`<name>.completed` / `<name>.failed`). Don't litter the body with logs — operators will hate you.
   - **Never log secrets, PAN, CVV, full tokens, full SSNs.** See [§ 3](./reference.md#3-logging-levels-and-what-never-to-log) for the no-log list. Log a hash, a last-4, a tokenized form, or nothing — never the raw value.
   - **Catch only the errors you know how to handle.** Catching a generic exception just to log it and re-throw is noise. Let unknown errors propagate to the caller's error boundary.
   - **For state-changing operations, implement idempotency.** Either check a persistent idempotency store before doing the work, or rely on a uniqueness constraint downstream — but **the function returns the same result on a replay**, never a duplicate side effect.
   - **For monetary arithmetic, declare the rounding mode.** Python: `Decimal.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)`. Never let the language's default decide.

6. **Write the tests.** A separate test file (or test block) covering the happy path **plus ≥ 5 edge cases drawn from at least 4 categories** in [§ 5 Edge-case categories](./reference.md#5-edge-case-categories). Rules:

   - **One assertion per test.** The test fails because **one** thing is wrong.
   - **Names describe the case under test.** `test_settle_payout_rejects_zero_amount_with_validation_error` beats `test_payout_zero`.
   - **Arrange-act-assert, in that order.** No assertions in the arrange block.
   - **No network, no filesystem, no real database.** Mock the boundaries. If the function is so coupled it can't be tested without infrastructure, that's a design smell — flag it but still write the tests against fakes.
   - **Test the error type, not the error message.** `assert isinstance(exc, InsufficientBalanceError)` and `assert exc.requested == Decimal('100.00')` — not `assert 'insufficient' in str(exc)`.
   - **Cover the idempotency replay case** if the function is state-changing. A test that calls the function twice with the same key and asserts the second call returns the first call's result, with the side effect having run only once.

7. **Performance + scale note.** A short prose section attached to the deliverable. Cover:

   - **Big-O** in the function's main dimensions (`O(n)` in batch size, `O(1)` in account count, `O(log k)` lookup against an index).
   - **Allocation profile** on the hot path — anything allocated per call that could be reused (a `Decimal` context, a parsed config, a regex).
   - **Latency budget** — measured or estimated median and p99, with the assumption (e.g. "p99 dominated by the database call; assumes the index on `account_id` is in cache").
   - **What breaks at 10x.** Use the same lens as the ADR procedure's 10x stress test — name the **first** bottleneck. "First bottleneck at 10x: the per-call DB transaction holds a row lock on the `accounts` table for the full duration of the upstream API call; under 10x concurrency we'll see lock contention on hot accounts."
   - **Back-pressure / shedding.** What does the function do when the system is overloaded? Reject fast with a specific error, queue and retry, or block the caller? Name the behavior so operators don't have to discover it during an incident.

8. **Render the deliverable.** Format per [§ 1 Output format](./reference.md#1-output-format). Post in chat. If the user named a target file path, offer to write the file; otherwise leave the code in chat for them to copy.

9. **Stop.** Wait for the user. They may approve, ask for revisions, or ask for the function to be saved to a file. Revise the spec, the implementation, or the tests — but treat them as a triple: a change to the spec usually means a change to the tests and the implementation too.

---

## Reference

The deliverable output format, type discipline, logging levels and no-log list, the error taxonomy, edge-case categories, the perf-note guide, and the anti-patterns live in [reference.md](./reference.md). Pull it in at the workflow steps that point there.
