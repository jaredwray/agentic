# Social Pipeline — reference

The full specification for the feature. It is **framework-agnostic**: every code block is pseudocode
or a small algorithm to translate into the target app's language and idioms — not files to copy. Pull
the section a workflow step points at.

The canonical, battle-tested implementation this distills is **jaredwray/jw**'s
(`app/shared/social/` for the engine, `app/admin/social/` for the inbox + calendar UI,
`app/api/admin/social/` for the routes, `scripts/social-scan.ts` + `.github/workflows/social-scan.yml`
for the cron, `data/voice.md` for the persona). When in doubt about a detail, that source is the
ground truth — but adapt it, don't transplant it.

---

## 1. Architecture

```text
 sources (changelog / GitHub releases / RSS)
        │  fetchEntries() → SourceEntry[]  (normalized, stable slug)
        ▼
   scan orchestrator ──► AI drafting ──► one SocialDraft per (entry, platform), status "draft"
   (dedup ledger;        (voice doc +     with a *provisional* scheduledFor + slot
    one entry once)       strict JSON)                     │
                                                           ▼
                                          ┌──────  approval inbox  ──────┐
                                          │  edit · regenerate · reject  │
                                          │            approve           │
                                          └───────────────┬──────────────┘
                                                          │  approve = create on the provider
                                                          ▼
                              publishing adapter ──►  provider queue  (schedule / edit / cancel)
                              (SYNC-FIRST: provider first, then local)        │
                                      ▲                                       │ webhooks
                          scheduling engine                                   ▼
                   (posting windows → a slot)                      webhook log + alerts
                                      │                                       │
                                      └──────────────  calendar  ◄────────────┘
                                       (scheduled/posted over the window grid; window editor)
```

Four properties drive the whole design:

- **Human-in-the-loop.** The scan never publishes. It only ever writes rows with status `draft`. The
  *only* transition that creates a real post on the provider is an explicit human **approve**. This is
  what makes it safe to run an AI drafter on a cron.
- **Generate, then publish.** A draft carries a *provisional* `scheduledFor` chosen at scan time so it
  has a sensible default, but no provider call happens until approval. Approval re-picks a slot if the
  provisional time has passed and then creates the post.
- **Source-agnostic ingestion.** Every source normalizes to one `SourceEntry` shape, so the
  orchestrator, drafter, scheduler, and inbox are written once. Adding a source is a new `fetchEntries`
  plus a `source`/`kind` tag — nothing downstream changes.
- **The provider is the source of truth for queued posts.** Once a draft is `scheduled`, the local row
  is a *cache* of what the provider will publish. Every mutation goes to the provider first and is only
  mirrored locally on success (§ 6). The two stores cannot drift.

---

## 2. Data model & indexes

Four persisted records plus the normalized source shape. Field names are jw's; keep the *shape and
the constraints*, rename to taste.

**`SourceEntry`** — what every source produces and the drafter/scheduler consume:

```text
SourceEntry = {
  slug:        string        // STABLE id; derive from the source URL, never from the title
  title:       string
  url:         string        // canonical link; every post must contain it
  summary:     string        // plain-text digest the prompt reads (cap ~600 chars)
  publishedAt: Date          // used for the lookback window
  mediaUrl:    string | null // optional image/video to attach
  mediaType:   'image' | 'video' | null
}
```

**`SocialDraft`** — the unit of work and the status machine:

```text
SocialDraft = {
  id
  entrySlug, entryTitle, entryUrl     // denormalized from the SourceEntry so the inbox needs no join
  platform:   'twitter' | 'linkedin' | …
  status:     'draft' | 'approved' | 'scheduled' | 'posted' | 'rejected'
  content:    string                  // the post text
  tags:       string[]                // hashtag tokens WITHOUT the leading '#'
  mediaUrl, mediaType, mediaSource    // mediaSource ∈ source-name | 'ai-image' | 'manual' | null
  scheduledFor: Date                  // provisional until approved, authoritative after
  slot:       0 | 1                   // which of the day's windows this occupies
  schedulingRationale: string         // human-readable "why this time" (for the inbox/audit)
  externalPostId: string | null       // the provider's id once scheduled; the FK for edit/cancel
  feedbackHistory: { at: Date, note: string }[]   // every regenerate note, appended
  generatedAt, updatedAt: Date
}
```

