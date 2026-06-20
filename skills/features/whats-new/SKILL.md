---
name: whats-new
description: Add an in-app "What's New" feed to any app — user-facing release notes authored as markdown, rendered to sanitized HTML at build time, shown on a page with an unobtrusive "New" indicator that clears once the user has seen it. Scaffolds the five parts to fit the target stack — a markdown content folder, a build-time generator, a typed feed module with seen/unseen helpers, the page/view, and the badge wiring — defaulting to a no-backend localStorage "seen" marker, with an optional per-user server-side variant when the app already has auth and a user store. Use when asked to add a what's new feed, in-app changelog, release-notes or product-updates page, or a "see what changed" / "what's new" indicator. Manual; scaffolds files and opens one PR.
disable-model-invocation: true
user-invocable: true
---

# What's New

Operation manual for adding the in-app **"What's New"** feature to an app: a page that lists
user-facing release notes (authored as markdown, rendered to sanitized HTML at build time) plus a
small **"New" indicator** that draws attention until the user has seen the latest entry. One feature
per invocation; the deliverable is a single PR that scaffolds the feature into the target repo,
adapted to its stack.

> **When this document is loaded, begin executing immediately.** Start with [Workflow](#workflow)
> Step 1 — a short requirements interview to learn the target stack. Only stop to ask the user when a
> step says to, or when a decision genuinely needs their input (e.g. the seen-tracking strategy, or
> an ambiguous place to put the page).
>
> **Persona.** Act as a product engineer shipping a small, polished feature. The bar is "feels native
> to this app": match the app's existing routing, styling, data-access, and build conventions rather
> than importing simple-tracker's. Taste matters — the indicator should be quiet, and the page should
> read like the rest of the product.
>
> **One feature per invocation.** Scaffold the feature, drive its PR to green, then stop. Do not also
> start writing a backlog of release notes — seed exactly one entry and hand authoring back to the user.
>
> This skill is **framework-agnostic**: it carries the pattern and the design decisions, not a set of
> Next.js files. Translate every part into the target app's idioms. It follows the shared
> `shipping-conventions` one-PR loop and `pr-conventions` for the PR, and gathers requirements with
> `requirements-interview`.

## What you're building

Five parts, wired together. The [reference](./reference.md) specifies each one in detail.

1. **Content folder** — `content/whats-new/*.md`, one markdown file per note (`title` + `date`
   frontmatter; the filename is the stable slug).
2. **Generator** — a build-time step that parses those files, renders each body to **sanitized** HTML,
   sorts newest-first, and emits a typed module (no markdown dependency or filesystem needed at runtime).
3. **Feed module** — the `WhatsNewEntry` type and the seen/unseen helpers that decide whether the
   indicator shows and which entries are tagged "New".
4. **Page/view** — lists the entries as dated cards and injects the prebuilt HTML.
5. **"New" indicator** — a quiet dot on the nav entry pointing at the page, plus a "mark seen" action
   the page fires on view so the dot clears.

## Scope

**In scope:** scaffolding the five parts above into the target repo, adapted to its framework, styling
system, build pipeline, and (for the server variant) its auth and user store; wiring the generator
into the build; gitignoring the generated module; seeding **one** example entry; and verifying the
feature end-to-end.

**Out of scope:** writing the ongoing release-note copy (that's the user's job after this ships);
redesigning the app's navigation or design system; a developer-facing changelog or marketing
changelog (this feature is the *in-app, user-facing* one). If the app has no place for a nav entry or
no notion of "a user viewing the app", stop and confirm the approach before scaffolding.

## Workflow

1. **Interview & detect the stack.** Use `requirements-interview` to keep this short. Establish:
   framework and language; where pages/routes and shared components live; the styling system; how the
   build runs (so the generator can hook in); and **whether the app has authentication and a per-user
   record** — this decides the seen-tracking strategy in Step 2. Confirm the page's route and where
   the nav entry/indicator belongs. Report what you found before scaffolding.

2. **Choose the seen-tracking strategy.** Default to the **localStorage** variant — no backend, works
   in any app. Use the **per-user server-side** variant only when the app already has auth + a user
   record *and* the user wants the indicator to follow them across devices. When in doubt, take the
   localStorage default and say so. Both variants are specified in the [reference](./reference.md) § 6.

3. **Create the content format + first entry.** Add `content/whats-new/` with one seed file named
   `YYYY-MM-DD-welcome.md`, frontmatter `title` + `date`, and a short friendly body. Follow the
   authoring format in the [reference](./reference.md) § 2.

4. **Write the generator.** Implement the build-time markdown→sanitized-HTML step that emits the typed
   feed module, sorted newest-first. **Escape all text and restrict link hrefs to safe schemes even
   though the content is maintainer-authored.** Follow the algorithm in the [reference](./reference.md)
   § 3, in the target language. Prefer the app's existing markdown tooling if it already has a trusted
   one; otherwise the small zero-dependency renderer in the reference keeps the build lean.

5. **Write the feed module + helpers.** Define `WhatsNewEntry` and the helpers
   (`entryPublishedAt`, `latestWhatsNewAt`, `laterOf`, `hasUnseenWhatsNew`, `isEntryUnseen`). Get the
   **end-of-day-UTC** and **baseline** semantics right — they are the difference between an indicator
   that behaves and one that flickers. See the [reference](./reference.md) § 4.

6. **Build the page + indicator.** Render the entries as dated cards (format dates in **UTC** to match
   the source), inject the prebuilt HTML, tag unseen entries "New", show the quiet dot on the nav
   entry, and fire "mark seen" on view. **Capture the seen baseline before marking seen**, so entries
   that were new on arrival stay tagged for this view. See the [reference](./reference.md) § 5.

7. **Wire the build + ignore the generated file.** Run the generator before dev/build/test (and
   document a manual command), and add the generated module to `.gitignore` so it is rebuilt, never
   committed. See the [reference](./reference.md) § 7.

8. **Verify end-to-end.** Run the generator, build, load the page, and confirm: entries render in the
   right order with safe HTML; the dot shows for a fresh user and clears after viewing; dates read
   correctly. Work the [reference](./reference.md) § 10 checklist.

9. **Ship one PR.** Open a single PR per `shipping-conventions` and `pr-conventions`, drive CI to
   green, then stop and report — including how to author the next note (add a markdown file and
   rebuild) and which seen-tracking variant you used.

## Reference

The full specification — data shape, generator algorithm, helper semantics and the reasoning behind
them, both seen-tracking variants, per-stack adaptation notes, and the verification checklist — lives
in [reference.md](./reference.md). Pull the relevant section as each workflow step needs it.
