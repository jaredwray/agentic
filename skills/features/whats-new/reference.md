# What's New — reference

The full specification for the feature. It is **framework-agnostic**: every code block is pseudocode
or a small algorithm to translate into the target app's language and idioms — not files to copy. Pull
the section a workflow step points at.

The canonical, battle-tested implementation this distills is simple-tracker's (`content/whats-new/`,
`scripts/gen-whats-new.ts`, `app/shared/whats-new/`, `app/whats-new/`,
`app/api/user/whats-new/seen/`). When in doubt about a detail, that source is the ground truth — but
adapt it, don't transplant it.

---

## 1. Architecture

```text
content/whats-new/*.md ──► generator (build time) ──► generated feed module (typed, gitignored)
   author writes notes          parse + sanitize             const WHATS_NEW = [ {slug,title,date,html}, ... ]
                                 + sort newest-first                    │
                                                                        ▼
                                            feed module (type + seen/unseen helpers)
                                                                        │
                                   ┌────────────────────────────────────┴───────────────┐
                                   ▼                                                      ▼
                          page/view (lists cards,                          "New" indicator on the nav entry
                           injects prebuilt HTML,                           + "mark seen" fired on view
                           tags unseen "New")                               (localStorage OR per-user server)
```

Two properties drive the whole design:

- **The HTML is built ahead of time.** Markdown is rendered and sanitized by the generator, so the
  app ships a plain data array — no markdown library, no file reads, no per-request rendering. This is
  what lets it run on edge / no-filesystem runtimes and keeps the page trivially fast.
- **"New" is a comparison, not a flag.** Nothing is stored per entry. The indicator is derived by
  comparing the newest entry's publish instant against a single "last seen" baseline. Add a markdown
  file and every user's indicator lights up automatically; view the page and it clears.

---

## 2. Data model & authoring format

**One file per note**, in `content/whats-new/`, named `YYYY-MM-DD-slug.md`:

```md
---
title: Set your goal, get real targets
date: 2026-06-19
---

Your coach can now work from **your** numbers. Open **Profile** and tell it about you:

- **Your stats** — sex, age, height, weight.
- **Your goal** — lose fat, maintain, or build muscle.

Once it's set, every comment is anchored to those targets. Update it any time.
```

- **`title`** — the headline. If absent, fall back to the slug.
- **`date`** — `YYYY-MM-DD`, **required**. It is both the displayed date and the sort/seen key. Skip a
  file (with a warning) if it has no date — never guess one.
- **slug** — the filename without `.md`. It is the stable id; never derive it from the title (titles
  change). The date prefix makes files sort chronologically in a directory listing too.

The entry the rest of the system consumes:

```text
WhatsNewEntry = {
  slug:  string   // stable id from filename
  title: string   // headline
  date:  string   // "YYYY-MM-DD"
  html:  string   // body rendered to sanitized HTML at build time
}
```

Keep notes short, benefit-led, and second-person ("you can now…"). This is product copy, not a
commit log.

---

## 3. Generator algorithm

Runs at build time. Reads the content folder, emits the typed feed module.

```text
function generate():
    files = listFiles(CONTENT_DIR, "*.md")        // missing dir → emit an empty feed, do NOT fail the build
    entries = []
    for file in files:
        (frontmatter, body) = parseFrontmatter(read(file))
        slug = basename(file) without ".md"
        if not frontmatter.date:
            warn("skipping " + file + ": missing date"); continue
        entries.push({
            slug,
            title: frontmatter.title ?? slug,
            date:  frontmatter.date,
            html:  renderMarkdown(trim(body)),
        })
    // newest first; break ties by slug descending so order is stable across builds
    entries.sort((a, b) => a.date != b.date ? (a.date < b.date ? 1 : -1)
                                            : (a.slug < b.slug ? 1 : -1))
    writeGeneratedModule(entries)                  // a typed, read-only array; header says "generated, do not edit"
```

**Frontmatter parsing** can be a 10-line `key: value` reader (strip matching quotes) — you do not need
a YAML dependency for `title`/`date`. Use the app's existing parser if it has one.

**Markdown rendering.** Support exactly the constructs release notes use: headings, paragraphs,
unordered + ordered lists, blockquotes, fenced code, and inline **bold** / *italic* / `code` / links.
If the app already bundles a trusted, sanitizing markdown renderer, use it. Otherwise a small
block-then-inline renderer keeps the build dependency-free:

```text
renderMarkdown(md):
    split into blocks on blank lines; for each block detect: heading (#..######),
    list (-/* or N.), blockquote (>), fenced code (```), else paragraph.
    render block, then run renderInline on its text.

renderInline(text):
    pull out `code spans` FIRST and emit <code>escape(...)</code> so markup inside them stays literal.
    on the remaining text, in order: escapeHtml → links [a](b) → **bold** → *italic*/_italic_.