Status machine: `draft` → (approve) → `scheduled` → (provider webhook) → `posted`; any of
`draft`/`approved`/`scheduled` → (reject/delete) → removed or `rejected`. Only `draft`/`approved` rows
are freely editable; editing a `scheduled` row goes through the sync-first path (§ 6).

**`SeenEntry`** — the idempotency ledger, keyed by the stable slug:

```text
SeenEntry = { _id: slug, source, title, url, publishedAt, firstSeenAt, processedAt: Date | null }
```

**`PostingWindow`** — one row per (platform, dayOfWeek, slot):

```text
PostingWindow = {
  platform, dayOfWeek: 0..6 (0=Sun), slot: 0 | 1,
  startMinutes, endMinutes: 0..1440,   // minutes-from-midnight, in `timezone`
  enabled: boolean, timezone: IANA string, updatedAt: Date
}
```

**`WebhookEvent`** — the provider's event log:

```text
WebhookEvent = { id, eventType, payload, signature: string | null, signatureValid: boolean, receivedAt }
```

**Indexes / constraints** (the ones that matter):

- `SocialDraft`: **unique (entrySlug, platform)** — this is what makes the scan idempotent and lets a
  partial failure retry only the missing platform; plus a non-unique index on `status` for the inbox.
- `SeenEntry`: primary key is the slug; index `publishedAt` desc.
- `PostingWindow`: **unique (platform, dayOfWeek, slot)**.
- `WebhookEvent`: index `receivedAt` desc and `(eventType, receivedAt)`.

---

## 3. Content sources

A source is a function `fetchEntries(): Promise<SourceEntry[]>`. Implement **one** for the seed; the
contract is all that downstream code knows.

**Stable slug.** Derive it from the canonical URL's last path segment (or, for releases,
`release-<repo>-<tag>`). **Never** derive it from the title — titles get edited and that would
re-process the entry as new. The slug is the dedup key *and* the `(entrySlug, platform)` uniqueness
key.

**Normalization.** Pull a title, a canonical `url`, a plain-text `summary` (strip HTML/markdown, cap
at ~600 chars — the prompt reads this, not raw HTML), a `publishedAt`, and an optional `mediaUrl` +
`mediaType`. Two media tactics from jw worth keeping:

- **HTML changelog scrape:** load the index, collect entry links matching the changelog path shape,
  fetch each, read `og:`/`article` metadata, and extract the first usable `<img>`/`<video>` (skipping
  `data:` placeholders) with an `og:image` page-level fallback.
- **GitHub releases:** list releases per repo, **skip drafts and prereleases**, take the first
  markdown/HTML image in the body as media, and build the summary from the body.

**Lookback window.** The scan filters fetched entries to a recent window (jw: 14 days) so a first run
against a long history doesn't draft hundreds of stale posts. Dedup (§ 7) is the real guard; the
lookback is the cheap pre-filter.

Sources do network I/O over an HTTP client with a descriptive User-Agent; keep them pure (return
data, no DB writes) so they're trivially testable with a fixture.

---

## 4. AI drafting

**Voice doc.** A single maintainer-authored file (jw: `data/voice.md`) loaded best-effort at call time
(missing file → empty string, never a crash). It is injected verbatim into the system prompt so every
post matches one persona — the tone analogue of the content folder in `whats-new`. Seed exactly one;
the user owns it after.

**System prompt** = persona instruction + platform constraints + the JSON contract + the voice block:

