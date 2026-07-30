---
name: seo
description: Audit and improve a website's search and AI-search visibility one PR at a time — crawlability, indexing, structured data, content, and performance gaps — foundations before refinements, deferring to Google's AI-optimization guide. Use when asked to improve SEO, fix search ranking, audit a site for discoverability, or optimize for AI Overviews. Manual, resumable, one PR per group.
disable-model-invocation: true
user-invocable: true
---

# SEO

Operation manual for auditing and improving the search-engine and AI-search visibility of a website — finding crawlability, indexing, structured-data, content, and performance gaps, then shipping fixes one pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 audits the site for the issues catalogued in [Standard groups](#standard-groups) so the agent can pick the next fix. Only stop to ask the user when the document explicitly says to stop and report (uncommitted changes, a destructive change to canonical URLs, a redirect that would break inbound links, a content rewrite that changes meaning) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR for one group of related fixes, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next SEO PR`, or similar. Never open a second SEO PR while one is already in flight.
>
> **Foundations before refinements.** Crawlability and indexing fixes ship before content and structured-data work — a page that can't be crawled won't benefit from any other change. Finish every foundation group before moving to refinement groups.
>
> **Google's AI optimization guide is the source of truth.** When a recommendation here conflicts with [Google's "Optimizing your website for generative AI features on Google Search"](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), defer to Google. The AI features (AI Overviews, AI Mode) reuse Search's index — a page must be indexed and eligible for a snippet to be eligible for AI surfacing, with no additional technical requirements.
>
> This skill follows the shared `shipping-conventions` loop and `pr-conventions`.

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
- AI-training opt-out policy decisions (whether to allow `Google-Extended`, `GPTBot`, etc.). The agent surfaces the current policy and flags inconsistencies but does not change opt-out posture without explicit user instruction. See [§ 7](./reference.md#7-ai-crawler-policy-decisions).

## Repository / site type

Detect this in Step 1 of the workflow. The shape determines where config and templates live and which build commands the agent runs to verify changes.

- **Static HTML** — plain `.html` files served from a static host. Config lives in repo root (`robots.txt`, `sitemap.xml`). No build step beyond a deploy.
- **Static-site generator** — Astro, Hugo, Eleventy, Jekyll, Gatsby, Docusaurus, VitePress, MkDocs. `robots.txt` and `sitemap.xml` are usually generated or live in the `static/` / `public/` directory. The build produces a `dist/` or `_site/` or `build/` output that the agent inspects to verify the rendered HTML.
- **Server-rendered framework** — Next.js, Nuxt, Remix, SvelteKit, Astro SSR, Rails, Django, Laravel. Metadata and structured data are usually emitted from route components or controllers. Sitemaps are often generated at build time (e.g. Next.js `app/sitemap.ts`).
- **SPA (client-rendered only)** — Vite + React, CRA, plain Vue without SSR. Flag this in the audit and surface the trade-off: Googlebot renders JavaScript so the site **can** be indexed, but rendering is queued (delayed and budgeted), and most non-Google AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, etc.) do not execute JS at all — content that only exists in client-rendered output is invisible to them. The durable fix is SSR / SSG / prerendering for the routes that need to rank or be cited. Don't stop the workflow — proceed with the groups that still apply to a JS-rendered site (`robots.txt`, canonicals, sitemap, `<title>`/meta in the index HTML, structured data injected server-side, performance), and document the SPA-rendering limitation in the audit report so the user can decide on a prerendering strategy separately.

If the site is hosted on a CMS the agent can't edit through the repo (WordPress without a headless setup, Webflow, Shopify theme not exported), stop and report — this guide is for repo-controlled sites.

## Standard groups

Group fixes by category. Each group is **one branch and one PR**. Within a group, ship every related finding from the audit together — don't fragment.

### Foundation groups (ship these first, in this order)

