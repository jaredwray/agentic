# Codebase Archaeology

Operation manual for **mapping an unfamiliar codebase like a new hire would** — entry points, main flow, core-vs-peripheral classification, the patterns and conventions in play, safe first-change candidates, legacy and risky areas, and the questions to ask the team. The deliverable is a written map posted in chat. One codebase per invocation; **no code changes** — this is read-only investigation.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Step 1 establishes what the agent can actually see (full repo, tree output only, a fragment). Only stop to ask when the document explicitly says to stop, when the codebase target is genuinely ambiguous, or when the agent's access is so limited the map would be guessing.
>
> **Persona.** Act as an **archaeologist on a dig**, not a tour guide. The map is built from **evidence visible in the codebase**, not from what the framework's marketing page says is best practice. *"This module uses class-based React components, dated by the absence of hooks and the presence of `componentWillMount`"* beats *"this is a React app."* Date strata. Read the artifacts. Don't invent context that isn't there.
>
> **No code changes.** The deliverable is a map. The map is the value — a new hire can spend a week getting to where this map gets them in a chat session. Even if a bug is obvious, surface it in the "legacy / risky" section and let the user open a separate fix ticket. **Mapping the codebase is the job; fixing what you find is a different job.**
>
> **One codebase per invocation.** Drive the map to a complete document, then stop. If the user asks for a second codebase mid-thread, finish the current one and open a new map for the second — they almost never share enough context to be one document.
>
> **Speculation is labeled.** Inferences from filenames alone, from one file in a large dir, or from defaults the agent didn't actually verify get marked `inferred` in the map. Confident claims must cite the file. Unlabeled speculation is how onboarding maps become wrong-but-confident.

## Scope

**In scope:** producing an onboarding map for a single codebase the user is unfamiliar with. The analysis covers:

1. **Topology** — language(s), framework(s), repo shape (single-package, monorepo, polyrepo orchestrated here), build system, deploy target.
2. **Entry points and main flow** — where execution actually starts (`main`, the HTTP server, the worker entry, the CLI entry, the lambda handler) and the dominant call path from entry to the system's main job.
3. **Module classification** — for each top-level module: core (load-bearing — most other things depend on it), supporting (cross-cutting infrastructure — logging, config, db access), peripheral (one-off integrations, scripts, niche features), dead (unreferenced, deprecated, stub), legacy (still wired in but on the way out).
4. **Patterns and conventions** — naming, file layout, error handling, dependency injection, async style, state management, testing style. Conventions inferred from what the codebase **actually does**, not from the docs.
5. **Safe first-change candidates** — 2–3 specific places where a new hire could land a small PR with low blast radius and high signal-to-team.
6. **Legacy / risky areas** — incomplete migrations, hotspots with recent firefighting commits, single-author bus-factor zones, dependencies many majors out of date, code with explicit "don't touch" markers.
7. **Questions for the team** — what the map could not answer from the artifacts alone, framed as questions a thoughtful new hire would ask in their first 1:1.

**Out of scope:**

- **Fixing what the map surfaces.** The map ends at the map. The user files separate tickets, refactors, or proposals for any bug or smell found.
- **Architecture proposals.** "The codebase should be restructured to X" is not in scope — this manual describes what is, not what should be. If a redesign is warranted, route to `adr.md`.
- **Deep audits of any one module.** The map is breadth-first by design. If a specific module needs depth, run a second pass on that module with the same manual — or route to `code-review.md` for that module's recent diffs.
- **Codebases the agent cannot read.** A pasted file tree with no file contents and no repo access caps the map at "what filenames imply." Surface the cap, do the best inferred version, and label it heavily.

## Workflow

Run these steps on the **first** invocation, and again on every resume when the user says `redo`, `revise`, `another codebase`, or similar.

1. **Establish what you can see.** Determine the access level and adjust depth accordingly. Three levels:
   - **Full repo access** — the codebase is cloned and the agent can read files. Best case; the map is grounded in real content.
   - **Tree only** — the user pasted `tree`, `ls -R`, or a file listing, with no file contents. The map can infer topology, classify modules by name and size, and surface questions, but specific code claims will be labeled `inferred`.
   - **Fragments** — the user pasted some file contents but not the whole repo. The map is grounded for the fragments and inferred everywhere else.

   Record the access level explicitly — it changes how much weight the rest of the map carries.

