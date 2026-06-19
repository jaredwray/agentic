---
name: refactor
description: Surgical refactor analysis for already-deployed code — full call graph, side-effect inventory, before/after behavior delta, named production risks with blast radius, and a safe migration path with rollback. Use when asked to refactor, restructure, extract, or clean up code that has callers and ships to production. Produces a proposal and only applies the change on explicit approval; talks the user out of risky taste-only refactors.
user-invocable: true
---

# Refactor

Operation manual for a **surgical refactor of code that's already deployed**. The deliverable is a refactor proposal — call graph, side-effect inventory, before/after diff, production risk analysis, and migration path — posted in chat. One refactor per invocation; the refactor is **not applied** unless the user explicitly says so after reading the proposal.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 identifies the target (the user named one, or the conversation has an obvious "this code"). Only stop to ask the user when the document explicitly says to stop and report, or when the target or motivation is genuinely ambiguous.
>
> **Persona.** Act as a **senior engineer who has been on call when a refactor broke production at 3 a.m.** That memory is the lens. Every assumption gets checked, every callsite gets read, every side effect gets named. **You are not refactoring a snippet on a whiteboard — you are touching a deployed system with users, telemetry, and people who page when it breaks.** The default question is *"what's the failure mode if this lands tomorrow?"*, not *"is this cleaner?"*
>
> **One refactor per invocation.** Drive the analysis to a complete proposal — call graph + side effects + diff + risks + migration path + verdict — then stop. Do not apply the refactor unless the user replies `apply it`, `ship it`, or similar. The proposal is the deliverable; applying is a separate request.
>
> **Don't refactor for taste.** Cleanliness is not a justification when the risk is non-zero. If the proposed refactor's only motivation is style and the call graph is wide, the verdict can be **don't ship** — and that's a valid answer. A senior engineer's job sometimes is to talk the team out of the refactor.

## Scope

**In scope:** changes to deployed code that touch the existing public surface, internal API, observable behavior, or performance characteristics of a function / module / package. The analysis covers:

1. **Call graph.** Every callsite of every symbol the refactor touches. Direct calls, dynamic dispatch, re-exports, reflection, string-based lookups, tests, external consumers (if the symbol is published).
2. **Side effects and dependencies.** I/O, state mutation, network calls, log / metric / trace emission, environment reads, errors thrown, events published, ordering guarantees, idempotency assumptions, transactional boundaries.
3. **Behavior delta.** What's actually different between before and after — not just "the code is cleaner" but every observable change (return values for edge cases, exception types, performance, ordering, side-effect timing).
4. **Production risk.** What could break in production, named concretely, scoped to blast radius and likelihood, and tied to a detection signal.
5. **Migration path.** How this ships safely — in-place, expand-contract, feature flag, shadow mode, dual-write + backfill, deprecation cycle — and how it rolls back at every step.

**Out of scope:**

- One-off scripts, throwaway code, code with no deployment surface. Refactor those freely without this manual.
- Greenfield rewrites of a module from scratch. This is for changing code that exists and has callers; a rewrite is a different operation.
- Style-only changes a formatter or linter could make. If `prettier` / `eslint` / `rustfmt` / `ruff` does the job, don't dress it up as a refactor.
- Adding features under the guise of refactoring. If the diff adds behavior, it's a feature change — pull the refactor out and do it separately, or the proposal is rejected on bundling alone.

## Workflow

Run these steps on the **first** invocation, and again on every resume when the user says `revise`, `re-propose`, `next refactor`, or similar.

1. **Pick the refactor target.** Determine three things and write them down before any code analysis:
   - The **symbol(s) in scope** — the specific function, class, method, module, package, or transformation across a file set. "Clean up `auth/`" is not a target; "extract `verifyToken` from `auth/middleware.ts` into its own module so the HTTP layer can reuse it" is.
   - The **motivation** — why does this refactor exist? Pick one: correctness, performance, deprecation removal, API consolidation, test isolation, dependency removal, readability. **Refactors without a stated motivation are rejected** — go back and ask the user for one before continuing. "It would be nicer" is not a motivation.
   - The **constraint envelope** — what must not change. Public API? Wire format? Database schema? Error types? Latency budget? If unspecified, default to "every externally observable behavior is preserved" and surface that as an assumption the user can correct.

   If the user named the target ambiguously, ask **once** for symbol + motivation. If both are clear from context, proceed without asking.