```text
"You are drafting social posts for <author>. Match the persona, tone, and examples in the VOICE GUIDE
 below verbatim. Do not invent a new voice."
<platform constraints>                      // see below
"Return a JSON object with non-empty `content` (obeys the char limit) and a non-empty `tags` array of
 plain hashtag tokens without the leading # character."
"\n--- VOICE GUIDE ---\n<voiceDoc>\n--- END VOICE GUIDE ---"   // omitted entirely if the doc is empty
```

**Per-platform constraints** carry the hard rules, e.g.:

- *twitter/X:* ≤ 230 chars (a URL counts ~23; leave room for link + tags); one sharp thought, no
  thread; 1–2 inline hashtags; `tags` array non-empty.
- *linkedin:* ≤ 2800 chars; 2–3 short paragraphs; 3–5 hashtags appended at the end and mirrored into
  `tags`.

**User message** states the job and the entry. For a release, instruct the maintainer's POV and to
avoid generic "I just shipped" phrasing; always: *"include the link (the URL below) in the post."*

```text
[intro], "Title: <title>", "URL: <url>", "Summary: <summary>"
```

**Strict output schema.** Request a JSON-schema-constrained response so the result always parses:

```text
{ type: object, properties: { content: string, tags: string[] }, required: [content, tags],
  additionalProperties: false }   // strict
```

**Post-processing (do all three):**

```text
ensureLink(content, url):     // the prompt asks for it; enforce it anyway
    if url present in content (ignore a trailing slash; reject prefixes of longer URLs) → content
    else → content + "\n\n" + url

sanitizeTags(tags):           // strip leading '#', trim, de-dupe case-insensitively, drop empties
    if result is empty → THROW   // a post must end with hashtags; empty is a hard failure → retry

validate: content is a non-empty string; tags is an array of strings.
```

**Retry with backoff.** Wrap the call + parse + validate in a small retry (jw: 2 retries, base 1s,
exponential) so a transient model hiccup or a momentarily-empty `tags` gets another shot before the
scan records a failure.

**Regenerate** (`regeneratePost(draft, feedback, voice)`): same system prompt; the user message feeds
the previous content + tags + the user's feedback and says *"produce a fresh draft — do not merely
tweak the original; keep the entry URL."* Same schema + post-processing.

**Optional fallback image.** If an entry has no media and the app wants one, generate an image
("clean modern illustration of <title>, minimalist, no text") and attach it with
`mediaSource: 'ai-image'`. Keep this opt-in — it costs money per scan.

---

## 5. Scheduling engine

The schedule is a grid of **posting windows**; the assigner drops a draft at a **random instant inside
the next free window**. Random (not a fixed minute) so posts look human and two drafts in the same
window can't collide on an exact timestamp.

**Default seeding (idempotent + migration-safe).** Ensure a row exists for every (platform, day,
slot). jw's defaults: slot 0 = 09:00–11:00 **enabled on weekdays**; slot 1 = 14:00–16:00 **disabled
everywhere** (opt-in second window). Insert only the *missing* combinations so re-running never
disturbs user-customized rows, and a single-window install gains its slot-1 rows without a manual
migration. Backfill a missing `slot` to `0` before swapping the legacy unique index to the new
`(platform, dayOfWeek, slot)` one.

**Timezone math.** Windows are authored in an IANA timezone; a draft is stored as a UTC instant. Use a
tz-aware date lib so DST is handled:

```text
windowToUtc(localDate "YYYY-MM-DD", startMin, endMin, tz):
    startUtc = tz(localDate + formatMinutes(startMin)).toUTC()
    endUtc   = tz(localDate + formatMinutes(endMin)).toUTC()
```

**`assignSlot(platform, after = now)`** — the next free window over a horizon (jw: 60 days):

```text
windows = enabled windows for platform, grouped by dayOfWeek
reserved = { (localDay, slot) of every approved|scheduled|posted draft in [today, today+HORIZON] }
for offset in 0..HORIZON:
    day = after + offset days (in tz); for each enabled window of day's weekday, EARLIEST first:
        if (day, window.slot) in reserved: continue        // one post per window-slot per day
        [startMs, endMs] = windowToUtc(day, window)
        if offset == 0: startMs = max(startMs, now + LEAD)  // LEAD ~5min so it isn't scheduled in the past
        if startMs >= endMs: continue
        return { scheduledFor: randomInRange(startMs, endMs), slot: window.slot, rationale }
throw "no available window within HORIZON days"
```

