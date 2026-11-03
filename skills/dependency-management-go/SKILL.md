---
name: dependency-management-go
description: Upgrade a Go module's dependencies one grouped PR at a time — the toolchain directive, test and lint dependencies, code-generation tools, GitHub Actions, Docker and Dev Container images, then runtime module ecosystems with golang.org/x and lockstep SDKs moving together, and last the AI model IDs the code calls (recommend the provider's latest, bump on approval). Applies a 7-day release-age gate from module proxy timestamps, never raises the go directive silently, and reports new major versions instead of rewriting import paths. Every resume also checks jaredwray/agentic for defense-in-depth and AGENTS.md updates. Use when asked to update, upgrade, or bump Go modules or AI models on a Go project. Manual and resumable; dev phase before runtime phase.
disable-model-invocation: true
user-invocable: true
---

# Dependency Management (Go)

Workflow for upgrading Go **dev** dependencies (tests, linters, generators, CI tooling) and **runtime**
dependencies, one pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow), which runs the `shipping-conventions` loop from its first step. Only stop to ask the user when that loop or this document says to stop and report (e.g. uncommitted changes, raising the `go` directive) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next dep PR`, or similar. Never open a second dep-management PR while one is already in flight. Every PR is ready for review, never a draft.
>
> **Dev phase before runtime phase.** Finish every dev group before starting any runtime group — tooling churn is lower risk than runtime changes.
>
> **Delegated mode.** When the `dependency-management` router hands this skill one package root, follow its delegation contract: work only in that root, run only the phase it names, and skip every step marked *(router-owned)*.
>
> This skill follows the shared `shipping-conventions` loop; PR titles, bodies, and review replies follow `pr-conventions`. Release-age gating, the GitHub Actions group, and every container image group are `repo-dependency-groups`.

## Repository type

- **Single module** — one `go.mod`.
- **Multi-module** — several `go.mod` files, possibly joined by a tracked `go.work`. A group spans every module that requires its members; run the commands in each module, then `go work sync` when `go.work` is tracked.

## Go version rule

- **The floor** is the `go` directive in `go.mod`: the oldest Go that can build the module, and for a
  library, the oldest Go its users may run. No upgrade may raise it. Read a candidate's minimum from
  `go list -m -json <module>@<version>` (`GoVersion`); one above the floor is a deferral, and the target
  is the newest gated version at or below it (`open-feature/go-sdk v1.17.0 needs go 1.24.0; floor 1.21
  — deferred`). Since Go 1.21, `go get` raises the `go` line on its own to satisfy a dependency, so
  check `git diff go.mod` after every bump and step back to an older version if the line moved. Raising
  the floor is the user's call. Go supports its two newest releases
  ([release history](https://go.dev/doc/devel/release)); say in the done report when the floor is older.
- **The toolchain** is the `toolchain` directive, the Go that builds the module locally and in CI. With
  the default `GOTOOLCHAIN=auto`, a local `go` older than it downloads it.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Start test services with the project's documented command, if it has one.
- **`sandbox`** — anything else. Resolve branch capability before starting, per `shipping-conventions` → Branch-constrained environments.

## Phases

Run the two phases in order. Do not interleave.

1. **Dev phase** — the toolchain directive, test and lint dependencies, code-generation tools, GitHub Actions, Docker build-time images, and Dev Container images.
2. **Runtime phase** — runtime modules by ecosystem, then Docker runtime and service images, then the AI model IDs the code calls. Begin only after every dev group is merged or documented as a deferral.

## Standard groups

Each group is **one branch and one PR**. Surface direct dependencies with updates, in each module:

```bash
go list -u -m -f '{{if and (not .Main) (not .Indirect) .Update}}{{.Path}} {{.Version}} {{.Update.Version}}{{end}}' all
```

`Update` is the newest release, or the newest pseudo-version for an untagged module — not age-gated
and not checked against the floor, so it is a candidate, never the target; see
[Version targeting](#version-targeting).

`go.mod` has one `require` list, so classify by role:

- **Tool** — a `tool` directive (Go 1.24+), a module imported only by a `//go:build tools` file, or a `go install` / `go run <module>@<version>` pin in a Makefile, script, or workflow; also the `version` input of `golangci/golangci-lint-action`.
- **Test** — a module only `_test.go` files import.
- **Runtime** — everything else.

### Dev groups

1. **Toolchain → 1 PR** (only if `go.mod` or `go.work` has a `toolchain` directive):
   Move it to the newest patch of its Go minor that passes the release-age gate, dated by `go list -m -json golang.org/toolchain@v0.0.1-go<version>.linux-amd64` (`Time`), with `go get toolchain@go<version>`. CI `go-version` pins that state the same exact patch move with it; floating ones (`1.22`, `1.22.x`) and ones that match the floor stay. A new minor is breaking — stop and ask. Never add a `toolchain` directive.

