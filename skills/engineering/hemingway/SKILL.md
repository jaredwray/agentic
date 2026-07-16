---
name: hemingway
description: Editing-first discipline that makes a change smaller, clearer, and more direct without weakening the behavior that matters — delete, inline, narrow, and simplify before adding helpers, compatibility paths, configuration, or speculative structure. Produces a Cut / Simplify / Keep / Smallest Change report; edits are applied directly only when trimming your own in-progress draft. Use when implementing, reviewing, or revising code where a change is growing in size, abstraction, edge-case handling, or complexity, when a review comment is about to be answered by adding code, or when asked to simplify, tighten, trim a diff, cut bloat, or judge whether something is over-engineered.
user-invocable: true
---

# Hemingway

Operation manual for an **editing pass over a growing change** — make the code smaller, clearer, and more direct without weakening the product behavior that matters. One pass per invocation; the deliverable is a **Cut / Simplify / Keep / Smallest Change** report ([§ 3](#3-report-format)) posted in chat.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 identifies the target (the change being drafted, a PR under review, or a function / module / diff the user named) and the behavior it must preserve. Only stop to ask when the target is genuinely ambiguous.
>
> **Core principle: cut until cutting would change the meaning.** The meaning is the behavior contract fixed in Step 1 — what a user, caller, or downstream system observes and needs. Everything else is a candidate for deletion.
>
> **Persona.** Act as a **ruthless line editor**. Every line must earn its place; a line that explains, hedges, generalizes, or anticipates — instead of doing — gets cut. The edit is judged by what survives: the behavior the product needs, in the fewest moving parts.
>
> **Two modes, one rule about applying.** In **drafting mode** — the target is your own uncommitted work from this session — apply the edits directly and post the report as the record. In **reviewing mode** — shipped code, someone else's diff, a PR — the report is the deliverable; apply nothing until the user says `apply it` or similar. In both modes, a cut that changes **shipped** observable behavior is never applied silently: mark it a **proposed narrowing** and let the user decide.

## Scope

**In scope:** an editing pass over one of:

1. **The growing draft** — a change under implementation that is gaining size, abstraction, edge-case handling, or complexity mid-flight.
2. **The review round** — a PR where comments are about to be answered with more code (see [Review-cycle discipline](#review-cycle-discipline)).
3. **The named target** — a function, module, or diff the user asked to simplify, tighten, or shrink.

The pass runs deletion, inlining, narrowing (types, parameters, behavior), de-configuration, comment removal by clarification, and test tightening (behavior over machinery).

**Out of scope:**

- **The behavior contract itself.** Correctness, security, data-safety, and compatibility code stays when [§ 2](#2-when-more-code-is-worth-it) justifies it. This skill removes machinery, not protections.
- **Restructuring shipped public surface.** A change to a published API, wire format, or observable contract of deployed code is a call-graph-and-migration problem — defer to the `refactor` skill. Hemingway edits within the target; it does not move shipped structure.
- **Bug hunting.** Judging the correctness of what stays is the `code-review` skill's job. (Cuts must still not introduce bugs — that is what Step 5's contract check verifies.)
- **Style nits** a formatter or linter already enforces.
- **Golf.** Shortness that costs clarity — dense one-liners, cleverness, deleting names that carried meaning — is not editing. The goal is fewer moving parts, not fewer characters.

## Editing bias

The standing preferences, consulted at every step:

- Prefer deletion to addition.
- Prefer direct code to explanatory indirection.
- Prefer narrowing behavior to adding branches.
- Prefer one concrete path to a generalized framework.
- Prefer explicit facts to defensive speculation.
- Follow existing repo patterns — but a pattern this change introduced earns no deference for existing; PR-local patterns are candidates like everything else.
- Treat every abstraction as a cost until it proves otherwise.

## Review-cycle discipline

Before satisfying a review comment by **adding** code — a helper, a guard, a compat path, a config knob — answer these in order:

1. Can the comment be resolved by **deleting** code instead?
2. Can it become a simpler condition, name, or data shape?
3. Would the new helper hide the complexity rather than remove it?
4. Does the branch support a real lifecycle state or an imagined one?
5. Is the compatibility path required by evidence — a real caller, a shipped contract?
6. Is this complexity inherited from the real codebase, or did this PR create it and is now optimizing around it?
7. Will a future reader understand the behavior faster after this change?

When the honest answers favor cutting, the response to the reviewer is a deletion plus one sentence of evidence — reply per `pr-conventions`. Review-driven additions that change no user-visible or system-visible outcome are cuts waiting to happen.

## Workflow

Run these steps on the first invocation, and again when the user says `another pass`, `apply it`, or names a new target.

1. **Fix the target and the behavior contract.** Identify the code under edit — in order: what this conversation is already editing; a PR / diff / function the user named; the uncommitted working tree; else stop and ask. Record the **mode** (drafting vs. reviewing) and write the **behavior contract**: the observable behavior that must survive — user-visible outcomes, caller-visible APIs and error shapes, data-safety properties, shipped wire formats. The contract is the meaning; a cut is safe exactly when the contract still holds.

2. **Deletion pass.** Walk the target (and, in reviewing mode, the immediate surrounding code it touches) hunting the [§ 1 cut list](#1-the-cut-list). Every candidate cut needs **evidence**, not vibes: the search that found no callers, the test that still passes, the flag no caller sets, the failure no log has ever shown. "Might be used somewhere" is not a reason to keep — find the callers. "Probably unused" is not a reason to cut — prove it.

3. **Simplification pass.** What deletion can't remove, make direct: inline the once-used helper; narrow the general parameter to what callers actually pass; collapse branches whose arms differ by one value into data; replace the defensive fallback with a plain, early failure; rename until the comment is redundant, then cut the comment. Then run Step 2 once more — simplification exposes dead code (an inlined helper's unused parameter, a branch now provably unreachable).

4. **Justify the survivors.** For each piece of complexity still standing — every abstraction, branch, fallback, and config point — apply the [§ 2 worth-it test](#2-when-more-code-is-worth-it). It stays only if it protects a named product property with evidence. Failures move to Cut; survivors become Keep entries with the property named.

5. **Apply and verify.** In drafting mode, make the edits (if not already made along the way), then run the tests that cover the behavior contract — or re-check the observable behavior by hand when there are none, and say so in the report. A cut that changes contract behavior is reverted or downgraded to a proposed narrowing. In reviewing mode, make no edits; still verify each claim cheaply where possible (the caller search, the existing test run).

6. **Render the report and stop.** Format per [§ 3](#3-report-format), posted in chat. One pass per invocation — resume only when the user says `another pass`, `apply it` (reviewing mode), or names a new target.

---

## Reference

### 1. The cut list

Flag these aggressively. Every flag cites `path/to/file.ts:42` and names its evidence.

- **A helper with one caller.** Inline it, unless it isolates a genuinely separate concern (`codebase-design`: a name is not depth).
- **A wrapper that forwards more than it hides** — the shallow module.
- **A new type that renames an existing shape** without adding an invariant.
- **A boolean flag that creates a hidden mode.** Two behaviors are two functions or two call sites, not a flag.
- **Configurability nothing configures** — parameters every caller passes identically, options with one value across the codebase, env vars with no consumer.
- **A seam with one implementation** and no test that substitutes it.
- **Defensive fallbacks for failures never observed** — catch-and-continue, defaults that mask absence, retries around code that cannot partially fail.
- **Tests that lock in machinery instead of behavior** — asserting a mock was called, a private shape, an internal ordering no caller observes.
- **Comments explaining code that could be made obvious.** Restructure or rename until the comment is redundant, then cut it. A constraint the code cannot express stays.
- **Review-driven additions with no user-visible or system-visible outcome.**

### 2. When more code is worth it

More code is justified only when it buys a **product-relevant property that matters for this change**:

- Correctness on a real user-visible or system-visible path.
- Health and data-trust properties — idempotency, freshness, deduplication, safe delete handling, source-system semantics.
- Observability that proves an important lifecycle or failure mode.
- Security, privacy, or compatibility for a real caller or a shipped contract.
- Test coverage for behavior that would be risky to regress.

Do not add code merely to handle every imaginable edge case. For each one, demand evidence before machinery:

- Is it reachable in the current product?
- Would mishandling it violate the product goal, user trust, data safety, or an external contract?
- Is there evidence — code, logs, telemetry, tests, known lifecycle behavior?
- Can the product choose a **narrower** behavior instead (reject the input, constrain the type)?
- Can the system **fail plainly** — one clear error — instead of gaining handling machinery?

If the complexity survives the test, keep the **smallest version that protects the property**: a guard clause before a framework, an assertion before a fallback, a plain error before a recovery path.

### 3. Report format

```md
# Hemingway pass — <target>

**Mode:** drafting (edits applied) / reviewing (proposal only)
**Behavior contract:** <1–2 sentences — the observable behavior that must survive>
**Result:** <n> cuts, <m> simplifications, <k> keeps — <net line delta, applied or projected>

## Cut
- `path/to/file.ts:42` — <what> — <the evidence nothing needs it>.

## Simplify
- `path/to/file.ts:88` — <inline / narrow / collapse / rename>: <before → after, one line>.

## Keep
- `path/to/file.ts:120` — <the complexity kept> — <the § 2 property that pays for it>.

## Smallest Change
<The single concrete edit to make next, small enough to make now.>

## Verification
<Tests run before/after, or the behavior re-checked by hand. Proposed narrowings listed here, awaiting approval.>
```

Rules for the report:

- **Every entry cites a real location.** A cut without a `path:line` is not a cut.
- **No hedging.** "Might be removable" is not a finding — verify the claim (find the callers, run the tests) or drop it.
- **Keep entries name the § 2 property.** "Feels safer" does not qualify.
- **Narrowings are labeled.** Any cut that changes shipped observable behavior appears under Verification as a proposed narrowing, unapplied.
- **"Already tight" is a valid verdict.** If Cut and Simplify are empty, say why the change earns its size — disagreeing with the trigger is a finding too.
- **Count the wins.** Lines and concepts removed, not paragraphs written about them.
