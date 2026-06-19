# Refactor — reference

Reference material for the `refactor` skill. The workflow points here at the steps that need it.

## 1. Proposal output format

Render the proposal as a single chat message in this shape. Keep prose tight — every section earns its lines.

````md
# Refactor Proposal — <target>

**Engineer:** Senior, has-been-on-call lens; treating this as deployed code.
**Target:** <symbol(s) and file(s)>
**Motivation:** <one sentence — the why>
**Constraint envelope:** <one sentence — what must not change>
**Verdict:** 🟢 Ship it / 🟡 Ship behind a migration plan / 🔴 Don't refactor this (yet)

## Call graph
<n> callsites across <m> files. Patterns:
- **<pattern A>** (e.g. "passes pre-validated input"): <count> sites — `path/a.ts:42`, `path/b.ts:88`, ...
- **<pattern B>** (e.g. "passes raw user input"): <count> sites — ...
- **<pattern C>** (e.g. "called in a tight loop"): <count> sites — ...
- **External consumers:** <count, or `unbounded — public API`> — <list or note>.

## Side effects & dependencies
| Aspect | Before | After | Status |
|---|---|---|---|
| I/O: writes to `audit_log` | one row per call | one row per call | preserved |
| Errors: throws `NotFoundError` on miss | throws | returns `null` | **changed** |
| Implicit contract: ordering of side effects | log before write | write before log | **changed** |
| ...

## Before / After
<the actual diff, file by file. Render the central change in full. For mechanical callsite updates, summarize: "Updates 14 callsites to pass `ctx` as the first argument; representative examples in `path/a.ts:42` and `path/b.ts:88`.">

## Alternatives considered
- <alternative 1> — <one-line rejection rationale>.
- <alternative 2> — <one-line rejection rationale>.

## Production risk
### Behavior delta
- **<failure mode>**. Notices: <who>. Likelihood: <Likely/Possible/Unlikely>. Blast radius: <per-request / per-user / per-tenant / global / data corruption>. Detection: <signal, or `none — must add one before shipping`>.
- ...

### Concurrency
- <findings or "no risks identified — <one-line reason>">.

### Performance
- <findings or "no risks identified — <one-line reason>">.

### API contracts
- <findings or "no risks identified — <one-line reason>">.

### Side effects
- <findings or "no risks identified — <one-line reason>">.

### Error handling
- <findings or "no risks identified — <one-line reason>">.

### Deployment-time hazards
- <findings or "no risks identified — <one-line reason>">.

### Observability
- <findings or "no risks identified — <one-line reason>">.

### Security
- <findings or "no risks identified — <one-line reason>">.

## Migration path
<one of: "Land the diff. Run the test suite. Deploy normally." (🟢); the ordered step-by-step plan (🟡); the "what would have to change" note (🔴).>

For 🟡, each step:
1. **<step name>** — Lands: <what>. Stays for: <duration / condition>. Verify: <signal>. Roll back: <how>.
2. ...

## Open questions
- <anything the user must answer before this can ship — empty list is fine>.
````

Rules for the rendered proposal:

- **No marketing language.** "Significantly cleaner", "much more maintainable", "best practice", "modern" — drop. State the concrete change and the concrete risk.
- **No hedging.** Forbidden: *might*, *probably*, *should be safe*, *I don't think this matters but*. Replace with the actual claim or drop the line.
- **Every callsite has a `path:line`.** A call graph without locations is not a call graph; it is a guess.
- **Every risk has a blast radius and a detection signal.** A risk without those two is unfalsifiable and gets dropped.
- **No silent categories in production risk.** If a category produced zero risks, say so and say why in one line. A senior reviewer does not get to be silent on a category they checked.
- **The verdict matches the risks.** Restate verdict-vs-risks consistency before finalizing — if the analysis surfaces global blast radius with no detection, the verdict cannot be 🟢.

## 2. Migration patterns

Pick the smallest pattern that bounds the risk. Stacking patterns (e.g. expand-contract behind a feature flag) is sometimes right; bolting them on by reflex is not. Each pattern below is a default sequence — adapt the verification and rollback to the specific system.

### Expand-contract (a.k.a. parallel change)

For changes to a public surface (function signature, exported type, API route) with **bounded** callers.

1. **Expand.** Add the new shape alongside the old. The old shape stays fully functional; the new shape is the target end-state. Both delegate to the same underlying implementation (or the new one wraps the old).
2. **Migrate.** Update callers from old to new, in batches if numerous. Each batch is its own PR. New code uses the new shape only.
3. **Contract.** Once no caller uses the old shape — verified by `grep` for internal code, by a runtime metric for dynamically dispatched code, or by a deprecation window for external consumers — delete the old shape.

**Verify between steps:** zero internal references to the old shape after step 2. For runtime-dispatched code, a counter on the old code path should sit at zero for at least one full traffic cycle (including weekends) before step 3.

**Roll back:** at any point before step 3, the old shape still works — revert the in-flight PR. After step 3, rollback re-adds the old shape (fine — it was just code).

### Feature flag with gradual rollout

For changes whose behavior is observable in production and where reverting fast matters more than minimizing flag debt.

