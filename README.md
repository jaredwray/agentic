# agentic

Operation manuals as installable [Claude Code Agent Skills](https://code.claude.com/docs/en/skills) —
disciplined, reusable workflows for shipping, releasing, hardening, and reviewing OSS software. Each
skill is a self-contained playbook an agent loads and executes, with explicit stop-and-report points,
one deliverable per invocation.

## Install

Pick the method that matches what you're doing. After any of them, skills appear in the `/` menu
namespaced as `/agentic:<name>`.

### 1. From GitHub — recommended for everyday use

```bash
# In Claude Code:
/plugin marketplace add jaredwray/agentic
/plugin install agentic@jaredwray
```

Or from your shell:

```bash
claude plugin marketplace add jaredwray/agentic
claude plugin install agentic@jaredwray --scope user   # user (default) | project | local
```

Scopes: **`user`** enables it across all your projects; **`project`** writes to the repo's
`.claude/settings.json` so everyone who clones the repo gets it; **`local`** is this project only and
gitignored.

### 2. From a local clone — to test your own edits before publishing

```bash
git clone https://github.com/jaredwray/agentic
# In Claude Code, point the marketplace at the clone (the dir containing .claude-plugin/):
/plugin marketplace add ./agentic
/plugin install agentic@jaredwray
```

Marketplace installs are **copied into a cache**, so edits to the clone are *not* live — re-sync with
`/plugin marketplace update jaredwray` then `/plugin update agentic@jaredwray`.

### 3. As a live skills directory — for active development

Clone (or symlink) the repo into a skills directory:

```bash
git clone https://github.com/jaredwray/agentic ~/.claude/skills/agentic         # personal: all projects
# or project-scoped, shared via the repo:  <your-project>/.claude/skills/agentic
```

On the next session it loads in place as `agentic@skills-dir` — no install step, and **edits to any
`SKILL.md` take effect immediately**. Run `/reload-plugins` (or restart) after changing non-skill
files. Remove it with `claude plugin disable agentic@skills-dir` or by deleting the folder.

### Model-invoked vs. manual

The **engineering** and **shared** skills are *model-invoked* — the agent reaches for them
automatically when a task fits. The **features, release, security, growth, and project-setup** skills
are *manual-only* (`disable-model-invocation`) so a money-moving or repo-mutating workflow never fires
on a vague prompt; run those with the slash command.

## Updating — will installs pull my changes?

It depends on how it was installed:

| Install method | Picks up new commits when… |
|---|---|
| GitHub / local-path **marketplace** (methods 1–2) | **Not automatically.** Installs are cached, and `plugin.json` pins a `version`, so installers update **only when you bump that version**, then run `/plugin marketplace update jaredwray` + `/plugin update agentic@jaredwray`. Bump it with `npx @changesets/cli version` (runs `scripts/sync-plugin-version.mjs`). |
| **Skills directory** clone (method 3) | **Immediately.** It's read in place — `git pull` (or your own edit) is live for any `SKILL.md`; run `/reload-plugins` for other components. |

> **Want every pushed commit to be an update for marketplace installs, with no version bumps?** Remove
> the `version` field from `.claude-plugin/plugin.json`. Claude Code then keys updates off the git
> commit SHA, so `/plugin update` always pulls the latest commit. The trade-off is you lose controlled,
> semver'd releases — which is why `version` is set by default here.


## The four failure modes

These skills exist to counter the recurring failure modes of AI-assisted engineering:

- **Misalignment** — the agent builds the wrong thing → `requirements-interview`.
- **Verbosity / no shared language** — over-explaining without domain vocabulary → lean SKILL.md
  bodies, shared `codebase-design` vocabulary, heavy detail deferred to `reference.md`.
- **Non-functional code** — no feedback loop → `production-function`, `test`.
- **Architectural decay** — complexity grows without design → `code-review`, `refactor`, `adr`.

## Catalog

### engineering/ — model-invoked disciplines (one deliverable, then stop)

| Skill | Does |
|---|---|
| `code-review` | Staff-engineer review of a diff/branch/PR — bugs, perf, security, architecture, each finding cited with a fix. |
| `debug` | Diagnose a bug before fixing — ranked hypotheses, evidence, a minimal isolating test. |
| `performance` | Diagnose a slow path before optimizing — bottleneck classification and a ranked win list. |
| `refactor` | Surgical refactor analysis for deployed code — call graph, risks, a safe migration path. |
| `production-function` | Write one function at a fintech bar — typed, validated, logged, tested, idempotent. |
| `test` | Tests that catch real bugs — a failure-mode inventory, plus which trivial tests to drop. |
| `adr` | An Architecture Decision Record — options, 10x stress test, recommendation, 2-year regret check. |
| `codebase-archaeology` | Map an unfamiliar codebase — entry points, main flow, safe first changes, risky areas. |
| `codebase-design` | Shared design vocabulary (deep vs shallow, coupling, seams) other skills reach for. |
| `explain` | Explain a concept in three layers — 30-second, 5-minute, and a deep dive. |

### features/ — manual product-feature recipes (`/agentic:<name>`)

| Skill | Does |
|---|---|
| `whats-new` | Scaffold an in-app "What's New" feed — markdown release notes rendered to sanitized HTML at build time, with a quiet "New" indicator that clears on view (localStorage default, optional per-user server variant). |
| `social-pipeline` | Scaffold an AI-assisted social-posting back office — sources → AI-drafted platform posts → a human approval inbox → a scheduling calendar with posting windows → a publishing provider, with idempotent dedup, timezone-correct window scheduling, and a sync-first publishing adapter that keeps the local store and the provider in lockstep. |

### release-ops/ — manual shipping workflows (`/agentic:<name>`)

| Skill | Does |
|---|---|
| `submit-pr` | Open/update one PR — Conventional-Commit title, readable body, driven to green CI, then watch reviews. |
| `release-cut` | Cut a release — find unreleased work, decide semver, generate notes, open one bump PR. |
| `release-management-nodejs` | Roll out a hardened npm publish pipeline (signing, trusted publishing) one PR at a time. |
| `dependency-management-node` | Upgrade Node/pnpm deps one grouped PR at a time, dev phase before runtime. |
| `dependency-management-rust` | Upgrade Cargo deps one grouped PR at a time, respecting the toolchain pin. |
| `resolve-merge-conflicts` | Resolve merge/rebase conflicts preserving both sides' intent, verified before continuing. |

### security/ — manual

| Skill | Does |
|---|---|
| `defense-in-depth-nodejs` | Harden a high-download npm package against supply-chain compromise, one item per PR. |

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
| `security-status-tracking` | The `SECURITY.md` status-block format and reconciliation rules. |
| `requirements-interview` | The alignment interview — turn a vague request into an agreed spec before building. |
| `writing-great-skills` | How to author a SKILL.md for this plugin (also the contributor guide). |

## Composition

The ops skills don't restate shared conventions — they point at the `shared/` skills. The one-PR loop
lives once in `shipping-conventions`; PR titles/bodies and review replies in `pr-conventions`; the
`SECURITY.md` tracking format in `security-status-tracking`. Engineering skills share a design
language via `codebase-design`. This keeps each SKILL.md lean and the conventions in one place.

## Authoring

See `skills/shared/writing-great-skills` for how to write a SKILL.md that triggers at the right time:
frontmatter fields, writing a discoverable `description`, the lean-body-plus-`reference.md` structure,
the model-invoked vs manual rule, and the conventions CI enforces.

## Development

```bash
node scripts/validate-skills.mjs   # frontmatter, links, discoverability, and manifests (runs in CI)
```

The validator is dependency-free. Versioning uses [Changesets](https://github.com/changesets/changesets)
via `npx`; `scripts/sync-plugin-version.mjs` keeps `.claude-plugin/plugin.json` in step with
`package.json`.

## License

MIT — see [LICENSE](./LICENSE).
