# Architecture Decision Record — reference

Reference material for the `adr` skill. The workflow points here at the steps that need it.

## 1. ADR output format

Render the ADR as a single chat message inside a four-backtick fenced block so the user can copy the content verbatim. Use the canonical structure below. Drop sections that genuinely don't apply (rare); never drop sections to hide weak analysis.

````md
# ADR-NNNN: <decision title>

**Status:** Proposed
**Date:** YYYY-MM-DD
**Deciders:** <names or "engineering team">
**Reversibility:** One-way door / Two-way door
**Supersedes:** <ADR-MMMM, if any>
**Superseded by:** <to be filled in if/when this is replaced>

## Context

<2–5 sentences describing the problem, the system as it exists today, and why we are deciding now. State the constraints — latency SLO, throughput target, team size, regulatory requirements, budget envelope — that bound the answer. A reader two years from now should be able to reconstruct *why this decision was on the table*.>

## Decision drivers

In order of weight:

1. <driver 1 — e.g. "Operational simplicity for a 3-person platform team">
2. <driver 2 — e.g. "Write throughput headroom of 10x current peak">
3. <driver 3 — e.g. "Migration cost from existing PostgreSQL">
4. ...

## Options considered

### Option A: <name>

**What it is:** <2–4 sentences describing the option concretely — components, dependencies, default production shape.>

**Pros:**
- <concrete pro, tied to driver #N>
- <...>

**Cons:**
- <concrete con, tied to driver #N>
- <...>

**10x stress test:** <first thing that breaks at 10x users / writes / data / team / partner integrations; what the fix looks like>.

**Hidden costs:**
- <operational / vendor / hiring / cognitive / migration cost not on the marketing page>
- <...>

### Option B: <name>

<same fields>

### Option C: <name> (if applicable)

<same fields>

## Decision

We will adopt **<Option X>**.

<2–4 sentences. Name the dominant driver. Tie the choice to specific trade-offs and hidden costs from above. Acknowledge what this gives up. If the options were genuinely tied, say so and explain why the chosen one is the more reversible one.>

## Consequences

**What changes:**
- <new services / runbooks / on-call expertise / dashboards>
- <...>

**New work this creates:**
- <migration tasks, training, retirement of old thing, follow-up ADRs>
- <...>

**Now explicitly out of scope:**
- <capabilities we are choosing not to build because of this decision>
- <...>

**What we accept:**
- <cons we agreed to live with, restated so the future reader knows they were seen>
- <...>

## 2-year regret check

**What would make this look like a mistake in 24 months:**
- <scenario 1 — e.g. "the workload shifts from 80/20 read/write to 50/50, exceeding the leader-write ceiling">
- <scenario 2 — e.g. "the vendor's free tier disappears and per-GB pricing makes the bill 4x our budget">
- <scenario 3 — e.g. "the team triples and the bus-factor-1 maintainer of the in-house library leaves">

**Off-ramp if we're wrong:**
<concrete migration path — dual-write to a new store, versioned façade, feature-flagged second implementation. If there is no off-ramp, say so explicitly: "This is a one-way door — migrating away requires a multi-quarter rewrite. We accept this in exchange for <reason>.">

## References
- <link to RFC / design doc / vendor docs / prior ADR>
- <...>
````

Rules for the rendered ADR:

- **Status starts at `Proposed`.** Moving to `Accepted` happens when the user (or the team) approves. Moving to `Deprecated` or `Superseded` happens in a later ADR; this one doesn't predict that.
- **Date is the date the ADR is drafted.** Not a guess at when it'll be accepted.
- **Every pro / con is concrete and ties to a decision driver.** A pro that doesn't tie to a driver is decoration.
- **Every 10x answer names a specific breakage point.** "Scales linearly" is not an answer.
- **The Decision section names exactly one option.** Not two. Not "it depends." If the analysis genuinely supports either, recommend the reversible one and say why.
- **The 2-year regret check is mandatory.** No exceptions. A skipped regret section makes the ADR worth half as much in 24 months — which is when it matters most.
- **No marketing language.** "Best-in-class", "industry-standard", "modern", "elegant" — drop. Replace with the concrete claim or remove the line.

## 2. The 10x stress test

For each option, walk these questions and name the **first thing that breaks**. Vague "it scales" answers are rejected.

- **10x users.** Identity, session storage, auth — does the option's per-user state shape still fit? What's the per-user fan-out?
- **10x reads.** Read replicas, cache hit rates, fan-out queries. Does this option's read model survive 10x QPS, or do we hit a coordination bottleneck?
- **10x writes.** The hard one. Most architectures scale reads cheaply and break on writes. Where's the write bottleneck — leader-elected primary, single coordinator, lock contention, queue depth?
- **10x data volume.** Cold storage, retention, query cost on the long tail, backup windows, restore time. A system that backs up in 4 hours at 1x backs up in 40 hours at 10x — if at all.
- **10x partner integrations.** API surface, schema evolution, webhook fan-out, blast radius of one partner's bad input. "Each partner gets a custom adapter" doesn't survive 10x partners.
- **10x team size.** Coordination cost on shared abstractions, on-ramp time, ownership boundaries. A clever abstraction that 3 engineers love can become a 30-engineer coordination tax.
- **10x latency compression.** What if the SLO tightens from 200ms to 20ms? Which option's hidden latency floor (cold start, network hop count, serialization cost) is closest to that wall?
- **10x failure rate.** What if upstream reliability drops by an order of magnitude? Does this option degrade gracefully (queues absorb the bursts, partial results still ship) or does it amplify (retry storms, queue overflow, cascading timeouts)?

