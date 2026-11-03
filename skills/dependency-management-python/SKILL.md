---
name: dependency-management-python
description: Upgrade a Python project's dependencies one grouped PR at a time for uv, Poetry, pip-tools, or pinned requirements files — the package-manager pin first, then test, lint, and build tooling, GitHub Actions, Docker and Dev Container images, then runtime ecosystems, and last the AI model IDs the code calls (recommend the provider's latest, bump on approval). Applies a 7-day release-age gate (Poetry's solver gate or PyPI upload times), never raises the project's minimum Python, and never hand-edits a lockfile. Every resume also checks jaredwray/agentic for defense-in-depth and AGENTS.md updates. Use when asked to update, upgrade, or bump Python dependencies or AI models on a Python project. Manual and resumable; dev phase before runtime phase.
disable-model-invocation: true
user-invocable: true
---

# Dependency Management (Python)

Workflow for upgrading Python **dev** dependencies (with CI tooling) and **runtime** dependencies, one
pull request at a time.

> **When this document is loaded, begin executing immediately.** Do not ask the user what to do — start with [Workflow](#workflow), which runs the `shipping-conventions` loop from its first step. Only stop to ask the user when that loop or this document says to stop and report (e.g. uncommitted changes, an unsupported package manager) or when a decision genuinely requires their input.
>
> **One PR at a time.** Open a PR, drive its CI to green, then stop and wait. Resume only when the user says `continue`, `next`, `next dep PR`, or similar. Never open a second dep-management PR while one is already in flight. Every PR is ready for review, never a draft.
>
> **Dev phase before runtime phase.** Finish every dev group before starting any runtime group — tooling churn is lower risk than runtime changes.
>
> **Delegated mode.** When the `dependency-management` router hands this skill one package root, follow its delegation contract: work only in that root, run only the phase it names, and skip every step marked *(router-owned)*.
>
> This skill follows the shared `shipping-conventions` loop; PR titles, bodies, and review replies follow `pr-conventions`. Release-age gating, the GitHub Actions group, and every container image group are `repo-dependency-groups`.

## Package manager

Identify the manager from the root's tracked files, first match wins:

| Manager | Marker | Lock |
|---|---|---|
| uv | `uv.lock` | `uv.lock` |
| Poetry | `poetry.lock` | `poetry.lock` |
| pip-tools | `requirements*.in` with a compiled `requirements*.txt` (its header names `pip-compile` or `uv pip compile`) | the compiled `.txt` files |
| pip | `requirements*.txt` alone, pinned with `==` | none |

Anything else — PDM (`pdm.lock`), Pipenv (`Pipfile.lock`), conda, or a `pyproject.toml` with no lock
and no requirements file — **stop and report**.

Which version of the manager to run:

- **uv** — the version the repo pins (`[tool.uv] required-version`, the `version` input of
  `astral-sh/setup-uv`); with no pin, a current uv.
- **Poetry** — Poetry 2.4 or newer, with `POETRY_SOLVER_MIN_RELEASE_AGE=7` on every command, so the
  solver gates direct and transitive dependencies alike. Use the repo's pin (`requires-poetry`, CI
  `poetry-version`) when it is 2.4 or newer; otherwise run the Package manager group's target with
  `uvx --from 'poetry==<version>' poetry …`. That group ships first and brings the repo's pin up to
  match.
- **pip-tools** — the compiler the compiled file's header names, with the same flags it records.

## Python floor

The floor is the lowest Python the project supports: the lower bound of `[project] requires-python`,
Poetry's `python` dependency, or `python_requires` in `setup.cfg`; for a requirements-only project, the
lowest Python version CI runs.

No upgrade may require a newer Python than the floor. The uv and Poetry solvers enforce it ("requires
Python >=3.10, so it will not be installable for Python >=3.8,<3.10"); for pip-tools and pip, read
`requires-python` from PyPI. The target is the newest gated version whose `requires-python` admits the
floor, and a newer release it blocks is a deferral (`pytest 9.1.1 needs Python ≥ 3.10; floor 3.8`).
Never raise the floor in a dependency PR — for a published library it drops users — and say in the
done report when the floor is past end of life per
[endoflife.date/python](https://endoflife.date/python), with how many deferrals it blocks.

## Environment

- **`local`** — developer machine with a working `git` remote and Docker available. Start test services with the project's documented command, if it has one.
- **`sandbox`** — anything else. Resolve branch capability before starting, per `shipping-conventions` → Branch-constrained environments.

## Phases

Run the two phases in order. Do not interleave.

1. **Dev phase** — the package-manager pin, dev, test, and build dependencies, GitHub Actions, Docker build-time images, and Dev Container images.
2. **Runtime phase** — runtime dependencies by ecosystem, then Docker runtime and service images, then the AI model IDs the code calls. Begin only after every dev group is merged or documented as a deferral.

## Standard groups

Each group is **one branch and one PR**. Surface candidates — a listing's "latest" is never the target
by itself; see [Version targeting](#version-targeting):

- uv: `uv tree --outdated --depth 1 --all-groups --frozen` — the `(latest: …)` annotations ignore any release-age gate.
- Poetry: `POETRY_SOLVER_MIN_RELEASE_AGE=7 poetry show --outdated --top-level` — "Latest" is gated but ignores the Python floor.
- pip-tools and pip: each top-level requirement in the `.in` files or the pinned `.txt`, looked up on PyPI.

Classify each dependency:

- **Dev** — non-main Poetry groups (`[tool.poetry.group.<name>.dependencies]`), `[dependency-groups]`, uv `dev-dependencies`, `[project.optional-dependencies]` extras for development (`dev`, `test`, `lint`, `docs`, `typing`), `requirements-dev*.txt` / `-test` / `-lint` / `-docs` files, and `[build-system] requires`.
- **Runtime** — `[project] dependencies`, `[tool.poetry.dependencies]` (except `python`), other extras, and `requirements.txt`.

### Dev groups

1. **Package manager → 1 PR**:
   uv — `required-version` and the `version` input of `astral-sh/setup-uv`; Poetry — `requires-poetry`, CI `poetry-version`, and `pip install poetry==` pins; pip-tools — its `pip-tools` pin. The target is the newest release that passes the release-age gate (PyPI row). With the new version, run `uv lock --check` or `poetry check --lock`; regenerate the lock (`uv lock`, `poetry lock` — neither moves versions) only when that check fails. This group comes first because Poetry 2.4 brings the solver gate.

2. **Test and code quality → 1 PR**:
   `pytest`, `pytest-*`, `hypothesis`, `coverage`, `tox`, `nox`, `ruff`, `black`, `isort`, `flake8` and its plugins, `pylint`, `mypy`, `pyright`, `bandit`, `pre-commit`, `responses`, `requests-mock`, `freezegun`, `time-machine`, `factory-boy`, `faker`.
   - When a bumped tool is also a hook in `.pre-commit-config.yaml` (`ruff`, `black`, `isort`, `mypy`, `flake8`), move that hook's `rev` to the matching tag in the same PR.

3. **Build tooling → 1 PR**:
   `[build-system] requires` entries pinned with `==` or `~=` (`hatchling`, `setuptools`, `poetry-core`, `flit-core`, `maturin`, `scikit-build-core`, `setuptools-scm`, `hatch-vcs`), and dev pins of `build`, `twine`, `wheel`, `cython`.

4–6. **GitHub Actions, Docker build-time images, Dev Container images** *(router-owned)* — `chore/github-actions`, `chore/docker-build-images`, and `chore/devcontainer-images` per `repo-dependency-groups`, with the Python row of its Image version agreement.

**Exclude from dev groups** — type stubs and test plugins travel with the runtime package they serve: `types-<name>` and `<name>-stubs` move with `<name>`; `django-stubs` and `pytest-django` with Django; `boto3-stubs` and `types-boto3` with the AWS SDK group.

### Runtime groups

1. **Web frameworks → 1 PR each**: Django (`django`, `django-*`, `djangorestframework`); FastAPI (`fastapi`, `starlette`, `uvicorn`); Flask (`flask`, `werkzeug`, `jinja2`, `itsdangerous`, `flask-*`).

2. **Backend ecosystems** — one PR per ecosystem:
   - Pydantic → `pydantic`, `pydantic-core`, `pydantic-settings`
   - SQLAlchemy → `sqlalchemy`, `alembic`, `sqlmodel`; database drivers individually
   - Scientific stack → `numpy`, `pandas`, `scipy`, `scikit-learn`, `pyarrow` — they share a binary interface
   - AWS SDK → `boto3`, `botocore`, `s3transfer`, `aiobotocore` — they release in lockstep
   - Google Cloud → `google-cloud-*`, `google-api-core`, `google-auth`
   - gRPC / Protobuf → `grpcio`, `grpcio-*`, `protobuf`
   - Azure SDK → `azure-core`, `azure-identity`, and the `azure-*` client libraries
   - HTTP clients → `httpx` with `httpcore`; `aiohttp`; `requests` with `urllib3` — one PR each
   - Task queues → `celery`, `kombu`, `billiard`
   - OpenTelemetry → `opentelemetry-*`
   - OpenFeature → `openfeature-sdk`, `openfeature-provider-*`

3. **Everything else → 1 PR per package**.

4–5. **Docker runtime images, Docker service images** *(router-owned)* — per `repo-dependency-groups`.

6. **AI models → 1 PR per provider** *(router-owned)* (only if the repo references AI model IDs):
   Every model ID the code, config, or env templates hand to an AI provider. Runs last so the provider SDKs (`anthropic`, `openai`, `google-genai`, `boto3` for Bedrock, `litellm`, `langchain-*`, `llama-index-*`, and the like) are already at their targets. The provider is whoever serves the call — `anthropic`, `openai`, `google`, `bedrock`, `vertex`.
   - Branch: `chore/ai-models-<provider>`; PR title e.g. `root - chore: upgrade Anthropic models`
   - Discovery, catalog lookup, and the per-provider approval are `ai-model-discovery`; scan `.py`, `.ipynb`, and `.toml` / `.yaml` / `.ini` config in addition to the files it lists

## Workflow

The loop — sync `main`, resolve branch capability, pick one item, open the PR, drive CI to green,
check for already-merged, stop and wait for `continue` — is `shipping-conventions`. Run it with the
**item taxonomy** and **branch naming** below (`chore/<group-key>`, `chore/agentic-sync`). Its first
step syncs `main` and stops on a dirty working tree — the numbered steps here are additions *inside*
that loop, not a replacement for it.

1. **Start test services if `local`**, using the project's documented command. On a container conflict, remove only the conflicting test-service container and retry — never unrelated containers.

2. **Check `jaredwray/agentic` for updates** *(router-owned)*. Run `agentic-upstream-sync`. If it changes any file, open that PR — branch `chore/agentic-sync`, title e.g. `root - chore: sync defense-in-depth files from agentic` — and hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait. A catalog behind upstream is reported; then continue.

3. **Determine the active phase.**
   - If any dev group has a dependency behind its target, or a router-owned dev group in `repo-dependency-groups` is outdated, the phase is **dev**.
   - Otherwise, if any runtime group has a dependency behind its target, an image is outdated, or an AI model reference is behind its provider's latest per `ai-model-discovery` (a declined bump is a deferral), the phase is **runtime**.
   - Otherwise the workflow is **done** — report the merged PRs, every deferral (versions blocked by the Python floor, declined model bumps), and whether the floor is past end of life, one line each, then stop.

4. **Pick the next group** — the highest-priority group in the active phase with remaining work.

5. **Apply the upgrade.** Branch `chore/<group-key>` — e.g. `chore/package-manager`, `chore/code-quality`, `chore/build-tooling`, `chore/django`, `chore/aws-sdk`, `chore/<package>` for singletons. Rewrite each requirement to the target, keeping its operator (`^`, `~=`, `>=`, `==`); then lock:
   - **uv** — `uv add --frozen '<name><op><target>'` with the flag for the section it lives in (`--group <name>`, `--optional <extra>`, `--dev`), then `uv lock --upgrade-package '<name>==<target>'`.
   - **Poetry** — `POETRY_SOLVER_MIN_RELEASE_AGE=7 poetry add '<name>@<op><target>'`, with `--group <name>` for a non-main group.
   - **pip-tools** — raise the bound in the `.in` file if it pins one, then rerun the header's compile command with `--upgrade-package '<name>==<target>'`.
   - **pip** — edit the `==` line.
   - A requirements file exported from the lock (its header names `poetry export` or `uv export`) is regenerated with the same command after locking.
   - **Transitive check (uv, pip-tools).** Their resolution is not gated, so date every package the lock diff adds or moves against the release-age gate; re-lock any that fails to its gated version with another `--upgrade-package '<dep>==<version>'`. Skip this when `[tool.uv] exclude-newer` is configured.
   - **Never** run `uv lock --upgrade`, `poetry update` without package names, `pip-compile --upgrade`, or `pip install -U`; never hand-edit `uv.lock`, `poetry.lock`, or a compiled requirements file.
   - Verify with what CI runs: install from the lock (`uv sync --locked --all-groups`, `poetry install`, `pip install -r …`), then the tests, linters, type checks, and package build (`uv build`, `poetry build`). If CI tests the floor Python, run the tests on it too.
   - For an image group, follow `repo-dependency-groups`. For the AI models group, run `ai-model-discovery` first and take only the one provider's approved bumps; replace every approved reference, make the request-shape changes the provider's migration guide requires, and verify as above. If the tests call the provider live and no credentials are available, say so in the PR body. The PR body lists each `current → target` with the provider's catalog link, and any out-of-repo values the user must change by hand.
   - Open the PR **ready for review** — title and body per [Pull request rules](#pull-request-rules).

   Then hand back to `shipping-conventions`: drive CI green, check for already-merged, stop and wait. Report what is left in the active phase and whether the runtime phase still has work.

## Pull request rules

Loop invariants are `shipping-conventions`; review replies are `pr-conventions`.

### Version targeting

**The target is the newest final release that passes the release-age gate and whose
`requires-python` admits the floor.** Under Poetry 2.4+ with the gate on, its "Latest" already applies
the gate; otherwise date candidates with PyPI upload times per `repo-dependency-groups` → Release-age
gate (PyPI row), newest first. Final means no `a`, `b`, `rc`, or `.dev` segment; a post-release
(`.post1`) is final. Yanked releases are ineligible. Do not cross-reference GitHub releases or
changelogs to pick a different version. A package from a private index uses that index's upload times
under the same rule; an index without them leaves the package ineligible — report it.

**For image groups**, the target is the newest digest in lineage at least 7 days old, per
`repo-dependency-groups`. **For AI model groups**, it is the provider's newest generally-available model
in the same tier, per `ai-model-discovery`; it becomes a bump only once the user approves it.

### Title prefixes

Per `pr-conventions` → Prefix scheme for the automated ops loops. Examples:

- `root - chore: upgrade Poetry`
- `root - chore: upgrade test and code quality dependencies`
- `api - chore: upgrade Django dependencies`
- `root - chore: upgrade AWS SDK dependencies`
- `root - chore: upgrade Anthropic models`
- `root - chore: sync defense-in-depth files from agentic`
