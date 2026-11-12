# Python

Rules for a Python package root: the directory that holds `uv.lock`, `poetry.lock`, or the
requirements files. The registry is PyPI.

## Package manager

Identify the manager from the root's tracked files, first match wins:

| Manager | Marker |
|---|---|
| uv | `uv.lock` |
| Poetry | `poetry.lock` |
| pip-tools | `requirements*.in` with a compiled `requirements*.txt` (its header names `pip-compile` or `uv pip compile`) |

- **Plain pip** (`requirements*.txt` with no compiler header) — unsupported. Hash-checked installs
  need a compiled file that lists every transitive dependency, and moving the root to pip-tools or
  uv is the user's call: report the root and add no Python block for it.
- **Anything else** (`pdm.lock`, `Pipfile`, conda `environment.yml`) — no rules here; report it.

## Catalog

The § 3 block is the one for the root's manager:

```md
### Python (uv)
- [ ] `uv.lock` committed; CI installs with `uv sync --locked`
- [ ] 7-day cooldown: `[tool.uv] exclude-newer = "7 days"` with `required-version` at 0.11.8 or newer; no first-party `exclude-newer-package`
- [ ] Source builds refused: `[tool.uv] no-build = true`
```

```md
### Python (Poetry)
- [ ] `poetry.lock` committed; CI runs `poetry check --lock`, then installs with `poetry sync`
- [ ] 7-day cooldown: `poetry.toml` sets `solver.min-release-age` to 7 with `requires-poetry` at 2.4 or newer; no first-party `solver.min-release-age-exclude`
- [ ] Source builds refused: `poetry.toml` sets `installer.only-binary` to `:all:`
```

```md
### Python (pip-tools)
- [ ] Every compiled requirements file carries hashes (`--generate-hashes`); CI installs with `pip install --require-hashes --only-binary :all: -r <file>`
```

The § 5 block, only when the root publishes to PyPI:

```md
### PyPI
- [ ] Trusted publisher on PyPI names this repository, `release.yaml`, and the `release` environment (manual)
- [ ] `.github/workflows/release.yaml` builds in one job and publishes from a `release`-environment job with `pypa/gh-action-pypi-publish` (OIDC, attestations on)
- [ ] No PyPI API tokens: every project-scoped and account-scoped token removed (manual)
```

## Dependency policy

Policy lives in tracked files (`pyproject.toml`, `poetry.toml`), not in a developer's user config.

**uv**

```toml
[tool.uv]
required-version = ">=0.11.8"
exclude-newer = "7 days"
no-build = true
```

- `exclude-newer` takes a relative span from uv 0.9.17, and `uv.lock` records the span instead of a
  timestamp from 0.11.8. An older uv writes a moving timestamp into the lock, and `uv sync --locked`
  then fails for everyone else — so `required-version` goes in with the span. Keep an existing
  `required-version` when it already excludes every uv older than 0.11.8; otherwise raise its lower
  bound.
- After setting it, run `uv lock`. A locked version younger than 7 days steps back to its newest
  gated release; list each one in the PR body. A fixed date in `exclude-newer` is a hard cap, not a
  cooldown: replace it with the span only with the user's approval.
- No first-party excludes. `exclude-newer-package` must not name a package this GitHub owner
  publishes, and never gains an entry to reach a younger version. Leave unrelated third-party
  entries as they are.
- `no-build = true` makes uv fail instead of building a source distribution, whose build backend is
  arbitrary code that runs at install. The project itself and workspace members still build. If a
  locked dependency has no wheel for a platform CI installs on, `uv sync` fails: report the package
  and ask. Do not turn the setting off to get past it.
- `uv.lock` records a hash for every wheel and source distribution; `uv sync --locked` fails when
  the lock is missing or out of date. Never use `--frozen` in CI: it skips that check.

**Poetry**

```bash
poetry config --local solver.min-release-age 7
poetry config --local installer.only-binary :all:
```

- Both commands write `poetry.toml` in the root; commit it. Never hand-write the file.
- `solver.min-release-age` is in days and needs Poetry 2.4. Set `requires-poetry = ">=2.4"` under
  `[tool.poetry]` (keep a bound that is already 2.4 or newer), and move the Poetry version CI pins
  to match in the same PR.
- No first-party excludes: `solver.min-release-age-exclude` and
  `solver.min-release-age-exclude-source` gain no entry to reach a younger version.
- `installer.only-binary` affects installs, not locking. A dependency with no wheel fails
  `poetry sync`: report the package and ask.
- `poetry check --lock` fails when `poetry.lock` does not match `pyproject.toml`; `poetry sync`
  installs exactly the lock. `poetry install --sync` is deprecated.

**pip-tools**

- Add `--generate-hashes` to the compile command the file's header records, and recompile without
  `--upgrade` so no version moves. `pip install --require-hashes` then rejects any file whose hash
  is not in the requirements file, and `--only-binary :all:` refuses source builds.
- pip has no repo-level cooldown setting. Version age is enforced where versions move:
  `dependency-management` dates every version it adopts from PyPI.

## Install protection

- **CI — Socket Firewall.** It wraps `pip` and `uv`, not `poetry`. Prefix every `pip` and `uv`
  command that can download: `sfw uv sync --locked`, `sfw uv build`, `sfw uv tool install …`,
  `sfw pip install --require-hashes --only-binary :all: -r requirements.txt`, and the
  `sfw pip install 'poetry==<version>'` that installs Poetry itself. `poetry sync` runs unprefixed;
  the lock's hashes, the solver cooldown, and `installer.only-binary` protect it.
