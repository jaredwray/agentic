# Migrations — reference

Reference material for the `migrations` skill. The workflow points here at the steps that need it. Section numbers below are referenced from the SKILL.md workflow.

The concrete templates use **PostgreSQL via `pg`** as the default example because it is the most common case and supports transactional DDL and advisory locks cleanly. Notes for MySQL (`mysql2`) and SQLite (`better-sqlite3`) appear where the behavior differs. Adapt the driver calls; the structure (ledger, transaction, lock, dry-run) is the same.

## 1. Adopt an existing tool

Run this detection **before** scaffolding. If any of these is present, conform to it — wire the pnpm scripts around its CLI, put migrations in its directory, use its ledger — and do **not** add a second runner.

| Signal in the repo | Tool | Migrations live in | Apply / create commands to wrap |
|---|---|---|---|
| `prisma/schema.prisma`, `@prisma/client` | **Prisma Migrate** | `prisma/migrations/` | `prisma migrate deploy` (prod), `prisma migrate dev` (local), `prisma migrate diff` (dry-run plan) |
| `drizzle.config.*`, `drizzle-orm` | **Drizzle** | `drizzle/` (configured) | `drizzle-kit generate`, `drizzle-kit migrate` |
| `knexfile.*`, `knex` | **Knex** | `migrations/` (configured) | `knex migrate:latest`, `knex migrate:make`, `knex migrate:rollback` |
| `node-pg-migrate` dep, `migrations/` with `pgm` files | **node-pg-migrate** | `migrations/` | `node-pg-migrate up`/`down`/`create` (`--dry-run` supported) |
| `typeorm` + `data-source.*`, `migration:*` scripts | **TypeORM** | configured dir | `typeorm migration:run`/`generate`/`revert` |
| `umzug` dep | **Umzug** | configured | programmatic `up`/`down` |
| `sequelize-cli`, `.sequelizerc` | **Sequelize** | `migrations/` | `sequelize-cli db:migrate` / `db:migrate:undo` |
| `kysely` + a `kysely`-based migrator script | **Kysely** | configured | programmatic `Migrator.migrateToLatest()` |
| `flyway`/`dbmate`/`atlas` config | **Flyway / dbmate / Atlas** | tool dir | tool's `migrate` / `up` / `apply` |

**Conforming still means delivering the user's five requirements:** the version prefix is the tool's own (timestamp/sequence — keep it), `migrate:development` / `migrate:production` become thin wrappers around the tool's apply command with the right env, dry-run maps to the tool's plan/diff or `--dry-run`, and you ensure each migration logs what it does (most tools log; add a wrapper line if not). When the tool lacks a true dry-run (some only generate SQL), document `migrate:*:dry-run` as "generate and print the SQL without applying."

If a tool is detected, **stop and report it** before changing anything — propose conforming and proceed on the user's go-ahead. Scaffold the minimal runner below only when no tool exists.

## 2. The minimal runner