2. **Test and code quality → 1 PR**:
   `github.com/stretchr/testify`, `github.com/google/go-cmp`, `go.uber.org/mock`, `github.com/golang/mock`, `github.com/onsi/ginkgo/v2`, `github.com/onsi/gomega`, `go.uber.org/goleak`, `gotest.tools/v3`, `github.com/DATA-DOG/go-sqlmock`, `github.com/jarcoal/httpmock`, `github.com/alicebob/miniredis/v2`, `github.com/testcontainers/testcontainers-go*`, any other test-only module, and lint tools — `golangci-lint`, `honnef.co/go/tools` (staticcheck), `mvdan.cc/gofumpt`, `golang.org/x/vuln` (govulncheck).

3. **Code generation and build tools → 1 PR**:
   Tool modules not in group 2 — `google.golang.org/protobuf/cmd/protoc-gen-go`, `google.golang.org/grpc/cmd/protoc-gen-go-grpc`, `github.com/sqlc-dev/sqlc`, `github.com/99designs/gqlgen`, `github.com/vektra/mockery`, `golang.org/x/tools/cmd/stringer`, `github.com/goreleaser/goreleaser`. When a generator moves, rerun `go generate ./...` (or the project's generate target) and commit the output.

4–6. **GitHub Actions, Docker build-time images, Dev Container images** *(router-owned)* — `chore/github-actions`, `chore/docker-build-images`, and `chore/devcontainer-images` per `repo-dependency-groups`, with the Go row of its Image version agreement.

**Exclude from dev groups** — a test module released with a runtime ecosystem travels with it (`sigs.k8s.io/controller-runtime/tools/setup-envtest` with Kubernetes).

### Runtime groups

1. **golang.org/x → 1 PR**: every `golang.org/x/*` module (`net`, `sys`, `crypto`, `text`, `sync`, `time`, `oauth2`, `mod`, `tools`, `term`, `exp`) — they depend on one another.

2. **Backend ecosystems** — one PR per ecosystem; members of a lockstep set never move alone:
   - gRPC / Protobuf → `google.golang.org/grpc`, `google.golang.org/protobuf`, `google.golang.org/genproto/*`, `github.com/grpc-ecosystem/*`
   - OpenTelemetry → `go.opentelemetry.io/otel*`, `go.opentelemetry.io/contrib/*`
   - AWS SDK v2 → `github.com/aws/aws-sdk-go-v2*`, `github.com/aws/smithy-go`
   - Google Cloud → `cloud.google.com/go/*`, `google.golang.org/api`
   - Kubernetes → `k8s.io/api`, `k8s.io/apimachinery`, `k8s.io/client-go` (one minor together), `sigs.k8s.io/controller-runtime`
   - HTTP frameworks → one PR each: `github.com/gin-gonic/gin` with `github.com/gin-contrib/*`; `github.com/labstack/echo/v4`; `github.com/go-chi/chi/v5`; `github.com/gofiber/fiber/*`
   - Databases → one PR each: `github.com/jackc/pgx/v5`; `gorm.io/gorm` with `gorm.io/driver/*`; `go.mongodb.org/mongo-driver*`; `github.com/redis/go-redis/v9`
   - CLI → `github.com/spf13/cobra`, `github.com/spf13/viper`, `github.com/spf13/pflag`
   - OpenFeature → `github.com/open-feature/go-sdk`, `github.com/open-feature/go-sdk-contrib/*`

3. **Everything else → 1 PR per module**.

4–5. **Docker runtime images, Docker service images** *(router-owned)* — per `repo-dependency-groups`.

6. **AI models → 1 PR per provider** *(router-owned)* (only if the repo references AI model IDs):
   Every model ID the code, config, or env templates hand to an AI provider. Runs last so the provider modules (`github.com/anthropics/anthropic-sdk-go`, `github.com/openai/openai-go`, `google.golang.org/genai`, `github.com/aws/aws-sdk-go-v2/service/bedrockruntime`, `github.com/sashabaranov/go-openai`, `github.com/tmc/langchaingo`, and the like) are already at their targets. The provider is whoever serves the call — `anthropic`, `openai`, `google`, `bedrock`, `vertex`.
   - Branch: `chore/ai-models-<provider>`; PR title e.g. `root - chore: upgrade Anthropic models`
   - Discovery, catalog lookup, and the per-provider approval are `ai-model-discovery`; scan `.go` source (tests and `testdata` included) in addition to the files it lists, and skip `go.sum`

## Workflow

The loop — sync `main`, resolve branch capability, pick one item, open the PR, drive CI to green,
check for already-merged, stop and wait for `continue` — is `shipping-conventions`. Run it with the
**item taxonomy** and **branch naming** below (`chore/<group-key>`, `chore/agentic-sync`). Its first
step syncs `main` and stops on a dirty working tree — the numbered steps here are additions *inside*
that loop, not a replacement for it.

1. **Start test services if `local`**, using the project's documented command. On a container conflict, remove only the conflicting test-service container and retry — never unrelated containers.

2. **Check `jaredwray/agentic` for updates** *(router-owned)*. Run `agentic-upstream-sync`. If it changes any file, open that PR — branch `chore/agentic-sync`, title e.g. `root - chore: sync defense-in-depth files from agentic` — and hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait. A catalog behind upstream is reported; then continue.

3. **Determine the active phase.**
   - If any dev group has a module behind its target, or a router-owned dev group in `repo-dependency-groups` is outdated, the phase is **dev**.
   - Otherwise, if any runtime group has a module behind its target, an image is outdated, or an AI model reference is behind its provider's latest per `ai-model-discovery` (a declined bump is a deferral), the phase is **runtime**.
   - Otherwise the workflow is **done** — report the merged PRs, every deferral (versions blocked by the floor, declined model bumps), each new major version available, and whether the floor is older than Go's two supported releases, one line each, then stop.

4. **Pick the next group** — the highest-priority group in the active phase with remaining work.

5. **Apply the upgrade.** Branch `chore/<group-key>` — e.g. `chore/go-toolchain`, `chore/code-quality`, `chore/codegen-tools`, `chore/golang-x`, `chore/grpc`, `chore/opentelemetry`, `chore/aws-sdk`, `chore/<last-path-element>` for singletons.
   - Bump each member with `go get <module>@<target>` in every module that requires it, then `go mod tidy`. Minimal version selection raises other requirements only to versions the target's `go.mod` names, which predate it, so a gated target keeps the whole graph gated. **Never** run `go get -u` (it also upgrades the module's own dependencies, ungated) or `go get <module>@latest`, and never edit `go.sum` by hand.
   - A tracked `vendor/modules.txt` means `go mod vendor` and commit the result. A `golangci-lint-action` `version` input or a Makefile `go install …@<version>` is edited in place.
   - Verify in each changed module, at minimum: `go build ./...`, `go vet ./...`, `go test ./...` (with the flags CI uses, such as `-race`), an empty `gofmt -l .`, no diff from `go mod tidy`, `go mod verify`, and `golangci-lint run` when the repo configures it.
   - For an image group, follow `repo-dependency-groups`. For the AI models group, run `ai-model-discovery` first and take only the one provider's approved bumps; replace every approved reference, make the request-shape changes the provider's migration guide requires, and verify as above. If the tests call the provider live and no credentials are available, say so in the PR body. The PR body lists each `current → target` with the provider's catalog link, and any out-of-repo values the user must change by hand.
   - Open the PR **ready for review** — title and body per [Pull request rules](#pull-request-rules).

   Then hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait. Report what is left in the active phase and whether the runtime phase still has work.

## Pull request rules

Loop invariants are `shipping-conventions`; review replies are `pr-conventions`.

### Version targeting

**The target is the newest release in the same major that passes the release-age gate and whose
`GoVersion` is at or below the floor.** List versions with `go list -m -versions <module>` (it omits
retracted versions) and date each with `go list -m -json <module>@<version>` per
`repo-dependency-groups` → Release-age gate (Go row), newest first. Skip pre-releases unless the
module has only pre-releases. Leave `+incompatible` versions where they are.

**An untagged module** (pseudo-versions, like `golang.org/x/exp`): the target is the newest commit on
its default branch at least 7 days old. Take the repository from `Origin.URL` in
`curl -s https://proxy.golang.org/<module>/@latest` (an uppercase letter in the path is written as `!`
plus its lowercase; a private module's repository is its path), find the commit in a blobless clone
with `git log --first-parent -1 --before='7 days ago' --format=%H`, and use `go get <module>@<commit>`.
If that commit's `GoVersion` exceeds the floor, the module is a deferral — do not walk older commits.

**A new major version** is a different module path (`/v2`, `/v3`), so `go list -u` never shows it.
For each direct dependency, check `go list -m -versions <path>/v<N+1>` (an error means no such
module); a gated release there is reported in the done report, never applied — moving rewrites import paths, so it needs the user's
approval and its own `(breaking)` PR.

**For image groups**, the target is the newest digest in lineage at least 7 days old, per
`repo-dependency-groups`. **For AI model groups**, it is the provider's newest generally-available model
in the same tier, per `ai-model-discovery`; it becomes a bump only once the user approves it.

### Title prefixes

Per `pr-conventions` → Prefix scheme for the automated ops loops. The package name is the last element
of the module path. Examples:

- `root - chore: upgrade the Go toolchain`
- `root - chore: upgrade test and code quality dependencies`
- `api - chore: upgrade golang.org/x modules`
- `root - chore: upgrade OpenTelemetry modules`
- `root - chore: upgrade Anthropic models`
- `root - chore: sync defense-in-depth files from agentic`
