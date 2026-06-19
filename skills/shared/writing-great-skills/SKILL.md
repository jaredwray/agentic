---
name: writing-great-skills
description: How to author a great SKILL.md for this plugin — frontmatter fields, writing a description that triggers at the right time, the lean-body-plus-on-demand-reference structure, the model-invoked vs manual-only rule, and the checks CI enforces. Use when adding a new skill, editing an existing skill's frontmatter or structure, or reviewing a skill contribution.
user-invocable: true
---

# Writing great skills

The authoring guide for skills in this repo. It is also the contributor reference: a new skill is
"done" when it follows the structure below and passes `node scripts/validate-skills.mjs`.

## What a skill is

A skill is a folder under `skills/<category>/<name>/` containing a `SKILL.md` with YAML frontmatter
and a markdown body. The folder name **is** the invocation name and must match the frontmatter
`name` (kebab-case). Large skills add sibling supporting files (`reference.md`, `scripts/`) that load
only when the body points at them.

These skills exist to counter four failure modes of AI-assisted engineering:

- **Misalignment** — the agent builds the wrong thing. Counter: interrogate the request first
  (`requirements-interview`).
- **Verbosity** — the agent lacks shared language and over-explains. Counter: lean bodies, shared
  vocabulary (`codebase-design`), heavy detail deferred to `reference.md`.
- **Non-functional code** — no feedback loop. Counter: tests and production rigor
  (`test`, `production-function`).
- **Architectural decay** — complexity grows without design. Counter: review and intentional design
  (`code-review`, `refactor`, `adr`).

## Frontmatter

```yaml
---
name: my-skill                      # required; kebab-case; must equal the folder name
description: <what it does + when to use it + trigger words>   # required; <= 1536 chars
disable-model-invocation: true      # optional; true = only runs when typed as /agentic:my-skill
user-invocable: true                # optional; default true
allowed-tools: [Bash, Read]         # optional; pre-approved tools
argument-hint: "[base branch]"      # optional; autocomplete hint
---
```

### Writing the description (the most important field)

The description is the only thing the model sees when deciding whether to reach for a skill. Write
**what it does + when to use it + the words a user would actually say**:

> Staff-engineer-grade review of a diff … Use when asked to review code, review a PR, critique a
> diff, or check a change before merge.

- Lead with the capability, then the triggers. Include natural phrasings ("what changed", "is this
  slow", "cut a release").
- Keep it under the 1536-char budget; CI fails over it. Be specific, not exhaustive.
- Don't describe implementation; describe the job and the moment to invoke it.

### Model-invoked vs manual-only — the safety rule

- **Discipline skills** produce one artifact in chat and are read-only or apply-only-on-request
  (review, debug, test, explain, ADRs, design vocabulary). Leave them **model-invoked** so the agent
  reaches for them automatically.
- **Orchestration skills** mutate the repo, open PRs, or run expensive pipelines (release,
  dependency, defense-in-depth, SEO, project-templates, viral-launch). Set
  `disable-model-invocation: true` so they fire **only** when explicitly invoked — a release loop or
  launch pipeline must never auto-start from a vague prompt. CI enforces this for every skill under
  `release-ops/`, `security/`, `growth/`, and `project-setup/`.

## Body structure (lean, with on-demand detail)

Keep `SKILL.md` to what's needed to **start and run** the skill:

1. **Preamble** — the immediate-execute trigger, the persona, and the hard invariants
   (one-per-invocation, stop points).
2. **Scope** — in / out of scope.
3. **Workflow** — numbered steps, with explicit stop-and-report points.
4. **A short pointer** to `reference.md` for the heavy detail.

Move to `reference.md`: output-format templates, cheat-sheet tables, anti-pattern lists, long
catalogs. Move to `scripts/`: any shell scripts the workflow checks into a target repo. Point at them
from the workflow step that needs them ("render per `reference.md` § 1") so they load on demand.

Reuse the `shared/` skills instead of restating conventions: the one-PR loop
(`shipping-conventions`), PR titles/bodies and review replies (`pr-conventions`), and `SECURITY.md`
status tracking (`security-status-tracking`).

**Cross-references.** Refer to *another* skill by its name in backticks (e.g. "defer to the
`code-review` skill"), not by a relative file path — paths are fragile across the category tree and
break during migration. Point at a skill's *own* supporting files with real markdown links so CI can
verify them — a link whose target is `./reference.md` for the reference, and a `./scripts/<file>`
path (with the leading `./`) for a bundled helper. CI requires those targets to exist. A bare
`scripts/<file>` is treated as a path in the *target* repo (what the ops skills create), so it is not
checked.

**Discoverability.** Every category directory under `skills/` must be listed in
`.claude-plugin/plugin.json`'s `skills` array, or its skills won't load. CI enforces this.

## Before you open the PR

Run the validator and fix everything it flags:

```bash
node scripts/validate-skills.mjs
```

It checks: required frontmatter and kebab-case name matching the folder; the description budget;
unique names; that every relative link and `reference.md`/`scripts/` pointer resolves; that
supporting files aren't orphaned; that the manifests parse; and that orchestration-category skills
are manual-only.
