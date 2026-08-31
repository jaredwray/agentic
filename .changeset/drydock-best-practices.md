---
"agentic": minor
---

Align release-management with the staged Drydock publishing model, and document Drydock best practices end to end

Now that [Drydock](https://drydock.org) is in active use, the skills are reconciled with its
documented setup so nothing in the catalog can produce a weaker configuration than the one
defense-in-depth already enforces.

**`release-management-nodejs` catches up to stage-only publishing.** Its § 14 workflow already
staged (`pnpm stage publish`), but the sections around it still described a live-publish trusted
publisher — following § 16 as written produced exactly the config `check-npmjs.sh` fails. Now:

- § 16 configures the trusted publisher **stage-only** with the real command
  (`npm trust github <pkg> --repo <owner>/<repo> --file publish.yml --env npm-publish
  --allow-stage-publish`, npm ≥ 11.15.0), explains that omitting `--allow-publish` is what removes
  live-publish authority, and ends with the `check-npmjs.sh` verification
  (`createStagedPackage`-only).
- § 1 adds artifact review as a fifth thing a valid release proves, with its own trust-table row;
  § 2's invariants require the stage-only publisher and human 2FA promotion after Drydock review;
  § 3 Mode A lists staging + Drydock review as required.
- § 15 names Drydock's Workflow Gate as the concrete custom deployment protection rule for the
  `npm-publish` environment — GitHub App, artifact upload with `SHA256SUMS` before the gated job,
  verify-then-stage of the exact downloaded files, fail closed.
- § 20 gains an incident path for a red Drydock report: never promote, reject on npm, treat
  unexplained changes as a build-path compromise, re-sign and stage fresh — never re-stage the
  same bytes.
- The SKILL.md Phase 3 catalog now tracks the stage-only publisher, the Drydock connection, and
  reviewing/promoting the staged prerelease as explicit items.

**`defense-in-depth-nodejs` § 5 gains the connection spec.** The `(manual)` Drydock item now says
exactly what to hand Drydock: a granular npm token scoped **Packages and scopes: Read-only** /
**Organizations: No access**, pasted into *Organization settings → npm access* — never a classic
or read-write token — plus the decision flow (record in Drydock, approve or reject on npm with
2FA). The stage-only publisher's CLI one-liner is included, and § 3's Renovate note points at the
`drydock//renovate/diff-links` preset.

**`dependency-management-node` PRs link artifact diffs.** Every npm bump in a dep PR body gets its
`https://drydock.org/diff/<name>/<from>/<to>` link — the published-artifact diff a
`package.json` + lockfile diff cannot show. Public deterministic pages, no token, nothing
contacted until a reviewer clicks; only pairs of two distinct published registry versions are
linked.
