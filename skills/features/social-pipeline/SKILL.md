---
name: social-pipeline
description: Scaffold an AI-assisted social-posting back office — content sources → AI-drafted platform posts → a human approval inbox → a scheduling calendar with posting windows → a publishing provider. Scaffolds the parts to fit the target stack — a normalized source adapter plus one seed source (a changelog, GitHub releases, or an RSS feed), an AI drafting layer (a voice doc + strict-JSON {content, tags} with per-platform limits, source-link and tag enforcement, retry, and feedback-driven regenerate), a draft store with a dedup ledger and a draft→approved→scheduled→posted status machine, a timezone-correct windows/slot scheduler (a random time in the next free window, one post per window per day), the approval-inbox UI, the calendar plus a posting-window editor plus a webhook log, a sync-first publishing adapter (push every change to the provider before persisting locally so the two stores never diverge), and the cron plus manual scans. Use when asked to build a social media scheduler, an AI social-post pipeline, a post approval inbox or queue, a content-to-social automation, or a social calendar with posting windows. Manual; wires AI and posting credentials and opens one PR.
disable-model-invocation: true
user-invocable: true
---

# Social Pipeline

Operation manual for adding an **AI-assisted social-posting back office** to an app: a system that
ingests content from one or more sources, has an AI draft a platform-specific post for each in the
maintainer's voice, presents those drafts in a **human approval inbox** (edit / regenerate / approve /
reject), schedules approved posts into **configurable posting windows** shown on a **calendar**, and
hands them to a **publishing provider** — keeping the local store and the provider in lockstep. One
feature per invocation; the deliverable is a single PR that scaffolds the feature into the target
repo, adapted to its stack.

> **When this document is loaded, begin executing immediately.** Start with [Workflow](#workflow)
> Step 1 — a requirements interview to learn the target stack and, critically, the **AI provider**,
> the **publishing target**, and the **content sources**. Only stop to ask the user when a step says
> to, or when a decision genuinely needs their input (the publishing strategy and the sources are the
> two that do).
>
> **Persona.** Act as a product engineer building a credential-bearing back-office pipeline. Two bars
> govern every choice: **"feels native to this app"** — match its routing, data access, auth,
> job-runner, and styling rather than importing jw's — and **"nothing posts without a human approving
> it."** The AI writes; the human ships. Taste matters: the inbox should be calm and fast, the
> calendar legible at a glance.
>
> **One feature per invocation.** Scaffold the pipeline, drive its PR to green, then stop. Do **not**
> also write the ongoing brand voice or seed a backlog of posts — seed exactly one source and one
> voice doc and hand authoring back to the user.
>
> **Two hard invariants, every time.** (1) **Human-in-the-loop** — the scan only ever produces
> *drafts*; the only thing that creates a real post on the provider is an explicit human **approve**.
> (2) **Sync-first publishing** — once a draft is live on the provider, every later change (edit,
> regenerate, reschedule, cancel) is pushed to the provider *before* it is persisted locally, and the
> local write is skipped if the remote call fails, so the two stores can never diverge.
>
> This skill is **framework-agnostic**: it carries the pattern and the design decisions, not a set of
> Next.js files. Translate every part into the target app's idioms. It follows the shared
> `shipping-conventions` one-PR loop and `pr-conventions` for the PR, and gathers requirements with
> `requirements-interview`.

## What you're building

Seven parts, wired together. The [reference](./reference.md) specifies each one in detail.

1. **Content sources** — a normalized `fetchEntries(): SourceEntry[]` adapter and **one** real source
   (a changelog, GitHub releases, a blog RSS feed). Each source maps its items to one common entry
   shape with a **stable slug**.
2. **AI drafting** — a maintainer-authored **voice doc** plus a generator that turns one entry into a
   platform-specific `{ content, tags }` via a strict JSON schema, enforces the per-platform limits,
   guarantees the source link and non-empty tags, retries, and supports **feedback-driven regenerate**.
3. **Draft store + dedup** — the `SocialDraft` record and its `draft → approved → scheduled → posted /
   rejected` status machine, a **seen ledger** so each source entry is processed exactly once, and a
   **one-draft-per-(entry, platform)** uniqueness constraint.
4. **Scheduling engine** — configurable per-platform **posting windows** and a slot assigner that
   places a draft at a **random time inside the next free window**, one post per window per local day,
   computed in a configured timezone and stored as UTC.
5. **Approval inbox** — source entries grouped with their per-platform drafts; per-draft **edit /
   regenerate(with feedback) / approve(pick a day + slot) / reject**; approval is the action that
   publishes.
6. **Calendar + window editor + webhook log** — scheduled/posted drafts laid over the window grid in
   the configured timezone (click to reschedule/cancel), an editor for the posting windows (with an
   overlap guard), and a panel of recent **provider webhook events**.
7. **Publishing adapter + scans** — a **sync-first** adapter (`schedule` / `edit` / `cancel`) against a
   posting provider or the platform APIs, plus a **cron** job per source (and a manual "scan now"
   action) that runs the source → draft pipeline.

## Scope

**In scope:** scaffolding the seven parts above into the target repo, adapted to its framework, data
store, job-runner, auth, AI provider, and publishing target; one seed source and one voice doc;
gating the whole back office behind the app's existing admin auth; the cron scan plus a manual
trigger; and verifying the full loop end-to-end.

**Out of scope:** writing the ongoing brand voice or a backlog of posts (the user's job after this
ships); building a brand-new OAuth/token-refresh client for a social network from scratch if the app
can use an existing scheduling provider — prefer the provider and keep the adapter a thin seam;
designing the app's auth or admin shell from scratch (reuse what exists); analytics dashboards beyond
the webhook event log. If the app has no admin surface, no AI provider, and no way to reach a
publishing target, **stop and confirm the approach** before scaffolding — this feature is only safe
behind auth and only useful with a publisher.

## Workflow

1. **Interview & detect the stack.** Use `requirements-interview` to keep this focused. Establish:
   framework and language; where server routes, **scheduled jobs/cron**, admin pages, and shared
   modules live; the **data store** and how the app models collections/tables; the app's **auth** (the
   back office must be gated — reuse it); the **AI provider + model** available; the **publishing
   target** — does the app already integrate a social scheduler (e.g. a Zernio/Ayrshare/Buffer-style
   SaaS) or must it call the platform APIs directly?; which **platforms** to support and their limits;
   and the **content sources** to ingest. Pick the **timezone** the schedule is authored in. Report
   what you found, then **confirm the publishing strategy and the sources** before building — those two
   are load-bearing. See the [reference](./reference.md) § 1.

