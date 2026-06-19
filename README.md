# agentic

Operation manuals as installable [Claude Code Agent Skills](https://code.claude.com/docs/en/skills) —
disciplined, reusable workflows for shipping, releasing, hardening, and reviewing OSS software. Each
skill is a self-contained playbook an agent loads and executes, with explicit stop-and-report points.

> **Status:** this repository is being converted from standalone markdown manuals into an installable
> Claude Code skills plugin. The packaging (plugin manifest, marketplace, CI validation) is in place;
> the skills themselves are being migrated under `skills/` one at a time. See
> [`plans`](https://github.com/jaredwray/agentic) and the catalog below as it fills in.

## Install

Once skills are published:

```bash
# In Claude Code:
/plugin marketplace add jaredwray/agentic
/plugin install agentic@agentic
```

Skills then appear in the `/` menu, namespaced as `/agentic:<name>`.

## How skills are organized

Skills live under `skills/<category>/<name>/SKILL.md`:

- **engineering/** — single-deliverable disciplines (review, debug, refactor, test, ADRs, …). These
  are **model-invoked**: the agent reaches for them automatically when the task fits.
- **release-ops/**, **security/**, **growth/**, **project-setup/** — orchestration workflows that
  mutate a repo, open PRs, or run expensive pipelines. These are **manual-only**
  (`disable-model-invocation: true`) and run only when you type the slash command, so a release loop
  or launch pipeline never auto-fires on a vague prompt.
- **shared/** — composable conventions (the one-PR-at-a-time loop, `SECURITY.md` status tracking, PR
  conventions, a requirements interview, and the skill-authoring guide) that the other skills reuse
  instead of duplicating.

## Authoring

See `skills/shared/writing-great-skills` for how to write a SKILL.md that triggers at the right time.

## Development

```bash
node scripts/validate-skills.mjs   # lint frontmatter, links, and manifests (runs in CI)
```

## License

MIT — see [LICENSE](./LICENSE).
