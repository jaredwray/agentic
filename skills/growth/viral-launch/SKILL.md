---
name: viral-launch
description: Build a viral product launch via a fixed 21-agent pipeline — market research, positioning, hook, body, line-by-line adversarial rewrite, and a paper trail — producing an editable launch package, not a one-shot post. Use when asked to write a product launch, a Show HN, Product Hunt, or Twitter launch, or viral launch copy. Manual; runs an expensive multi-agent pipeline to completion.
disable-model-invocation: true
user-invocable: true
---

# Viral Launch

Operation manual for building a **viral product launch** — research, positioning, hook, body, and final script — via a 21-agent pipeline that researches the market, writes the launch, attacks every line, and ships a paper trail. The deliverable is a launch package the human can edit in the final 5%, not a "write me a launch post" one-shot.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 collects the brand brief (the only required input) and detects the launch channel. Every other phase runs without prompting until the agent hits a designated stop-and-report point.
>
> **Claude is not allowed to "just write the launch."** That is how you get AI slop. Every piece of the launch — angle, hook, body, every individual line — must pass through a worker → manager → rewrite loop. A line that no manager would defend does not survive into the final draft.
>
> **The pipeline has 21 named agents and runs in a fixed order.** They are listed in [§ The 21 agents](#the-21-agents) and mapped to workflow steps. Skip none. If a step has no signal (e.g. no Reddit presence for the category), the agent still reports the empty result — silence is not a pass.
>
> **One launch per invocation.** Drive the pipeline to a complete `final.md` and paper trail, then stop. Resume only when the user says `next launch`, `re-run`, `revise`, or similar.
>
> **The human owns the final 5%.** Claude does the depth of work no human team would realistically do every time — hundreds of angles, dozens of hook rewrites, line-by-line attacks. The human edits the final pass for taste. Surface every iteration so the human can pull from the rejected versions if they prefer one.

## Scope and summary

**Scope:** producing the launch content for a product moment — a feature, a fundraise, a new product, a rebrand, a milestone. The agent produces:

1. A **brand brief** (intake distilled into a single page).
2. A **research dossier** (YouTube, X/Twitter, Reddit, and industry signal on the category, plus a synthesis).
3. A **hook** with all iterations and the rationale for the chosen one.
4. A **giveaway** mechanic (if the launch includes one — most viral launches do).
5. A **body / script** — the demo-driven narrative that proves the hook.
6. The **weapons-check log** showing every line scored on invention novelty and copy intensity, with cuts and rewrites.
7. A **Mom-Test pass** that flags anything a non-technical mass-market viewer would not understand.
8. A **final.md** the human edits, plus the full paper trail in `paper-trail/`.

**Out of scope:** running the launch itself (posting to X, uploading to YouTube, sending the email blast), paid amplification setup, influencer outreach lists, legal review of claims, and producing the actual video edit. The deliverable is the **script and copy** — production happens after.

## Launch context

Detect in Step 1. Three dimensions determine which agents emphasize which signals:

- **Product type** — B2B SaaS, consumer software, consumer hardware, marketplace, agency / service, creator product, open-source project, dev tool, AI product. The body specialists weight differently (a dev tool needs the Technical Specialist to bite hard; a consumer hardware launch leans on the Weapons Specialist to make the object feel iconic).
- **Launch channel and format** — X/Twitter thread, LinkedIn post, TikTok / Instagram Reels script, YouTube video script, founder-led launch video (60–90s), Product Hunt, blog post, email blast. Channel drives length, hook style, and which agents matter most (TikTok = Mom Test is the gate; Product Hunt = the body has to convert in the first paragraph).
- **Launch type** — new product, new feature, fundraise, rebrand, milestone, integration, partnership. Determines what the hook can claim (a fundraise hook that pretends to be a product launch fails the Weapons Specialist).

If the brand brief is missing essential intake (no product description, no target audience, no channel chosen), stop and report — do not invent the inputs.

## The 21 agents

Run in order. Numbers are canonical — every output references the agent by number for the paper trail.

| #   | Agent                  | Role                                                                                     |
| --- | ---------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Brand Brief            | Distills user-provided intake into a single-page brief.                                  |
| 2   | Keywords               | Extracts the 5–15 keywords / search terms / category labels that define the space.       |
| 3   | YouTube Research       | What's gone viral on YouTube in this category — titles, thumbnails, hooks, formats.      |
| 4   | X/Twitter Research     | What launch posts and threads got traction. Patterns in opening lines, claims, replies.  |
| 5   | Reddit Research        | Customer language. What people complain about, ask for, mock. The verbatim phrasing.     |
| 6   | Industry Research      | Category, competitors, founder story, the existing positioning landscape.                |
| 7   | Research Compiler      | Synthesizes 1–6 into a single dossier. Surfaces the strongest angle.                     |
| 8   | Hook Writer            | Drafts 10+ hook candidates from the dossier.                                             |
| 9   | Hook Manager           | Scores every hook against the three-question test. Rejects, demands rewrites, picks one. |
| 10  | Giveaway Writer        | Drafts the giveaway mechanic (if applicable) — what's given, how to win, deadline.       |
| 11  | Giveaway Manager       | Pressure-tests the giveaway for clarity, virality, and legal/ToS risk.                   |
| 12  | Body Writer            | Drafts the body / script that proves the hook. Demo-driven narrative.                    |
| 13  | Weapons Specialist     | Scores every line on **invention novelty** and **copy intensity**. Cuts filler.          |
| 14  | Controversy Specialist | Finds the contrarian/spiky angle. Strong launches have a take, not a description.        |
| 15  | Technical Specialist   | Audits every product claim. No claim survives without evidence in the dossier.           |
| 16  | Flow Specialist        | Audits narrative pacing — open, escalation, demo moment, payoff. Cuts dead beats.        |
| 17  | Body Manager           | Reconciles 13–16. Drives rewrites until all four specialists clear the body.             |
| 18  | Mom Test               | Reads the final draft as a 61-year-old who only uses Facebook. Flags every unclear line. |
| 19  | Call Supervisor        | Audits the CTA. One ask, specific, time-bound, frictionless. No "learn more."            |
| 20  | Final Review           | End-to-end pass. Does the launch deliver on the hook? Is anything missing?               |
| 21  | Deliver                | Assembles `final.md` plus the `paper-trail/` directory. Surfaces the human edit list.    |

Agents 9, 11, 17, 19, 20 are **Manager-class** — their job is to attack the work of the writer agents and force rewrites. The Manager pattern is in [§ 7](#7-the-manager-pattern).

## Workflow

Run on first invocation and again on every resume.

1. **Collect the brand brief and detect launch context.** Agent 1 produces a one-page brief from the user's intake. Required fields:
   - **Product:** one sentence describing what the product does — in plain English, not marketing copy.
   - **Audience:** who buys / uses it (one sentence each for primary and secondary).
   - **Launch moment:** what's actually shipping (new product / feature / fundraise / milestone / rebrand) and the on-sale or live date.
   - **Channel and format:** where it's going (X thread, TikTok script, founder video, etc.) and rough length.
   - **Stakes:** what would make this launch a hit vs. a flop, in the user's own words.
   - **Constraints:** legal, brand voice, things that must not be claimed, things that must appear.
   - **Founder / brand voice:** 3–10 verbatim quotes from the founder (prior threads, interviews, podcasts, internal docs) that capture the voice the launch must sound like. Without this, the body will sound like a homepage even after weapons check. If no quotes exist, ask once — do not synthesize a fake voice.
   - **Assets available:** demo footage, screenshots, founder quotes, customer quotes, data points. Note which ones are *ready to ship* vs. *needs production*.
   - **Live URLs:** the destination the CTA points at (landing page, sign-up form, App Store link). Required — a launch with no live URL has no CTA.

   If any required field is missing, stop and ask **once**, with the missing fields enumerated. Do not invent.

   Once the brief is complete, **create the dated subdirectory** per [Output rules](#output-rules) — `launch/<YYYY-MM-DD>-<slug>/` plus `launch/<YYYY-MM-DD>-<slug>/paper-trail/`. Every `paper-trail/...` path in the steps below is relative to this subdirectory; resolving them at the repo root would clobber prior launches. Save the brief itself to `paper-trail/01-brief.md`.

2. **Run the keyword pass (Agent 2).** Extract 5–15 keywords / category terms / search phrases that the rest of the research pipeline will use. Save to `paper-trail/02-keywords.md`.

3. **Run research in parallel (Agents 3–6).** Spawn the four research agents concurrently — they have no dependencies on each other.
   - **3 YouTube** — search the keywords. Pull titles, hook patterns, thumbnail patterns, video lengths, top comments. What format gets views in this category?
   - **4 X/Twitter** — search recent launches in the category. Capture the opening line of every thread that broke 100k impressions. Note what people *quoted* in the replies — that's the line that worked.
   - **5 Reddit** — search the subreddits the audience lives in. Capture verbatim phrasing — "X is so painful," "I'd kill for a tool that…", "Why does no one make…". This is the customer language Agent 8 will draw from.
   - **6 Industry** — competitive landscape, category history, the founder's prior work, any prior coverage. The context the launch is landing into.

   Each agent writes a brief report to `paper-trail/0<n>-<name>.md`. If a research source has no signal (e.g. no Reddit activity), the agent reports that explicitly. No empty files.

4. **Compile the research (Agent 7).** Agent 7 reads all four research reports and produces a **research dossier** (`paper-trail/07-dossier.md`) with:
   - **The strongest angle** — what makes the product feel novel, urgent, obvious, or inevitable. One sentence, not three options.
   - **The runner-up angles** — two more, in case Agent 9 rejects the first.
   - **The customer-language list** — 10–20 verbatim phrases the audience uses, lifted from Reddit/X. The hook and body will be built from these, not from invented copy.
   - **The viral-pattern list** — what's worked in this category. Title formats, opening lines, demo structures.
   - **Dead phrases to avoid** — the generic SaaS/B2B language Agent 9 will reject on sight. ("Built a platform," "help teams save time," "streamline workflows," "powerful," "seamless," "intelligent," "built for modern teams.")
   - **Research confidence** — `high` / `medium` / `low`, scored by how many of Agents 3–6 returned real signal. If **three or more sources returned empty** (common for niche B2B, stealth-mode products, or invented categories), mark confidence `low`, lift the customer-language quota from the brief's stated voice quotes + founder-supplied references, and surface a warning in `paper-trail/07-dossier.md` so the human knows the hook is leaning on the brief rather than the market.

5. **Write and harden the hook (Agents 8–9).**
   - **Agent 8 Hook Writer** drafts at least **10 hook candidates** from the dossier. Each candidate is one to two sentences.
   - **Agent 9 Hook Manager** scores every candidate against the **three-question test** ([§ 2](#2-the-hook-must-answer-three-questions)). Hooks that fail any question get rejected with a written reason. Hooks that pass are scored on invention novelty + copy intensity ([§ 4](#4-the-weapons-check)).
   - If no candidate scores high enough, Agent 9 sends Agent 8 back with specific direction — "lean harder into the contrarian framing from the dossier," "drop the feature list, lead with the outcome," etc. **Maximum 4 rewrite rounds.** If round 4 still fails, surface the best version with a written note about why nothing landed cleanly — do not stall the pipeline.
   - Save every iteration to `paper-trail/08-hooks.md`. The final chosen hook goes to `paper-trail/09-hook-final.md` with the rationale.

6. **Write and harden the giveaway (Agents 10–11).** Skip this step only if the brand brief explicitly says "no giveaway." Most viral launches include one — a giveaway converts attention into list-building and reply-volume, which the algorithms reward.
   - **Agent 10 Giveaway Writer** drafts the mechanic: what's given, who can win, how to enter (follow + repost + tag is the default for X; comment + tag for TikTok / IG), deadline, when winners are announced.
   - **Agent 11 Giveaway Manager** pressure-tests it: is the prize actually desirable to the audience (not just to the founder)? Is the mechanic clear in one read? Does it violate platform ToS (X and Meta both restrict "tag a friend" mechanics — verify against current rules)? Is there a legal-disclaimer line where required?
   - Save to `paper-trail/10-giveaway.md`.

7. **Write the body (Agent 12).** Agent 12 writes the body / script that proves the hook. **Demo-driven narrative.** The body has one job: make the claim feel real.
   - Show the product. Show the before state. Show the new behavior. Show the moment where the viewer understands why this matters.
   - **Match the founder voice from the brief.** Re-read the founder quotes before drafting. Sentence length, vocabulary, the cadence of clauses, the things the founder *won't* say — all of it has to feel like the founder, not like a copywriter writing in the founder's general direction. A line that's sharp and in-voice beats a line that's sharper and off-voice.
   - Length is set by the channel (a 60s founder video is ~150 words spoken; an X thread is 6–10 posts; a Product Hunt body is one tight paragraph plus bullets).
   - Save the first draft to `paper-trail/12-body-v1.md`.

8. **Run the four body specialists (Agents 13–16).** These run **in parallel** against the v1 body and each produces a critique report. None of them rewrites — they call out lines.
   - **13 Weapons Specialist** — scores every line on **invention novelty** (does this line make the product feel like something new exists in the world?) and **copy intensity** (is the line sharp enough that someone actually feels something when they read it?). Marks every line as **keep** / **rewrite** / **cut**. See [§ 4](#4-the-weapons-check).
   - **14 Controversy Specialist** — finds the contrarian/spiky angle. If the body sounds like every other company's announcement, this agent says so. Surfaces what the body could *say* that competitors *wouldn't*. The take, not the description.
   - **15 Technical Specialist** — audits every product claim against the dossier and brand brief. Any claim without evidence gets flagged. Any claim that overreaches what the product actually does gets flagged. The goal is not to make the launch boring — it's to make sure no claim collapses under five seconds of scrutiny.
   - **16 Flow Specialist** — audits pacing. Where is the viewer 10 seconds in? 30 seconds in? Is there a dead beat? Does the demo land before attention drops? Marks the points where the audience walks away.
   - Each specialist writes to `paper-trail/<n>-<name>.md` (i.e. `13-weapons.md`, `14-controversy.md`, `15-technical.md`, `16-flow.md`).

9. **Reconcile and rewrite the body (Agent 17 Body Manager).** Agent 17 reads all four specialist reports and drives the rewrite. Cut every line marked `cut` by Weapons. Rewrite every line marked `rewrite`. Address every contradiction the Controversy Specialist surfaced. Reconcile every overreach the Technical Specialist flagged. Restructure the beats the Flow Specialist marked as dead.
   - **Voice-fidelity check.** Before approving the round, Body Manager reads the draft side-by-side with the founder quotes in the brief. If the draft has become sharper but less in-voice, send back to Agent 12 with the specific lines that drifted. A weapons-clean body in the wrong voice is a fail.
   - **Maximum 3 rewrite rounds.** After each round, re-run the four specialists. If a line still doesn't pass after round 3, cut it and surface the cut in the paper trail — do not ship a line that no specialist would defend.
   - Save each round to `paper-trail/17-body-v2.md`, `…-v3.md`, etc. The final body goes to `paper-trail/17-body-final.md`.

10. **Run the Mom Test (Agent 18).** Agent 18 reads the entire script (hook + body + giveaway + CTA) as a 61-year-old who only uses Facebook. Every word that isn't immediately understandable to a non-technical mass-market viewer gets flagged. See [§ 5](#5-the-mom-test).
    - If the launch channel is mass-market (TikTok, Instagram, YouTube, founder video for press), **Mom Test is a hard gate**. Flagged terms must be rewritten in plain language before proceeding.
    - If the launch channel is technical (dev-tool X thread, Hacker News, technical Product Hunt), Mom Test runs but is advisory — the agent surfaces what would not land for a mass audience but does not force a rewrite. Some launches are deliberately insider-coded.
    - Save to `paper-trail/18-mom-test.md`.

11. **Audit the call (Agent 19 Call Supervisor).** Agent 19 verifies the CTA. **One ask, specific, time-bound, frictionless.** Reject any of: "learn more," "check it out," "DM me," "stay tuned," or two CTAs competing for attention. The CTA should be a single verb + a single destination + (where appropriate) a reason to act now.
    - Save the approved CTA to `paper-trail/19-cta.md`.

12. **Final review (Agent 20).** End-to-end read. Does the body deliver on the hook? Does every line still earn its place after the rewrites? Is anything missing — a date, a price, a URL, a credit, a disclaimer? Agent 20 writes a punch list, and the pipeline does one more rewrite pass to address it.
    - Save to `paper-trail/20-final-review.md`.

13. **Deliver (Agent 21).** Agent 21 assembles the deliverable into the dated subdirectory created per [Output rules](#output-rules) (e.g. `launch/2026-05-16-<slug>/`). All paths below are relative to that subdirectory — never the root `launch/` — so reruns never clobber prior artifacts.
    - **`final.md`** — the launch as it would ship. Hook, body, giveaway, CTA, in the format the channel requires.
    - **`paper-trail/`** — every numbered artifact from Steps 1–12, in order.
    - **`receipts.md`** — the evidence bundle Agent 15 demanded for every product claim: the screenshot path, the customer quote with source, the metric source, the demo timestamp. One bullet per claim in `final.md` that has factual content.
    - **`first-frame.md`** (video channels only — TikTok, Reels, YouTube, founder video) — the opening 3 seconds rendered explicitly: what's on screen, what's spoken, what's overlaid. For YouTube, also: the thumbnail concept (composition, text overlay ≤ 4 words, the single visual element that earns the click). The first frame and thumbnail carry as much weight as the hook itself; missing them is shipping a script without a movie.
    - **`HUMAN-EDIT.md`** — the **5% list**: the three to five places where Claude's judgment is least confident and a human's taste matters most. Specific lines, not "review the whole thing." Examples: "The hook works on paper but feels safe — try sharpening to: <alternative>." "Beat at 0:23 in the script feels expository — consider cutting." "Giveaway prize might underwhelm this audience — verify with founder."
    - **Pre-flight check** — before declaring delivery complete, Agent 21 verifies (a) every URL in the CTA and body resolves to a 200, (b) every asset referenced in the script exists and is in the assets list from the brief, (c) the live date in the brief is in the future. Any failure surfaces as a `🛑` line in `HUMAN-EDIT.md` — a viral hit landing on a 404 is the worst outcome the pipeline can produce.
    - Report to the user: the absolute path to `final.md`, the absolute path to `HUMAN-EDIT.md`, the pre-flight result, and a one-line readout of what the human should attack first.

14. **Stop and wait.** Do not iterate further. The pipeline's job is done.
    - **`revise`** — iterate on the existing launch. Agent 21 reads the user's specific direction, runs only the affected phases (e.g. "rewrite the hook" → Agents 8–9 only; "the body's third beat is weak" → Agents 12, 13–17 on that beat), and writes the new version into the **same dated subdirectory** with a `-rN` suffix (`final-r2.md`, `paper-trail/08-hooks-r2.md`). Do not create a new dated directory.
    - **`re-run`** — start over from scratch with new inputs (the user wants a different angle, channel, or framing). Agent 1 re-collects the brief and Step 1 creates a **new dated subdirectory** with a `-v2` suffix.
    - **`next launch`** — a different launch entirely. New brief, new slug, new dated subdirectory.
    - On any other input, stop and ask.

## Output rules

- Default output directory is **`launch/`** at the repo root (create it if missing). Each invocation creates a new dated subdirectory: `launch/2026-05-16-<slug>/`. The slug comes from the brand brief — a short kebab-case name for the launch.
- Inside the dated directory: `final.md`, `HUMAN-EDIT.md`, and `paper-trail/` with all 21 artifacts.
- **Never overwrite a previous launch directory.** If the user re-runs, create a new dated subdirectory with a `-v2` suffix.
- **Do not open a PR** unless the user asks. The launch artifacts are content, not code — they typically live in a private repo or get copied into a CMS. If the user wants a PR (e.g. for a docs site that publishes launches), follow the host repo's standard contribution flow.

---

## Reference

### 1. The brand brief intake (Agent 1)

Agent 1 distills user intake into a one-page brief. The brief is the single source of truth that every later agent reads.

If the user dumps a wall of context, Agent 1 condenses. If the user gives one line, Agent 1 asks for the missing fields — **once**, in a single message, with all gaps enumerated. Do not chain questions across multiple turns.

Required fields (see [Workflow](#workflow) Step 1). Optional but valuable fields: prior launches that worked, prior launches that flopped, the founder's voice (a few quotes the founder has said in interviews or threads), the team's reaction internally to the work being shipped (often the most honest summary of why it matters).

### 2. The hook must answer three questions

A strong launch hook instantly answers, in one to two sentences:

1. **What is being launched?**
2. **Why does it matter?**
3. **Why has this never existed before?**

If question 1 is missing, the viewer doesn't know what they're looking at. If question 2 is missing, they don't care. If question 3 is missing, the launch sounds like every other announcement — there's no reason to look up.

Hook Manager (Agent 9) rejects on sight:

- Anything starting with "Excited to announce…", "Thrilled to share…", "Proud to introduce…".
- "Help teams [verb] [noun]" constructions.
- Feature lists in the hook ("now with X, Y, and Z").
- Anything that could be cut-and-pasted onto a competitor's launch without anyone noticing.
- Anything that puts the company name first ("Acme is launching…") instead of the value first.

The hook earns its place by being **specific, contrarian, or genuinely new** — ideally all three.

### 3. Demo-driven narrative (Agent 12)

The body's job is to make the hook feel real. The default structure:

1. **Open** — restate the hook in the viewer's language. 5–10 seconds (video) or one line (text).
2. **Before** — what the world looks like without this product. Make the pain concrete with one specific scenario, not a list of generalizations.
3. **The shift** — what changed. The product exists. Show it.
4. **The demo moment** — the single beat where the viewer understands. One thing the product does that nothing else does. **This is the load-bearing moment of the entire launch.** Every other beat exists to set this up.
5. **The implication** — what becomes possible now. Don't list features. Show a behavior that wasn't possible before.
6. **The CTA** — see Agent 19.

The order is not negotiable for most launches. The demo moment can come earlier in shorter formats (TikTok hooks often *open* on the demo moment, then back-fill the before-state) — channel determines pacing, not story logic.

### 4. The weapons check

**The single most important pass.** Every line is scored on two axes:

- **Invention novelty (0–5)** — does this line make the product feel like something new exists in the world? A 0 is generic (could be on any company's homepage). A 5 is a sentence no competitor could write.
- **Copy intensity (0–5)** — is the line sharp enough that someone actually feels something when they read it? A 0 is flat ("the product is helpful"). A 5 is a sentence the viewer would quote.

**Decision rules:**

| Min(Novelty, Intensity) | Max(Novelty, Intensity) | Verdict     |
| ----------------------- | ----------------------- | ----------- |
| ≥ 3                     | any                     | **Keep**    |
| 2                       | ≥ 3                     | **Rewrite** |
| ≤ 1                     | any                     | **Cut**     |
| ≤ 2                     | ≤ 2                     | **Cut**     |

A line that is true and clear can still score 2/2 — that's the point. True and clear is not enough. **The final body should feel like every sentence survived a fight.**

The Weapons Specialist (Agent 13) writes a table for every line in the body. Body Manager (Agent 17) acts on it. No exceptions for "transition lines" or "framing lines" — if a line doesn't earn its place, it goes.

### 5. The Mom Test (Agent 18)

Read the entire script as a 61-year-old who only uses Facebook. Flag every word, phrase, or concept that this reader would not immediately understand.

Common Mom-Test failures:

- Acronyms (`API`, `SaaS`, `LLM`, `CRM`, `ICP`, `MQL`).
- Jargon (`workflow`, `stack`, `pipeline`, `orchestrate`, `embed`, `ship`).
- Insider phrasing (`founder-led`, `bottoms-up`, `PLG`, `Series A`).
- Compound abstractions (`AI-powered platform for…`, `agentic`, `composable`).
- Assumed industry context (referring to a competitor by name without explaining what they do; referring to a concept that requires reading a category report to understand).

**For mass-market channels (TikTok, Instagram, YouTube, founder video for press), this is a hard gate.** Every flagged term gets rewritten in plain language or removed.

For technical channels (Hacker News, dev-tool X threads, technical Product Hunt posts), Mom Test is advisory. Insider language is sometimes the *point* — but the agent still surfaces the trade-off so the human can choose.

### 6. The call (Agent 19)

**One ask. Specific. Time-bound. Frictionless.**

- One ask: not "follow + click + DM." Pick one.
- Specific: a URL, a deadline, a code. Not "learn more."
- Time-bound: "this week," "until Friday," "first 100 sign-ups." Urgency converts.
- Frictionless: the action takes ≤ 10 seconds. If the CTA is "book a demo," the funnel is too long for a viral moment.

Default CTAs by channel:

| Channel             | Default CTA                                                  |
| ------------------- | ------------------------------------------------------------ |
| X/Twitter thread    | `Reply <keyword> and I'll DM you the link.`                  |
| TikTok / Reels      | `Link in bio — first 500 get <thing>.`                       |
| Founder video       | `<URL> — open today.`                                        |
| Product Hunt        | `Upvote and try it free at <URL>.`                           |
| LinkedIn post       | `Comment "<keyword>" and I'll send the playbook.`            |
| Email blast         | `<single button: "Get early access">` — no second link.      |

Call Supervisor rejects: any CTA with two destinations, any CTA without a reason to act today, any CTA the audience has to interpret.

### 7. The Manager pattern

Manager agents (9, 11, 17, 19, 20) follow the same shape:

1. **Read the writer's output and the relevant dossier sections.**
2. **Score against the criteria** for that phase (three-question test, weapons check, Mom Test, CTA rules).
3. **If it passes, advance.** Write a one-paragraph defense — why this draft survives. The defense is in the paper trail; future managers can challenge it.
4. **If it fails, write a critique with specific direction.** Not "make it better." Concrete: "Hook 3 fails question 3 — there's no claim about what didn't exist. Try leading with the contrarian angle from dossier line 14."
5. **Send back to the writer.** Maximum rewrite rounds: **4 for hooks, 3 for body, 2 for giveaway, 2 for CTA.** If max is hit and the work still fails, surface the best available version with a written note. Do not block the pipeline — the human edits the final 5%.

Managers attack the work. They do not write the work. If a manager finds itself drafting copy, it has crossed a line — send back to the writer with the draft as direction, not as the answer.

### 8. Channel-specific output formats

The shape of `final.md` adapts to the launch channel.

- **X/Twitter thread** — numbered posts. Each ≤ 280 chars. Post 1 is the hook. The last post is the CTA. Posts 2–N walk the demo-driven narrative.
- **LinkedIn post** — one block, ≤ 1,300 chars (LinkedIn's cutoff before "see more"). Lead with the hook in the first two lines — that's what shows before the truncate.
- **TikTok / Reels script** — scene-by-scene. `[0:00–0:03] Visual: … / VO: …`. Total length 30–60s typical, 90s max.
- **Founder video (60–90s)** — single column. Visual cues in italics, spoken lines in plain text. Mark the demo moment explicitly: `// DEMO MOMENT //`.
- **Product Hunt launch** — title (≤ 60 chars), tagline (≤ 60 chars), description (2 paragraphs max), maker comment (the founder voice — this is where the hook and story live, not the description).
- **Blog post** — title, subhead, opening paragraph, body sections with H2s, conclusion + CTA. The opening paragraph is the hook expanded; do not bury it under a SEO intro.
- **Email blast** — subject line (≤ 50 chars, must contain a verb and a noun), preheader (≤ 90 chars), body (≤ 200 words), single CTA button.

If the channel isn't listed, Agent 21 picks the closest analog and notes it in `HUMAN-EDIT.md`.

### 9. What this operation does **not** do

- It does not produce video, audio, or images. The deliverable is a script and the visual cues in it.
- It does not publish the launch. Posting, scheduling, and distribution are downstream.
- It does not run paid amplification or influencer seeding. Those plans live elsewhere.
- It does not validate legal claims (FTC disclosures, financial claims, health claims). Technical Specialist flags risky claims; legal review is a human task.
- It does not iterate after the launch ships. Post-launch retros are a separate workflow.