**`assignSlotForDate(platform, date, { slot, allowDraftId })`** — same, pinned to a chosen date + slot;
the conflict check **excludes `allowDraftId`** so a *reschedule of the same draft* can land back on its
own slot. Errors clearly if that window is disabled, empty, already taken, or already past.

**`getAvailableDays(platform, count)`** — the next N free `(date, slot, label, windowLabel)` options,
to populate the inbox's approve/reschedule picker.

**`slotForScheduledTime(platform, when)`** — map an arbitrary instant back to the window slot it falls
inside (or null). Call this whenever a user edits a draft's time directly, so the stored `slot` stays
consistent with `scheduledFor` and per-window conflict detection can't be bypassed by hand-editing the
time.

**Rationale string.** Build a human-readable "Random slot in `<platform>` `<Day>` window
`HH:MM–HH:MM TZ` (`HH:MM–HH:MM UTC`) on `Mon DD`" so the inbox and audit log explain every chosen time.

---

## 6. Publishing adapter — the sync-first invariant

The adapter is the seam to the outside world. Three operations:

```text
schedulePost(draft)            -> { externalPostId }   // CREATE a post on the provider
editScheduledPost(id, patch)   -> void                 // patch ∈ { content?, scheduledFor?, mediaItems? | null }
cancelScheduledPost(id)        -> void                 // DELETE / unschedule
```

`content` sent to the provider is composed so the hashtags are present (append any `tags` missing from
the body); media is `[{ type, url }]` or omitted. Read per-platform account ids from env.

**The invariant: the provider goes first, local persistence second, and local is skipped if the
provider call fails.** This is what keeps the two stores from diverging. Concretely, by action:

| Inbox action | Draft status before | Provider call | Then locally |
|---|---|---|---|
| **approve** | draft / approved | `schedulePost` (create) | set `status='scheduled'`, store `externalPostId` |
| **edit** content/tags/media/time | scheduled | `editScheduledPost` **first** | persist patch only on success; else **502, no write** |
| **regenerate** | scheduled | `editScheduledPost({content})` **first** | persist new content/tags + feedback |
| **reschedule** | scheduled | `editScheduledPost({scheduledFor})` **first** | persist new time + slot |
| **reject / delete** | scheduled | `cancelScheduledPost` **first** | delete row (or mark `rejected`) |
| edit / regenerate | draft (unscheduled) | none | persist directly |

So: editing an *unscheduled* draft is a plain local write; editing a *scheduled* one is a
provider-then-local write that **fails closed**. On the approve path, if the provisional `scheduledFor`
has passed (or the user picked a date), re-run the assigner *before* `schedulePost` so you never create
a post in the past.

**Prefer an existing scheduling provider** (a Zernio/Ayrshare/Buffer-style SaaS) over hand-rolling each
network's API: it owns OAuth, token refresh, rate limits, and the actual publish + analytics + webhooks.
If you must call platform APIs directly, the adapter is still the only thing that changes — but you now
own token storage/refresh and per-network rate limits, so budget for that.

---

## 7. Scan orchestration

`processEntries(entries, { source, kind, dryRun })` is the heart, shared by every source:

```text
voice = loadVoiceDoc()
for entry in entries:
    if isSeen(entry.slug): continue
    results = await all platforms:  buildDraftForPlatform(entry, platform, voice, kind)
        // buildDraftForPlatform: if a draft already exists for (slug, platform) → "satisfied" (skip the
        //   paid AI call); else generatePost → assignSlot → assemble a NewSocialDraft (status 'draft')
    satisfied = 0
    for r in results:
        if r.alreadyExists: satisfied++; continue
        if r.error:        record failure; continue
        if dryRun:         satisfied++; continue
        insertDraft(r.draft); satisfied++     // unique (slug, platform) makes a double-insert a no-op
    // mark seen ONLY when every platform has a draft, so a transient failure on one platform leaves the
    // entry unseen and the NEXT scan retries just that platform (the others short-circuit on existence).
    if satisfied == platforms.length and not dryRun:
        markSeen(entry); markProcessed(entry.slug)
return { fetchedEntries, newEntries, draftsCreated, failures }
```