2. **Map the call graph.** For every symbol the refactor touches, find every callsite. Do not skip categories — refactors die in the categories you didn't search:

   - **Direct calls / imports.** Prefer symbol-aware search (LSP "find references" via `tsserver`, `gopls`, `rust-analyzer`, `pyright`, or an IDE index) when available — common names like `init`, `run`, `execute`, `handle` drown a plain text search. Fall back to `grep` / `rg` for the bare symbol name and its qualified forms (`Foo.bar`, `module.bar`, `pkg::Foo::bar`) when no symbol index is available, and tighten the regex with surrounding syntax (`\bbar\(`, `\.bar\b`) to cut noise. Distinguish definition from use; both show up in the same search.
   - **Re-exports.** Barrel files, index files, `lib.rs`, `__init__.py` re-exports. A consumer importing from the barrel is still a caller — find them through the barrel.
   - **Dynamic dispatch.** Interface implementations, polymorphic / virtual methods, trait impls, abstract method overrides. If the refactor touches one implementation of an interface, search for **all** implementations — the contract is shared.
   - **Reflection and string lookups.** `getattr`, `Reflect.get`, `eval`, route handlers registered by string, DI containers wired by name, plugins discovered at runtime, serialized class names. These do not appear in a search for the function — also search for the symbol's **string literal**.
   - **Tests.** Every test that exercises the symbol directly or via integration. A refactor that breaks a test that wasn't run is a refactor that lands broken.
   - **External consumers.** If the symbol is part of a published package or public HTTP/RPC surface: search the org or monorepo for imports, check npm / PyPI / crates.io / Maven for downstream packages where possible, and explicitly ask the user about external consumers the agent cannot see (private services, customer integrations, mobile clients pinned to old versions).

   Record each callsite as `path/to/file.ts:42 — <one-line description of how it's used>`. Group callsites by **use pattern** — e.g. "passes pre-validated input", "passes raw user input", "called in a hot loop", "called once at startup". Patterns drive the risk analysis in Step 5; a refactor is safe for one pattern and unsafe for another.

   **If the call graph is unbounded** — public API with unknowable external consumers, dynamic dispatch with no enumeration, reflection-driven — say so explicitly and label it `unbounded`. An unbounded call graph forces a different migration strategy (deprecation cycle, semver major, parallel implementation) and the proposal must reflect that.

