---
"agentic": minor
---

Add a pull-request follow-up section to the defense-in-depth `AGENTS.md` template

The `AGENTS.md` template that `defense-in-depth-nodejs` appends to a target repo now carries a
"Pull requests" section beside "Safe Chain": after opening a PR, an agent waits about 20 minutes for
code reviews to land, then answers every review comment inline — fixing, pushing, and citing the
commit when the finding is valid, or stating the concrete reason when it is not — and repeats after
each push until CI is green and every thread has a reply. The merge rule appends each template
section that is absent.
