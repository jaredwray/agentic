---
name: migrations
description: Set up and author MongoDB migrations for a Node/TypeScript project using migrate-mongo — versioned, ordered, idempotent migrations with a changelog ledger, a single-writer lock, file-hash change detection, up/down, a dry-run/plan mode, and `pnpm migrate:development` / `migrate:production` scripts that log every step. Detects and conforms to an existing tool (migrate-mongo, mongo-migrate-ts, ts-migrate-mongoose) or scaffolds migrate-mongo when none exists; defaults to TypeScript in TS repos. Covers index and JSON-Schema-validator changes, batched data backfills, and zero-downtime expand/contract for schemaless documents. Use when asked to add MongoDB migrations, set up a migration runner, write a data or index migration, create migrate scripts, run migrations across environments, or safely change a Mongo collection in dev and prod. Manual, resumable, one PR at a time.
disable-model-invocation: true
user-invocable: true
allowed-tools: [Bash, Read, Edit, Write]
---

# Migrations (MongoDB)

Operation manual for setting up a MongoDB migration system and authoring individual migrations on a Node.js / TypeScript project. The default tool is **migrate-mongo** — it already provides a versioned changelog ledger, a single-writer lock, file-hash change detection, and `up`/`down`/`status`, so this skill configures it (rather than reinventing a runner), wires `pnpm migrate:development` / `migrate:production` around it, and authors migrations that log every step and rehearse safely.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Only stop to ask when the document says to stop and report (uncommitted changes, an existing tool to conform to, a destructive or irreversible change, a production apply) or when a decision genuinely needs the user.
>
> **Migrations are dangerous — production safety is non-negotiable.** Never apply against production without an explicit, confirmed go-ahead. Never read a connection string from anything but the environment. Never log a URI with credentials. A production apply is always preceded by a status/plan the user has seen and a recent backup. See [Production safety](#production-safety).
>
> **One PR at a time.** Setting up the system is one PR; each migration is its own PR. Open it, drive CI to green, then stop and wait. Resume on `continue` / `next`. This skill follows the shared `shipping-conventions` loop and `pr-conventions`.

## Scope and summary

**In scope:** MongoDB migrations — data backfills and reshaping (the common case, since Mongo is schemaless), index creation/changes, and JSON-Schema validator changes via `collMod` — plus the migrate-mongo config, the `migrate:*` pnpm scripts, and the CI check that make them safe across environments.

**Out of scope:** designing the document model, choosing the database, and the actual production deploy/orchestration. This skill makes changes *safe to apply*; it does not decide *what* the data should look like (a design task — defer to `codebase-design` / `production-function`).

**Not MongoDB?** This skill is MongoDB-first by default. For a SQL project, the same model (versioned files, a ledger, idempotent forward-only migrations, dry-run, env-scoped apply scripts) applies through a SQL tool — Prisma Migrate, Drizzle, Knex, or node-pg-migrate — but the templates here assume Mongo and migrate-mongo.

## First: adopt, don't reinvent

Before scaffolding, detect whether the repo already has a migration mechanism and **conform to it** — its config, its directory, its changelog. The detection table and per-tool wiring are in [reference.md § 1](./reference.md#1-choose-or-conform-to-a-tool). When nothing exists, set up **migrate-mongo** per [§ 2](./reference.md#2-set-up-migrate-mongo). Do **not** hand-roll a runner: migrate-mongo already gives you the ledger, lock, ordering, and change detection.

## The migration model — invariants

migrate-mongo provides most of these out of the box; the rest are conventions this skill enforces. They are the answer to "what else am I missing" beyond version + dry-run + console logging:

1. **Versioned & ordered.** migrate-mongo names files `YYYYMMDDHHmmss-description.<ext>`; the timestamp prefix is the version and the apply order. The version is at the start of the filename, so a file states which migration it is. Timestamps avoid cross-branch collisions. ([§ 2](./reference.md#2-set-up-migrate-mongo))
2. **A changelog ledger.** migrate-mongo records each applied migration in the `changelogCollectionName` collection (default `changelog`: `fileName`, `appliedAt`). This is what makes "which ones still need applying" answerable and apply **idempotent** — applied migrations are skipped. ([§ 4](./reference.md#4-the-changelog-ledger-and-change-detection))
3. **Idempotent migration bodies.** Mongo has no transactional DDL and standalone servers have no transactions at all, so **idempotency is the primary safety net**: `createIndex` is a no-op if the index exists; writes use filters safe to re-run. Write every `up` so re-running it can't double-apply. ([§ 3](./reference.md#3-migration-file-template))
4. **Change detection.** Set `useFileHash: true` so the changelog stores a hash per file. Editing an applied migration changes its hash and makes migrate-mongo **re-run** it — which is exactly why you must **never edit an applied migration; add a new one** (a re-run of a non-idempotent body double-applies it). ([§ 4](./reference.md#4-the-changelog-ledger-and-change-detection))
5. **Single-writer lock.** Set `lockCollectionName` + a non-zero `lockTtl` so two concurrent deploys / CI runners can't migrate at once — migrate-mongo takes the lock before applying. ([§ 2](./reference.md#2-set-up-migrate-mongo))
6. **Reversible, or explicitly not.** Each migration exports `up` and `down`. Many Mongo data migrations lose information and can't be truly undone — then `down` throws with a clear message and the migration is documented as irreversible (never an empty `down`). `migrate:down` rolls back the last applied migration. ([§ 3](./reference.md#3-migration-file-template))
7. **Transactions when available.** On a replica set (Mongo 4.0+), wrap multi-document changes in `client.startSession()` + `session.withTransaction()` so a failure rolls back cleanly. On a standalone server there are no transactions — fall back to idempotent, resumable, forward-only migrations. ([§ 5](./reference.md#5-transactions-and-dry-run))
8. **A dry-run / plan.** migrate-mongo has **no built-in dry-run**, so `migrate:*:dry-run` maps to `migrate-mongo status` — the plan of exactly which migrations are PENDING. A true *execution* rehearsal runs against a restored snapshot, or (on a replica set) via the optional abort-transaction helper. ([§ 5](./reference.md#5-transactions-and-dry-run))
9. **Loud and honest exit codes.** Every step is `console.log`ged in the migration body (what it's doing, counts, durations); migrate-mongo exits non-zero on failure so CI and deploy steps fail loudly. URIs/credentials are never printed.
10. **Production-safe by construction.** Connection strings come from the environment only; production applies require explicit confirmation and a prior `status`/plan; take a `mongodump`/Atlas backup or confirm PITR first; prefer expand–migrate–contract so a change is compatible with the still-running old code. See [Production safety](#production-safety) and [§ 7](./reference.md#7-zero-downtime-expandcontract-for-documents).

## Language and layout

- **TypeScript by default in a TypeScript repo.** Detect TS via `tsconfig.json`, a `typescript` dependency, or `.ts` sources. If TS, configure migrate-mongo with `migrationFileExtension: ".ts"` and run it through the repo's existing TS runner (`tsx` / `ts-node`); or use the TS-native `mongo-migrate-ts`. Otherwise `.js` matching `package.json` `"type"`. Details in [§ 2](./reference.md#2-set-up-migrate-mongo).
- **One migrations directory** (`migrationsDir`, conventionally `migrations/`). Files: `<version>-<description>.{ts,js}`, e.g. `20260622120000-add_users_email_index.ts`.

## pnpm scripts

The deliverable includes these in `package.json` (honor the exact `migrate:development` / `migrate:production` names; the env selects which Mongo URI the config reads and which gate applies). Full block, env resolution, and the production guard are in [§ 6](./reference.md#6-pnpm-scripts-and-environment-resolution).

| Script | Does |
|---|---|
| `migrate:development` | apply all pending migrations against the development DB (`migrate-mongo up`) |
| `migrate:production` | apply all pending migrations against the production DB — **gated**: a small guard refuses to run without an explicit confirmation env/flag |
| `migrate:status` | list applied vs pending — also the **dry-run/plan** (added: you can't apply safely without seeing state) |
| `migrate:create <desc>` | scaffold a new timestamped migration from the template (added) |
| `migrate:down` | roll back the last applied migration (added: reversibility needs an entry point) |

Every script has a `:dry-run` alias mapping to `migrate-mongo status` (the plan). For a deeper rehearsal, see [§ 5](./reference.md#5-transactions-and-dry-run). **A production status/plan is the required first move**, not an afterthought.

## Workflow

Run on the **first** invocation and on every resume (`continue`, `next`, `next migration`, or similar).

1. **Sync `main` and take stock.** Confirm the working tree is clean (`git status --short`); if not, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`. Detect: repo language (TS vs JS), `package.json` `type`, whether MongoDB is in use (driver `mongodb`, `mongoose`, a Mongo URI in config), and whether a migration tool already exists (per [§ 1](./reference.md#1-choose-or-conform-to-a-tool)).

2. **Decide the track.**
   - **No migration system yet → Track A (set up).** If an existing tool was found, *stop and report it* and propose conforming to it rather than scaffolding; proceed only on the user's go-ahead. If none, set up migrate-mongo.
   - **System exists, user wants a new migration → Track B (author).**
   - **User wants to apply existing migrations → Track C (apply).**
   If the request is ambiguous, ask which track (the one genuinely ambiguous decision here).

3. **Track A — set up the system (one PR).** Per [§ 2](./reference.md#2-set-up-migrate-mongo)–[§ 6](./reference.md#6-pnpm-scripts-and-environment-resolution): add `migrate-mongo` (and a TS loader if needed), write `migrate-mongo-config` reading env URIs with `useFileHash`, `lockCollectionName`, and `lockTtl` set, create the `migrations/` dir and a `migrate:create` template, add the `package.json` scripts and the production guard, and add the CI check ([§ 8](./reference.md#8-ci-verification)). Add a short "Migrations" section to the README/CONTRIBUTING. Verify locally against a throwaway/dev database: `migrate:status`, create a no-op sample migration, `migrate:status` (plan), apply, then `migrate:down`. Open the PR.

4. **Track B — author one migration (one PR).** `pnpm migrate:create <desc>` (or create the file by hand from [§ 3](./reference.md#3-migration-file-template)). Write `up` and `down`; log each operation; make `up` **idempotent** (`createIndex`, re-runnable filters) so a re-run is safe. For a **data backfill**, batch it ([§ 7](./reference.md#7-zero-downtime-expandcontract-for-documents)). For a change against a live system, use expand–migrate–contract so old code keeps working. On a replica set, wrap multi-step writes in a session transaction ([§ 5](./reference.md#5-transactions-and-dry-run)). If the change is irreversible, make `down` throw with an explanatory message and say so in the PR body. Verify: `migrate:status` (plan), apply on dev, `migrate:down` to prove the round-trip, then re-apply. Open the PR.

5. **Track C — apply (the one place this skill touches a real database).**
   - **Development:** `pnpm migrate:status` (the plan) first, then `pnpm migrate:development`.
   - **Production:** a **hard stop-and-confirm**. Run `pnpm migrate:production:dry-run` (status against prod), present the plan and the list of pending migrations, confirm a backup / PITR is in place, and get the user's explicit go-ahead. Only then run `pnpm migrate:production` with the confirmation flag. See [Production safety](#production-safety) and [§ 9](./reference.md#9-failure-and-recovery). Never auto-apply to production.

6. **Drive CI to green.** For Track A/B PRs, watch CI; if a check fails, diagnose, fix, push until green. The CI check must prove migrations apply to a fresh Mongo, that `down`→`up` round-trips, and (with `useFileHash`) that no applied migration was edited ([§ 8](./reference.md#8-ci-verification)). Never stop on a red PR.

7. **Check for already-merged, then stop and wait.** If the PR merged during CI, return to Step 1. Otherwise report: PR URL + what it does; CI green; what's left; and a literal resume prompt (e.g. *"Merge when ready, then reply `continue` and I'll open the next migration PR."*). Then wait.

## Production safety

A production apply is the highest-risk action in this skill. The invariants, every time (operator pre-flight checklist in [§ for production](./reference.md#production-safety-checklist)):

- **Explicit, informed confirmation.** Show the `status`/plan and the exact pending migrations; get a clear go-ahead. `migrate:production` refuses to run without the confirmation flag.
- **Backup / PITR first.** Take a `mongodump` (or confirm Atlas continuous backup / PITR covers now) before applying. Note it in the report.
- **Secrets from the environment only.** Read the production URI from an env var / secret store; never hardcode, never log it (credentials redacted).
- **Forward-compatible changes (zero-downtime).** Prefer expand–migrate–contract so the change is compatible with the old code still running during a rolling deploy ([§ 7](./reference.md#7-zero-downtime-expandcontract-for-documents)). Schemaless means old-shaped documents linger — backfill and keep reads tolerant; don't remove a field the deployed app still reads in the same release.
- **One writer.** The migrate-mongo lock (`lockCollectionName`/`lockTtl`) prevents two deploys racing. If the lock is held, stop — do not delete the lock document to force it.
- **On failure, stop.** With a session transaction the failed migration rolled back; without one it may be partially applied — that's why bodies must be idempotent and resumable. Report exactly which migration failed and the resume point; do not retry blindly or hand-edit data. See [§ 9](./reference.md#9-failure-and-recovery).

## Pull request rules

- **One unit per PR.** Track A (the system) is one PR; each migration is its own PR. Never bundle the setup and a real data change, or two unrelated migrations.
- **Title** per `pr-conventions`: the system PR is `feat: add MongoDB migration system` (or `mono - chore: …` by repo shape); a data/index migration is usually `feat:`/`fix:`, a pure backfill `chore:`. Mark breaking changes with `!` and a `BREAKING CHANGE:` note.
- **Body** uses the `pr-conventions` skeleton plus a **Migration** section: the version(s), up/down summary, reversible vs irreversible, the `status`/plan confirmed, and the production rollout note (expand/contract step, backfill batching, replica-set requirement) when relevant.
- Open the PR as ready for review, branched from latest `main`. Branch naming: `feat/migrations-setup` (Track A) or `feat/migration-<desc>` (Track B).

---

## Reference

The detection table and per-tool wiring, the migrate-mongo config and migration-file templates, the changelog/change-detection/lock details, transactions and dry-run, the expand–contract and backfill patterns, the CI check, and failure recovery live in [reference.md](./reference.md). Pull it in at the workflow steps that point there.