Use this when the repo has no migration tool. It is dependency-light (only the DB driver the repo already uses, plus the repo's existing TS runner if TS).

### Language detection

TypeScript if any of: `tsconfig.json` exists, `typescript` is a dependency, or sources are `.ts`. In a TS repo, run migrations through the runner the repo already uses — `tsx`, `ts-node --esm`, or compile-then-run — don't introduce a new one. Otherwise emit `.js`, matching `package.json` `"type"` (`module` → ESM `import`, else CJS `require`). The templates below are ESM TypeScript; for CJS swap `import`/`export` for `require`/`module.exports`.

### Layout

```text
migrations/
  20260621120000__create_users.ts
  20260621131500__add_users_email_index.ts
scripts/
  migrate.ts            # the runner (CLI entrypoint)
  migrate-template.ts   # the file migrate:create copies
```

### Runner — `scripts/migrate.ts`

A single CLI: `migrate <up|down|status|create> [--env development|production] [--dry-run] [--yes] [slug]`. The pnpm scripts in [§ 4](#4-pnpm-scripts-and-environment-resolution) call it with the env baked in.

```ts
import { readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Client } from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', 'migrations');
const LOCK_KEY = 4242424242; // any stable bigint; one lock namespace for this project

type Direction = 'up' | 'down';
type Migration = {
  version: string;
  slug: string;
  file: string;
  checksum: string;
  up: (ctx: Ctx) => Promise<void>;
  down: (ctx: Ctx) => Promise<void>;
  irreversible?: boolean;
  transactional?: boolean; // default true; false = no BEGIN/COMMIT (e.g. CREATE INDEX CONCURRENTLY)
};
// Ctx is what each migration receives: a query fn plus the dry-run flag so a
// migration can branch (e.g. skip a slow count) when only planning.
export type Ctx = { sql: (q: string, params?: unknown[]) => Promise<{ rows: any[] }>; dryRun: boolean; log: (m: string) => void };

const args = process.argv.slice(2);
const command = args[0] as Direction | 'status' | 'create';
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const ENV = (opt('env') ?? process.env.MIGRATE_ENV ?? 'development') as 'development' | 'production';
const DRY_RUN = flag('dry-run');

function redact(url: string) { return url.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@'); }

function dbUrl(): string {
  // Connection strings come from the environment ONLY — never hardcoded.
  const key = ENV === 'production' ? 'DATABASE_URL_PRODUCTION' : 'DATABASE_URL_DEVELOPMENT';
  const url = process.env[key] ?? (ENV === 'development' ? process.env.DATABASE_URL : undefined);
  if (!url) throw new Error(`Missing ${key} (or DATABASE_URL for development) in the environment`);
  return url;
}

async function loadMigrations(): Promise<Migration[]> {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{14}__.+\.(ts|js)$/.test(f)).sort();
  const seen = new Set<string>();
  const out: Migration[] = [];
  for (const file of files) {
    const version = file.slice(0, 14);
    if (seen.has(version)) throw new Error(`Duplicate migration version ${version} (${file})`);
    seen.add(version);
    const body = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const mod = await import(join(MIGRATIONS_DIR, file));
    if (mod.version !== version) {
      throw new Error(`${file}: exported version "${mod.version}" != filename version "${version}"`);
    }
    out.push({
      version, slug: file.slice(16).replace(/\.(ts|js)$/, ''), file,
      checksum: createHash('sha256').update(body).digest('hex'),
      up: mod.up, down: mod.down, irreversible: mod.irreversible, transactional: mod.transactional,
    });
  }
  return out; // already sorted ascending by version
}

async function ensureLedger(sql: Ctx['sql']) {
  await sql(`CREATE TABLE IF NOT EXISTS _migrations (
    version     TEXT PRIMARY KEY,
    slug        TEXT NOT NULL,
    checksum    TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

async function readApplied(sql: Ctx['sql']): Promise<Map<string, string>> {
  const rows = (await sql(`SELECT version, checksum FROM _migrations ORDER BY version`)).rows;
  return new Map(rows.map((r) => [r.version, r.checksum]));
}

// Returns the pending migrations in order, after enforcing two invariants:
// no applied migration's file changed (drift), and no pending version sorts
// *before* the highest applied version (out-of-order — would break ordering).
function plan(migrations: Migration[], applied: Map<string, string>): Migration[] {
  for (const m of migrations) {
    const prev = applied.get(m.version);
    if (prev && prev !== m.checksum) {
      throw new Error(`Drift: ${m.file} changed after being applied (checksum mismatch). Never edit an applied migration; add a new one.`);
    }
  }
  const maxApplied = [...applied.keys()].sort().at(-1);
  const pending = migrations.filter((m) => !applied.has(m.version));
  const stray = pending.find((m) => maxApplied !== undefined && m.version < maxApplied);
  if (stray) {
    throw new Error(`Out-of-order migration ${stray.version}: ${maxApplied} is already applied. Migrations must run in strict version order — renumber it after the latest applied version (see § 11).`);
  }
  return pending;
}

async function main() {
  const log = (m: string) => console.log(`[migrate:${ENV}]${DRY_RUN ? ' [dry-run]' : ''} ${m}`);

  if (command === 'create') {
    const slug = (opt('slug') ?? args[1] ?? '').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    if (!slug) throw new Error('Usage: migrate create <slug>');
    const version = new Date().toISOString().replace(/\D/g, '').slice(0, 14); // UTC YYYYMMDDHHmmss
    const tpl = readFileSync(join(HERE, 'migrate-template.ts'), 'utf8')
      .replace(/__VERSION__/g, version).replace(/__SLUG__/g, slug);
    const file = join(MIGRATIONS_DIR, `${version}__${slug}.ts`);
    writeFileSync(file, tpl);
    log(`created ${file}`);
    return;
  }

  const url = dbUrl();
  log(`connecting to ${redact(url)}`);
  const client = new Client({ connectionString: url });
  await client.connect();
  const sql: Ctx['sql'] = (q, params) => client.query(q, params as any[]);

  try {
    // Single-writer: take the lock without blocking; if another run holds it,
    // stop with a clear error rather than hang (see § 7). Never force past it.
    log('acquiring advisory lock…');
    const locked = (await sql(`SELECT pg_try_advisory_lock($1) AS ok`, [LOCK_KEY])).rows[0].ok;
    if (!locked) throw new Error('Another migration run holds the advisory lock — wait for it to finish and retry; never force past it (see § 7).');

    const migrations = await loadMigrations();

    if (command === 'status') {
      await ensureLedger(sql);
      const applied = await readApplied(sql);
      for (const m of migrations) log(`${applied.has(m.version) ? 'applied ' : 'pending '} ${m.version} ${m.slug}`);
      log(`${applied.size} applied, ${migrations.length - applied.size} pending`);
      return;
    }

    if (command === 'up' && DRY_RUN) {
      // One rolled-back scope: the rehearsal sees cumulative state across all
      // pending migrations AND persists nothing — not even the ledger table,
      // which is created inside this transaction and rolled back with it.
      await sql('BEGIN');
      try {
        await ensureLedger(sql);
        const pending = plan(migrations, await readApplied(sql));
        if (pending.length === 0) { log('nothing to apply'); return; }
        log(`${pending.length} migration(s) would apply: ${pending.map((m) => m.version).join(', ')}`);
        for (const m of pending) {
          if (m.transactional === false) {
            // A non-transactional op (e.g. CREATE INDEX CONCURRENTLY) can't run
            // inside this scope — log the plan without executing it (see § 6).
            log(`▶ ${m.version} ${m.slug} (non-transactional — planned, not executed)`);
            continue;
          }
          log(`▶ up ${m.version} ${m.slug}`);
          await m.up({ sql, dryRun: true, log });
        }
      } finally {
        await sql('ROLLBACK');
      }
      log('dry-run complete — rolled back, nothing recorded');
      return;
    }

    if (command === 'up') {
      await ensureLedger(sql);
      const pending = plan(migrations, await readApplied(sql));
      if (pending.length === 0) { log('nothing to apply'); return; }
      if (ENV === 'production' && !flag('yes')) {
        throw new Error('Refusing to apply to production without --yes. Run the dry-run first, then re-run with --yes.');
      }
      log(`${pending.length} migration(s) to apply: ${pending.map((m) => m.version).join(', ')}`);
      for (const m of pending) {
        const t0 = Date.now();
        log(`▶ up ${m.version} ${m.slug}`);
        if (m.transactional === false) {
          // No surrounding transaction. The body MUST be idempotent because a
          // failure here cannot be auto-rolled-back (see § 6 and § 11).
          try {
            await m.up({ sql, dryRun: false, log });
            await sql(`INSERT INTO _migrations (version, slug, checksum) VALUES ($1,$2,$3)`, [m.version, m.slug, m.checksum]);
            log(`✓ applied ${m.version} (non-transactional, ${Date.now() - t0}ms)`);
          } catch (e) {
            throw new Error(`Non-transactional migration ${m.version} failed and cannot be auto-rolled-back — inspect and clean up manually before re-running. Cause: ${(e as Error).message}`);
          }
          continue;
        }
        await sql('BEGIN');
        try {
          await m.up({ sql, dryRun: false, log });
          await sql(`INSERT INTO _migrations (version, slug, checksum) VALUES ($1,$2,$3)`, [m.version, m.slug, m.checksum]);
          await sql('COMMIT');
          log(`✓ applied ${m.version} (${Date.now() - t0}ms)`);
        } catch (e) {
          await sql('ROLLBACK');
          throw new Error(`Migration ${m.version} failed and was rolled back. Earlier migrations are committed. Fix and re-run. Cause: ${(e as Error).message}`);
        }
      }
      return;
    }

    if (command === 'down') {
      // Roll back the *highest applied* version, and only if its file is in this
      // checkout — otherwise we'd roll back an older one out of order (see § 11).
      await sql('BEGIN');
      try {
        await ensureLedger(sql);
        const applied = await readApplied(sql);
        const lastVersion = [...applied.keys()].sort().at(-1);
        if (!lastVersion) { log('nothing to roll back'); await sql('ROLLBACK'); return; }
        const last = migrations.find((m) => m.version === lastVersion);
        if (!last) throw new Error(`Applied migration ${lastVersion} has no file in this checkout — refusing to roll back out of order. Align the checkout to the deployed code first (see § 11).`);
        if (last.irreversible) throw new Error(`${last.version} is marked irreversible — cannot roll back automatically.`);
        if (ENV === 'production' && !DRY_RUN && !flag('yes')) throw new Error('Refusing to roll back production without --yes.');
        log(`▶ down ${last.version} ${last.slug}`);
        await last.down({ sql, dryRun: DRY_RUN, log });
        if (DRY_RUN) { await sql('ROLLBACK'); log(`✓ would roll back ${last.version} — rolled back, nothing recorded`); }
        else { await sql(`DELETE FROM _migrations WHERE version = $1`, [last.version]); await sql('COMMIT'); log(`✓ rolled back ${last.version}`); }
      } catch (e) { await sql('ROLLBACK'); throw e; }
      return;
    }

    throw new Error(`Unknown command "${command}". Use up | down | status | create.`);
  } finally {
    await client.query(`SELECT pg_advisory_unlock($1)`, [LOCK_KEY]).catch(() => {});
    await client.end().catch(() => {});
  }
}

main().catch((e) => { console.error(`[migrate] ✗ ${e.message}`); process.exitCode = 1; });
```

**Driver notes.** MySQL (`mysql2`): DDL is **not** transactional in MySQL — a failed multi-statement migration can leave partial DDL, so keep each MySQL migration to a single DDL statement and rely on the ledger to track progress; use `GET_LOCK()`/`RELEASE_LOCK()` for the advisory lock. SQLite (`better-sqlite3`): synchronous API (drop the `await`s), DDL is transactional, and there is no advisory lock — SQLite is single-writer already, so a file-based lock or nothing is fine.

## 3. Migration file template

`scripts/migrate-template.ts` — `migrate:create` copies it, substituting the version and slug. The **version appears twice**: in the filename prefix and as the exported `version` constant the runner asserts against, so the file states which migration it is.

```ts
import type { Ctx } from '../scripts/migrate.js';

// Version is the UTC timestamp prefix of this file's name. The runner asserts
// this matches the filename so a file always declares which migration it is.
export const version = '__VERSION__';

// Set to true ONLY when the change genuinely cannot be undone (e.g. an
// irrecoverable data drop). Then `down` must throw. Never leave `down` empty.
export const irreversible = false;

export async function up({ sql, dryRun, log }: Ctx) {
  log('creating table __SLUG__');
  // Guard with IF NOT EXISTS so the operation is re-runnable / idempotent.
  await sql(`CREATE TABLE IF NOT EXISTS example (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
  )`);
  // For a data backfill, branch on dryRun to avoid heavy work while planning,
  // and batch large updates — see reference § 8.
  if (!dryRun) {
    // await backfillInBatches(sql, log);
  }
}

export async function down({ sql, log }: Ctx) {
  log('dropping table __SLUG__');
  await sql(`DROP TABLE IF EXISTS example`);
}
```

For JS repos, emit the same with `module.exports` / `require` (CJS) or `export`/`import` (ESM) to match `package.json` `"type"`, and drop the type import.

## 4. pnpm scripts and environment resolution

Add to `package.json`. In a TS repo, `RUN` is the repo's TS runner (`tsx` shown); in a JS repo it's just `node`.

```jsonc
{
  "scripts": {
    "migrate:development":          "tsx scripts/migrate.ts up --env development",
    "migrate:development:dry-run":  "tsx scripts/migrate.ts up --env development --dry-run",
    "migrate:production":           "tsx scripts/migrate.ts up --env production",
    "migrate:production:dry-run":   "tsx scripts/migrate.ts up --env production --dry-run",
    "migrate:status":              "tsx scripts/migrate.ts status --env development",
    "migrate:create":              "tsx scripts/migrate.ts create",
    "migrate:down":                "tsx scripts/migrate.ts down --env development"
  }
}
```

Usage: `pnpm migrate:create add_users_email_index`; `pnpm migrate:development:dry-run`; `pnpm migrate:development`; production is `pnpm migrate:production:dry-run` **then** `pnpm migrate:production --yes` (the `--yes` reaches the runner via pnpm's `--` passthrough: `pnpm migrate:production -- --yes`, or add a dedicated `migrate:production:apply` script that includes `--yes`).

**Environment resolution.** The runner reads `DATABASE_URL_DEVELOPMENT` / `DATABASE_URL_PRODUCTION` (falling back to `DATABASE_URL` for development) from the environment. In development these come from a gitignored `.env` (loaded by the repo's existing mechanism, e.g. `dotenv` / `--env-file`); in production from the deploy platform's secret store. **Never** commit a production URL, and never print it (the runner redacts the password). If the repo already centralizes config, source the URL from there instead of new env vars.

## 5. The applied-migrations ledger

The ledger is the source of truth for what has been applied. For a SQL DB it's the `_migrations` table (DDL in the runner's `ensureLedger`); for a non-DB target it's a committed/sidecar JSON state file with the same fields.

Columns: `version` (PK), `slug`, `checksum` (sha256 of the migration body at apply time), `applied_at`. The runner uses it three ways:

- **Idempotency** — pending = on disk but not in the ledger; applied migrations are skipped.
- **Ordering integrity** — combined with the duplicate-version check at load time.
- **Drift detection** — if an applied migration's current checksum differs from the recorded one, someone edited a migration after it ran. That's a hard error: **never edit an applied migration; add a new one.** (Editing already-run migrations means dev, CI, and prod silently diverge.)

## 6. Transactions and the non-transactional escape hatch

Each migration runs inside `BEGIN … COMMIT` by default (unless it opts out with `transactional = false`, below). On any error the runner issues `ROLLBACK`, so a failed transactional migration leaves **no** partial state and its ledger row is only written on success. This is also what makes the dry-run meaningful:

**Dry-run semantics.** `--dry-run` runs the **whole pending sequence inside one transaction that is always `ROLLBACK`ed** — so a later migration sees the schema changes an earlier pending one would make (a real apply would), and nothing is persisted. The ledger table itself is created *inside* that rolled-back scope, so a dry-run on a fresh database leaves zero side effects — the production dry-run is genuinely read-only. It proves the migrations *execute* against the actual schema (catches a typo'd column, a missing table), strictly stronger than printing SQL. A migration can read `ctx.dryRun` to skip genuinely expensive steps (a full-table backfill) while still validating the DDL. Run it before every production apply.

**Non-transactional escape hatch.** A few operations can't run inside a transaction — notably Postgres `CREATE INDEX CONCURRENTLY` (used to add an index without locking writes on a live table) and some `ALTER TYPE … ADD VALUE`. For those, export `export const transactional = false;` from the migration and have the runner skip `BEGIN`/`COMMIT` for it (run the body directly, then record the ledger row in its own statement). Such a migration **cannot** be dry-run by rollback — instead its dry-run logs the planned statements without executing. Keep these migrations tiny and idempotent (`CREATE INDEX CONCURRENTLY IF NOT EXISTS`), because a failure can't be auto-rolled-back and may leave an invalid index to drop and recreate.

## 7. Concurrency lock

Two deploys or CI jobs applying migrations at once corrupts the ledger and can deadlock the schema. The runner takes a **single-writer advisory lock** before reading state and applying, using a **non-blocking try-lock** so a contended run fails fast with an actionable error instead of hanging before it can even show a plan:

- Postgres: `pg_try_advisory_lock(key)` (returns `false` if held) / `pg_advisory_unlock(key)` — a session-level lock, released automatically if the connection drops. Prefer this over the blocking `pg_advisory_lock`, which would hang indefinitely.
- MySQL: `GET_LOCK('migrate', 0)` (zero timeout → returns immediately) / `RELEASE_LOCK('migrate')`.
- SQLite: no advisory lock needed; it is single-writer by file.

If the lock is held, the runner **stops and reports** — a held lock means another migration run is in progress, and forcing past it is how you get two writers. Wait for the other run to finish, then retry.

## 8. Zero-downtime: expand/contract

In production the old application code keeps running during a rolling deploy, so a schema change must be **backward-compatible with the code already in production**. Use **expand → migrate → contract**, split across releases:

1. **Expand** (release N): make additive, backward-compatible changes only — add a nullable column, add a new table, add an index `CONCURRENTLY`. Old code ignores them; new code can start writing.
2. **Migrate / backfill** (release N): populate new structures from old ones in batches; deploy code that writes both old and new (dual-write) if you're moving data.
3. **Contract** (release N+1, after all instances run the new code): remove the old column/table, add the `NOT NULL`/constraint now that every row is populated.

**Never** drop or rename a column the currently-deployed app still reads, and never add a `NOT NULL` column without a default in the same step as the backfill — split them.

**Batch large backfills.** A single `UPDATE` over millions of rows locks the table and can time out. Loop in bounded batches, committing each, so the migration doesn't hold one long transaction:

```ts
export const transactional = false; // we commit per batch ourselves
export async function up({ sql, dryRun, log }: Ctx) {
  if (dryRun) { log('would backfill users.display_name in batches of 1000'); return; }
  let moved = 0;
  for (;;) {
    const { rows } = await sql(
      `WITH batch AS (
         SELECT id FROM users WHERE display_name IS NULL LIMIT 1000 FOR UPDATE SKIP LOCKED
       )
       UPDATE users u SET display_name = u.name FROM batch WHERE u.id = batch.id RETURNING u.id`,
    );
    if (rows.length === 0) break;
    moved += rows.length;
    log(`backfilled ${moved} rows…`);
  }
  log(`backfill complete: ${moved} rows`);
}
```

A backfill like this is a `chore:` migration and is safe to re-run (it only touches rows still `NULL`), which also makes it resumable after an interruption.

## 9. Production safety checklist

Before `migrate:production --yes` (mirrors the SKILL's Production safety section; this is the operator's pre-flight):

- [ ] Dry-run (`migrate:production:dry-run`) ran clean and the operator saw the plan + the exact versions that will apply.
- [ ] A recent backup exists, or point-in-time recovery covers now.
- [ ] The DB URL comes from the deploy platform's secret store, not a file in the repo.
- [ ] The change is expand/contract-safe for the code currently running (no drop/rename of a column the live app reads; no `NOT NULL` without default alongside its backfill).
- [ ] Large backfills are batched (§ 8), not one giant `UPDATE`.
- [ ] Only one migration run will execute (advisory lock; no other deploy in flight).
- [ ] There's a known rollback move: the migration's `down`, or a documented manual step if `irreversible`.

## 10. CI verification

Add a CI job that proves migrations are sound on every PR — this is what makes the system trustworthy. Against an ephemeral database service (e.g. a `postgres` service container):

1. **Apply forward on a fresh DB:** `pnpm migrate:development` from empty → must succeed.
2. **Round-trip the newest migration:** `pnpm migrate:down` then `pnpm migrate:development` again → proves `down` is correct and `up` is re-appliable.
3. **No duplicate versions / filename-version match:** the runner's load step already throws on these; a `pnpm migrate:status` invocation in CI surfaces them.
4. **Dry-run is clean:** `pnpm migrate:development:dry-run` exits 0.
5. **Drift guard — and its limit.** The runner's checksum drift check only fires against a database whose ledger already recorded the *old* checksum (i.e. staging/production, or a CI job that restores a populated baseline). A fresh-DB CI job has an empty ledger, so it will happily apply an edited historical migration with the new checksum — it does **not** catch drift on its own. To catch "someone edited an applied migration" in CI on a fresh DB, commit a `migrations/.checksums` manifest (version → sha256) and add a CI step that recomputes each file's checksum and fails on any mismatch with the manifest; regenerate the manifest only when adding a *new* migration. (Where CI can restore a production/staging snapshot, step 1 against that baseline catches drift directly.)

Wire `DATABASE_URL_DEVELOPMENT` to the CI service DB. Keep the job separate from unit tests so a migration failure is unambiguous in the checks list.

## 11. Failure and recovery

- **A migration failed mid-run.** It was rolled back (transactional case), so the database matches the state *before* that migration and earlier migrations are committed and recorded. Fix the failing migration **file** (it was never recorded, so editing it is not drift) and re-run — the runner resumes from the first pending version. Do **not** hand-edit the database to "get past" it.
- **A non-transactional migration failed** (§ 6). It may have left partial state (e.g. an invalid index). Inspect, clean up manually per the migration's own notes (drop the invalid index), then re-run. This is why non-transactional migrations must be tiny and idempotent.
- **Drift error on apply.** An applied migration's file changed. Do not "fix" by deleting ledger rows. Restore the original migration content; put the intended change in a **new** migration. If dev and prod genuinely diverged, reconcile deliberately with the maintainer — never silently re-checksum.
- **Lock held / can't acquire.** Another run is in progress (or a previous run's connection didn't release). Wait; if you're certain no run is active, the session lock auto-releases when that connection ends — find and end it rather than forcing.
- **Wrong environment.** If a migration was applied to the wrong DB, use its `down` to reverse it (if reversible) and re-apply to the correct one. Irreversible mistakes are why production requires a dry-run, `--yes`, and a backup.
