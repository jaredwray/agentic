# Migrations (MongoDB) — reference

Reference material for the `migrations` skill. The workflow points here at the steps that need it. Section numbers below are referenced from the SKILL.md workflow.

The default tool is **migrate-mongo**: it provides the changelog ledger, a single-writer lock, file-hash change detection, ordering, and `up`/`down`/`status`, so this skill *configures* it rather than reinventing a runner. The templates use the native MongoDB driver (`mongodb`); for Mongoose projects see the Mongoose-specific tools in § 1.

## 1. Choose or conform to a tool

Run this detection **before** scaffolding. If any is present, conform to it — wire the pnpm scripts around its CLI, use its directory and changelog — and do not add a second tool.

| Signal in the repo | Tool | Migrations live in | Notes |
|---|---|---|---|
| `migrate-mongo` dep, `migrate-mongo-config.*` | **migrate-mongo** (default) | `migrationsDir` (default `migrations/`) | Native driver. Changelog ledger, lock, `useFileHash`, `up`/`down`/`status`/`create`. The default choice when nothing exists. |
| `mongo-migrate-ts` dep | **mongo-migrate-ts** | configured | TypeScript-native alternative; class-based migrations, `up`/`down`, built-in CLI. Use if the repo prefers TS-first ergonomics over wiring migrate-mongo for `.ts`. |
| `mongoose` + `ts-migrate-mongoose` / `migrate-mongoose` | **ts-migrate-mongoose** | configured | For Mongoose apps — runs migrations with models loaded; keeps a migrations collection. |
| `mongock` config (JVM/Spring) | **Mongock** | — | Java/Spring ecosystem; out of scope for a Node skill — report and stop. |

**Conforming still delivers the five requirements:** the version prefix is the tool's timestamp, `migrate:development` / `migrate:production` wrap the tool's apply command with the right env, dry-run maps to the tool's `status`/plan, and each migration logs what it does. If a tool is detected, **stop and report it** before changing anything; scaffold migrate-mongo below only when none exists.

## 2. Set up migrate-mongo

```bash
pnpm add -D migrate-mongo
# TypeScript repos also need a loader if one isn't present:
pnpm add -D tsx           # or use the repo's existing ts-node / build step
```

### Config — `migrate-mongo-config.cjs`

One config that resolves the URI from the environment by `MIGRATE_ENV`, so dev and prod differ only by which secret is read. CommonJS (`.cjs`) loads everywhere; keep it JS even in TS repos.

```js
// migrate-mongo-config.cjs
const ENV = process.env.MIGRATE_ENV ?? 'development';

// Connection strings come from the environment ONLY — never hardcoded.
const url =
  ENV === 'production'
    ? process.env.MONGODB_URI_PRODUCTION
    : process.env.MONGODB_URI_DEVELOPMENT ?? process.env.MONGODB_URI;
if (!url) throw new Error(`Missing Mongo URI for MIGRATE_ENV=${ENV}`);

module.exports = {
  mongodb: {
    url,
    // databaseName can be omitted if the URI includes the db.
    databaseName: process.env.MONGODB_DB,
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',     // the applied-migrations ledger (§ 4)
  lockCollectionName: 'changelog_lock',     // single-writer lock (§ 4)
  lockTtl: 90,                              // seconds; >0 enables the lock + auto-expires a stale one
  migrationFileExtension: '.js',            // '.ts' in a TS repo (see below)
  useFileHash: true,                        // store a hash per file for change detection (§ 4)
  moduleSystem: 'commonjs',                 // 'esm' if package.json "type": "module"
};
```

### TypeScript

Two options, pick one:

