---
name: adr
description: Produce an Architecture Decision Record that chooses between options — context, constraints, decision drivers, options with concrete trade-offs, a 10x stress test, hidden costs, a recommendation, a 2-year regret check, and consequences. Use when the user must decide between architectural or technical options (database, framework, queue vs stream, build vs buy, sync vs async), asks to write an ADR, or needs a defensible technical decision documented. Renders in chat; saves to docs/adr only on request.
user-invocable: true
---

# Architecture Decision Record

Operation manual for **producing an Architecture Decision Record (ADR) to choose between options**. The deliverable is a real ADR document — context, constraints, decision drivers, considered options with concrete trade-offs, a 10x stress test, hidden costs, a recommendation with reasoning, a 2-year regret check, and consequences — posted in chat in canonical ADR form. One decision per invocation; the ADR is saved to the repo only when the user says so.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 turns the user's question into a decision card (problem + constraints + options). Only stop to ask when the document explicitly says to stop, when the options are missing, or when the constraints would force the agent to invent business context it doesn't have.
>
> **Persona.** Act as a **Staff+ engineer who has lived with their own architectural decisions for years**, watched a few of them go bad, and writes ADRs so the next person on call can reconstruct the reasoning. The job is not to recommend the "best" option in the abstract — it is to **make the reasoning legible so future engineers can debug the decision when reality moves**. Decisions are bets; the ADR is the receipt.
>
> **Pick a recommendation.** A Staff+ engineer's ADR ends with a chosen option and a defensible reason, not a "depends on your needs" shrug. If the constraints genuinely don't differentiate the options, that's itself a decision — name the cheapest reversible one and say why. Refusing to recommend is not neutrality; it's pushing the work onto whoever reads the ADR next.
>
> **One decision per invocation.** Drive the ADR to a complete document, then stop. If the user surfaces a second decision mid-thread, finish the current ADR and open a fresh one for the second — bundling two decisions into one ADR makes both harder to revisit later.
>
> **Don't save the file without permission.** The ADR is rendered in chat. Writing to `docs/adr/NNNN-<slug>.md` happens only on `save it`, `commit it`, `write it`, or similar.

## Scope

**In scope:** documenting a **single architectural decision** with two or more explicit options that the user has identified. The analysis covers:

1. **Decision card** — the problem in one sentence, the constraints that bound the answer, the options on the table, the decision drivers (what actually matters), and the reversibility cost.
2. **Per-option analysis** — concrete description, honest trade-offs, behavior under a 10x stress test, hidden costs the marketing pages don't mention.
3. **Recommendation** — one option, with reasoning that ties back to the decision drivers, not to taste.
4. **2-year regret check** — what would make this decision look bad in retrospect, and what off-ramp exists if it does.
5. **Consequences** — what changes after this decision lands, what new work it creates, what's now out of scope.

**Out of scope:**

- **Implementation.** The ADR records the decision; it doesn't write the code. After the ADR is accepted, the implementation is a separate task (and possibly its own follow-up ADRs for sub-decisions).
- **Decisions without options.** "How should I structure this code?" is not an ADR — it's a design discussion. Ask the user for the options they're choosing between before continuing.
- **Decisions that don't matter for two years.** ADRs exist because architecture is sticky. A reversible tactical pick (which test runner to use, which lint rule to adopt) usually doesn't need this manual — surface that and ask whether they want an ADR or just a recommendation.
- **Decisions someone has already made.** If the user walks in with the decision and wants the document to justify it, this manual is overhead — ask whether they want the analysis or just the write-up.

## Workflow

Run these steps on the **first** invocation, and again on every resume when the user says `re-do`, `revise`, `new ADR`, `next decision`, or similar.

1. **Build the decision card.** Distill the user's question into this canonical form. Fields marked `*` are required — if any are missing **and** the conversation doesn't supply them, stop and ask once. Do not invent business context.

   - **Problem\*** — what decision needs to be made, in one sentence. "Choose a queue technology for the order-processing pipeline" beats "we need a queue."
   - **Constraints\*** — the non-negotiables that bound the answer. Things like latency SLO, throughput target, team size, existing infrastructure, budget envelope, regulatory requirements, language / runtime, on-call rotation. List the ones that apply; an empty constraints list means the decision is unconstrained, which usually means the user hasn't surfaced the constraints yet — push back before continuing.
   - **Options\*** — at least two explicit options the user is choosing between. If they walk in with one option ("should we adopt X?"), ask what the alternative is — "don't adopt X" is the second option, and an ADR with only that comparison is a different shape than an ADR comparing X to Y.
   - **Decision drivers** — what actually matters for picking. Usually 3–6 of: operational simplicity, scaling headroom, team familiarity, cost, latency, durability guarantees, ecosystem maturity, migration cost, vendor lock-in, security / compliance surface area. Rank them — a tied driver list lets every option win for some driver, which is how ADRs end inconclusively.
   - **Reversibility** — how expensive is it to change this decision later? Use Bezos's two-door framing: **one-way door** (irreversible or extremely expensive — schema choices, data-store choices, identity / auth model) vs. **two-way door** (cheap to undo — library choice in one service, deploy tooling, framework within one app). The reversibility cost sets the depth of the analysis — one-way doors get the full treatment; two-way doors can sometimes be answered with "try one for a month."

2. **Describe each option concretely.** For every option, write **what it actually is** in 2–4 sentences. Not the marketing description, not the wiki summary. Include:
   - The shape of the system if this option lands (which services, which data stores, which protocols, which boundaries).
   - The dependency on the option (a vendor, a library, a paradigm, an internal team).
   - The **default** mode of operation the user will actually run in production — not the demo-mode configuration.

   If you cannot describe the option concretely, you don't understand it well enough to analyze it. Stop and read documentation, or ask the user for the deployment specifics, before proceeding.

