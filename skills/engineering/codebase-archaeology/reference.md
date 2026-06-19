# Codebase Archaeology — reference

Reference material for the `codebase-archaeology` skill. The workflow points here at the steps that need it.

## 1. Output format

Render the map as a single chat message in this shape. Keep prose tight — every line earns its place.

````md
# Codebase Map — <repo or codebase name>

**Archaeologist:** Evidence-from-the-dig lens; speculation labeled `inferred`.
**Access level:** full repo / tree only / fragments
**Date of dig:** YYYY-MM-DD

## Topology
- **Language(s):** <e.g. "TypeScript 5.3 (`package.json:engines`), one Python script in `scripts/` (Python 3.11)">
- **Framework(s):** <e.g. "Next.js 14 (app router; `next.config.js`), Prisma 5 (`prisma/schema.prisma`)">
- **Repo shape:** <single-package / monorepo (which tool) / polyrepo>
- **Build:** <command that builds and runs; cite the file>
- **Deploy target:** <e.g. "Vercel (`vercel.json`); a worker on Fly (`fly.toml`)">

## Entry points
- **HTTP server:** `path/to/server.ts:1` — boots <router>, loads <config>, mounts <middleware>.
- **Worker:** `path/to/worker.ts:1` — consumes <queue>, runs <handlers>.
- **CLI:** `path/to/cli.ts:1` — commands: `<list>`.
- (or "no separate worker / CLI / lambda — single HTTP server.")

## Main flow (HTTP request → response)
1. `path/router.ts:42` — router dispatches `/payouts/create` to `createPayoutHandler`.
2. `path/handlers/payout.ts:18` — handler validates input, calls `PayoutService.create`.
3. `path/services/payout.ts:55` — service runs business rules, calls `db.payouts.insert` and `rails.submit`.
4. `path/services/payout.ts:88` — returns `PayoutResult`; handler shapes the HTTP response at `path/handlers/payout.ts:36`.

## Module classification
| Module | Class | Evidence |
|---|---|---|
| `src/core/` | **Core** | 47 incoming imports; 14 distinct authors in last year |
| `src/lib/log/` | Supporting | 31 incoming imports; last commit 8 months ago; stable |
| `src/integrations/legacy-bank/` | Legacy | `// TODO: migrate to v2`; parallel `legacy-bank-v2/` exists |
| `src/experiments/ab-test-2023/` | Dead | 0 incoming imports; no tests; last commit 14 months ago |
| `src/admin/` | Peripheral | 3 incoming imports; small surface |
| ... | ... | ... |

## Patterns and conventions
- **File naming:** `kebab-case.ts` for files, `PascalCase` for component files (`src/components/PayoutForm.tsx`).
- **Error handling:** result types — `Result<T, AppError>` (`src/lib/result.ts:1`). Exceptions reserved for programmer errors.
- **Async style:** `async/await` throughout; no callbacks except in one legacy file (`src/legacy/db.js:42`).
- **Testing:** vitest, co-located `*.test.ts` next to source; one `integration/` dir for db-touching tests.
- **DI:** constructor injection in services (`src/services/payout.ts:12`); no DI container.
- **Commit style:** Conventional Commits with monorepo prefixes (`mono - chore: ...`, `payouts - fix: ...`).

## Safe first-change candidates
1. **Add the missing JSDoc on `PayoutService.preview`** (`src/services/payout.ts:120`). Small, well-tested area, signals you read the conventions in surrounding files. Avoid the related `create` function — different blast radius.
2. **Remove the dead `src/experiments/ab-test-2023/` directory.** Zero imports (verified). One PR, clear win. Check with the team first that they haven't kept it for a reason.
3. **Fix the broken link in `CONTRIBUTING.md:42`.** Trivial; lets you exercise the PR template and CI on a safe change.

## Legacy / risky areas
- 🔴 `src/integrations/legacy-bank/` — parallel `legacy-bank-v2/` exists, migration incomplete since 2024-08. Touching either side without coordinating is risky.
- 🟡 `src/services/billing.ts` — 1,400 lines, one author (`@alice`) in `git blame`, low test coverage on the refund path. Approach with reviewer support.
- 🟡 `src/scripts/migrate-2022.py` — one-off migration script committed but never deleted. Don't run it; ask whether it should be archived.
- 🟢 `src/lib/log/` — stable for 8 months; touching it is unusual but not dangerous if the change is local.