`runScan()` per source = `ensureIndexes()` → `fetchEntries()` → lookback filter → `processEntries`.

**Backfill a single missing platform** (`generateDraftFor(slug, platform)`): when the inbox shows one
platform missing, draft it from its sibling draft (reuse the sibling's entry fields) rather than
re-fetching the source.

**Entry points & cron.** A small script per source loads env (dotenv), accepts `--dry-run`, logs the
summary as JSON, **exits non-zero if `failures.length > 0`** (so CI surfaces it), and closes the DB.
Schedule each on its own cron (jw: separate daily workflows for the changelog and the releases, an hour
apart) with the AI + provider secrets wired in. Also expose a manual **"scan now"** endpoint/button
that runs all sources (`Promise.allSettled`) and refreshes the inbox.

---

## 8. Approval inbox

Lists the drafts grouped by source entry, each group showing its per-platform drafts side by side.

**Grouping & ordering.** Group by `entrySlug`. Order groups by a status bucket so unreviewed work
floats up — `draft = 0`, `approved|scheduled = 1`, `posted|rejected = 2`; a group takes its *best*
(lowest) bucket; tie-break by earliest `generatedAt`. Within a group, order platforms consistently
(jw: twitter before linkedin). A group with a platform missing shows a **"generate"** placeholder that
calls the backfill from § 7.

**Per-draft actions:**

- **Edit** — inline editor for content / tags / media URL → `PATCH draft` (validates a non-empty
  content, a string array of tags, an http(s)/`data:` media URL; recomputes `slot` from any new time
  via `slotForScheduledTime`; sync-first if scheduled).
- **Regenerate** — a small feedback box → `POST regenerate` → replaces content/tags and appends the
  note to `feedbackHistory` (sync-first if scheduled).
- **Approve** — pick a day + slot from the `getAvailableDays` picker → `POST approve` → re-assign if
  needed, `schedulePost`, flip to `scheduled`.
- **Reject / delete** — confirm → `DELETE draft` → `cancelScheduledPost` first if it was scheduled.

**Avoid double-booking the UI.** After any approve/reschedule/delete, broadcast a refresh event so
every card re-loads its available-days picker; otherwise two open cards could both offer — and grab —
the same now-taken window.

A `scheduled` draft renders read-mostly with a link into the calendar to edit it there; `posted` and
`rejected` are read-only.

---

## 9. Calendar, window editor & webhooks

**Calendar.** Resolve a date range (default the current week in the configured tz; cap the span, jw:
60 days). Lay every `scheduled`/`posted` draft onto its **local day** (convert the stored UTC instant
back to the tz), sorted by time, alongside the day's window grid per platform. Each draft is a chip;
clicking it opens the same edit/reschedule/cancel controls as the inbox (reschedule = pick a new day +
slot → sync-first `editScheduledPost`).

**Window editor.** A grid of platform × day × slot (jw: 2 platforms × 7 days × 2 slots). Each cell: an
enable checkbox + start/end time inputs. Save = `PUT windows` with the full set. Validate **server-side
against the merged post-upsert state** (stored rows overridden by the submitted ones), not just the
submitted batch — so a partial save can't slip in a window that overlaps a slot already stored. The
rule: the two enabled windows of one (platform, day) **must not overlap** (half-open interval test), so
any scheduled instant maps unambiguously back to one slot. Validate platform ∈ set, day ∈ 0..6, slot ∈
0..1, minutes ∈ 0..1440, end > start.

**Webhook receiver.** `POST <webhook path>`:

```text
raw = request.body (read as TEXT before JSON-parsing, so the signature is over the exact bytes)
if WEBHOOK_SECRET set:
    if not verifyHmacSha256(raw, header "X-…-Signature", secret): return 401   // timing-safe; strip "sha256="
else: accept unsigned (still log it)
payload = JSON.parse(raw)          // reject non-object / array → 400
eventType = payload.event ?? payload.type ?? payload.eventName ?? "unknown"
logWebhookEvent({ eventType, payload, signature, signatureValid, receivedAt: now })
return { ok: true }
```

Classify events whose type ends in `.failed`/`.disconnected` as **alerts** and surface a recent-alerts
count + preview (a publish failure or a disconnected account is the one thing the human must see). The
log panel shows the most recent events (type, time, signed/unsigned, a payload preview).

---

## 10. Security & hardening

- **Gate the entire back office.** Every page and route (inbox, calendar, all `…/social/*` APIs) sits
  behind the app's existing admin auth (jw: a signed session cookie checked in middleware, established
  via TOTP). The scan scripts run server-side with secrets, never from the browser. The **webhook
  receiver is the one public route** — that's why it verifies a signature.
