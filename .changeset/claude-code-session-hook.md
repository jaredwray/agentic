---
"agentic": minor
---

Run the Claude Code Safe Chain bootstrap from a SessionStart hook script

Claude Code on the web now runs `.claude/hooks/session-start.sh` (cloud sessions only) with a 600s
timeout, and the install log goes to stderr so it is not injected into the session. `.gitignore`
must keep `.claude/settings.json` and `.claude/hooks/` tracked; a blanket `.claude` ignore cannot
be negated. Shim `PATH` stays in `setup-cloud-environment.sh`, written before the bootstrap can
fail.
