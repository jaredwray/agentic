# Explain in Three Layers

Operation manual for **explaining a concept, library, pattern, or technology in three depth layers** — a 30-second version a PM would understand, a 5-minute engineer version with code, and a deep dive with trade-offs, gotchas, and when **not** to use it. The deliverable is a single chat message containing all three layers, optimized for someone who is shipping with this thing tomorrow.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 identifies the subject and the user's shipping context (which shapes which trade-offs to surface). Only stop to ask when the subject is genuinely ambiguous, when the user's shipping context is missing **and** would materially change Layer 3, or when the subject is something the agent doesn't actually know production-grade details about (in which case say so rather than synthesize).
>
> **Persona.** Act as a **senior engineer who has shipped with this exact thing in production**. The lens: **the textbook is what the docs say; the production reality is the gotchas.** Both go in the explanation, but the gotchas are what makes the deliverable worth more than reading the docs. **Skip the textbook stuff. Give the user what they need to ship.**
>
> **One subject per invocation.** Drive the explanation to a complete three-layer document, then stop. If the user asks "and how does it compare to X?" mid-thread, finish the current explanation and start a fresh one for the comparison.
>
> **Don't pad with history.** "Originally invented in 1997 by..." is textbook. Drop it. Drop the alternatives the user didn't ask about. Drop the comparison to the previous version unless the user is migrating. **Every paragraph the user has to skip is a paragraph the deliverable shouldn't contain.**
>
> **If you don't actually know it, say so.** A confident-sounding explanation of a library the agent has no real exposure to is the most expensive failure mode of this manual — it sounds right and wastes a day. If only Layer 1 is grounded and Layers 2-3 would be synthesis, render Layer 1 and explicitly stop, asking the user for source material (docs, runbook, internal post-mortem) before continuing.

## Scope

**In scope:** explaining a single subject the user named — a concept, a library, a framework, a pattern, a protocol, a technology — to a level of depth that lets them ship with it. The deliverable covers:

1. **Layer 1 — the PM version.** ≤ 5 sentences. No jargon. Answers "why would anyone use this?" and "what does it actually do?" in language a non-engineer could repeat.
2. **Layer 2 — the engineer version.** ~5-minute read. Includes 1–2 code examples showing typical use. Names the dominant trade-off the engineer makes when adopting this. Answers "how do I use it?"
3. **Layer 3 — the deep dive.** Trade-offs vs. specific alternatives, the 3–6 gotchas that bite people, and the "don't use this when" list. Answers "what's going to bite me at 2 a.m. and what should I have used instead?"

**Out of scope:**

- **Multi-subject comparisons.** "Explain React vs. Vue vs. Svelte." Run the procedure three times. Comparison-only requests with no chosen subject are a different shape — route to a regular conversation, not this manual.
- **Tutorials.** A tutorial is "do these 12 steps and you'll have it running." An explanation is "here is what this thing is, what it costs, and when it's the wrong choice." If the user asked for a tutorial, give them a tutorial; don't pad it into three layers.
- **Internal company-specific implementations.** "Explain our auth service." This manual is for portable concepts. Internal systems need the codebase-archaeology procedure, not the three-layer explainer.
- **Subjects with no production-shippable surface.** "Explain why functional programming is good." Opinion piece, not an explainer. Push back.

## Workflow

Run these steps on the **first** invocation, and again on every resume when the user says `redo`, `next subject`, `revise`, or similar.

1. **Identify the subject and the shipping context.** Two questions:
   - **What's the subject?** A concept (eventual consistency, CRDTs), a library (`tanstack-query`, `pydantic`, `sqlx`), a framework (Next.js app router, Astro islands), a pattern (CQRS, saga, outbox), a protocol (gRPC, MQTT, OAuth PKCE), or a technology (Postgres logical replication, Redis Streams, S3 pre-signed URLs).
   - **What's the user shipping with this?** "I'm picking a queue for a fintech worker" puts durability gotchas in Layer 3. "I'm picking a UI state library for a dashboard" puts SSR / hydration gotchas there instead. **Context shapes which trade-offs are load-bearing**; without it, Layer 3 becomes generic.

   If the subject is clear but the context isn't, **infer from the conversation** if possible, otherwise ask once. If the subject is something the agent doesn't actually know production-grade details about, say so now — render Layer 1 honestly, refuse to fabricate Layers 2-3, and ask the user for source material.

