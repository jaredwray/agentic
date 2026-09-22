## Safe Chain

Package installs in this environment go through Aikido Safe Chain shims. Never bypass them:

- Keep `~/.safe-chain/shims` first on `PATH`.
- Do not call unshimmed `npm`, `pnpm`, `npx`, or `pnpx`.
- Do not install packages with `curl | sh` or by pointing at a package manager outside the shim directory.

## Pull requests

Opening a pull request is not the end of the task. Wait about 20 minutes for automated and human code
reviews to land, then follow up on every review comment before starting anything else:

- Judge each comment against the code, not against the reviewer: is the finding actually true here?
- Valid: make the fix, run the same checks CI runs, push, and reply inline on that thread with what
  changed and the commit SHA.
- Not valid: reply inline on that thread with the concrete reason it does not apply (cite the file and
  line), and leave the thread open for the reviewer to close.
- Never leave a review comment unanswered, and never resolve a thread you disagree with.
- After each push, wait again and repeat until CI is green and every thread has a reply.
