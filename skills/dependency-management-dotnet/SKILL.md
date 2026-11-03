---
name: dependency-management-dotnet
description: Upgrade a .NET project's NuGet dependencies one grouped PR at a time — test and analyzer packages, build tooling, the SDK pin and local tools, GitHub Actions, Docker and Dev Container images, then runtime ecosystems with the .NET platform packages moving together, and last the AI model IDs the code calls (recommend the provider's latest, bump on approval). Applies a 7-day release-age gate from NuGet publish dates, never drops a target framework the project builds, and handles Central Package Management and packages.lock.json. Every resume also checks jaredwray/agentic for defense-in-depth and AGENTS.md updates. Use when asked to update, upgrade, or bump NuGet packages or AI models on a C#, F#, or VB project. Manual and resumable; dev phase before runtime phase.
disable-model-invocation: true
user-invocable: true
---

# Dependency Management (.NET)

Workflow for upgrading NuGet **dev** dependencies (with CI tooling) and **runtime** dependencies, one
pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow), which runs the `shipping-conventions` loop from its first step. Only stop to ask the user when that loop or this document says to stop and report (e.g. uncommitted changes, an SDK mismatch) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next dep PR`, or similar. Never open a second dep-management PR while one is already in flight. Every PR is ready for review, never a draft.
>
> **Dev phase before runtime phase.** Finish every dev group before starting any runtime group — tooling churn is lower risk than runtime changes.
>
> **Delegated mode.** When the `dependency-management` router hands this skill one package root, follow its delegation contract: work only in that root, run only the phase it names, and skip every step marked *(router-owned)*.
>
> This skill follows the shared `shipping-conventions` loop; PR titles, bodies, and review replies follow `pr-conventions`. Release-age gating, the GitHub Actions group, and every container image group are `repo-dependency-groups`.

## Repository type

- **Solution** — a `.sln` or `.slnx`. Handle every project in it; run commands against the solution file.
- **Single project** — one `*.csproj`, `*.fsproj`, or `*.vbproj`.

Bump a version where it is declared, never in a second place:

- **Central Package Management** — `Directory.Packages.props` with `ManagePackageVersionsCentrally`
  set to `true`. Versions are `<PackageVersion>` items there; projects may carry `VersionOverride`.
- Otherwise the `Version` on each `<PackageReference>`, which may live in `Directory.Build.props` /
  `.targets`. A version held in an MSBuild property (`Version="$(SerilogVersion)"`) is bumped at the
  property.
- **Lock files** — a `packages.lock.json` beside a project (`RestorePackagesWithLockFile`) is
  refreshed and committed with the bump; CI restoring with `--locked-mode` fails on a stale one.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Start test services with the project's documented command, if it has one.
- **`sandbox`** — anything else. Resolve branch capability before starting, per `shipping-conventions` → Branch-constrained environments.

## SDK and target frameworks

- **SDK.** Use the SDK `global.json` selects (`sdk.version` with its `rollForward`); without
  `global.json`, the SDK CI installs. Install what is missing with `dotnet-install.sh`
  (`--version <sdk>` or `--channel <major.minor>`), plus the runtime of every target framework the
  tests run on (`--runtime dotnet --channel 8.0`) — a newer runtime alone cannot run a `net8.0` test
  host. The commands below are the .NET 10 SDK's `dotnet package` verbs; on an older SDK use
  `dotnet list <solution> package --outdated` and `dotnet add <project> package <id> --version <v>`
  for each referencing project.
- **Target framework rule.** The `TargetFramework` / `TargetFrameworks` values are the floor. No
  upgrade may drop a framework the project builds: restore fails with `NU1202` when a package version
  does not support one. Such a version is a deferral — the target is the newest gated version that
  restores for every framework (`EF Core 10.0.1 needs net10.0; project targets net8.0 — deferred`).
  Changing a target framework is never part of a dependency PR; it is the user's call. If a target
  framework is past end of support per [endoflife.date/dotnet](https://endoflife.date/dotnet), say so
  in the done report.

## Phases

Run the two phases in order. Do not interleave.

1. **Dev phase** — test, analyzer, and build-time packages, the SDK pin and local tools, GitHub Actions, Docker build-time images, and Dev Container images.
2. **Runtime phase** — runtime packages by ecosystem, then Docker runtime and service images, then the AI model IDs the code calls. Begin only after every dev group is merged or documented as a deferral.

## Standard groups

Each group is **one branch and one PR** covering every project in the root. Surface packages with
`dotnet package list --outdated --format json`, run against the solution. Its `latestVersion` is the
newest stable release on the feed — not age-gated and not checked against the target frameworks — so
it is a candidate, never the target; see [Version targeting](#version-targeting).

Classify each package before grouping:

- **Dev** — referenced only by test projects (`IsTestProject` is true, or the project references `Microsoft.NET.Test.Sdk`), referenced with `PrivateAssets="all"` (analyzers, SourceLink, versioning), or a local tool in `.config/dotnet-tools.json`.
- **Runtime** — everything else, including a package the shipped projects and the tests both reference. It moves in every project at once, in its runtime group.

### Dev groups

1. **Test and code quality → 1 PR**:
   `Microsoft.NET.Test.Sdk`, `xunit`, `xunit.*`, `xunit.v3*`, `NUnit`, `NUnit3TestAdapter`, `NUnit.Analyzers`, `MSTest.*`, `coverlet.*`, `Moq`, `NSubstitute`, `FakeItEasy`, `FluentAssertions`, `Shouldly`, `AutoFixture*`, `Bogus`, `Verify.*`, `Testcontainers*`, `WireMock.Net`, `BenchmarkDotNet`, and analyzers — `StyleCop.Analyzers`, `SonarAnalyzer.CSharp`, `Roslynator.*`, `Meziantou.Analyzer`, `Microsoft.CodeAnalysis.*Analyzers`.

2. **Build tooling → 1 PR**:
   `Microsoft.SourceLink.*`, `MinVer`, `Nerdbank.GitVersioning`, `GitVersion.MsBuild`, `PolySharp`, other `PrivateAssets="all"` build-time packages, and MSBuild SDKs pinned in `global.json` `msbuild-sdks`.

3. **SDK and local tools → 1 PR**:
   `global.json` `sdk.version` → the newest SDK of the same major that passes the release-age gate, dated by `release-date` in `https://builds.dotnet.microsoft.com/dotnet/release-metadata/<major>.0/releases.json`; keep `rollForward`. A new major is breaking — stop and ask. Exact SDK pins in CI (`dotnet-version: 8.0.404`) move with `global.json`; floating ones (`8.0.x`) stay. Local tools in `.config/dotnet-tools.json` move with `dotnet tool update <id> --local --version <version>`.