- **NoSQL/SQL-injection hardening.** Query params that reach the data store (platform, dayOfWeek, slot,
  date, status) are validated to a primitive/enum *and* wrapped so a structured value can't be
  interpreted as a query operator (jw wraps Mongo filter values in `$eq`). Validate dates against
  `^\d{4}-\d{2}-\d{2}$`, platform/status against their enums, minutes/day/slot against their ranges.
- **Restrict media URLs** to `http(s):`/`data:` on the edit path; sniff `video` vs `image` from the
  extension for rendering.
- **Secrets** (AI key, provider key + per-platform account ids, optional webhook secret) come from env.
  Read AI/provider model + keys *at call time* so a dotenv-loaded script and a serverless runtime both
  pick them up. The pipeline must be a **safe no-op when unconfigured** — a missing key throws a clear
  error inside the scan, not at import — so the feature can merge before the secrets are set.

---

## 11. Adaptation by stack

- **Next.js (App Router)** — the canonical shape: server pages for the inbox/calendar (`revalidate =
  0`), route handlers under `app/api/admin/social/*`, the engine in a shared module, `tsx` scan scripts
  on a cron (GitHub Actions / Vercel Cron), and the data store via a Mongo/SQL client. Middleware gates
  `/admin/*` + `/api/admin/*`.
- **Node + Express/Nest** — the engine is a service module; routes are controllers; the scan is a CLI
  entry run by a system cron or a worker (BullMQ); the inbox/calendar are server-rendered views or a
  small SPA hitting the same routes.
- **Rails / Django / Laravel** — records are models; the inbox/calendar are admin views; the scan is a
  rake/management/artisan command on cron; the publisher call goes through an ActiveJob/Celery worker so
  a slow provider call doesn't block the request.
- **Serverless** — the scan is a scheduled function, the webhook a single function; keep the engine in a
  shared layer so functions stay thin.

Whatever the stack: keep the seven parts, the status machine, the dedup-completeness rule (§ 7), the
timezone-stored-as-UTC scheduling, and the **sync-first publishing invariant**. Change only the wiring.

---

## 12. Verification checklist

- [ ] A scan against a fixture creates one `draft` per (entry, platform) with a sensible provisional
      `scheduledFor`; re-running creates **nothing new** (dedup holds).
- [ ] Killing one platform's draft and re-scanning regenerates **only** the missing platform; the entry
      was left unseen until both existed.
- [ ] `--dry-run` writes nothing and still reports realistic counts.
- [ ] Generated posts obey the per-platform char limit, **always contain the source URL**, and have a
      non-empty `tags` array; an empty-tags model response retries rather than persisting.
- [ ] Regenerate produces a visibly different draft and appends the feedback note.
- [ ] `assignSlot` returns a time **inside** an enabled window, never in the past, and never a second
      post in a window that already holds one; the rationale string reads correctly across a DST change.
