---
"agentic": minor
---

Require ASD-STE100 Simplified Technical English in the `AGENTS.md` template and clean up its sections

The `AGENTS.md` template gets a new "Simplified Technical English" section. It tells agents to write
documentation, code comments, commit messages, pull request and issue text, review replies, and
changelog entries in ASD-STE100. The section lists the core rules: approved words, at most 20 words
in an instruction and 25 in a description, one instruction in each sentence, active voice, simple
tenses, and noun clusters of at most three words. It applies only to text that an agent adds or
changes.

The template's other sections are rewritten in STE, and their headings stay the same, so the sync
sees the old copies as stale and refreshes them. Safe Chain tells the agent to stop and report when
Safe Chain blocks a package, instead of trying a different route. Pull requests becomes a numbered
loop that answers questions and fixes failed CI without skipping tests. Test audit now comes before
Pull requests, because the gate runs before the pull request opens.

`agentic-upstream-sync` ignores blank lines at either end of a section when it compares sections. An
unedited copy followed by a repo's own section therefore counts as stale, not as locally edited. It
also checks the `CLAUDE.md` import on every run, not only when `AGENTS.md` gets a new section. The
dependency-management skills open the `chore/agentic-sync` PR when the sync changes any file.
`defense-in-depth-nodejs` refers to "every template section" and no longer keeps its own list of
section names.
