---
name: codebase-design
description: Shared vocabulary and heuristics for code-design decisions — module boundaries, coupling and cohesion, deep vs shallow interfaces, seams, adapters, leaky abstractions, and when to introduce (or refuse) an abstraction. A composable reference the refactor, adr, code-review, and production-function skills reach for when they need a consistent design language. Use when discussing how to structure code, naming a design smell, or deciding where a boundary belongs.
user-invocable: true
---

# Codebase Design

Shared design vocabulary for this plugin. Other skills (`refactor`, `adr`, `code-review`,
`production-function`) reach for this so they describe structure with one consistent language instead
of improvising a new one each time. This is background knowledge, not a workflow — there is no
deliverable to drive.

## Vocabulary

- **Module** — a unit that owns a responsibility and hides how it does it. Judged by what it exposes,
  not how many lines it has.
- **Interface vs. implementation** — the surface a caller depends on vs. the code behind it. Good
  design keeps the interface small and the implementation free to change.
- **Deep vs. shallow** — a *deep* module hides a lot of complexity behind a small interface (a
  scheduler exposing `submit(job)`); a *shallow* one exposes nearly as much as it hides (a wrapper
  that forwards five params to five params). Prefer deep. Shallow modules add a name without removing
  complexity.
- **Coupling** — how much two modules must know about each other. **Cohesion** — how related the
  things inside one module are. Aim for low coupling between modules, high cohesion within one.
- **Seam** — a place you can change behavior without editing the code around it (an injected
  dependency, a strategy parameter, an interface). Seams are where tests and future changes attach.
- **Adapter** — a thin module that translates one interface into another so the core stays unaware of
  an external shape (an SDK, a wire format, a legacy API).
- **Boundary** — where one concern ends and another begins: a trust boundary (validate here), a
  layering boundary (don't reach across it), a transaction boundary (atomic inside it).
- **Leaky abstraction** — an interface that forces callers to understand its implementation to use it
  correctly (a "cache" whose callers must know its eviction policy to avoid bugs).

## Heuristics

- **Introduce an abstraction to remove duplication of *decision*, not duplication of *text*.** Two
  blocks that look alike but change for different reasons should stay separate; one decision repeated
  in five places should become one module.
- **The best interface makes the common case trivial and the rare case possible.** If callers must
  pass the same three arguments every time, those belong inside, not in the signature.
- **Depth beats layers.** Each new layer is a tax (a name to learn, a hop to trace). Add one only when
  it hides enough complexity to pay for itself.
- **Push specialization up, keep the core general.** Special-case handling (one customer, one format)
  belongs at the edges in adapters, not threaded through the core with `if` branches.
- **Name by role in the domain, not by pattern.** `PayoutLedger`, not `PayoutManager` / `DataService`
  / `Helper`. A name that could front any module describes none.
- **A boundary you can't name is a boundary you don't have.** If you can't say what a module owns in
  one sentence, it owns too much — or nothing.

## Smell → name

When a skill spots a structural problem, name it with this vocabulary so the finding is precise:

- "This is a **shallow module** — it forwards more than it hides; inline it or give it a real job."
- "**Leaky abstraction**: callers can't use this correctly without reading its implementation."
- "**High coupling**: these two modules change together every time; the boundary is in the wrong place."
- "**Low cohesion**: this module does three unrelated things; split it along the seams."
- "Missing **seam**: there's no way to substitute this dependency, so it can't be tested in isolation."