The point of the 10x test is not to design for 10x today. It's to surface **which option's first failure mode is closest to current scale**. That's the option's load-bearing risk.

## 3. Hidden costs cheat sheet

Walk these for every option. Most are absent from vendor docs and architecture diagrams.

- **Operational tax.** New alerts, new runbooks, new dashboards, new on-call expertise. How many extra pages per quarter does this option add? What's the median time-to-resolve for failures in this part of the stack?
- **Vendor risk.** Pricing trajectory at scale (the "free tier" math at 10x), license changes (BSL conversions are the canonical example), project velocity, single-maintainer dependencies, support quality at 3 a.m. on Saturday.
- **Hiring cost.** How rare is the skill on the open market? How long is the on-ramp for a new hire? How often will senior engineers leave because the stack is unusual on their resume?
- **Cognitive load.** How much loaded context does a developer need to be productive? How surprising are the failure modes? How leaky are the abstractions — does a 4-line bug in user code require understanding 10 layers of library internals?
- **Migration / exit cost.** How does data get out? What's stuck in this option's shape forever? What's the cost to leave in 2 years if the regret check triggers?
- **Coupling cost.** What else now depends on this option's API, deploy cadence, or uptime? Each new consumer makes the option harder to swap out — coupling compounds.
- **Compliance / audit cost.** New audit surface, new data residency rules, new encryption requirements, new vendor questionnaires from enterprise customers.
- **Long-term debt accrual rate.** How fast does this option's idiomatic code drift from current best practice? How disciplined does the team need to be about version upgrades?
- **Build-vs-buy boundary drift.** Will we end up building the parts of this option that don't fit? Vendors that 90% solve a problem make the team build the 10% that's bespoke — and that 10% becomes the highest-context code in the system.

## 4. The 2-year regret check

Apply this check after the recommendation. The check has three parts; render all three in the ADR.

1. **The bet.** State the implicit bet the decision makes. "We are betting that read-heavy workload stays read-heavy." "We are betting the team won't triple." "We are betting AWS's managed offering will keep up with the open-source version." Naming the bet lets a future reader recognize when reality has moved.
2. **The leading indicators.** What metric / signal would tell us the bet is going wrong **before** it becomes a crisis? A growing write-to-read ratio. Quarterly cost trending up faster than usage. Support tickets clustering around the abstraction's leaks. Hire-pipeline candidates dropping out citing the stack.
3. **The off-ramp.** If the bet loses, how do we exit? A concrete migration path — even if it's expensive — beats "we'd have to rewrite." If there is genuinely no off-ramp (one-way door with no escape), name that explicitly and **either** raise the bar for the recommendation **or** reduce the cost of being wrong with a smaller, narrower commitment first (pilot with one team / one tenant / one workload).

A common Staff+ move: when an analysis points to a one-way door with no off-ramp, change the question. Can we do a **narrower** version first — a single-tenant pilot, a single-region deploy, a single workload migration — that gives us 60% of the information for 10% of the commitment? If yes, the ADR's actual recommendation is the narrower version, with the broader decision deferred until the pilot's data is in.

## 5. Anti-patterns the ADR author must avoid

These are the failure modes of bad ADRs. Catch yourself and rewrite.

- **The "it depends" non-recommendation.** Listing trade-offs and ending with "the team should decide based on their priorities." Pick one. If you can't pick, the analysis is incomplete — go back and weight the drivers harder.
- **The marketing-page ADR.** Pros and cons copy-pasted from the vendor's homepage. A real ADR has cons the vendor would never publish — operational tax, hiring rarity, migration cost, behavior at the edges.
- **The strawman option.** Including an option only so the recommended one looks better. Every option deserves the same depth of analysis; if Option B was never seriously on the table, drop it from the ADR rather than fake-analyzing it.
- **The 10x section that says "it scales."** Name the bottleneck or remove the section. "Scales linearly" is the answer of someone who hasn't operated the system.
- **The missing regret check.** The most-skipped section is also the most valuable two years later. Don't ship the ADR without it.
- **The bundled decision.** "We will adopt X and also restructure Y and also migrate Z." That's three decisions. Three ADRs. Each survives or dies on its own.
- **The retroactive ADR.** Writing the ADR to justify a decision the team already made and shipped, with the analysis curated to support the foregone conclusion. If the user wants that, ask them to say so explicitly — and consider whether the document is actually an ADR or a postmortem in disguise.
- **The recommendation that ignores the constraints.** Recommending the option that wins on driver #1 while quietly violating a constraint listed in the context. Constraints are not soft — if an option violates one, it's not on the table.
- **No expiration awareness.** ADRs age. The recommendation that was right in 2025 may be wrong in 2027 because the world moved. The 2-year regret check is the procedure's way of dating the bet — don't skip the dating step.