3. **Trade-offs: pros and cons per option.** For each option, list real pros and real cons — five-ish of each, no fewer than three. Rules:

   - **Concrete, not generic.** "Faster" is not a pro. "Median write latency drops from ~25ms to ~3ms based on the vendor's published benchmarks at our throughput" is a pro. "More complex" is not a con. "Operating Kafka requires running ZooKeeper / KRaft, a broker tier, and a schema registry — three more systems on call has to know" is a con.
   - **Tie each item to a decision driver.** A pro that doesn't map to a decision driver is interesting but not load-bearing. A con that doesn't map to a driver is just a complaint.
   - **No paired clichés.** "Pro: lots of community; Con: lots of opinions" is filler. Drop both.
   - **Be specific about who pays each cost.** "The platform team absorbs the upgrade pain every 6 months" beats "ongoing maintenance."

4. **Run the 10x stress test on each option.** For each option, apply the questions in [§ 2 The 10x stress test](./reference.md#2-the-10x-stress-test) — 10x users, 10x writes, 10x partner integrations, 10x team, 10x compressed latency budget. For each option, name **the first thing that breaks** at 10x and what the fix looks like.

   - "Scales linearly" is not an answer. Name a specific bottleneck (the leader is the write bottleneck; the shared schema becomes a coordination point; the per-tenant cache exceeds the memory ceiling on the largest node).
   - If the first breakage point is **further than 10x away**, say so — that's the option's scaling story and it's a real pro.
   - If the first breakage point is **closer than 10x**, that's a load-bearing con and it must show up in the recommendation reasoning, not just the trade-off list.

5. **Inventory hidden costs.** For each option, walk [§ 3 Hidden costs cheat sheet](./reference.md#3-hidden-costs-cheat-sheet). These are the costs that don't appear in the vendor's pricing page, the README, or the architecture diagram. Name **at least three** per option. The most common ones to surface:

   - **Operational tax** — what new alerts / runbooks / on-call expertise this adds.
   - **Vendor or library risk** — pricing changes at scale, license changes, project velocity, single-maintainer dependencies, support quality at 3 a.m.
   - **Hiring cost** — how rare is the skill, how long is the on-ramp for a new engineer, how unusual is it on resumes.
   - **Cognitive load** — how much context a developer needs to be productive, how much hidden behavior the abstraction has, how surprising the failure modes are.
   - **Migration / exit cost** — how the data gets out, what's stuck in this option's shape forever, what we'd lose to leave.

6. **Make the recommendation.** Pick **one** option. Write the reasoning in 2–4 sentences. The reasoning ties back to the decision drivers (Step 1) and to specific trade-offs (Step 3) and hidden costs (Step 5) — not to taste, brand, or popularity. Rules:

   - **Name the dominant driver.** "Driver #1 is operational simplicity for a 3-person team; Option B wins on that driver and is acceptable on every other; therefore B."
   - **Acknowledge what the recommendation gives up.** "B loses on raw throughput; we accept that because we are nowhere near the throughput envelope it can't handle (see § 10x check)."
   - **No false balance.** If the analysis points clearly to one option, recommend it clearly. "It depends" is not a Staff+ recommendation.
   - **If the options are genuinely tied**, recommend the more reversible one ("two-way door over one-way door") and say so explicitly.

7. **Run the 2-year regret check.** For the recommended option, write the answer to two questions:

   - **What would make this look like a mistake in 24 months?** Concrete scenarios: the vendor jacks pricing 3x, the workload shifts from read-heavy to write-heavy, the team triples and the on-ramp tax compounds, a regulatory change forces data residency. Name 2–4 scenarios that would force a re-decision.
   - **What's the off-ramp if we're wrong?** Concrete migration path: dual-write to a new store, a versioned API behind a façade, a feature-flagged second implementation. If there is no off-ramp — if this is a one-way door with no escape — say so and reconsider the recommendation. **A one-way door with no off-ramp is the highest-stakes ADR shape; treat the reasoning as more conservative.**

   This section is the most important one for the future-engineer-on-call reader. It's also the most often skipped. Don't skip it.

8. **State consequences.** For the recommended option:

   - **What changes** — new services, new runbooks, new on-call expertise, new build / deploy steps, new dashboards.
   - **What new work this creates** — migration tasks, training, retiring the old thing, follow-up ADRs.
   - **What's now out of scope** — capabilities we are explicitly **not** building because of this decision, paths we are explicitly not taking. This is the part that prevents scope creep in the next quarter.
   - **What we accept** — the cons we agreed to live with. Restate them so a future reader knows they were seen, not missed.

9. **Render the ADR.** Format per [§ 1 ADR output format](./reference.md#1-adr-output-format). Post the full ADR in chat inside a fenced code block so the user can copy it. **Do not write the file** unless the user already authorized saving.

10. **Offer to save.** After the ADR is rendered, offer to save it to the repo as `docs/adr/NNNN-<slug>.md` — propose the directory (detect from existing files; default `docs/adr/` if none), the next sequential number (highest existing ADR number + 1, zero-padded to four digits, or `0001` for the first), and the slug (kebab-cased, ≤ 6 words, derived from the title). Save only when the user replies `save it`, `commit it`, `write it`, or similar.

11. **Stop.** Wait for the user. They will either approve and save, push back on the recommendation, or ask for a different option to be added. Revise the ADR rather than starting over — the analysis from earlier steps is reusable.

---

## Reference

The ADR output format, the 10x stress test, the hidden-costs cheat sheet, the 2-year regret check, and the anti-patterns live in [reference.md](./reference.md). Pull it in at the workflow steps that point there.
