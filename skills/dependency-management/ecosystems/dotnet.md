# .NET

Rules for a .NET package root: a solution (`.sln` or `.slnx`; run commands against the solution file)
or a single `*.csproj`, `*.fsproj`, or `*.vbproj`.

## Package manager

NuGet through the `dotnet` CLI. Bump a version where it is declared, never in a second place:

- **Central Package Management** — `Directory.Packages.props` with `ManagePackageVersionsCentrally`
  set to `true`. Versions are `<PackageVersion>` items there; projects may carry `VersionOverride`.
- Otherwise the `Version` on each `<PackageReference>`, which may live in `Directory.Build.props` /
  `.targets`. A version held in an MSBuild property (`Version="$(SerilogVersion)"`) is bumped at the
  property.
- **Lock files** — a `packages.lock.json` beside a project (`RestorePackagesWithLockFile`) is
  refreshed and committed with the bump; CI restoring with `--locked-mode` fails on a stale one.

Use the SDK `global.json` selects (`sdk.version` with its `rollForward`); without `global.json`, the
SDK CI installs. Install what is missing with `dotnet-install.sh` (`--version <sdk>` or
`--channel <major.minor>`), plus the runtime of every target framework the tests run on
(`--runtime dotnet --channel 8.0`) — a newer runtime alone cannot run a `net8.0` test host. A
`dotnet --version` that differs from what `global.json` selects is a stop-and-report. The commands
below are the .NET 10 SDK's `dotnet package` verbs; on an older SDK use
`dotnet list <solution> package --outdated` and `dotnet add <project> package <id> --version <v>` for
each referencing project.

## Runtime version

