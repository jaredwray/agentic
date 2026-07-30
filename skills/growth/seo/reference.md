# SEO — reference

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
- `BreadcrumbList` `itemListElement` order matches the URL hierarchy. Set `item` to the absolute URL on every element, **including the last one (the current page)** — Schema.org permits omitting `item` on the trailing element, but the Rich Results Test treats every element with an `item` URL as the cleanest pass, and AI features prefer breadcrumbs where every node is addressable.
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