- [ ] **Approve** creates the provider post, stores `externalPostId`, and flips to `scheduled`; the
      post then appears on the calendar on the right local day.
- [ ] **Sync-first holds:** make the provider's edit call fail and confirm the local draft is **not**
      modified and the API returns an error (no divergence); on success both update.
- [ ] **Reschedule** moves the calendar chip and edits the provider post; **delete** of a scheduled
      draft cancels it on the provider first.
- [ ] The window editor rejects two overlapping enabled windows on the same platform/day, validating
      against the merged stored+submitted state.
- [ ] A webhook with a **valid** signature is logged with `signatureValid: true`; a **bad** signature
      returns 401; a `*.failed` event shows up in the alerts panel.
- [ ] Every inbox/calendar page and `…/social/*` route is unreachable without admin auth; the webhook
      route is reachable but signature-checked.
- [ ] With the AI/provider env unset, the app builds and the pages load; the scan fails with a clear
      "key not set" message rather than crashing at import.

---

## 13. Design-decision catalog (the "why")

- **Human-in-the-loop; scan only drafts** → an AI drafter can run unattended on a cron because nothing
  it produces is publishable until a person approves.
- **Approve is the publish** → there is exactly one place a real post is created, so "what did I agree
  to post" has a single, auditable answer.
- **Normalized `SourceEntry`** → the drafter/scheduler/inbox are written once; a new source is just a
  `fetchEntries`.
- **Stable slug from the URL, not the title** → titles get edited; a title-derived slug would
  re-process the entry as new.
- **Dedup marked complete only when every platform drafted** → a transient failure on one platform
  retries just that platform on the next scan instead of either re-drafting everything or silently
  dropping it.
- **Unique (entrySlug, platform)** → makes inserts idempotent and the partial-retry safe.
- **Voice doc in the prompt** → one persona across every post, owned by the maintainer like content,
  not code.
- **Strict JSON + enforced link + non-empty tags + retry** → the scan never persists a malformed,
  link-less, or tag-less post; a flaky model gets another shot before it's a recorded failure.
- **Random time inside a window, one post per window/day** → posts look human and never collide; the
  schedule is a policy (windows) the user tunes, not hand-picked timestamps.
- **Author-tz windows stored as UTC instants** → DST-correct, unambiguous storage, legible local
  display.
- **Recompute slot on a manual time edit** → per-window conflict detection can't be bypassed by editing
  `scheduledFor` directly.
- **Sync-first, fail-closed publishing** → the provider is the source of truth for queued posts; the
  local row can never claim something the provider won't publish.
- **Refresh the day-pickers after each approve** → two open inbox cards can't both grab the same window.
- **Webhook signature optional but every event logged** → works before the secret is set, and a publish
  failure/disconnect is always visible.
- **Safe no-op without credentials** → the feature merges and the app builds before the AI/provider
  secrets land; the scan throws a clear error only when actually run.

---

## 14. Environment & configuration

The variables the feature needs (names are jw's; map to the app's config):

- **AI:** `OPENAI_API_KEY` (or the app's provider key); optional `OPEN_AI_TEXT_MODEL` /
  `OPEN_AI_IMAGE_MODEL` overrides.
- **Provider:** the scheduling provider's API key + the per-platform account ids (jw:
  `ZERNIO_API_KEY`, `ZERNIO_TWITTER_ACCOUNT_ID`, `ZERNIO_LINKEDIN_ACCOUNT_ID`); optional
  `ZERNIO_WEBHOOK_SECRET` for signature verification.
- **Data store:** the connection string (jw: `MONGODB_URI`).
- **Auth:** whatever the app's admin gate already uses (jw: `ADMIN_EMAIL`, `ADMIN_TOTP_SECRET`,
  `ADMIN_SESSION_SECRET`).
- **Source-specific:** e.g. a `GITHUB_ACCESS_TOKEN` for the releases source.

In CI, set the non-secret model overrides as repository **variables** and everything else as
**secrets**, wired into each scan workflow.