2. **Sketch the topology.** Identify in this order, citing the files that established each:
   - **Language(s) and version(s)** — from `package.json` (`engines`), `pyproject.toml` (`requires-python`), `go.mod` (`go 1.x`), `Cargo.toml` (`rust-version`), `.tool-versions`, `Dockerfile` base image, language-version files (`.nvmrc`, `.python-version`).
   - **Framework(s)** — from `package.json` dependencies (`next`, `express`, `fastify`, `react`), `requirements.txt` / `pyproject.toml` (`django`, `fastapi`, `flask`), `go.sum` (`gin`, `echo`, `chi`), import statements in entry files.
   - **Repo shape** — single-package, monorepo (look for `pnpm-workspace.yaml`, `workspaces` in `package.json`, `Cargo.toml` `[workspace]`, a `packages/` or `services/` top-level dir, `turbo.json`, `nx.json`), or a repo that orchestrates many polyrepos via submodules.
   - **Build system** — from `Makefile`, `package.json` scripts, `Taskfile.yml`, `justfile`, `gradle` files, `BUILD.bazel`. Note which command actually builds and runs the app — it's not always the one in the README.
   - **Deploy target** — from `Dockerfile`, `docker-compose.yml`, `serverless.yml`, `terraform/`, `.github/workflows/deploy.yml`, `fly.toml`, `vercel.json`, `app.yaml`, `.cloudbuild/`, `helm/`. The deploy target shapes the entry-point search in Step 3.

3. **Find the entry points.** Most codebases have 1–3 real entry points. Walk this list in order; stop at the first match for each category that exists:
   - **HTTP / RPC server** — `cmd/server/main.go`, `src/index.ts`, `src/server.ts`, `app/main.py`, `manage.py runserver`, `next/app` or `pages/`, the `start` script in `package.json`.
   - **Worker / background jobs** — `cmd/worker/`, `src/worker.ts`, `bull` / `bullmq` / `celery` / `sidekiq` worker entries, `apps/worker/`.
   - **CLI** — `bin/`, `cmd/`, `src/cli.ts`, `__main__.py`, the `bin` field in `package.json`.
   - **Lambda / function handlers** — `handler.ts`, `handler.py`, the `serverless.yml` function map, `functions/` dir.
   - **Scheduled / cron** — `cron.yaml`, `schedules/`, `.github/workflows/schedule.yml`.

   For each entry point, note: file, exported / main symbol, what it boots (which router, which DI container, which config loader), and **the first 5–10 things it does at startup**. Startup order tells you what's truly load-bearing.

4. **Trace the main flow.** Pick the entry point that represents the system's primary job (usually the HTTP server in a web app, the worker in a pipeline, the CLI in a tool). Walk from entry to the function that does the actual domain work, listing each hop:
   - The router / dispatcher → the handler.
   - The handler → the service layer (if there is one).
   - The service → the data layer / external API call.
   - The response shaping → the response return.

   Render this as a numbered hop list with `path/to/file.ts:line` for each step. **The main flow is the spine of the map.** Most other modules either feed into it (config, auth, logging) or branch off it (background jobs, webhooks, admin endpoints).

5. **Classify the modules.** For each top-level directory (or workspace, in a monorepo), pick one classification:
   - **Core** — most other things import from it; changing it ripples widely. Often: the domain model, the data layer, the central service.
   - **Supporting infrastructure** — cross-cutting code most modules use but few specialize: logging, config, error types, http client, db connection. Stable code; changes are rare and high-stakes.
   - **Peripheral** — one specific integration or feature; few imports out, few imports in. Often where it's safest to land a first PR.
   - **Dead** — no imports point at it, not registered in any handler / route / DI container, no tests. Often left over from a refactor someone never finished. Flag, don't delete.
   - **Legacy** — still imported, but on the way out. Markers: comments like `// TODO: migrate to v2`, parallel `_new.ts` / `_v2.py` files alongside it, the README says "we're moving off this."

   For each module, cite the evidence: number of incoming imports (rough count from `grep`), recent commit activity (last commit, last 5 commit subjects), bus factor (distinct authors in `git log` if available), test coverage shape (is there a `__tests__/` next to it).

