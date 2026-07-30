---
"agentic": minor
---

Audit every skill against Anthropic's Claude 5 prompting guidance

- `writing-great-skills` gains a **Writing for Claude 5** section — the authoring rules the rest of
  this change applies (no self-verification nudges, state the output length, constrain the scope,
  full-coverage-then-filter for review work, say exactly what you mean, don't over-instruct, note the
  effort level, require a concrete spec for UI work).
- `code-review` splits its single hunt-and-judge step into a full-coverage sweep followed by a
  separate filter-and-severity pass, so candidates are no longer dropped while the diff is still
  being read; the "double-check you actually looked" self-verification nudge is gone.
- Added an `**Effort.**` note to the skills whose deliverable depends on breadth: `refactor`,
  `production-function`, `adr`, `viral-launch` (xhigh), and `code-review`, `debug`, `performance`,
  `test`, `codebase-archaeology` (high or above).
- Added an explicit output-length rule to `performance`, `refactor`, `test`,
  `codebase-archaeology`, and `hemingway`, which rendered a report format with no length bound.
- `resolve-merge-conflicts` now states that the diff contains resolutions only — no opportunistic
  cleanup of code read on the way.
- `whats-new` and `social-pipeline` now lift a concrete visual spec (tokens, components, states) out
  of the target app during the interview step instead of relying on generic taste direction, and
  `social-pipeline` maps draft status onto existing semantic colors with a label rather than color
  alone.
- Fixed three cross-references that pointed at bare filenames (`refactor.md`, `adr.md`) instead of
  skill names, and replaced the vague "be conservative" in `release-cut`'s non-conventional-commit
  fallback with the actual rule (classify every commit; the bump is the highest one any commit forces).