4–6. **GitHub Actions, Docker build-time images, Dev Container images** *(router-owned)* — `chore/github-actions`, `chore/docker-build-images`, and `chore/devcontainer-images` per `repo-dependency-groups`, with the .NET row of its Image version agreement.

**Exclude from dev groups** — these travel with their runtime ecosystem: `Microsoft.AspNetCore.Mvc.Testing` and test-only `Microsoft.EntityFrameworkCore.*` providers (with the .NET platform group), `Grpc.Tools` (with gRPC).

### Runtime groups

1. **.NET platform packages → 1 PR**:
   `Microsoft.Extensions.*`, `Microsoft.AspNetCore.*`, `Microsoft.EntityFrameworkCore.*`, `Microsoft.Bcl.*`, and the `System.*` packages shipped with a .NET release (`System.Text.Json`, `System.Net.Http.Json`, …), plus EF Core providers that track the EF Core major (`Npgsql.EntityFrameworkCore.PostgreSQL`, `Pomelo.EntityFrameworkCore.MySql`). Move them to one release band together — all `10.0.x` or all `9.0.x` — because mixed bands cause `NU1605` downgrade errors and binding conflicts. A band newer than the target framework is fine when it restores for every framework (the 10.0 packages support `net8.0`). Packages from the dotnet/extensions repo (`Microsoft.Extensions.AI*`, `Microsoft.Extensions.Http.Resilience`, `Microsoft.Extensions.Diagnostics.Testing`) ship on their own cadence and are singletons.

2. **Backend ecosystems** — one PR per ecosystem:
   - OpenTelemetry → `OpenTelemetry`, `OpenTelemetry.*`
   - AWS SDK → `AWSSDK.Core` and every `AWSSDK.*` — they release in lockstep
   - Azure SDK → `Azure.Core`, `Azure.Identity`, and the `Azure.*` client libraries
   - gRPC / Protobuf → `Grpc.*`, `Google.Protobuf`, `Grpc.Tools`
   - Logging → `Serilog`, `Serilog.*`; or `NLog`, `NLog.*`
   - Resilience → `Polly`, `Polly.*`
   - Messaging → `MassTransit`, `MassTransit.*`; or `NServiceBus`, `NServiceBus.*`
   - Data → `Npgsql` (without EF), `Dapper`, `StackExchange.Redis`, `MongoDB.Driver` — individually
   - API docs → `Swashbuckle.AspNetCore*`; or `NSwag.*`
   - OpenFeature → `OpenFeature`, `OpenFeature.*`
   - Validation and mediation → `FluentValidation*`; `MediatR*` — individually

3. **Everything else → 1 PR per package**.

4–5. **Docker runtime images, Docker service images** *(router-owned)* — per `repo-dependency-groups`.

6. **AI models → 1 PR per provider** *(router-owned)* (only if the repo references AI model IDs):
   Every model ID the code, config, or env templates hand to an AI provider. Runs last so the provider SDKs (`Anthropic`, `OpenAI`, `Azure.AI.OpenAI`, `Microsoft.Extensions.AI*`, `Microsoft.SemanticKernel*`, `AWSSDK.BedrockRuntime`, `Google.Cloud.AIPlatform.V1`, and the like) are already at their targets. The provider is whoever serves the call — `anthropic`, `openai`, `azure`, `bedrock`, `vertex`.
   - Branch: `chore/ai-models-<provider>`; PR title e.g. `root - chore: upgrade Anthropic models`
   - Discovery, catalog lookup, and the per-provider approval are `ai-model-discovery`; scan `.cs`, `.fs`, `.vb`, `appsettings*.json`, and `launchSettings.json` in addition to the files it lists