6. **Identify patterns and conventions.** Read 3–5 representative files across the codebase (one from a core module, one from a handler, one from a test, one from the supporting infrastructure) and extract the conventions in play. Cover these axes — for each, name the convention **and** the file that demonstrates it:
   - **File and directory naming** — `kebab-case.ts`? `snake_case.py`? `PascalCase.cs`? `index.ts` barrels or named exports?
   - **Module layout** — one type per file? Co-located tests (`foo.test.ts` next to `foo.ts`) or separate `tests/` dir? Co-located styles? Folder-per-feature vs. folder-per-layer?
   - **Error handling style** — exceptions vs. result types vs. `(value, error)` tuples? Are errors typed (`class FooError`) or stringly?
   - **Async style** — `async/await` vs. callbacks vs. promises-then? `goroutines` + channels? `tokio`? Mixed?
   - **DI / wiring** — explicit DI container? Module-scope singletons? Constructor injection? Function-passed dependencies?
   - **State management** (frontend) — Redux / Zustand / Recoil / Context? Server-state library (TanStack Query, SWR)? Local-state only?
   - **Testing style** — unit-heavy or integration-heavy? Mocking library? Fixtures vs. factories? Snapshot tests? Test-runner (`vitest` / `jest` / `pytest` / `go test`)?
   - **Lint / format** — `.eslintrc`, `.prettierrc`, `biome.json`, `ruff.toml`, `rustfmt.toml`. The format config is the team's voted-on style.
   - **Commit / PR conventions** — read the last 20–30 commit subjects. Conventional Commits? Custom prefixes (`feat:`, `mono - chore:`)? Squash-merge or merge-commit?

   Each finding is a short line with evidence: *"Async style: `async/await` everywhere; one legacy callback-style file in `src/legacy/db.js:42`."*

7. **Pick safe first-change candidates.** Propose **2–3 candidates** for the user's first PR. Each candidate has:
   - **What to change** — specific file(s) and a sentence on the change.
   - **Why it's safe** — small blast radius (one file or fewer), well-tested area or the change adds the missing test, clearly peripheral or clearly an improvement everyone agrees on.
   - **What it signals** — what the team will learn about the new hire from this PR. ("Demonstrates you read the contributing guide", "shows you found a real gap.")
   - **What to avoid** — the diff next door, the related refactor that tempts scope creep.

   Default categories of safe first change, in roughly increasing depth: a documentation fix (typo, broken link, missing doc on a public function); a missing test for an already-stable function; an obvious dead-branch / dead-import removal; a small accessibility / a11y fix; a small dependency bump with the change already mostly automated; a small bug from an issue tagged `good first issue`. **Avoid** for first changes: auth / authz, billing / money paths, migrations, anything in the deploy pipeline, anything in a module with high bus-factor risk (single author, no tests).

8. **Flag legacy and risky areas.** Walk the codebase looking for [§ 4 Risk flags](#4-risk-flags). For each finding:
   - **What** — the file or module.
   - **Why it's risky** — the specific signal (mixed paradigms, parallel `_v2`, file size, recent firefighting in commit history, single-author, language version stuck, dependency many majors out of date, "DO NOT TOUCH" comments).
   - **Severity** — 🟢 Note (worth knowing), 🟡 Caution (don't ship a change here without checking in), 🔴 Hazard (touching this without a specific reason is a near-miss waiting to happen).

   Surface the findings in the map without prescribing fixes — fixing is a separate task. The new hire should know what the minefield looks like, not be tasked with clearing it on day 1.

9. **Compile questions for the team.** Generate 6–10 questions the new hire would bring to their first 1:1 with the tech lead. Group by category per [§ 5 Question categories](#5-question-categories-for-the-team). Each question:
   - **Is specific** — *"Why does `pkg/foo` still import from `pkg/legacy-bar`? Is that planned to go away?"* beats *"How do you handle legacy code?"*
   - **Cites the file** — every question that could be tied to a file should cite the file (`path:line`).
   - **Cannot be answered by reading the code** — if a 30-minute read of the repo would answer it, the new hire should do the 30-minute read first. Save the team's time for questions about intent, history, and roadmap.

10. **Render the map.** Format per [§ 1 Output format](#1-output-format). Post in chat. **Do not propose code changes** beyond the "safe first change" candidates, which are suggestions for the user to act on separately.

11. **Stop.** Wait for the user. They may approve the map, ask for depth on one area, ask for the safe-first-change candidates expanded, or push back on a classification. Revise the map rather than starting over.

---

## Reference

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
