# SEO

Operation manual for auditing and improving the search-engine and AI-search visibility of a website — finding crawlability, indexing, structured-data, content, and performance gaps, then shipping fixes one pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 audits the site for the issues catalogued in [Standard groups](#standard-groups) so the agent can pick the next fix. Only stop to ask the user when the document explicitly says to stop and report (uncommitted changes, a destructive change to canonical URLs, a redirect that would break inbound links, a content rewrite that changes meaning) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR for one group of related fixes, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next SEO PR`, or similar. Never open a second SEO PR while one is already in flight.
>
> **Foundations before refinements.** Crawlability and indexing fixes ship before content and structured-data work — a page that can't be crawled won't benefit from any other change. Finish every foundation group before moving to refinement groups.
>
> **Google's AI optimization guide is the source of truth.** When a recommendation here conflicts with [Google's "Optimizing your website for generative AI features on Google Search"](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), defer to Google. The AI features (AI Overviews, AI Mode) reuse Search's index — a page must be indexed and eligible for a snippet to be eligible for AI surfacing, with no additional technical requirements.

## Scope and summary

**Scope:** SEO and AI-search optimization for a static or server-rendered website (marketing site, docs site, blog, product site). The agent:

1. Detects the site's shape (static-site generator, framework-rendered, plain HTML) and where the relevant config files live.
2. Audits the site against [Standard groups](#standard-groups) — crawlability, indexing, structured data, content, performance, internal linking, accessibility-as-SEO.
3. Assigns each finding a state: **Missing**, **Broken**, **Drifted**, or **OK**.
4. Picks the highest-priority non-OK group and opens one PR for the fixes in that group.
5. Drives CI to green, then stops and waits for the merge.

**Out of scope:**

- Off-page SEO (link building, outreach, backlinks, social signals).
- Paid search, Google Ads, Bing Ads.
- Migrations between domains or platforms (a migration is a project, not a maintenance task — handle separately).
- Analytics setup beyond Search Console / Bing Webmaster verification (GA4, telemetry, attribution belong elsewhere).
- Localization / hreflang strategy beyond verifying that an existing hreflang implementation is technically correct.
- AI-training opt-out policy decisions (whether to allow `Google-Extended`, `GPTBot`, etc.). The agent surfaces the current policy and flags inconsistencies but does not change opt-out posture without explicit user instruction. See [§ 7](#7-ai-crawler-policy-decisions).

## Repository / site type

Detect this in Step 1 of the workflow. The shape determines where config and templates live and which build commands the agent runs to verify changes.

- **Static HTML** — plain `.html` files served from a static host. Config lives in repo root (`robots.txt`, `sitemap.xml`). No build step beyond a deploy.
- **Static-site generator** — Astro, Hugo, Eleventy, Jekyll, Gatsby, Docusaurus, VitePress, MkDocs. `robots.txt` and `sitemap.xml` are usually generated or live in the `static/` / `public/` directory. The build produces a `dist/` or `_site/` or `build/` output that the agent inspects to verify the rendered HTML.
- **Server-rendered framework** — Next.js, Nuxt, Remix, SvelteKit, Astro SSR, Rails, Django, Laravel. Metadata and structured data are usually emitted from route components or controllers. Sitemaps are often generated at build time (e.g. Next.js `app/sitemap.ts`).
- **SPA (client-rendered only)** — Vite + React, CRA, plain Vue without SSR. Flag this in the audit. AI bots and many traditional crawlers do **not** execute JavaScript — content that only exists in client-rendered output is invisible. The fix is bigger than this guide (move to SSR / SSG / prerendering); surface the gap and stop.

If the site is hosted on a CMS the agent can't edit through the repo (WordPress without a headless setup, Webflow, Shopify theme not exported), stop and report — this guide is for repo-controlled sites.

## Standard groups

Group fixes by category. Each group is **one branch and one PR**. Within a group, ship every related finding from the audit together — don't fragment.

### Foundation groups (ship these first, in this order)

1. **Crawl controls → 1 PR** — `robots.txt`, meta `robots`, `X-Robots-Tag` headers. Catches accidental `Disallow: /`, leftover `noindex` from a staging site, and conflicts between `robots.txt` and on-page directives. See [§ 1](#1-crawl-controls-robotstxt-and-meta-robots).

2. **Indexing & canonicals → 1 PR** — canonical URLs, duplicate content, `hreflang` correctness (if present), pagination (`rel=prev/next` is gone — use canonical patterns), trailing-slash consistency, HTTPS-only enforcement. See [§ 2](#2-canonicals-and-duplicates).

3. **Sitemaps → 1 PR** — XML sitemap exists, is reachable, is referenced in `robots.txt`, contains only canonical URLs, is under 50,000 URLs / 50 MB, uses absolute URLs, and is regenerated on build. Submit to Search Console only when the file is correct. See [§ 3](#3-sitemaps).

### Refinement groups (ship after foundations are clean)

4. **Page metadata → 1 PR per template / route group** — `<title>`, `<meta name="description">`, Open Graph, Twitter Cards, language attribute on `<html>`, viewport meta. One PR per template (e.g. blog post template, product page template, marketing page template) so each ships with a clear scope.

5. **Structured data → 1 PR per schema type** — JSON-LD for `Article`, `BreadcrumbList`, `Organization`, `WebSite` (with `SearchAction`), `FAQPage`, `HowTo`, `Product`, `LocalBusiness` as applicable. Validate every change with the [Rich Results Test](https://search.google.com/test/rich-results) before opening the PR. One PR per schema type because they touch different templates and the failure modes are independent. See [§ 4](#4-structured-data).

6. **Content quality → 1 PR per page or content set** — heading hierarchy (one `<h1>`, sequential `<h2>`/`<h3>`), descriptive headings, scannable structure, link text that's not "click here", image `alt` text, no thin content, no AI-generated boilerplate. Use Google's [people-first content guidelines](https://developers.google.com/search/docs/fundamentals/creating-helpful-content). See [§ 5](#5-content-quality).

7. **Performance & Core Web Vitals → 1 PR per metric or fix area** — LCP, INP, CLS. Image optimization (`width`/`height`, `loading="lazy"`, modern formats), font loading (`font-display: swap`, preconnect), render-blocking resources, third-party script audit. One PR per distinct fix area (e.g. "image optimization", "font loading", "remove render-blocking CSS"). See [§ 6](#6-performance-and-core-web-vitals).

8. **Internal linking & navigation → 1 PR** — breadcrumbs match URL hierarchy, footer/header links audit, orphan pages list, broken internal links, anchor-text variation. Broken-link cleanup may need its own PR if there are more than ~10 broken links.

9. **AI-search accessibility → 1 PR** — content is present in server-rendered HTML (not gated behind JS), key facts live in the first viewport, headings phrase the question the page answers, AI-crawler policy in `robots.txt` matches the team's intent (see [§ 7](#7-ai-crawler-policy-decisions)). This group is largely a re-audit of groups 1–6 with an AI lens — open a PR only if it finds gaps the earlier groups didn't fix.

### Cross-cutting (open only when triggered)

- **Search Console / Bing Webmaster verification → 1 PR** — when a verification file or `<meta>` tag needs adding. Trivial, low risk; ship as a standalone PR so the verification can be confirmed in the respective console before any further work.
- **Redirect cleanup → 1 PR** — when broken inbound links or moved URLs need 301s. Be **extremely careful**: a wrong redirect can break inbound traffic. Surface every redirect rule to the user before opening the PR.

## Workflow

Run these steps on the **first** invocation, and again on **every resume** when the user says `continue`, `next`, `next SEO PR`, or similar.

1. **Sync `main` and detect site shape.**
   - Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work.
   - `git checkout main && git pull --ff-only origin main`.
   - Detect the site type per [Repository / site type](#repository--site-type). Record it (static / SSG / SSR / SPA / CMS). If SPA-only or CMS-out-of-repo, stop and report.
   - Identify the live site URL (from `package.json` `homepage`, repo README, deployed-preview comment on recent PRs, or ask the user).

2. **Audit the site.** For each group in [Standard groups](#standard-groups), assign one of four states:
   - **Missing** — the artifact does not exist (no `robots.txt`, no sitemap, no structured data on a template that should have it).
   - **Broken** — the artifact exists but is invalid (sitemap returns 404, JSON-LD fails the Rich Results Test, canonical points at a 404, `robots.txt` accidentally blocks everything).
   - **Drifted** — the artifact exists and parses, but is stale or incorrect (sitemap missing recent URLs, canonical points at an old domain, meta description duplicated across many pages).
   - **OK** — the artifact exists, is valid, and matches the intent.

   Audit tools to run, in order, depending on what's available:

   - `curl -s -A 'Googlebot' https://<site>/robots.txt` — fetch as Googlebot.
   - `curl -sI https://<site>/<path>` — inspect response headers (`X-Robots-Tag`, `Content-Type`, redirects).
   - View source on representative pages (one per template) — check `<title>`, `<meta name="description">`, `<link rel="canonical">`, `<html lang>`, JSON-LD `<script type="application/ld+json">`, viewport meta, heading order.
   - Build the site locally (`pnpm build` / `npm run build` / `hugo` / etc.) and inspect the built output if metadata is generated at build time.
   - Run the [Rich Results Test](https://search.google.com/test/rich-results) on representative URLs (manual; surface the URL to the user if the agent can't reach it from sandbox).
   - Run [PageSpeed Insights](https://pagespeed.web.dev/) on representative URLs for Core Web Vitals (manual; surface the URL).
   - Check Search Console (if the user has provided access) for indexing errors, manual actions, and the "Pages" report.

   Report the audit summary before opening any PR — a per-group table with state, the specific findings, and the proposed fix.

3. **Pick the next group.** Walk [Standard groups](#standard-groups) in order. Pick the first group whose state is **Missing**, **Broken**, or **Drifted**. If every group is **OK**, stop and report — the site's SEO baseline is complete.

4. **Open the PR.**
   - Branch from latest `main`. Naming: `seo/<group-key>` (e.g. `seo/robots`, `seo/canonicals`, `seo/sitemap`, `seo/metadata-blog`, `seo/structured-data-article`, `seo/content-<slug>`, `seo/perf-images`, `seo/internal-linking`, `seo/ai-accessibility`, `seo/verification`, `seo/redirects`).
   - Apply the fix per the relevant reference section ([§ 1](#1-crawl-controls-robotstxt-and-meta-robots)–[§ 7](#7-ai-crawler-policy-decisions)).
   - **Never change canonical URLs, redirect rules, or `robots.txt` `Disallow` directives without explicit user approval.** These can break inbound traffic or de-index live pages. Surface the proposed change in chat, wait for approval, then apply.
   - **Never add `noindex` to a page that currently ranks.** If a page must be removed from the index, surface it to the user — there are usually better options (canonicalize, 301, content fix).
   - Run local verification:
     - Build the site if there's a build step.
     - Re-fetch the changed pages locally and confirm the expected markup.
     - For structured-data PRs, paste the rendered JSON-LD into the Rich Results Test before opening the PR (or surface the local URL for the user to test).
     - For sitemap changes, verify the file parses as XML and every URL returns 2xx.
   - Open the PR — title and body per [Pull request rules](#pull-request-rules).

5. **Drive CI to green.** If the repo has CI, watch it. Many doc / content sites skip CI on content-only changes — that's fine, but if any check runs and fails, diagnose, fix, and push until every check is green. **Do not stop on a red PR.**

6. **Check for already-merged.** Before stopping, check whether the PR was merged during CI (auto-merge, user merged manually). If merged, return to Step 1 immediately — do not wait, do not prompt.

7. **Stop and wait.** Report to the user with exactly these four things:
   - PR URL and the group fixed.
   - Confirmation that CI is green (or that no CI ran).
   - Audit status of remaining groups (missing / broken / drifted / OK).
   - **A literal prompt to resume**, e.g. *"Merge the PR when you're ready, then reply `continue` (or `next`) and I'll open the next SEO PR."* For PRs that change indexing behavior (canonicals, robots, sitemap), also surface: *"After merge, request reindexing in Search Console for the affected URLs."*

   Then **wait**. Do not open another PR. The workflow resumes only when the user says `continue`, `next`, `next SEO PR`, or similar — at which point return to Step 1.

## Pull request rules

- **One group per PR.** Don't combine unrelated groups. Don't fragment a clear group across multiple PRs unless [Standard groups](#standard-groups) splits it explicitly (e.g. per-template metadata, per-schema-type structured data, per-fix-area performance).
- **Only one open SEO PR at a time.** If a previous SEO PR is still open, drive its CI to green if needed, then stop and wait.
- Every PR uses a unique branch from latest `main`.
- If the environment can't create separate branches or PRs (sandbox, single-branch session), stop and report. Don't bundle groups onto one branch as commits.

### Title prefixes

| Scope                                       | Prefix                  |
| ------------------------------------------- | ----------------------- |
| Site-wide change                            | `seo: `                 |
| Specific template / route                   | `seo(<template>): `     |
| Specific page                               | `seo(<slug>): `         |

Examples:

- `seo: fix robots.txt blocking marketing pages`
- `seo: add sitemap.xml and reference from robots.txt`
- `seo(blog-post): add Article JSON-LD and canonical`
- `seo(pricing): rewrite meta description and h1`
- `seo: add BreadcrumbList structured data`
- `seo: optimize hero images (LCP)`
- `seo: verify site in Google Search Console`

### PR body

Keep PR bodies short. Use this skeleton, omitting sections that don't apply:

```
## Summary
<one sentence: what's fixed and why>

## Changes
- <bullet per file or per fix>

## Verification
- [ ] Built locally and inspected rendered HTML
- [ ] Rich Results Test passes for <URL> (structured-data PRs only)
- [ ] Sitemap parses and every URL is 2xx (sitemap PRs only)
- [ ] Lighthouse / PageSpeed Insights score for <URL>: <before> → <after> (perf PRs only)

## Post-merge
<only when relevant — e.g. "Request reindexing for /pricing in Search Console" or "Submit updated sitemap in Search Console">
```

Don't add commentary beyond the skeleton unless something surprising came up (e.g. a third-party script that resists removal).

### High-blast-radius PRs

These need explicit user approval **before** the PR is opened, not just before merge:

- Any change to `<link rel="canonical">` values or canonical strategy.
- Any change to `robots.txt` that adds, removes, or modifies a `Disallow` or `Allow` rule.
- Any change that adds `noindex` to a page that's currently indexed.
- Any new or changed 301/302 redirect rule.
- Any change to the `hreflang` cluster on a multilingual site.

For these, surface the diff and the impact in chat, get a `lgtm` / `ship it`, then open the PR.

---

## Reference

### 1. Crawl controls (robots.txt and meta robots)

**Goal:** the right pages are crawlable, the wrong pages aren't, and the directives don't contradict each other.

**robots.txt rules**

- Lives at the site root: `https://<site>/robots.txt`. Must be reachable (200 OK) and served as `text/plain`.
- Use `Disallow` to keep crawlers out of admin areas, search-result pages, and infinite-faceted-navigation URLs. **Don't** use `Disallow` to hide content from the index — a disallowed URL can still be indexed (just without content); use `noindex` for that.
- Reference the sitemap with `Sitemap: https://<site>/sitemap.xml` at the bottom of the file.
- Test changes with a robots.txt tester before merging. A stray `Disallow: /` is the single most common way to de-index a whole site.

**meta robots / X-Robots-Tag**

- Default is `index, follow` — no tag needed.
- Use `<meta name="robots" content="noindex">` on pages that should not appear in search results (thank-you pages, internal search-result pages, gated content's gate page).
- Use `X-Robots-Tag: noindex` HTTP header for non-HTML resources (PDFs, images) that shouldn't be indexed.
- **Never combine** `Disallow` in `robots.txt` with `noindex` on the same page — if the page is disallowed, the crawler can't see the `noindex` and the page can end up indexed anyway. Pick one: `noindex` (and allow crawling) to remove from index, or `Disallow` (and accept it may be indexed URL-only) to save crawl budget.

**Common findings**

- `Disallow: /` left over from a staging deploy → fix immediately, request reindex.
- `User-agent: *` block followed by a permissive `User-agent: Googlebot` block that the team thinks overrides it — verify, the most specific match wins, not the most permissive.
- Conflicting `meta robots` and `X-Robots-Tag` headers → reconcile.

### 2. Canonicals and duplicates

**Goal:** every URL has exactly one canonical, and the canonical resolves to a 200.

**Rules**

- Every indexable page has `<link rel="canonical" href="https://<absolute-url>">` in `<head>`, with the absolute URL (including protocol and host).
- A page's canonical points to itself unless it's a deliberate duplicate (e.g. `?utm_source=…` query-string variants point at the clean URL; pagination pages point at themselves, not page 1).
- Pick one of trailing-slash or no-trailing-slash and enforce it sitewide with 301s. Don't have `/about` and `/about/` both reachable.
- Pick one of `www.` or apex and enforce it sitewide with 301s.
- Force HTTPS everywhere (301 from HTTP).
- `hreflang` (if present) must be reciprocal — every language variant lists every other variant, including itself. A missing reciprocal is the most common `hreflang` bug.

**Common findings**

- Canonical points at a 404 → fix the canonical or fix the URL.
- Canonical points at the staging domain → fix in the framework's site config.
- Multiple canonicals in one page (often from a CMS + a theme) → keep the framework's, remove the duplicate.
- `?ref=` / `?utm_*` URLs canonicalize to themselves instead of the clean URL → fix.

### 3. Sitemaps

**Goal:** Google and Bing can discover every canonical URL on the site.

**Rules**

- One `sitemap.xml` at the root, or a sitemap index referencing per-section sitemaps.
- Lists **only canonical, indexable, 200-OK URLs**. No `noindex` pages, no redirects, no 404s, no non-canonical variants.
- Uses absolute URLs (`https://<host>/<path>`), not relative.
- Under 50,000 URLs and 50 MB uncompressed per sitemap file. Split into a sitemap index if larger.
- `<lastmod>` reflects real content changes, not build-time stamps. A `<lastmod>` that updates on every deploy gets ignored by Google.
- Referenced in `robots.txt` (`Sitemap:` directive).
- Regenerated on every build for SSG/SSR sites. For static-HTML sites, regenerate as part of the deploy.
- Submit the sitemap URL in Google Search Console and Bing Webmaster Tools (manual, one-time per property).

**Common findings**

- Sitemap includes `noindex` pages → strip them at generation time.
- `<lastmod>` is "now" on every URL → wire it to git history or content-mtime instead.
- Sitemap returns 200 but is empty → check the generator.

### 4. Structured data

**Goal:** AI features and rich results have explicit, machine-readable context for the page.

**Format**

- Use **JSON-LD** inside `<script type="application/ld+json">` in `<head>` or just before `</body>`. Don't use Microdata or RDFa for new work — JSON-LD is what Google recommends and what the validator targets.
- Validate every page template with the [Rich Results Test](https://search.google.com/test/rich-results) and the [Schema.org validator](https://validator.schema.org/) before merging.

**Types to ship, by page kind**

| Page kind                | Required types                                  | Optional types                                          |
|--------------------------|--------------------------------------------------|--------------------------------------------------------|
| Home / site root         | `WebSite` (with `SearchAction` if you have search), `Organization` | `BreadcrumbList` (usually skipped on root) |
| Blog post / article      | `Article` (or `BlogPosting` / `NewsArticle`)     | `BreadcrumbList`, `Person` (author)                    |
| Documentation page       | `TechArticle` or `Article`                       | `BreadcrumbList`                                       |
| Product page             | `Product` (with `offers`, `aggregateRating`)     | `BreadcrumbList`, `Review`                             |
| FAQ page                 | `FAQPage`                                        | `BreadcrumbList`                                       |
| How-to / tutorial        | `HowTo`                                          | `BreadcrumbList`                                       |
| Local business           | `LocalBusiness` (or specific subtype)            | `Organization`, `PostalAddress`, `OpeningHoursSpecification` |
| Event                    | `Event`                                          | `Place`, `Offer`                                       |
| Recipe                   | `Recipe`                                         | `Person` (author), `AggregateRating`                   |
| Video                    | `VideoObject`                                    |                                                        |

**Rules**

- The structured data must reflect content **actually visible on the page**. Don't add `FAQPage` markup with questions that aren't shown to users — Google treats that as spam.
- `Article.headline` ≤ 110 characters, matches the visible `<h1>`.
- `Article.datePublished` and `Article.dateModified` use ISO 8601 (`2026-05-16T10:00:00-07:00`).
- `Article.author` is an object with `@type: Person` and a `name`, not a string.
- `Article.image` is an array of absolute URLs at 16:9, 4:3, and 1:1 ratios when possible — Google picks one.
- `BreadcrumbList` `itemListElement` order matches the URL hierarchy, last element is the current page (no `item` URL on the last one is fine).
- `Organization` lives once, on the home page. Include `name`, `url`, `logo` (absolute URL, at least 112×112), `sameAs` (array of social profile URLs).

### 5. Content quality

**Goal:** content is clear, structured, original, and answers a specific user question. Google's people-first content guidelines apply equally to AI features.

**Structure**

- One `<h1>` per page, and it matches the user-visible title.
- `<h2>` and `<h3>` are sequential and descriptive — phrase them as questions or topics the page answers (this maps directly to how AI Overviews extract content).
- The first paragraph answers the page's primary question in 1–3 sentences. AI features and featured snippets extract from the top of the page disproportionately.
- Sections are scannable: short paragraphs, lists where lists fit, tables for comparisons.
- Lead with the answer, then add depth. Don't bury the conclusion.

**Writing**

- Write for humans first. Avoid keyword stuffing — modern Google ignores it at best, penalizes it at worst.
- No AI-generated boilerplate that adds no information. "In today's fast-paced world…" content is the textbook example of unhelpful filler.
- Original information, original analysis, or original perspective. If the page can't say something a hundred competitors don't already say, it's thin content.
- Author byline + credentials on YMYL ("Your Money or Your Life") topics — health, finance, legal. E-E-A-T (experience, expertise, authoritativeness, trustworthiness) signals matter most here.
- Date the page (`datePublished` / `dateModified` in JSON-LD **and** visible to the user). Stale-looking content underperforms even when accurate.

**Links and accessibility**

- Link text describes the destination ("read the deployment guide", not "click here").
- Images have descriptive `alt` text (decorative images get `alt=""`, never omitted).
- Images have explicit `width` and `height` attributes (also a CLS fix — see [§ 6](#6-performance-and-core-web-vitals)).
- Tables have `<th>` headers and a `<caption>` where it adds clarity.

### 6. Performance and Core Web Vitals

**Goal:** the site passes Core Web Vitals on the URLs that matter (home, top entry pages, top conversion pages).

**Metrics to optimize**

- **LCP (Largest Contentful Paint)** — target < 2.5 s. Usually a hero image or large text block.
- **INP (Interaction to Next Paint)** — target < 200 ms. Replaced FID in 2024.
- **CLS (Cumulative Layout Shift)** — target < 0.1. Usually caused by images without dimensions, web fonts swapping, or late-loading ads.

**Fix areas (one PR per area)**

- **Images** — set `width` and `height` on every `<img>`. Use `loading="lazy"` on below-fold images, `loading="eager"` and `fetchpriority="high"` on the LCP image. Serve modern formats (`.webp`, `.avif`) with `<picture>` fallbacks. Use `srcset` for responsive images. Compress.
- **Fonts** — preconnect to the font host, use `font-display: swap`, self-host where possible, subset to the characters actually used. Avoid more than two font families.
- **Render-blocking resources** — inline critical CSS, defer non-critical JS, remove unused CSS. Audit with Lighthouse's "Eliminate render-blocking resources" check.
- **Third-party scripts** — every embedded widget, analytics tag, A/B testing snippet, chat bubble, and pixel costs INP. Audit them. Move what can move to `async` or `defer`. Remove what's unused.
- **Server response time (TTFB)** — target < 600 ms. Cache HTML at the edge if possible. Slow TTFB tanks LCP automatically.

**Measurement**

- [PageSpeed Insights](https://pagespeed.web.dev/) gives lab + field data.
- Lighthouse in DevTools gives lab data locally.
- Search Console's "Core Web Vitals" report gives field data from real users (Chrome UX Report).
- Don't optimize a metric to a number in one tool while ignoring field data — field data is what ranking uses.

### 7. AI crawler policy decisions

**Goal:** the site's `robots.txt` reflects an intentional, not accidental, policy on AI training and AI search.

**The bots and what they do**

| Bot                      | Purpose                                                          | Blocking effect on Search ranking? |
|--------------------------|------------------------------------------------------------------|------------------------------------|
| `Googlebot`              | Google Search crawl + index                                      | Blocking removes you from Search and from AI Overviews / AI Mode (AI features reuse the Search index). **Never block.** |
| `Google-Extended`        | Opt-out from Google's generative AI training (Gemini, Vertex)    | **No effect on Search ranking** or on AI Overviews / AI Mode eligibility. Block only if the team wants to opt out of training. |
| `GPTBot`                 | OpenAI's training crawler                                        | Independent of Google. Block only to opt out of OpenAI training. |
| `OAI-SearchBot`          | OpenAI ChatGPT Search retrieval (not training)                   | Blocking removes you from ChatGPT Search citations. Different policy decision from `GPTBot`. |
| `ChatGPT-User`           | On-demand fetch when a user clicks a link in ChatGPT             | Blocking prevents user-triggered fetches. |
| `PerplexityBot`          | Perplexity crawl                                                 | Blocking removes you from Perplexity citations. |
| `ClaudeBot` / `anthropic-ai` | Anthropic Claude crawlers                                  | Blocking removes content from Claude's training / retrieval (see Anthropic's docs for current behavior). |
| `Bingbot`                | Bing Search (and Copilot citations)                              | Blocking removes you from Bing and from Copilot. **Never block** unless intentional. |

**Decision rules for the agent**

- **Never block `Googlebot` or `Bingbot`.** If the current `robots.txt` blocks either, surface it as a likely bug and ask the user before fixing.
- **Don't change the AI-training opt-out posture without explicit user instruction.** Whether to block `Google-Extended` / `GPTBot` / `ClaudeBot` is a business decision, not a technical one. Surface the current state in the audit.
- **Flag inconsistencies.** Common ones: blocking `GPTBot` but allowing `OAI-SearchBot` is intentional (allows search citations, blocks training); blocking `OAI-SearchBot` but allowing `GPTBot` is almost always a bug.
- **A single `User-agent: *` block applies to crawlers that didn't get their own block.** If the team wants to block all AI training crawlers, the cleanest pattern is one block per named bot, then a permissive `User-agent: *` for everything else.

**AI-accessibility checklist (the group-9 PR)**

- Page content is in the server-rendered HTML, not gated behind JS execution. View source on a page — if the main content doesn't appear, AI bots can't see it.
- Key facts (definitions, prices, dates, conclusions) appear in the first viewport's worth of HTML.
- Headings phrase the question the section answers ("How much does X cost?" beats "Pricing details"). AI Overviews quote sections that look like answers.
- Tables and lists are real `<table>` / `<ul>` elements, not divs styled to look like them.
- The page has structured data describing what it is (see [§ 4](#4-structured-data)).

---

## Best practices summary (from Google's AI optimization guide)

Distilled from [Google's official guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide):

1. **AI features reuse Search.** To appear in AI Overviews or AI Mode, a page must be indexed and eligible to appear in Search with a snippet. There are no extra technical requirements — fix Search-eligibility first, AI surfacing follows.
2. **Make content crawlable.** Don't block `Googlebot`. Don't put critical content behind JS-only rendering. Serve clean, semantic HTML.
3. **Use existing structured data.** Article, Product, FAQPage, HowTo, Breadcrumb, Organization, WebSite. Don't invent AI-specific schemas — Google explicitly says there is no special schema for AI features.
4. **Write people-first content.** Original, helpful, written for the user. Avoid AI-generated filler that adds no information.
5. **Provide clear structure.** Headings, paragraphs, lists. A page that's easy for humans to scan is easy for AI to extract from.
6. **Be technically sound.** Fast, mobile-friendly, accessible, no broken links, no broken canonicals. The page-experience signals that mattered in Search still matter for AI features.
7. **Trust signals matter.** Author bylines on YMYL content, dates, citations to primary sources, an `Organization` schema that ties pages to a real entity.
8. **AI-training opt-outs (`Google-Extended`) do not affect Search ranking or AI Overviews / AI Mode eligibility.** They affect only whether the content is used to train generative models. Decide that policy on its own merits.