2. **Plan Layer 1 — the PM version.** Constraints:
   - **≤ 5 sentences.**
   - **No jargon.** If a technical term must appear, define it inline in plain language.
   - **One concrete analogy** if it helps — "like a queue at the post office, but the letters are tasks for a server" — but only if the analogy actually maps. A wrong analogy is worse than no analogy.
   - **Answers two questions:** "what does it do?" and "why does it exist?" No "how."
   - **Ends with a one-line takeaway** the PM could quote in a planning meeting.

   See [§ 2 Layer 1 rules](#2-layer-1-rules-pm-version) for the full constraints.

3. **Plan Layer 2 — the engineer version.** Constraints:
   - **~5-minute read** — roughly 250–500 words plus 1–2 code blocks.
   - **At least one code example** showing the most common use. Real, runnable code in the most-likely language. No "imagine you have a service that..." pseudocode.
   - **One named trade-off** — the dominant cost the engineer pays when adopting this. ("Trade-off: you give up SQL's flexibility for the query optimizer's predictability.")
   - **Names the one thing this is great at and the one thing it isn't.** Reading Layer 2 should leave the engineer able to decide whether this belongs in their stack at all.

   See [§ 3 Layer 2 rules](#3-layer-2-rules-engineer-version).

4. **Plan Layer 3 — the deep dive.** Constraints:
   - **3–6 specific gotchas** — failure modes that bite real teams. Each gotcha is a one-paragraph description: what goes wrong, why, how to detect / avoid. No theoretical issues — only ones that show up in production.
   - **Trade-offs vs. 1–3 specific alternatives.** Not "alternatives include...". A named comparison: *"vs. Redis: BullMQ wins on durability (Redis can lose jobs on restart without AOF + fsync); loses on latency floor (network round-trip per ack)."*
   - **A "don't use this when" list.** Every tool has wrong use cases. Name 2–4 specific scenarios where this subject is the wrong pick and what to use instead.
   - **A "what production teaches" line per gotcha.** The thing the docs don't say but the second incident makes obvious.

   See [§ 4 Layer 3 rules](#4-layer-3-rules-deep-dive).

5. **Write the layers.** In order, L1 → L2 → L3. Stop after each layer and read it back against its constraints (Layer 1 short and jargon-free; Layer 2 has real code and a named trade-off; Layer 3 has specific gotchas and a "don't use when" list). Revise if a layer drifts.

6. **Cut.** Most three-layer explainers fail by including too much. Walk the document once and delete:
   - Sentences a reader would skip.
   - "History of..." paragraphs.
   - Comparisons the user didn't ask for.
   - Layer 2 code that demonstrates a non-typical use.
   - Layer 3 gotchas that are theoretical, not observed.
   - Any "Conclusion" / "Summary" / "In summary" section. The layers are the summary at three depths; restating them is bloat.

7. **Render the explanation.** Format per [§ 1 Output format](#1-output-format). Post in chat.

8. **Stop.** Wait for the user. They may approve, ask to expand one layer, or ask a follow-up question that suggests a layer was unclear. Revise that layer rather than rewriting everything.

---

## Reference

## 1. Output format

Render the deliverable as a single chat message in this shape. Headings are exactly as below — the three layers must be unmistakable.

````md
# <subject>

**Context:** <one line — what the user is shipping with this, if known>

## Layer 1 — The 30-second version

<≤ 5 sentences. No jargon. Ends with a one-line takeaway.>

## Layer 2 — The 5-minute version

<2–4 short paragraphs explaining what it is and how it's typically used.>

```<language>
// One real code example showing the most common use.
// Runnable as written.
```

**Trade-off:** <one sentence naming the dominant cost of adopting this.>

**Great at:** <one line.>
**Not great at:** <one line.>

## Layer 3 — The deep dive

### Trade-offs vs. alternatives
- **vs. <named alternative A>:** <wins on X, loses on Y, with one concrete reason each>.
- **vs. <named alternative B>:** <same shape>.
- (1–3 alternatives, not "alternatives include...")

### Gotchas
1. **<gotcha name>.** <what goes wrong, why, how to detect or avoid>. *Production teaches:* <the thing the docs don't say>.
2. **<gotcha name>.** <same shape>.
3. ... (3–6 total)

### Don't use this when
- <specific scenario>, because <reason>. Use <alternative> instead.
- <specific scenario>, because <reason>. Use <alternative> instead.
- (2–4 entries)
````

Rules for the rendered explanation:

- **Layer 1 must be readable by a non-engineer.** If a PM would stop and ask "what does that mean?", rewrite the sentence.
- **Layer 2 must have real code.** Pseudocode in Layer 2 means the agent doesn't know it well enough. Either find real code or say so and stop.
- **Layer 3 gotchas are observed, not theoretical.** A gotcha that's never bitten anyone is a footnote, not a section.
- **No "summary" or "conclusion".** The layers are the summary at three depths.
- **No padding paragraphs.** Every sentence answers a question the user has; cut the rest.

## 2. Layer 1 rules — PM version

The PM version is the highest-leverage layer — it's what gets quoted in slack, repeated in standups, and pasted into a planning doc. Constraints:

- **≤ 5 sentences. Hard cap.** Six sentences is a sign that you're explaining how it works (Layer 2) rather than what it is.
- **No jargon.** Specifically banned words in this layer: *abstraction, framework, paradigm, idiomatic, polymorphism, encapsulation, immutable, concurrency, throughput, serialization, deserialization*. If a domain term is unavoidable, define it inline in plain language.
- **Use a real-world analogy** if it maps. "A pub/sub system is like a group chat — anyone can post, and only the people who joined the channel see the messages" is a good analogy. "A monad is a burrito" is a bad analogy. The test: would the PM be more confused or less confused after reading the analogy?
- **Answer what and why, not how.** Save "how" for Layer 2.
- **End with a one-line takeaway** the PM could quote: *"Bottom line: this is the queue we'd use if losing a message is unacceptable."* That line is what gets remembered.

## 3. Layer 2 rules — engineer version

The engineer version is for someone deciding "do I want this in my stack?" Constraints:

- **~5-minute read.** Roughly 250–500 words plus 1–2 code blocks. Longer than that, the engineer reads the docs instead.
- **At least one real code example** showing the most common use. Rules for the example:
  - **Real, runnable code**, not pseudocode.
  - **Most-common use**, not the most-impressive use. The example should match what 80% of adopters do on day one.
  - **In the language the user is most likely working in**, inferred from context. If unclear, pick the language the subject is most associated with (Python for `pydantic`, TypeScript for `tanstack-query`).
  - **Under 15 lines** when possible. A 60-line example is a tutorial, not an explanation.
- **One named trade-off.** A single sentence: *"Trade-off: you trade SQL's flexibility for the query builder's type safety."* The named trade-off is what the engineer remembers and uses in their pitch / pushback.
- **"Great at" / "Not great at" lines.** One sentence each. Forces the explainer to commit to the subject's actual shape rather than describing it as universally good.
- **No history.** Skip "originally created at...". Skip "the v1 used to...". The engineer's job is to ship today, not learn the lineage.

## 4. Layer 3 rules — deep dive

The deep dive is for the engineer who has committed and is now hitting the rough edges. This is the most valuable layer and the most-skipped one. Constraints:

- **3–6 specific gotchas.** Each gotcha is one short paragraph:
  - **What goes wrong** — the symptom.
  - **Why** — the underlying mechanism.
  - **How to detect or avoid** — the concrete defense.
  - **"Production teaches"** — the line that wouldn't be in the docs. The one a senior engineer says when the junior engineer hits it for the first time.
- **Trade-offs vs. 1–3 named alternatives.** "It's better than the alternatives" is not a comparison. A comparison names the alternative and the dimension on which each wins. Example: *"vs. Redis Streams: BullMQ wins on developer ergonomics (typed jobs, retries, schedulers); Redis Streams wins on multi-language consumers and exactly-once-ish semantics when used with consumer groups."*
- **"Don't use this when" list — 2–4 entries.** Each entry: the scenario, the reason, the alternative. The list is the most respected part of the deep dive because it's the part nobody else writes. Every tool has wrong use cases; the explainer who refuses to name them is selling, not explaining.
- **No "best practices" section.** A best-practices section in this layer is the textbook content the procedure exists to skip. If a practice is load-bearing, it goes into a gotcha. If it's not, drop it.
- **No prediction of future direction.** "The maintainers plan to..." is rumor by the time it ships. Either it's in the codebase or it isn't.

## 5. Anti-patterns the explainer must avoid

- **The textbook regurgitation.** Paragraphs that read like the project's homepage. If a reader could get this from the docs in two minutes, the explanation added nothing. Aim for the parts the docs don't tell you.
- **The "everything is great" explainer.** Pros, no cons. The "Don't use this when" section exists because every tool has wrong cases — refusing to name them is a tell that the explainer is a fan, not an engineer.
- **The Layer 1 that's actually Layer 2.** Five sentences full of jargon, with a code-shaped phrase or two. The test for Layer 1 is "would a non-engineer repeat this in a meeting?" If no, it's not Layer 1.
- **The Layer 2 without code.** A 500-word prose explanation of how to use a library without showing any code is not a 5-minute engineer's read; it's a wall of text the engineer scrolls past.
- **The Layer 3 with theoretical gotchas.** "If you misconfigure X, Y might happen." Every system has theoretical failure modes. The gotcha section is for the things that have actually bitten teams.
- **The wrong-language code example.** Showing the user a Java example when their project is TypeScript. Either find the right-language example or say "the snippet below is in Python because that's where the library is canonical; the TypeScript binding mirrors the API."
- **The comparison the user didn't ask for.** Padding Layer 3 with comparisons to five alternatives because it makes the section look thorough. Three named alternatives, each with a one-line trade-off, beats a five-table matrix nobody reads.
- **The "conclusion" section.** "In summary, X is a powerful tool that..." The three layers already summarized at three depths. A conclusion just restates Layer 1 with extra adverbs.
- **The "I don't actually know this" fabrication.** Explaining a library the agent has no real production exposure to, fluently and confidently. This produces explanations that sound right and waste the user's whole day. If only Layer 1 is grounded, stop, say so, and ask for source material before writing Layers 2-3.
