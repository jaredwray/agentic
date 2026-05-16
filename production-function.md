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
5. **Tests** — happy path plus ≥ 5 edge cases drawn from at least 4 categories in [§ 5 Edge-case categories](#5-edge-case-categories).
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

3. **Design the types.** Apply [§ 2 Type discipline](#2-type-discipline). Specifically:

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

5. **Implement the function.** Apply [§ 3 Logging levels](#3-logging-levels-and-what-never-to-log) and [§ 4 Error taxonomy](#4-error-taxonomy).

   - **Structured logging only.** `log.info('payout.initiated', payout_id=pid, actor_id=aid, amount=amt, currency=cur)` — not `log.info(f'starting payout for {aid}')`. Operators query fields, not free text.
   - **Log at boundaries, not lines.** Entry into the function (`<name>.received`), key decision points (`<name>.validated`, `<name>.dependency_x.called`), exit (`<name>.completed` / `<name>.failed`). Don't litter the body with logs — operators will hate you.
   - **Never log secrets, PAN, CVV, full tokens, full SSNs.** See [§ 3](#3-logging-levels-and-what-never-to-log) for the no-log list. Log a hash, a last-4, a tokenized form, or nothing — never the raw value.
   - **Catch only the errors you know how to handle.** Catching a generic exception just to log it and re-throw is noise. Let unknown errors propagate to the caller's error boundary.
   - **For state-changing operations, implement idempotency.** Either check a persistent idempotency store before doing the work, or rely on a uniqueness constraint downstream — but **the function returns the same result on a replay**, never a duplicate side effect.
   - **For monetary arithmetic, declare the rounding mode.** Python: `Decimal.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)`. Never let the language's default decide.

6. **Write the tests.** A separate test file (or test block) covering the happy path **plus ≥ 5 edge cases drawn from at least 4 categories** in [§ 5 Edge-case categories](#5-edge-case-categories). Rules:

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

8. **Render the deliverable.** Format per [§ 1 Output format](#1-output-format). Post in chat. If the user named a target file path, offer to write the file; otherwise leave the code in chat for them to copy.

9. **Stop.** Wait for the user. They may approve, ask for revisions, or ask for the function to be saved to a file. Revise the spec, the implementation, or the tests — but treat them as a triple: a change to the spec usually means a change to the tests and the implementation too.

---

## Reference

## 1. Output format

Render the deliverable as a single chat message in this shape. The deliverable is real code — not a sketch.

````md
# <function-name> — production deliverable

## Function spec
- **Name:** `<name>`
- **Signature:** `<full typed signature>`
- **Purpose:** <one sentence in domain terms>
- **Inputs:** <bulleted, each with type, meaning, range>
- **Outputs:** <return type and what each variant means>
- **Side effects:** <bulleted; or "pure">
- **Performance budget:** median <ms>, p99 <ms>, throughput <calls/sec>
- **Compliance:** <PCI / SOX / GDPR / KYC scope, or "none">
- **Idempotency:** <key, dedup window; or "n/a — read-only">

## Failure modes
- **Input:** <list>
- **Business rule:** <list>
- **Dependency:** <list>
- **State:** <list>
- **Resource:** <list>

## Implementation

```<language>
# Imports — real, not pseudo.
# Errors — defined here or imported from the project's error module.
# The function — typed, validated, logged, error-handled.
```

## Tests

```<language>
# Test file. Runs as-is in the project's test harness.
# 1 happy-path test + ≥ 5 edge-case tests drawn from ≥ 4 categories.
```

## Performance + scale note
- **Big-O:** <complexity in the relevant dimensions>
- **Allocation profile:** <what's allocated per call; what could be reused>
- **Latency budget:** <median / p99 with the load-bearing assumption>
- **First bottleneck at 10x:** <specific bottleneck>
- **Back-pressure / shedding:** <behavior under overload>
````

Rules for the rendered deliverable:

- **No TODO / FIXME / placeholder values.** Every branch executes real code with real values.
- **Every error in `Failure modes` has a matching test case.** Untested error paths are aspirational, not real.
- **Edge-case tests come from ≥ 4 categories.** Five tests all in the "boundary values" category is one category, not five edge cases.
- **The code paste compiles / runs as-is.** No "you'll need to also define `User` somewhere" — define it, or import it from a clearly-named real module path.
- **The performance section names specific numbers.** "It's fast" is not a performance note. If precise numbers aren't available, give the assumed envelope and label it as an estimate.

## 2. Type discipline

- **Money — Decimal, with currency, with rounding mode declared.**
  - Python: `from decimal import Decimal, ROUND_HALF_EVEN`. Use `Decimal(str(value))` from string input, never `Decimal(float_value)`.
  - JavaScript / TypeScript: a big-decimal library (`dinero.js`, `big.js`, `decimal.js`) or store as integer minor units (`{amount_minor: 1999, currency: 'USD'}`). **Never `number` for money.**
  - Java: `BigDecimal`. Never `double` / `float`.
  - Go: `shopspring/decimal` or integer minor units.
  - Always pair amount with currency. A bare `Decimal` is a bug — `Decimal('100.00')` is not the same thing as `Money(Decimal('100.00'), 'USD')`.
  - Declare the rounding mode at every quantization. Default to banker's rounding (`ROUND_HALF_EVEN`) unless the spec demands otherwise.
- **Identifiers — opaque / branded types.**
  - Python: `NewType('UserId', str)`. TypeScript: `type UserId = string & { readonly __brand: 'UserId' }`. Rust / Haskell get this for free with newtype wrappers.
  - The point is to make `transfer_funds(from_user=account_id, to_account=user_id)` a type error, not a runtime mystery.
- **Time — instant with explicit timezone.**
  - Always UTC at the boundary. Convert to local time only at the display layer.
  - Python: `datetime` with `tzinfo=timezone.utc`. Reject naive datetimes at the boundary.
  - Use monotonic clocks for measuring durations; wall clocks for recording when something happened.
- **Result types — sum types, not exceptions for business-rule failures.**
  - "Insufficient balance" is a normal business outcome, not an exception. Return `TransferResult.Rejected(reason='INSUFFICIENT_BALANCE')`, don't `raise InsufficientBalanceError` from inside the happy path.
  - Reserve exceptions for genuine programmer errors (invalid types, broken invariants) and infrastructure failures (database down). Domain outcomes are values.
  - In languages without sum types, use a tagged class hierarchy or a discriminated dict with a `kind: Literal['settled', 'pending', 'rejected']` field.

## 3. Logging levels and what never to log

**Levels.** Pick the level by who needs to act, not by how interesting the line is.

- **`DEBUG`** — internal state useful for the engineer debugging this exact code. Off in production by default. Safe to log structured intermediate values **if** they aren't on the no-log list below.
- **`INFO`** — operation-lifecycle events: `received`, `validated`, `committed`, `completed`. One or two `INFO` lines per call, not ten. Structured fields: operation id, actor id, amount + currency, result code.
- **`WARN`** — recoverable degradation: a retried call that succeeded, a fallback used, a cache miss in a hot path. WARN means "we noticed and handled it; investigate if the rate is climbing."
- **`ERROR`** — operation failed; the caller's call did not complete successfully. Includes operation id, actor id, error code, structured error context. Sufficient for the on-call runbook to find the right trace.

**Never log (the no-log list).**

- Full card numbers (PAN). Log the last 4 with the rest masked (`****-****-****-1234`), or a tokenized form, or nothing.
- CVV / CVC / CV2. Period. PCI-DSS forbids it even encrypted at rest.
- Full bearer tokens, API keys, refresh tokens. Log a hash or a prefix (`sk_live_AB****`).
- Passwords — including in `auth.failed` events. Log "auth.failed" with the username, not the credential.
- Full national identifiers (SSN, NIN, etc.). Log a hash if matching is required downstream; otherwise omit.
- Customer date of birth beyond month + year.
- Full bank account numbers / IBANs — log a hashed or last-4 form.
- Raw request bodies that might contain any of the above. If unsure, redact.

**Operational rule.** Logs are read by auditors, customer support, on-call engineers, and security responders. **Assume every log line will be read by someone outside your team.** A line you wouldn't show to a security responder is a line that doesn't ship.

## 4. Error taxonomy

Five named families. Each gets its own exception class (or sum-type variant). The caller decides what to do based on the family — generic exceptions force the caller to guess.

- **`ValidationError`** — caller's input was malformed or out of range. Maps to HTTP 4xx. Caller's fault. Always carries the offending field name and value.
- **`BusinessRuleError`** — domain invariant violated (insufficient balance, account frozen, currency mismatch, daily limit exceeded). Maps to HTTP 4xx (or 409). Not retryable; the caller must change the input or the underlying state.
- **`DependencyError`** — an external dependency failed (database, upstream API, message bus). Maps to HTTP 5xx. Carries the upstream operation name and the upstream's error if available.
- **`TransientError`** — temporary failure where a retry is expected to succeed (timeout, rate limit, transient network blip). Maps to HTTP 503 / 429. Carries a `retry_after` hint if available.
- **`ConfigurationError`** — internal misconfiguration (missing env var, malformed config file, missing secret). Maps to HTTP 5xx. Should fail loudly at startup, not at first request.

**Rules.**

- **Each family is a real type**, not a string in a generic exception.
- **Errors carry structured context.** A `BusinessRuleError` for insufficient balance carries `requested`, `available`, `currency`, `actor_id` — fields a runbook can query.
- **Don't downgrade families.** A `DependencyError` should not be re-raised as a `ValidationError` just because the public API returns 4xx — translate at the API boundary, not inside business logic.

## 5. Edge-case categories

Pick at least **5 tests** from at least **4 different categories**. Padding the count with five variants of the same case (five "boundary values" tests) does not count as five edge cases.

- **Boundary values** — zero, one, max-int, exactly-at-limit, just-over-limit, empty collection, single-element collection.
- **Null / missing** — required field absent, optional field present-but-null, partially populated object, default-vs-explicit distinguishability.
- **Type / shape mismatch** — wrong type (`'100'` when `Decimal` expected), unexpected extra fields, deeply nested-vs-flat, wrong shape from a flexible upstream.
- **Adversarial input** — oversized payload, malformed encoding, deliberately confusing characters (unicode normalization, RTL marks, null bytes), injection-shaped strings.
- **Concurrency** — same idempotency key from two simultaneous callers, simultaneous writes against the same row, a retry arriving while the original is still in flight.
- **Dependency failure** — upstream timeout, upstream 5xx, upstream returned malformed body, retry budget exhausted, rate limit hit.
- **Idempotency** — replay with same body returns same result without re-side-effecting; replay with **different body but same key** returns a specific error.
- **Locale / time** — DST boundary, timezone-naive input, calendar-arithmetic edge case (Feb 29, end-of-month rollover), locale-dependent number / date parsing.
- **Numeric edge** — `NaN`, `Infinity`, very small positives, negative zero, rounding-mode boundary, precision overflow.
- **Money-specific** — zero amount, negative amount, currency mismatch between operands, precision overflow (more decimal places than the currency supports), cross-currency operation without a rate.

## 6. Performance + scale note — what to actually write

The section is short (5–10 lines) and concrete. Vague answers are worse than no section.

- **Big-O** — name the dimensions. "`O(n)` in number of line items, `O(1)` in number of accounts touched."
- **Hot-path allocations** — what's allocated per call that's avoidable. "Compiles a regex on each call; should be hoisted to module scope."
- **Latency budget** — observed or estimated. "Median ~3ms with a warm pool; p99 ~80ms dominated by the auth-service call. p99 will degrade to ~300ms if the auth cache misses."
- **First bottleneck at 10x** — name the specific resource. "First bottleneck at 10x throughput: the per-call DB transaction holds a row lock on `accounts` for ~50ms; under 10x concurrent calls on hot accounts (~5% of traffic), expect lock-wait queueing."
- **Back-pressure** — explicit shedding behavior. "On `DependencyError` from the payout rail, the function returns immediately rather than retrying inline; retries happen out-of-band via the `payouts.pending` queue with exponential backoff."

## 7. Anti-patterns the function author must avoid

- **The "happy path with a TODO for errors" implementation.** Throwing a generic `Exception('not yet handled')` for any case the author didn't think through. This manual exists to refuse that move.
- **The `try / except Exception: pass` swallow.** Silent failures are how money disappears. Catch only what you can name and handle.
- **The float for money.** `0.1 + 0.2 != 0.3` in IEEE 754. There is no clever rounding that saves a float-based ledger. Use Decimal / BigDecimal / integer minor units. Period.
- **The unstructured log line.** `log.info(f'processed {x} for {y}')` is a string that future operators cannot query. Use structured fields.
- **The secret in the log line.** Even at DEBUG. Even "just temporarily." The log goes somewhere; somewhere keeps it for 90 days; someone exfiltrates the log archive in 2027. Don't.
- **The generic `ValueError` for every input problem.** Callers cannot pattern-match on a string message. Define specific error types from the start.
- **The test that asserts the mock was called.** `mock.assert_called_with(...)` is a test of the mock, not the code. Assert on the outcome the function produces, not on which methods it called along the way (with rare exceptions for boundary contracts).
- **The "we'll add idempotency later" state-changing function.** "Later" is after the first double-payment incident. Build it in from the first commit, or design the function not to change state.
- **The performance section that says "should be fast."** Without numbers, it is taste. With numbers, it is a budget the future engineer can verify.
- **The function that knows about HTTP.** A business function returns domain results and raises domain errors. The translation to HTTP 4xx / 5xx happens at the API boundary, in code dedicated to that boundary. Mixing the two makes the function untestable outside an HTTP harness and unreusable in the worker / job / CLI surface.