```

**Sanitization is mandatory even though notes are maintainer-authored** (defense in depth — a leaked
write or a copy-pasted snippet shouldn't become stored XSS):

```text
escapeHtml(s): & < > "  →  &amp; &lt; &gt; &quot;
safeHref(url): allow only ^(https?://|mailto:|/|#); otherwise drop the link (render the label as text)
```

Render external links with `target="_blank" rel="noopener noreferrer"`.

**Why build-time, not runtime:** the page needs no markdown library and no filesystem at request time;
it works identically on Node, edge, and static hosts; and the rendered HTML is reviewable in the diff
of the generated artifact during local dev.

---

## 4. Feed module & seen/unseen helpers

The feed module re-exports the generated `WHATS_NEW` array, defines `WhatsNewEntry`, and provides
these pure helpers. Get the time semantics right — they are subtle and they are the whole reason the
indicator behaves.

```text
// A YYYY-MM-DD note is treated as published at the END of that day, in UTC.
entryPublishedAt(entry):  return Date("{entry.date}T23:59:59.999Z")

latestWhatsNewAt():       return max(entryPublishedAt(e) for e in WHATS_NEW)  // or null if empty

// later of two instants; null/undefined means "no lower bound"
laterOf(a, b):            if !a: return b ?? null
                          if !b: return a
                          return a > b ? a : b

// is there anything newer than the baseline? null baseline ⇒ everything is new
hasUnseenWhatsNew(seenAt): latest = latestWhatsNewAt()
                           if !latest: return false
                           if !seenAt: return true
                           return latest > seenAt

// tag a single entry "New" on the page
isEntryUnseen(entry, seenAt): if !seenAt: return true
                              return entryPublishedAt(entry) > seenAt
```

**Why end-of-day UTC.** Sources carry only a day, but a deploy lands at some clock time. If you
treated the date as `T00:00:00`, a user who signed in at 9am on release day — before the deploy —
could be stamped "seen" past the entry and never get the dot. Comparing against the *end* of the day
means any sign-in during the release day still reads as "before the release", so the dot shows; the
seen-watermark (Step §6) is what actually clears it.

**Why a dual baseline.** The baseline you pass to `hasUnseenWhatsNew` / `isEntryUnseen` should be the
**later of "when they last opened What's New" and "when they previously signed in"**:
`laterOf(lastSeen, previousLogin)`. The login term makes returning users see what shipped while they
were away even if they never opened the page; the seen term clears the dot once they do. (The login
term only exists in the server variant; the localStorage variant uses just `lastSeen`.)

---

## 5. Page & "New" indicator

**The page:**

- Lists `WHATS_NEW` as dated cards: title, date, then the body via the framework's raw-HTML escape
  hatch (`dangerouslySetInnerHTML` / `v-html` / `{@html}` / `|safe`). This is safe **only because** the
  HTML was sanitized at build time (§3) — never feed user input through this path.
- **Format the date in UTC** (e.g. `Intl.DateTimeFormat(..., { timeZone: 'UTC' })`) so it matches the
  `YYYY-MM-DD` source with no timezone off-by-one.
- Tag each entry with a "New" pill when `isEntryUnseen(entry, baseline)`.
- Empty state: "No updates yet — check back soon."

**The indicator** is a small, quiet dot (not a count) shown when `hasUnseenWhatsNew(baseline)`:

- On the **nav entry** that links to the page, and optionally on the collapsed menu button so it's
  visible without opening the menu. Mark it `aria-hidden` — the accessible name belongs to the link.

**Mark seen** fires when the page is viewed, fire-and-forget:

```text
on page view:
    baseline = read current baseline      // capture BEFORE advancing, so this view's "New" tags are stable
    ... render cards using baseline ...
    advanceSeen()                          // localStorage write, or POST to the seen endpoint; ignore failures
```

Capturing the baseline *before* advancing is what lets the entries the user just discovered stay
tagged "New" for the visit that revealed them; the dot is gone on the next navigation. A failed
advance is harmless — the dot simply stays until the next visit.

---

## 6. Seen-tracking variants

### A. localStorage (default — no backend)

Best for apps without auth, or where per-device is fine. The baseline lives entirely client-side, so
**the indicator must be computed on the client** (after mount) to avoid a server/client render
mismatch.

```text
KEY = "whatsNewSeenAt"

readBaseline():   raw = localStorage.getItem(KEY); return raw ? Date(raw) : null
advanceSeen():    localStorage.setItem(KEY, (laterOf(now(), latestWhatsNewAt()) ?? now()).toISOString())

// nav badge (client component): after mount, show dot when hasUnseenWhatsNew(readBaseline())
// page: baseline = readBaseline() on mount → render tags → advanceSeen()
```

Trade-offs: resets if the user clears storage or switches device/browser; first-ever visit shows the
dot (baseline is null ⇒ all new), which is the desired "welcome" behavior. If you don't even want a
cross-session memory, you can store just the latest seen `date`/`slug` string instead of a timestamp —
same comparison, coarser granularity.

### B. Per-user server-side (when the app has auth + a user store)

Best when the indicator should follow the user across devices. Add a nullable `whatsNewSeenAt`
timestamp to the user record (and reuse an existing `previousLoginAt`/`lastLoginAt` if present for the
dual baseline).

```text
// endpoint: POST /api/.../whats-new/seen   (authenticated; no body)
handler():
    userId = requireAuth()                 // 401 if not signed in
    now = now()
    setUserField(userId, "whatsNewSeenAt", laterOf(now, latestWhatsNewAt()) ?? now)
    return { ok: true }

// server render of page / any nav that shows the dot:
baseline = laterOf(user.whatsNewSeenAt, user.previousLoginAt)
showDot  = hasUnseenWhatsNew(baseline)
// the page captures `baseline` for its "New" tags, renders, then the client fires POST .../seen
```

**Why the watermark is `laterOf(now, latestWhatsNewAt())`, not just `now`:** entries are compared at
*end of their release day*. If you stamped only `now` mid-release-day, `latest > seenAt` would still be
true for the rest of that day and the dot would linger. Advancing to at least the latest entry's
instant clears it cleanly.

The endpoint must be authenticated and scope the write to the current user — never accept a user id
from the client.

---

## 7. Build wiring

- **Add a generate command** (e.g. an npm script `gen:whats-new`, a make target, a rake task) that
  runs the generator from §3.
- **Run it before dev, build, and test** so the generated module is always fresh and present. Mirror
  how the app already runs codegen.
- **Gitignore the generated module** (e.g. `**/whats-new/entries.generated.*`). It is a build
  artifact: regenerating on clone/CI avoids merge noise and stale HTML. Document the one-shot command
  for fresh clones (like any other codegen step).
- If the target runtime *has* a filesystem and the app prefers reading markdown at request time, that
  is a valid alternative to a generated module — but still render + sanitize centrally and cache the
  result; do not parse markdown per request.

---

## 8. Adaptation by stack

- **Next.js (App Router)** — the canonical shape: a `force-dynamic` server page (server variant reads
  the user; localStorage variant defers the dot to a client child), a tiny `'use client'` mark-seen
  component that POSTs on mount, and a route handler for the seen endpoint. Generator is a `tsx`
  script run in the build. The nav dot is computed server-side (server variant) or in a client nav
  component (localStorage).
- **Generic SPA (React/Vue/Svelte + Vite/etc.)** — import the generated module directly; use the
  localStorage variant; compute the badge client-side after mount; run the generator in a `prebuild`/
  `predev` hook.
- **Static-site generator (Astro/Eleventy/Hugo/Jekyll)** — these already render markdown collections,
  so you may not need a custom generator; build a page from the collection and use localStorage for
  the dot (there's no per-request user). A purely static site can ship the page without a dot at all.
- **Server-rendered app (Rails/Django/Laravel)** — the generator can be a management/rake command, or
  read markdown at request time (filesystem exists) with caching; the seen state is a user column and
  the dot is rendered server-side.

Whatever the stack: keep the five parts and the helper semantics; change only the wiring.

---

## 9. Design-decision catalog (the "why")

- **Build-time render** → no runtime markdown dep, no filesystem needed, fast page, reviewable output.
- **Sanitize despite maintainer-authored content** → defense in depth; the raw-HTML injection on the
  page is only ever fed build-sanitized strings.
- **End-of-day-UTC publish instant** → a same-day, pre-deploy sign-in still sees the dot instead of
  being silently skipped by a midnight boundary.
- **Dual baseline (`laterOf(seen, previousLogin)`)** → returning users see what shipped while away,
  even if they never opened the page.
- **Watermark past the release when marking seen** → the dot clears immediately instead of lingering
  for the rest of the release day.
- **Capture baseline before advancing** → entries discovered this visit stay tagged "New" for this
  visit.
- **Fire-and-forget mark-seen** → a failed write just leaves the dot up; no retry/error UI needed.
- **Stable newest-first sort (date, then slug)** → deterministic builds; no reordering churn.
- **slug from filename, not title** → stable id as titles get edited.
- **Generated module gitignored** → it's a build artifact; avoids merge conflicts and stale HTML.

---

## 10. Verification checklist

- [ ] Generator runs clean and emits the typed module; a content dir with no files yields an **empty**
      feed without failing the build.
- [ ] A file missing `date` is skipped with a warning (not a crash, not a guessed date).
- [ ] Entries render **newest-first**; same-date entries are stably ordered.
- [ ] Markdown renders the supported constructs; **a `javascript:` link is dropped** and a `<script>`
      in a note is escaped (paste one in temporarily to confirm, then remove it).
- [ ] The page lists entries, dates read correctly (UTC, no off-by-one), and the body HTML displays.
- [ ] A fresh user (no baseline) sees the dot **and** every entry tagged "New".
- [ ] After viewing the page, the dot clears on the next navigation and stays cleared (no lingering for
      the rest of the release day).
- [ ] Adding a new dated markdown file + rebuild makes the dot reappear for an already-caught-up user.
- [ ] (Server variant) the seen endpoint is authenticated, writes only the current user's record, and
      returns `{ ok: true }`; (localStorage variant) the badge is computed client-side with no SSR
      hydration mismatch.
- [ ] The generated module is gitignored and regenerates from a clean clone.
