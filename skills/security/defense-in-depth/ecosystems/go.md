# Go

Rules for a Go package root: one module (`go.mod`), or several joined by a tracked `go.work`. Go has
no package registry account: modules are fetched through the module proxy and verified against the
checksum database.

## Package manager

The `go` command.

## Catalog

The § 3 block:

```md
### Go
- [ ] `go.sum` committed for every module; no workflow or script builds with `-mod=mod`
- [ ] Checksum database and module proxy left on: no `GOSUMDB=off`, `GOINSECURE`, or `GOPROXY=direct` in workflows, scripts, or tracked env files; `GOPRIVATE` / `GONOSUMDB` name only first-party private module paths
- [ ] Every `go install` and `go run` of a remote module names an exact version, never `@latest`
```

A Go module adds no § 5 block; see [Publishing](#publishing).

## Dependency policy

Go's defaults are the policy. The items make sure nothing turns them off.

- **`go.sum` and read-only builds.** `go.sum` holds the hash of every module the build uses, and
  since Go 1.16 the default `-mod=readonly` makes `go build` and `go test` fail instead of changing
  `go.mod` or `go.sum`. `-mod=mod` (as a flag or in `GOFLAGS`) lets a build rewrite them: remove it
  from every workflow and script. Only `go get` and `go mod tidy`, run on purpose, change the files.
- **Checksum database.** With the default `GOSUMDB=sum.golang.org`, a module that is not yet in
  `go.sum` is checked against a public append-only log, so everyone gets the same bytes for a
  version. `GOSUMDB=off` accepts such a module unverified; `GONOSUMDB` and `GOPRIVATE` skip the log
  for matching paths; `GOINSECURE` allows plain-HTTP fetches; `GOPROXY=direct` fetches from the
  source host and bypasses the mirror. Remove each of these unless it names only first-party
  private module paths (`GOPRIVATE=github.com/<owner>/*`).
- **No cooldown setting.** The `go` command has none. Minimal version selection stands in for it:
  a build uses exactly the versions `go.mod` requires and never resolves to a newer release on its
  own. Version age is enforced where versions move — `dependency-management` dates every version
  it adopts from the module proxy.
- **No install scripts.** Fetching and building a module runs none of its code. Code runs only when
  someone invokes it: `go generate`, `go run`, `go tool`, and the tests. So every `go install
  <module>@<version>` and `go run <module>@<version>` in a workflow, Makefile, or script names an
  exact version; `@latest` adopts whatever was published a minute ago and runs it. A `tool`
  directive in `go.mod` (Go 1.24+) is already pinned by `go.mod` and `go.sum`.

## Install protection

- **CI — Socket Firewall.** The free firewall does not wrap `go`. `go mod download` and `go build`
  run unprefixed; `go.sum`, the checksum database, and read-only builds protect them. The Firewall
  step still goes on every job.
- **Cloud environments — Safe Chain.** Safe Chain has no `go` shim, so the cloud-bootstrap items do
  not apply to a Go root. The same defaults protect a cloud agent's builds.
- **Dev Container image** for a new `devcontainer.json`: `mcr.microsoft.com/devcontainers/go`.

## CI

- Set up with `actions/setup-go` (`go-version-file: go.mod`).
- **Publishing workflows restore no cache.** `actions/setup-go` caches the module and build caches
  by default: set `cache: false` in any workflow that creates a GitHub Release, builds release
  binaries, or holds `id-token: write`.

## Publishing

A Go module has no upload and no credential. A pushed version tag is the release: the module proxy
serves it and the checksum database records its hash at first fetch. So the publishing control is
§ 7's tag ruleset — only repository admins can create a tag — and the module adds no § 5 block.

- Never move or delete a version tag. Go tools compare a download with the first recorded copy and
  stop with a security error when they differ. Withdraw a bad version with a `retract` directive in
  `go.mod` and a new release.
- A workflow that builds release binaries (GoReleaser or `go build`) is an artifact-publishing
  workflow: § 4's rules apply to it — `contents: write` on the release job only, no cache, every
  action SHA-pinned.

## Verify

In each module: `go mod verify`, `go build ./...`, `go vet ./...`, and `go test ./...` with the flags
CI uses.

## References

- Go modules reference (environment variables, `-mod`, `retract`): https://go.dev/ref/mod
- How Go mitigates supply chain attacks: https://go.dev/blog/supply-chain
- Publishing a module: https://go.dev/doc/modules/publishing
- Module mirror and checksum database: https://proxy.golang.org/
- setup-go caching: https://github.com/actions/setup-go#caching-dependency-files-and-build-outputs
