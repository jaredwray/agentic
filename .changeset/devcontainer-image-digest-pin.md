---
"agentic": minor
---

Pin Dev Container images by digest and refresh them on a 7-day window

The defense-in-depth Codespaces template no longer uses `javascript-node:latest`. The greenfield
`image` is a versioned tag pinned by the multi-arch index digest, and the catalog gains a § 2
item to pin existing `devcontainer.json` images the same way — never a digest younger than 7 days,
the same cooldown as pnpm `minimumReleaseAge`. Both dependency-management skills now scan
Dev Container `image` values, pin floating tags, and refresh those pins to the newest digest in
lineage that is at least 7 days old.
