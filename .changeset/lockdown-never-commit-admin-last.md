---
"agentic": minor
---

Keep lockdown-repo.sh out of target repos; admin runs it last

`defense-in-depth-nodejs` now states this strictly: `lockdown-repo.sh` is never
copied or committed into a target repo (it lives only in this skill). A repo
admin runs apply last, after every earlier catalog item including every
`(manual)` task. The agent still audits with `--check` and records the result;
it never applies settings itself. CI fails if the skill, reference, or script
drop those rules or say manuals do not block lockdown.
