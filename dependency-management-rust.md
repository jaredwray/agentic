# Dependency Management (Rust)

Workflow for upgrading both **dev/build dependencies** (with CI tooling) and **runtime dependencies**, one pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Only stop to ask the user when the document explicitly says to stop and report (e.g. uncommitted changes, Rust toolchain mismatch) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next dep PR`, or similar. Never open a second dep-management PR while one is already in flight.
>
> **Dev phase before runtime phase.** Finish every dev group before starting any runtime group — tooling churn is lower risk than runtime changes.

## Repository type

Determine the repo shape first:

- **Workspace** — the root `Cargo.toml` has a `[workspace]` table. Handle the workspace root and each member crate.
- **Single-crate** — everything else. The root crate is the only crate.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Sync `main` before each branch; start test services with the project's documented command (e.g. `make test-services-up`, `docker compose up -d`, or a `cargo xtask` recipe) if one exists.
- **`sandbox`** — anything else (CI, single-branch agent session, no Docker). If the sandbox can't create separate branches and PRs, stop and report.

## Phases

Run the two phases in order. Do not interleave.

1. **Dev phase** — `[dev-dependencies]`, `[build-dependencies]`, and GitHub Actions. Exhaust every dev group (one PR per group, serially) before moving to the runtime phase.
2. **Runtime phase** — `[dependencies]` ecosystems and standalone runtime crates. Begin only after every dev group has either been merged or documented as a deferral.

## Standard groups

Group upgrades by toolchain or ecosystem. Each group is **one branch and one PR** containing every listed crate that appears in `cargo outdated` (`cargo install cargo-outdated` if it's not already present). In workspaces, a group may span `[workspace.dependencies]` at the root — the canonical place to bump versions when members inherit via `dep = { workspace = true }` — and multiple member crates.

### Dev groups

Surface with `cargo outdated --depth 1` (single-crate) or `cargo outdated --workspace --depth 1` (workspace). `cargo outdated` doesn't split by dep kind — read the `Kind` column (`Development` / `Build` / `Normal`) or cross-reference `Cargo.toml`. Priority order within the dev phase:

1. **Code quality tooling → 1 PR** (testing + linting + property/snapshot tooling always travel together):
   `proptest`, `quickcheck`, `rstest`, `insta`, `mockall`, `mockito`, `wiremock`, `criterion`, `divan`, `pretty_assertions`, `assert_cmd`, `assert_fs`, `predicates`, `trybuild`, `cargo-nextest` (if pinned in CI), clippy/rustfmt config crates.

2. **Build tooling → 1 PR**:
   `[build-dependencies]` such as `cc`, `bindgen`, `cmake`, `prost-build`, `tonic-build`, `built`, `vergen`, `protobuf-codegen`. Also include xtask helper crates and code-generation helpers not shipped at runtime.

3. **Workspace / dev orchestration tooling → 1 PR**:
   `cargo-make`, `cargo-xtask` helper deps, `cargo-husky`, repo-level dev scripts. (Tools installed globally via `cargo install` are not part of this group — surface them only if the repo pins them in CI.)

4. **GitHub Actions → 1 PR** (only if `.github/workflows/` exists; not surfaced by `cargo outdated`):
   Upgrade every `uses: <action>@<ref>` reference to the latest available version, including Rust-specific actions like `dtolnay/rust-toolchain`, `Swatinem/rust-cache`, `taiki-e/install-action`.
   - Branch: `chore/github-actions`
   - PR title: e.g. `root - chore: upgrade GitHub Actions` (or `workspace - chore: …`); append `(breaking)` if any action's major changed
   - Match the existing pin style (full SHA, `@vX`, or `@vX.Y.Z`) — don't change pin style during the upgrade
   - Verify the workflow YAML still parses before opening the PR

**Exclude from dev groups even when they appear in `cargo outdated`** — these belong to runtime ecosystem groups and ship in the runtime phase: any dev-dep that is the test/macro counterpart of a runtime crate (e.g. `tokio-test` when bumping `tokio`, `axum-test` when bumping `axum`, `sqlx-cli` when bumping `sqlx`). When the runtime ecosystem moves, its dev-dep companions move with it.

### Runtime groups

Surface with `cargo outdated --depth 1` filtered to `Normal` kind, or inspect `Cargo.toml` `[dependencies]` directly. Also inspect `[dev-dependencies]` and `[build-dependencies]` for ecosystem-adjacent crates that travel with a runtime group (`tokio-test`, `axum-test`, `sqlx-cli`, `tonic-build`, etc.) — those belong in their runtime ecosystem's PR. Priority order within the runtime phase:

1. **Async runtime → 1 PR** (only one async runtime per project; pick the one in use):
   Tokio (`tokio`, `tokio-*` including `tokio-stream`, `tokio-util`, `tokio-rustls`, plus `tokio-test`), or `async-std` + `async-std-*`, or `smol` + `smol-*`.

2. **Serde → 1 PR**:
   `serde`, `serde_json`, `serde_yaml`, `serde_urlencoded`, `serde_with`, `bincode`, `rmp-serde`, `ciborium`, `toml` (when used via serde), and all `serde_*` derive helpers. `serde` and `serde_derive` must match versions.

3. **Backend ecosystems** — one PR per ecosystem (only group crates clearly part of the same ecosystem):
   - HTTP stacks → 1 PR per stack: Hyper/Tower (`hyper`, `hyper-util`, `tower`, `tower-http`, `http`, `http-body`), Axum (`axum`, `axum-extra`, `axum-macros`, `axum-test`), Actix-web (`actix-web`, `actix-*`), Rocket (`rocket`, `rocket_*`), Reqwest (`reqwest`, `reqwest-middleware`)
   - gRPC / Protobuf → 1 PR: `tonic`, `tonic-build`, `tonic-reflection`, `prost`, `prost-build`, `prost-types`
   - Database / ORM → 1 PR per stack: SQLx (`sqlx`, `sqlx-*`, `sqlx-cli`), SeaORM (`sea-orm`, `sea-orm-*`, `sea-query`), Diesel (`diesel`, `diesel_*`, `diesel-async`), MongoDB (`mongodb`, `bson`), Redis (`redis`, `deadpool-redis`)
   - TLS / crypto → 1 PR per stack: Rustls (`rustls`, `rustls-*`, `tokio-rustls`, `webpki-roots`), Native TLS (`native-tls`, `tokio-native-tls`, `openssl`, `openssl-sys`); group `ring` / `aws-lc-rs` with whichever TLS stack they back
   - Tracing / logging → 1 PR: `tracing`, `tracing-subscriber`, `tracing-*`, `tracing-opentelemetry`, `opentelemetry`, `log`, `env_logger`, `slog*`
   - Error handling → 1 PR (only if multiple update together; otherwise singletons): `anyhow`, `thiserror`, `eyre`, `color-eyre`, `miette`
   - CLI parsing → 1 PR: `clap`, `clap_*` (`clap_derive`, `clap_complete`, `clap_mangen`, `clap_lex`)
   - AWS SDK → 1 PR: `aws-config`, `aws-credential-types`, `aws-sdk-*`, `aws-smithy-*`, `aws-types` — these crates release in lockstep, never upgrade one without the others

4. **Everything else → 1 PR per crate**:
   Standalone runtime deps with no clear ecosystem partner each get their own PR.

## Workflow

Run these steps on the **first** invocation, and again on **every resume** when the user says `continue`, `next`, `next dep PR`, or similar.

1. **Sync `main`.** Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`. If `rust-toolchain.toml` or `rust-toolchain` is present, confirm `rustc --version` matches before continuing.

