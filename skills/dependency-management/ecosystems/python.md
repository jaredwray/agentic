# Python

Rules for a Python package root.

## Package manager

Identify the manager from the root's tracked files, first match wins:

| Manager | Marker | Lock |
|---|---|---|
| uv | `uv.lock` | `uv.lock` |
| Poetry | `poetry.lock` | `poetry.lock` |
| pip-tools | `requirements*.in` with a compiled `requirements*.txt` (its header names `pip-compile` or `uv pip compile`) | the compiled `.txt` files |
| pip | `requirements*.txt` alone, pinned with `==` | none |

A requirements file with unpinned entries and no compiler header is a stop-and-report.

Which version of the manager to run:

- **uv** — the version the repo pins (`[tool.uv] required-version`, the `version` input of `astral-sh/setup-uv`); with no pin, a current uv.
- **Poetry** — Poetry 2.4 or newer, with `POETRY_SOLVER_MIN_RELEASE_AGE=7` on every command, so the solver gates direct and transitive dependencies alike. Use the repo's pin (`requires-poetry`, CI `poetry-version`) when it is 2.4 or newer; otherwise run the Package manager group's target with `uvx --from 'poetry==<version>' poetry …`. That group ships first and brings the repo's pin up to match.
- **pip-tools** — the compiler the compiled file's header names, with the flags it records.

## Runtime version

