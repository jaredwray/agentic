# Rust

Rules for a Rust package root. Workspace: the root `Cargo.toml` has a `[workspace]` table — handle
the root and every member crate, and bump `[workspace.dependencies]` when members inherit with
`dep = { workspace = true }`. Otherwise the root crate is the only crate.

## Package manager

Cargo. Install `cargo-outdated` and `cargo-edit` if missing (`cargo install cargo-outdated cargo-edit`).
When `rust-toolchain.toml` or `rust-toolchain` is present, confirm `rustc --version` matches it before
any change.

## Runtime version

**MSRV rule.** When any crate declares `package.rust-version`, no upgrade may raise the effective MSRV
past it. The floor is the first of: `package.rust-version` in the workspace root `Cargo.toml`;
`package.rust-version` in any member crate (the highest wins); `rust-toolchain.toml` or
`rust-toolchain`; the lowest Rust version a CI job runs against. If these disagree, stop and report. A
crate whose `rust_version` on crates.io exceeds the floor is a deferral — `rust-version = "1.75"` never
takes a crate that requires 1.76 — and `rust-version` is never raised inside a dependency PR; when the
project declares it but CI does not test it, ask before touching it.

`rust` images follow `rust-toolchain.toml` and stay within the MSRV rule: a `rust:1.85` → `rust:1.86`
bump ships only when `rust-toolchain.toml` already declares `1.86` or moves to it in the same PR.

## Candidates

`cargo outdated --depth 1` (single crate) or `cargo outdated --workspace --depth 1` (workspace). It
does not split by dependency kind — read its `Kind` column (`Development` / `Build` / `Normal`) or
cross-reference `Cargo.toml`. `Normal` crates are runtime groups.

**Exclude from dev groups** a dev-dependency that is the test or macro companion of a runtime crate —
`tokio-test` with `tokio`, `axum-test` with `axum`, `sqlx-cli` with `sqlx`. It moves with that
ecosystem's runtime group.

## Dev groups

1. **Code quality tooling → 1 PR** (`chore/code-quality`): `proptest`, `quickcheck`, `rstest`, `insta`, `mockall`, `mockito`, `wiremock`, `criterion`, `divan`, `pretty_assertions`, `assert_cmd`, `assert_fs`, `predicates`, `trybuild`, `cargo-nextest` when CI pins it, clippy and rustfmt config crates.
2. **Build tooling → 1 PR** (`chore/build-tooling`): `[build-dependencies]` such as `cc`, `bindgen`, `cmake`, `prost-build`, `tonic-build`, `built`, `vergen`, `protobuf-codegen`, plus xtask and code-generation helpers that never ship at runtime.
3. **Workspace / dev orchestration tooling → 1 PR** (`chore/dev-tooling`): `cargo-make`, `cargo-xtask` helper deps, `cargo-husky`, repo-level dev scripts. Tools installed globally with `cargo install` count only when CI pins them.

## Runtime groups

1. **Async runtime → 1 PR** (`chore/tokio`, or the runtime's name) — the one in use: Tokio (`tokio`, `tokio-*` such as `tokio-stream`, `tokio-util`, `tokio-rustls`, plus `tokio-test`), or `async-std` and `async-std-*`, or `smol` and `smol-*`.
2. **Serde → 1 PR** (`chore/serde`): `serde`, `serde_json`, `serde_yaml`, `serde_urlencoded`, `serde_with`, `bincode`, `rmp-serde`, `ciborium`, `toml` when used through serde, and every `serde_*` helper. `serde` and `serde_derive` must match.
3. **Backend ecosystems → 1 PR each** — only crates clearly in the same ecosystem:
   - HTTP stacks, one PR per stack: Hyper/Tower (`hyper`, `hyper-util`, `tower`, `tower-http`, `http`, `http-body`); Axum (`axum`, `axum-extra`, `axum-macros`, `axum-test`); Actix-web (`actix-web`, `actix-*`); Rocket (`rocket`, `rocket_*`); Reqwest (`reqwest`, `reqwest-middleware`)
   - gRPC / Protobuf: `tonic`, `tonic-build`, `tonic-reflection`, `prost`, `prost-build`, `prost-types`
   - Database / ORM, one PR per stack: SQLx (`sqlx`, `sqlx-*`, `sqlx-cli`); SeaORM (`sea-orm`, `sea-orm-*`, `sea-query`); Diesel (`diesel`, `diesel_*`, `diesel-async`); MongoDB (`mongodb`, `bson`); Redis (`redis`, `deadpool-redis`)
   - TLS / crypto, one PR per stack: Rustls (`rustls`, `rustls-*`, `tokio-rustls`, `webpki-roots`); native TLS (`native-tls`, `tokio-native-tls`, `openssl`, `openssl-sys`); `ring` / `aws-lc-rs` with the stack they back
   - Tracing / logging: `tracing`, `tracing-subscriber`, `tracing-*`, `tracing-opentelemetry`, `opentelemetry`, `log`, `env_logger`, `slog*`
   - Error handling, when several move together: `anyhow`, `thiserror`, `eyre`, `color-eyre`, `miette`
   - CLI parsing: `clap`, `clap_*`
   - AWS SDK: `aws-config`, `aws-credential-types`, `aws-sdk-*`, `aws-smithy-*`, `aws-types` — they release in lockstep
4. **Everything else → 1 PR per crate** (`chore/<crate>`).

## Apply and verify

- Bump with `cargo upgrade --package <crate> --to <version>`, which rewrites the requirement in `Cargo.toml` and `[workspace.dependencies]`; `<version>` is the target from [Version targeting](#version-targeting). **Never** run `cargo upgrade --incompatible` blindly across the workspace.
- Refresh the lockfile with `cargo update -p <crate>` and commit `Cargo.lock` with the `Cargo.toml` changes. **Never** run an unscoped `cargo update` — it pulls every transitive crate to its newest compatible version — and never edit `Cargo.lock` by hand.
- Verify: `cargo build --workspace --all-targets && cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt -- --check`, and `cargo +<msrv> build --workspace --all-targets` when an MSRV is declared.

## Version targeting

`cargo outdated` shows `Compat` (the newest version inside the current requirement) and `Latest` (the
newest on crates.io). `Latest` is the ceiling, never the target by itself: the target is the newest
non-yanked, non-pre-release version at or below it that was published at least 7 days ago and whose
`rust_version` is at or below the floor — both from the crates.io row of the release-age gate in
`SKILL.md`. Don't cross-reference GitHub releases or changelogs to pick another version.

## AI models

Scan `.rs` source, including `build.rs`, examples, and tests; skip `Cargo.lock`. Provider crates:
`async-openai`, `anthropic`, `rig-core`, `genai`, `aws-sdk-bedrockruntime`, `ollama-rs`.

Titles, e.g. `workspace - chore: upgrade code quality dependencies`, `api - chore: upgrade build
tooling`, `workspace - chore: upgrade tokio dependencies`.