## Questions for the team
- **About the code:** `src/integrations/legacy-bank/` vs. `legacy-bank-v2/` — what's the migration plan and timeline? Is one side off-limits for new work?
- **About process:** how do PRs get reviewed — required reviewers from `CODEOWNERS` or ad-hoc? What's the SLA on a PR?
- **About history:** what's the biggest production incident in the last year, and which module was at the center? (Best signal for "where the minefield is.")
- **About roadmap:** which modules are likely to be rewritten in the next 6 months? I'd rather not invest deep context there.
- **About tooling:** `pnpm dev` vs. the README's `npm start` — which is the current canonical local-dev command?
- **About ownership:** `src/services/billing.ts` is mostly one author — who's the secondary reviewer for changes there?
````

Rules for the rendered map:

- **Every confident claim cites a file.** A module classification without an evidence column is a guess.
- **Speculation is labeled `inferred`.** "This is probably a worker dir" without reading a file is `inferred`; reading `cmd/worker/main.go` and citing it is not.
- **No marketing.** Drop "modern", "clean", "well-architected", "elegant." Describe what it is, not how it makes you feel.
- **No proposals.** "This should be refactored" is not a map finding — it's a follow-up ticket the user can open separately.
- **Safe-first-change candidates are 2–3, not 10.** A list of ten candidates is the same as no recommendation.
- **Risk flags carry severity.** A flat "be careful" list is noise; severity tells the new hire where to actually slow down.

## 2. Where to look first

A canonical reading order. In a typical codebase, going through this list in order pays off faster than browsing.

1. **`README.md`** — read it, but mistrust the parts that look stale (commands that no longer match `package.json` scripts, links to dead docs).
2. **`CONTRIBUTING.md`** — the team's stated conventions. Useful even when violated, because the violations tell you which conventions stuck.
3. **`ARCHITECTURE.md` / `docs/architecture/` / `docs/adr/`** — if present, this is the team's own onboarding map. Read it before doing your own. Note where the doc diverges from the actual code — those gaps are the most important questions for the team.
4. **`package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml`** — dependencies, scripts, language version. The `scripts` block tells you the team's actual local-dev workflow.
5. **`.github/workflows/`** — the CI pipeline is the contract for "what must pass." It reveals: test commands, linters, deploy steps, environments, secrets needed.
6. **`Dockerfile` / `docker-compose.yml`** — what the production environment actually looks like. Often diverges from local-dev assumptions.
7. **`CODEOWNERS`** — who reviews what. Maps directly onto the bus-factor analysis in Step 5.
8. **Entry-point file** — from Step 3's search. Read the first ~50 lines of the main entry point even if nothing else.
9. **The largest 5 files** — `find . -name '*.ts' -exec wc -l {} + | sort -rn | head` (adapt the extension). Large files are usually either the core domain logic or the code-smell hotspots. Either way, they're load-bearing.
10. **`git log --oneline -50`** — recent activity. Where the team has been working is where the system is currently fragile or fast-moving.

## 3. Pattern detection cheat sheet

Common conventions to look for, with the file/feature that gives them away.

- **TypeScript: strict / non-strict** — `tsconfig.json` `compilerOptions.strict`. Non-strict signals a codebase that may have evolved before strict mode existed.
- **React: hooks-era vs. class-era** — `useState` / `useEffect` everywhere = hooks era. `componentDidMount` / `componentWillMount` = pre-2019 era; rewriting is often in progress.
- **Node.js: ESM vs. CJS** — `package.json` `"type": "module"`. ESM in a mostly-CJS codebase usually marks an in-flight migration.
- **Python: type hints adoption** — sampled `def` signatures. Full hints = modern; mixed = mid-migration; none = legacy.
- **Go: stdlib vs. framework** — `net/http` only = lean style; `gin` / `echo` / `chi` = framework adoption.
- **Database access** — raw SQL (`pg`, `sqlx`), query builder (`knex`), or ORM (`Prisma`, `Drizzle`, `TypeORM`, `SQLAlchemy`)? Mixing two is a smell.
- **Auth** — a single auth library used consistently, or hand-rolled token verification scattered across handlers?
- **Config** — typed config object loaded once at boot, or `process.env.X` / `os.getenv('X')` scattered across files? The scattered shape is harder to operate.
- **Feature flags** — a flag library (`launchdarkly`, `growthbook`, `unleash`), env-var-based booleans, or none? No flag system in a system with non-trivial traffic is itself a flag.
- **Background work** — a real queue (`bullmq`, `celery`, `sidekiq`, `temporal`) or `setTimeout` / cron-via-cron? The latter limits ops options.