## Workflow

The loop — sync `main`, resolve branch capability, pick one item, open the PR, drive CI to green,
check for already-merged, stop and wait for `continue` — is `shipping-conventions`. Run it with the
**item taxonomy** and **branch naming** below (`chore/<group-key>`, `chore/agentic-sync`). Its first
step syncs `main` and stops on a dirty working tree — the numbered steps here are additions *inside*
that loop, not a replacement for it. When syncing, confirm `dotnet --version` is the SDK `global.json`
selects.

1. **Start test services if `local`**, using the project's documented command. On a container conflict, remove only the conflicting test-service container and retry — never unrelated containers.

2. **Check `jaredwray/agentic` for updates** *(router-owned)*. Run `agentic-upstream-sync`. If it changes any file, open that PR — branch `chore/agentic-sync`, title e.g. `root - chore: sync defense-in-depth files from agentic` — and hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait. A catalog behind upstream is reported; then continue.

3. **Determine the active phase.** Run `dotnet restore` first — with `--locked-mode` when lock files exist; a failure there means `main` is already stale, so stop and report.
   - If any dev group has a package behind its target, or a router-owned dev group in `repo-dependency-groups` is outdated, the phase is **dev**.
   - Otherwise, if any runtime group has a package behind its target, an image is outdated, or an AI model reference is behind its provider's latest per `ai-model-discovery` (a declined bump is a deferral), the phase is **runtime**.
   - Otherwise the workflow is **done** — report the merged PRs, every deferral (versions blocked by the target framework rule, declined model bumps), and any target framework past end of support, one line each, then stop.

4. **Pick the next group** — the highest-priority group in the active phase with remaining work.

5. **Apply the upgrade.** Branch `chore/<group-key>` — e.g. `chore/test-tooling`, `chore/build-tooling`, `chore/dotnet-sdk`, `chore/dotnet-platform`, `chore/opentelemetry`, `chore/aws-sdk`, `chore/<package-id-lowercase>` for singletons.
   - Bump each package with `dotnet package update <id>@<version> --project <solution>`, which updates every project that references it — or `Directory.Packages.props` under Central Package Management — and refreshes `packages.lock.json`. `<version>` is the target from [Version targeting](#version-targeting). **Never** run `dotnet package update` without an explicit `@<version>` or with `--vulnerable`: both take the feed's newest release and bypass the release-age gate.
   - Verify with what CI runs, at minimum `dotnet restore` (`--locked-mode` with lock files), `dotnet build --no-restore -c Release`, and `dotnet test --no-build -c Release`, plus `dotnet format --verify-no-changes` when CI runs it. A new `NU1605` or `NU1608` warning means mixed versions inside a group — fix it in this PR.
   - For an image group, follow `repo-dependency-groups`. For the AI models group, run `ai-model-discovery` first and take only the one provider's approved bumps; replace every approved reference, make the request-shape changes the provider's migration guide requires, and verify as above. If the tests call the provider live and no credentials are available, say so in the PR body. The PR body lists each `current → target` with the provider's catalog link, and any out-of-repo values the user must change by hand.
   - Open the PR **ready for review** — title and body per [Pull request rules](#pull-request-rules).

   Then hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait. Report what is left in the active phase and whether the runtime phase still has work.

## Pull request rules

Loop invariants are `shipping-conventions`; review replies are `pr-conventions`.

### Version targeting

**The target is the newest stable version that passes the release-age gate and restores for every
target framework.** Date candidates with NuGet publish times per `repo-dependency-groups` → Release-age
gate (NuGet row), newest first, never past `latestVersion`. Skip pre-release versions and unlisted
ones. A package from a private feed in `nuget.config` uses that feed's registration under the same
rule; a feed with no publish time leaves the package ineligible — report it.

**For the SDK**, the target is the newest same-major SDK that passes the gate, per the SDK and local
tools group. **For image groups**, it is the newest digest in lineage at least 7 days old, per
`repo-dependency-groups`. **For AI model groups**, it is the provider's newest generally-available model
in the same tier, per `ai-model-discovery`; it becomes a bump only once the user approves it.

### Title prefixes

Per `pr-conventions` → Prefix scheme for the automated ops loops. Examples:

- `root - chore: upgrade test and code quality dependencies`
- `Contoso.Api - chore: upgrade .NET platform packages`
- `root - chore: upgrade the .NET SDK`
- `root - chore: upgrade OpenTelemetry packages`
- `root - chore: upgrade Anthropic models`
- `root - chore: sync defense-in-depth files from agentic`