1. **Land behind a default-off flag.** Both code paths exist; the flag selects at runtime. Tests cover both paths.
2. **Enable for internal / canary traffic.** Watch the metrics named in the risk analysis. If anything moves the wrong direction, flip the flag off and diagnose.
3. **Ramp.** 1% → 10% → 50% → 100%, with at least one full traffic cycle (and one weekend, if the surface is user-facing) at each step.
4. **Burn down the flag.** Once 100% has held for the agreed dwell time, remove the old code path and the flag. Stale flags are technical debt with security implications — every flag is a configuration toggle someone can flip without code review.

**Verify between steps:** the metrics named in the risk analysis. Define them **before** step 2 — discovering "we don't actually have a metric for this" mid-rollout means the rollout was unsafe to start.

**Roll back:** flip the flag off. The flag value is the rollback. (This is why feature flags exist.)

### Shadow mode / dual-run

For changes to compute-heavy or correctness-sensitive code where you want to compare the new implementation's output against the old before trusting it.

1. **Land both implementations.** Production traffic still uses the old one. Every request (or a sampled subset) also runs the new one, and the two outputs are compared.
2. **Log mismatches.** Every divergence between old and new emits a structured log entry with enough detail to reproduce. Watch the mismatch rate.
3. **Cut over** when the mismatch rate is acceptable (often "zero" — for some surfaces "zero except for known categorized cases").
4. **Remove the old implementation.**

**Verify between steps:** the mismatch rate stays at or near the target. If it spikes, the new implementation is wrong somewhere — fix it, don't normalize the spike away.

**Roll back:** production traffic still uses the old implementation until step 3, so rollback before cutover is just a code revert.

### Dual-write, backfill, dual-read, cutover

For changes to persisted state — schema migrations, store changes, format changes — where the data outlives any single request.

1. **Dual-write.** New writes go to both the old and new stores / columns / formats. Reads still come from the old.
2. **Backfill.** Migrate historical data to the new store / column / format in a job. Verify completeness with a row count, a checksum, or a sampled diff.
3. **Dual-read with old as source of truth.** Reads consult both; the old is canonical, the new is verified (log mismatches).
4. **Flip source of truth** to the new store / column / format. The old becomes the verifier.
5. **Stop dual-writing.** Reads come from the new store. The old is frozen.
6. **Drop the old.** After a hold period — long enough to be confident the new state is correct, often weeks — remove the old store / column / format.

**Verify between steps:** completeness on the backfill, mismatch rate during dual-read. Each step has its own pause for confidence to build before the next.

**Roll back:** before step 4, the old store is still authoritative — abort by flipping reads back. After step 4, rollback is its own real migration; the cutover should not have happened without high confidence.

### Deprecation cycle

For changes to a public API with **external consumers you cannot enumerate**.

1. **Announce deprecation.** Mark the old shape `@deprecated` in code and changelog. Add a runtime warning (log line, response header, response field) on every call to the old shape.
2. **Wait** for the deprecation window — for libraries, typically one major version; for HTTP APIs, typically 6–12 months. Publish migration docs.
3. **Watch usage decay.** If you have consumer telemetry, watch it drop. If you do not, you cannot reach step 4 with confidence — extend the window or explicitly accept the risk.
4. **Remove** the old shape in a semver major (libraries) or versioned-API sunset (HTTP). Publish the breaking change clearly.

**Verify between steps:** telemetry showing decayed usage, or — absent telemetry — the calendar window agreed at announcement.

**Roll back:** until step 4, the old shape still works. After step 4, consumers must migrate or pin the old version.

## 3. Anti-patterns the refactorer must avoid

These are the failure modes of bad refactor proposals. Catch yourself and rewrite.

- **The "while I'm in here" refactor.** Bundling a rename, a perf fix, and three style cleanups into one diff. Each survives or dies on its own merits — bundling means a real bug in one piece blocks the whole change, and a rollback rolls back the unrelated fixes too. Pull them apart, propose them separately.
- **The "trust me, it's equivalent" claim.** Refactors that "preserve behavior" almost always have one or two cases where they don't — rounding, null handling, ordering, exception types, log lines, short-circuit evaluation, default values. **"Equivalent" is a hypothesis, not a fact.** Find the corner cases. Name them. Decide if they matter.
- **The unbounded call graph that ships anyway.** "It's a public API but I think most callers do X." A refactor that depends on a guess about callers is a refactor that ships with an unknown blast radius. Either bound the call graph (deprecate + observe) or design the change so it doesn't matter what callers do.
- **The migration plan that's actually land-and-pray.** "Step 1: deploy. Step 2: monitor." Monitoring is not a rollback. If the change cannot be reverted in one step from a fresh deploy of the previous version, the migration plan is incomplete — name the rollback explicitly, or admit the step is one-way and add dwell time before it.
- **The performance refactor with no measurement.** "This is faster" without a benchmark, a profile, or a prod metric is taste, not fact. Either measure or drop the performance justification — and if you measure, include the numbers in the proposal.
- **Refactoring code that has no tests.** A refactor lands safely because the tests catch what the engineer missed. No tests → the safety story is "the engineer didn't miss anything," which is the same story that broke production last time. **Add characterization tests first, refactor second.** That is two PRs, not one.
- **The verdict that contradicts the analysis.** Surfacing five `Global` blast-radius risks and concluding 🟢 Ship it. If the risks justify red, write red. If you wrote green, the analysis above must support it — go back and reconcile.
- **The proposal that quietly becomes an application.** The user asked for a proposal. Stop at the proposal. Applying the refactor is a separate user instruction, not a default next step.