2. **Model the data.** Create the records: `SocialDraft` (the unit of work + status machine), the
   `SeenEntry` dedup ledger, the `PostingWindow` schedule config, and the webhook-event log — plus the
   normalized `SourceEntry` shape sources map into. Add the constraints: **unique (entrySlug,
   platform)**, the seen ledger keyed by the stable slug, and **unique (platform, dayOfWeek, slot)**
   for windows. See the [reference](./reference.md) § 2.

3. **Build the source adapter + one seed source.** Define `fetchEntries(): SourceEntry[]` and
   implement exactly **one** real source for this app, normalizing each item to the common shape with a
   stable slug and a `publishedAt`. Apply a lookback window so old items don't resurface. See the
   [reference](./reference.md) § 3.

4. **Build the AI drafting layer.** Add a `voice.md` persona doc and `generatePost(entry, platform,
   voice)` returning strict-JSON `{ content, tags }` — enforce the per-platform character limit and
   hashtag rules, **guarantee the source link and a non-empty tag set**, and retry with backoff. Add
   `regeneratePost(draft, feedback, voice)` for the inbox. See the [reference](./reference.md) § 4.

5. **Build the scheduling engine.** Implement the window model and `assignSlot` /
   `assignSlotForDate` / `getAvailableDays` / `slotForScheduledTime`, all **timezone-correct** (author
   tz → UTC) with **one post per window-slot per local day** conflict detection over a horizon, and
   idempotent, migration-safe default-window seeding. See the [reference](./reference.md) § 5.

6. **Build the publishing adapter (sync-first).** Implement `schedulePost` / `editScheduledPost` /
   `cancelScheduledPost` against the chosen provider (or the platform APIs). Enforce the **sync-first
   invariant**: for any change to an already-scheduled draft, call the provider first and **only
   persist locally if it succeeds** (fail closed). See the [reference](./reference.md) § 6.

7. **Wire the scan orchestrator.** Implement `processEntries`: for each unseen entry, fan out to the
   platforms, draft each, assign a provisional slot, insert — and **mark the entry seen only once every
   platform has a draft** so a partial failure retries just the missing platforms. Add a per-source
   scan entry point, a scheduled **cron** job (a `--dry-run` flag, non-zero exit on failures), and a
   manual "scan now" action. See the [reference](./reference.md) § 7.

8. **Build the approval inbox.** Group entries with their per-platform drafts, ordered by status; give
   each draft **edit / regenerate(feedback) / approve(pick day + slot) / reject** controls. **Approve**
   calls the publisher and flips the draft to `scheduled`; reject/delete cancels on the provider first.
   Refresh the day pickers across cards after each approve so two drafts can't grab the same window. See
   the [reference](./reference.md) § 8.

9. **Build the calendar + window editor + webhook log.** Lay scheduled/posted drafts over the window
   grid in the configured timezone (click a chip to edit/reschedule/cancel); add a **posting-window
   editor** (enable + time the daily windows per platform, rejecting overlaps); add a **webhook
   receiver** (verify the signature, log every event, classify failure/disconnect events as alerts) and
   a recent-events panel. See the [reference](./reference.md) § 9.

10. **Gate, verify, and ship one PR.** Put every page and route behind the app's admin auth and harden
    the query inputs (§ 10). Verify the full loop end-to-end: scan → draft → edit → regenerate →
    approve → it appears on the calendar → reschedule → cancel; a signed webhook is logged and a bad
    signature is rejected; the cron `--dry-run` writes nothing. Confirm the pipeline is a **safe no-op
    when its credentials are unset** so it can merge before secrets land. Document the required env, then
    open a single PR per `shipping-conventions` and `pr-conventions`, drive CI to green, and stop and
    report — including the publishing strategy, the seed source, and the env still to configure. Work
    the [reference](./reference.md) § 12 checklist.

## Reference

The full specification — the architecture, every record shape and index, the source adapter contract,
the AI prompt/schema/post-processing, the scheduling algorithm and timezone math, the scan
orchestration, the inbox and calendar flows, the sync-first publishing table, the webhook receiver,
the security model, per-stack adaptation notes, the design-decision catalog, and the verification
checklist — lives in [reference.md](./reference.md). Pull the section each workflow step points at as
you reach it.
