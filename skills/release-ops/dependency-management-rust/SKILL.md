---
name: dependency-management-rust
description: Upgrade a Rust project's dev, build, and runtime dependencies one grouped PR at a time, respecting the pinned toolchain and running the dev phase before the runtime phase. Use when asked to update, upgrade, or bump Cargo dependencies on a Rust project. Manual and resumable; one PR per group.
disable-model-invocation: true
user-invocable: true
---

# Dependency Management (Rust)

Workflow for upgrading both **dev/build dependencies** (with CI tooling) and **runtime dependencies**, one pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow), which runs the `shipping-conventions` loop from its first step. Only stop to ask the user when that loop or this document says to stop and report (e.g. uncommitted changes, Rust toolchain mismatch) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next dep PR`, or similar. Never open a second dep-management PR while one is already in flight.
>
> **Dev phase before runtime phase.** Finish every dev group before starting any runtime group — tooling churn is lower risk than runtime changes.
>
> This skill follows the shared `shipping-conventions` loop; PR titles, bodies, and review replies follow `pr-conventions` (the dependency-specific PR-body skeletons below extend it).

## Repository type

Determine the repo shape first:

- **Workspace** — the root `Cargo.toml` has a `[workspace]` table. Handle the workspace root and each member crate.
- **Single-crate** — everything else. The root crate is the only crate.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Sync `main` before each branch; start test services with the project's documented command (e.g. `make test-services-up`, `docker compose up -d`, or a `cargo xtask` recipe) if one exists.
- **`sandbox`** — anything else (CI, hosted agent session, no Docker). Resolve branch capability before starting, per `shipping-conventions` → Branch-constrained environments. One group per branch per PR is the only shape this workflow ships.

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

5. **Docker build-time images → 1 PR** (only if `Dockerfile*`, `*.dockerfile`, or CI workflow `container:`/`services:` image refs exist; not surfaced by `cargo outdated`):
   Builder-stage `FROM` lines in multi-stage Dockerfiles and `container:`/`services:` image references in `.github/workflows/*.yml`. These images carry build tools and never ship in the final container.
   - Branch: `chore/docker-build-images`
   - PR title: e.g. `root - chore: upgrade Docker build-time images`; append `(breaking)` if any image's major version changed
   - See [Container image discovery](#container-image-discovery) for how to find and query image versions
   - See [Container image version agreement](#container-image-version-agreement) for cross-checking `rust-toolchain.toml` / `Cargo.toml rust-version`

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

5. **Docker runtime images → 1 PR per ecosystem** (only if Dockerfiles or Compose files exist; not surfaced by `cargo outdated`):
   Final-stage `FROM` lines in Dockerfiles and `image:` references in `compose.yml`/`docker-compose.yml` for application services. Group by image ecosystem (e.g. all Rust runtime images in one PR, all distroless/scratch images in another).
   - Branch: `chore/docker-<ecosystem>` (e.g. `chore/docker-rust`, `chore/docker-distroless`)
   - See [Container image discovery](#container-image-discovery) and [Container image version agreement](#container-image-version-agreement)

6. **Docker service images → 1 PR per service** (only if Compose files or CI `services:` exist):
   Infrastructure service images — `postgres`, `redis`, `nginx`, `mysql`, `elasticsearch`, etc. — in Compose definitions and CI `services:` blocks. Each service ecosystem gets its own PR.
   - Branch: `chore/docker-<service>` (e.g. `chore/docker-postgres`, `chore/docker-redis`)

## Container image discovery

Container images are not surfaced by `cargo outdated`. Use this procedure when Docker build-time or runtime groups need upgrading.

### Scan for image references

Search the repo for all container image references:

- `Dockerfile*`, `*.dockerfile` — parse every `FROM` line, including `AS <name>` aliases.
- `compose.yml`, `docker-compose.yml`, `compose.*.yml`, `docker-compose.*.yml` — parse `image:` keys and `build:` contexts.
- `.github/workflows/*.yml` — parse `container:` and `services:` image references.
- `ARG` / `ENV` version indirection — resolve variables like `ARG RUST_VERSION=1.85` used in `FROM rust:${RUST_VERSION}-slim` to determine the actual image and version.

### Classify stages

In multi-stage Dockerfiles, identify builder vs runtime stages:

- Every `FROM` line except the last is a builder stage (dev-phase group).
- The last `FROM` is the runtime stage (runtime-phase group).
- If a `FROM` uses `AS <name>` and no later `COPY --from=<name>` references it, it may be an unused stage — flag it but don't skip it.

### Query for latest versions

Use `skopeo` (does not require a Docker daemon) to inspect and list tags. Use the full image reference — `docker.io/library/<image>` for official Docker Hub images, or the full registry path for others (e.g. `ghcr.io/<owner>/<image>`, `<org>/<image>`):

- `skopeo inspect docker://<registry>/<image>:<tag>` — returns the digest and labels for the current tag.
- `skopeo list-tags docker://<registry>/<image>` — lists all available tags.
- If `skopeo` is not available, install it or use `crane` as a fallback (`crane ls <image>`, `crane digest <image>:<tag>`).

### Tag lineage targeting

Parse the current tag into `<major>[.<minor>[.<patch>]][-<variant>]`. The upgrade target is the latest tag sharing the same **major** and **variant family**. The variant family is the base variant name without its version — e.g. `alpine3.19` belongs to the `alpine` family, `bookworm` and `bullseye` are distinct families:

- `rust:1.85.0-slim-bookworm` → latest `rust:1.*-slim-bookworm` (stays on `bookworm`; `bullseye` → `bookworm` would be a family change)
- `rust:1.85-slim` → latest `rust:1.*-slim`
- `debian:bookworm-slim` → latest `debian:bookworm-slim` digest (point releases)
- `postgres:16.2-alpine` → latest `postgres:16.*-alpine*` (Alpine version may advance)

Major version bumps (`ubuntu:22.04` → `ubuntu:24.04`, `postgres:16` → `postgres:17`) are breaking — **stop and ask the user** before proceeding. Do not open a major-version Docker image PR without explicit approval. If approved, use a separate PR with `(breaking)` suffix. For Rust, since `rust:1.x` images follow the Rust release train, a minor bump (`rust:1.85` → `rust:1.86`) is not breaking by Docker convention but must respect the [MSRV rule](#msrv-rule).

**Floating tags** (e.g. `rust:1-slim` without a digest pin) resolve to the latest image at pull time. Offer to upgrade them to a pinned version — resolve the floating tag to the current concrete version and rewrite the reference (e.g. `rust:1-slim` → `rust:1.85.0-slim-bookworm`). This makes builds reproducible and gives future upgrade runs a version to compare against. If the tag already has a digest pin, the upgrade is refreshing the digest to the current manifest for that tag.

### System packages and script-installed tools

- System packages (`apt-get install`, `apk add`) are **not** independently upgraded. They follow base image upgrades — verify pins still exist in the new base image during `docker build`.
- Script-installed tools (`cargo install <tool>@<version>`, `curl | sh`) fold into their ecosystem's Docker image PR if version-pinned.
- `curl | sh` installs with no version pin are flagged for pinning but not upgraded (no version to upgrade from).

## Workflow

The loop — sync `main`, resolve branch capability, pick one item, open the PR, drive CI to green,
check for already-merged, stop and wait for `continue` — is `shipping-conventions`. Run it, with the
**item taxonomy** and **branch naming** below (`chore/<group-key>`). Its first step syncs `main` and
stops on a dirty working tree — do not skip ahead to the numbered steps here, which are additions
*inside* that loop, not a replacement for it. When syncing, if `rust-toolchain.toml` or
`rust-toolchain` is present, confirm `rustc --version` matches before continuing.

1. **Start test services if `local`.** If the project documents a test-service bootstrap command (e.g. `make test-services-up`, `docker compose up -d`, `cargo xtask test-services`), run it — it should be idempotent. Docker must be running. On a container conflict, remove only the conflicting test-service container and retry — never remove unrelated containers. If the next group is a Docker image group, ensure `skopeo` is available (install if needed).

2. **Determine the active phase.**
   - If any dev group still has outdated deps (ignoring the dev-phase exclusions above) or Docker build-time images are outdated, the active phase is **dev**.
   - Otherwise, if any runtime group still has outdated deps or Docker runtime/service images are outdated, the active phase is **runtime**.
   - If neither phase has any remaining group, the workflow is **done** — report the full list of merged PRs and any documented deferrals (e.g. "tokio 2.0 bumps MSRV past 1.85 — deferred") and stop.

3. **Pick the next group.** Within the active phase, pick the highest-priority group from [Standard groups](#standard-groups) that still has outdated deps. Plan the group across all affected member crates (in workspaces, one group may span `[workspace.dependencies]` and several members).

4. **Apply the upgrade.** Branch: `chore/<group-key>` — e.g. `chore/code-quality`, `chore/build-tooling`, `chore/github-actions`, `chore/tokio`, `chore/serde`, `chore/axum`, `chore/sqlx`, `chore/aws-sdk`, `chore/<crate>` for singletons.
   - Bump it — `cargo upgrade --package <crate> --to <version>` (from `cargo-edit`; `cargo install cargo-edit` if missing) rewrites the requirement in `Cargo.toml` and `[workspace.dependencies]`. `<version>` is the exact value from the "Latest" column of `cargo outdated`. **Never** `cargo upgrade --incompatible` blindly across the workspace, and **never** edit `Cargo.lock` by hand.
   - Refresh the lockfile — run `cargo update -p <crate>` so `Cargo.lock` reflects the new resolutions, and commit `Cargo.lock` alongside the `Cargo.toml` changes. **Never** run an unscoped `cargo update` — it pulls every transitive dep to its latest compatible version and balloons the diff.
   - Verify the upgrade. The minimum gate is `cargo build --workspace --all-targets && cargo test --workspace`; also run `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt -- --check`, and `cargo +<msrv> build --workspace --all-targets` if MSRV is declared (see [MSRV rule](#msrv-rule)). These are the same checks CI will run.
   - **For Docker image groups**, the upgrade procedure differs:
     1. Query the registry for the latest tag within the same lineage (see [Container image discovery](#container-image-discovery)).
     2. Update the tag (and digest if already pinned) in all matching locations across Dockerfiles, Compose files, and CI workflows.
     3. Update `ARG`/`ENV` version variables if the image is indirected through them.
     4. Check [Container image version agreement](#container-image-version-agreement) — `rust-toolchain.toml`, `Cargo.toml rust-version`, etc. must agree with the new image version.
     5. Verify: run `docker build` on affected Dockerfiles if Docker is available. If in sandbox without Docker, verify syntax only and note the limitation in the PR body.
     6. If the Dockerfile pins system packages (`apt-get install pkg=version`), verify they still resolve in the new base image during `docker build`; if not, update or remove the pin.
   - Open the PR — title and body per [Pull request rules](#pull-request-rules).

   Then hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait.
   Report what's left in the active phase and whether the runtime phase still has work.

## Pull request rules

Loop invariants (one group per PR, one open PR at a time, branch from latest `main`,
branch-constrained environments) are `shipping-conventions`. Review replies and the pleasantry-loop
exception are `pr-conventions`. What's specific to this workflow:

### Version targeting

**The "Latest" column from `cargo outdated` is the exact target version — never upgrade past it.** Don't cross-reference crates.io, GitHub releases, or CHANGELOGs to pick a newer version. `cargo outdated` shows two version columns — `Compat` (the newest version reachable inside the current `Cargo.toml` requirement) and `Latest` (the newest on crates.io regardless of requirement) — the upgrade target is **always** `Latest`.

**For Docker image groups**, there is no `cargo outdated` equivalent. The target is the latest tag within the same lineage, as determined by [Container image discovery](#container-image-discovery). Do not cross-reference Docker Hub's "latest" tag — target the latest tag matching the current major and variant.

### Title prefixes

Per `pr-conventions` → Prefix scheme for the automated ops loops.
Examples:

- `workspace - chore: upgrade code quality dependencies`
- `api - chore: upgrade build tooling`
- `root - chore: upgrade GitHub Actions`
- `workspace - chore: upgrade tokio dependencies`
