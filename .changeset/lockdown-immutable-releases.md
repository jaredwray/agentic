---
"agentic": minor
---

Enable immutable GitHub Releases in lockdown-repo.sh

`lockdown-repo.sh` now turns on GitHub immutable releases (`PUT
/repos/{owner}/{repo}/immutable-releases`) and `--check` fails while they are off.
Published release assets and tags cannot be changed afterward. Existing releases
stay mutable until republished. Owner-enforced org policy counts as done.