1. **Crawl controls → 1 PR** — `robots.txt`, meta `robots`, `X-Robots-Tag` headers. Catches accidental `Disallow: /`, leftover `noindex` from a staging site, and conflicts between `robots.txt` and on-page directives. See [§ 1](./reference.md#1-crawl-controls-robotstxt-and-meta-robots).

2. **Indexing & canonicals → 1 PR** — canonical URLs, duplicate content, `hreflang` correctness (if present), pagination (`rel=prev/next` is gone — use canonical patterns), trailing-slash consistency, HTTPS-only enforcement. See [§ 2](./reference.md#2-canonicals-and-duplicates).

3. **Sitemaps → 1 PR** — XML sitemap exists, is reachable, is referenced in `robots.txt`, contains only canonical URLs, is under 50,000 URLs / 50 MB, uses absolute URLs, and is regenerated on build. Submit to Search Console only when the file is correct. See [§ 3](./reference.md#3-sitemaps).

### Refinement groups (ship after foundations are clean)

4. **Page metadata → 1 PR per template / route group** — `<title>`, `<meta name="description">`, Open Graph, Twitter Cards, language attribute on `<html>`, viewport meta. One PR per template (e.g. blog post template, product page template, marketing page template) so each ships with a clear scope.

5. **Structured data → 1 PR per schema type** — JSON-LD for `Article`, `BreadcrumbList`, `Organization`, `WebSite` (with `SearchAction`), `FAQPage`, `HowTo`, `Product`, `LocalBusiness` as applicable. Validate every change with the [Rich Results Test](https://search.google.com/test/rich-results) before opening the PR. One PR per schema type because they touch different templates and the failure modes are independent. See [§ 4](./reference.md#4-structured-data).

6. **Content quality → 1 PR per page or content set** — heading hierarchy (one `<h1>`, sequential `<h2>`/`<h3>`), descriptive headings, scannable structure, link text that's not "click here", image `alt` text, no thin content, no AI-generated boilerplate. Use Google's [people-first content guidelines](https://developers.google.com/search/docs/fundamentals/creating-helpful-content). See [§ 5](./reference.md#5-content-quality).

7. **Performance & Core Web Vitals → 1 PR per metric or fix area** — LCP, INP, CLS. Image optimization (`width`/`height`, `loading="lazy"`, modern formats), font loading (`font-display: swap`, preconnect), render-blocking resources, third-party script audit. One PR per distinct fix area (e.g. "image optimization", "font loading", "remove render-blocking CSS"). See [§ 6](./reference.md#6-performance-and-core-web-vitals).

8. **Internal linking & navigation → 1 PR** — breadcrumbs match URL hierarchy, footer/header links audit, orphan pages list, broken internal links, anchor-text variation. Broken-link cleanup may need its own PR if there are more than ~10 broken links.

9. **AI-search accessibility → 1 PR** — content is present in server-rendered HTML (not gated behind JS), key facts live in the first viewport, headings phrase the question the page answers, AI-crawler policy in `robots.txt` matches the team's intent (see [§ 7](./reference.md#7-ai-crawler-policy-decisions)). This group is largely a re-audit of groups 1–6 with an AI lens — open a PR only if it finds gaps the earlier groups didn't fix.

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
   - Apply the fix per the relevant reference section ([§ 1](./reference.md#1-crawl-controls-robotstxt-and-meta-robots)–[§ 7](./reference.md#7-ai-crawler-policy-decisions)).
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
- **Branch-constrained environments** — follow `shipping-conventions` → Branch-constrained environments. If no PR can be opened at all, stop and report. If a designated branch is mandated, never bundle groups into one PR on it — with more than one group remaining, stop and ask for permission to push one `seo/<group-key>` branch per group before doing any work; a single remaining group ships on the designated branch. Resolve this right after the read-only audit, never at PR time.

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

The per-group implementation detail — crawl controls, canonicals, sitemaps, structured data, content
quality, Core Web Vitals, AI-crawler policy, and Google's AI-optimization summary — lives in
[reference.md](./reference.md). Pull in the section for the group you are shipping.