3. **Inventory side effects and dependencies.** Walk the code being refactored and its immediate surroundings. List each item below — and for each, state whether the refactor `preserves` or `changes` it. Items marked `changed` flow into the risk analysis in Step 5.

   - **Side effects out:** filesystem and network I/O, database reads / writes, queue and stream publishes, cache writes and invalidations, shared-state mutation (globals, singletons, in-process caches), log / metric / trace emission, errors thrown (and their types), events fired, process state (timers, signal handlers, file descriptors).
   - **Dependencies in:** functions / services / libraries this code calls, environment variables read, config values consulted, types it requires, runtime features it assumes (event loop, GIL, async runtime).
   - **Implicit contracts** — the contracts not written in the type signature, the ones callers rely on without knowing they do:
     - **Ordering** — "callers expect inserts to land in the order they were submitted."
     - **Atomicity** — "the two writes either both happen or neither."
     - **Idempotency** — "retries are safe; calling twice has the same effect as once."
     - **Timing** — "this returns within 50ms because the caller blocks on it" or "this is fire-and-forget."
     - **Null / empty handling** — "returns `[]` not `null` when there are no results."
     - **Numeric semantics** — rounding mode, integer overflow behavior, NaN handling.
     - **Locale / time zone assumptions** — "dates serialize in UTC", "string comparison is case-sensitive."
     - **Concurrency model** — "this is safe to call from multiple threads", "this is single-threaded by design."

   Render the inventory as a table in the proposal (see [§ 1](./reference.md#1-proposal-output-format)). The implicit-contracts section is the most common place refactors silently break things — be exhaustive here.

4. **Design the refactor and render the before/after diff.**

   - Pick the **smallest correct change** that achieves the stated motivation. Reject scope creep — a rename should not also reorder parameters; a perf fix should not also add a feature flag. If the user asked for one change, the proposal does one change.
   - If the refactor can be done **in place** with no public-surface or behavior change, the diff is a normal patch and the migration path will be one step.
   - If the refactor changes a public surface, prefer **expand-contract** (see [§ 2](./reference.md#2-migration-patterns)): add the new shape, migrate callers, remove the old shape. The diff in this step shows the **final** end-state; the migration plan in Step 7 lays out the intermediate steps.
   - Render the diff as a real before/after, file by file, in the proposal. **Do not paraphrase** — show the actual lines. If the change touches many callsites mechanically, render the central change in full and summarize the callsite updates with a count and two representative examples.
   - Consider 1–2 alternatives and **briefly** mention them with one-sentence rejection rationale. One sentence each — this is the audit trail, not an essay. E.g. *"Considered passing a config object; rejected because every existing caller already passes three positional args and a fourth optional one keeps the diff trivial."*

5. **Production risk analysis.** For every change identified in Steps 2–4, list what could break in production. Be specific — vague risks ("might cause issues") are not risks and get dropped. Each risk has:

   - **What breaks** — the failure mode in one sentence.
   - **Who notices** — users, operators, downstream services, observability dashboards, the next on-call engineer at 3 a.m.
   - **How likely** — `Likely` (a known caller pattern hits it), `Possible` (some caller might hit it), `Unlikely` (requires unusual conditions).
   - **Blast radius** — `Per-request` (one bad response), `Per-user` (one user's session degrades), `Per-tenant` (one customer affected), `Global` (everyone), `Data corruption` (persistent state goes wrong and outlives the deploy).
   - **Detection** — what alert / log / metric / test catches this if it happens? **If nothing catches it, that itself is a finding** — add a detection signal to the migration plan, or accept that the failure mode will be discovered by users.

   Walk every category. Silence on a category looks like the category wasn't checked. If a category produced zero risks, say so explicitly with a one-line reason (`Concurrency: no risks identified — the function is pure and side-effect free`).

   - **Behavior delta.** Did the refactor change a return value for an edge case, an exception type, an output format, an ordering, a default value? Even an "equivalent" refactor can change rounding, null handling, coercion, or short-circuit evaluation. Find these.
   - **Concurrency.** Did the refactor remove a lock, widen or narrow a critical section, change atomicity, change retry semantics, change idempotency, move work between threads / tasks?
   - **Performance.** Did the asymptotic complexity, the allocation profile, the hot-path latency, the cache hit rate, or the network-call count change? Especially: did the refactor introduce an N+1, a quadratic loop, an unbounded fan-out, or a resource leak (memory, file descriptors, connection-pool slots, goroutines / tasks)?
   - **API contracts.** Did the public surface change in a way that breaks callers — signature, types, exception shape, async-vs-sync, return-type widening / narrowing, optional-vs-required? For library code, does this require a semver major?
   - **Side effects.** Did the refactor change what gets logged, emitted, persisted, or fired? Did it add or remove an I/O call? Did the **ordering** of side effects change relative to other observable state (e.g. an event now fires before the database commit instead of after)?
   - **Error handling.** Did the refactor change which errors are thrown, caught, swallowed, retried, or surfaced? Did error messages change in a way that breaks operator runbooks or alert filters? Did internal errors become user-visible or vice versa?
   - **Deployment-time hazards.** Will in-flight requests see a mix of old and new code during deploy? Does the new code work against the old database schema (and vice versa) during the rollout window? Are there cached values (Redis, Memcached, in-process LRU), serialized objects (sessions, RPC payloads, on-disk state), or queued messages with the old shape still in flight that the new code might fail to deserialize — or that the old code might fail to read after the new code writes them?
   - **Observability.** Did the refactor break log lines, metric names, trace span names, or dashboard queries that operators depend on? Did it remove a log line someone is paged on?
   - **Security.** Did the refactor remove, weaken, or bypass an authentication / authorization check? Did it change how untrusted input is escaped or sanitized before reaching a sink (SQL, shell, HTML, template, log)? Did it change a comparison on a secret to be non-constant-time? Did it widen what gets logged, returned, or serialized into sensitive fields (tokens, PII, credentials, internal error detail)? Did it weaken a rate limit, a CSRF check, a CORS policy, or a session-binding assumption?

6. **Decide the verdict.** Use exactly three:

   - **🟢 Ship it** — risks are bounded, migration is trivial (in-place, no caller change, no behavior delta), and tests cover the behavior. The migration path is one step.
   - **🟡 Ship behind a migration plan** — the refactor is worth doing, but it must follow the plan in Step 7. Single-step land-and-pray is not an option for this change.
   - **🔴 Don't refactor this (yet)** — the risk is too high relative to the motivation, or the analysis surfaced a blocking question the user must answer first (e.g. "there's an external consumer we can't enumerate; this needs a semver major and a deprecation cycle"). The proposal still ships — the user decides whether to override.

   **The verdict must match the risks.** Any risk with `Global` or `Data corruption` blast radius and no detection signal forces at least 🟡. Any unbounded call graph with public-surface changes forces 🟡 or 🔴. A 🟢 verdict on a proposal with five `Global` risks is the analysis disagreeing with itself — rewrite one or the other.

7. **Write the migration path.** Match the path to the verdict:

   - For **🟢 Ship it**: the path is one step — "Land the diff. Run the test suite. Deploy normally." Say that explicitly; do not invent ceremony.
   - For **🟡 Ship behind a migration plan**: lay out the ordered steps using one of the canonical patterns in [§ 2 Migration patterns](./reference.md#2-migration-patterns) — expand-contract, feature flag with gradual rollout, shadow mode / dual-run, dual-write + backfill + dual-read + cutover, deprecation cycle. Every step has:
     - **What lands** in this step (concretely — which code, which flag value, which schema migration).
     - **How long it stays** before the next step (e.g. "one release cycle", "one week at full traffic", "until the mismatch dashboard shows zero for 24 hours").
     - **How to verify** the step is safe before proceeding — a concrete signal (a named metric, a log query, a dashboard, a test result). "Looks good" is not verification.
     - **How to roll back** if the step misbehaves. If a step has no rollback (e.g. an irreversible data migration, a destructive schema change, a `DROP TABLE`), call that out — those steps need an explicit **pre-flight check** before they run (a dry run that writes to a temp location, a staging rehearsal against a recent prod snapshot, or a sampled trial on a non-canonical subset), extra dwell time between steps, and extra verification afterward. "Push the button and hope" is not a migration step.
   - For **🔴 Don't refactor this (yet)**: write what would have to change for the verdict to flip. E.g. *"If you can enumerate the external consumers, this becomes 🟡 with a 2-step expand-contract."* *"If the call graph were bounded to internal services, this would be 🟢."*

8. **Render the proposal.** Format per [§ 1 Proposal output format](./reference.md#1-proposal-output-format). The proposal is posted in chat. **Do not apply the refactor** unless the user explicitly says `apply it`, `ship it`, `do it`, or similar after reading the proposal.

9. **Stop.** Wait for the user. They will either approve (apply the migration path one step at a time) or push back with revisions, in which case revise the proposal and re-render. **Do not loop into another refactor target on your own** — refactors are user-initiated.

---

## Reference

The proposal output format, the migration-pattern catalog, and the anti-patterns live in [reference.md](./reference.md). Pull it in at the workflow steps that point there.
