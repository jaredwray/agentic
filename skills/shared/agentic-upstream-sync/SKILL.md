---
name: agentic-upstream-sync
description: Check a repository against the current main of jaredwray/agentic for defense-in-depth and AGENTS.md updates — the copied Safe Chain bootstrap script, the AGENTS.md template sections, and the DEFENSE_IN_DEPTH.md catalog — then refresh stale copies (never locally edited ones) and flag catalog changes for the defense-in-depth skill. Background discipline the dependency-management skill runs on every resume. Use when asked whether a repo's defense-in-depth files or AGENTS.md sections are current with the agentic repo, or to sync them.
user-invocable: true
---

# Agentic upstream sync

Repos hardened with this plugin carry copies of files that live in `jaredwray/agentic` and keep
moving there. `dependency-management` runs this check on every resume, before any upgrade group; on its own it answers "is this repo current with agentic?".

> Refreshing a copy is a chore, not a judgment call: a stale copy is refreshed without asking. A
> locally edited copy and a changed catalog are reported, never overwritten.

## What can drift

| In the target repo | Upstream source on `main` | Kind |
| --- | --- | --- |
| `scripts/setup-cloud-environment.sh` | `skills/security/defense-in-depth/scripts/setup-cloud-environment.sh` | verbatim copy |
| `.claude/hooks/session-start.sh` | `skills/security/defense-in-depth/templates/.claude/hooks/session-start.sh` | verbatim copy |
| `AGENTS.md` sections whose `## ` heading matches a template section (`Safe Chain`, `Pull requests`, …) | `skills/security/defense-in-depth/templates/AGENTS.md` | section copies |
| `DEFENSE_IN_DEPTH.md` catalog — section headings and item lines | the `DEFENSE_IN_DEPTH.md` scaffold in `skills/security/defense-in-depth/reference.md` § 1, with the **Catalog** blocks of `skills/security/defense-in-depth/ecosystems/<name>.md` for each ecosystem and registry on the repo's `Profile:` line | catalog |

A row whose target file is absent does not apply — except `AGENTS.md`, which is created when absent:
its template sections are agent policy for every repo, not only hardened ones. The Safe Chain section
applies only where the Safe Chain bootstrap does: a tracked `pnpm-lock.yaml`, `uv.lock`, `poetry.lock`,
or `requirements*.txt` / `requirements*.in`. Nothing else is compared: `lockdown-repo.sh` and
`check-npmjs.sh` are never copied into a target repo, and templates that are merged rather than copied
(`devcontainer.json`, `environment.json`, `.claude/settings.json`, workflow files) belong to their own
items.

## Compare

1. `git clone --filter=blob:none --quiet https://github.com/jaredwray/agentic "$tmp"` — a fresh clone
   every run, never a cached plugin copy.
2. Verbatim copies: `diff` each verbatim row against upstream. Different → stale. `bash -n` each shell script after a refresh.
3. Sections: for each template section (from its `## ` heading to the next, ignoring blank lines at
   either end), compare the repo's section with the same heading. Identical → current. Absent →
   missing. Different but equal to an earlier upstream revision
   (`git log -p --follow -- skills/security/defense-in-depth/templates/AGENTS.md` in the clone; the
   file moved, so `--follow` reaches its earlier revisions) →
   stale. Different and matching no upstream revision → locally edited.
4. Import: `AGENTS.md` has a template section, or gains one in step 3, and `CLAUDE.md` neither
   imports `AGENTS.md` nor is a symlink to it (or is absent) → missing import.
5. Catalog: assemble the upstream catalog as `defense-in-depth` does — the scaffold, with the § 3
   and § 5 blocks of the rules files the repo's `Profile:` line names in place of its two
   placeholder lines. Compare its section headings and `- [ ]`-style item lines with the repo's
   `DEFENSE_IN_DEPTH.md`, ignoring checkbox state and PR annotations. Any difference, or a `Profile:`
   line that names no ecosystem → catalog drift.

## Act

- Stale verbatim copy or section → replace with the upstream text; missing section → append it,
  creating `AGENTS.md` when absent; missing import → write `@AGENTS.md` as `CLAUDE.md` when that
  file is absent, otherwise add it as the first line. Together these are one PR:
  branch `chore/agentic-sync`, title `<scope> - chore: sync defense-in-depth files from agentic`,
  body listing each file and the upstream commit it now matches. Verify with `bash -n` on
  each shell script; the sections are prose.
- Locally edited section → leave it and list it in the PR body (or the report) with a link to the
  upstream diff, for the user to reconcile.
- Catalog drift → do not edit `DEFENSE_IN_DEPTH.md` here. Report "catalog behind upstream: run
  `defense-in-depth`", which re-audits and ships each new item as its own PR.
- Nothing drifted → one line saying so, then continue.
