# .NET

Rules for a .NET package root: a solution (`.sln` or `.slnx`) or a single `*.csproj`, `*.fsproj`, or
`*.vbproj` in no solution. The registry is nuget.org.

## Package manager

NuGet through the `dotnet` CLI, with `PackageReference` projects. Use the SDK `global.json` selects;
without `global.json`, the SDK CI installs. A project that still uses `packages.config` has no rules
here — report it.

## Catalog

The § 3 block:

```md
### .NET (NuGet)
- [ ] `packages.lock.json` committed for every project (`RestorePackagesWithLockFile`); CI restores with `dotnet restore --locked-mode`
- [ ] `nuget.config` at the repo root clears inherited sources and maps every package ID to one source (`<clear />`, `<packageSourceMapping>`)
- [ ] 7-day cooldown: `minPublishAgeHours="168"` on every package source in `nuget.config`; no first-party `minPublishAgeExceptions`
```

The § 5 block, only when the root publishes to nuget.org:

```md
### NuGet
- [ ] Trusted publishing policy on nuget.org names this repository, `release.yaml`, and the `release` environment (manual)
- [ ] `.github/workflows/release.yaml` packs in one job and pushes from a `release`-environment job with a `NuGet/login` short-lived key
- [ ] No nuget.org API keys: every key under the account and its organizations deleted (manual)
```

## Dependency policy

**Lock files.** Set the property once in `Directory.Build.props` at the root so every project gets
it, then run `dotnet restore` and commit each `packages.lock.json`:

```xml
<Project>
  <PropertyGroup>
    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  </PropertyGroup>
</Project>
```

- The lock records each package's version and content hash. `dotnet restore --locked-mode` restores
  exactly the locked set: a changed dependency graph fails with `NU1004`, a package whose content
  does not match its recorded hash with `NU1403`.
- Without `--locked-mode`, restore silently rewrites a stale lock, and locked mode is never
  automatic in CI — every CI restore passes the flag.
- Merge the property into an existing `Directory.Build.props`; do not add a second file.

**Sources.** One `nuget.config` at the repo root, so no machine-level or user-level source is
inherited and each package ID can come from one place only:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" minPublishAgeHours="168" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="nuget.org">
      <package pattern="*" />
    </packageSource>
  </packageSourceMapping>