## 4. Risk flags

Surface every match. Severity (🟢 / 🟡 / 🔴) is judgement — calibrate to how load-bearing the affected code is.

- **Mixed paradigms in one module** — callbacks and `async/await`, class components and hooks, ORM and raw SQL. Usually a half-done migration.
- **Parallel `_v2` / `_new` / `_old` files or directories.** Almost always a migration that stalled. The riskiest shape: both versions are live and read at runtime.
- **Files over 1,000 lines.** Not automatically a bug, but a near-certain smell — usually a god-object or a router-as-business-logic.
- **Recent firefighting in commit history.** Subjects like `fix urgent`, `hotfix`, `revert revert`, `actually fix`. Cluster of these in one path = a recently-on-fire module.
- **Single-author bus factor.** A file or module where `git log --format='%an' -- path | sort -u` returns one name. Risky to touch without that author's input.
- **Language / framework version stuck.** Node 14 in 2026, Python 3.8 in 2026, React 16. Often blocks dependency upgrades cascade-wide.
- **Dependencies many majors out of date.** `pnpm outdated --long` or equivalent — anything 3+ majors behind is either pinned for a reason or forgotten; ask the team which.
- **"DON'T TOUCH" / "HACK" / "TEMPORARY (2019)" comments.** Treat as load-bearing — the code is fragile, the temporary fix is now permanent.
- **No tests in a critical path.** Critical = on the main flow from Step 4. No tests means refactors are unsafe and bugs ship.
- **A test file that mocks the function under test.** `vi.mock('./foo'); ... test('foo does X', ...)` — the test is verifying the mock, not the code. Worse than no test.
- **Generated code committed without a regeneration script.** Drift between source and generated artifact is a class of bug nobody catches.
- **Secrets in the repo history.** Even if rotated, the presence of a former secret in `git log -p` suggests the security posture has gaps elsewhere.

## 5. Question categories for the team

Every onboarding 1:1 should produce questions from these categories. The map's "Questions" section uses these as scaffolding.

- **About the code** — specific files / modules the map could not interpret on artifacts alone (parallel `_v2` dirs, dead-looking modules that may not be dead, conventions that vary).
- **About process** — review process, who owns what, branch / PR / merge conventions, deploy cadence, on-call rotation, alert rotation.
- **About history** — biggest production incident in the last year (where the minefield actually is), last big refactor (and how it went), most-regretted past decision.
- **About roadmap** — what's likely to be rewritten in the next 6 months (don't invest deep context there), what's frozen (safe to depend on), what's being deprecated.
- **About tooling** — canonical local-dev command (the README is often wrong), how to run tests in the realistic way the team runs them, how to debug a failing CI job locally.
- **About ownership** — who's the secondary reviewer for the single-author modules, who knows the deploy pipeline, who knows the auth system.
- **About culture** — when is it OK to push back on a review, what's the etiquette around `WIP` PRs, how do disagreements about design get resolved.

## 6. Anti-patterns the archaeologist must avoid

- **The framework-pitch map.** Describing what the framework's docs claim instead of what the codebase actually does. "This is a Next.js app, so it uses the app router" — verify against `app/` vs. `pages/`. Read the artifacts.
- **The unlabeled inference.** Calling a directory "the worker module" because the name says so, without opening a file. Either read a file and cite it, or label the claim `inferred`.
- **The map without evidence columns.** A module classification table without an evidence column is opinion. The whole point of the dig is the evidence.
- **The "everything is risky" risk list.** Twenty 🔴 flags is the same as zero — the new hire can't act on a uniform red list. Calibrate severity.
- **The "fix what you find" instinct.** Surfacing a bug and quietly proposing the fix in the same response. The map is read-only — fixes are a separate ticket. Surface, don't fix.
- **The first-PR list with 10 items.** One safe first PR, with 2 alternatives, beats ten candidates the user has to choose between. The map is the new hire's confidence, not their backlog.
- **The "I think the deploy is" speculation.** If the deploy target isn't evident from a file in the repo, ask the user — don't guess `terraform` because the team feels like an AWS shop.
- **The questions list that the code itself answers.** "What language is this in?" is not a team question — it's a `package.json` question. Save team time for questions the artifacts cannot answer.
- **The map that's longer than the user will read.** A new hire wants orientation, not an encyclopedia. If the map is more than 2–3 screens, the breadth is right; if it's 10 screens, depth crept in and the map is now the user's second job.
