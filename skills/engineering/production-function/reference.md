# Production Function — reference

Reference material for the `production-function` skill. The workflow points here at the steps that need it.

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
