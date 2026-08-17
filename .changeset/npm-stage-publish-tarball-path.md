---
"agentic": patch
---

Prefix staged-publish tarball paths with `./` so npm 11+ does not treat them as GitHub repos

`npm stage publish packed/*.tgz` expands to a bare `dir/file.tgz` path. npm 11+ parses that as
GitHub `owner/repo` shorthand (npa), so CI runs `git ls-remote ssh://git@github.com/packed/…tgz.git`
and dies with `Permission denied (publickey)` — which looks like an SSH-key or trusted-publisher
failure and is neither. Defense-in-depth now ships a `release.yaml` template that packs then runs
`npm stage publish ./packed/*.tgz`; the release-management publish template uses `./dist/*.tgz`.
The skills validator rejects a tarball arg that is missing the `./` prefix.
