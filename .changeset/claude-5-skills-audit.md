---
"agentic": minor
---

Audit every skill against Anthropic's Claude 5 prompting guidance, and cut the over-instruction it found

The guidance changes what a good skill looks like: a Claude 5 model reads instructions literally,
already self-corrects, and defaults to longer output than its predecessors. Hand-holding written for
older models now costs quality instead of adding it.

**Defects fixed**

- `code-review` dropped candidates mid-read ("if the failure mode cannot be named in one sentence,
  drop it"), which is the instruction shape that makes a model under-report. Step 3 now sweeps every
  category recording every candidate; a new Step 4 filters and assigns severity as a separate pass.
- Removed the "double-check you actually looked" self-verification nudge — Opus 5 already
  self-corrects, so the nudge only burns tokens.
- Fixed three cross-references pointing at bare filenames that don't exist (`refactor.md`, `adr.md`
  ×2); a literal-minded model tries to open the path and fails.
- Replaced the vague "be conservative" in `release-cut`'s non-conventional-commit fallback with the
  actual rule: classify every commit, the bump is the highest one any commit forces.

**Cut — SKILL.md shrinks 6,013 → 4,657 lines (-23%)**

SKILL.md is what loads when a skill triggers, so this is the number that matters.

- Split the four skills that carried their whole implementation spec inline into `SKILL.md` +
  `reference.md`, the structure this repo already documents: `release-management-nodejs` (971 → 203),
  `defense-in-depth-nodejs` (438 → 249), `seo` (397 → 203).
- The dependency-management skills restated `shipping-conventions` and `pr-conventions` at length
  while also linking to them — 53% of their lines were verbatim identical to each other. Replaced the
  restatement with the pointer: node 318 → 203, rust 321 → 205.
- Every skill that rendered a report carried both a "Rules for the rendered X" list and an
  anti-pattern section restating the same rules. Merged them across 9 files; the genuinely-unique
  items fold in as one-liners.
- Trimmed `submit-pr` § 7, `resolve-merge-conflicts`, and `requirements-interview` to the items their
  own preambles and the shared skills don't already state.

**Added, deliberately**

- `writing-great-skills` gains a "Writing for Claude 5" section — the authoring rules the rest of
  this change applies, so future skills don't reintroduce the same gaps.
- An `**Effort.**` note on the nine skills whose deliverable depends on breadth (`xhigh` for
  `refactor`, `production-function`, one-way-door `adr`, `viral-launch`; `high` or above for
  `code-review`, `debug`, `performance`, `test`, `codebase-archaeology`). Effort is the primary
  intelligence control and low/medium scopes strictly to what was asked.
- An explicit output-length rule on the five skills that rendered a report format with no length
  bound, since lowering effort does not shorten a response.
- `whats-new` and `social-pipeline` now lift a concrete visual spec (named tokens, existing
  components, real states) out of the target app instead of relying on generic taste direction, which
  only swaps one fixed house style for another. `social-pipeline` pairs each status color with a
  label rather than encoding status by color alone.
- `resolve-merge-conflicts` now states that the diff contains resolutions only.
