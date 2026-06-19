---
name: setup-repo
description: Configure a repo's working conventions for these skills — issue tracker (GitHub / Linear / local files), label taxonomy, docs locations (ADR directory, CHANGELOG path), default branch, and PR settings — and record them so the other skills read consistent values. Use when first adopting this plugin in a repo, or when asked to set up labels, choose an issue tracker, or decide where ADRs and changelogs live. Manual; writes a conventions block to the repo.
disable-model-invocation: true
user-invocable: true
---

# Set Up Repo

Operation manual for configuring how these skills operate in a given repository, and recording the
choices so every other skill reads the same values instead of guessing. Run this once when adopting
the plugin in a repo; re-run to change a setting.

> **When this document is loaded, begin executing immediately.** Start with Step 1. This skill asks a
> few setup questions (it is one of the few that legitimately interviews the user), records the
> answers, and stops. It does not open feature PRs.
>
> **Detect before asking.** Infer each setting from the repo first; only ask to confirm a guess or to
> resolve a genuine ambiguity. Don't make the user answer what the repo already tells you.

## What it configures

| Setting | Detect from | Used by |
|---|---|---|
| **Issue tracker** — GitHub Issues, Linear, or local `docs/` files | `.github/`, a Linear link in the README, existing issue templates | planning / triage skills |
| **Label taxonomy** — the bug/enhancement/etc. label set | existing repo labels | any skill that opens or files issues/PRs |
| **ADR directory** — where Architecture Decision Records live | an existing `docs/adr/` or `docs/decisions/` | `adr` |
| **CHANGELOG path** — whether a changelog is kept, and where | a root `CHANGELOG.md`, Changesets config | `release-cut` |
| **Default branch** — `main` / `master` | `git symbolic-ref refs/remotes/origin/HEAD` | every PR-loop skill |
| **Package manager** — pnpm / npm / yarn (Node) | the lockfile | dependency / release skills |

## Workflow

1. **Detect.** Inspect the repo for each row above and record the detected value (or "none found").
   Resolve the default branch with `git symbolic-ref --short refs/remotes/origin/HEAD`. Read existing
   labels (`mcp__github__get_label` / repo settings) for the label taxonomy.

2. **Confirm and fill gaps.** Present the detected values in one message. Ask only about settings that
   are missing or ambiguous — e.g. "No ADR directory found; use `docs/adr/`?" or "Issue tracker —
   GitHub Issues (detected `.github/`) or Linear?". Use sensible defaults (`docs/adr/`, `CHANGELOG.md`,
   the detected default branch) so a user can accept everything at once.

3. **Record the conventions.** Write the agreed values into a `## Agentic conventions` section in the
   repo's `AGENTS.md` (create the file if absent; preserve any existing content). This is the single
   place the other skills read. Use a stable, parseable shape:

   ```md
   ## Agentic conventions
   - Issue tracker: GitHub Issues
   - Labels: bug, enhancement, documentation, security
   - ADR directory: docs/adr/
   - CHANGELOG: CHANGELOG.md
   - Default branch: main
   - Package manager: pnpm
   ```

4. **Create what's missing, only if asked.** If the user wants the ADR directory or a label set
   created now, do it (one small PR, following `shipping-conventions` and `pr-conventions`). Otherwise
   just record the intended values — the skills that need them will create them on first use.

5. **Stop and report.** Summarize the recorded conventions and where they live (`AGENTS.md`). Note that
   other skills now read these values, and that re-running this skill updates them.

## Notes

- **Other skills read `AGENTS.md`'s `Agentic conventions` block** for these values; keep its shape
  stable so they can parse it. When a skill needs a value that isn't recorded, it falls back to the
  detection rules above and may suggest running `setup-repo`.
- This skill is the one place a setup interview is expected — elsewhere, prefer detection and sensible
  defaults over asking.
