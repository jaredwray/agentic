---
name: ai-model-discovery
description: Find every AI model ID a repository calls — Anthropic, OpenAI, Google, hosted Bedrock or Vertex IDs, or any other provider — in code, config, env templates, CI, and docs; look up each provider's current catalog and deprecations page; and recommend the newest generally-available model in the same tier, one line per reference, stopping for per-provider approval before anything changes. Read-only background discipline the dependency-management skills run as their last runtime group. Use when asked whether a project's AI models are current, which model to upgrade to, or whether any model ID in use is deprecated or retiring.
user-invocable: true
---

# AI model discovery

The shared procedure for finding the AI model IDs a repo calls and recommending upgrades.
`dependency-management-node` and `dependency-management-rust` run it as their last runtime group, once
the provider SDKs are already at their targets; on its own it answers "are our models current?".

> This discipline is read-only: it ends with a recommendation and a stop. Applying an approved bump —
> the edit, the verification, the PR — belongs to the consumer skill.

## Scan for model references

Sweep the whole repo and record every candidate before judging any:

- Source files, config (`config/*.json|yaml|toml`), env templates (`.env.example`, `.env.*`),
  `.github/workflows/*.yml` `env:` blocks, Dockerfile `ENV` lines, Compose files, and docs that state
  the default model. The consumer skill names its language's source files and provider SDKs.
- Anthropic `claude-*`, OpenAI `gpt-*`, the `o`-series (`o1`, `o3`, `o4-mini`), `text-embedding-*`,
  `whisper-*`, `dall-e-*`, Google `gemini-*`, `imagen-*`, `veo-*`, hosted IDs (Bedrock
  `anthropic.claude-*` and other `<vendor>.<model>` IDs, Vertex `claude-*@<date>`), and any other ID
  passed as a `model` argument or set as a `*_MODEL` default (Mistral, Cohere, Voyage, Ollama tags).
- Skip historical records — CHANGELOG, ADRs, migration files, recorded fixtures, cassettes, and
  snapshots — plus lockfiles and vendored code. Values that live outside the repo (CI repository
  variables, deployment config) are listed as follow-ups, not edited.

## Query for latest models

The catalog and deprecations page of whoever serves the model are the source of truth — never memory:

- Anthropic, direct API — the
  [models overview](https://platform.claude.com/docs/en/about-claude/models/overview) and
  [model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations);
  `GET https://api.anthropic.com/v1/models` lists the same IDs when a key is available.
- OpenAI — the [models page](https://developers.openai.com/api/docs/models) and
  [deprecations](https://developers.openai.com/api/docs/deprecations).
- Google Gemini API — the [models page](https://ai.google.dev/gemini-api/docs/models) and
  [deprecations](https://ai.google.dev/gemini-api/docs/deprecations).
- Hosted through a platform — the platform's own catalog and lifecycle pages decide the ID and the
  availability, which vary by region and carry the platform's own retirement dates: Amazon Bedrock's
  [models at a glance](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html) and
  [model lifecycle](https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle.html); Vertex
  AI's [Claude models](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude)
  page and the partner-model deprecations it links to. The vendor's own page is not authoritative for a
  hosted reference.
- Any other provider — its published model list. A provider without one is reported as unverifiable,
  not guessed.

The target is the newest generally-available model in the same tier as the current one — frontier to
frontier, small/fast to small/fast, embeddings to embeddings — and, for a hosted ID, available in the
region the reference uses. Previews, experimental releases, and models the provider marks deprecated
or legacy are never targets. When the provider has retired the tier, the target is the successor its
deprecations or migration page names. Keep the repo's ID style (dated snapshot or alias, vendor or
hosted form).

## Recommend, then wait

Model changes alter output, cost, and rate limits, so this discipline always stops and asks before any
change. Render one line per reference — `<path:line> · <current> → <target> · <why>` (newer
generation; deprecated, retires <date>; already current) — grouped by provider, most references first,
plus one line per provider naming the request-shape changes its migration guide requires for the
target (a bare ID swap the API rejects is not an upgrade). Nothing longer.

Approval is per provider. Ask for the first provider in the rendered order, record the answer for
every provider the user addresses, and hand only that first provider's approved bumps back to the
consumer skill; each other provider ships in its own later iteration. Declined bumps are deferrals and
are not recommended again while the target is unchanged.
