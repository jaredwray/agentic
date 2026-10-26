# agentic

Operation manuals served as a remote [MCP](https://modelcontextprotocol.io) server at
[https://agentic.jaredwray.com/mcp](https://agentic.jaredwray.com/mcp). Each skill is a self-contained
playbook an agent loads and follows, with explicit stop-and-report points and one deliverable per
invocation.

The server is public and read-only. It does not authenticate callers.

## Connect

The endpoint speaks Streamable HTTP. Point a client at `https://agentic.jaredwray.com/mcp`.

Claude Code:

```bash
claude mcp add --transport http agentic https://agentic.jaredwray.com/mcp
```

Cursor, every project: open **Customize** in the sidebar, then **MCPs**, and add a global server. That edits `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agentic": { "url": "https://agentic.jaredwray.com/mcp" }
  }
}
```

Save and restart Cursor. The server appears on that MCPs page, where you can turn it off without deleting it.

To share it with one repo instead, put the same entry in `.cursor/mcp.json`. If both files define `agentic`, the project entry wins.

Claude.ai and Claude Desktop: Customize → Connectors → Add custom connector, URL
`https://agentic.jaredwray.com/mcp`, authentication **No sign in**.

A browser will not show a useful page at `/mcp`. `GET /` returns a short plain-text description.
Smoke the protocol with:

```bash
curl -s -X POST https://agentic.jaredwray.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## What the server exposes

- **Tools.** `list_skills` returns the catalog. `get_skill` loads one manual and an index of its
  files. `read_skill_file` reads `reference.md`, a script, or a template when the manual points at
  it. Follow the manual literally.
- **Prompts.** One prompt per skill. The prompt text is the manual body.
- **Resources.** Each file is `skill://<path>`, for example `skill://engineering/code-review/SKILL.md`.
  A path that contains a dot-segment (such as `templates/.github/`) is `agentic://skills/<path>`
  instead, because those paths are outside the `skill://` catalog.

Skills with `disable-model-invocation: true` are reported as **manual**. Load those only when the
user explicitly asks. The others are **model-invoked** and may be loaded when a task matches their
description.

## Written for Claude 5

These skills follow [Anthropic's Claude 5 prompting
guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5),
which changes what a good skill looks like: a Claude 5 model reads instructions literally, already
self-corrects, and defaults to longer output than its predecessors. So the skills here carry **no
self-verification nudges** ("double-check your work" burns tokens on something the model already
does), an **explicit output length** wherever they render a report, an **explicit scope bound** so the
model doesn't expand the task on its own, and — for anything review-shaped — **full coverage first,
filtering second**, because telling a model to flag only the serious issues makes it report less and
lets real problems through.

**Effort.** Effort level is the main intelligence/speed/cost control, and at low or medium a model
scopes strictly to what was asked — which quietly guts a workflow built on breadth. Skills whose value
*is* that breadth carry an `**Effort.**` line in their preamble stating what they need: `xhigh` for
`refactor`, `production-function`, one-way-door `adr`, and `viral-launch`; `high` or above for
`code-review`, `debug`, `performance`, `test`, `codebase-archaeology`, and a `test-audit` audit (its
per-PR gate runs at any level). The mechanical one-PR loops don't carry the note — they run fine at
the default.

The authoring rules behind all of this live in `skills/shared/writing-great-skills`.

## The four failure modes

These skills exist to counter the recurring failure modes of AI-assisted engineering:

- **Misalignment** — the agent builds the wrong thing → `requirements-interview`.
- **Verbosity / no shared language** — over-explaining without domain vocabulary → lean SKILL.md
  bodies, shared `codebase-design` vocabulary, heavy detail deferred to `reference.md`.
- **Non-functional code** — no feedback loop → `production-function`, `test`.
- **Architectural decay** — complexity grows without design → `code-review`, `refactor`, `adr`.

## Catalog

### Dependency management — `skills/<name>/`, manual

These live one level under `skills/` because they are used often.

| Skill | Does |
|---|---|
| `dependency-management-node` | Upgrade Node/pnpm deps one grouped PR at a time — a sync of defense-in-depth files and `AGENTS.md` sections from `jaredwray/agentic` and overrides first, then the dev phase (with a hash-pinned `packageManager`) before runtime, including digest-pinned Dev Container images on a 7-day age gate, and last the AI model IDs the code calls (recommend the provider's latest, bump on approval); npm bumps link Drydock artifact diffs. |
| `dependency-management-rust` | Upgrade Cargo deps one grouped PR at a time — syncing `AGENTS.md` sections and defense-in-depth files from `jaredwray/agentic` first — respecting the toolchain pin and a 7-day age gate on container / Dev Container image pins; last, recommend and bump the AI model IDs the code calls. |

### engineering/ — model-invoked disciplines (one deliverable, then stop)

| Skill | Does |
|---|---|
| `code-review` | Staff-engineer review of a diff/branch/PR — bugs, perf, security, architecture, each finding cited with a fix. |
| `debug` | Diagnose a bug before fixing — ranked hypotheses, evidence, a minimal isolating test. |
| `performance` | Diagnose a slow path before optimizing — bottleneck classification and a ranked win list. |
| `refactor` | Surgical refactor analysis for deployed code — call graph, risks, a safe migration path. |
| `hemingway` | Editing-first pass on a growing change — delete, inline, narrow before adding; a Cut / Simplify / Keep / Smallest Change report. |
| `production-function` | Write one function at a fintech bar — typed, validated, logged, tested, idempotent. |
| `test` | Tests that catch real bugs — a failure-mode inventory, plus which trivial tests to drop. |
| `test-audit` | Whether a test earns its place — a four-question gate every new or changed test passes before its PR, and an evidence-first audit that prunes low-value tests one PR at a time. |
| `adr` | An Architecture Decision Record — options, 10x stress test, recommendation, 2-year regret check. |
| `codebase-archaeology` | Map an unfamiliar codebase — entry points, main flow, safe first changes, risky areas. |
| `codebase-design` | Shared design vocabulary (deep vs shallow, coupling, seams) other skills reach for. |
| `explain` | Explain a concept in three layers — 30-second, 5-minute, and a deep dive. |

### features/ — manual product-feature recipes

| Skill | Does |
|---|---|
| `whats-new` | Scaffold an in-app "What's New" feed — markdown release notes rendered to sanitized HTML at build time, with a quiet "New" indicator that clears on view (localStorage default, optional per-user server variant). |
| `social-pipeline` | Scaffold an AI-assisted social-posting back office — sources → AI-drafted platform posts → a human approval inbox → a scheduling calendar with posting windows → a publishing provider, with idempotent dedup, timezone-correct window scheduling, and a sync-first publishing adapter that keeps the local store and the provider in lockstep. |

### release-ops/ — manual shipping workflows

| Skill | Does |
|---|---|
| `submit-pr` | Open/update one PR — Conventional-Commit title, readable body, driven to green CI, then watch reviews. |
| `release-cut` | Cut a release — find unreleased work, decide semver, generate notes, open one bump PR. Publish stays with the repo's existing workflow. |
| `migrations` | Set up MongoDB migrations with migrate-mongo (changelog ledger, single-writer lock, file-hash change detection, dry-run/plan, `migrate:development`/`migrate:production` scripts) or conform to an existing tool, then author idempotent data/index migrations one PR at a time. |
| `resolve-merge-conflicts` | Resolve merge/rebase conflicts preserving both sides' intent, verified before continuing. |

### security/ — manual

| Skill | Does |
|---|---|
| `defense-in-depth-nodejs` | Harden a Node.js repo against supply-chain compromise — repo lockdown script, pnpm cooldown, pinned + linted CI, digest-pinned Dev Container images, Safe Chain on cloud agents, staged OIDC publishing — one item per PR. |

### growth/ — manual

| Skill | Does |
|---|---|
| `seo` | Audit and improve a site's search / AI-search visibility, one PR per group. |
| `viral-launch` | Build a launch via a fixed 21-agent research → hook → body → adversarial-rewrite pipeline. |

### project-setup/ — manual

| Skill | Does |
|---|---|
| `project-templates` | Set up/audit OSS governance files (LICENSE, SECURITY.md, …) from bundled templates. |
| `setup-repo` | Record a repo's conventions (issue tracker, labels, ADR/CHANGELOG locations) in `AGENTS.md`. |

### shared/ — composable background skills

| Skill | Does |
|---|---|
| `shipping-conventions` | The one-PR-at-a-time loop (sync, work one item, drive CI green, stop, resume) the ops skills reuse. |
| `pr-conventions` | Conventional-Commit types, title-prefix scheme, PR-body skeleton, review-reply rules. |
| `security-status-tracking` | The `DEFENSE_IN_DEPTH.md` status-block format and reconciliation rules. |
| `requirements-interview` | The alignment interview — turn a vague request into an agreed spec before building. |
| `writing-great-skills` | How to author a SKILL.md for this catalog (also the contributor guide). |
| `ai-model-discovery` | Find the AI model IDs a repo calls, look up each provider's catalog and deprecations, and recommend the newest same-tier model — one line per reference, approval per provider before anything changes. |
| `agentic-upstream-sync` | Check a repo's copied defense-in-depth files, `AGENTS.md` template sections, and `DEFENSE_IN_DEPTH.md` catalog against `jaredwray/agentic` `main`; refresh stale copies, add missing `AGENTS.md` sections (creating the file in any repo), report edited ones and catalog drift. |

## Composition

The ops skills don't restate shared conventions — they point at the `shared/` skills. The one-PR loop
lives once in `shipping-conventions`; PR titles/bodies and review replies in `pr-conventions`; the
`DEFENSE_IN_DEPTH.md` tracking format in `security-status-tracking`; AI model lookup and recommendation in
`ai-model-discovery`; the refresh of files copied from this repo in `agentic-upstream-sync`. Engineering skills share a design
language via `codebase-design`. This keeps each SKILL.md lean and the conventions in one place.

## Authoring

See `skills/shared/writing-great-skills`. Descriptions must be 1024 characters or fewer. `pnpm test`
fails if a skill on disk is missing from the catalog.

## Development

Node.js 24, the current LTS. The package manager is pnpm, pinned in `package.json`.

```bash
corepack enable
corepack prepare
pnpm install
pnpm dev          # http://localhost:8787/mcp
pnpm test
pnpm validate
pnpm check
```

`pnpm build` compiles `skills/` into `src/generated/catalog.json`, which the worker bundles. That
file is generated and gitignored. Skills on disk are the source of truth.

## Deploy

A push to `main` runs `.github/workflows/deploy.yml`, which validates, typechecks, tests, and runs
`wrangler deploy`. Pull requests do not deploy.

The workflow cannot create the Cloudflare token or the DNS name. Do this once:

1. `jaredwray.com` is an active zone on the Cloudflare account that will own the worker.
   `agentic.jaredwray.com` must not already have a DNS record. A custom domain cannot attach over an
   existing CNAME. The first deploy creates the record and the certificate.
2. Create an API token (My Profile → API Tokens → Create Custom Token) scoped to account
   `b09b24c345713c704e71dea8bd81f713` and the `jaredwray.com` zone: Account / Workers Scripts / Edit,
   Account / Account Settings / Read, Zone / Workers Routes / Edit. Add Zone / DNS / Edit if the
   first deploy fails to attach the hostname.
3. In the GitHub repo, add the Actions secret `CLOUDFLARE_API_TOKEN`. The account ID is already set
   in the deploy workflow.

`wrangler.jsonc` routes the worker to `agentic.jaredwray.com` and leaves `workers.dev` off.

## License

MIT — see [LICENSE](./LICENSE).
