# Dependency Management (Rust)

Workflow for upgrading both **dev/build dependencies** (with CI tooling) and **runtime dependencies**, one pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow) Step 1. Only stop to ask the user when the document explicitly says to stop and report (e.g. uncommitted changes, Rust toolchain mismatch, MSRV violation) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next dep PR`, or similar. Never open a second dep-management PR while one is already in flight.
>
> **Dev phase before runtime phase.** Finish every dev group before starting any runtime group — tooling churn is lower risk than runtime changes.

## Required tools

The workflow relies on two cargo extensions on top of stable cargo:

- `cargo-outdated` — surfaces outdated deps with a "Latest" column. Install with `cargo install cargo-outdated`.
- `cargo-edit` — provides `cargo upgrade` for changing version requirements in `Cargo.toml`. Install with `cargo install cargo-edit`. (Modern cargo has `cargo add` / `cargo remove` built in; `cargo upgrade` still comes from `cargo-edit`.)

If either is missing, stop and report — don't fall back to ad-hoc `Cargo.toml` edits.

## Repository type

Determine the repo shape first:

- **Workspace** — the root `Cargo.toml` has a `[workspace]` table (with `members = [...]`). Handle the workspace root and each member crate. If `[workspace.dependencies]` is present, it's the canonical place to bump versions and member crates inherit via `dep = { workspace = true }`.
- **Single-crate** — everything else. The root crate is the only crate.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Sync `main` before each branch; start test services with the project's documented command (e.g. `make test-services-up`, `docker compose up -d`, or a `cargo xtask` recipe) if one exists.
- **`sandbox`** — anything else (CI, single-branch agent session, no Docker). If the sandbox can't create separate branches and PRs, stop and report.

## Phases

Run the two phases in order. Do not interleave.

1. **Dev phase** — `[dev-dependencies]`, `[build-dependencies]`, and GitHub Actions. Exhaust every dev group (one PR per group, serially) before moving to the runtime phase.
2. **Runtime phase** — `[dependencies]` ecosystems and standalone runtime crates. Begin only after every dev group has either been merged or documented as a deferral.

## Standard groups

Group upgrades by toolchain or ecosystem. Each group is **one branch and one PR** containing every listed crate that appears in `cargo outdated`. In workspaces, a group may span the workspace root (`[workspace.dependencies]`) and multiple member crates.

### Dev groups

Surface with `cargo outdated --depth 1` for a single-crate repo, or `cargo outdated --workspace --depth 1` for a workspace. `cargo outdated` does not split by dep kind — read the `Kind` column (`Development` / `Build` / `Normal`) to identify dev/build deps, or cross-reference `Cargo.toml`. Priority order within the dev phase:

1. **Code quality tooling → 1 PR** (testing + linting helpers + property/snapshot tooling always travel together):
   `proptest`, `quickcheck`, `rstest`, `insta`, `mockall`, `mockito`, `wiremock`, `criterion`, `divan`, `tokio-test`, `pretty_assertions`, `assert_cmd`, `assert_fs`, `predicates`, `trybuild`, `cargo-nextest` (if pinned in CI), clippy/rustfmt config crates.

2. **Build tooling → 1 PR**:
   `[build-dependencies]` such as `cc`, `bindgen`, `cmake`, `prost-build`, `tonic-build`, `built`, `vergen`, `protobuf-codegen`. Also include xtask helper crates and code-generation helpers that aren't shipped at runtime.

3. **Workspace / dev orchestration tooling → 1 PR**:
   `cargo-make`, `cargo-xtask` helper deps, `cargo-husky`, repo-level dev scripts. (Tools installed globally via `cargo install` are not part of this group — surface them only if the repo pins them in CI.)

4. **GitHub Actions → 1 PR** (only if `.github/workflows/` exists; not surfaced by `cargo outdated`):
   Upgrade every `uses: <action>@<ref>` reference to the latest available version. This includes Rust-specific actions like `dtolnay/rust-toolchain`, `Swatinem/rust-cache`, `taiki-e/install-action`, `taiki-e/cache-cargo-install-action`, `actions-rust-lang/setup-rust-toolchain`.
   - Branch: `chore/github-actions`
   - PR title: e.g. `root - chore: upgrade GitHub Actions` (or `workspace - chore: …`); append `(breaking)` if any action's major changed
   - Match the existing pin style (full SHA, `@vX`, or `@vX.Y.Z`) — don't change pin style during the upgrade
   - Verify the workflow YAML still parses before opening the PR

**Exclude from dev groups even when they appear in `cargo outdated`** — these belong to runtime ecosystem groups and ship in the runtime phase: any dev-dep that is the test/macro counterpart of a runtime crate (e.g. `tokio-test` when bumping `tokio` major, `axum-test` when bumping `axum`, `sqlx-cli` when bumping `sqlx`). When the runtime ecosystem moves, its dev-dep companions move with it.

### Runtime groups

Surface with `cargo outdated --depth 1` and filter to `Normal` kind, or inspect `Cargo.toml` `[dependencies]` directly. Also inspect `[dev-dependencies]` and `[build-dependencies]` for ecosystem-adjacent crates that travel with a runtime group (e.g. `tokio-test`, `axum-test`, `sqlx-cli`, `tonic-build`) — those belong in their runtime ecosystem's PR. Priority order within the runtime phase:

1. **Async runtime ecosystem → 1 PR** (only one async runtime per project; pick the one in use):
   - Tokio: `tokio`, `tokio-*` (`tokio-stream`, `tokio-util`, `tokio-tungstenite`, `tokio-rustls`, …), `tokio-test`.
   - Or async-std: `async-std`, `async-std-*`.
   - Or smol: `smol`, `smol-*`.

2. **Serde ecosystem → 1 PR**:
   `serde`, `serde_json`, `serde_yaml`, `serde_urlencoded`, `serde_with`, `serde-aux`, `bincode`, `rmp-serde`, `ciborium`, `toml` (when used via serde), and `serde_*` derive helpers. Move them together because `serde` and `serde_derive` must match.

3. **Tracing / logging → 1 PR**:
   `tracing`, `tracing-subscriber`, `tracing-*`, `tracing-opentelemetry`, `opentelemetry`, `opentelemetry-*`, `log`, `env_logger`, `slog*`.

4. **Error handling → 1 PR** (only if multiple update together; otherwise treat as singletons):
   `anyhow`, `thiserror`, `eyre`, `color-eyre`, `miette`.

5. **HTTP client / server core → 1 PR per stack** (only group crates clearly part of the same ecosystem):
   - **Hyper / Tower** stack: `hyper`, `hyper-util`, `hyper-rustls`, `tower`, `tower-http`, `http`, `http-body`, `http-body-util`.
   - **Axum**: `axum`, `axum-extra`, `axum-macros`, `axum-test`. Include `tower` + `tower-http` here if the axum upgrade requires them — in that case there's no separate Tower PR.
   - **Actix-web**: `actix-web`, `actix-*`.
   - **Rocket**: `rocket`, `rocket_*`.
   - **Reqwest**: `reqwest`, `reqwest-middleware`, `reqwest-retry`.

6. **gRPC / Protobuf → 1 PR**:
   `tonic`, `tonic-build`, `tonic-reflection`, `tonic-health`, `prost`, `prost-build`, `prost-types`, `prost-derive`.

7. **Database / ORM → 1 PR per ecosystem**:
   - SQLx: `sqlx`, `sqlx-*`, `sqlx-cli`.
   - SeaORM: `sea-orm`, `sea-orm-*`, `sea-query`.
   - Diesel: `diesel`, `diesel_*`, `diesel-async`.
   - MongoDB: `mongodb`, `bson`.
   - Redis: `redis`, `deadpool-redis`, `bb8-redis`.

8. **Crypto / TLS → 1 PR per stack**:
   - Rustls: `rustls`, `rustls-*`, `tokio-rustls`, `rustls-pemfile`, `webpki-roots`.
   - Native TLS: `native-tls`, `tokio-native-tls`, `openssl`, `openssl-sys`.
   - `ring`, `aws-lc-rs`, `aws-lc-sys` — group with whichever TLS stack they back.

9. **CLI parsing → 1 PR**:
   `clap`, `clap_*` (`clap_derive`, `clap_complete`, `clap_mangen`, `clap_lex`).

10. **AWS SDK → 1 PR**:
    `aws-config`, `aws-credential-types`, `aws-sdk-*`, `aws-smithy-*`, `aws-types`. The SDK crates release in lockstep — never upgrade one without the others.

11. **Everything else → 1 PR per crate**:
    Standalone runtime deps with no clear ecosystem partner each get their own PR.

## Workflow

Run these steps on the **first** invocation, and again on **every resume** when the user says `continue`, `next`, `next dep PR`, or similar.

1. **Sync `main`.** Confirm the working tree is clean (`git status --short`); if there are uncommitted changes, stop and report — never discard uncommitted work. Then `git checkout main && git pull --ff-only origin main`.

2. **Start test services if `local`.** If the project documents a test-service bootstrap command (e.g. `make test-services-up`, `docker compose up -d`, `cargo xtask test-services`), run it — it should be idempotent. Docker must be running. On a container conflict, remove only the conflicting test-service container and retry — never remove unrelated containers.

3. **Verify the Rust toolchain.** If `rust-toolchain.toml` or `rust-toolchain` is present, the active toolchain is pinned by rustup automatically — confirm `rustc --version` matches before continuing. If `package.rust-version` (MSRV) is set in any crate's `Cargo.toml`, record it — every upgrade must keep building under MSRV.

4. **Determine the active phase.**
   - If any dev group still has outdated deps (ignoring the dev-phase exclusions above), the active phase is **dev**.
   - Otherwise, if any runtime group still has outdated deps, the active phase is **runtime**.
   - If neither phase has any remaining group, the workflow is **done** — report the full list of merged PRs and any documented deferrals (e.g. "tokio 2.0 bumps MSRV past 1.85 — deferred") and stop.

5. **Pick the next group.** Within the active phase, pick the highest-priority group from [Standard groups](#standard-groups) that still has outdated deps. Plan the group across all affected member crates (in workspaces, one group may span `[workspace.dependencies]` and several members).

6. **Open the PR.**
   - Branch from latest `main` (naming: `chore/<group-key>` — e.g. `chore/code-quality`, `chore/build-tooling`, `chore/github-actions`, `chore/tokio`, `chore/serde`, `chore/axum`, `chore/sqlx`, `chore/aws-sdk`, `chore/<crate>` for singletons).
   - Apply the upgrade. Prefer `cargo upgrade --package <crate> --to <version>` (from `cargo-edit`) — it rewrites the version requirement in `Cargo.toml` (and `[workspace.dependencies]` when applicable). Alternative: `cargo add <crate>@<version>` (built-in) for crates already listed, which is equivalent. `<version>` is the exact value from the "Latest" column of `cargo outdated`. **Never** `cargo upgrade --incompatible` blindly across the workspace, and **never** edit `Cargo.lock` by hand — let cargo regenerate it.
   - After all crate edits, run `cargo update --workspace` (or `cargo update -p <crate>` per crate) so `Cargo.lock` reflects the new resolutions. Commit `Cargo.lock` alongside the `Cargo.toml` changes.
   - Verify the upgrade. The minimum gate is `cargo build --workspace --all-targets && cargo test --workspace`. If the project uses additional checks (`cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt -- --check`, `cargo nextest run`, `cargo deny check`, `cargo audit`), run those too — they're the same checks CI will run.
   - If an MSRV is declared, also run `cargo +<msrv> build --workspace --all-targets` (or the project's documented MSRV check). If MSRV breaks, see [MSRV rule](#msrv-rule).
   - Open the PR — title and body per [Pull request rules](#pull-request-rules).

7. **Drive CI to green.** After opening the PR, watch CI with `gh pr checks --watch`. If any check fails, diagnose, fix, and push until every check is green. **Do not stop on a red PR.** Only after the PR is green do you proceed.

8. **Check for already-merged.** Before stopping, run `gh pr view <pr-number> --json state,mergedAt` (or equivalent). If the PR is already merged — auto-merge was enabled, or the user merged during CI — treat that as an implicit `next` and **return to Step 1 immediately**. Do not wait, do not prompt. The same applies if the head branch is already gone from the remote.

9. **Stop and wait.** Report to the user with exactly these four things:
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

### Version targeting

**The "Latest" column from `cargo outdated` is the exact target version — never upgrade past it.** Don't cross-reference crates.io, GitHub releases, or CHANGELOGs to pick a newer version.

A few cargo-specific notes:

- `cargo outdated` shows two version columns: `Compat` is the newest version reachable inside the current `Cargo.toml` requirement; `Latest` is the newest version on crates.io regardless of the requirement. The upgrade target is **always** `Latest`.
- A bare `"1.2.3"` in `Cargo.toml` means `>=1.2.3, <2.0.0`. After running `cargo upgrade`, expect the requirement string to change to the new version's minor (e.g. `"1.5.0"`), not to a `^` or `~` prefix unless that was the existing style.
- Pre-1.0 crates treat each minor bump as a breaking change (`0.4.x` → `0.5.x` is a major in semver-for-zerover). Treat them like majors: append `(breaking)` to the PR title and research the changelog.

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

Don't add commentary beyond the skeleton unless something genuinely surprising came up (e.g. a flaky test pre-existing on `main`, or a transitive feature flag change).

### Major version upgrades

- Research breaking changes before applying — read the crate's `CHANGELOG.md` or release notes on GitHub.
- Update code as needed for the new version (API renames, removed features, new required features).
- Append `(breaking)` to the PR title: `workspace - chore: upgrade tokio dependencies (breaking)`.
- **Each major version upgrade gets its own PR.** Never combine two unrelated majors in one PR. The only exception is related majors within a single ecosystem that must move together (e.g. `serde` + `serde_derive`, `tonic` + `prost`, `axum` + the `tower` peers it requires) — those may share one PR.
- Pre-1.0 minor bumps (`0.x` → `0.(x+1)`) are major for semver purposes — treat them the same way.

## MSRV rule

If any crate in the repo declares `package.rust-version` (the Minimum Supported Rust Version), **no upgrade may raise the effective MSRV past the declared value.**

Determine the project's MSRV from the first available source, in order:

1. `package.rust-version` in the workspace root `Cargo.toml`
2. `package.rust-version` in any member crate's `Cargo.toml` (the highest wins as the effective floor)
3. `rust-toolchain.toml` or `rust-toolchain` (the pinned toolchain)
4. CI configuration (the lowest Rust version a CI job runs against)

If sources disagree, stop and report the mismatch — don't guess.

When an upgrade requires raising the MSRV:

- If the project explicitly tests against MSRV in CI, the upgrade is **deferred** — document it and move on to the next group. Don't bump MSRV silently during a dep PR.
- If the project does not test MSRV in CI but declares `rust-version`, ask the user before bumping that field; otherwise defer.

## Lockfile and registry rule

- `Cargo.lock` is committed for binary crates and workspaces; for pure library crates it may be `.gitignored`. Follow whatever the repo already does — don't change the convention during a dep PR.
- Never run `cargo update` without `-p <crate>` or `--workspace` scoping when you only mean to update a specific crate; an unscoped `cargo update` will pull every transitive dep to its latest compatible version and balloon the diff.
- If `[patch.crates-io]` or `[replace]` entries exist, leave them alone — they're upstream overrides, not normal dependencies. Surface them in the PR description if a group's crates are patched.
