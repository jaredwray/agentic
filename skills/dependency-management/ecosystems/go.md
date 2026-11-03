# Go

Rules for a Go package root: one module (`go.mod`), or several joined by a tracked `go.work`. A group
spans every module that requires its members; run the commands in each module, then `go work sync`
when `go.work` is tracked.

## Package manager

The `go` command. Install the Go the `toolchain` directive names (or the `go` floor's, without one)
and run every `go` command with `GOTOOLCHAIN=local`, so a candidate that needs a newer Go fails
instead of silently downloading one.

## Runtime version

The **floor** is the `go` directive in `go.mod`: the oldest Go that can build the module, and for a
library, the oldest Go its users may run. No upgrade may raise it. Read a candidate's minimum from the
`go` line of `curl -s https://proxy.golang.org/<module>/@v/<version>.mod` (for a private module, of the
`GoMod` file `go mod download -json <module>@<version>` names) — `go list -m -json` omits `GoVersion`
when it is newer than the local Go, so never treat a missing `GoVersion` as no minimum. One above the
floor is a deferral (`open-feature/go-sdk v1.17.0 needs go 1.24.0; floor 1.21 — deferred`). Since Go
1.21, `go get` raises the `go` line on its own to satisfy a dependency, so check `git diff go.mod`
after every bump and step back to an older version if the line moved. Raising the floor is the user's
call. Go supports its two newest releases ([release history](https://go.dev/doc/devel/release)); say
in the done report when the floor is older.

The **toolchain** is the `toolchain` directive, the Go that builds the module locally and in CI.
`golang` images follow its minor (else the `go` directive's).

## Candidates

Direct dependencies with updates, in each module:

```bash
GOTOOLCHAIN=local go list -u -m -f '{{if and (not .Main) (not .Indirect) .Update}}{{.Path}} {{.Version}} {{.Update.Version}}{{end}}' all
```

`Update` is the newest release, or the newest pseudo-version for an untagged module — not age-gated
and not checked against the floor, so it is a candidate, never the target.

`go.mod` has one `require` list, so classify by role:

- **Tool** — a `tool` directive (Go 1.24+), a module imported only by a `//go:build tools` file, a `go install` / `go run <module>@<version>` pin in a Makefile, script, or workflow, or the `version` input of `golangci/golangci-lint-action`.
- **Test** — a module only `_test.go` files import.
- **Runtime** — everything else.

**Exclude from dev groups** a test module released with a runtime ecosystem
(`sigs.k8s.io/controller-runtime/tools/setup-envtest` with Kubernetes); it moves with that ecosystem.

## Dev groups

1. **Toolchain → 1 PR** (`chore/go-toolchain`; only if `go.mod` or `go.work` has a `toolchain` directive): move it to the newest patch of its Go minor that passes the release-age gate. List the patches with `go list -m -versions golang.org/toolchain` (entries `v0.0.1-go<version>.linux-amd64`) and date each with `go list -m -json golang.org/toolchain@v0.0.1-go<version>.linux-amd64` (`Time`). Write it with `go get toolchain@go<version>` in `go.mod`, or `go work edit -toolchain=go<version>` when the directive is in `go.work`. CI `go-version` pins that state the same exact patch move with it; floating ones (`1.22`, `1.22.x`) and ones that match the floor stay. A new minor is breaking — stop and ask. Never add a `toolchain` directive.
2. **Test and code quality → 1 PR** (`chore/code-quality`): `github.com/stretchr/testify`, `github.com/google/go-cmp`, `go.uber.org/mock`, `github.com/golang/mock`, `github.com/onsi/ginkgo/v2`, `github.com/onsi/gomega`, `go.uber.org/goleak`, `gotest.tools/v3`, `github.com/DATA-DOG/go-sqlmock`, `github.com/jarcoal/httpmock`, `github.com/alicebob/miniredis/v2`, `github.com/testcontainers/testcontainers-go*`, any other test-only module, and lint tools — `golangci-lint`, `honnef.co/go/tools` (staticcheck), `mvdan.cc/gofumpt`, `golang.org/x/vuln` (govulncheck).
3. **Code generation and build tools → 1 PR** (`chore/codegen-tools`): tool modules not in group 2 — `google.golang.org/protobuf/cmd/protoc-gen-go`, `google.golang.org/grpc/cmd/protoc-gen-go-grpc`, `github.com/sqlc-dev/sqlc`, `github.com/99designs/gqlgen`, `github.com/vektra/mockery`, `golang.org/x/tools/cmd/stringer`, `github.com/goreleaser/goreleaser`. When a generator moves, rerun `go generate ./...` (or the project's generate target) and commit the output.

## Runtime groups

1. **golang.org/x → 1 PR** (`chore/golang-x`): every `golang.org/x/*` module (`net`, `sys`, `crypto`, `text`, `sync`, `time`, `oauth2`, `mod`, `tools`, `term`, `exp`) — they depend on one another.
2. **Backend ecosystems → 1 PR each**; members of a lockstep set never move alone:
   - gRPC / Protobuf: `google.golang.org/grpc`, `google.golang.org/protobuf`, `google.golang.org/genproto/*`, `github.com/grpc-ecosystem/*`
   - OpenTelemetry: `go.opentelemetry.io/otel*`, `go.opentelemetry.io/contrib/*`
   - AWS SDK v2: `github.com/aws/aws-sdk-go-v2*`, `github.com/aws/smithy-go`
   - Google Cloud: `cloud.google.com/go/*`, `google.golang.org/api`
   - Kubernetes: `k8s.io/api`, `k8s.io/apimachinery`, `k8s.io/client-go` (one minor together), `sigs.k8s.io/controller-runtime`
   - HTTP frameworks, one PR each: `github.com/gin-gonic/gin` with `github.com/gin-contrib/*`; `github.com/labstack/echo/v4`; `github.com/go-chi/chi/v5`; `github.com/gofiber/fiber/*`
   - Databases, one PR each: `github.com/jackc/pgx/v5`; `gorm.io/gorm` with `gorm.io/driver/*`; `go.mongodb.org/mongo-driver*`; `github.com/redis/go-redis/v9`
   - CLI: `github.com/spf13/cobra`, `github.com/spf13/viper`, `github.com/spf13/pflag`
3. **Everything else → 1 PR per module** (`chore/<last-path-element>`).

## Apply and verify

- Bump each member with `go get <module>@<target>` in every module that requires it, then `go mod tidy`. Minimal version selection raises other requirements only to versions the target's `go.mod` names, which predate it, so a gated target keeps the whole graph gated. **Never** run `go get -u` (it also upgrades the module's own dependencies, ungated) or `go get <module>@latest`, and never edit `go.sum` by hand.
- A tracked `vendor/modules.txt` means `go mod vendor` and commit the result. A `golangci-lint-action` `version` input or a Makefile `go install …@<version>` is edited in place.
- Verify in each changed module, at minimum: `go build ./...`, `go vet ./...`, `go test ./...` (with the flags CI uses, such as `-race`), an empty `gofmt -l .`, no diff from `go mod tidy`, `go mod verify`, and `golangci-lint run` when the repo configures it.

## Version targeting

The target is the newest release in the same major that passes the release-age gate (the Go row in
`SKILL.md`) and whose minimum Go is at or below the floor. List versions with
`go list -m -versions <module>` (it omits retracted versions), newest first. Skip pre-releases unless
the module has only pre-releases. Leave `+incompatible` versions where they are.

**An untagged module** (pseudo-versions, like `golang.org/x/exp`): the target is the newest commit on
its default branch at least 7 days old. Take the repository from `Origin.URL` in
`curl -s https://proxy.golang.org/<module>/@latest` (an uppercase letter in the path is written as `!`
plus its lowercase; a private module's repository is its path), find the commit in a blobless clone
with `git log --first-parent -1 --before='7 days ago' --format=%H`, and use `go get <module>@<commit>`.
If that commit needs a newer Go than the floor, the module is a deferral — do not walk older commits.

**A new major version** is a different module path, so `go list -u` never shows it. For each direct
dependency, check the next major's path with `go list -m -versions`: replace an existing `/vN` suffix
with `/v<N+1>` (`github.com/redis/go-redis/v9` → `…/go-redis/v10`), add `/v2` to an unsuffixed v0 or
v1 path, and for `gopkg.in` bump the `.vN` suffix (`gopkg.in/yaml.v3` → `gopkg.in/yaml.v4`). An error
means no such module. A gated release there goes in the done report, never applied — moving rewrites
import paths, so it needs the user's approval and its own `(breaking)` PR.

## Titles

The package name is the last element of the module path. E.g. `root - chore: upgrade the Go
toolchain`, `api - chore: upgrade golang.org/x modules`, `root - chore: upgrade OpenTelemetry modules`.

## AI models

Scan `.go` source, tests and `testdata` included; skip `go.sum`. Provider modules:
`github.com/anthropics/anthropic-sdk-go`, `github.com/openai/openai-go`, `google.golang.org/genai`,
`github.com/aws/aws-sdk-go-v2/service/bedrockruntime`, `github.com/sashabaranov/go-openai`,
`github.com/tmc/langchaingo`.
