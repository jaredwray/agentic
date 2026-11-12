# Rust

Rules for a Rust package root: a `Cargo.toml` that is not a member of another tracked workspace,
covering its member crates. The registry is crates.io.

## Package manager

Cargo. When `rust-toolchain.toml` or `rust-toolchain` is present, it selects the toolchain; confirm
`cargo --version` matches it before any change.

## Catalog

The § 3 block:

```md
### Rust (Cargo)
- [ ] `Cargo.lock` committed; CI fetches, builds, and tests with `--locked`
- [ ] 7-day cooldown: `.cargo/config.toml` sets `[registry] global-min-publish-age = "7 days"`; no registry sets a shorter `min-publish-age`, and `resolver.incompatible-publish-age` is not `allow`
- [ ] Every `cargo install` in workflows and scripts names an exact `--version` and passes `--locked`
```

The § 5 block, only when the root publishes to crates.io:

```md
### crates.io
- [ ] Trusted publisher on crates.io names this repository, `release.yaml`, and the `release` environment, for every published crate (manual)
- [ ] `.github/workflows/release.yaml` verifies the package in one job and publishes from a `release`-environment job with a `rust-lang/crates-io-auth-action` token
- [ ] "Require trusted publishing for all new versions" on for every published crate; no crates.io API tokens remain (manual)
```

## Dependency policy

Put the policy in the root's tracked `.cargo/config.toml` so it is code-reviewed, not
developer-local:

```toml
[registry]
global-min-publish-age = "7 days"
```

- Cargo 1.100 and newer respect the setting; an older Cargo ignores it. When the toolchain the repo
  pins is older, add the setting and say in the PR body that it takes effect once the toolchain
  reaches 1.100. Moving the toolchain is `dependency-management`'s group, not this item.
- With the default `[resolver] incompatible-publish-age = "deny"`, Cargo ignores a version younger
  than the span unless `Cargo.lock` already holds it. Never set it to `allow`, in the file or through
  `CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE`, to reach a younger version, and give no registry a
  shorter `[registries.<name>] min-publish-age` — first-party registries included.
- The setting has two limits: `cargo install` ignores it, and a version whose index entry has no
  publish time is never held back. So every `cargo install` in a workflow, Makefile, or script
  names an exact version and passes `--locked`:
  `cargo install --locked <tool> --version <version>`. Before Cargo 1.100, `cargo install` ignores
  the packaged `Cargo.lock` without `--locked`.
- Commit `Cargo.lock` for libraries as well as binaries. `--locked` makes Cargo fail when the lock
  is missing or resolution would change it.
- Cargo cannot block or sandbox a dependency's `build.rs` or procedural macros: they run at build
  time with the build's privileges. The cooldown, Socket's review of every dependency change, and
  Socket Firewall on the fetch are what stand in front of them.

## Install protection

- **CI — Socket Firewall.** It wraps `cargo`. Prefix every `cargo` command that can download:
  `sfw cargo fetch --locked`, `sfw cargo build --locked`, `sfw cargo test --workspace --locked`,
  `sfw cargo package --locked`, `sfw cargo install --locked <tool> --version <version>`.
- **Cloud environments — Safe Chain.** Safe Chain has no `cargo` shim, so the cloud-bootstrap items
  do not apply to a Rust root. The cooldown in `.cargo/config.toml` and `--locked` protect a cloud
  agent's builds.
- **Dev Container image** for a new `devcontainer.json`: `mcr.microsoft.com/devcontainers/rust`.

## CI

- GitHub-hosted runners ship `rustup`, and `rust-toolchain.toml` selects the toolchain, so a
  workflow needs no setup action. Where `dtolnay/rust-toolchain` is already used, pin it to a
  commit SHA on its `master` branch and pass `toolchain:` explicitly — its `@stable`-style refs are
  branches.
- **Publishing workflows restore no cache.** Leave `Swatinem/rust-cache` and any `actions/cache` of
  `~/.cargo` or `target/` out of the release workflow.

## Publishing

A root publishes when a crate in it is on crates.io and its `Cargo.toml` does not set
`publish = false`, or a workflow or script runs `cargo publish`.

crates.io publishes an upload at once and has no staging step, so the human gate is the
reviewer-gated `release` environment in [reference.md § 5](../reference.md#5-publishing):

1. **Trusted publishing** — the publish job exchanges a GitHub OIDC token for a crates.io token
   that lasts 30 minutes and is revoked when the job ends. The trusted publisher names the
   repository, the workflow filename, and the `release` environment.
2. **Verify and publish are separate jobs** — the first job fetches, tests, and runs
   `cargo package`, which builds the packaged crate and its dependencies' build scripts with no
   `id-token`. The publish job runs `cargo publish --locked --no-verify`: it uploads without
   compiling, so no dependency code runs in the job that holds the token.
3. **Trusted publishing only** — with "Require trusted publishing for all new versions" on, crates.io
   rejects a publish made with an API token.

crates.io setup (manual, per crate): *Settings → Trusted Publishing → Add* with the repository
owner, the repository name, workflow filename `release.yaml`, and environment `release`; then tick
**Require trusted publishing for all new versions** and revoke every token under *Account Settings →
API Tokens*. The first version of a new crate still needs an API token: publish it by hand, add the
trusted publisher, then revoke the token. A published version is permanent; a bad one is yanked.

### Release jobs

File PR (`chore/defense-rust-trusted-publishing`). Add these jobs to the release workflow in
[reference.md § 5](../reference.md#5-publishing). For a workspace, add `--workspace` to
`cargo package` and `cargo publish`, or name each crate with `-p`. If the repo already has a publish
workflow, keep its pipeline and move it to this shape.

```yaml
  package-crates:
    needs: [aikido-gate]
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Install Socket Firewall
        uses: SocketDev/action@ba6de6cc0565af1f42295590380973573297e31f # v1.3.2
        with:
          mode: firewall-free
          firewall-version: "1.15.0"

      - name: Fetch Dependencies
        run: sfw cargo fetch --locked

      - name: Testing
        run: sfw cargo test --locked

      - name: Verify the package
        run: sfw cargo package --locked

  publish-crates:
    needs: [package-crates]
    runs-on: ubuntu-latest
    environment: release
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Install Socket Firewall
        uses: SocketDev/action@ba6de6cc0565af1f42295590380973573297e31f # v1.3.2
        with:
          mode: firewall-free
          firewall-version: "1.15.0"
      - name: Authenticate to crates.io
        id: auth
        uses: rust-lang/crates-io-auth-action@3268eb413133e2960fa4ae0e963ca76380c54cd9 # v1.0.6

      - name: Publish
        env:
          CARGO_REGISTRY_TOKEN: ${{ steps.auth.outputs.token }}
        run: cargo publish --locked --no-verify
```

## Verify

`cargo fetch --locked`, then `cargo build --workspace --all-targets --locked` and
`cargo test --workspace --locked`; `cargo package --locked` when the root publishes. Prefix them
with `sfw` once Socket Firewall is on the machine.

## References

- Cargo configuration (`registry.global-min-publish-age`, `resolver.incompatible-publish-age`): https://doc.rust-lang.org/cargo/reference/config.html
- `cargo install`: https://doc.rust-lang.org/cargo/commands/cargo-install.html
- Build scripts: https://doc.rust-lang.org/cargo/reference/build-scripts.html
- crates.io trusted publishing: https://crates.io/docs/trusted-publishing
- rust-lang/crates-io-auth-action: https://github.com/rust-lang/crates-io-auth-action
- Publishing on crates.io: https://doc.rust-lang.org/cargo/reference/publishing.html
