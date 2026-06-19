---
name: codebase-archaeology
description: Map an unfamiliar codebase like a new hire would — entry points, main flow, core-vs-peripheral modules, conventions in play, safe first-change candidates, legacy and risky areas, and questions for the team. Use when the user is new to a repo, asks how this codebase works, where to start, to help understand a project, or needs an onboarding map before changing code. Read-only investigation; produces a written map.
user-invocable: true
---

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
- **Architecture proposals.** "The codebase should be restructured to X" is not in scope — this manual describes what is, not what should be. If a redesign is warranted, route to the `adr` skill.
- **Deep audits of any one module.** The map is breadth-first by design. If a specific module needs depth, run a second pass on that module with the same manual — or route to the `code-review` skill for that module's recent diffs.
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

8. **Flag legacy and risky areas.** Walk the codebase looking for [§ 4 Risk flags](./reference.md#4-risk-flags). For each finding:
   - **What** — the file or module.
   - **Why it's risky** — the specific signal (mixed paradigms, parallel `_v2`, file size, recent firefighting in commit history, single-author, language version stuck, dependency many majors out of date, "DO NOT TOUCH" comments).
   - **Severity** — 🟢 Note (worth knowing), 🟡 Caution (don't ship a change here without checking in), 🔴 Hazard (touching this without a specific reason is a near-miss waiting to happen).

   Surface the findings in the map without prescribing fixes — fixing is a separate task. The new hire should know what the minefield looks like, not be tasked with clearing it on day 1.

9. **Compile questions for the team.** Generate 6–10 questions the new hire would bring to their first 1:1 with the tech lead. Group by category per [§ 5 Question categories](./reference.md#5-question-categories-for-the-team). Each question:
   - **Is specific** — *"Why does `pkg/foo` still import from `pkg/legacy-bar`? Is that planned to go away?"* beats *"How do you handle legacy code?"*
   - **Cites the file** — every question that could be tied to a file should cite the file (`path:line`).
   - **Cannot be answered by reading the code** — if a 30-minute read of the repo would answer it, the new hire should do the 30-minute read first. Save the team's time for questions about intent, history, and roadmap.

10. **Render the map.** Format per [§ 1 Output format](./reference.md#1-output-format). Post in chat. **Do not propose code changes** beyond the "safe first change" candidates, which are suggestions for the user to act on separately.

11. **Stop.** Wait for the user. They may approve the map, ask for depth on one area, ask for the safe-first-change candidates expanded, or push back on a classification. Revise the map rather than starting over.

---

## Reference

The map output format, where-to-look-first guide, the pattern-detection cheat sheet, the risk-flag catalog, the question categories, and the anti-patterns live in [reference.md](./reference.md). Pull it in at the workflow steps that point there.