</configuration>
```

- Keep every source the repo already uses. Map a private feed to its own ID prefix
  (`<package pattern="Contoso.*" />`); the most specific pattern wins, so a first-party ID can never
  resolve from nuget.org. A package with no mapping fails restore with `NU1100`.
- `minPublishAgeHours` needs .NET SDK 11.0.100 or newer. It filters the version `dotnet package add`
  and `dotnet package update` choose; restore does not check age, so the lock file is what holds a
  version in place and `dependency-management` dates every version it adopts. The sample above is
  the end state: the attribute is the cooldown item's change, not the source-mapping item's. Run
  `dotnet restore` with the repo's SDK after adding it. If that SDK rejects the attribute, do not
  ship it: report that the cooldown needs .NET SDK 11 and move to the next item.
- No first-party excludes: a `<minPublishAgeExceptions>` section gains no entry to reach a younger
  version.
- Restoring a `PackageReference` package runs no install script. Build is different: a package's
  `build/` `.props` and `.targets` files are imported into the build, and its analyzers load into
  the compiler. Nothing blocks that, so the lock file, source mapping, and Socket's review of every
  dependency change are what stand in front of it.

## Install protection

- **CI — Socket Firewall.** The free firewall does not wrap `dotnet` or `nuget`. Restore runs
  unprefixed as `dotnet restore --locked-mode`; the lock's content hashes and the source mapping
  protect it. The Firewall step still goes on every job.
- **Cloud environments — Safe Chain.** Safe Chain has no `dotnet` shim, so the cloud-bootstrap items
  do not apply to a .NET root. Locked mode protects a cloud agent's restores: use
  `dotnet restore --locked-mode` there too.
- **Dev Container image** for a new `devcontainer.json`: `mcr.microsoft.com/devcontainers/dotnet`.

## CI

- Set up with `actions/setup-dotnet` (`global-json-file: global.json` when the repo has one).
- Every restore is `dotnet restore --locked-mode`, and the steps after it pass `--no-restore`
  (`dotnet build --no-restore`, `dotnet test --no-build`) so nothing restores again without the lock.
- **Publishing workflows restore no cache.** Leave `cache` unset on `actions/setup-dotnet` (off by
  default) and add no `actions/cache` of `~/.nuget/packages`.

## Publishing

A root publishes when a workflow or script runs `dotnet nuget push` (or `nuget push`) to nuget.org,
or the user says it does.

nuget.org lists a pushed package after validation and has no staging step, so the human gate is the
reviewer-gated `release` environment in [reference.md § 5](../reference.md#5-publishing):

1. **Trusted publishing** — `NuGet/login` exchanges a GitHub OIDC token for an API key that is valid
   for one hour. The trusted publishing policy names the repository, the workflow filename, and the
   `release` environment.
2. **Pack and push are separate jobs** — the pack job restores, builds, and tests, which runs
   package build logic, with no `id-token`. The push job downloads the `.nupkg` files, restores
   nothing, and is the only job that can obtain a key.
3. **No API keys** — nuget.org has no setting that turns API keys off, so the control is that none
   exists: delete every key under the account and its organizations.

nuget.org setup (manual): under the account's *Trusted Publishing*, add a policy with the package
owner, the repository owner, the repository, workflow file `release.yaml`, and environment
`release`. Then delete every key under *API Keys*. A published version is permanent; a bad one is
unlisted, not replaced.

### Release jobs

File PR (`chore/defense-dotnet-trusted-publishing`). Add these jobs to the release workflow in
[reference.md § 5](../reference.md#5-publishing). Set `user` to the nuget.org profile name that owns
the policy (not an email address). If the repo already has a publish workflow, keep its pipeline and
move it to this shape.

```yaml
  pack-nuget:
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
      - name: Set up .NET
        uses: actions/setup-dotnet@0f4a354dd5547a28c70b7853dbd95d5b67886e73 # v6.1.0
        with:
          global-json-file: global.json

      - name: Restore
        run: dotnet restore --locked-mode

      - name: Build
        run: dotnet build --no-restore -c Release

      - name: Testing
        run: dotnet test --no-build -c Release

      - name: Pack
        run: dotnet pack --no-build -c Release -o packed

      - name: Upload packages
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: nuget-packages
          path: packed/*.nupkg
          if-no-files-found: error

  publish-nuget:
    needs: [pack-nuget]
    runs-on: ubuntu-latest
    environment: release
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Install Socket Firewall
        uses: SocketDev/action@ba6de6cc0565af1f42295590380973573297e31f # v1.3.2
        with:
          mode: firewall-free
          firewall-version: "1.15.0"
      - name: Set up .NET
        uses: actions/setup-dotnet@0f4a354dd5547a28c70b7853dbd95d5b67886e73 # v6.1.0
      - name: Download packages
        uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
        with:
          name: nuget-packages
          path: packed

      - name: NuGet login
        id: login
        uses: NuGet/login@8d196754b4036150537f80ac539e15c2f1028841 # v1.2.0
        with:
          user: nuget-profile-name

      - name: Push
        env:
          NUGET_API_KEY: ${{ steps.login.outputs.NUGET_API_KEY }}
        run: dotnet nuget push "./packed/*.nupkg" --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json
```

## Verify

`dotnet restore --locked-mode`, then `dotnet build --no-restore -c Release` and
`dotnet test --no-build -c Release`; `dotnet pack --no-build -c Release` when the root publishes.

## References

- Lock files and locked mode: https://learn.microsoft.com/en-us/nuget/consume-packages/package-references-in-project-files#locking-dependencies
- Package Source Mapping: https://learn.microsoft.com/en-us/nuget/consume-packages/package-source-mapping
- Minimum package publish age: https://learn.microsoft.com/en-us/nuget/consume-packages/minimum-package-publish-age
- MSBuild props and targets in a package: https://learn.microsoft.com/en-us/nuget/concepts/msbuild-props-and-targets
- nuget.org trusted publishing: https://learn.microsoft.com/en-us/nuget/nuget-org/trusted-publishing
- NuGet/login: https://github.com/NuGet/login
- setup-dotnet caching: https://github.com/actions/setup-dotnet#caching-nuget-packages
