---
name: requirements-interview
description: Interrogate an under-specified request into a crisp spec before building — restate the goal, ask only the two or three questions that actually change the design, surface hidden constraints and assumptions, and confirm scope and done-criteria. Use when a request is vague, ambiguous, or could be built several ways, or before a large or risky change where guessing wrong is expensive. Counters the misalignment failure mode; produces an agreed spec, not code.
user-invocable: true
---

# Requirements Interview

A short, sharp interview that turns a vague request into a spec both sides agree on, before any code
is written. It exists to kill the most expensive failure mode in AI-assisted work: building the wrong
thing confidently. Other skills (`production-function`, `adr`, `refactor`, `viral-launch`) reach for
this when a request is under-specified.

> The goal is **alignment, not interrogation.** Ask the few questions that change what gets built —
> not a checklist that makes the user do your thinking. If the request is already crisp, say so and
> proceed; don't manufacture questions.

## When to run it

- The request could be built several materially different ways.
- A constraint that would change the design is missing (scale, latency, data shape, who uses it).
- The change is large, risky, or hard to reverse, so guessing wrong is expensive.

If none of these hold, skip the interview — over-questioning a clear request is its own failure mode.

## Workflow

1. **Restate the goal in one sentence, in domain terms.** "You want X so that Y." Lead with this — it
   surfaces the biggest misunderstanding immediately, and often the user corrects the frame before any
   question is needed.

2. **Find the questions that change the design.** Privately list what you'd need to know, then keep
   only the ones whose *different answers produce different builds*. Drop anything you can decide
   yourself with a sensible default. Usually this leaves **two or three** questions. Common load-bearing
   axes:
   - **Scope** — what's explicitly in, and what's explicitly out, for this pass?
   - **Inputs/outputs** — real shapes and types, edge values, the empty and the huge case.
   - **Constraints** — scale, latency, concurrency, platform, compliance, deadline.
   - **Done** — how we'll both know it works (the acceptance check).
   - **Context** — what exists already that this must fit, and what it must not break.

3. **Surface assumptions as statements to confirm, not questions.** "I'll assume Postgres, single
   region, and that empty input returns `[]` — correct me where wrong." This is faster for the user
   than open questions and still catches the wrong guess.

4. **Ask, then stop and wait.** Put the restated goal, the two or three real questions, and the
   assumptions in one message. Wait for answers — don't start building behind a half-answered spec.

5. **Render the agreed spec.** Once answered, write the spec back in a few lines — goal, scope
   (in/out), inputs/outputs, constraints, and the done-criteria — and confirm. That spec is the
   handoff to whatever skill does the work.

## Anti-patterns

- **The trivia quiz.** Ten questions where two would do, or questions whose answers wouldn't change
  anything. Respect the user's time; ask only what's load-bearing.
- **The silent guess.** Building on an unstated assumption that, if wrong, wastes the whole effort.
  When an assumption is load-bearing and uncertain, surface it.
- **The interview that never ends.** Re-asking after you have enough to start. Once the design-changing
  questions are answered, stop interviewing and build.
- **Questions you could answer yourself.** Anything resolvable by reading the code or picking a sane
  default is not a question for the user.