- **Cloud environments — Safe Chain.** The bootstrap shims `pip`, `pip3`, `pipx`, `uv`, `uvx`,
  `poetry`, `pdm`, `python`, and `python3`, then installs every `uv.lock` root with
  `uv sync --locked` and every `poetry.lock` root with `poetry sync`. When `uv` or `poetry` is not
  on `PATH` and `pipx` is, the bootstrap installs it with `pipx` through the shim. A pip-tools root
  gets the shims and no install: create its virtual environment and install through the `pip` shim.
- **Dev Container image** for a new `devcontainer.json`: `mcr.microsoft.com/devcontainers/python`.
  The lineage is the Python minor plus OS family (for example `3.13-bookworm`).

## CI

- Set up with `astral-sh/setup-uv` (uv) or `actions/setup-python`. `setup-uv` has no floating major
  tag past `v7`; pin it by SHA like every other action.
- **Publishing workflows restore no cache.** Set `enable-cache: false` on `astral-sh/setup-uv` (its
  default is on for most events on GitHub-hosted runners) and leave `cache` unset on
  `actions/setup-python` (off by default).

## Publishing

A root publishes when a workflow or script uploads it to PyPI (`pypa/gh-action-pypi-publish`,
`twine upload`, `uv publish`, `poetry publish`), or the user says it does.

PyPI publishes an upload at once and has no staging step, so the human gate is the reviewer-gated
`release` environment in [reference.md § 5](../reference.md#5-publishing):

1. **Trusted publishing** — the publish job exchanges a GitHub OIDC token for a short-lived PyPI
   token. The trusted publisher names the repository, the workflow filename, and the `release`
   environment, so PyPI rejects a token from any other job. The action uploads PEP 740
   attestations by default.
2. **Build and publish are separate jobs** — the build job installs dependencies and runs their
   code with no `id-token`. The publish job downloads the built files, installs nothing, and is the
   only job that can mint a PyPI token.
3. **No API tokens** — PyPI has no setting that turns token uploads off, so the control is that no
   token exists: remove every token under the account and the project.

PyPI setup (manual, per project): *Publishing → Add a new publisher → GitHub* with the repository
owner, the repository name, workflow filename `release.yaml`, and environment `release`. A project
that does not exist yet takes a *pending* publisher under the account's Publishing settings; it does
not reserve the name. Then delete every API token under *Account settings → API tokens*. Published
files are permanent: a filename can never be reused, and a bad release is yanked, not replaced.

### Release jobs

File PR (`chore/defense-python-trusted-publishing`). Add these jobs to the release workflow in
[reference.md § 5](../reference.md#5-publishing). They are written for uv; adapt the test command.
For Poetry, replace the uv steps with `actions/setup-python`, `sfw pip install 'poetry==<version>'`,
`poetry check --lock`, `poetry sync`, the tests, and `poetry build`. If the repo already has a
publish workflow, keep its pipeline and move it to this shape: OIDC instead of a token, and the
upload in its own `release`-environment job.

```yaml
  build-pypi:
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
      - name: Set up uv
        uses: astral-sh/setup-uv@68559e99cc807c1eb7e9238fd43a15bba460eec2 # v10.3.3
        with:
          enable-cache: false

      - name: Install Dependencies
        run: sfw uv sync --locked

      - name: Testing
        run: uv run --no-sync pytest

      - name: Build
        run: sfw uv build

      - name: Upload distributions
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: python-distributions
          path: dist/
          if-no-files-found: error

  publish-pypi:
    needs: [build-pypi]
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
      - name: Download distributions
        uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
        with:
          name: python-distributions
          path: dist/

      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@7245906fb61fa33a13554f9d5fb856fe61758086 # v1.14.3
```

## Verify

The root's frozen install, then what CI runs: `uv sync --locked` (or `poetry check --lock` and
`poetry sync`, or `pip install --require-hashes --only-binary :all: -r <file>` in a fresh virtual
environment), the tests, and the package build (`uv build`, `poetry build`) when the root publishes.
Prefix the `uv` and `pip` commands with `sfw` once Socket Firewall is on the machine.

## References

- uv dependency cooldowns: https://docs.astral.sh/uv/concepts/resolution/#dependency-cooldowns
- uv settings (`no-build`, `required-version`): https://docs.astral.sh/uv/reference/settings/
- uv sync and the lockfile: https://docs.astral.sh/uv/concepts/projects/sync/
- Poetry configuration (`solver.min-release-age`, `installer.only-binary`): https://python-poetry.org/docs/configuration/
- pip secure installs (hash-checking mode): https://pip.pypa.io/en/stable/topics/secure-installs/
- PyPI trusted publishers: https://docs.pypi.org/trusted-publishers/
- PyPI trusted publishing security model: https://docs.pypi.org/trusted-publishers/security-model/
- PyPA publishing guide for GitHub Actions: https://packaging.python.org/en/latest/guides/publishing-package-distribution-releases-using-github-actions-ci-cd-workflows/
- pypa/gh-action-pypi-publish: https://github.com/pypa/gh-action-pypi-publish
- setup-uv caching: https://github.com/astral-sh/setup-uv/blob/main/docs/caching.md
