---
"agentic": minor
---

Bootstrap Aikido Safe Chain in Claude Code on the web and Codex cloud

`defense-in-depth-nodejs` now covers Claude Code and Codex containers the way it covers Codespaces
and Cursor. A `.claude/settings.json` SessionStart hook runs `setup-cloud-environment.sh` in cloud
sessions only (`CLAUDE_CODE_REMOTE=true`), the script appends the shim `PATH` to `CLAUDE_ENV_FILE` so
every Claude Bash command stays shimmed, and `CLAUDE.md` imports `@AGENTS.md` so Claude reads the
Safe Chain rules. Two `(manual)` items cover the account settings: Codex environments use Manual setup
with the bootstrap as setup and maintenance script, and Claude Code environments allow
`malware-list.aikido.dev`. CODEOWNERS now covers `/.claude/` and `/.codex/`.
