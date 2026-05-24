# Project Templates

Operation manual for setting up a new OSS project with the standard governance, license, and GitHub templates — or auditing an existing project to make sure the same files are present, current, and correctly customized. One file (or one logical group) per pull request.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 audits which templates are missing, drifted, or have unresolved placeholders so the agent can pick the next item from the catalog. Only stop to ask the user when the document explicitly says to stop and report (uncommitted changes, an existing file looks intentionally different from the template, a customization value is ambiguous) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR for one item, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next template PR`, or similar. Never open a second template PR while one is already in flight.
>
> **Templates need customization.** Several files contain `{{PROJECT_NAME}}` placeholders or project-specific values (contact email, copyright holder, install commands). Resolve every placeholder during the copy — never push a template with `{{...}}` still in it.

## Scope

**Scope:** baseline OSS governance files for Node.js/TypeScript packages — `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`.

**Out of scope:** workflow files (`.github/workflows/**`), CODEOWNERS, release-policy files, and agent instruction files (`AGENTS.md`, `CLAUDE.md`). Workflows and CODEOWNERS are covered by [`defense-in-depth-nodejs.md`](./defense-in-depth-nodejs.md) and release-policy files by [`release-management-nodejs.md`](./release-management-nodejs.md). Agent instruction files are repo-specific by design.

## Catalog

All templates live under `templates/` in this repo. The mapping below shows where each template lands in the target repo and what to customize during the copy.

| Source (this repo)                                        | Target path (in the project)                       | Customization                                                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `templates/LICENSE`                                       | `LICENSE`                                          | Confirm copyright holder (default `Jared Wray`); confirm MIT is the intended license.                                                  |
| `templates/SECURITY.md`                                   | `SECURITY.md`                                      | Confirm reporting email (default `me@jaredwray.com`). Preserve any existing `Defense in Depth status` / `Release Management status` blocks below the boilerplate. |
| `templates/CODE_OF_CONDUCT.md`                            | `CODE_OF_CONDUCT.md`                               | Confirm enforcement email (default `me@jaredwray.com`). Do not modify the Contributor Covenant body.                                  |
| `templates/CONTRIBUTING.md`                               | `CONTRIBUTING.md`                                  | Replace every `{{PROJECT_NAME}}` with the repo name (e.g. `keyv`, `cacheable`). Adjust `pnpm install` / `pnpm test` if the project uses a different toolchain. Adjust the release-cadence line if the project does not ship monthly. |
| `templates/.github/PULL_REQUEST_TEMPLATE.md`              | `.github/PULL_REQUEST_TEMPLATE.md`                 | None required. The `../blob/main/` URLs work via GitHub's rewrite — leave them alone.                                                  |
| `templates/.github/ISSUE_TEMPLATE/bug_report.md`          | `.github/ISSUE_TEMPLATE/bug_report.md`             | Optional: adjust `labels:` to match the project's label scheme.                                                                        |
| `templates/.github/ISSUE_TEMPLATE/feature_request.md`     | `.github/ISSUE_TEMPLATE/feature_request.md`        | Optional: adjust `labels:` to match the project's label scheme.                                                                        |

## Priority

When multiple templates are missing, drifted, or need customization, work them in this order — one PR per row, top-to-bottom:

1. `LICENSE` — required for OSS distribution.
2. `SECURITY.md` — required for responsible disclosure.
3. `CODE_OF_CONDUCT.md` — required to set behavior expectations.
4. `CONTRIBUTING.md` — required for contributor onboarding.
5. `.github/PULL_REQUEST_TEMPLATE.md` — improves contribution quality.
6. `.github/ISSUE_TEMPLATE/*` — bug and feature templates ship together in **one** PR.

## Workflow

Run these steps on the **first** invocation, and again on **every resume** when the user says `continue`, `next`, `next template PR`, or similar.

1. **Sync `main`.** Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`.

2. **Audit the target repo.** For each row in the [Catalog](#catalog), assign one of four states:
   - **Missing** — file does not exist at the target path.
   - **Drifted** — file exists but its boilerplate differs from the canonical template in `templates/` in ways that look like an older template snapshot, not intentional per-repo content.
   - **Needs customization** — file exists and matches the template, but contains unresolved placeholders (e.g. `{{PROJECT_NAME}}`) or stale per-repo values (wrong project name, wrong contact email, install commands that don't match the repo's toolchain).
   - **OK** — file exists, matches the template, and customizations are in place.

   When auditing, **respect intentional additions**. Common per-repo extensions to keep:
   - `SECURITY.md` with an appended `Defense in Depth status` or `Release Management status` block.
   - `CONTRIBUTING.md` with extra sections like "Test / Verify Exports" or "Releasing a new version".
   - `LICENSE` with a different copyright holder or a non-MIT body (do **not** overwrite — confirm with the user).

   Report the audit summary before opening any PR.

3. **Pick the next item.** Walk the [Priority](#priority) order. Pick the first row whose state is **Missing**, **Drifted**, or **Needs customization**. If every row is **OK**, stop and report — the project's template baseline is complete.

4. **Open the PR.**
   - Branch from latest `main`. Naming: `chore/templates-<item-key>` (e.g. `chore/templates-license`, `chore/templates-security`, `chore/templates-contributing`, `chore/templates-pr-template`, `chore/templates-issue-templates`).
   - Copy the template file to its target path.
   - Resolve every customization per the [Catalog](#catalog) row:
     - Replace `{{PROJECT_NAME}}` with the target repo name. Never leave a placeholder in.
     - For `CONTRIBUTING.md`, align the install/test commands with the repo's actual toolchain (check `package.json` `scripts` and the lockfile — `pnpm-lock.yaml` → `pnpm`, `package-lock.json` → `npm`, `yarn.lock` → `yarn`).
     - For `CONTRIBUTING.md`, adjust the release-cadence sentence if the project does not ship on a monthly cadence (some projects ship weekly, on-demand, or follow a SemVer release train).
     - For `SECURITY.md`, if the existing file has a `Defense in Depth status` or `Release Management status` block, keep it appended below the refreshed boilerplate.
   - Run local verification:
     - Files are valid plaintext / Markdown (no broken local links).
     - If the repo has a docs site that surfaces these files, run the site build.
   - Open the PR — title and body per [Pull request rules](#pull-request-rules).

5. **Drive CI to green.** Watch CI on the PR. Some repos skip CI on docs-only changes — that's fine, but if any check runs and fails, diagnose, fix, and push until every check is green. **Do not stop on a red PR.**

6. **Check for already-merged.** Before stopping, check whether the PR was merged during CI (auto-merge, user merged manually). If merged, return to Step 1 immediately — do not wait, do not prompt.

7. **Stop and wait.** Report:
   - PR URL and the item implemented.
   - Confirmation that CI is green (or that no CI ran for docs-only changes).
   - What's still pending in the audit (other missing/drifted/customization items).
   - **A literal prompt to resume**, e.g. *"Merge the PR when you're ready, then reply `continue` (or `next`) and I'll open the next template PR."*

   Then wait. Do not open another PR. The workflow resumes only when the user says `continue`, `next`, `next template PR`, or similar — at which point return to Step 1.

## Pull request rules

- **One template per PR**, with one exception: `bug_report.md` and `feature_request.md` ship in a single `chore/templates-issue-templates` PR because they always travel together.
- **Only one open template PR at a time.** If a previous one is still open, drive its CI to green if needed, then stop and wait.
- Every PR uses a unique branch from latest `main`. Branch naming: `chore/templates-<item-key>`.

### Title prefixes

Match the style in `dependency-management-node.md`:

| Scope                                       | Prefix                            |
| ------------------------------------------- | --------------------------------- |
| Monorepo root                               | `mono - chore: templates - `      |
| Cross-package monorepo change               | `mono - chore: templates - `      |
| Specific package (any repo)                 | `<package> - chore: templates - ` |
| Single-package repo with no package name    | `root - chore: templates - `      |

Examples:

- `root - chore: templates - add LICENSE`
- `root - chore: templates - add SECURITY.md`
- `root - chore: templates - add CODE_OF_CONDUCT.md`
- `root - chore: templates - add CONTRIBUTING.md`
- `root - chore: templates - add pull request template`
- `root - chore: templates - add issue templates`
- `keyv - chore: templates - refresh CONTRIBUTING.md`

### PR body

```
## Summary
<one sentence: which template this adds or refreshes>

## Customizations applied
- <e.g. `{{PROJECT_NAME}}` → `keyv`>
- <e.g. updated test command from `pnpm test` to `npm test`>
- <e.g. preserved existing `Defense in Depth status` block in SECURITY.md>

## Reference
project-templates.md § <catalog row>
```

## Auditing an existing project

When this manual runs against a repo that already has some or all of the templates in place, the audit in Workflow Step 2 produces one of four states per file. How to act on each:

- **Missing** → add the file in the next PR per the [Priority](#priority) order.
- **Drifted** → diff the file against the canonical template in `templates/`. If the differences look like template drift (older boilerplate text, formatting changes, structural changes that match an older version of the template), refresh in a PR. If the differences look like intentional per-repo content (additional sections, project-specific advice, alternate license), **stop and ask the user** — never overwrite intentional additions.
- **Needs customization** → resolve placeholders and stale values in a PR. Common findings:
  - `CONTRIBUTING.md` with `{{PROJECT_NAME}}` still in it.
  - `CONTRIBUTING.md` referencing the wrong repo name (e.g. copied from another project without renaming).
  - `CONTRIBUTING.md` claiming a monthly release cadence when the project actually ships on a different schedule.
  - `SECURITY.md` / `CODE_OF_CONDUCT.md` with the wrong reporting email.
  - `LICENSE` with a placeholder copyright holder.
  - `.github/ISSUE_TEMPLATE/*` with labels that don't exist in the target repo.
- **OK** → skip.

### When to escalate to the user

Never overwrite without confirmation when:

- `LICENSE` has a different copyright holder or a non-MIT body. The project may be intentionally licensed differently or owned by a different entity.
- `CONTRIBUTING.md` has extra sections beyond the template (export verification, release process, code style guide). These are almost always intentional — keep them.
- `SECURITY.md` contains a status block (`Defense in Depth status`, `Release Management status`) or a longer disclosure policy. These are intentional and produced by other operation manuals.
- A template file's frontmatter or YAML metadata differs from the canonical version (e.g. issue template `labels:` set to project-specific labels).

For each escalation, report exactly what differs and ask whether to keep the existing content, refresh from template, or merge selectively.

## Customizing the templates

Each template was sourced from a working project and may need light edits for the target repo. Common customizations by file:

### `LICENSE`

- The template is MIT licensed to `Jared Wray`. If the project belongs to a different entity, update the copyright holder.
- The MIT text intentionally has no year; add a year only if the project's existing convention is to include one.
- If the project requires a different license (Apache, BSD, etc.), do **not** use this template — pick the right SPDX text from https://spdx.org/licenses/ and stop running this manual against that repo for the LICENSE item.

### `SECURITY.md`

- Confirm the reporting email (`me@jaredwray.com`) is the right contact for the project owner.
- If the repo already has a `Defense in Depth status` block (from `defense-in-depth-nodejs.md`) or a `Release Management status` block (from `release-management-nodejs.md`), **keep them**. The template boilerplate goes at the top; the status blocks live below.

### `CODE_OF_CONDUCT.md`

- Confirm the enforcement email.
- Do not modify the Contributor Covenant v2.0 body — adapting the policy text defeats the point of using a standard policy.

### `CONTRIBUTING.md`

- Replace every `{{PROJECT_NAME}}` with the target repo name (case-sensitive — match the repo's casing in its README).
- The template assumes `pnpm install` and `pnpm test`. If the repo uses a different package manager or test command, update both occurrences.
- The template advertises a **monthly** release cadence. Adjust the sentence ("We release new versions of this project (maintenance/features) on a monthly cadence…") if the project ships weekly, on-demand, on a SemVer train, or otherwise. If you remove it entirely, leave a one-line note about the project's actual release cadence so contributors know what to expect.
- If the project ships multiple module formats (ESM/CJS/browser) and benefits from an export-verification section like Hookified's, add it after the Pull Request Process section. Keep it out of the base template — it is project-specific.
- If the project has a documented release process the contributor should know about, add a brief `Releasing` section.

### `.github/PULL_REQUEST_TEMPLATE.md`

- The default checklist (Contributing/Code of Conduct followed, tests added with 100% coverage) is intentionally short. Add repo-specific items only when they raise contribution quality (e.g. "ran `pnpm benchmark`", "updated `CHANGELOG.md`").
- The `../blob/main/CONTRIBUTING.md` style URLs are GitHub-rewrite paths from `.github/` to repo root. Do not change them.

### `.github/ISSUE_TEMPLATE/*`

- The `labels:` frontmatter field is set to `bug` and `enhancement`. If the project uses a different label taxonomy (e.g. `kind/bug`, `type:feature`), update to match.
- The bodies are intentionally minimal. Extend only when the project benefits from more structured triage.

## Going beyond templates

These templates are the baseline. Most projects layer additional governance on top — that work is covered by other manuals in this repo:

- **CI workflows, action pinning, CODEOWNERS, pnpm policy** → [`defense-in-depth-nodejs.md`](./defense-in-depth-nodejs.md).
- **Release pipeline, signer policy, trusted publishing, release-intent signing** → [`release-management-nodejs.md`](./release-management-nodejs.md).
- **Dependency upgrades** → [`dependency-management-node.md`](./dependency-management-node.md) (or [`dependency-management-rust.md`](./dependency-management-rust.md) for Rust projects).
- **Agent instruction files (`AGENTS.md`, `CLAUDE.md`)** — repo-specific by design; not templated.

After the template baseline is in place, point the maintainer to those manuals for the next layer of hardening.