- **migrate-mongo with `.ts`** — set `migrationFileExtension: ".ts"` and `moduleSystem` to match the repo, then run the CLI under a TS loader. In `package.json` scripts, invoke `node --import tsx ./node_modules/migrate-mongo/bin/migrate-mongo.js <cmd>` (or the repo's `ts-node` equivalent) instead of the bare `migrate-mongo` binary.
- **mongo-migrate-ts** — a TS-native tool; use it if you'd rather not wire a loader. It has its own config and CLI; the rest of this skill (env scripts, idempotency, expand/contract, backup) applies unchanged.

### Layout

```text
migrations/
  20260622120000-create_users_indexes.ts
  20260622131500-backfill_display_name.ts
migrate-mongo-config.cjs
scripts/
  migrate-confirm.mjs   # production guard (§ 6)
```

`pnpm migrate:create <desc>` generates `migrations/<YYYYMMDDHHmmss>-<desc>.<ext>` — the timestamp prefix is the version and the apply order.

## 3. Migration file template

migrate-mongo migrations export `up(db, client)` and `down(db, client)`, both receiving the driver `Db` and the `MongoClient`. The version is the filename's timestamp prefix; migrate-mongo records it in the changelog by `fileName`.

```ts
import type { Db, MongoClient } from 'mongodb';

export const up = async (db: Db, _client: MongoClient): Promise<void> => {
  console.log('[migrate] up: ensuring unique index users.email');
  // createIndex is idempotent — a no-op if the index already exists, so the
  // whole migration is safe to re-run (the primary safety net in Mongo).
  await db.collection('users').createIndex(
    { email: 1 },
    { unique: true, name: 'users_email_unique' },
  );
};

export const down = async (db: Db, _client: MongoClient): Promise<void> => {
  console.log('[migrate] down: dropping index users_email_unique');
  await db.collection('users').dropIndex('users_email_unique').catch(() => {});
};
```

For JS repos, emit `module.exports.up = async (db, client) => {…}` (CJS) or the `export` form (ESM) to match `package.json` `"type"`, and drop the type import.

**Irreversible migrations.** When `up` loses information (e.g. unsetting a field, collapsing values), a true `down` is impossible. Make `down` throw rather than lie:

```ts
export const down = async (): Promise<void> => {
  throw new Error('Irreversible: this migration discarded the original values. Restore from backup to undo.');
};
```

Note it in the PR body so the maintainer knows the rollback move is "restore from backup."

## 4. The changelog ledger and change detection

migrate-mongo's `changelogCollectionName` collection (default `changelog`) is the source of truth for what's applied. Each document holds `fileName`, `appliedAt`, and — with `useFileHash: true` — a hash of the file. It drives:

- **Idempotency / pending detection** — a file in `migrationsDir` not in the changelog is PENDING; applied ones are skipped. `migrate-mongo status` lists both.
- **Change detection (`useFileHash: true`).** The changelog stores each file's hash. If an applied file's content changes, migrate-mongo treats it as **new** and **re-runs it**. This is a double-edged tool: it catches edits, but a re-run of a non-idempotent body double-applies it. The rule stands: **never edit an applied migration; add a new one.** `useFileHash` is a safety aid, not a license to edit history.
- **Single-writer lock.** With `lockCollectionName` set and `lockTtl > 0`, migrate-mongo acquires a lock document before applying so two concurrent runs can't migrate at once; the TTL index auto-expires a stale lock if a run crashes mid-flight. Set `lockTtl` comfortably above your longest migration (e.g. 90s, or higher for big backfills — but prefer to keep long backfills out of the migration path; see § 7). **Never delete the lock document to force past a held lock** — that's how you get two writers.

## 5. Transactions and dry-run

**Transactions require a replica set.** MongoDB multi-document transactions work only on a replica set or sharded cluster (Mongo 4.0+); a standalone `mongod` has none. Where available, wrap multi-step writes so a failure rolls back cleanly:

```ts
export const up = async (db: Db, client: MongoClient): Promise<void> => {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      console.log('[migrate] up: moving orders.legacyTotal → orders.total');
      await db.collection('orders').updateMany(
        { total: { $exists: false }, legacyTotal: { $exists: true } },
        [{ $set: { total: '$legacyTotal' } }],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
};
```

Transactions have limits (~60s runtime, 16MB oplog per transaction), so **do not wrap a large backfill in one** — batch it without a transaction and rely on idempotency (§ 7). On a standalone server, drop the session and make the body idempotent and resumable; a partial failure is recovered by re-running.

**Dry-run / plan.** migrate-mongo has **no built-in dry-run**. Map `migrate:*:dry-run` to `migrate-mongo status` — it prints every migration as `APPLIED <date>` or `PENDING`, i.e. exactly what a run *would* apply and in what order. That is the plan you review before every production apply. For a deeper *execution* rehearsal, in order of preference:

1. **Restore a recent snapshot into a scratch database and run `migrate-mongo up` against it.** The gold standard — it exercises the real data with zero risk to production.
2. **Abort-transaction rehearsal (replica set only).** Load each PENDING file, run its `up` inside `session.withTransaction(...)`, then throw at the end of the callback so the transaction aborts and nothing commits — and do not touch the changelog. Useful for catching a bad query against real-shaped data without persisting. It cannot rehearse a migration that itself can't run in a transaction (e.g. an index build), so fall back to option 1 for those.

Don't claim a clean in-place dry-run that migrate-mongo can't provide — `status` plus a snapshot rehearsal is the honest, safe combination.

## 6. pnpm scripts and environment resolution

```jsonc
{
  "scripts": {
    "migrate:development":         "cross-env MIGRATE_ENV=development migrate-mongo up",
    "migrate:development:dry-run": "cross-env MIGRATE_ENV=development migrate-mongo status",
    "migrate:production":         "node scripts/migrate-confirm.mjs && cross-env MIGRATE_ENV=production migrate-mongo up",
    "migrate:production:dry-run":  "cross-env MIGRATE_ENV=production migrate-mongo status",
    "migrate:status":             "cross-env MIGRATE_ENV=development migrate-mongo status",
    "migrate:create":             "cross-env MIGRATE_ENV=development migrate-mongo create",
    "migrate:down":               "cross-env MIGRATE_ENV=development migrate-mongo down"
  }
}
```

`cross-env` keeps the env var portable across shells (`pnpm add -D cross-env`); drop it if you only target POSIX. In a TS repo, replace `migrate-mongo` with `node --import tsx ./node_modules/migrate-mongo/bin/migrate-mongo.js` (see § 2). Usage: `pnpm migrate:create add_users_email_index`; `pnpm migrate:status` (plan); `pnpm migrate:development`; production is `pnpm migrate:production:dry-run`, then `MIGRATE_CONFIRM=production pnpm migrate:production`.

**Production guard — `scripts/migrate-confirm.mjs`.** migrate-mongo has no confirm flag, so a tiny guard makes `migrate:production` refuse to run unless the operator opts in explicitly:

```js
// scripts/migrate-confirm.mjs
if (process.env.MIGRATE_CONFIRM !== 'production') {
  console.error(
    'Refusing to run production migrations.\n' +
    'Run `pnpm migrate:production:dry-run` first, review the plan, then re-run with MIGRATE_CONFIRM=production.',
  );
  process.exit(1);
}
console.log('[migrate] production apply confirmed (MIGRATE_CONFIRM=production)');
```

**Environment resolution.** The config (§ 2) reads `MONGODB_URI_PRODUCTION` for production and `MONGODB_URI_DEVELOPMENT` (falling back to `MONGODB_URI`) otherwise. In development these come from a gitignored `.env` (loaded by the repo's mechanism, e.g. `dotenv` / `--env-file`); in production from the deploy platform's secret store. **Never** commit a production URI, and never print one (it contains credentials). If the repo already centralizes config, source the URI from there.

## 7. Zero-downtime: expand/contract for documents

In production the old application code keeps running during a rolling deploy, so a change must be **backward-compatible with the code already deployed**. Mongo being schemaless makes additive changes easy — but it also means old-shaped documents linger until backfilled, so tolerant reads matter. Use **expand → migrate → contract**, split across releases:

1. **Expand** (release N): additive only — add a new field, a new collection, or a new index. Old code ignores it; new code can start writing it. Deploy code that writes **both** old and new fields (dual-write) if you're moving data.
2. **Migrate / backfill** (release N): populate the new field on existing documents in batches.
3. **Contract** (release N+1, after every instance runs the new code): stop writing the old field, then a later migration `$unset`s it / drops the old index.

**Never** remove or rename a field the currently-deployed app still reads. Adding a **JSON-Schema validator** (`db.command({ collMod, validator, validationLevel: 'moderate' })`) should start at `moderate`/`warn` so existing documents aren't rejected, then tighten to `strict` only after a backfill makes every document conform.

**Batch large backfills** — don't wrap millions of docs in one `updateMany`/transaction. Loop in bounded batches with `bulkWrite`; the filter only touches not-yet-migrated docs, so it's idempotent and resumable:

```ts
import type { Db } from 'mongodb';

export const up = async (db: Db): Promise<void> => {
  const users = db.collection('users');
  let moved = 0;
  for (;;) {
    const batch = await users.find({ displayName: { $exists: false } }).limit(1000).toArray();
    if (batch.length === 0) break;
    const ops = batch.map((d) => ({
      updateOne: { filter: { _id: d._id }, update: { $set: { displayName: d.name ?? '' } } },
    }));
    const res = await users.bulkWrite(ops, { ordered: false });
    moved += res.modifiedCount;
    console.log(`[migrate] backfilled ${moved} users…`);
  }
  console.log(`[migrate] backfill complete: ${moved} users`);
};

export const down = async (): Promise<void> => {
  throw new Error('Irreversible backfill — the prior absent-field state is not recoverable.');
};
```

A backfill like this is a `chore:` migration, safe to re-run, and resumable after an interruption (it only touches documents still missing the field). For very large collections, prefer iterating by `_id` ranges over a growing `skip`.

## 8. CI verification

Add a CI job that proves migrations are sound on every PR. Run a MongoDB **single-node replica set** as a service (a plain standalone can't exercise transaction-using migrations) — e.g. start `mongod --replSet rs0` and `rs.initiate()`, or use `mongodb-memory-server` in replica-set mode:

1. **Apply forward on a fresh DB:** `pnpm migrate:development` against the empty service DB → must succeed.
2. **Round-trip the newest migration:** `pnpm migrate:down` then `pnpm migrate:development` again → proves `down` is correct (or correctly throws for irreversible) and `up` is re-appliable.
3. **Plan is clean:** `pnpm migrate:status` exits 0 and lists the expected order.
4. **Change-detection guard — and its limit.** `useFileHash` only detects an edited migration against a changelog that recorded the *old* hash; a fresh-DB CI job has an empty changelog, so it will **not** catch drift on its own (it just applies the edited file). To catch "someone edited an applied migration" in CI, commit a `migrations/.checksums` manifest (fileName → sha256) and add a step that recomputes each file's hash and fails on any mismatch, regenerating the manifest only when adding a *new* migration. Where CI can restore a production/staging snapshot, step 1 against that baseline catches an edited applied file directly (migrate-mongo re-runs it, surfacing non-idempotent breakage).

Wire `MONGODB_URI_DEVELOPMENT` to the CI service. Keep the job separate from unit tests so a migration failure is unambiguous in the checks list.

## Production safety checklist

Before `MIGRATE_CONFIRM=production pnpm migrate:production` (mirrors the SKILL's Production safety section; the operator's pre-flight):

- [ ] `pnpm migrate:production:dry-run` (status) ran and the operator saw the plan + the exact PENDING migrations.
- [ ] A recent `mongodump` exists, or Atlas continuous backup / PITR covers now.
- [ ] The URI comes from the deploy platform's secret store, not a file in the repo.
- [ ] The change is expand/contract-safe for the code currently running (no removal/rename of a field the live app reads; validators start `moderate`, tighten only after backfill).
- [ ] Large backfills are batched (§ 7), not one giant `updateMany`/transaction.
- [ ] Only one migration run will execute (the migrate-mongo lock is enabled; no other deploy in flight).
- [ ] There's a known rollback move: the migration's `down`, or "restore from backup" if it's irreversible.

## 9. Failure and recovery

- **A migration failed mid-run.**
  - *With a session transaction (replica set):* it rolled back, so the data matches the state before that migration and its changelog row was not written. Fix the migration **file** (it was never recorded, so editing it isn't drift) and re-run — migrate-mongo resumes from the first PENDING file.
  - *Without a transaction (standalone, or a batched backfill):* it may be **partially applied**. Because the body is idempotent and resumable, re-running completes it (it skips already-done documents). The changelog row is written only on success, so the file stays PENDING and re-runs cleanly. Do **not** hand-edit data to "get past" it.
- **An applied migration's file was edited.** With `useFileHash`, migrate-mongo will re-run it on the next `up` — double-applying a non-idempotent body. Restore the original content and put the intended change in a **new** migration. If dev and prod genuinely diverged, reconcile deliberately with the maintainer.
- **Lock held / stale.** Another run is in progress; wait. A crashed run's lock auto-expires after `lockTtl`. Never delete the lock document to force past it.
- **Wrong environment.** If a migration was applied to the wrong cluster, use its `down` to reverse it (if reversible) and apply to the correct one. Irreversible mistakes are why production requires the confirm flag, a prior plan, and a backup.
