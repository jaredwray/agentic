---
"agentic": minor
---

Add a pull-request follow-up section to the defense-in-depth `AGENTS.md` template

The `AGENTS.md` template that `defense-in-depth-nodejs` appends to a target repo now carries a
"Pull requests" section beside "Safe Chain": after opening a PR, an agent waits about 20 minutes for
code reviews to land, then answers every comment that carries a finding inline — fixing, pushing,
and citing the commit when it is valid, or stating the concrete reason when it is not — skipping only
echoes, approvals, pleasantries, and status-only bot notices, and repeats after each push until CI is
green. The merge rule appends each template section that is absent, and the Safe Chain item
reconciles as done only when both sections are present.
