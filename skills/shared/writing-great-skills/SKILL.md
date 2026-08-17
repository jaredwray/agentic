---
name: writing-great-skills
description: How to author a great SKILL.md for this plugin — frontmatter fields, writing a description that triggers at the right time, the lean-body-plus-on-demand-reference structure, the model-invoked vs manual-only rule, the Claude 5 authoring rules (no self-verification nudges, explicit output length, constrained scope, full-coverage-then-filter for reviews, effort notes), and the checks CI enforces. Use when adding a new skill, editing an existing skill's frontmatter or structure, or reviewing a skill contribution.
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
(`shipping-conventions`), PR titles/bodies and review replies (`pr-conventions`), and
`DEFENSE_IN_DEPTH.md` status tracking (`security-status-tracking`).

**Cross-references.** Refer to *another* skill by its name in backticks (e.g. "defer to the
`code-review` skill"), not by a relative file path — paths are fragile across the category tree and
break during migration. Point at a skill's *own* supporting files with real markdown links so CI can
verify them — a link whose target is `./reference.md` for the reference, and a `./scripts/<file>`
path (with the leading `./`) for a bundled helper. CI requires those targets to exist. A bare
`scripts/<file>` is treated as a path in the *target* repo (what the ops skills create), so it is not
checked.

**Discoverability.** Every category directory under `skills/` must be listed in
`.claude-plugin/plugin.json`'s `skills` array, or its skills won't load. CI enforces this.

## Writing for Claude 5

Skills written for older models hand-hold, and that hand-holding now *costs* quality: a Claude 5
model reads instructions literally, already self-corrects, and defaults to longer output than its
predecessors. Per [Anthropic's Claude 5 prompting
guides](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5),
apply these when writing or revising a skill.

- **No self-verification nudges.** Never write "double-check", "verify your answer", "re-read your
  work before responding", or "make sure you actually looked". The model already catches and fixes
  its own mistakes; the instruction only burns tokens and can make it second-guess a correct result.
  *Verifying a claim about the code* — running the test, searching for the caller — is different and
  stays: that is evidence, not self-review.
- **State the output length.** Turning effort down does not shorten a response; only asking does.
  Every skill that renders a report says how long it should be — "keep prose tight, a finding is a
  sentence not a paragraph", "≤ 5 sentences", "one line per entry". A skill with an output format but
  no length rule ships a bloated deliverable.
- **Constrain the scope explicitly.** Claude 5 will expand a task on its own — adding steps, fixing
  what it noticed on the way, generalizing the ask. Every skill states its bound ("one review per
  invocation", "make only the change this item requires — no opportunistic refactors") and what
  belongs to a *different* skill.
- **Full coverage first, filter second — for anything review-shaped.** Telling a model to "only flag
  the serious issues" or "be conservative" makes it report *less*, and real problems slip through.
  Structure review, audit, and inventory workflows as two passes: sweep every category and record
  every candidate without judging importance, then cut and rank in a separate step. Never fold the
  filter into the sweep.
- **Say exactly what you mean.** The model will not infer the broader intent behind a hint. Name the
  file, the command, the format. Refer to another skill by its name in backticks (`code-review`) —
  never as a bare filename like `code-review.md`, which reads as a real path the agent will try to
  open and fail to find.
- **Don't over-instruct.** Repeating a rule in the preamble, the workflow step, the output rules, and
  an anti-pattern list does not reinforce it — it dilutes all four. State each rule once, in the place
  the agent needs it. When a new rule earns its place, check whether it is already written somewhere
  else in the same file.
- **Note the effort level when the work needs depth.** Effort is the main
  intelligence/speed/cost control, and at low or medium a model scopes strictly to what was asked —
  which quietly guts a workflow built on breadth (five ranked hypotheses, a full call graph, a
  21-agent pipeline). Skills like those carry a one-line `**Effort.**` note in the preamble saying
  what they need and what goes shallow below it. Mechanical loops don't need the note.

  The note addresses **whoever invokes the skill** — effort is per-request, so a running agent cannot
  raise its own. What the agent owes is honesty: if you can tell you are below the level asked for,
  label the deliverable thin rather than presenting it as complete.
- **For UI work, require a concrete spec.** On an open-ended frontend brief a model settles into one
  house style, and generic direction ("cleaner", "not that color") just swaps it for a different fixed
  style. A skill that scaffolds UI asks for the real spec — the app's type scale, spacing, color
  tokens, component precedents, and interaction states — and builds against that.

## Before you open the PR

Run the validator and fix everything it flags:

```bash
node scripts/validate-skills.mjs
```

It checks: required frontmatter and kebab-case name matching the folder; the description budget;
unique names; that every relative link and `reference.md`/`scripts/` pointer resolves; that
supporting files aren't orphaned; that the manifests parse; that orchestration-category skills
are manual-only; and that `npm publish` / `npm stage publish` tarball paths in skills are prefixed
with `./` (npm 11+ otherwise treats `dir/file.tgz` as GitHub `owner/repo` shorthand).