2. **Start test services if `local`.** If the project documents a test-service bootstrap command (e.g. `make test-services-up`, `docker compose up -d`, `cargo xtask test-services`), run it — it should be idempotent. Docker must be running. On a container conflict, remove only the conflicting test-service container and retry — never remove unrelated containers.

3. **Determine the active phase.**
   - If any dev group still has outdated deps (ignoring the dev-phase exclusions above), the active phase is **dev**.
   - Otherwise, if any runtime group still has outdated deps, the active phase is **runtime**.
   - If neither phase has any remaining group, the workflow is **done** — report the full list of merged PRs and any documented deferrals (e.g. "tokio 2.0 bumps MSRV past 1.85 — deferred") and stop.

4. **Pick the next group.** Within the active phase, pick the highest-priority group from [Standard groups](#standard-groups) that still has outdated deps. Plan the group across all affected member crates (in workspaces, one group may span `[workspace.dependencies]` and several members).

5. **Open the PR.**
   - Branch from latest `main` (naming: `chore/<group-key>` — e.g. `chore/code-quality`, `chore/build-tooling`, `chore/github-actions`, `chore/tokio`, `chore/serde`, `chore/axum`, `chore/sqlx`, `chore/aws-sdk`, `chore/<crate>` for singletons).
   - Apply the upgrade — `cargo upgrade --package <crate> --to <version>` (from `cargo-edit`; `cargo install cargo-edit` if missing) rewrites the requirement in `Cargo.toml` and `[workspace.dependencies]`. `<version>` is the exact value from the "Latest" column of `cargo outdated`. **Never** `cargo upgrade --incompatible` blindly across the workspace, and **never** edit `Cargo.lock` by hand.
   - Refresh the lockfile — run `cargo update -p <crate>` so `Cargo.lock` reflects the new resolutions, and commit `Cargo.lock` alongside the `Cargo.toml` changes. **Never** run an unscoped `cargo update` — it pulls every transitive dep to its latest compatible version and balloons the diff.
   - Verify the upgrade. The minimum gate is `cargo build --workspace --all-targets && cargo test --workspace`; also run `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt -- --check`, and `cargo +<msrv> build --workspace --all-targets` if MSRV is declared (see [MSRV rule](#msrv-rule)). These are the same checks CI will run.
   - Open the PR — title and body per [Pull request rules](#pull-request-rules).

6. **Drive CI to green.** After opening the PR, watch CI with `gh pr checks --watch`. If any check fails, diagnose, fix, and push until every check is green. **Do not stop on a red PR.** Only after the PR is green do you proceed.

7. **Check for already-merged.** Before stopping, run `gh pr view <pr-number> --json state,mergedAt` (or equivalent). If the PR is already merged — auto-merge was enabled, or the user merged during CI — treat that as an implicit `next` and **return to Step 1 immediately**. Do not wait, do not prompt. The same applies if the head branch is already gone from the remote.

8. **Stop and wait.** Report to the user with exactly these four things:
   - PR URL and group name
   - Confirmation that CI is green
   - What's still left in the active phase, and whether the runtime phase has remaining work
   - **A literal prompt to resume**, e.g.: *"Merge the PR when you're ready, then reply `continue` (or `next`) and I'll open the next dep-management PR."*

   Then **wait**. Do not open another PR. The workflow resumes only when the user says `continue`, `next`, `next dep PR`, or similar — at which point, return to Step 1.

## Pull request rules

- **One PR per logical group — always.** Don't combine unrelated groups. Don't fragment a clear group across multiple PRs.
- **Only one open dep-management PR at a time.** If a previous dep-management PR is still open, do not open another — drive its CI to green if needed, then stop and wait per Step 8.
- Every PR uses a unique branch from latest `main`.
- If the environment can't create separate branches or PRs (sandbox, single-branch session, etc.), stop and report. Don't bundle groups onto one branch as commits.
- **You must respond to every comment that is not you on what you did.** Reply to each PR comment, review, and review-thread comment authored by someone other than yourself — bots included (Codecov, dependency-bot, GitHub Advisory, clippy review bots, etc.). Reply inline on review-thread comments; for top-level reviews and PR-level bot comments, leave a top-level PR comment. State concretely what was done (or why no action is needed) and reference the commit SHA when applicable. Skip only comments you authored.
  - **Exception — don't engage in pleasantry loops.** Do not reply to comments (especially from bots) that are pure pleasantries (e.g. "You're welcome", "Glad I could help", "Good luck with the merge", "Thanks for the PR") that introduce no new question, finding, or action item. This applies both to initial acknowledgements *and* to follow-ups to substantive discussions. Replying to non-actionable acknowledgements just keeps the loop going. The rule above covers comments about *what you did*; a thank-you is not such a comment.

### Version targeting

**The "Latest" column from `cargo outdated` is the exact target version — never upgrade past it.** Don't cross-reference crates.io, GitHub releases, or CHANGELOGs to pick a newer version. `cargo outdated` shows two version columns — `Compat` (the newest version reachable inside the current `Cargo.toml` requirement) and `Latest` (the newest on crates.io regardless of requirement) — the upgrade target is **always** `Latest`.

### Title prefixes

| Scope                                       | Prefix                  |
| ------------------------------------------- | ----------------------- |
| Workspace root                              | `workspace - chore: `   |
| Cross-crate workspace change                | `workspace - chore: `   |
| Specific crate (any repo)                   | `<crate name> - chore: ` |
| Single-crate repo with no obvious name      | `root - chore: `        |

Examples:

- `workspace - chore: upgrade code quality dependencies`
- `api - chore: upgrade build tooling`
- `root - chore: upgrade GitHub Actions`
- `workspace - chore: upgrade tokio dependencies`
- `workspace - chore: upgrade serde dependencies`
- `api - chore: upgrade axum dependencies`
- `worker - chore: upgrade sqlx dependencies`
- `root - chore: upgrade aws-sdk dependencies`
- `root - chore: upgrade reqwest`

### PR body

Keep PR bodies short. Use this skeleton, omitting sections that don't apply:

```
## Summary
<one sentence: what's upgraded>

## Versions
- `<crate>` `<old>` → `<new>`

## Checks
- [x] `cargo build --workspace --all-targets` passes
- [x] `cargo test --workspace` passes
- [x] `cargo clippy --workspace --all-targets -- -D warnings` passes (if used)
- [x] `cargo fmt -- --check` passes (if used)
- [x] MSRV build passes (if MSRV declared)

## Breaking notes
<only for (breaking) PRs — list code changes required and any deprecated APIs replaced>
```

Don't add commentary beyond the skeleton unless something genuinely surprising came up (e.g. a flaky test pre-existing on `main`, or a transitive feature-flag change).

### Major version upgrades

- Research breaking changes before applying — read the crate's `CHANGELOG.md` or release notes on GitHub.
- Update code as needed for the new version (API renames, removed features, new required features).
- Append `(breaking)` to the PR title: `workspace - chore: upgrade tokio dependencies (breaking)`.
- **Each major version upgrade gets its own PR.** Never combine two unrelated majors in one PR. The only exception is related majors within a single ecosystem that must move together (e.g. `serde` + `serde_derive`, `tonic` + `prost`, `axum` + the `tower` peers it requires) — those may share one PR.
- Pre-1.0 minor bumps (`0.x` → `0.(x+1)`) are major for semver purposes — treat them the same way.

## MSRV rule

If any crate in the repo declares `package.rust-version` (the Minimum Supported Rust Version), **no upgrade may raise the effective MSRV past the declared value.** Never upgrade a crate whose new minimum exceeds the project's MSRV.

Determine the project's MSRV from the first available source, in order:

1. `package.rust-version` in the workspace root `Cargo.toml`
2. `package.rust-version` in any member crate's `Cargo.toml` (the highest wins as the effective floor)
3. `rust-toolchain.toml` or `rust-toolchain` (the pinned toolchain)
4. CI configuration (the lowest Rust version a CI job runs against)

Pin upgrades within that floor. Example: `rust-version = "1.75"` → never upgrade to a crate that requires Rust 1.76, even if its "Latest" shows that version as available.

If sources disagree, stop and report the mismatch — don't guess.

When an upgrade would raise the MSRV, defer it: document it as a deferral and move on to the next group. Don't bump MSRV silently during a dep PR. If the project does not test MSRV in CI but declares `rust-version`, ask the user before bumping that field.
