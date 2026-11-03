---
name: dependency-management-rust
description: Upgrade a Rust project's dev, build, and runtime dependencies one grouped PR at a time, respecting the pinned toolchain, a 7-day age gate on container and Dev Container image pins, and running the dev phase before the runtime phase — then, last, the AI model IDs the code calls (look up each provider's latest, recommend, bump on approval). Every resume also checks jaredwray/agentic for defense-in-depth and AGENTS.md updates and syncs stale copies. Use when asked to update, upgrade, or bump Cargo dependencies or AI models on a Rust project. Manual and resumable; one PR per group.
disable-model-invocation: true
user-invocable: true
---

# Dependency Management (Rust)

Workflow for upgrading both **dev/build dependencies** (with CI tooling) and **runtime dependencies**, one pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow), which runs the `shipping-conventions` loop from its first step. Only stop to ask the user when that loop or this document says to stop and report (e.g. uncommitted changes, Rust toolchain mismatch) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next dep PR`, or similar. Never open a second dep-management PR while one is already in flight.
>
> **Every PR is ready for review, never a draft.** Mark the PR ready for review when you open it (`draft: false`, or the tool's ready-for-review equivalent). If it was created as a draft — including when the environment defaults to draft — mark it ready for review before you stop. Do not leave any PR in draft mode.
>
> **Dev phase before runtime phase.** Finish every dev group before starting any runtime group — tooling churn is lower risk than runtime changes.
>
> **Delegated mode.** When the `dependency-management` router hands this skill one package root, follow its delegation contract: work only in that root, run only the phase it names, and skip every step marked *(router-owned)*.
>
> This skill follows the shared `shipping-conventions` loop; PR titles, bodies, and review replies follow `pr-conventions` (the dependency-specific PR-body skeletons below extend it). The GitHub Actions group and every container image group are `repo-dependency-groups`.

## Repository type

Determine the repo shape first:

- **Workspace** — the root `Cargo.toml` has a `[workspace]` table. Handle the workspace root and each member crate.
- **Single-crate** — everything else. The root crate is the only crate.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Sync `main` before each branch; start test services with the project's documented command (e.g. `make test-services-up`, `docker compose up -d`, or a `cargo xtask` recipe) if one exists.
- **`sandbox`** — anything else (CI, hosted agent session, no Docker). Resolve branch capability before starting, per `shipping-conventions` → Branch-constrained environments. One group per branch per PR is the only shape this workflow ships.

## Phases

Run the two phases in order. Do not interleave.

1. **Dev phase** — `[dev-dependencies]`, `[build-dependencies]`, GitHub Actions, Docker build-time images, and Dev Container images. Exhaust every dev group (one PR per group, serially) before moving to the runtime phase.
2. **Runtime phase** — `[dependencies]` ecosystems and standalone runtime crates, then the AI model IDs the code calls. Begin only after every dev group has either been merged or documented as a deferral.

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

4–6. **GitHub Actions, Docker build-time images, Dev Container images** *(router-owned)* — `chore/github-actions`, `chore/docker-build-images`, and `chore/devcontainer-images` (digest pins under the 7-day age gate) per `repo-dependency-groups`, with the Rust row of its Image version agreement. The GitHub Actions group includes Rust actions like `dtolnay/rust-toolchain`, `Swatinem/rust-cache`, and `taiki-e/install-action`.

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

5–6. **Docker runtime images, Docker service images** *(router-owned)* — per `repo-dependency-groups`.

7. **AI models → 1 PR per provider** *(router-owned)* (only if the repo references AI model IDs; not surfaced by `cargo outdated`):
   Every model ID the code, config, or env templates hand to an AI provider. Runs last so the provider crates (`async-openai`, `anthropic`, `rig-core`, `genai`, `aws-sdk-bedrockruntime`, `ollama-rs`, and the like) are already at their targets. The provider is whoever serves the call — `anthropic`, `openai`, `google`, `bedrock`, `vertex` — so a hosting platform's IDs are one group even when they front several vendors.
   - Branch: `chore/ai-models-<provider>` (e.g. `chore/ai-models-anthropic`, `chore/ai-models-bedrock`)
   - PR title: e.g. `root - chore: upgrade Anthropic models`
   - Discovery, catalog lookup, and the per-provider approval are `ai-model-discovery`; scan `.rs` source (including `build.rs`, examples, and tests) in addition to the files it lists, and skip `Cargo.lock`

## MSRV rule

When any crate declares `package.rust-version`, no upgrade may raise the effective MSRV past it. The floor is the first of: `package.rust-version` in the workspace root `Cargo.toml`; `package.rust-version` in any member crate (the highest wins); `rust-toolchain.toml` or `rust-toolchain`; the lowest Rust version a CI job runs against. If these disagree, stop and report. A crate whose new minimum exceeds the floor is documented as a deferral — `rust-version = "1.75"` never takes a crate that requires 1.76, even when "Latest" shows it — and `rust-version` is never raised silently inside a dep PR; when the project declares it but does not test it in CI, ask the user before touching it.

## Workflow

The loop — sync `main`, resolve branch capability, pick one item, open the PR, drive CI to green,
check for already-merged, stop and wait for `continue` — is `shipping-conventions`. Run it, with the
**item taxonomy** and **branch naming** below (`chore/<group-key>`, `chore/agentic-sync`). Its first step syncs `main` and
stops on a dirty working tree — do not skip ahead to the numbered steps here, which are additions
*inside* that loop, not a replacement for it. When syncing, if `rust-toolchain.toml` or
`rust-toolchain` is present, confirm `rustc --version` matches before continuing.

1. **Start test services if `local`.** If the project documents a test-service bootstrap command (e.g. `make test-services-up`, `docker compose up -d`, `cargo xtask test-services`), run it — it should be idempotent. Docker must be running. On a container conflict, remove only the conflicting test-service container and retry — never remove unrelated containers. If the next group is a Docker or Dev Container image group, ensure `skopeo` is available (install if needed).

2. **Check `jaredwray/agentic` for updates** *(router-owned)*. Run `agentic-upstream-sync`. If it changes any file (a stale copy, a missing or stale `AGENTS.md` section, or a missing `CLAUDE.md` import), open that PR — branch `chore/agentic-sync`, title e.g. `root - chore: sync defense-in-depth files from agentic` — and hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait. Do not pick a standard group this iteration. A catalog behind upstream is reported; then continue to step 3. Re-run this step on every resume.

3. **Determine the active phase.**
   - If any dev group still has outdated deps (ignoring the dev-phase exclusions above) or a router-owned dev group in `repo-dependency-groups` is outdated, the active phase is **dev**.
   - Otherwise, if any runtime group still has outdated deps, Docker runtime/service images are outdated, or an AI model reference is behind its provider's latest per `ai-model-discovery` (a declined bump is a deferral, not remaining work), the active phase is **runtime**.
   - If neither phase has any remaining group, the workflow is **done** — report the full list of merged PRs and any documented deferrals (e.g. "tokio 2.0 bumps MSRV past 1.85 — deferred", declined model bumps) and stop.

4. **Pick the next group.** Within the active phase, pick the highest-priority group from [Standard groups](#standard-groups) that still has outdated deps. Plan the group across all affected member crates (in workspaces, one group may span `[workspace.dependencies]` and several members).

5. **Apply the upgrade.** Branch: `chore/<group-key>` — e.g. `chore/code-quality`, `chore/build-tooling`, `chore/github-actions`, `chore/devcontainer-images`, `chore/tokio`, `chore/serde`, `chore/axum`, `chore/sqlx`, `chore/aws-sdk`, `chore/<crate>` for singletons.
   - Bump it — `cargo upgrade --package <crate> --to <version>` (from `cargo-edit`; `cargo install cargo-edit` if missing) rewrites the requirement in `Cargo.toml` and `[workspace.dependencies]`. `<version>` is the exact value from the "Latest" column of `cargo outdated`. **Never** `cargo upgrade --incompatible` blindly across the workspace, and **never** edit `Cargo.lock` by hand.
   - Refresh the lockfile — run `cargo update -p <crate>` so `Cargo.lock` reflects the new resolutions, and commit `Cargo.lock` alongside the `Cargo.toml` changes. **Never** run an unscoped `cargo update` — it pulls every transitive dep to its latest compatible version and balloons the diff.
   - Verify the upgrade. The minimum gate is `cargo build --workspace --all-targets && cargo test --workspace`; also run `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt -- --check`, and `cargo +<msrv> build --workspace --all-targets` if MSRV is declared (see [MSRV rule](#msrv-rule)). These are the same checks CI will run.
   - **For a Docker or Dev Container image group**, follow `repo-dependency-groups`. An image's Rust version follows `rust-toolchain.toml` and the [MSRV rule](#msrv-rule): a `rust:1.85` → `rust:1.86` bump ships only when `rust-toolchain.toml` already declares `1.86` or moves to it in the same PR.
   - **For AI model groups**, run `ai-model-discovery` first and take only the one provider's approved bumps it hands back. Replace every approved reference (code, config, env templates, docs), make the request-shape changes the provider's migration guide requires, and verify as above; if the tests call the provider live and no credentials are available, say so in the PR body. The PR body lists each `current → target` with the provider's catalog link, and any out-of-repo values (CI repository variables, deployment config) the user must change by hand.
   - Open the PR **ready for review**, never as a draft — title and body per [Pull request rules](#pull-request-rules). Pass `draft: false` (or the tool's ready-for-review equivalent). If the PR was created as a draft, mark it ready for review before continuing.

   Then hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait.
   Report what's left in the active phase and whether the runtime phase still has work.

## Pull request rules

Loop invariants (one group per PR, one open PR at a time, branch from latest `main`,
branch-constrained environments, ready for review and never a draft) are `shipping-conventions`.
Review replies and the pleasantry-loop exception are `pr-conventions`. What's specific to this workflow:

### Version targeting

**The "Latest" column from `cargo outdated` is the exact target version — never upgrade past it.** Don't cross-reference crates.io, GitHub releases, or CHANGELOGs to pick a newer version. `cargo outdated` shows two version columns — `Compat` (the newest version reachable inside the current `Cargo.toml` requirement) and `Latest` (the newest on crates.io regardless of requirement) — the upgrade target is **always** `Latest`. A `Latest` that raises the MSRV is a deferral, per the [MSRV rule](#msrv-rule).

**For Docker and Dev Container image groups**, there is no `cargo outdated` equivalent. The target is the newest digest in the current lineage that is at least 7 days old, per `repo-dependency-groups`. Do not pin whatever the registry's `latest` tag points at today.

**For AI model groups**, the target is the provider's newest generally-available model in the same tier as the current reference, per `ai-model-discovery`; it becomes a bump only once the user approves it.

### Title prefixes

Per `pr-conventions` → Prefix scheme for the automated ops loops.
Examples:

- `workspace - chore: upgrade code quality dependencies`
- `api - chore: upgrade build tooling`
- `root - chore: upgrade GitHub Actions`
- `workspace - chore: upgrade tokio dependencies`
- `root - chore: pin Dev Container images`
- `root - chore: upgrade Anthropic models`
- `root - chore: sync defense-in-depth files from agentic`
