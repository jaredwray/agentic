---
name: migrations
description: Set up and author database and data migrations for a Node/TypeScript project — a versioned, ordered, idempotent migration system with an applied-migrations ledger, transactional apply with rollback, a dry-run plan mode, and `pnpm migrate:development` / `migrate:production` scripts that log every step. Detects and conforms to an existing migration tool (Prisma, Drizzle, Knex, node-pg-migrate, TypeORM, Umzug, Kysely…) or scaffolds a minimal dependency-light runner when none exists; defaults to TypeScript in TS repos. Use when asked to add migrations, set up a migration runner, write a schema or data migration, create migrate scripts, run migrations across environments, or safely apply DB changes in dev and prod. Manual, resumable, one PR at a time.
disable-model-invocation: true
user-invocable: true
allowed-tools: [Bash, Read, Edit, Write]
---

# Migrations

Operation manual for setting up a migration system and authoring individual migrations on a Node.js / TypeScript project. It produces a **versioned, ordered, idempotent** migration runner with an applied-migrations ledger, transactional apply, a real dry-run, and `pnpm migrate:development` / `migrate:production` scripts — or, when the repo already has a migration tool, wires those scripts around it instead of reinventing one.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Only stop to ask when the document says to stop and report (uncommitted changes, an existing tool to conform to, a destructive or irreversible change, a production apply) or when a decision genuinely needs the user.
>
> **Migrations are dangerous — production safety is non-negotiable.** Never apply against production without an explicit, confirmed go-ahead. Never read a connection string from anything but the environment. Never log a secret. A production apply is always preceded by a dry-run plan the user has seen. These invariants hold even when the user is in a hurry; see [Production safety](#production-safety).
>
> **One PR at a time.** Setting up the system is one PR; each migration is its own PR. Open it, drive CI to green, then stop and wait. Resume on `continue` / `next`. This skill follows the shared `shipping-conventions` loop and `pr-conventions`.

## Scope and summary

**In scope:** schema migrations (DDL) and data migrations / backfills (DML) for a SQL database, plus the runner, ledger, pnpm scripts, and CI check that make them safe to apply across environments. The same model generalizes to any ordered, stateful migration (search indexes, document/config reshaping, message-schema versions) — the runner is storage-agnostic; only the per-migration body changes.

**Out of scope:** designing the data model itself, choosing a database, ORM entity modelling, and the actual production deploy/orchestration. This skill makes changes *safe to apply*; it does not decide *what* the schema should be (that's a design task — defer to `codebase-design` / `production-function`).

## First: adopt, don't reinvent

Before scaffolding anything, detect whether the repo already has a migration mechanism and **conform to it** — its directory, its file format, its ledger. Reinventing a runner next to Prisma or Knex creates two sources of truth and silent drift. Detection table and per-tool wiring are in [reference.md § 1](./reference.md#1-adopt-an-existing-tool). Only when no tool exists do you scaffold the minimal runner in [§ 2](./reference.md#2-the-minimal-runner).

## The migration model — invariants

Every migration system this skill sets up or conforms to must satisfy these. They are the answer to "what else am I missing" beyond version + dry-run + console logging:

1. **Versioned & self-describing.** Each migration carries a UTC timestamp version `YYYYMMDDHHmmss` as its **filename prefix** *and* an exported `version` constant at the top of the script, so the file states which migration it is and where it sits in the order. The runner asserts the two match. Timestamps (not sequential integers) avoid version collisions between branches. See [§ 3](./reference.md#3-migration-file-template).
2. **Ordered & unique.** Migrations apply in ascending version order; duplicate versions are a hard error (CI catches them — [§ 10](./reference.md#10-ci-verification)).
3. **A ledger of what's applied.** The runner records each applied version — in a `_migrations` table for a DB, or a state file otherwise — with a **checksum** of the migration body. This is what makes "which ones still need applying" answerable and apply **idempotent**: already-applied migrations are skipped. A changed checksum on an applied migration is drift — stop and report. See [§ 5](./reference.md#5-the-applied-migrations-ledger).
4. **Transactional, with rollback on failure.** Each migration runs in a transaction; a failure rolls it back so the database is never left half-migrated, and the ledger only records success. Statements that can't run in a transaction (e.g. Postgres `CREATE INDEX CONCURRENTLY`) use the documented escape hatch. See [§ 6](./reference.md#6-transactions-and-the-non-transactional-escape-hatch).
5. **Reversible, or explicitly not.** Each migration exports `up` and `down`. If a change genuinely can't be undone (a destructive data drop), `down` throws with a clear message and the file is marked `irreversible` — a deliberate decision, never an empty `down`. `pnpm migrate:* down` rolls back the last applied migration.
6. **Single-writer (locking).** The runner takes an advisory lock before applying so two concurrent deploys / CI runners can't migrate at once. See [§ 7](./reference.md#7-concurrency-lock).
7. **A real dry-run.** `--dry-run` runs the migration inside a transaction that is **always rolled back**, logs every operation it *would* perform, records nothing in the ledger, and exits non-zero only on error. It is the rehearsal you run before every production apply. See [§ 6](./reference.md#6-transactions-and-the-non-transactional-escape-hatch).
8. **Loud and honest exit codes.** Every step is `console.log`ged (version, direction, dry-run banner, per-operation line, duration); the process exits **non-zero** on any failure so CI and deploy steps fail loudly. Secrets/connection strings are redacted in logs.
9. **Production-safe by construction.** Connection strings come from the environment only; production applies require explicit confirmation and a prior dry-run; back up / confirm point-in-time-recovery first; prefer the expand–migrate–contract pattern so a schema change is backward-compatible with the still-running old code (zero-downtime). See [Production safety](#production-safety) and [§ 8](./reference.md#8-zero-downtime-expandcontract).

## Language and layout

- **TypeScript by default in a TypeScript repo.** Detect TS via `tsconfig.json`, a `typescript` dependency, or `.ts` sources. If TS, migrations are `.ts` and run through the repo's existing TS runner (`tsx`, `ts-node`, or a build step — match what the repo already uses). Otherwise use `.js` (ESM or CJS to match `package.json` `type`). Detection details in [§ 2](./reference.md#2-the-minimal-runner).
- **One migrations directory**, conventionally `migrations/` (or the existing tool's directory). Files: `<version>__<slug>.{ts,js}`, e.g. `20260621120000__add_users_email_index.ts`.

## pnpm scripts

The deliverable includes these scripts in `package.json` (honor the exact `migrate:development` / `migrate:production` names; the env name selects which DB URL is read and which safety gate applies). Full block, env resolution, and production gating in [§ 4](./reference.md#4-pnpm-scripts-and-environment-resolution).

| Script | Does |
|---|---|
| `migrate:development` | apply all pending migrations against the development DB |
| `migrate:production` | apply all pending migrations against the production DB — **gated**: the runner refuses to apply without an explicit `--yes`. The dry-run is the required first move (run `migrate:production:dry-run`, review the plan, then apply with `--yes`) |
| `migrate:status` | list applied vs pending (added — you can't apply safely without seeing state) |
| `migrate:create <slug>` | scaffold a new `<version>__<slug>` file from the template (added — guarantees the version prefix + `version` constant are correct) |
| `migrate:down` | roll back the last applied migration (added — reversibility needs an entry point) |

Every script accepts `--dry-run`. Because `pnpm <script> -- --dry-run` passthrough is easy to forget on the command that matters most, also add explicit `migrate:development:dry-run` and `migrate:production:dry-run` aliases. **A production dry-run is the default first move**, not an afterthought.

## Workflow

Run on the **first** invocation and on every resume (`continue`, `next`, `next migration`, or similar).

1. **Sync `main` and take stock.** Confirm the working tree is clean (`git status --short`); if not, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`. Detect: repo language (TS vs JS), `package.json` `type`, the database/driver in use, and whether a migration tool already exists (per [§ 1](./reference.md#1-adopt-an-existing-tool)).

2. **Decide the track.**
   - **No migration system yet → Track A (set up).** If an existing tool was found, *stop and report it* and propose conforming to it rather than scaffolding; proceed only on the user's go-ahead. If none, scaffold the minimal runner.
   - **System exists, user wants a new migration → Track B (author).**
   - **User wants to apply existing migrations → Track C (apply).**
   If the request is ambiguous, ask which track (it's the one genuinely ambiguous decision here).

3. **Track A — set up the system (one PR).** Scaffold, per [§ 2](./reference.md#2-the-minimal-runner)–[§ 7](./reference.md#7-concurrency-lock): the `migrations/` dir, the runner with ledger + transactions + lock + dry-run, the `package.json` scripts ([§ 4](./reference.md#4-pnpm-scripts-and-environment-resolution)), the ledger schema, a `migrate:create` template, and the CI check ([§ 10](./reference.md#10-ci-verification)). Add a short "Migrations" section to the README/CONTRIBUTING. Verify locally against a throwaway/dev database: run `migrate:status`, create a no-op sample migration, `migrate:development --dry-run`, then apply, then `migrate:down`. Open the PR.

4. **Track B — author one migration (one PR).** `pnpm migrate:create <slug>` (or create the file by hand from [§ 3](./reference.md#3-migration-file-template)). Write `up` and `down`; log each operation; guard DDL with `IF [NOT] EXISTS` where the dialect allows so it's re-runnable. For a **data backfill**, batch it ([§ 8](./reference.md#8-zero-downtime-expandcontract)). For a **schema change against a live system**, use expand–migrate–contract so the change is backward-compatible. If the change is irreversible, make `down` throw with an explanatory message and say so in the PR body. Verify: `migrate:development --dry-run` (reads clean), then apply on dev, then `migrate:down` to prove the round-trip, then re-apply. Open the PR.

5. **Track C — apply (the one place this skill touches a real database).**
   - **Development:** `pnpm migrate:development --dry-run` first, show the plan, then `pnpm migrate:development`.
   - **Production:** this is a **hard stop-and-confirm**. Run `pnpm migrate:production:dry-run`, present the full plan and the list of versions that will apply, confirm a backup / PITR is in place, and get the user's explicit go-ahead. Only then `pnpm migrate:production --yes`. See [Production safety](#production-safety) and the failure/recovery rules in [§ 11](./reference.md#11-failure-and-recovery). Never auto-apply to production.

6. **Drive CI to green.** For Track A/B PRs, watch CI; if a check fails, diagnose, fix, push until green. The CI check must prove migrations apply to a fresh DB and that `down`→`up` round-trips ([§ 10](./reference.md#10-ci-verification)). Never stop on a red PR.

7. **Check for already-merged, then stop and wait.** If the PR merged during CI, return to Step 1. Otherwise report: PR URL + what it does; CI green; what's left; and a literal resume prompt (e.g. *"Merge when ready, then reply `continue` and I'll open the next migration PR."*). Then wait.

## Production safety

A production apply is the highest-risk action in this skill. The invariants, every time (operator pre-flight checklist in [§ 9](./reference.md#9-production-safety-checklist)):

- **Explicit, informed confirmation.** Show the dry-run plan and the exact versions that will apply; get a clear go-ahead. `migrate:production` refuses to run without `--yes`.
- **Backup / PITR first.** Confirm a recent backup or point-in-time recovery window exists before applying. Note it in the report.
- **Secrets from the environment only.** Read the production DB URL from an env var / secret store; never hardcode, never echo it. Redact connection strings in all logs.
- **Forward-compatible changes (zero-downtime).** Prefer expand–migrate–contract so the migration is compatible with the old code still running during a rolling deploy ([§ 8](./reference.md#8-zero-downtime-expandcontract)). Don't drop or rename a column the deployed app still reads in the same release.
- **One writer.** The advisory lock ([§ 7](./reference.md#7-concurrency-lock)) prevents two deploys racing. If the lock is held, stop — do not force it.
- **On partial failure, stop.** The failed migration rolled back; earlier ones are committed and recorded. Report exactly which version failed and the resume point — do not retry blindly or hand-edit the database. See [§ 11](./reference.md#11-failure-and-recovery).

## Pull request rules

- **One unit per PR.** Track A (the system) is one PR; each migration is its own PR. Never bundle the runner and a real schema change, or two unrelated migrations, together.
- **Title** per `pr-conventions`: the system PR is `feat: add database migration system` (or `mono - chore: …` style by repo shape); a schema-changing migration is usually `feat:`/`fix:`, a pure backfill `chore:`. Mark breaking schema changes with `!` and a `BREAKING CHANGE:` note.
- **Body** uses the `pr-conventions` skeleton plus a **Migration** section: the version(s), up/down summary, reversible vs irreversible, dry-run output confirmed, and the production rollout note (expand/contract step, backfill batching) when relevant.
- Open the PR as ready for review, branched from latest `main`. Branch naming: `feat/migrations-setup` (Track A) or `feat/migration-<slug>` (Track B).

---

## Reference

The detection table and per-tool wiring, the runner and migration-file templates, the ledger schema, dry-run/transaction semantics, the advisory lock, the expand–contract and backfill patterns, the CI check, and failure recovery live in [reference.md](./reference.md). Pull it in at the workflow steps that point there.