The **floor** is the lowest Python the project supports: the lower bound of `[project] requires-python`,
Poetry's `python` dependency, or `python_requires` in `setup.cfg`; for a requirements-only project, the
lowest Python version CI runs. No upgrade may require a newer Python than the floor — the uv and
Poetry solvers reject it ("requires Python >=3.10, so it will not be installable for Python
>=3.8,<3.10"). A newer release the floor blocks is a deferral (`pytest 9.1.1 needs Python ≥ 3.10;
floor 3.8`). Never raise the floor in a dependency PR — for a published library it drops users — and
say in the done report when it is past end of life per
[endoflife.date/python](https://endoflife.date/python), with how many deferrals it blocks.

`python` images follow the Python **minor** in `.python-version`, then CI `python-version`, never below
the floor; if those two disagree, stop and report. Moving to a new minor moves `.python-version` and the images together, with the user's
approval.

## Candidates

A listing's "latest" is a candidate, never the target by itself; see
[Version targeting](#version-targeting).

- uv: `uv tree --outdated --depth 1 --all-groups --frozen` — the `(latest: …)` annotations ignore any release-age gate.
- Poetry: `POETRY_SOLVER_MIN_RELEASE_AGE=7 poetry show --outdated --top-level` — "Latest" is gated but ignores the floor.
- pip-tools and pip: each top-level requirement in the `.in` files or the pinned `.txt`, looked up on PyPI.

Classify each dependency:

- **Dev** — non-main Poetry groups (`[tool.poetry.group.<name>.dependencies]`), `[dependency-groups]`, uv `dev-dependencies`, `[project.optional-dependencies]` extras for development (`dev`, `test`, `lint`, `docs`, `typing`), `requirements-dev*.txt` / `-test` / `-lint` / `-docs` files, and `[build-system] requires`.
- **Runtime** — `[project] dependencies`, `[tool.poetry.dependencies]` (except `python`), other extras, and `requirements.txt`.

**Exclude from dev groups** — type stubs and test plugins travel with the runtime package they serve:
`types-<name>` and `<name>-stubs` move with `<name>`; `django-stubs` and `pytest-django` with Django;
`boto3-stubs` and `types-boto3` with the AWS SDK group.

## Dev groups

1. **Package manager → 1 PR** (`chore/package-manager`): uv — `required-version` and the `version` input of `astral-sh/setup-uv`; Poetry — `requires-poetry`, CI `poetry-version`, and `pip install poetry==` pins; pip-tools — its `pip-tools` pin. The target is the newest release that passes the release-age gate (PyPI row). With the new version, run `uv lock --check` or `poetry check --lock`; regenerate the lock (`uv lock`, `poetry lock` — neither moves versions) only when that check fails. This group comes first because Poetry 2.4 brings the solver gate.
2. **Test and code quality → 1 PR** (`chore/code-quality`): `pytest`, `pytest-*`, `hypothesis`, `coverage`, `tox`, `nox`, `ruff`, `black`, `isort`, `flake8` and its plugins, `pylint`, `mypy`, `pyright`, `bandit`, `pre-commit`, `responses`, `requests-mock`, `freezegun`, `time-machine`, `factory-boy`, `faker`. When a bumped tool is also a hook in `.pre-commit-config.yaml` (`ruff`, `black`, `isort`, `mypy`, `flake8`), move that hook's `rev` to the matching tag in the same PR.
3. **Build tooling → 1 PR** (`chore/build-tooling`): `[build-system] requires` entries pinned with `==` or `~=` (`hatchling`, `setuptools`, `poetry-core`, `flit-core`, `maturin`, `scikit-build-core`, `setuptools-scm`, `hatch-vcs`), and dev pins of `build`, `twine`, `wheel`, `cython`. `[build-system] requires` is not locked and no package-manager command edits it (`uv add` would add the backend to the runtime dependencies): edit the pin in place, then verify with a package build.

## Runtime groups

1. **Web frameworks → 1 PR each**: Django (`django`, `django-*`, `djangorestframework`); FastAPI (`fastapi`, `starlette`, `uvicorn`); Flask (`flask`, `werkzeug`, `jinja2`, `itsdangerous`, `flask-*`).
2. **Backend ecosystems → 1 PR each**:
   - Pydantic: `pydantic`, `pydantic-core`, `pydantic-settings`
   - SQLAlchemy: `sqlalchemy`, `alembic`, `sqlmodel`; database drivers individually
   - Scientific stack: `numpy`, `pandas`, `scipy`, `scikit-learn`, `pyarrow` — they share a binary interface
   - AWS SDK: `boto3`, `botocore`, `s3transfer`, `aiobotocore` — they release in lockstep
   - Google Cloud: `google-cloud-*`, `google-api-core`, `google-auth`
   - gRPC / Protobuf: `grpcio`, `grpcio-*`, `protobuf`
   - Azure SDK: `azure-core`, `azure-identity`, and the `azure-*` client libraries
   - HTTP clients, one PR each: `httpx` with `httpcore`; `aiohttp`; `requests` with `urllib3`
   - Task queues: `celery`, `kombu`, `billiard`
   - OpenTelemetry: `opentelemetry-*`
3. **Everything else → 1 PR per package** (`chore/<package>`).

## Apply and verify

Rewrite each requirement to the target, keeping its operator (`^`, `~=`, `>=`, `==`); then lock:

- **uv** — `uv add --frozen '<name><op><target>'` with the flag for the section it lives in (`--group <name>`, `--optional <extra>`, `--dev`), then `uv lock --upgrade-package '<name>==<target>'`.
- **Poetry** — `POETRY_SOLVER_MIN_RELEASE_AGE=7 poetry add --lock '<name>@<op><target>'`, with `--group <name>` for a non-main group.
- **pip-tools** — raise the bound in the `.in` file if it pins one, then rerun the header's compile command with `--upgrade-package '<name>==<target>'`.
- **pip** — edit the `==` line.
- A requirements file exported from the lock (its header names `poetry export` or `uv export`) is regenerated with the same command after locking.
- **Transitive check (uv, pip-tools).** Their resolution is not gated, so date every package the lock diff adds or moves against the release-age gate; re-lock any that fails to its gated version with another `--upgrade-package '<dep>==<version>'`. Skip this only when `[tool.uv] exclude-newer` is a relative span of 7 days or more.
- **Never** run `uv lock --upgrade`, `poetry update` without package names, `pip-compile --upgrade`, or `pip install -U`; never hand-edit `uv.lock`, `poetry.lock`, or a compiled requirements file.
- Verify with what CI runs: install from the lock (`uv sync --locked --all-groups`, `poetry install`, `pip install -r …`), then the tests, linters, type checks, and package build (`uv build`, `poetry build`). If CI tests the floor Python, run the tests on it too.

## Version targeting

The target is the newest final release that passes the release-age gate and whose `requires-python`
admits the floor. Walk candidates newest first in the PyPI simple JSON (the PyPI row in `SKILL.md`):
it gives each file's upload time and `requires-python`, so one fetch settles both. Under Poetry 2.4+
with the gate on, its "Latest" already applies the gate but not the floor; the solvers reject a floor
violation, as a backstop. Final means no `a`, `b`, `rc`, or `.dev` segment; a post-release (`.post1`)
is final. Yanked releases are ineligible. A package from a private index uses that index's upload
times under the same rule; an index without them leaves the package ineligible.

## Titles

E.g. `root - chore: upgrade Poetry`, `api - chore: upgrade Django dependencies`,
`root - chore: upgrade AWS SDK dependencies`.

## AI models

Scan `.py`, `.ipynb`, and `.toml` / `.yaml` / `.ini` config. Provider SDKs: `anthropic`, `openai`,
`google-genai`, `boto3` (Bedrock), `litellm`, `langchain-*`, `llama-index-*`.