The `TargetFramework` / `TargetFrameworks` values are the floor. No upgrade may drop a framework the
project builds: restore fails with `NU1202` when a package version does not support one, and that
version is a deferral (`EF Core 10.0.1 needs net10.0; project targets net8.0 — deferred`). Changing a
target framework is never part of a dependency PR. Say in the done report when a target framework is
past end of support per [endoflife.date/dotnet](https://endoflife.date/dotnet).

`mcr.microsoft.com/dotnet/*` images follow the .NET major: `global.json` `sdk.version` for SDK images,
the highest target framework (`net8.0` → `8.0`) for runtime images. Moving to a new major moves
`global.json`, the target frameworks, and the images together, with the user's approval.

## Candidates

`dotnet package list --outdated --format json --project <solution>`. Its `latestVersion` is the newest
stable release on the feed — not age-gated and not checked against the target frameworks — so it is a
candidate, never the target.

Classify each package:

- **Dev** — referenced only by test projects (`IsTestProject` is true, or the project references `Microsoft.NET.Test.Sdk`), referenced with `PrivateAssets="all"` (analyzers, SourceLink, versioning), or a local tool in `.config/dotnet-tools.json`.
- **Runtime** — everything else, including a package the shipped projects and the tests both reference; it moves in every project at once.

**Exclude from dev groups** — these travel with their runtime ecosystem: `Microsoft.AspNetCore.Mvc.Testing`
and test-only `Microsoft.EntityFrameworkCore.*` providers (with the .NET platform group), `Grpc.Tools`
(with gRPC).

## Dev groups

1. **Test and code quality → 1 PR** (`chore/test-tooling`): `Microsoft.NET.Test.Sdk`, `xunit`, `xunit.*`, `xunit.v3*`, `NUnit`, `NUnit3TestAdapter`, `NUnit.Analyzers`, `MSTest.*`, `coverlet.*`, `Moq`, `NSubstitute`, `FakeItEasy`, `FluentAssertions`, `Shouldly`, `AutoFixture*`, `Bogus`, `Verify.*`, `Testcontainers*`, `WireMock.Net`, `BenchmarkDotNet`, and analyzers — `StyleCop.Analyzers`, `SonarAnalyzer.CSharp`, `Roslynator.*`, `Meziantou.Analyzer`, `Microsoft.CodeAnalysis.*Analyzers`.
2. **Build tooling → 1 PR** (`chore/build-tooling`): `Microsoft.SourceLink.*`, `MinVer`, `Nerdbank.GitVersioning`, `GitVersion.MsBuild`, `PolySharp`, other `PrivateAssets="all"` build-time packages, and MSBuild SDKs pinned in `global.json` `msbuild-sdks`.
3. **SDK and local tools → 1 PR** (`chore/dotnet-sdk`): `global.json` `sdk.version` → the newest SDK of the same major that passes the release-age gate, dated by `release-date` in `https://builds.dotnet.microsoft.com/dotnet/release-metadata/<major>.0/releases.json`; keep `rollForward`. A new major is breaking — stop and ask. Exact SDK pins in CI (`dotnet-version: 8.0.404`) move with `global.json`; floating ones (`8.0.x`) stay. Local tools in `.config/dotnet-tools.json` move with `dotnet tool update <id> --local --version <version>`.

## Runtime groups

1. **.NET platform packages → 1 PR** (`chore/dotnet-platform`): `Microsoft.Extensions.*`, `Microsoft.AspNetCore.*`, `Microsoft.EntityFrameworkCore.*`, `Microsoft.Bcl.*`, and the `System.*` packages shipped with a .NET release (`System.Text.Json`, `System.Net.Http.Json`, …), plus EF Core providers that track the EF Core major (`Npgsql.EntityFrameworkCore.PostgreSQL`, `Pomelo.EntityFrameworkCore.MySql`). Move them to one release band together — all `10.0.x` or all `9.0.x` — because mixed bands cause `NU1605` downgrade errors and binding conflicts. A band newer than the target framework is fine when it restores for every framework (the 10.0 packages support `net8.0`). Packages from the dotnet/extensions repo (`Microsoft.Extensions.AI*`, `Microsoft.Extensions.Http.Resilience`, `Microsoft.Extensions.Diagnostics.Testing`) ship on their own cadence and are singletons.
2. **Backend ecosystems → 1 PR each**:
   - OpenTelemetry: `OpenTelemetry`, `OpenTelemetry.*`
   - AWS SDK: `AWSSDK.Core` and every `AWSSDK.*` — they release in lockstep
   - Azure SDK: `Azure.Core`, `Azure.Identity`, and the `Azure.*` client libraries
   - gRPC / Protobuf: `Grpc.*`, `Google.Protobuf`, `Grpc.Tools`
   - Logging: `Serilog`, `Serilog.*`; or `NLog`, `NLog.*`
   - Resilience: `Polly`, `Polly.*`
   - Messaging: `MassTransit`, `MassTransit.*`; or `NServiceBus`, `NServiceBus.*`
   - API docs: `Swashbuckle.AspNetCore*`; or `NSwag.*`
   - Data clients individually: `Npgsql` (without EF), `Dapper`, `StackExchange.Redis`, `MongoDB.Driver`
3. **Everything else → 1 PR per package** (`chore/<package-id-lowercase>`).

## Apply and verify

- Run `dotnet restore` first — with `--locked-mode` when lock files exist; a failure there means `main` is already stale, so stop and report.
- Bump each package with `dotnet package update <id>@<version> --project <solution>`, which updates every project that references it — or `Directory.Packages.props` under Central Package Management — and refreshes `packages.lock.json`. **Never** run `dotnet package update` without an explicit `@<version>` or with `--vulnerable`: both take the feed's newest release and bypass the release-age gate.
- Verify with what CI runs, at minimum `dotnet restore` (`--locked-mode` with lock files), `dotnet build --no-restore -c Release`, and `dotnet test --no-build -c Release`, plus `dotnet format --verify-no-changes` when CI runs it. A new `NU1605` or `NU1608` warning means mixed versions inside a group — fix it in the same PR.

## Version targeting

The target is the newest stable version that passes the release-age gate (the NuGet row in `SKILL.md`)
and restores for every target framework — never past `latestVersion`, never a pre-release or unlisted
version. A package from a private feed in `nuget.config` uses that feed's registration under the same
rule; a feed with no publish time leaves the package ineligible.

## AI models

Scan `.cs`, `.fs`, `.vb`, `appsettings*.json`, and `launchSettings.json`. Provider SDKs: `Anthropic`,
`OpenAI`, `Azure.AI.OpenAI`, `Microsoft.Extensions.AI*`, `Microsoft.SemanticKernel*`,
`AWSSDK.BedrockRuntime`, `Google.Cloud.AIPlatform.V1`.

Titles, e.g. `root - chore: upgrade test and code quality dependencies`, `Contoso.Api - chore: upgrade
.NET platform packages`, `root - chore: upgrade the .NET SDK`.
